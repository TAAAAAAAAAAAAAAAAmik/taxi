import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { URL } from 'node:url';

const port = Number(process.env.PORT || 3100);
const dbPath = resolve(process.cwd(), process.env.MVP_DB_PATH || '.data/mvp-db.json');
const documentStoragePath = resolve(
  process.cwd(),
  process.env.MVP_DOCUMENT_STORAGE_PATH || '.data/driver-documents',
);
const maxRequestBodyBytes = readNumberEnv('MVP_MAX_BODY_BYTES', 12_000_000);
const adminPassword = process.env.MVP_ADMIN_PASSWORD || 'admin-demo-5000';
const inviteBaseUrl = String(process.env.MVP_INVITE_BASE_URL || 'https://links.example.com/invite')
  .trim()
  .replace(/\/+$/, '');
const verificationCodeTtlMinutes = readNumberEnv('MVP_VERIFICATION_CODE_TTL_MINUTES', 10);
const referralRewards = {
  bonusExpiresDays: readNumberEnv('MVP_REFERRAL_BONUS_EXPIRES_DAYS', 90),
  clientQualificationOrders: readNumberEnv('MVP_REFERRAL_CLIENT_ORDERS', 5),
  clientReward: readNumberEnv('MVP_REFERRAL_CLIENT_REWARD', 60),
  driverQualificationOrders: readNumberEnv('MVP_REFERRAL_DRIVER_ORDERS', 10),
  driverReward: readNumberEnv('MVP_REFERRAL_DRIVER_REWARD', 300),
  driverTrialDays: readNumberEnv('MVP_REFERRAL_DRIVER_TRIAL_DAYS', 7),
  invitedClientBonus: readNumberEnv('MVP_REFERRAL_INVITED_CLIENT_BONUS', 300),
};
const driverAccessPlans = {
  monthly: {
    accessDays: 30,
    commissionPercent: 0,
    monthlyPrice: readNumberEnv('MVP_DRIVER_MONTHLY_PRICE', 5000),
    name: 'Месячный доступ к заказам',
  },
  commission: {
    commissionPercent: readNumberEnv('MVP_DRIVER_COMMISSION_PERCENT', 12),
    monthlyPrice: 0,
    name: 'Комиссия с поездок',
  },
};
const driverPaymentProvider = {
  mode: ['demo', 'live', 'manual'].includes(process.env.MVP_PAYMENT_PROVIDER_MODE)
    ? process.env.MVP_PAYMENT_PROVIDER_MODE
    : 'demo',
  name: String(process.env.MVP_PAYMENT_PROVIDER || 'demo-acquiring'),
  shopId: String(process.env.MVP_PAYMENT_SHOP_ID || 'demo-shop'),
};
const referralStatuses = ['registered', 'qualified', 'rewarded', 'blocked'];
const walletStatuses = ['available', 'pending', 'used', 'cancelled'];
const paymentStatuses = ['pending', 'authorized', 'paid', 'failed', 'refunded'];
const driverPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
const driverComplianceStatusValues = ['missing', 'pending', 'approved', 'rejected'];
const driverContractStatusValues = ['missing', 'pending', 'signed', 'rejected'];
const driverDocumentKinds = ['passport', 'driverLicense', 'sts', 'osago'];
const driverRegistryStatusValues = ['missing', 'pending', 'active', 'rejected'];

function readNumberEnv(key, fallback) {
  const value = Number(process.env[key]);

  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const seedDrivers = [
  {
    id: 'driver-alexey-solaris',
    name: 'Алексей',
    phone: '+7 917 000-42-11',
    rating: 4.92,
    vehicle: 'Hyundai Solaris',
    plate: 'А123ВС 102',
    status: 'approved',
    isOnline: true,
    billingMode: 'commission',
    subscriptionStatus: 'active',
    canReceiveOrders: true,
    contractStatus: 'signed',
    documentsStatus: 'approved',
    registryStatus: 'active',
    taxProfileStatus: 'approved',
    vehiclePermitStatus: 'approved',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'driver-rinat-logan',
    name: 'Ринат',
    phone: '+7 917 000-10-24',
    rating: 4.86,
    vehicle: 'Renault Logan',
    plate: 'В456КМ 102',
    status: 'pending',
    isOnline: false,
    billingMode: 'commission',
    subscriptionStatus: 'inactive',
    canReceiveOrders: false,
    contractStatus: 'pending',
    documentUploads: {},
    documentsStatus: 'pending',
    registryStatus: 'pending',
    taxProfileStatus: 'pending',
    vehiclePermitStatus: 'pending',
    updatedAt: new Date().toISOString(),
  },
];

function createDefaultDb() {
  return {
    version: 1,
    orders: [],
    drivers: seedDrivers.map((driver) => ({ ...driver })),
    driverPayments: [],
    users: [],
    sessions: [],
    supportThreads: [],
    referrals: [],
    referralAudit: [],
    verificationCodes: [],
    walletLedger: [],
  };
}

async function readDb() {
  try {
    const raw = await readFile(dbPath, 'utf8');
    const parsed = JSON.parse(raw);
    const defaultDb = createDefaultDb();

    return {
      ...defaultDb,
      ...parsed,
      drivers:
        Array.isArray(parsed.drivers) && parsed.drivers.length > 0
          ? parsed.drivers.map(normalizeDriver)
          : seedDrivers.map(normalizeDriver),
      driverPayments: Array.isArray(parsed.driverPayments)
        ? parsed.driverPayments.map(normalizeDriverPayment)
        : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders.map(normalizeOrder) : [],
      referralAudit: Array.isArray(parsed.referralAudit) ? parsed.referralAudit : [],
      referrals: Array.isArray(parsed.referrals) ? parsed.referrals : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      supportThreads: Array.isArray(parsed.supportThreads) ? parsed.supportThreads : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      verificationCodes: Array.isArray(parsed.verificationCodes) ? parsed.verificationCodes : [],
      walletLedger: Array.isArray(parsed.walletLedger) ? parsed.walletLedger : [],
    };
  } catch (error) {
    const defaultDb = createDefaultDb();

    if (error.code !== 'ENOENT') {
      console.warn(`MVP DB read failed, starting with empty DB: ${error.message}`);
    }

    await writeDb(defaultDb);
    return defaultDb;
  }
}

async function writeDb(db) {
  await mkdir(dirname(dbPath), { recursive: true });
  await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;

      if (body.length > maxRequestBodyBytes) {
        request.destroy();
        rejectBody(new Error('Request body too large'));
      }
    });

    request.on('end', () => {
      if (!body.trim()) {
        resolveBody({});
        return;
      }

      try {
        resolveBody(JSON.parse(body));
      } catch {
        rejectBody(new Error('Invalid JSON'));
      }
    });
  });
}

function makeOrder(payload) {
  const now = new Date().toISOString();
  const role = normalizeRole(payload.role);
  const status = role === 'driver' ? 'accepted' : role === 'fleet' ? 'created' : 'searching';
  const paymentMethod = String(payload.paymentMethod || 'Наличные');
  const paymentStatus = normalizePaymentStatus(
    payload.paymentStatus,
    getInitialPaymentStatus(paymentMethod, Number(payload.total || 0)),
  );

  return {
    id: `TX-${Date.now().toString().slice(-6)}`,
    role,
    pickup: requireString(payload.pickup, 'pickup'),
    destination: requireString(payload.destination, 'destination'),
    tariff: String(payload.tariff || 'Эконом'),
    total: Number(payload.total || 0),
    paymentMethod,
    paymentStatus,
    paymentEvents: [
      makePaymentEvent(
        paymentStatus,
        'system',
        paymentStatus === 'authorized'
          ? 'Demo card payment authorized'
          : paymentStatus === 'paid'
          ? 'Payment covered before dispatch'
          : 'Payment is waiting for trip completion',
        now,
      ),
    ],
    paymentAuthorizedAt: paymentStatus === 'authorized' ? now : undefined,
    paidAt: paymentStatus === 'paid' ? now : undefined,
    options: Array.isArray(payload.options) ? payload.options.map(String) : [],
    clientName: String(payload.clientName || ''),
    clientPhone: String(payload.clientPhone || ''),
    userId: String(payload.userId || ''),
    status,
    statusHistory: [
      {
        actor: 'system',
        at: now,
        status,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeRole(value) {
  return ['client', 'driver', 'fleet'].includes(value) ? value : 'client';
}

function requireString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function normalizeOrder(order) {
  const normalizedOrder = {
    ...order,
    paymentMethod: String(order.paymentMethod || 'Наличные'),
    total: Number(order.total || 0),
  };
  const paymentStatus = normalizePaymentStatus(
    normalizedOrder.paymentStatus,
    getInitialPaymentStatus(normalizedOrder.paymentMethod, normalizedOrder.total),
  );

  normalizedOrder.paymentStatus = paymentStatus;
  normalizedOrder.paymentEvents = Array.isArray(order.paymentEvents)
    ? order.paymentEvents.map((event) => ({
        actor: String(event.actor || 'system'),
        at: String(event.at || normalizedOrder.createdAt || new Date().toISOString()),
        note: String(event.note || ''),
        status: normalizePaymentStatus(event.status, paymentStatus),
      }))
    : [
        makePaymentEvent(
          paymentStatus,
          'system',
          'Payment status restored from existing order',
          normalizedOrder.createdAt,
        ),
      ];

  if (paymentStatus === 'authorized') {
    normalizedOrder.paymentAuthorizedAt =
      normalizedOrder.paymentAuthorizedAt || normalizedOrder.createdAt || new Date().toISOString();
  }

  if (paymentStatus === 'paid') {
    normalizedOrder.paidAt =
      normalizedOrder.paidAt || normalizedOrder.completedAt || normalizedOrder.updatedAt || new Date().toISOString();
  }

  return normalizedOrder;
}

function normalizePaymentStatus(value, fallback = 'pending') {
  return paymentStatuses.includes(value) ? value : fallback;
}

function getInitialPaymentStatus(paymentMethod, total) {
  if (Number(total) === 0 || /бонус/i.test(paymentMethod)) {
    return 'paid';
  }

  if (/карт|card|корпоратив|счет|счёт/i.test(paymentMethod)) {
    return 'authorized';
  }

  return 'pending';
}

function makePaymentEvent(status, actor = 'system', note = '', at = new Date().toISOString()) {
  return {
    actor,
    at,
    note,
    status,
  };
}

function addPaymentEvent(order, status, actor = 'system', note = '') {
  const normalizedStatus = normalizePaymentStatus(status, order.paymentStatus || 'pending');
  const history = Array.isArray(order.paymentEvents) ? order.paymentEvents : [];
  const previous = history[0];

  if (previous?.status === normalizedStatus && previous?.note === note) {
    return;
  }

  order.paymentEvents = [
    makePaymentEvent(normalizedStatus, actor, note),
    ...history,
  ];
}

function updateOrderPayment(order, status, actor = 'system', note = '') {
  const normalizedStatus = normalizePaymentStatus(status, order.paymentStatus || 'pending');
  const now = new Date().toISOString();

  order.paymentStatus = normalizedStatus;
  order.updatedAt = now;

  if (normalizedStatus === 'authorized') {
    order.paymentAuthorizedAt = order.paymentAuthorizedAt || now;
  }

  if (normalizedStatus === 'paid') {
    order.paidAt = order.paidAt || now;
  }

  addPaymentEvent(order, normalizedStatus, actor, note);

  if (normalizedStatus === 'paid' && ['closed', 'completed'].includes(order.status) && !order.receipt) {
    order.receipt = createReceipt(order);
  }
}

function settleOrderPayment(order, actor = 'system') {
  if (order.paymentStatus !== 'paid') {
    updateOrderPayment(order, 'paid', actor, `Payment captured after ${order.status}`);
  }

  if (!order.receipt) {
    order.receipt = createReceipt(order);
  }
}

function createReceipt(order) {
  return {
    id: `RC-${Date.now().toString().slice(-7)}`,
    orderId: order.id,
    issuedAt: new Date().toISOString(),
    total: order.total,
    subtotal: Number(order.subtotal || order.total || 0),
    bonusApplied: Number(order.bonusApplied || 0),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus || 'paid',
    fiscalStatus: 'server',
    fiscalNumber: `MVP-${order.id}-${Date.now().toString().slice(-5)}`,
    items: [
      { label: `Поездка ${order.tariff}`, amount: Number(order.subtotal || order.total || 0) },
      ...(Number(order.bonusApplied || 0) > 0
        ? [{ label: 'Списание бонусов', amount: -Number(order.bonusApplied || 0) }]
        : []),
    ],
  };
}

function normalizeBillingMode(value) {
  return value === 'monthly' ? 'monthly' : 'commission';
}

function getDriverAccessPlan(value) {
  return driverAccessPlans[normalizeBillingMode(value)];
}

function normalizeDriverPayment(payment) {
  const now = new Date().toISOString();
  const billingMode = normalizeBillingMode(payment.billingMode);
  const provider =
    payment.provider && typeof payment.provider === 'object'
      ? {
          mode: ['demo', 'live', 'manual'].includes(payment.provider.mode)
            ? payment.provider.mode
            : driverPaymentProvider.mode,
          name: String(payment.provider.name || driverPaymentProvider.name),
          shopId: String(payment.provider.shopId || driverPaymentProvider.shopId),
        }
      : { ...driverPaymentProvider };

  return {
    ...payment,
    amount: Number(payment.amount || 0),
    billingMode,
    createdAt: String(payment.createdAt || now),
    currency: payment.currency === 'RUB' ? 'RUB' : 'RUB',
    driverId: String(payment.driverId || ''),
    paymentMethod: String(payment.paymentMethod || 'Банковская карта'),
    planName: String(payment.planName || getDriverAccessPlan(billingMode).name),
    provider,
    status: driverPaymentStatuses.includes(payment.status) ? payment.status : 'pending',
    updatedAt: String(payment.updatedAt || payment.createdAt || now),
  };
}

function makeDriverSubscriptionPayment(driver, payload = {}) {
  const now = new Date().toISOString();
  const billingMode = normalizeBillingMode(payload.billingMode || driver.billingMode);
  const plan = getDriverAccessPlan(billingMode);
  const amount = Number(payload.amount ?? plan.monthlyPrice);
  const provider = payload.provider || driverPaymentProvider;
  const shouldCaptureNow = provider.mode !== 'live' || amount === 0 || payload.captureNow === true;
  const payment = {
    id: `DSP-${Date.now().toString().slice(-7)}-${randomUUID().slice(0, 6)}`,
    driverId: driver.id,
    driverName: driver.name,
    billingMode,
    planName: plan.name,
    amount,
    currency: 'RUB',
    paymentMethod: String(payload.paymentMethod || (amount > 0 ? 'Банковская карта' : 'Комиссия с поездок')),
    provider: { ...provider },
    providerPaymentId: `${provider.mode}_${randomUUID()}`,
    confirmationUrl: shouldCaptureNow ? undefined : String(payload.confirmationUrl || ''),
    status: shouldCaptureNow ? 'paid' : 'pending',
    createdAt: now,
    updatedAt: now,
  };

  if (payment.status === 'paid') {
    payment.paidAt = now;
  }

  return payment;
}

function createDriverPaymentReceipt(payment, type = 'payment') {
  const sign = type === 'refund' ? -1 : 1;
  const fiscalStatus =
    payment.provider?.mode === 'live' ? 'provider' : payment.provider?.mode === 'manual' ? 'manual' : 'demo';

  return {
    id: `DRC-${Date.now().toString().slice(-7)}-${randomUUID().slice(0, 5)}`,
    paymentId: payment.id,
    driverId: payment.driverId,
    issuedAt: new Date().toISOString(),
    total: sign * Number(payment.amount || 0),
    currency: 'RUB',
    fiscalStatus,
    fiscalNumber: `${fiscalStatus.toUpperCase()}-${payment.id}`,
    paymentStatus: payment.status,
    items: [
      {
        amount: sign * Number(payment.amount || 0),
        label:
          type === 'refund'
            ? `Возврат: ${payment.planName}`
            : payment.amount > 0
            ? payment.planName
            : `Подключение модели: ${payment.planName}`,
      },
    ],
  };
}

function applyDriverAccessFromPayment(driver, payment) {
  const now = new Date();
  const plan = getDriverAccessPlan(payment.billingMode);

  driver.billingMode = payment.billingMode;

  if (payment.status !== 'paid') {
    driver.updatedAt = new Date().toISOString();
    return applyDriverAccessState(driver);
  }

  if (payment.billingMode === 'monthly') {
    const currentExpiry = Date.parse(driver.accessExpiresAt || '');
    const startsAt =
      driver.subscriptionStatus === 'active' && Number.isFinite(currentExpiry) && currentExpiry > now.getTime()
        ? new Date(currentExpiry)
        : now;
    const expiresAt = new Date(startsAt);

    expiresAt.setDate(expiresAt.getDate() + Number(plan.accessDays || 30));
    payment.accessStartsAt = startsAt.toISOString();
    payment.accessExpiresAt = expiresAt.toISOString();
    driver.accessExpiresAt = payment.accessExpiresAt;
  } else {
    payment.accessStartsAt = now.toISOString();
    payment.accessExpiresAt = undefined;
    driver.accessExpiresAt = undefined;
  }

  driver.subscriptionStatus = 'active';
  driver.lastPaymentId = payment.id;
  driver.updatedAt = new Date().toISOString();
  applyDriverAccessState(driver);
  payment.receipt = payment.receipt || createDriverPaymentReceipt(payment);
  payment.updatedAt = new Date().toISOString();

  return driver;
}

function refundDriverSubscriptionPayment(db, payment, reason = 'Refund requested in MVP') {
  if (payment.status !== 'paid') {
    throw new Error('Only paid driver payments can be refunded');
  }

  const driver = db.drivers.find((item) => item.id === payment.driverId);
  const now = new Date().toISOString();

  payment.status = 'refunded';
  payment.refundedAt = now;
  payment.refundReason = reason;
  payment.updatedAt = now;

  if (payment.receipt) {
    payment.receipt.paymentStatus = 'refunded';
  }

  payment.refundReceipt = createDriverPaymentReceipt(payment, 'refund');

  if (driver) {
    const activePayments = db.driverPayments
      .filter((item) => item.driverId === driver.id && item.id !== payment.id && item.status === 'paid')
      .filter((item) => !item.accessExpiresAt || Date.parse(item.accessExpiresAt) > Date.now())
      .sort((left, right) => Date.parse(right.paidAt || right.createdAt) - Date.parse(left.paidAt || left.createdAt));
    const replacement = activePayments[0];

    if (replacement) {
      driver.billingMode = replacement.billingMode;
      driver.subscriptionStatus = 'active';
      driver.accessExpiresAt = replacement.accessExpiresAt;
      driver.lastPaymentId = replacement.id;
    } else if (driver.lastPaymentId === payment.id || driver.accessExpiresAt === payment.accessExpiresAt) {
      driver.subscriptionStatus = 'inactive';
      driver.accessExpiresAt = undefined;
      driver.lastPaymentId = undefined;
      driver.isOnline = false;
    }

    driver.updatedAt = now;
    applyDriverAccessState(driver);
  }

  return driver;
}

function makeDriverBillingDashboard(db, driver) {
  const normalizedDriver = applyDriverAccessState(driver);
  const payments = db.driverPayments
    .filter((payment) => payment.driverId === normalizedDriver.id)
    .map(normalizeDriverPayment)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const activePayment = payments.find(
    (payment) => payment.status === 'paid' && (!payment.accessExpiresAt || Date.parse(payment.accessExpiresAt) > Date.now()),
  );

  return {
    activePayment,
    driver: normalizedDriver,
    payments,
    provider: driverPaymentProvider,
  };
}

function addOrderStatusHistory(order, status, actor = 'system') {
  const now = new Date().toISOString();
  const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  const previous = history[0];

  if (previous?.status === status) {
    return;
  }

  order.statusHistory = [
    {
      actor,
      at: now,
      status,
    },
    ...history,
  ];
}

function hashPassword(password) {
  return createHash('sha256').update(String(password)).digest('hex');
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function makeSession(userId, role) {
  return {
    id: randomUUID(),
    role,
    token: randomUUID(),
    userId,
    createdAt: new Date().toISOString(),
  };
}

function getSessionContext(db, request) {
  const authHeader = String(request.headers.authorization || '');
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return null;
  }

  const session = db.sessions.find((item) => item.token === token);

  if (!session) {
    return null;
  }

  if (session.role === 'admin') {
    return {
      session,
      user: {
        id: session.userId,
        role: 'admin',
        firstName: 'Админ',
      },
    };
  }

  const user = db.users.find((item) => item.id === session.userId);

  if (!user) {
    return null;
  }

  return { session, user };
}

function canAccessUser(sessionContext, userId) {
  return sessionContext?.user?.role === 'admin' || sessionContext?.user?.id === userId;
}

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeEmail(value) {
  return normalizeIdentifier(value);
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeVerificationChannel(value) {
  return value === 'email' ? 'email' : 'phone';
}

function getVerificationTarget(user, channel) {
  return channel === 'email' ? normalizeEmail(user.email) : normalizePhone(user.phone);
}

function makeVerificationCode(channel) {
  if (channel === 'email') {
    return randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  }

  return String(Math.floor(1000 + Math.random() * 9000));
}

function createVerificationRecord(user, channel) {
  const code = makeVerificationCode(channel);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + verificationCodeTtlMinutes);

  return {
    code,
    record: {
      id: randomUUID(),
      userId: user.id,
      channel,
      target: getVerificationTarget(user, channel),
      codeHash: hashPassword(code),
      attempts: 0,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  };
}

function markUserContactVerified(user, channel) {
  const now = new Date().toISOString();

  if (channel === 'email') {
    user.emailVerifiedAt = user.emailVerifiedAt || now;
  } else {
    user.phoneVerifiedAt = user.phoneVerifiedAt || now;
  }

  if (user.role === 'driver') {
    user.verificationStatus =
      user.phoneVerifiedAt && user.emailVerifiedAt ? 'pending_driver_review' : 'pending_contacts';
  } else {
    user.verificationStatus =
      user.phoneVerifiedAt && user.emailVerifiedAt ? 'active' : 'pending_contacts';
  }

  user.updatedAt = now;
}

function findUserByIdentifier(users, identifier) {
  const normalized = normalizeIdentifier(identifier);
  const normalizedPhone = normalizePhone(identifier);

  return users.find(
    (user) =>
      normalizeIdentifier(user.email) === normalized ||
      normalizeIdentifier(user.phone) === normalized ||
      (normalizedPhone && normalizePhone(user.phone) === normalizedPhone),
  );
}

function normalizeReferralCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-ZА-Я0-9]/g, '');
}

function createReferralCode(user, users) {
  const base = normalizeReferralCode(
    `${String(user.firstName || user.role || 'TP').slice(0, 2)}${String(user.id).slice(-5)}`,
  );
  let code = base || `TP${Date.now().toString(36).toUpperCase()}`;
  let suffix = 1;

  while (users.some((item) => item.id !== user.id && normalizeReferralCode(item.referralCode) === code)) {
    code = `${base}${suffix}`;
    suffix += 1;
  }

  return code;
}

function ensureUserReferralCode(user, users) {
  if (!user.referralCode) {
    user.referralCode = createReferralCode(user, users);
  }

  user.bonusBalance = Number(user.bonusBalance || 0);
  return user.referralCode;
}

function findUserByReferralCode(users, code) {
  const normalizedCode = normalizeReferralCode(code);

  if (!normalizedCode) {
    return undefined;
  }

  return users.find((user) => normalizeReferralCode(user.referralCode) === normalizedCode);
}

function getReferralRegistrationError(inviter, payload) {
  const inviterEmail = normalizeEmail(inviter.email);
  const inviteeEmail = normalizeEmail(payload.email);
  const inviterPhone = normalizePhone(inviter.phone);
  const inviteePhone = normalizePhone(payload.phone);

  if (inviterEmail && inviteeEmail && inviterEmail === inviteeEmail) {
    return 'Нельзя использовать собственный реферальный код';
  }

  if (inviterPhone && inviteePhone && inviterPhone === inviteePhone) {
    return 'Нельзя использовать собственный реферальный код';
  }

  return '';
}

function addReferralAudit(db, referralId, action, actorUserId, note) {
  db.referralAudit.unshift({
    id: `ra-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    action,
    actorUserId,
    createdAt: new Date().toISOString(),
    note: String(note || ''),
    referralId,
  });
}

function makeReferral(inviter, invitee, code) {
  const inviteeRole = normalizeRole(invitee.role);
  const now = new Date().toISOString();

  return {
    id: `ref-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    inviterUserId: inviter.id,
    inviteeUserId: invitee.id,
    inviteeRole,
    code: normalizeReferralCode(code),
    status: 'registered',
    rewardAmount: inviteeRole === 'driver' ? referralRewards.driverReward : referralRewards.clientReward,
    inviteeBonusAmount: inviteeRole === 'driver' ? 0 : referralRewards.invitedClientBonus,
    createdAt: now,
    riskFlags: [],
    note:
      inviteeRole === 'driver'
        ? `Водитель получит ${referralRewards.driverTrialDays} дней доступа после одобрения; пригласивший получит бонус после первых ${referralRewards.driverQualificationOrders} заказов.`
        : `Клиент получил бонус на первую поездку; пригласивший получит бонус после первых ${referralRewards.clientQualificationOrders} завершенных поездок клиента.`,
  };
}

function normalizeWalletStatus(value) {
  return walletStatuses.includes(value) ? value : 'available';
}

function createWalletExpiryDate() {
  if (!referralRewards.bonusExpiresDays) {
    return undefined;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + referralRewards.bonusExpiresDays);
  return expiresAt.toISOString();
}

function calculateBonusBalance(db, userId) {
  return db.walletLedger
    .filter((entry) => entry.userId === userId)
    .reduce((sum, entry) => {
      const amount = Number(entry.amount || 0);
      const status = normalizeWalletStatus(entry.status);

      if (status === 'available') {
        return sum + amount;
      }

      if (status === 'used' && amount < 0) {
        return sum + amount;
      }

      return sum;
    }, 0);
}

function syncUserBonusBalance(db, userId) {
  const user = db.users.find((item) => item.id === userId);

  if (!user) {
    return 0;
  }

  user.bonusBalance = Math.max(0, calculateBonusBalance(db, userId));
  user.updatedAt = new Date().toISOString();
  return user.bonusBalance;
}

function syncAllBonusBalances(db) {
  db.users.forEach((user) => {
    syncUserBonusBalance(db, user.id);
  });
}

function creditWallet(db, userId, amount, reason, sourceType, sourceId, options = {}) {
  if (!amount) {
    return undefined;
  }

  const duplicate = db.walletLedger.some(
    (entry) =>
      entry.userId === userId &&
      entry.sourceType === sourceType &&
      entry.sourceId === sourceId &&
      entry.reason === reason &&
      Number(entry.amount || 0) > 0,
  );

  if (duplicate) {
    return undefined;
  }

  const now = new Date().toISOString();
  const entry = {
    id: `wl-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    userId,
    amount,
    status: normalizeWalletStatus(options.status),
    reason,
    sourceType,
    sourceId,
    createdAt: now,
    expiresAt: options.expiresAt ?? createWalletExpiryDate(),
  };

  db.walletLedger.unshift(entry);
  entry.balanceAfter = syncUserBonusBalance(db, userId);
  return entry;
}

function debitWallet(db, userId, amount, reason, sourceType, sourceId) {
  const balance = syncUserBonusBalance(db, userId);
  const debitedAmount = Math.min(Math.max(Number(amount || 0), 0), balance);

  if (!debitedAmount) {
    return 0;
  }

  const duplicate = db.walletLedger.some(
    (entry) =>
      entry.userId === userId &&
      entry.sourceType === sourceType &&
      entry.sourceId === sourceId &&
      Number(entry.amount || 0) < 0,
  );

  if (duplicate) {
    return 0;
  }

  const now = new Date().toISOString();
  const entry = {
    id: `wl-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    userId,
    amount: -debitedAmount,
    status: 'used',
    reason,
    sourceType,
    sourceId,
    createdAt: now,
  };

  db.walletLedger.unshift(entry);
  entry.balanceAfter = syncUserBonusBalance(db, userId);
  return debitedAmount;
}

function applyBonusToOrder(db, order, payload) {
  if (!payload.useBonus || order.role !== 'client' || !order.userId) {
    return order;
  }

  const bonusApplied = debitWallet(
    db,
    order.userId,
    order.total,
    `Списание бонусов по заказу ${order.id}`,
    'trip',
    order.id,
  );

  if (!bonusApplied) {
    return order;
  }

  order.subtotal = order.total;
  order.bonusApplied = bonusApplied;
  order.bonusBalanceAfter = syncUserBonusBalance(db, order.userId);
  order.total = Math.max(0, order.total - bonusApplied);
  order.paymentMethod = order.total === 0 ? 'Бонусы' : `${order.paymentMethod} + бонусы`;

  if (order.total === 0) {
    updateOrderPayment(order, 'paid', 'wallet', 'Order fully paid with referral bonuses');
  }

  return order;
}

function createInviteUrl(code, role) {
  const roleParam = ['client', 'driver'].includes(role) ? `?role=${role}` : '';

  return `${inviteBaseUrl}/${encodeURIComponent(code)}${roleParam}`;
}

function countClientCompletedOrders(db, userId) {
  return db.orders.filter(
    (order) =>
      order.userId === userId &&
      order.role === 'client' &&
      ['closed', 'completed'].includes(order.status),
  ).length;
}

function countDriverCompletedOrders(db, userId) {
  const driver = db.drivers.find((item) => item.userId === userId);

  if (!driver) {
    return 0;
  }

  return db.orders.filter(
    (order) => order.driver?.id === driver.id && ['closed', 'completed'].includes(order.status),
  ).length;
}

function getReferralProgress(db, referral) {
  const requiredOrders =
    referral.inviteeRole === 'driver'
      ? referralRewards.driverQualificationOrders
      : referralRewards.clientQualificationOrders;
  const actualCompletedOrders =
    referral.inviteeRole === 'driver'
      ? countDriverCompletedOrders(db, referral.inviteeUserId)
      : countClientCompletedOrders(db, referral.inviteeUserId);
  const completedOrders = Math.min(actualCompletedOrders, requiredOrders);

  return {
    actualCompletedOrders,
    completedOrders,
    requiredOrders,
    remainingOrders: Math.max(requiredOrders - actualCompletedOrders, 0),
    percent: requiredOrders ? Math.min(100, Math.round((actualCompletedOrders / requiredOrders) * 100)) : 100,
  };
}

function getUserDisplayName(user) {
  if (!user) {
    return 'Пользователь';
  }

  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.phone || user.email || user.id;
}

function decorateReferral(db, referral, viewerUserId) {
  const inviter = db.users.find((item) => item.id === referral.inviterUserId);
  const invitee = db.users.find((item) => item.id === referral.inviteeUserId);

  return {
    ...referral,
    inviteeName: getUserDisplayName(invitee),
    inviteePhone: invitee?.phone || '',
    inviterName: getUserDisplayName(inviter),
    inviterPhone: inviter?.phone || '',
    progress: getReferralProgress(db, referral),
    viewerRelation: viewerUserId
      ? referral.inviterUserId === viewerUserId
        ? 'inviter'
        : referral.inviteeUserId === viewerUserId
        ? 'invitee'
        : 'none'
      : undefined,
  };
}

function makeReferralDashboard(db, user) {
  syncUserBonusBalance(db, user.id);
  const code = ensureUserReferralCode(user, db.users);

  return {
    userId: user.id,
    referralCode: code,
    inviteUrl: createInviteUrl(code),
    inviteUrls: {
      client: createInviteUrl(code, 'client'),
      driver: createInviteUrl(code, 'driver'),
    },
    bonusBalance: Number(user.bonusBalance || 0),
    referrals: db.referrals
      .filter((referral) => referral.inviterUserId === user.id || referral.inviteeUserId === user.id)
      .map((referral) => decorateReferral(db, referral, user.id)),
    walletLedger: db.walletLedger.filter((entry) => entry.userId === user.id),
    rewards: referralRewards,
  };
}

function makeAdminReferralDashboard(db) {
  syncAllBonusBalances(db);
  const referrals = db.referrals.map((referral) => decorateReferral(db, referral));
  const walletTotal = db.walletLedger
    .filter((entry) => Number(entry.amount || 0) > 0)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const walletUsed = db.walletLedger
    .filter((entry) => Number(entry.amount || 0) < 0)
    .reduce((sum, entry) => sum + Math.abs(Number(entry.amount || 0)), 0);
  const walletAvailable = db.users.reduce((sum, user) => sum + Number(user.bonusBalance || 0), 0);

  return {
    referrals,
    rewards: referralRewards,
    summary: {
      referrals: referrals.length,
      registered: referrals.filter((referral) => referral.status === 'registered').length,
      qualified: referrals.filter((referral) => referral.status === 'qualified').length,
      rewarded: referrals.filter((referral) => referral.status === 'rewarded').length,
      blocked: referrals.filter((referral) => referral.status === 'blocked').length,
      walletEntries: db.walletLedger.length,
      walletAvailable,
      walletTotal,
      walletUsed,
    },
    walletLedger: db.walletLedger,
  };
}

function attachReferral(db, invitee, rawCode) {
  const code = normalizeReferralCode(rawCode);
  const inviter = findUserByReferralCode(db.users, code);

  if (!inviter || inviter.id === invitee.id) {
    return;
  }

  invitee.referredByCode = code;
  const referral = makeReferral(inviter, invitee, code);
  db.referrals.unshift(referral);
  addReferralAudit(db, referral.id, 'created', invitee.id, `Регистрация по коду ${code}`);

  if (invitee.role === 'client') {
    creditWallet(
      db,
      invitee.id,
      referralRewards.invitedClientBonus,
      'Бонус приглашенному клиенту на первую поездку',
      'referral',
      `${referral.id}-invitee`,
    );
  }

  return referral;
}

function rewardReferral(db, referral, reason, actorUserId = 'system') {
  if (!referral || referral.status === 'blocked') {
    return false;
  }

  const now = new Date().toISOString();
  referral.status = 'rewarded';
  referral.qualifiedAt = referral.qualifiedAt || now;
  referral.rewardedAt = referral.rewardedAt || now;
  creditWallet(db, referral.inviterUserId, referral.rewardAmount, reason, 'referral', referral.id);
  addReferralAudit(db, referral.id, 'rewarded', actorUserId, reason);
  return true;
}

function settleClientReferralForOrder(db, order) {
  if (!order.userId || order.role !== 'client' || !['closed', 'completed'].includes(order.status)) {
    return;
  }

  const referral = db.referrals.find(
    (item) =>
      item.inviteeUserId === order.userId &&
      item.inviteeRole === 'client' &&
      !['blocked', 'rewarded'].includes(item.status),
  );

  if (!referral) {
    return;
  }

  const completedOrders = db.orders.filter(
    (item) =>
      item.userId === order.userId &&
      item.role === 'client' &&
      ['closed', 'completed'].includes(item.status),
  ).length;

  if (completedOrders < referralRewards.clientQualificationOrders) {
    referral.status = 'qualified';
    referral.qualifiedAt = referral.qualifiedAt || new Date().toISOString();
    addReferralAudit(db, referral.id, 'qualified', 'system', `Прогресс клиента: ${completedOrders}/${referralRewards.clientQualificationOrders}`);
    return;
  }

  rewardReferral(
    db,
    referral,
    `Бонус за приглашенного клиента после ${referralRewards.clientQualificationOrders} поездок`,
  );
}

function settleDriverReferralForOrder(db, order) {
  if (!order.driver?.id || !['closed', 'completed'].includes(order.status)) {
    return;
  }

  const driver = db.drivers.find((item) => item.id === order.driver.id);
  const referral = driver?.userId
    ? db.referrals.find(
        (item) =>
          item.inviteeUserId === driver.userId &&
          item.inviteeRole === 'driver' &&
          !['blocked', 'rewarded'].includes(item.status),
      )
    : undefined;

  if (!driver || !referral) {
    return;
  }

  const completedOrders = db.orders.filter(
    (item) => item.driver?.id === driver.id && ['closed', 'completed'].includes(item.status),
  ).length;

  if (completedOrders < referralRewards.driverQualificationOrders) {
    referral.status = 'qualified';
    referral.qualifiedAt = referral.qualifiedAt || new Date().toISOString();
    addReferralAudit(db, referral.id, 'qualified', 'system', `Прогресс водителя: ${completedOrders}/${referralRewards.driverQualificationOrders}`);
    return;
  }

  rewardReferral(
    db,
    referral,
    'Бонус за приглашенного водителя после квалификации',
  );
}

function makeDriverFromUser(user, payload) {
  return {
    id: `driver-${user.id}`,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Водитель',
    phone: user.phone,
    rating: 5,
    vehicle: [payload.carBrand, payload.carModel].filter(Boolean).join(' '),
    plate: String(payload.carPlate || ''),
    status: 'pending',
    isOnline: false,
    billingMode: 'commission',
    subscriptionStatus: 'inactive',
    canReceiveOrders: false,
    contractStatus: 'pending',
    documentsStatus: 'pending',
    registryStatus: 'pending',
    taxProfileStatus: 'pending',
    vehiclePermitStatus: 'pending',
    vehicleDocumentsReady: String(payload.vehicleDocumentsReady || ''),
    userId: user.id,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeDriver(driver) {
  const normalizedDriver = {
    ...driver,
    contractStatus: normalizeDriverContractStatus(driver.contractStatus),
    documentUploads: normalizeDriverDocumentUploads(driver.documentUploads),
    documentsStatus: normalizeDriverComplianceStatus(driver.documentsStatus, driver),
    registryStatus: normalizeDriverRegistryStatus(driver.registryStatus, driver),
    subscriptionStatus: normalizeDriverSubscriptionStatus(driver),
    taxProfileStatus: normalizeDriverComplianceStatus(driver.taxProfileStatus, driver),
    vehiclePermitStatus: normalizeDriverComplianceStatus(driver.vehiclePermitStatus, driver),
  };

  normalizedDriver.accessBlockers = getDriverAccessBlockers(normalizedDriver);
  normalizedDriver.canReceiveOrders = normalizedDriver.accessBlockers.length === 0;
  normalizedDriver.isOnline = Boolean(driver.isOnline) && normalizedDriver.canReceiveOrders;

  return normalizedDriver;
}

function normalizeDriverDocumentUploads(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return driverDocumentKinds.reduce((uploads, kind) => {
    const upload = value[kind];

    if (upload && typeof upload === 'object') {
      uploads[kind] = normalizeDriverDocumentUpload(kind, upload);
    }

    return uploads;
  }, {});
}

function normalizeDriverDocumentUpload(kind, upload) {
  return {
    fileName: sanitizeFileName(upload.fileName || `${kind}.jpg`),
    fileSize: Math.max(0, Number(upload.fileSize || 0)),
    height: Math.max(0, Number(upload.height || 0)),
    kind,
    mimeType: normalizeImageMimeType(upload.mimeType),
    source: upload.source === 'camera' ? 'camera' : 'library',
    status: driverComplianceStatusValues.includes(upload.status) ? upload.status : 'pending',
    storageKey: typeof upload.storageKey === 'string' ? upload.storageKey : undefined,
    uploadedAt: typeof upload.uploadedAt === 'string' ? upload.uploadedAt : new Date().toISOString(),
    width: Math.max(0, Number(upload.width || 0)),
  };
}

function normalizeDriverComplianceStatus(value, driver) {
  if (driverComplianceStatusValues.includes(value)) {
    return value;
  }

  return driver?.status === 'approved' && driver?.subscriptionStatus === 'active' ? 'approved' : 'pending';
}

function normalizeDriverContractStatus(value, driver) {
  if (driverContractStatusValues.includes(value)) {
    return value;
  }

  return driver?.status === 'approved' && driver?.subscriptionStatus === 'active' ? 'signed' : 'pending';
}

function normalizeDriverRegistryStatus(value, driver) {
  if (driverRegistryStatusValues.includes(value)) {
    return value;
  }

  return driver?.status === 'approved' && driver?.subscriptionStatus === 'active' ? 'active' : 'pending';
}

function normalizeDriverSubscriptionStatus(driver) {
  const value = ['inactive', 'active', 'expired'].includes(driver.subscriptionStatus)
    ? driver.subscriptionStatus
    : 'inactive';
  const expiresAt = Date.parse(driver.accessExpiresAt || '');

  if (value === 'active' && Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    return 'expired';
  }

  return value;
}

function getDriverAccessBlockers(driver) {
  const blockers = [];

  if (driver.status !== 'approved') {
    blockers.push('driver_review');
  }

  if (driver.subscriptionStatus !== 'active') {
    blockers.push('paid_access');
  }

  if (driver.documentsStatus !== 'approved') {
    blockers.push('documents');
  }

  if (driver.contractStatus !== 'signed') {
    blockers.push('contract');
  }

  if (driver.vehiclePermitStatus !== 'approved') {
    blockers.push('vehicle_permit');
  }

  if (driver.registryStatus !== 'active') {
    blockers.push('registry');
  }

  if (driver.taxProfileStatus !== 'approved') {
    blockers.push('tax_profile');
  }

  return blockers;
}

function applyDriverAccessState(driver) {
  const normalizedDriver = normalizeDriver(driver);

  Object.assign(driver, normalizedDriver);
  return driver;
}

function updateDriverCompliance(driver, payload) {
  if ('documentsStatus' in payload) {
    driver.documentsStatus = normalizeDriverComplianceStatus(payload.documentsStatus, driver);
  }

  if ('contractStatus' in payload) {
    driver.contractStatus = normalizeDriverContractStatus(payload.contractStatus, driver);
  }

  if ('vehiclePermitStatus' in payload) {
    driver.vehiclePermitStatus = normalizeDriverComplianceStatus(payload.vehiclePermitStatus, driver);
  }

  if ('registryStatus' in payload) {
    driver.registryStatus = normalizeDriverRegistryStatus(payload.registryStatus, driver);
  }

  if ('taxProfileStatus' in payload) {
    driver.taxProfileStatus = normalizeDriverComplianceStatus(payload.taxProfileStatus, driver);
  }

  return applyDriverAccessState(driver);
}

async function handleRequest(request, response) {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const pathParts = url.pathname.split('/').filter(Boolean);

  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true, dbPath, service: 'taxi-partner-mvp' });
      return;
    }

    const db = await readDb();

    if (request.method === 'POST' && url.pathname === '/auth/register') {
      const payload = await readBody(request);
      const role = normalizeRole(payload.role);
      const email = String(payload.email || '').trim();
      const phone = String(payload.phone || '').trim();
      const password = String(payload.password || payload.appPassword || '');

      if (!email && !phone) {
        sendJson(response, 400, { error: 'Email or phone is required' });
        return;
      }

      if (password.length < 4) {
        sendJson(response, 400, { error: 'Password is too short' });
        return;
      }

      if (
        (email && findUserByIdentifier(db.users, email)) ||
        (phone && findUserByIdentifier(db.users, phone))
      ) {
        sendJson(response, 409, { error: 'User already exists' });
        return;
      }

      db.users.forEach((existingUser) => ensureUserReferralCode(existingUser, db.users));
      const normalizedReferralCode = normalizeReferralCode(payload.referralCode);
      const referralInviter = normalizedReferralCode
        ? findUserByReferralCode(db.users, normalizedReferralCode)
        : undefined;

      if (normalizedReferralCode && !referralInviter) {
        sendJson(response, 400, { error: 'Referral code not found' });
        return;
      }

      const referralRegistrationError = referralInviter
        ? getReferralRegistrationError(referralInviter, { email, phone })
        : '';

      if (referralRegistrationError) {
        sendJson(response, 400, { error: referralRegistrationError });
        return;
      }

      const now = new Date().toISOString();
      const user = {
        id: `user-${Date.now().toString(36)}`,
        role,
        firstName: String(payload.firstName || ''),
        lastName: String(payload.lastName || ''),
        email,
        phone,
        passwordHash: hashPassword(password),
        referralCode: '',
        referredByCode: referralInviter ? normalizedReferralCode : '',
        bonusBalance: 0,
        verificationStatus: 'pending_contacts',
        createdAt: now,
        updatedAt: now,
      };
      const session = makeSession(user.id, role);

      ensureUserReferralCode(user, db.users);
      db.users.unshift(user);
      db.sessions.unshift(session);
      attachReferral(db, user, payload.referralCode);

      if (role === 'driver' && !db.drivers.some((driver) => driver.userId === user.id)) {
        db.drivers.unshift(makeDriverFromUser(user, payload));
      }

      await writeDb(db);
      sendJson(response, 201, { session, user: publicUser(user) });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/verification-code') {
      const sessionContext = getSessionContext(db, request);
      const payload = await readBody(request);
      const channel = normalizeVerificationChannel(payload.channel);

      if (!sessionContext || sessionContext.user.role === 'admin') {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      const user = db.users.find((item) => item.id === sessionContext.user.id);
      const target = getVerificationTarget(user, channel);
      const requestedTarget = channel === 'email' ? normalizeEmail(payload.target) : normalizePhone(payload.target);

      if (!target) {
        sendJson(response, 400, { error: `${channel} is missing in profile` });
        return;
      }

      if (requestedTarget && requestedTarget !== target) {
        sendJson(response, 403, { error: 'Verification target mismatch' });
        return;
      }

      const { code, record } = createVerificationRecord(user, channel);
      db.verificationCodes = [
        record,
        ...db.verificationCodes.filter(
          (item) => !(item.userId === user.id && item.channel === channel && !item.usedAt),
        ),
      ].slice(0, 200);

      await writeDb(db);
      sendJson(response, 201, {
        channel,
        code,
        deliveryMode: 'mvp-returned-code',
        expiresAt: record.expiresAt,
        target: channel === 'email' ? user.email : user.phone,
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/verify-code') {
      const sessionContext = getSessionContext(db, request);
      const payload = await readBody(request);
      const channel = normalizeVerificationChannel(payload.channel);
      const code = String(payload.code || '').trim();

      if (!sessionContext || sessionContext.user.role === 'admin') {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      const user = db.users.find((item) => item.id === sessionContext.user.id);
      const target = getVerificationTarget(user, channel);
      const requestedTarget = channel === 'email' ? normalizeEmail(payload.target) : normalizePhone(payload.target);

      if (!target) {
        sendJson(response, 400, { error: `${channel} is missing in profile` });
        return;
      }

      if (requestedTarget && requestedTarget !== target) {
        sendJson(response, 403, { error: 'Verification target mismatch' });
        return;
      }

      const record = db.verificationCodes.find(
        (item) =>
          item.userId === user.id &&
          item.channel === channel &&
          item.target === target &&
          !item.usedAt,
      );

      if (!record) {
        sendJson(response, 404, { error: 'Verification code not found. Request a new code.' });
        return;
      }

      if (new Date(record.expiresAt).getTime() < Date.now()) {
        sendJson(response, 410, { error: 'Verification code expired. Request a new code.' });
        return;
      }

      record.attempts = Number(record.attempts || 0) + 1;

      if (record.codeHash !== hashPassword(code)) {
        await writeDb(db);
        sendJson(response, 400, { error: 'Invalid verification code' });
        return;
      }

      record.usedAt = new Date().toISOString();
      markUserContactVerified(user, channel);
      await writeDb(db);
      sendJson(response, 200, { channel, user: publicUser(user) });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/login') {
      const payload = await readBody(request);
      const user = findUserByIdentifier(db.users, payload.identifier);

      if (!user || user.passwordHash !== hashPassword(payload.password || '')) {
        sendJson(response, 401, { error: 'Invalid login or password' });
        return;
      }

      if (payload.role && user.role !== payload.role) {
        sendJson(response, 403, { error: 'Role mismatch' });
        return;
      }

      const session = makeSession(user.id, user.role);
      db.sessions.unshift(session);
      await writeDb(db);
      sendJson(response, 200, { session, user: publicUser(user) });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/admin-login') {
      const payload = await readBody(request);

      if (String(payload.password || '') !== adminPassword) {
        sendJson(response, 401, { error: 'Invalid admin password' });
        return;
      }

      const user = {
        id: 'admin-local',
        role: 'admin',
        firstName: 'Админ',
        lastName: '',
        email: '',
        phone: '',
        verificationStatus: 'active',
      };
      const session = makeSession(user.id, 'admin');
      db.sessions.unshift(session);
      await writeDb(db);
      sendJson(response, 200, { session, user });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/users') {
      sendJson(response, 200, { users: db.users.map(publicUser) });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/referrals/validate') {
      db.users.forEach((existingUser) => ensureUserReferralCode(existingUser, db.users));

      const code = normalizeReferralCode(url.searchParams.get('code'));
      const inviter = findUserByReferralCode(db.users, code);

      if (!code || !inviter) {
        sendJson(response, 200, {
          code,
          error: code ? 'Referral code not found' : 'Referral code is required',
          valid: false,
        });
        return;
      }

      const registrationError = getReferralRegistrationError(inviter, {
        email: url.searchParams.get('email'),
        phone: url.searchParams.get('phone'),
      });

      if (registrationError) {
        sendJson(response, 200, {
          code,
          error: registrationError,
          inviterName: getUserDisplayName(inviter),
          valid: false,
        });
        return;
      }

      await writeDb(db);
      sendJson(response, 200, {
        code,
        inviterName: getUserDisplayName(inviter),
        valid: true,
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/referrals') {
      const sessionContext = getSessionContext(db, request);
      const userId = url.searchParams.get('userId') || sessionContext?.user?.id;

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      if (!userId || !canAccessUser(sessionContext, userId)) {
        sendJson(response, 403, { error: 'Referral dashboard access denied' });
        return;
      }

      const user = db.users.find((item) => item.id === userId);

      if (!user) {
        sendJson(response, 404, { error: 'User not found' });
        return;
      }

      const dashboard = makeReferralDashboard(db, user);
      await writeDb(db);
      sendJson(response, 200, dashboard);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/referrals/code') {
      const sessionContext = getSessionContext(db, request);
      const payload = await readBody(request);
      const userId = payload.userId || sessionContext?.user?.id;

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      if (!userId || !canAccessUser(sessionContext, userId)) {
        sendJson(response, 403, { error: 'Referral code access denied' });
        return;
      }

      const user = db.users.find((item) => item.id === userId);

      if (!user) {
        sendJson(response, 404, { error: 'User not found' });
        return;
      }

      const dashboard = makeReferralDashboard(db, user);
      await writeDb(db);
      sendJson(response, 200, dashboard);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/admin/referrals') {
      const sessionContext = getSessionContext(db, request);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      if (sessionContext.user.role !== 'admin') {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }

      sendJson(response, 200, makeAdminReferralDashboard(db));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/drivers') {
      sendJson(response, 200, { drivers: db.drivers });
      return;
    }

    if (request.method === 'GET' && pathParts[0] === 'drivers' && pathParts[2] === 'billing') {
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      sendJson(response, 200, makeDriverBillingDashboard(db, driver));
      return;
    }

    if (request.method === 'POST' && pathParts[0] === 'drivers' && pathParts[2] === 'billing' && pathParts[3] === 'pay') {
      const payload = await readBody(request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      if (driver.status !== 'approved') {
        sendJson(response, 409, {
          driver: applyDriverAccessState(driver),
          error: 'Driver must be approved before paid access can be activated',
        });
        return;
      }

      const payment = makeDriverSubscriptionPayment(driver, payload);
      db.driverPayments.unshift(payment);
      applyDriverAccessFromPayment(driver, payment);
      await writeDb(db);
      sendJson(response, 201, makeDriverBillingDashboard(db, driver));
      return;
    }

    if (request.method === 'POST' && pathParts[0] === 'driver-payments' && pathParts[2] === 'refund') {
      const payload = await readBody(request);
      const payment = db.driverPayments.find((item) => item.id === pathParts[1]);

      if (!payment) {
        sendJson(response, 404, { error: 'Driver payment not found' });
        return;
      }

      try {
        const driver = refundDriverSubscriptionPayment(db, payment, String(payload.reason || 'Refund requested in MVP'));

        await writeDb(db);
        sendJson(response, 200, makeDriverBillingDashboard(db, driver || { id: payment.driverId }));
      } catch (error) {
        sendJson(response, 409, { error: error.message });
      }

      return;
    }

    if (request.method === 'POST' && url.pathname === '/drivers') {
      const payload = await readBody(request);
      const now = new Date().toISOString();
      const driver = {
        id: `driver-${Date.now().toString(36)}`,
        name: requireString(payload.name, 'name'),
        phone: String(payload.phone || ''),
        rating: Number(payload.rating || 5),
        vehicle: String(payload.vehicle || ''),
        plate: String(payload.plate || ''),
        status: payload.status === 'approved' ? 'approved' : 'pending',
        billingMode: payload.billingMode === 'monthly' ? 'monthly' : 'commission',
        subscriptionStatus: payload.subscriptionStatus === 'active' ? 'active' : 'inactive',
        updatedAt: now,
      };
      db.drivers.unshift(applyDriverAccessState(driver));
      await writeDb(db);
      sendJson(response, 201, { driver });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'drivers' && pathParts[2] === 'status') {
      const payload = await readBody(request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      driver.status = ['pending', 'approved', 'blocked'].includes(payload.status)
        ? payload.status
        : driver.status;
      if (driver.status !== 'approved') {
        driver.isOnline = false;
      }
      if (driver.status === 'approved') {
        const driverReferral = driver.userId
          ? db.referrals.find(
              (item) =>
                item.inviteeUserId === driver.userId &&
                item.inviteeRole === 'driver' &&
                item.status === 'registered',
            )
          : undefined;

        if (driverReferral && driver.subscriptionStatus !== 'active') {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + referralRewards.driverTrialDays);
          driver.subscriptionStatus = 'active';
          driver.accessExpiresAt = expiresAt.toISOString();
          driverReferral.status = 'qualified';
          driverReferral.qualifiedAt = driverReferral.qualifiedAt || new Date().toISOString();
        }
      }
      applyDriverAccessState(driver);
      driver.updatedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(response, 200, { driver });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'drivers' && pathParts[2] === 'compliance') {
      const payload = await readBody(request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      updateDriverCompliance(driver, payload);
      driver.updatedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(response, 200, { driver });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'drivers' && pathParts[2] === 'access') {
      const payload = await readBody(request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      driver.billingMode = payload.billingMode === 'monthly' ? 'monthly' : 'commission';
      driver.subscriptionStatus = payload.subscriptionStatus === 'inactive' ? 'inactive' : 'active';
      if (driver.subscriptionStatus === 'active') {
        const payment = makeDriverSubscriptionPayment(driver, {
          amount:
            driver.billingMode === 'monthly'
              ? Number(payload.amount ?? getDriverAccessPlan(driver.billingMode).monthlyPrice)
              : 0,
          billingMode: driver.billingMode,
          captureNow: true,
          paymentMethod: payload.paymentMethod || 'Админ-активация',
          provider: {
            ...driverPaymentProvider,
            mode: 'manual',
            name: 'manual-admin',
          },
        });

        db.driverPayments.unshift(payment);
        applyDriverAccessFromPayment(driver, payment);
      }
      if (driver.subscriptionStatus !== 'active') {
        driver.isOnline = false;
        driver.accessExpiresAt = undefined;
      }
      applyDriverAccessState(driver);
      driver.updatedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(response, 200, { driver });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'drivers' && pathParts[2] === 'availability') {
      const payload = await readBody(request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      applyDriverAccessState(driver);

      if (!driver.canReceiveOrders) {
        driver.isOnline = false;
        driver.updatedAt = new Date().toISOString();
        await writeDb(db);
        sendJson(response, 403, {
          error: 'Driver needs completed compliance and active access before going online',
          driver,
        });
        return;
      }

      driver.isOnline = Boolean(payload.isOnline);
      driver.updatedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(response, 200, { driver });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/orders') {
      sendJson(response, 200, { orders: db.orders });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/orders') {
      const payload = await readBody(request);
      const order = applyBonusToOrder(db, makeOrder(payload), payload);
      db.orders.unshift(order);
      await writeDb(db);
      sendJson(response, 201, { order });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'orders' && pathParts[2] === 'status') {
      const payload = await readBody(request);
      const order = db.orders.find((item) => item.id === pathParts[1]);

      if (!order) {
        sendJson(response, 404, { error: 'Order not found' });
        return;
      }

      order.status = String(payload.status || order.status);
      order.updatedAt = new Date().toISOString();
      addOrderStatusHistory(order, order.status, 'status-patch');

      if (order.status === 'arrived') {
        order.arrivedAt = order.arrivedAt || order.updatedAt;
      }

      if (order.status === 'started') {
        order.startedAt = order.startedAt || order.updatedAt;
      }

      if (['closed', 'completed'].includes(order.status)) {
        order.completedAt = order.completedAt || order.updatedAt;
        settleOrderPayment(order, 'status-patch');
      }
      settleClientReferralForOrder(db, order);
      settleDriverReferralForOrder(db, order);

      await writeDb(db);
      sendJson(response, 200, { order });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'orders' && pathParts[2] === 'payment') {
      const payload = await readBody(request);
      const order = db.orders.find((item) => item.id === pathParts[1]);
      const paymentStatus = normalizePaymentStatus(payload.paymentStatus || payload.status, '');

      if (!order) {
        sendJson(response, 404, { error: 'Order not found' });
        return;
      }

      if (!paymentStatus) {
        sendJson(response, 400, { error: 'Invalid payment status' });
        return;
      }

      updateOrderPayment(
        order,
        paymentStatus,
        payload.actor || 'payment-patch',
        payload.note || 'Payment status updated manually in MVP',
      );

      await writeDb(db);
      sendJson(response, 200, { order });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'orders' && pathParts[2] === 'assign') {
      const payload = await readBody(request);
      const order = db.orders.find((item) => item.id === pathParts[1]);
      const driver = db.drivers.find((item) => item.id === payload.driverId);

      if (!order) {
        sendJson(response, 404, { error: 'Order not found' });
        return;
      }

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      applyDriverAccessState(driver);

      if (!driver.canReceiveOrders) {
        sendJson(response, 403, {
          driver,
          error: 'Driver is not allowed to receive orders yet',
        });
        return;
      }

      if (order.driver?.id) {
        sendJson(response, 409, {
          error: 'Order is already accepted by another driver',
          order,
        });
        return;
      }

      if (!['created', 'searching'].includes(order.status)) {
        sendJson(response, 409, {
          error: 'Order is not open for dispatch',
          order,
        });
        return;
      }

      const now = new Date().toISOString();
      order.driver = {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        rating: driver.rating,
        vehicle: driver.vehicle,
        plate: driver.plate,
      };
      order.acceptedAt = now;
      order.status = 'accepted';
      order.updatedAt = now;
      addOrderStatusHistory(order, order.status, driver.id);
      await writeDb(db);
      sendJson(response, 200, { order });
      return;
    }

    sendJson(response, 404, { error: 'Route not found' });
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Bad request' });
  }
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    sendJson(response, 500, { error: error.message || 'Internal error' });
  });
});

server.listen(port, () => {
  console.log(`Taxi Partner MVP backend: http://localhost:${port}`);
  console.log(`JSON DB: ${dbPath}`);
});
