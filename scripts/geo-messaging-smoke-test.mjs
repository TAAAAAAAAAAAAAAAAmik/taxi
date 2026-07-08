import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.env.GEO_MESSAGING_SMOKE_PORT || 3316);
const baseUrl = `http://localhost:${port}`;
const dbPath = resolve(process.cwd(), '.data/geo-messaging-smoke-db.json');

let backend;

try {
  await rm(dbPath, { force: true });
  backend = spawn(process.execPath, ['scripts/mvp-backend.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MVP_ADMIN_PASSWORD: 'smoke-admin',
      MVP_DB_PATH: dbPath,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backend.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  await waitForBackend();

  const health = await api('/health');
  assert(health.geo.routes === 'local-fallback', 'Health should expose local geo fallback');
  assert(health.messageServer.mode === 'websocket+sse+polling', 'Health should expose realtime message server mode');
  const client = await registerClient();

  const addressSearch = await api('/geo/address-search?query=Янгантау&limit=5');
  assert(addressSearch.suggestions.length > 0, 'Address search should return suggestions');
  assert(
    addressSearch.suggestions.some((item) => /Янгантау/i.test(`${item.title} ${item.subtitle}`)),
    'Address search should find Янгантау',
  );

  const reverse = await api('/geo/reverse?latitude=55.2973&longitude=58.1274');
  assert(reverse.status === 'resolved', 'Reverse geocoder should resolve local point');
  assert(reverse.address.displayAddress, 'Reverse geocoder should return displayAddress');

  const route = await api('/geo/routes', {
    body: {
      destination: 'Санаторий Янгантау, с. Янгантау',
      minimumPrice: 420,
      optionsTotal: 120,
      pickup: 'Центр Малояза, с. Малояз',
      role: 'client',
      tariff: 'Эконом',
      tariffId: 'economy',
    },
    method: 'POST',
  });
  assert(route.estimate.distanceKm > 0, 'Route estimate should include distance');
  assert(route.estimate.durationMin > 0, 'Route estimate should include ETA');
  // Правило владельца: межсельская поездка = 30 ₽/км (+ опции), distancePrice уже
  // округлён до 10, total = distancePrice + options (минималка 420 перекрыта).
  assert(
    route.estimate.total === route.estimate.distancePrice + 120,
    `Intercity total must be per-km price plus options, got ${route.estimate.total}`,
  );
  assert(
    route.estimate.surgeCoefficient === undefined || route.estimate.surgeCoefficient === 1,
    'Route should not apply surge',
  );

  // По селу — фикс 120 ₽ + опции.
  const villageRoute = await api('/geo/routes', {
    body: {
      destination: 'Малояз, администрация',
      optionsTotal: 80,
      pickup: 'Малояз, центр',
      role: 'client',
      tariffId: 'economy',
    },
    method: 'POST',
  });
  assert(
    villageRoute.estimate.total === 200,
    `Same-village trip must be flat 120 RUB plus options, got ${villageRoute.estimate.total}`,
  );

  const support = await api('/support/messages', {
    body: {
      category: 'Поездка',
      role: 'client',
      text: 'Нужна помощь по маршруту',
      title: 'Smoke support',
    },
    method: 'POST',
    token: client.session.token,
  });
  assert(support.thread.messages.length >= 2, 'Support thread should include user and server messages');

  const threads = await api('/support/threads?role=client', { token: client.session.token });
  assert(threads.threads.some((thread) => thread.id === support.thread.id), 'Support thread should be listed');

  const snapshot = await api('/realtime/snapshot', { token: client.session.token });
  assert(snapshot.supportThreads.some((thread) => thread.id === support.thread.id), 'Realtime snapshot should include support threads');
  assert(snapshot.notifications.some((item) => item.kind === 'support-message'), 'Realtime snapshot should include support notification');

  console.log('Geo and messaging smoke test passed');
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

async function registerClient() {
  const stamp = Date.now();

  return api('/auth/register', {
    body: {
      email: `geo-client-${stamp}@example.test`,
      firstName: 'Geo',
      lastName: 'Client',
      password: 'password-1',
      phone: `+7977${String(stamp).slice(-7)}`,
      role: 'client',
    },
    method: 'POST',
  });
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
