import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.env.VERIFICATION_SMOKE_PORT || 3314);
const baseUrl = `http://localhost:${port}`;
const dbPath = resolve(process.cwd(), '.data/verification-smoke-db.json');

let backend;

try {
  await rm(dbPath, { force: true });
  backend = spawn(process.execPath, ['scripts/mvp-backend.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MVP_ADMIN_PASSWORD: 'smoke-admin',
      MVP_DB_PATH: dbPath,
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
      email: `verify-${stamp}@example.test`,
      firstName: 'Verify',
      lastName: 'Client',
      password: 'password-1',
      phone: `+7901${String(stamp).slice(-7)}`,
      role: 'client',
    },
    method: 'POST',
  });

  assert(registered.user.verificationStatus === 'pending_contacts', 'New user should wait for contacts');

  const phoneCode = await api('/auth/verification-code', {
    body: { channel: 'phone', target: registered.user.phone },
    method: 'POST',
    token: registered.session.token,
  });

  assert(phoneCode.code.length >= 4, 'Phone verification code should be returned in MVP mode');
  await expectApiFailure('/auth/verify-code', {
    body: { channel: 'phone', code: '0000', target: registered.user.phone },
    method: 'POST',
    token: registered.session.token,
  });

  const phoneVerified = await api('/auth/verify-code', {
    body: { channel: 'phone', code: phoneCode.code, target: registered.user.phone },
    method: 'POST',
    token: registered.session.token,
  });

  assert(phoneVerified.user.phoneVerifiedAt, 'Phone should be marked as verified');
  assert(
    phoneVerified.user.verificationStatus === 'pending_contacts',
    'User should still wait for email after phone verification',
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
  assert(emailVerified.user.verificationStatus === 'active', 'Client should become active');

  console.log('Verification smoke test passed');
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
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed: ${response.status} ${path}`);
  }

  return payload;
}

async function expectApiFailure(path, options = {}) {
  try {
    await api(path, options);
  } catch {
    return;
  }

  throw new Error(`Request should have failed: ${path}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}
