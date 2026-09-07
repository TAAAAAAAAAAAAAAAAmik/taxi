// Каждый отправленный код — это списанные деньги за SMS или звонок.
// Тест держит три рубежа защиты: паузу между кодами на один номер,
// потолок за час на номер и потолок за час на один IP.
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.env.CODE_RATE_LIMIT_SMOKE_PORT || 3319);
const baseUrl = `http://localhost:${port}`;
const dbPath = resolve(process.cwd(), '.data/code-rate-limit-smoke-db.json');

let backend;

try {
  await rm(dbPath, { force: true });
  backend = spawn(process.execPath, ['scripts/mvp-backend.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MVP_ADMIN_PASSWORD: 'smoke-admin',
      MVP_CODE_REQUESTS_PER_DAY: '6',
      MVP_CODE_REQUESTS_PER_HOUR: '3',
      MVP_CODE_REQUESTS_PER_IP_PER_HOUR: '5',
      MVP_CODE_REQUEST_COOLDOWN_SECONDS: '0',
      MVP_DB_PATH: dbPath,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backend.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  await waitForBackend();

  const stamp = Date.now();
  const phone = `+7902${String(stamp).slice(-7)}`;
  const registered = await api('/auth/register', {
    body: {
      email: `rate-${stamp}@example.test`,
      firstName: 'Rate',
      lastName: 'Limit',
      password: 'password-1',
      phone,
      role: 'client',
    },
    method: 'POST',
  });

  assert(Boolean(registered.session?.token), 'Registration should return a session');

  // Рубеж 1: потолок за час на один номер (3 запроса разрешены, 4-й нет).
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const status = await requestSmsLoginStatus(phone);
    assert(status === 202, `SMS login request #${attempt} must pass, got ${status}`);
  }

  const blockedByHour = await requestSmsLogin(phone);
  assert(
    blockedByHour.status === 429,
    `4th request for the same phone must be throttled, got ${blockedByHour.status}`,
  );
  assert(
    Number(blockedByHour.body.retryAfterSeconds) > 0,
    'Throttled response must tell the client when to retry',
  );

  // Рубеж 2: перебор ЧУЖИХ номеров с того же IP тоже упирается в потолок.
  // Номера незарегистрированные — код не уходит, но счётчик обязан расти,
  // иначе перебор остаётся бесплатным.
  let sawIpBlock = false;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const status = await requestSmsLoginStatus(`+7903${String(stamp + attempt).slice(-7)}`);

    if (status === 429) {
      sawIpBlock = true;
      break;
    }
  }

  assert(sawIpBlock, 'Spraying unknown phones from one IP must hit the per-IP limit');

  // Рубеж 3: пауза между кодами на один номер.
  await rm(dbPath, { force: true });
  const cooldownStatus = await withCooldownBackend(async (cooldownUrl) => {
    const cooldownPhone = `+7904${String(Date.now()).slice(-7)}`;
    await apiOn(cooldownUrl, '/auth/register', {
      body: {
        email: `cooldown-${Date.now()}@example.test`,
        firstName: 'Cool',
        lastName: 'Down',
        password: 'password-1',
        phone: cooldownPhone,
        role: 'client',
      },
      method: 'POST',
    });

    const first = await fetchOn(cooldownUrl, '/auth/sms-login/request', { phone: cooldownPhone });
    assert(first.status === 202, `First code must pass, got ${first.status}`);

    return fetchOn(cooldownUrl, '/auth/sms-login/request', { phone: cooldownPhone });
  });

  assert(
    cooldownStatus.status === 429,
    `Immediate repeat for the same phone must be throttled, got ${cooldownStatus.status}`,
  );

  console.log('Code rate limit smoke test passed');
} finally {
  if (backend) {
    backend.kill('SIGTERM');
  }

  await rm(dbPath, { force: true });
}

async function withCooldownBackend(run) {
  const cooldownPort = port + 1;
  const cooldownDbPath = resolve(process.cwd(), '.data/code-rate-limit-cooldown-db.json');
  await rm(cooldownDbPath, { force: true });
  const cooldownBackend = spawn(process.execPath, ['scripts/mvp-backend.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MVP_ADMIN_PASSWORD: 'smoke-admin',
      MVP_CODE_REQUESTS_PER_DAY: '99',
      MVP_CODE_REQUESTS_PER_HOUR: '99',
      MVP_CODE_REQUESTS_PER_IP_PER_HOUR: '99',
      MVP_CODE_REQUEST_COOLDOWN_SECONDS: '60',
      MVP_DB_PATH: cooldownDbPath,
      PORT: String(cooldownPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  cooldownBackend.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  try {
    await waitForBackend(`http://localhost:${cooldownPort}`);
    return await run(`http://localhost:${cooldownPort}`);
  } finally {
    cooldownBackend.kill('SIGTERM');
    await rm(cooldownDbPath, { force: true });
  }
}

function requestSmsLogin(phone) {
  return fetchOn(baseUrl, '/auth/sms-login/request', { phone });
}

async function requestSmsLoginStatus(phone) {
  const result = await requestSmsLogin(phone);
  return result.status;
}

async function fetchOn(url, path, body) {
  const response = await fetch(`${url}${path}`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  return { body: await response.json().catch(() => ({})), status: response.status };
}

function apiOn(url, path, options) {
  return api(path, options, url);
}

async function api(path, options = {}, url = baseUrl) {
  const response = await fetch(`${url}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    method: options.method || 'GET',
  });

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status}`);
  }

  return response.json();
}

async function waitForBackend(url = baseUrl) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${url}/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // Бэкенд ещё поднимается.
    }

    await new Promise((resolveDelay) => {
      setTimeout(resolveDelay, 250);
    });
  }

  throw new Error('Backend did not start in time');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
