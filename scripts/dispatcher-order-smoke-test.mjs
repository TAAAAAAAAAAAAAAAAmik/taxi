// Человек звонит по телефону, диспетчер вбивает адрес, заказ уходит
// водителям. Главное, что здесь легко сломать: в заказе должен остаться
// номер позвонившего, а не диспетчера, иначе водитель позвонит не туда.
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.env.DISPATCHER_ORDER_SMOKE_PORT || 3323);
const baseUrl = `http://localhost:${port}`;
const dbPath = resolve(process.cwd(), '.data/dispatcher-order-smoke-db.json');

let backend;

try {
  await rm(dbPath, { force: true });
  backend = spawn(process.execPath, ['scripts/mvp-backend.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MVP_ADMIN_PASSWORD: 'smoke-admin',
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

  const admin = await api('/auth/admin-login', { body: { password: 'smoke-admin' }, method: 'POST' });
  const adminToken = admin.session.token;
  const stamp = Date.now();
  const callerPhone = `+7962${String(stamp).slice(-7)}`;

  // Диспетчер оформляет заказ за позвонившего.
  const dispatched = await api('/orders', {
    body: {
      clientName: 'Гульнара',
      clientPhone: callerPhone,
      clientRequestId: `call-${stamp}`,
      destination: 'Малояз, Советская 12',
      orderSource: 'dispatcher',
      paymentMethod: 'Наличные',
      pickup: 'Малояз, Центральная 5',
      tariffId: 'economy',
    },
    method: 'POST',
    token: adminToken,
  });

  const order = dispatched.order;

  assert(order.clientPhone === callerPhone, `Order must keep the caller phone, got ${order.clientPhone}`);
  assert(order.clientName === 'Гульнара', 'Order must keep the caller name');
  assert(order.orderSource === 'dispatcher', 'Order must be marked as taken by phone');
  assert(!order.userId, 'Caller has no account, so the order must not belong to the dispatcher');
  assert(Boolean(order.dispatchedByUserId), 'Order must remember which dispatcher took the call');

  // Такой заказ должен вести себя как обычный клиентский: только тогда он
  // попадёт в ленту водителей.
  assert(order.role === 'client', `Phone order must be a client order, got role ${order.role}`);
  assert(order.status === 'searching', `Phone order must go looking for a driver, got ${order.status}`);
  assert(Number(order.total) > 0, 'Server must price the order by its own tariff');

  // Повторная отправка той же формы не создаёт второй заказ.
  const repeated = await api('/orders', {
    body: {
      clientName: 'Гульнара',
      clientPhone: callerPhone,
      clientRequestId: `call-${stamp}`,
      destination: 'Малояз, Советская 12',
      orderSource: 'dispatcher',
      paymentMethod: 'Наличные',
      pickup: 'Малояз, Центральная 5',
      tariffId: 'economy',
    },
    method: 'POST',
    token: adminToken,
  });

  assert(repeated.order.id === order.id, 'Repeated submit must return the same order');

  // Заказ по телефону должен попасть в обычную диспетчеризацию: система
  // сама предлагает его ближайшему водителю, как заказ из приложения.
  const feed = await api('/orders', { token: adminToken });
  const visible = feed.orders.find((item) => item.id === order.id);

  assert(visible, 'Phone order must be listed');
  assert(!visible.driver, 'Phone order must start unassigned');
  assert(
    Boolean(visible.exclusiveDriverId),
    'Phone order must enter dispatch and be offered to a driver',
  );

  const accepted = await api(`/orders/${encodeURIComponent(order.id)}/assign`, {
    body: { driverId: visible.exclusiveDriverId },
    method: 'PATCH',
    token: adminToken,
  });

  assert(Boolean(accepted.order.driver?.id), 'Driver must be able to take a phone order');
  assert(
    accepted.order.clientPhone === callerPhone,
    'After assignment the driver must still see the caller phone',
  );

  // Обычный клиент не может выдать свой заказ за диспетчерский.
  const client = await api('/auth/register', {
    body: {
      email: `caller-${stamp}@example.test`,
      firstName: 'Рустам',
      lastName: 'Клиент',
      password: 'password-1',
      phone: `+7964${String(stamp).slice(-7)}`,
      role: 'client',
    },
    method: 'POST',
  });

  const spoofed = await api('/orders', {
    body: {
      clientPhone: '+79990000000',
      clientRequestId: `spoof-${stamp}`,
      destination: 'Малояз, Советская 12',
      orderSource: 'dispatcher',
      paymentMethod: 'Наличные',
      pickup: 'Малояз, Центральная 5',
      tariffId: 'economy',
    },
    method: 'POST',
    token: client.session.token,
  });

  assert(
    spoofed.order.orderSource === 'app',
    'A client must not be able to pass their order off as a dispatcher call',
  );
  assert(
    spoofed.order.userId === client.user.id,
    'A client order must stay attached to its own account',
  );

  console.log('Dispatcher order smoke test passed');
} finally {
  if (backend) {
    backend.kill('SIGTERM');
  }

  await rm(dbPath, { force: true });
}

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    method: options.method || 'GET',
  });

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function waitForBackend() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);

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
