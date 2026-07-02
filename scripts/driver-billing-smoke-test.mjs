import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.env.DRIVER_BILLING_SMOKE_PORT || 3312);
const baseUrl = `http://localhost:${port}`;
const dbPath = resolve(process.cwd(), '.data/driver-billing-smoke-db.json');

let backend;

try {
  await rm(dbPath, { force: true });
  backend = spawn(process.execPath, ['scripts/mvp-backend.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MVP_ADMIN_PASSWORD: 'smoke-admin',
      MVP_DB_PATH: dbPath,
      MVP_PAYMENT_PROVIDER: 'smoke-demo-acquiring',
      MVP_PAYMENT_PROVIDER_MODE: 'demo',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backend.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  await waitForBackend();

  const admin = await loginAdmin();
  const driver = await createReadyDriver(admin.session.token);
  const initialBilling = await api(`/drivers/${encodeURIComponent(driver.id)}/billing`, {
    token: admin.session.token,
  });

  assert(initialBilling.payments.length === 0, 'New driver should not have subscription payments');

  const pendingRequest = await api(`/drivers/${encodeURIComponent(driver.id)}/billing/pay`, {
    body: {
      billingMode: 'monthly',
      paymentMethod: 'Smoke demo card',
    },
    method: 'POST',
    token: admin.session.token,
  });

  assert(pendingRequest.driver.subscriptionStatus !== 'active', 'Manual PRO request should wait for admin approval');
  assert(pendingRequest.driver.billingMode === 'monthly', 'Driver billing mode should store requested monthly plan');
  assert(!pendingRequest.driver.accessExpiresAt, 'Pending monthly request should not set access expiry');
  assert(pendingRequest.payments.length === 1, 'Payment history should contain one request');
  assert(pendingRequest.payments[0].status === 'pending', 'Manual PRO request should be pending');
  assert(!pendingRequest.payments[0].receipt, 'Pending manual request should not have receipt yet');
  assert(
    pendingRequest.payments[0].providerPaymentStatus === 'awaiting_manual_transfer',
    'Pending manual request should wait for transfer',
  );

  await api(`/drivers/${encodeURIComponent(driver.id)}/access`, {
    body: {
      billingMode: 'monthly',
      paymentMethod: 'Smoke admin confirmed transfer',
      subscriptionStatus: 'active',
    },
    method: 'PATCH',
    token: admin.session.token,
  });

  const paid = await api(`/drivers/${encodeURIComponent(driver.id)}/billing`, {
    token: admin.session.token,
  });

  assert(paid.driver.subscriptionStatus === 'active', 'Admin-confirmed driver should have active access');
  assert(paid.driver.billingMode === 'monthly', 'Driver billing mode should switch to monthly');
  assert(paid.driver.accessExpiresAt, 'Monthly payment should set access expiry');
  assert(paid.driver.subscriptionPlan === 'partner_pro', 'Monthly payment should activate Partner PRO plan');
  assert(paid.payments.length >= 2, 'Payment history should contain request and admin activation');
  assert(
    paid.payments.some((payment) => payment.status === 'paid' && payment.provider?.name === 'manual-admin'),
    'Admin activation should create paid manual payment',
  );
  assert(
    paid.payments.some((payment) => payment.providerPaymentStatus === 'manual_admin_confirmed'),
    'Original request should be marked as confirmed manually',
  );

  const synced = await api(`/driver-payments/${encodeURIComponent(paid.payments[0].id)}/sync`, {
    method: 'POST',
    token: admin.session.token,
  });

  assert(synced.payments[0].status === 'paid', 'Sync should keep paid demo payment active');

  const renewalRequest = await api(`/drivers/${encodeURIComponent(driver.id)}/billing/pay`, {
    body: {
      billingMode: 'monthly',
      paymentMethod: 'Smoke demo card',
    },
    method: 'POST',
    token: admin.session.token,
  });

  assert(renewalRequest.payments[0].status === 'pending', 'Renewal should wait for admin approval');

  await api(`/drivers/${encodeURIComponent(driver.id)}/access`, {
    body: {
      billingMode: 'monthly',
      paymentMethod: 'Smoke admin confirmed renewal',
      subscriptionStatus: 'active',
    },
    method: 'PATCH',
    token: admin.session.token,
  });

  const renewed = await api(`/drivers/${encodeURIComponent(driver.id)}/billing`, {
    token: admin.session.token,
  });

  assert(renewed.payments.length >= 4, 'Renewal should add request and admin activation payments');
  assert(
    Date.parse(renewed.driver.accessExpiresAt) > Date.parse(paid.driver.accessExpiresAt),
    'Renewal should extend access expiry',
  );

  const refund = await api(`/driver-payments/${encodeURIComponent(renewed.payments[0].id)}/refund`, {
    body: {
      reason: 'Smoke refund',
    },
    method: 'POST',
    token: admin.session.token,
  });

  assert(refund.payments[0].status === 'refunded', 'Refunded payment should stay in history');
  assert(refund.payments[0].refundReceipt, 'Refunded payment should have refund receipt');
  assert(refund.driver.subscriptionStatus === 'active', 'Previous paid period should keep access active');

  const dailyAccess = await api(`/drivers/${encodeURIComponent(driver.id)}/billing/pay`, {
    body: {
      billingMode: 'daily',
      paymentMethod: 'Smoke daily access',
    },
    method: 'POST',
    token: admin.session.token,
  });

  assert(dailyAccess.driver.subscriptionStatus === 'active', 'Daily access should activate driver access');
  assert(dailyAccess.driver.billingMode === 'daily', 'Driver billing mode should switch to daily');
  assert(dailyAccess.driver.accessExpiresAt, 'Daily access should set access expiry');
  assert(dailyAccess.driver.subscriptionPlan === 'daily_line', 'Daily access should activate daily plan');
  assert(dailyAccess.payments[0].amount === 120, 'Daily access should cost 120 RUB');
  assert(
    dailyAccess.driver.canReceiveOrders,
    'Daily access driver should still receive orders after compliance',
  );

  console.log('Driver billing smoke test passed');
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

async function createReadyDriver(adminToken) {
  const created = await api('/drivers', {
    body: {
      billingMode: 'monthly',
      name: 'Billing Smoke Driver',
      phone: '+79001009999',
      plate: 'B909BB102',
      status: 'approved',
      subscriptionStatus: 'inactive',
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

  assert(
    compliant.driver.accessBlockers.includes('paid_access'),
    'Driver should still need paid access after compliance',
  );
  return compliant.driver;
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
