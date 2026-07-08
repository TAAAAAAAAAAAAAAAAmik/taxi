import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.env.DISPATCH_SMOKE_PORT || 3311);
const baseUrl = `http://localhost:${port}`;
const dbPath = resolve(process.cwd(), '.data/dispatch-smoke-db.json');

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

  const admin = await loginAdmin();
  const client = await registerClient();
  const clientToken = client.session.token;
  const firstDriver = await createReadyDriver(admin.session.token, 'First Driver', '+79001000001', 'A101AA102');
  const secondDriver = await createReadyDriver(admin.session.token, 'Second Driver', '+79001000002', 'A202AA102');
  await setDriverAvailability(admin.session.token, firstDriver.id, true, {
    latitude: 55.2,
    longitude: 58.2,
  });
  await setDriverAvailability(admin.session.token, secondDriver.id, true, {
    latitude: 55.5,
    longitude: 58.5,
  });

  const exclusiveOrder = await createOrder({
    clientName: 'Exclusive Client',
    clientPhone: '+79008888888',
    destination: 'Exclusive destination',
    paymentMethod: 'Карта',
    pickup: 'Exclusive pickup',
    pickupPoint: {
      latitude: 55.2,
      longitude: 58.2,
    },
    role: 'client',
    tariff: 'economy',
    total: 510,
  }, clientToken);

  assert(exclusiveOrder.dispatchMode === 'exclusive', 'Nearest order should start as exclusive');
  assert(exclusiveOrder.exclusiveDriverId === firstDriver.id, 'Nearest driver should receive exclusive offer');

  await expectApiFailure(`/orders/${encodeURIComponent(exclusiveOrder.id)}/assign`, {
    body: { driverId: secondDriver.id },
    method: 'PATCH',
    token: admin.session.token,
  });

  const declinedOffer = await api(`/orders/${encodeURIComponent(exclusiveOrder.id)}/offer`, {
    body: { action: 'decline', driverId: firstDriver.id },
    method: 'PATCH',
    token: admin.session.token,
  });

  assert(declinedOffer.order.dispatchMode === 'feed', 'Declined exclusive offer should move to feed');
  assert(
    declinedOffer.order.dispatchStatus === 'driver_declined_open_feed',
    'Declined exclusive offer should record feed release status',
  );

  const acceptedFromFeed = await api(`/orders/${encodeURIComponent(exclusiveOrder.id)}/assign`, {
    body: { driverId: secondDriver.id },
    method: 'PATCH',
    token: admin.session.token,
  });

  assert(acceptedFromFeed.order.driver?.id === secondDriver.id, 'Order from feed should be available to another driver');
  assert(
    acceptedFromFeed.order.dispatchStatus === 'accepted_from_feed',
    'Order accepted after decline should be marked as feed acceptance',
  );

  const order = await createOrder({
    clientName: 'Dispatch Client',
    clientPhone: '+79009999999',
    destination: 'Dispatch destination',
    paymentMethod: 'Карта',
    pickup: 'Dispatch pickup',
    role: 'client',
    tariff: 'economy',
    total: 420,
  }, clientToken);

  assert(order.status === 'searching', `Expected searching order, got ${order.status}`);
  assert(order.paymentStatus === 'authorized', `Expected authorized payment, got ${order.paymentStatus}`);

  const accepted = await api(`/orders/${encodeURIComponent(order.id)}/assign`, {
    body: { driverId: firstDriver.id },
    method: 'PATCH',
    token: admin.session.token,
  });

  assert(accepted.order.status === 'accepted', `Expected accepted order, got ${accepted.order.status}`);
  assert(accepted.order.driver?.id === firstDriver.id, 'First driver should own the order');

  await expectApiFailure(`/orders/${encodeURIComponent(order.id)}/assign`, {
    body: { driverId: secondDriver.id },
    method: 'PATCH',
    token: admin.session.token,
  });

  for (const status of ['arrived', 'started', 'completed']) {
    const result = await api(`/orders/${encodeURIComponent(order.id)}/status`, {
      body: { status },
      method: 'PATCH',
      token: admin.session.token,
    });

    assert(result.order.status === status, `Expected ${status}, got ${result.order.status}`);
  }

  const orders = await api('/orders', { token: admin.session.token });
  const completed = orders.orders.find((item) => item.id === order.id);

  assert(completed?.receipt, 'Completed order should have receipt');
  assert(completed?.paymentStatus === 'paid', `Expected paid payment, got ${completed?.paymentStatus}`);
  assert(completed?.paidAt, 'Completed order should have paidAt');
  assert(completed?.paymentEvents?.some((item) => item.status === 'paid'), 'Payment history should include paid');
  assert(completed?.statusHistory?.some((item) => item.status === 'accepted'), 'Status history should include accept');
  assert(completed?.driverCollectedAmount === completed?.total, 'Driver should collect the full trip amount');
  assert(completed?.driverTrialActive === false, 'Trial model is removed: no free-trial flag on orders');
  assert(completed?.serviceShareRate === 0, `Expected 0% service share (no-percent model), got ${completed?.serviceShareRate}`);
  assert(completed?.serviceShareAmount === 0, `Expected no service share, got ${completed?.serviceShareAmount}`);
  assert(completed?.serviceShareStatus === 'not_applicable', 'Service share should not require transfer');
  assert(
    completed?.driverNetAmount === (completed?.total || 0) - (completed?.serviceShareAmount || 0),
    'Driver net amount should be total minus service share',
  );

  // Доля сервиса отменена: endpoint работает в no-op режиме и не меняет
  // расчёт заказа (совместимость со старыми клиентами).
  const shareNoop = await api(`/orders/${encodeURIComponent(order.id)}/service-share`, {
    body: {
      note: 'Smoke driver transfer report',
      status: 'reported_transferred',
    },
    method: 'PATCH',
    token: admin.session.token,
  });

  assert(
    shareNoop.order.serviceShareStatus === 'not_applicable' && shareNoop.order.serviceShareAmount === 0,
    'Service share endpoint should stay a no-op under the no-percent model',
  );

  const shareSummary = await api(
    `/service-share/summary?date=${encodeURIComponent(completed.serviceShareBatchDate)}`,
    {
      token: admin.session.token,
    },
  );
  assert(shareSummary.summary.orders.length >= 1, 'Service share summary should include completed order');
  assert(
    shareSummary.summary.summary.totalServiceShareAmount === 0,
    'Service share summary should stay zero under the no-percent model',
  );

  const refunded = await api(`/orders/${encodeURIComponent(order.id)}/payment`, {
    body: { note: 'Smoke refund check', paymentStatus: 'refunded' },
    method: 'PATCH',
    token: admin.session.token,
  });
  assert(refunded.order.paymentStatus === 'refunded', 'Payment endpoint should update payment status');

  const deliveryOrder = await createOrder({
    clientName: 'Delivery Client',
    clientPhone: '+79007777777',
    deliveryComment: 'Leave at reception',
    deliveryHandoff: 'door_to_door',
    deliveryPackageType: 'documents',
    destination: 'Delivery dropoff',
    packageDescription: 'Documents package',
    paymentMethod: 'РќР°Р»РёС‡РЅС‹Рµ',
    pickup: 'Delivery pickup',
    pickupPoint: {
      latitude: 55.2,
      longitude: 58.2,
    },
    recipientName: 'Delivery Receiver',
    recipientPhone: '+79006666666',
    role: 'client',
    serviceType: 'delivery',
    tariff: 'economy',
    total: 240,
  }, clientToken);

  assert(deliveryOrder.serviceType === 'delivery', 'Delivery order should keep serviceType');
  assert(deliveryOrder.deliveryHandoff === 'door_to_door', 'Delivery order should keep handoff mode');
  assert(deliveryOrder.deliveryPackageType === 'documents', 'Delivery order should keep package type');
  assert(deliveryOrder.packageDescription === 'Documents package', 'Delivery order should keep package description');
  assert(deliveryOrder.recipientName === 'Delivery Receiver', 'Delivery order should keep recipient name');
  assert(deliveryOrder.total >= 160, `Delivery order should use delivery minimum, got ${deliveryOrder.total}`);

  const acceptedDelivery = await api(`/orders/${encodeURIComponent(deliveryOrder.id)}/assign`, {
    body: { driverId: firstDriver.id },
    method: 'PATCH',
    token: admin.session.token,
  });

  assert(acceptedDelivery.order.driver?.id === firstDriver.id, 'Delivery order should be accepted by driver');
  assert(acceptedDelivery.order.serviceType === 'delivery', 'Accepted delivery should keep serviceType');
  assert(acceptedDelivery.order.deliveryHandoff === 'door_to_door', 'Accepted delivery should keep handoff mode');

  // Освобождаем слот активных заказов: exclusiveOrder ещё активен.
  await api(`/orders/${encodeURIComponent(exclusiveOrder.id)}/status`, {
    body: { status: 'completed' },
    method: 'PATCH',
    token: admin.session.token,
  });

  // Создание заказа: серверная цена, идемпотентность, лимит активных,
  // совпадающие адреса, сохранение stops/scheduledAt.
  const requestId = `SMOKE-${Date.now().toString(36)}`;
  const guardedOrder = await createOrder({
    clientName: 'Guard Client',
    clientPhone: '+79005550011',
    clientRequestId: requestId,
    destination: 'Guard destination',
    paymentMethod: 'Наличные',
    pickup: 'Guard pickup',
    role: 'client',
    scheduledAt: '2026-07-03T09:30',
    stops: ['Guard stop 1', 'Guard stop 2'],
    tariff: 'economy',
    total: 999,
  }, clientToken);

  // Правило владельца: 1 км = 30 ₽. Неизвестные адреса → база 9 км,
  // каждая остановка +1.8 км: (9 + 2×1.8) × 30 = 378 → округление до 10 = 380.
  assert(
    guardedOrder.total === 380,
    `Client total must be recomputed server-side ((9 + 2*1.8) km * 30 ₽, round to 10), got ${guardedOrder.total}`,
  );
  assert(
    Array.isArray(guardedOrder.stops) && guardedOrder.stops.length === 2,
    'Order should persist intermediate stops',
  );
  assert(guardedOrder.scheduledAt === '2026-07-03T09:30', 'Order should persist scheduledAt');

  const replayedOrder = await createOrder({
    clientRequestId: requestId,
    destination: 'Guard destination',
    paymentMethod: 'Наличные',
    pickup: 'Guard pickup',
    role: 'client',
    tariff: 'economy',
    total: 999,
  }, clientToken);

  assert(replayedOrder.id === guardedOrder.id, 'Same clientRequestId must return the same order, not a duplicate');

  // У клиента уже 2 активных заказа (доставка + guarded) — третий отклоняется.
  await expectApiFailure('/orders', {
    body: {
      destination: 'Third destination',
      paymentMethod: 'Наличные',
      pickup: 'Third pickup',
      role: 'client',
      tariff: 'economy',
      total: 120,
    },
    method: 'POST',
    token: clientToken,
  });

  await expectApiFailure('/orders', {
    body: {
      destination: 'Малояз, Советская 1',
      paymentMethod: 'Наличные',
      pickup: 'малояз советская 1',
      role: 'client',
      tariff: 'economy',
      total: 120,
    },
    method: 'POST',
    token: clientToken,
  });

  console.log('Dispatch smoke test passed');
} finally {
  if (backend) {
    backend.kill();
  }

  await rm(dbPath, { force: true });
}

async function loginAdmin() {
  return api('/auth/admin-login', {
    body: {
      password: 'smoke-admin',
    },
    method: 'POST',
  });
}

async function registerClient() {
  const stamp = Date.now();

  return api('/auth/register', {
    body: {
      email: `dispatch-client-${stamp}@example.test`,
      firstName: 'Dispatch',
      lastName: 'Client',
      password: 'password-1',
      phone: `+7999${String(stamp).slice(-7)}`,
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

async function setDriverAvailability(adminToken, driverId, isOnline, location) {
  const response = await api(`/drivers/${encodeURIComponent(driverId)}/availability`, {
    body: {
      isOnline,
      location,
    },
    method: 'PATCH',
    token: adminToken,
  });

  assert(response.driver.isOnline === isOnline, 'Driver availability should update');
  return response.driver;
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
