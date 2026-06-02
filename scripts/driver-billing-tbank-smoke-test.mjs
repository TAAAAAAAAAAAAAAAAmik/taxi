import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const backendPort = Number(process.env.DRIVER_BILLING_TBANK_SMOKE_PORT || 3315);
const providerPort = Number(process.env.DRIVER_BILLING_TBANK_PROVIDER_PORT || 3316);
const baseUrl = `http://localhost:${backendPort}`;
const providerBaseUrl = `http://localhost:${providerPort}/v2`;
const dbPath = resolve(process.cwd(), '.data/driver-billing-tbank-smoke-db.json');
const terminalKey = 'smoke-terminal';
const terminalPassword = 'smoke-password';
const webhookToken = 'smoke-webhook-token';

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
      MVP_PAYMENT_PROVIDER: 'tbank',
      MVP_PAYMENT_PROVIDER_MODE: 'live',
      MVP_PAYMENT_RETURN_URL: 'taxipartner://payments/smoke-return',
      MVP_TBANK_API_URL: providerBaseUrl,
      MVP_TBANK_FAIL_URL: 'taxipartner://payments/smoke-fail',
      MVP_TBANK_NOTIFICATION_URL: `${baseUrl}/payments/tbank/webhook`,
      MVP_TBANK_PASSWORD: terminalPassword,
      MVP_TBANK_SUCCESS_URL: 'taxipartner://payments/smoke-success',
      MVP_TBANK_TERMINAL_KEY: terminalKey,
      MVP_TBANK_WEBHOOK_TOKEN: webhookToken,
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
      paymentMethod: 'T-Bank smoke card',
    },
    method: 'POST',
    token: admin.session.token,
  });

  const pendingPayment = created.payments[0];

  assert(pendingPayment.status === 'pending', 'Live T-Bank payment should wait for confirmation');
  assert(pendingPayment.confirmationUrl, 'Live T-Bank payment should expose PaymentURL');
  assert(pendingPayment.providerPaymentId, 'Live T-Bank payment should store PaymentId');
  assert(created.driver.subscriptionStatus !== 'active', 'Pending payment must not activate access');

  markProviderPaymentConfirmed(pendingPayment.providerPaymentId);

  await api(`/payments/tbank/webhook?token=${encodeURIComponent(webhookToken)}`, {
    body: {
      Amount: Math.round(pendingPayment.amount * 100),
      OrderId: pendingPayment.id,
      PaymentId: pendingPayment.providerPaymentId,
      Status: 'CONFIRMED',
      Success: true,
      TerminalKey: terminalKey,
    },
    method: 'POST',
  });

  const synced = await api(`/driver-payments/${encodeURIComponent(pendingPayment.id)}/sync`, {
    method: 'POST',
    token: admin.session.token,
  });

  assert(synced.payments[0].status === 'paid', 'Confirmed T-Bank payment should become paid');
  assert(synced.driver.subscriptionStatus === 'active', 'Confirmed T-Bank payment should activate access');
  assert(synced.payments[0].receipt, 'Confirmed T-Bank payment should have receipt');
  assert(synced.payments[0].providerRebillId, 'T-Bank payment should keep RebillId for future renewals');

  const refunded = await api(`/driver-payments/${encodeURIComponent(pendingPayment.id)}/refund`, {
    body: {
      reason: 'T-Bank smoke refund',
    },
    method: 'POST',
    token: admin.session.token,
  });

  assert(refunded.payments[0].status === 'refunded', 'T-Bank refund should update payment history');
  assert(refunded.payments[0].refundReceipt, 'T-Bank refund should have refund receipt');
  assert(refunded.driver.subscriptionStatus !== 'active', 'Refunding only active period should block access');

  console.log('Driver billing T-Bank smoke test passed');
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

    if (request.method === 'POST' && url.pathname === '/v2/Init') {
      const body = await readJsonBody(request);
      assertValidToken(body);

      const providerPayment = {
        Amount: body.Amount,
        ErrorCode: '0',
        OrderId: body.OrderId,
        PaymentId: `tb-payment-${providerPayments.size + 1}`,
        PaymentURL: `https://securepay.example.test/${body.OrderId}`,
        RebillId: undefined,
        Status: 'NEW',
        Success: true,
        TerminalKey: body.TerminalKey,
      };

      providerPayments.set(providerPayment.PaymentId, providerPayment);
      sendJson(response, 200, providerPayment);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/v2/GetState') {
      const body = await readJsonBody(request);
      assertValidToken(body);
      const providerPayment = providerPayments.get(String(body.PaymentId));

      if (!providerPayment) {
        sendJson(response, 200, {
          ErrorCode: '7',
          Message: 'Payment not found',
          Success: false,
          TerminalKey: body.TerminalKey,
        });
        return;
      }

      sendJson(response, 200, providerPayment);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/v2/Cancel') {
      const body = await readJsonBody(request);
      assertValidToken(body);
      const providerPayment = providerPayments.get(String(body.PaymentId));

      if (!providerPayment) {
        sendJson(response, 200, {
          ErrorCode: '7',
          Message: 'Payment not found',
          Success: false,
          TerminalKey: body.TerminalKey,
        });
        return;
      }

      const refundedPayment = {
        ...providerPayment,
        NewAmount: 0,
        OriginalAmount: providerPayment.Amount,
        Status: 'REFUNDED',
      };

      providerPayments.set(providerPayment.PaymentId, refundedPayment);
      sendJson(response, 200, refundedPayment);
      return;
    }

    sendJson(response, 404, { Message: 'Route not found', Success: false });
  });

  await new Promise((resolveListen) => {
    server.listen(providerPort, resolveListen);
  });

  return server;
}

function markProviderPaymentConfirmed(providerPaymentId) {
  const providerPayment = providerPayments.get(providerPaymentId);

  if (!providerPayment) {
    throw new Error('Provider payment missing in smoke mock');
  }

  providerPayments.set(providerPaymentId, {
    ...providerPayment,
    PaymentURL: undefined,
    RebillId: 'tb-rebill-1',
    Status: 'CONFIRMED',
  });
}

function assertValidToken(body) {
  const expectedToken = makeTBankToken(body, terminalPassword);

  assert(body.TerminalKey === terminalKey, 'T-Bank mock received invalid TerminalKey');
  assert(body.Token === expectedToken, 'T-Bank mock received invalid Token');
}

function makeTBankToken(body, password) {
  const tokenPayload = {
    ...body,
    Password: password,
  };
  delete tokenPayload.Token;

  const raw = Object.keys(tokenPayload)
    .filter((key) => {
      const value = tokenPayload[key];

      return value !== undefined && value !== null && typeof value !== 'object';
    })
    .sort()
    .map((key) => String(tokenPayload[key]))
    .join('');

  return createHash('sha256').update(raw).digest('hex');
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
      name: 'T-Bank Smoke Driver',
      phone: '+79001007777',
      plate: 'T777TB102',
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
