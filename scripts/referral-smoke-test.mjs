import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.env.REFERRAL_SMOKE_PORT || 3310);
const baseUrl = `http://localhost:${port}`;
const dbPath = resolve(process.cwd(), '.data/referral-smoke-db.json');
const documentStoragePath = resolve(process.cwd(), '.data/referral-smoke-documents');
const tinyImageBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

let backend;

try {
  await rm(dbPath, { force: true });
  await rm(documentStoragePath, { force: true, recursive: true });
  backend = spawn(process.execPath, ['scripts/mvp-backend.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MVP_ADMIN_PASSWORD: 'smoke-admin',
      MVP_DB_PATH: dbPath,
      MVP_DOCUMENT_STORAGE_PATH: documentStoragePath,
      MVP_INVITE_BASE_URL: 'taxipartner://invite',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backend.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  await waitForBackend();

  const admin = await loginAdmin();
  const stamp = Date.now();
  const inviter = await register({
    email: `inviter-${stamp}@example.test`,
    firstName: 'Smoke',
    lastName: 'Inviter',
    password: 'password-1',
    phone: `+7900${String(stamp).slice(-7)}`,
    role: 'client',
  });
  const inviterDashboard = await api(`/referrals?userId=${inviter.user.id}`, {
    token: inviter.session.token,
  });
  const code = inviterDashboard.referralCode;

  assert(code, 'Inviter referral code was not created');
  assert(
    inviterDashboard.inviteUrls?.client?.includes('role=client'),
    'Client invite URL should include role=client',
  );
  assert(
    inviterDashboard.inviteUrls?.driver?.includes('role=self_employed_driver'),
    'Driver invite URL should include role=self_employed_driver',
  );

  const validation = await api(`/referrals/validate?code=${encodeURIComponent(code)}`);
  assert(validation.valid, 'Referral code validation failed');

  const invitedClient = await register({
    email: `client-${stamp}@example.test`,
    firstName: 'Smoke',
    lastName: 'Client',
    password: 'password-1',
    phone: `+7910${String(stamp).slice(-7)}`,
    referralCode: code,
    role: 'client',
  });
  const invitedClientDashboard = await api(`/referrals?userId=${invitedClient.user.id}`, {
    token: invitedClient.session.token,
  });

  assert(
    invitedClientDashboard.bonusBalance === 0,
    `Invited client should not receive an upfront bonus, got ${invitedClientDashboard.bonusBalance}`,
  );

  for (let index = 0; index < 5; index += 1) {
    await completeClientOrder(invitedClient.session.token, admin.session.token, index);
  }

  const rewardedClientDashboard = await api(`/referrals?userId=${inviter.user.id}`, {
    token: inviter.session.token,
  });
  const clientReferral = rewardedClientDashboard.referrals.find(
    (referral) => referral.inviteeUserId === invitedClient.user.id,
  );

  assert(clientReferral?.status === 'rewarded', 'Client referral should be rewarded after 5 trips');
  assert(
    rewardedClientDashboard.bonusBalance >= 60,
    `Inviter client reward should be at least 60, got ${rewardedClientDashboard.bonusBalance}`,
  );

  const invitedDriver = await register({
    carBrand: 'Lada',
    carModel: 'Vesta',
    carPlate: 'A001AA102',
    email: `driver-${stamp}@example.test`,
    firstName: 'Smoke',
    lastName: 'Driver',
    password: 'password-1',
    phone: `+7920${String(stamp).slice(-7)}`,
    referralCode: code,
    role: 'driver',
    vehicleDocumentsReady: 'yes',
  });
  const drivers = await api('/drivers', { token: admin.session.token });
  const driver = drivers.drivers.find((item) => item.userId === invitedDriver.user.id);

  assert(driver, 'Driver profile was not created from invited driver registration');
  const documentResponse = await api(`/drivers/${encodeURIComponent(driver.id)}/documents`, {
    body: {
      documents: ['passport', 'driverLicense', 'sts', 'osago'].map((kind) => ({
        base64: tinyImageBase64,
        fileName: `${kind}.png`,
        height: 1,
        kind,
        mimeType: 'image/png',
        source: 'library',
        width: 1,
      })),
    },
    method: 'POST',
    token: invitedDriver.session.token,
  });

  assert(
    Object.keys(documentResponse.driver.documentUploads || {}).length === 4,
    'Driver document upload metadata should contain 4 files',
  );
  assert(
    documentResponse.driver.documentsStatus === 'pending',
    'Uploaded driver documents should wait for admin approval',
  );

  const approvedDriver = await api(`/drivers/${encodeURIComponent(driver.id)}/status`, {
    body: { status: 'approved' },
    method: 'PATCH',
    token: admin.session.token,
  });

  assert(
    approvedDriver.driver.subscriptionStatus === 'active',
    'Invited driver should receive trial access after approval',
  );
  assert(
    approvedDriver.driver.canReceiveOrders === false,
    'Approved invited driver should still wait for compliance before orders',
  );

  const blockedOrder = await createOrder({
    destination: 'Blocked driver destination',
    paymentMethod: 'cash',
    pickup: 'Blocked driver pickup',
    role: 'client',
    tariff: 'economy',
    total: 100,
  }, invitedClient.session.token);
  await expectApiFailure(`/orders/${encodeURIComponent(blockedOrder.id)}/assign`, {
    body: { driverId: driver.id, status: 'accepted' },
    method: 'PATCH',
    token: admin.session.token,
  });

  const compliantDriver = await api(`/drivers/${encodeURIComponent(driver.id)}/compliance`, {
    body: {
      contractStatus: 'signed',
      documentsStatus: 'approved',
      registryStatus: 'active',
      taxProfileStatus: 'approved',
      vehiclePermitStatus: 'approved',
    },
    method: 'PATCH',
    token: admin.session.token,
  });

  assert(
    compliantDriver.driver.canReceiveOrders === true,
    'Driver should receive orders after compliance is completed',
  );

  for (let index = 0; index < 10; index += 1) {
    await completeDriverOrder(invitedClient.session.token, admin.session.token, driver.id, index);
  }

  const qualifiedDashboard = await api(`/referrals?userId=${inviter.user.id}`, {
    token: inviter.session.token,
  });
  const driverReferral = qualifiedDashboard.referrals.find(
    (referral) => referral.inviteeUserId === invitedDriver.user.id,
  );

  assert(driverReferral?.status === 'qualified', 'Driver referral should be ready for admin payout after 10 orders');
  assert(
    qualifiedDashboard.bonusBalance >= 60 && qualifiedDashboard.bonusBalance < 260,
    `Driver bonus should not be credited before admin confirmation, got ${qualifiedDashboard.bonusBalance}`,
  );

  await api(`/admin/referrals/${encodeURIComponent(driverReferral.id)}/status`, {
    body: {
      note: 'Smoke admin confirmed driver referral payout',
      status: 'rewarded',
    },
    method: 'PATCH',
    token: admin.session.token,
  });

  const finalDashboard = await api(`/referrals?userId=${inviter.user.id}`, {
    token: inviter.session.token,
  });
  const rewardedDriverReferral = finalDashboard.referrals.find(
    (referral) => referral.inviteeUserId === invitedDriver.user.id,
  );

  assert(rewardedDriverReferral?.status === 'rewarded', 'Admin should confirm driver referral payout');
  assert(
    finalDashboard.bonusBalance >= 260,
    `Inviter total reward should be at least 260, got ${finalDashboard.bonusBalance}`,
  );

  // Защита от двойной выплаты: клиентский реферал уже rewarded автоматически,
  // повторное админское подтверждение не должно начислить бонус ещё раз.
  const balanceBeforeDoublePay = finalDashboard.bonusBalance;

  await api(`/admin/referrals/${encodeURIComponent(clientReferral.id)}/status`, {
    body: {
      note: 'Smoke duplicate payout attempt',
      status: 'rewarded',
    },
    method: 'PATCH',
    token: admin.session.token,
  });

  const doublePayDashboard = await api(`/referrals?userId=${inviter.user.id}`, {
    token: inviter.session.token,
  });

  assert(
    doublePayDashboard.bonusBalance === balanceBeforeDoublePay,
    `Re-confirming a rewarded referral must not pay twice: ${balanceBeforeDoublePay} -> ${doublePayDashboard.bonusBalance}`,
  );

  // Оплата бонусами + возврат при отмене: списанное возвращается на баланс.
  const bonusOrder = await createOrder({
    destination: 'Bonus spend destination',
    paymentMethod: 'cash',
    pickup: 'Bonus spend pickup',
    role: 'client',
    tariff: 'economy',
    total: 100,
    useBonus: true,
  }, inviter.session.token);
  const bonusApplied = Number(bonusOrder.bonusApplied || 0);

  assert(bonusApplied > 0, 'Order with useBonus should debit referral bonuses');

  const spentDashboard = await api(`/referrals?userId=${inviter.user.id}`, {
    token: inviter.session.token,
  });

  assert(
    spentDashboard.bonusBalance === balanceBeforeDoublePay - bonusApplied,
    `Bonus debit should reduce balance by ${bonusApplied}, got ${balanceBeforeDoublePay} -> ${spentDashboard.bonusBalance}`,
  );

  await api(`/orders/${encodeURIComponent(bonusOrder.id)}/status`, {
    body: { status: 'cancelled' },
    method: 'PATCH',
    token: admin.session.token,
  });

  const refundDashboard = await api(`/referrals?userId=${inviter.user.id}`, {
    token: inviter.session.token,
  });

  assert(
    refundDashboard.bonusBalance === balanceBeforeDoublePay,
    `Cancelled order should refund spent bonuses: expected ${balanceBeforeDoublePay}, got ${refundDashboard.bonusBalance}`,
  );

  // FIFO-сгорание: истёкший кредит выпадает из баланса, но уже погашенная
  // списаниями часть не «воскресает». Кредиты инвайтера: 60 (клиентский),
  // 200 (водительский), возврат отмены. Списание гасится FIFO, истекает 200-й.
  const rawDb = JSON.parse(await readFile(dbPath, 'utf8'));
  const driverRewardEntry = rawDb.walletLedger.find(
    (entry) => entry.userId === inviter.user.id && Number(entry.amount) === 200,
  );

  assert(driverRewardEntry, 'Driver reward wallet entry should exist');
  driverRewardEntry.expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await writeFile(dbPath, `${JSON.stringify(rawDb, null, 2)}\n`);

  const expiryDashboard = await api(`/referrals?userId=${inviter.user.id}`, {
    token: inviter.session.token,
  });
  const expectedAfterExpiry = Math.max(60, bonusApplied);

  assert(
    expiryDashboard.bonusBalance === expectedAfterExpiry,
    `Expired driver reward should burn FIFO-correctly: expected ${expectedAfterExpiry}, got ${expiryDashboard.bonusBalance}`,
  );

  console.log('Referral smoke test passed');
} finally {
  if (backend) {
    backend.kill();
  }

  await rm(dbPath, { force: true });
  await rm(documentStoragePath, { force: true, recursive: true });
}

async function register(body) {
  return api('/auth/register', {
    body,
    method: 'POST',
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

async function completeClientOrder(clientToken, adminToken, index) {
  const order = await createOrder({
    destination: `Client destination ${index}`,
    paymentMethod: 'cash',
    pickup: `Client pickup ${index}`,
    role: 'client',
    tariff: 'economy',
    total: 100,
  }, clientToken);

  await api(`/orders/${encodeURIComponent(order.id)}/status`, {
    body: { status: 'completed' },
    method: 'PATCH',
    token: adminToken,
  });
  await delay(5);
}

async function completeDriverOrder(clientToken, adminToken, driverId, index) {
  const order = await createOrder({
    destination: `Driver destination ${index}`,
    paymentMethod: 'cash',
    pickup: `Driver pickup ${index}`,
    role: 'client',
    tariff: 'economy',
    total: 100,
  }, clientToken);

  await api(`/orders/${encodeURIComponent(order.id)}/assign`, {
    body: { driverId, status: 'accepted' },
    method: 'PATCH',
    token: adminToken,
  });
  await api(`/orders/${encodeURIComponent(order.id)}/status`, {
    body: { status: 'completed' },
    method: 'PATCH',
    token: adminToken,
  });
  await delay(5);
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
