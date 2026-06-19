import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.env.REGISTRATION_NO_SMS_SMOKE_PORT || 3320);
const baseUrl = `http://localhost:${port}`;
const dbPath = resolve(process.cwd(), '.data/registration-no-sms-smoke-db.json');

let backend;

try {
  await rm(dbPath, { force: true });
  backend = spawn(process.execPath, ['scripts/mvp-backend.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MVP_ADMIN_PASSWORD: 'smoke-admin',
      MVP_DB_PATH: dbPath,
      MVP_SKIP_PHONE_VERIFICATION: 'true',
      MVP_VERIFICATION_CODE_TTL_MINUTES: '10',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backend.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  await waitForBackend();

  const stamp = Date.now();
  const registered = await api('/auth/register', {
    body: {
      email: `nosms-${stamp}@example.test`,
      firstName: 'NoSms',
      lastName: 'Pilot',
      password: 'password-1',
      phone: `+7904${String(stamp).slice(-7)}`,
      role: 'client',
    },
    method: 'POST',
  });

  assert(registered.user.phoneVerifiedAt, 'Phone should be auto-verified in no-SMS pilot mode');
  assert(
    registered.user.verificationStatus === 'pending_contacts',
    'User should still wait for email after no-SMS registration',
  );

  const emailCode = await api('/auth/verification-code', {
    body: { channel: 'email', target: registered.user.email },
    method: 'POST',
    token: registered.session.token,
  });

  assert(emailCode.code.length >= 4, 'Email verification code should be returned in MVP mode');

  const emailVerified = await api('/auth/verify-code', {
    body: { channel: 'email', code: emailCode.code, target: registered.user.email },
    method: 'POST',
    token: registered.session.token,
  });

  assert(emailVerified.user.emailVerifiedAt, 'Email should be marked as verified');
  assert(emailVerified.user.verificationStatus === 'active', 'Client should become active after email only');

  console.log('No-SMS registration smoke test passed');
} finally {
  if (backend) {
    backend.kill();
  }

  await rm(dbPath, { force: true });
}

async function waitForBackend() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5000) {
    try {
      await api('/health');
      return;
    } catch {
      await delay(100);
    }
  }

  throw new Error('Backend did not start in time');
}

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed: ${response.status} ${path}`);
  }

  return payload;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
