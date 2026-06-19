import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const backendPort = Number(process.env.AUTH_DELIVERY_SMOKE_PORT || 3318);
const providerPort = Number(process.env.AUTH_DELIVERY_PROVIDER_PORT || 3319);
const baseUrl = `http://localhost:${backendPort}`;
const providerBaseUrl = `http://localhost:${providerPort}`;
const dbPath = resolve(process.cwd(), '.data/auth-delivery-smoke-db.json');
const deliveryToken = 'smoke-delivery-token';
const telegramBotToken = '123456:smoke-token';
const providerRequests = [];

let backend;
let provider;

try {
  await rm(dbPath, { force: true });
  provider = await startProviderMock();
  backend = spawn(process.execPath, ['scripts/mvp-backend.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MVP_ADMIN_PASSWORD: 'smoke-admin',
      MVP_DB_PATH: dbPath,
      MVP_DELIVERY_MODE: 'live',
      MVP_EMAIL_HTTP_TOKEN: deliveryToken,
      MVP_EMAIL_HTTP_URL: `${providerBaseUrl}/email`,
      MVP_EMAIL_PROVIDER: 'http',
      MVP_MAX_ACCESS_TOKEN: deliveryToken,
      MVP_MAX_API_URL: providerBaseUrl,
      MVP_MAX_PROVIDER: 'platform',
      MVP_MAX_USER_ID: '555001',
      MVP_PHONE_VERIFICATION_CHANNEL: 'sms',
      MVP_SMS_HTTP_TOKEN: deliveryToken,
      MVP_SMS_HTTP_URL: `${providerBaseUrl}/sms`,
      MVP_SMS_PROVIDER: 'http',
      MVP_TELEGRAM_API_URL: providerBaseUrl,
      MVP_TELEGRAM_BOT_TOKEN: telegramBotToken,
      MVP_TELEGRAM_CHAT_ID: '444001',
      MVP_TELEGRAM_PROVIDER: 'botapi',
      MVP_VERIFICATION_CODE_TTL_MINUTES: '10',
      PORT: String(backendPort),
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
      email: `delivery-${stamp}@example.test`,
      firstName: 'Delivery',
      lastName: 'Smoke',
      password: 'password-1',
      phone: `+7902${String(stamp).slice(-7)}`,
      role: 'client',
    },
    method: 'POST',
  });
  const initialToken = registered.session.token;

  const smsCode = await api('/auth/verification-code', {
    body: { channel: 'phone', deliveryChannel: 'sms', target: registered.user.phone },
    method: 'POST',
    token: initialToken,
  });

  assert(!smsCode.code, 'Live SMS response must not return the code');
  assert(smsCode.deliveryMode === 'provider-sent', 'SMS code should be sent by provider');
  assert(smsCode.provider === 'sms-http', 'SMS provider should be generic HTTP');
  assert(findProviderRequest('sms', 'verification'), 'SMS provider did not receive verification code');

  const telegramCode = await api('/auth/verification-code', {
    body: { channel: 'phone', deliveryChannel: 'telegram', target: registered.user.phone },
    method: 'POST',
    token: initialToken,
  });

  assert(!telegramCode.code, 'Live Telegram response must not return the code');
  assert(telegramCode.deliveryMode === 'provider-sent', 'Telegram code should be sent by provider');
  assert(telegramCode.provider === 'telegram-bot', 'Telegram provider should be Bot API');
  assert(findProviderRequest('telegram', 'verification'), 'Telegram provider did not receive verification code');

  const maxCode = await api('/auth/verification-code', {
    body: { channel: 'phone', deliveryChannel: 'max', target: registered.user.phone },
    method: 'POST',
    token: initialToken,
  });

  assert(!maxCode.code, 'Live MAX response must not return the code');
  assert(maxCode.deliveryMode === 'provider-sent', 'MAX code should be sent by provider');
  assert(maxCode.provider === 'max-platform', 'MAX provider should be platform API');
  assert(findProviderRequest('max', 'verification'), 'MAX provider did not receive verification code');

  const emailCode = await api('/auth/verification-code', {
    body: { channel: 'email', target: registered.user.email },
    method: 'POST',
    token: initialToken,
  });

  assert(!emailCode.code, 'Live email response must not return the code');
  assert(emailCode.deliveryMode === 'provider-sent', 'Email code should be sent by provider');
  assert(emailCode.provider === 'email-http', 'Email provider should be generic HTTP');
  assert(findProviderRequest('email', 'verification'), 'Email provider did not receive verification code');

  const resetCode = await api('/auth/password-reset/request', {
    body: { deliveryChannel: 'max', identifier: registered.user.phone },
    method: 'POST',
  });
  const resetProviderRequest = findProviderRequest('max', 'password-reset');
  const resetProviderCode = extractAuthCode(resetProviderRequest?.body?.text);

  assert(!resetCode.code, 'Live reset response must not return the code');
  assert(resetCode.deliveryMode === 'provider-sent', 'Reset code should be sent by provider');
  assert(resetProviderCode, 'Provider should receive reset code in message text');

  const resetConfirmed = await api('/auth/password-reset/confirm', {
    body: {
      code: resetProviderCode,
      identifier: registered.user.phone,
      password: 'password-2',
    },
    method: 'POST',
  });

  await expectApiFailure('/auth/logout-all', {
    method: 'POST',
    token: initialToken,
  });
  await expectApiFailure('/auth/login', {
    body: {
      identifier: registered.user.email,
      password: 'password-1',
      role: 'client',
    },
    method: 'POST',
  });

  await api('/auth/logout', {
    method: 'POST',
    token: resetConfirmed.session.token,
  });
  await expectApiFailure('/auth/logout-all', {
    method: 'POST',
    token: resetConfirmed.session.token,
  });

  const relogin = await api('/auth/login', {
    body: {
      identifier: registered.user.email,
      password: 'password-2',
      role: 'client',
    },
    method: 'POST',
  });

  assert(relogin.session.token, 'Updated password should allow login');

  const smsLoginCode = await api('/auth/sms-login/request', {
    body: {
      phone: registered.user.phone,
      role: 'client',
    },
    method: 'POST',
  });
  const smsLoginProviderRequest = findProviderRequest('sms', 'sms-login');
  const smsLoginProviderCode = extractAuthCode(smsLoginProviderRequest?.body?.text);

  assert(!smsLoginCode.code, 'Live SMS login response must not return the code');
  assert(smsLoginCode.deliveryMode === 'provider-sent', 'SMS login code should be sent by provider');
  assert(smsLoginProviderCode, 'Provider should receive SMS login code in message text');

  const smsLogin = await api('/auth/sms-login/confirm', {
    body: {
      code: smsLoginProviderCode,
      phone: registered.user.phone,
      role: 'client',
    },
    method: 'POST',
  });

  assert(smsLogin.session.token, 'SMS code should allow login');

  const db = JSON.parse(await readFile(dbPath, 'utf8'));
  const user = db.users.find((item) => item.id === registered.user.id);

  assert(user?.passwordHash?.startsWith('scrypt$'), 'Password should be stored as scrypt hash');
  assert(db.sessions.every((session) => session.tokenHash && !session.token), 'Sessions must store tokenHash only');
  assert(
    db.verificationCodes.every((record) => record.codeHash && !record.code),
    'Verification records must store codeHash only',
  );
  assert(
    db.deliveryEvents.every((event) => event.maskedTarget && !event.target),
    'Delivery audit should store masked targets only',
  );

  console.log('Auth delivery smoke test passed');
} finally {
  if (backend) {
    backend.kill();
  }

  if (provider) {
    await new Promise((resolveClose) => provider.close(resolveClose));
  }

  await rm(dbPath, { force: true });
}

async function startProviderMock() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const route = url.pathname.replace(/^\/+/, '');

    if (request.method === 'POST' && route === 'email') {
      await assertAuthorization(request);
      const body = await readJsonBody(request);
      providerRequests.push({ body, kind: 'email' });
      sendJson(response, 200, { id: `email-${providerRequests.length}` });
      return;
    }

    if (request.method === 'POST' && route === 'sms') {
      await assertAuthorization(request);
      const body = await readJsonBody(request);
      providerRequests.push({ body, kind: 'sms' });
      sendJson(response, 200, { id: `sms-${providerRequests.length}` });
      return;
    }

    if (request.method === 'POST' && route === `bot${telegramBotToken}/sendMessage`) {
      const body = await readJsonBody(request);
      providerRequests.push({
        body: {
          ...body,
          purpose: body.text?.includes('восстановления') ? 'password-reset' : 'verification',
        },
        kind: 'telegram',
      });
      sendJson(response, 200, { ok: true, result: { message_id: providerRequests.length } });
      return;
    }

    if (request.method === 'POST' && route === 'messages') {
      if (request.headers.authorization !== deliveryToken) {
        sendJson(response, 401, { error: 'Missing MAX token' });
        return;
      }

      const body = await readJsonBody(request);
      providerRequests.push({
        body: {
          ...body,
          purpose: body.text?.includes('восстановления') ? 'password-reset' : 'verification',
        },
        kind: 'max',
        query: Object.fromEntries(url.searchParams.entries()),
      });
      sendJson(response, 200, { message: { body: { mid: `max-${providerRequests.length}` } } });
      return;
    }

    sendJson(response, 404, { error: 'Route not found' });
  });

  await new Promise((resolveListen) => {
    server.listen(providerPort, resolveListen);
  });

  return server;
}

async function assertAuthorization(request) {
  if (request.headers.authorization !== `Bearer ${deliveryToken}`) {
    throw new Error('Missing delivery token');
  }
}

function findProviderRequest(kind, purpose) {
  return providerRequests.find((request) => request.kind === kind && request.body?.purpose === purpose);
}

function extractAuthCode(text) {
  const match = String(text || '').match(/: ([A-Z0-9]{4,8})\./);
  return match?.[1] || '';
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

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
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
