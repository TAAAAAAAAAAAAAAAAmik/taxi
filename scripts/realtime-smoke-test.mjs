import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.env.REALTIME_SMOKE_PORT || 3316);
const baseUrl = `http://localhost:${port}`;
const dbPath = resolve(process.cwd(), '.data/realtime-smoke-db.json');

let backend;
let stopStream;

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

  const admin = await loginAdmin();
  const client = await registerClient();
  const stream = await openRealtimeStream(admin.session.token);
  stopStream = stream.stop;
  await stream.waitFor((event) => event.event === 'snapshot', 'initial realtime snapshot');

  const driver = await createReadyDriver(admin.session.token, 'Realtime Driver', '+79005550000', 'R505TT102');
  await stream.waitFor(
    (event) => event.event === 'driver_compliance' && event.payload.driver?.id === driver.id,
    'driver compliance event',
  );

  const order = await createOrder({
    clientName: 'Realtime Client',
    clientPhone: '+79009998877',
    destination: 'Realtime destination',
    paymentMethod: 'Карта',
    pickup: 'Realtime pickup',
    role: 'client',
    tariff: 'economy',
    total: 530,
  }, client.session.token);
  const createdEvent = await stream.waitFor(
    (event) => event.event === 'order_created' && event.payload.order?.id === order.id,
    'order_created event',
  );

  assert(
    createdEvent.payload.snapshot.orders.some((item) => item.id === order.id),
    'Realtime snapshot should include created order',
  );
  assert(
    createdEvent.payload.snapshot.notifications.some((item) => item.orderId === order.id),
    'Realtime snapshot should include order notification',
  );

  await api(`/orders/${encodeURIComponent(order.id)}/assign`, {
    body: { driverId: driver.id },
    method: 'PATCH',
    token: admin.session.token,
  });
  const assignedEvent = await stream.waitFor(
    (event) => event.event === 'order_assigned' && event.payload.order?.driver?.id === driver.id,
    'order_assigned event',
  );
  assert(assignedEvent.payload.order.status === 'accepted', 'Assigned event should carry accepted status');

  await api(`/orders/${encodeURIComponent(order.id)}/status`, {
    body: { status: 'completed' },
    method: 'PATCH',
    token: admin.session.token,
  });
  const completedEvent = await stream.waitFor(
    (event) => event.event === 'order_status' && event.payload.order?.status === 'completed',
    'order_status completed event',
  );
  assert(completedEvent.payload.order.receipt, 'Completed realtime order should include receipt');

  // Лёгкий канал координат: PATCH /drivers/:id/location у водителя на линии
  // рассылает событие driver_location с точкой и без полного snapshot.
  await api(`/drivers/${encodeURIComponent(driver.id)}/availability`, {
    body: { isOnline: true },
    method: 'PATCH',
    token: admin.session.token,
  });
  const pingLocation = { accuracy: 8, latitude: 55.4312, longitude: 58.1483 };
  const locationResponse = await api(`/drivers/${encodeURIComponent(driver.id)}/location`, {
    body: { location: pingLocation },
    method: 'PATCH',
    token: admin.session.token,
  });

  assert(
    locationResponse.driver.lastLocation?.latitude === pingLocation.latitude,
    'Location PATCH should persist driver lastLocation',
  );

  const locationEvent = await stream.waitFor(
    (event) => event.event === 'driver_location' && event.payload.driverId === driver.id,
    'driver_location event',
  );

  assert(
    locationEvent.payload.location?.latitude === pingLocation.latitude &&
      locationEvent.payload.location?.longitude === pingLocation.longitude,
    'driver_location event should carry the pinged point',
  );
  assert(!locationEvent.payload.snapshot, 'driver_location event should be light (no snapshot)');

  await api(`/drivers/${encodeURIComponent(driver.id)}/availability`, {
    body: { isOnline: false },
    method: 'PATCH',
    token: admin.session.token,
  });
  const availabilityEvent = await stream.waitFor(
    (event) =>
      event.event === 'driver_availability' &&
      event.payload.driver?.id === driver.id &&
      event.payload.driver?.isOnline === false,
    'driver_availability offline event',
  );
  assert(availabilityEvent.payload.driver.isOnline === false, 'Driver availability event should carry offline state');

  const snapshot = await api('/realtime/snapshot', { token: admin.session.token });
  const snapshotOrder = snapshot.orders.find((item) => item.id === order.id);

  assert(snapshotOrder?.status === 'completed', 'Snapshot endpoint should expose latest completed order');
  assert(snapshot.notifications.length >= 4, 'Snapshot endpoint should expose accumulated notifications');

  console.log('Realtime smoke test passed');
} finally {
  if (stopStream) {
    stopStream();
  }

  if (backend) {
    backend.kill();
  }

  await rm(dbPath, { force: true });
}

async function openRealtimeStream(token) {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/realtime/stream?token=${encodeURIComponent(token)}`, {
    headers: { accept: 'text/event-stream' },
    signal: controller.signal,
  });

  assert(response.ok, `Realtime stream failed: ${response.status}`);
  assert(response.body, 'Realtime stream should have body');

  const events = [];
  const waiters = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const readLoop = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const parsed = parseSseEvent(chunk);

          if (parsed) {
            events.push(parsed);
            resolveWaiters(events, waiters);
          }
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        throw error;
      }
    }
  })();

  return {
    stop: () => {
      controller.abort();
      reader.cancel().catch(() => {});
    },
    waitFor: (predicate, label) => waitForStreamEvent(events, waiters, predicate, label),
    readLoop,
  };
}

function parseSseEvent(chunk) {
  if (!chunk.trim() || chunk.trim().startsWith(':')) {
    return null;
  }

  const event = { event: 'message', payload: undefined };
  const dataLines = [];

  for (const line of chunk.split('\n')) {
    if (line.startsWith('event:')) {
      event.event = line.slice(6).trim();
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (!dataLines.length) {
    return null;
  }

  event.payload = JSON.parse(dataLines.join('\n'));
  return event;
}

function waitForStreamEvent(events, waiters, predicate, label) {
  const existing = events.find(predicate);

  if (existing) {
    return existing;
  }

  return new Promise((resolveWait, rejectWait) => {
    const timeout = setTimeout(() => {
      rejectWait(new Error(`Timed out waiting for ${label}`));
    }, 6000);

    waiters.push({
      predicate,
      reject: rejectWait,
      resolve: (event) => {
        clearTimeout(timeout);
        resolveWait(event);
      },
    });

    resolveWaiters(events, waiters);
  });
}

function resolveWaiters(events, waiters) {
  for (const waiter of [...waiters]) {
    const event = events.find(waiter.predicate);

    if (event) {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(event);
    }
  }
}

async function loginAdmin() {
  return api('/auth/admin-login', {
    body: { password: 'smoke-admin' },
    method: 'POST',
  });
}

async function registerClient() {
  const stamp = Date.now();

  return api('/auth/register', {
    body: {
      email: `realtime-client-${stamp}@example.test`,
      firstName: 'Realtime',
      lastName: 'Client',
      password: 'password-1',
      phone: `+7988${String(stamp).slice(-7)}`,
      role: 'client',
    },
    method: 'POST',
  });
}

async function createReadyDriver(adminToken, name, phone, plate) {
  const created = await api('/drivers', {
    body: {
      billingMode: 'commission',
      name,
      phone,
      plate,
      status: 'approved',
      subscriptionStatus: 'active',
      vehicle: 'Lada Vesta',
    },
    method: 'POST',
    token: adminToken,
  });

  const compliant = await api(`/drivers/${encodeURIComponent(created.driver.id)}/compliance`, {
    body: {
      contractStatus: 'signed',
      documentsStatus: 'approved',
      registryStatus: 'active',
      taxProfileStatus: 'approved',
      vehiclePermitStatus: 'approved',
    },
    method: 'PATCH',
    token: adminToken,
  });

  assert(compliant.driver.canReceiveOrders, `${name} should be allowed to receive orders`);
  return compliant.driver;
}

async function createOrder(body, token) {
  const response = await api('/orders', {
    body,
    method: 'POST',
    token,
  });

  return response.order;
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
