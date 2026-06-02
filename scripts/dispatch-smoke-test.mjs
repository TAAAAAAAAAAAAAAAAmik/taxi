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
  const firstDriver = await createReadyDriver(admin.session.token, 'First Driver', '+79001000001', 'A101AA102');
  const secondDriver = await createReadyDriver(admin.session.token, 'Second Driver', '+79001000002', 'A202AA102');
  const order = await createOrder({
    clientName: 'Dispatch Client',
    clientPhone: '+79009999999',
    destination: 'Dispatch destination',
    paymentMethod: 'Карта',
    pickup: 'Dispatch pickup',
    role: 'client',
    tariff: 'economy',
    total: 420,
  });

  assert(order.status === 'searching', `Expected searching order, got ${order.status}`);
  assert(order.paymentStatus === 'authorized', `Expected authorized payment, got ${order.paymentStatus}`);

  const accepted = await api(`/orders/${encodeURIComponent(order.id)}/assign`, {
    body: { driverId: firstDriver.id },
    method: 'PATCH',
  });

  assert(accepted.order.status === 'accepted', `Expected accepted order, got ${accepted.order.status}`);
  assert(accepted.order.driver?.id === firstDriver.id, 'First driver should own the order');
  assert(accepted.order.tripPin, 'Assigned order should expose client trip PIN');

  await expectApiFailure(`/orders/${encodeURIComponent(order.id)}/assign`, {
    body: { driverId: secondDriver.id },
    method: 'PATCH',
  });

  for (const status of ['arrived', 'started', 'completed']) {
    const result = await api(`/orders/${encodeURIComponent(order.id)}/status`, {
      body: { pinCode: status === 'started' ? accepted.order.tripPin : undefined, status },
      method: 'PATCH',
    });

    assert(result.order.status === status, `Expected ${status}, got ${result.order.status}`);
  }

  const orders = await api('/orders');
  const completed = orders.orders.find((item) => item.id === order.id);

  assert(completed?.receipt, 'Completed order should have receipt');
  assert(completed?.paymentStatus === 'paid', `Expected paid payment, got ${completed?.paymentStatus}`);
  assert(completed?.paidAt, 'Completed order should have paidAt');
  assert(completed?.paymentEvents?.some((item) => item.status === 'paid'), 'Payment history should include paid');
  assert(completed?.statusHistory?.some((item) => item.status === 'accepted'), 'Status history should include accept');
  assert(completed?.driverCollectedAmount === completed?.total, 'Driver should collect the full trip amount');
  assert(completed?.serviceShareRate === 7, `Expected 7% service share, got ${completed?.serviceShareRate}`);
  assert(
    completed?.serviceShareAmount === Math.round((completed?.total || 0) * 0.07),
    `Expected service share from total, got ${completed?.serviceShareAmount}`,
  );
  assert(completed?.serviceShareStatus === 'pending_transfer', 'Service share should wait for daily transfer');
  assert(
    completed?.driverNetAmount === (completed?.total || 0) - (completed?.serviceShareAmount || 0),
    'Driver net amount should be total minus service share',
  );

  const reportedTransfer = await api(`/orders/${encodeURIComponent(order.id)}/service-share`, {
    body: {
      note: 'Smoke driver transfer report',
      status: 'reported_transferred',
    },
    method: 'PATCH',
    token: admin.session.token,
  });
  assert(
    reportedTransfer.order.serviceShareStatus === 'reported_transferred',
    'Driver should be able to report service share transfer',
  );
  assert(reportedTransfer.order.serviceShareReportedAt, 'Transfer report should store reportedAt');

  const confirmedTransfer = await api(`/orders/${encodeURIComponent(order.id)}/service-share`, {
    body: {
      note: 'Smoke admin transfer confirmation',
      status: 'confirmed',
    },
    method: 'PATCH',
    token: admin.session.token,
  });
  assert(
    confirmedTransfer.order.serviceShareStatus === 'confirmed',
    'Admin should confirm service share receipt',
  );
  assert(confirmedTransfer.order.serviceShareConfirmedAt, 'Transfer confirmation should store confirmedAt');

  const shareSummary = await api(
    `/service-share/summary?date=${encodeURIComponent(confirmedTransfer.order.serviceShareBatchDate)}`,
    {
      token: admin.session.token,
    },
  );
  assert(shareSummary.summary.orders.length >= 1, 'Service share summary should include completed order');
  assert(
    shareSummary.summary.summary.confirmedAmount >= completed.serviceShareAmount,
    'Service share summary should include confirmed amount',
  );

  const refunded = await api(`/orders/${encodeURIComponent(order.id)}/payment`, {
    body: { note: 'Smoke refund check', paymentStatus: 'refunded' },
    method: 'PATCH',
  });
  assert(refunded.order.paymentStatus === 'refunded', 'Payment endpoint should update payment status');

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

async function createOrder(body) {
  const response = await api('/orders', {
    body,
    method: 'POST',
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
