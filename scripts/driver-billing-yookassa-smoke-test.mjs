import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const backendPort = Number(process.env.DRIVER_BILLING_YOOKASSA_SMOKE_PORT || 3313);
const providerPort = Number(process.env.DRIVER_BILLING_YOOKASSA_PROVIDER_PORT || 3314);
const baseUrl = `http://localhost:${backendPort}`;
const providerBaseUrl = `http://localhost:${providerPort}/v3`;
const dbPath = resolve(process.cwd(), '.data/driver-billing-yookassa-smoke-db.json');

const providerPayments = new Map();
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
      MVP_PAYMENT_PROVIDER: 'yookassa',
      MVP_PAYMENT_PROVIDER_MODE: 'live',
      MVP_PAYMENT_RETURN_URL: 'taxipartner://payments/smoke-return',
      MVP_YOOKASSA_API_URL: providerBaseUrl,
      MVP_YOOKASSA_SECRET_KEY: 'smoke-secret',
      MVP_YOOKASSA_SHOP_ID: 'smoke-shop',
      PORT: String(backendPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backend.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  await waitForBackend();

  const admin = await loginAdmin();
  const driver = await createReadyDriver(admin.session.token);
  const created = await api(`/drivers/${encodeURIComponent(driver.id)}/billing/pay`, {
    body: {
      billingMode: 'monthly',
      paymentMethod: 'YooKassa smoke card',
    },
    method: 'POST',
    token: admin.session.token,
  });

  const pendingPayment = created.payments[0];

  assert(pendingPayment.status === 'pending', 'Live YooKassa payment should wait for provider confirmation');
  assert(pendingPayment.confirmationUrl, 'Live YooKassa payment should expose confirmation URL');
  assert(created.driver.subscriptionStatus !== 'active', 'Pending payment must not activate access');

  markProviderPaymentSucceeded(pendingPayment.providerPaymentId);

  const synced = await api(`/driver-payments/${encodeURIComponent(pendingPayment.id)}/sync`, {
    method: 'POST',
    token: admin.session.token,
  });

  assert(synced.payments[0].status === 'paid', 'Synced YooKassa payment should become paid');
  assert(synced.driver.subscriptionStatus === 'active', 'Succeeded YooKassa payment should activate access');
  assert(synced.payments[0].receipt, 'Succeeded YooKassa payment should have receipt');

  const refunded = await api(`/driver-payments/${encodeURIComponent(pendingPayment.id)}/refund`, {
    body: {
      reason: 'YooKassa smoke refund',
    },
    method: 'POST',
    token: admin.session.token,
  });

  assert(refunded.payments[0].status === 'refunded', 'YooKassa refund should update payment history');
  assert(refunded.payments[0].refundReceipt, 'YooKassa refund should have refund receipt');
  assert(refunded.driver.subscriptionStatus !== 'active', 'Refunding only active period should block access');

  console.log('Driver billing YooKassa smoke test passed');
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

    if (request.method === 'POST' && url.pathname === '/v3/payments') {
      await readJsonBody(request);
      const providerPayment = {
        confirmation: {
          confirmation_url: 'https://yookassa.example.test/confirm/smoke-payment',
          type: 'redirect',
        },
        id: `yk-payment-${providerPayments.size + 1}`,
        paid: false,
        status: 'pending',
      };

      providerPayments.set(providerPayment.id, providerPayment);
      sendJson(response, 200, providerPayment);
      return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/v3/payments/')) {
      const providerPaymentId = decodeURIComponent(url.pathname.replace('/v3/payments/', ''));
      const providerPayment = providerPayments.get(providerPaymentId);

      if (!providerPayment) {
        sendJson(response, 404, { description: 'Payment not found' });
        return;
      }

      sendJson(response, 200, providerPayment);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/v3/refunds') {
      const body = await readJsonBody(request);

      sendJson(response, 200, {
        amount: body.amount,
        id: 'yk-refund-1',
        payment_id: body.payment_id,
        status: 'succeeded',
      });
      return;
    }

    sendJson(response, 404, { description: 'Route not found' });
  });

  await new Promise((resolveListen) => {
    server.listen(providerPort, resolveListen);
  });

  return server;
}

function markProviderPaymentSucceeded(providerPaymentId) {
  const providerPayment = providerPayments.get(providerPaymentId);

  if (!providerPayment) {
    throw new Error('Provider payment missing in smoke mock');
  }

  providerPayments.set(providerPaymentId, {
    ...providerPayment,
    captured_at: new Date().toISOString(),
    confirmation: undefined,
    paid: true,
    status: 'succeeded',
  });
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
      billingMode: 'commission',
      name: 'YooKassa Smoke Driver',
      phone: '+79001008888',
      plate: 'Y888YK102',
      status: 'approved',
      subscriptionStatus: 'inactive',
      vehicle: 'Lada Granta',
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

  assert(compliant.driver.accessBlockers.includes('paid_access'), 'Driver should still need paid access');
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
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      accept: 'application/json',
      'content-type': 'application/json',
    },
    method: options.method || 'GET',
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed: ${response.status} ${path}`);
  }

  return payload;
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
    });

    request.on('end', () => {
      try {
        resolveBody(body ? JSON.parse(body) : {});
      } catch (error) {
        rejectBody(error);
      }
    });
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
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
