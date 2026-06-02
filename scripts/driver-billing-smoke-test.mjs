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

  const paid = await api(`/drivers/${encodeURIComponent(driver.id)}/billing/pay`, {
    body: {
      billingMode: 'monthly',
      paymentMethod: 'Smoke demo card',
    },
    method: 'POST',
    token: admin.session.token,
  });

  assert(paid.driver.subscriptionStatus === 'active', 'Paid driver should have active access');
  assert(paid.driver.billingMode === 'monthly', 'Driver billing mode should switch to monthly');
  assert(paid.driver.accessExpiresAt, 'Monthly payment should set access expiry');
  assert(paid.payments.length === 1, 'Payment history should contain one payment');
  assert(paid.payments[0].receipt, 'Paid subscription should have receipt');
  assert(paid.payments[0].provider.name === 'smoke-demo-acquiring', 'Payment should store provider');

  const synced = await api(`/driver-payments/${encodeURIComponent(paid.payments[0].id)}/sync`, {
    method: 'POST',
    token: admin.session.token,
  });

  assert(synced.payments[0].status === 'paid', 'Sync should keep paid demo payment active');

  const renewed = await api(`/drivers/${encodeURIComponent(driver.id)}/billing/pay`, {
    body: {
      billingMode: 'monthly',
      paymentMethod: 'Smoke demo card',
    },
    method: 'POST',
    token: admin.session.token,
  });

  assert(renewed.payments.length === 2, 'Renewal should add second payment');
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

  const commissionAccess = await api(`/drivers/${encodeURIComponent(driver.id)}/billing/pay`, {
    body: {
      billingMode: 'commission',
      paymentMethod: 'Smoke commission mode',
    },
    method: 'POST',
    token: admin.session.token,
  });

  assert(commissionAccess.driver.subscriptionStatus === 'active', 'Commission mode should keep active access');
  assert(commissionAccess.driver.billingMode === 'commission', 'Driver billing mode should switch to commission');
  assert(!commissionAccess.driver.accessExpiresAt, 'Commission mode should not set monthly access expiry');
  assert(commissionAccess.payments[0].amount === 0, 'Commission mode should not create monthly charge');
  assert(
    commissionAccess.driver.canReceiveOrders,
    'Commission driver should still receive orders after compliance',
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
