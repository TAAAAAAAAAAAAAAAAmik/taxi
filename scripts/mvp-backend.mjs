import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { URL } from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';

const port = Number(process.env.PORT || 3100);
const backendEnvironment = normalizeBackendEnvironment(process.env.MVP_BACKEND_ENV || process.env.NODE_ENV);
const isProductionBackend = backendEnvironment === 'production';
const storageDriver = normalizeStorageDriver(
  process.env.MVP_STORAGE_DRIVER || (isProductionBackend ? 'postgres' : 'json'),
);
const dbPath = resolve(process.cwd(), process.env.MVP_DB_PATH || '.data/mvp-db.json');
const databaseUrl = String(process.env.MVP_DATABASE_URL || process.env.DATABASE_URL || '').trim();
const postgresStateTable = normalizePostgresIdentifier(
  process.env.MVP_POSTGRES_STATE_TABLE || 'taxi_partner_app_state',
);
const postgresStateKey = String(process.env.MVP_POSTGRES_STATE_KEY || 'default').trim() || 'default';
const documentStoragePath = resolve(
  process.cwd(),
  process.env.MVP_DOCUMENT_STORAGE_PATH || '.data/driver-documents',
);
const maxRequestBodyBytes = readNumberEnv('MVP_MAX_BODY_BYTES', 12_000_000);
const adminPassword = process.env.MVP_ADMIN_PASSWORD || '791021Tamik1221';
const internalApiToken = String(process.env.MVP_INTERNAL_API_TOKEN || '').trim();
const configuredLinksOrigin = normalizeLinksOrigin(
  process.env.MVP_LINKS_ORIGIN || process.env.EXPO_PUBLIC_LINKS_DOMAIN,
);
const configuredApiOrigin = normalizeLinksOrigin(
  process.env.MVP_API_ORIGIN || process.env.EXPO_PUBLIC_API_URL,
);
const defaultInviteBaseUrl = configuredLinksOrigin ? `${configuredLinksOrigin}/invite` : 'taxipartner://invite';
const inviteBaseUrl = String(process.env.MVP_INVITE_BASE_URL || defaultInviteBaseUrl)
  .trim()
  .replace(/\/+$/, '');
const verificationCodeTtlMinutes = readNumberEnv('MVP_VERIFICATION_CODE_TTL_MINUTES', 10);
const passwordResetCodeTtlMinutes = readNumberEnv('MVP_PASSWORD_RESET_CODE_TTL_MINUTES', 15);
const verificationMaxAttempts = readNumberEnv('MVP_VERIFICATION_MAX_ATTEMPTS', 5);
const sessionTtlDays = readNumberEnv('MVP_SESSION_TTL_DAYS', 30);
const skipPhoneVerification = readBooleanEnv('MVP_SKIP_PHONE_VERIFICATION', false);
const deliveryAuditLimit = readNumberEnv('MVP_DELIVERY_AUDIT_LIMIT', 500);
const verificationDeliveryMode = normalizeProviderMode(
  process.env.MVP_VERIFICATION_DELIVERY_MODE || process.env.MVP_DELIVERY_MODE || 'demo',
);
const defaultPhoneDeliveryChannel = normalizePhoneDeliveryChannel(
  process.env.MVP_PHONE_VERIFICATION_CHANNEL || 'sms',
);
const referralRewards = {
  bonusExpiresDays: readNumberEnv('MVP_REFERRAL_BONUS_EXPIRES_DAYS', 90),
  clientQualificationOrders: readNumberEnv('MVP_REFERRAL_CLIENT_ORDERS', 5),
  clientReward: readNumberEnv('MVP_REFERRAL_CLIENT_REWARD', 60),
  driverQualificationOrders: readNumberEnv('MVP_REFERRAL_DRIVER_ORDERS', 10),
  driverReward: readNumberEnv('MVP_REFERRAL_DRIVER_REWARD', 200),
  driverTrialDays: readNumberEnv('MVP_REFERRAL_DRIVER_TRIAL_DAYS', 7),
  invitedClientBonus: readNumberEnv('MVP_REFERRAL_INVITED_CLIENT_BONUS', 0),
};
const driverAccessPlans = {
  monthly: {
    accessDays: 30,
    commissionPercent: 0,
    monthlyPrice: 3290,
    name: 'Партнёр PRO',
  },
  daily: {
    accessDays: 1,
    commissionPercent: 0,
    monthlyPrice: 120,
    name: 'Дневной доступ',
  },
};
const dispatchExclusiveOfferSeconds = clampNumber(readNumberEnv('MVP_DISPATCH_EXCLUSIVE_SECONDS', 30), 15, 60, 30);
const driverLocationMaxAgeMinutes = clampNumber(readNumberEnv('MVP_DRIVER_LOCATION_MAX_AGE_MINUTES', 20), 3, 180, 20);
const parkAccessPlan = {
  accessDays: 30,
  commissionPercent: 0,
  monthlyPrice: 0,
  name: 'Ручная B2B-активация таксопарка',
};
const paymentProviderMode = ['demo', 'live', 'manual'].includes(process.env.MVP_PAYMENT_PROVIDER_MODE)
  ? process.env.MVP_PAYMENT_PROVIDER_MODE
  : 'demo';
const paymentProviderName = String(process.env.MVP_PAYMENT_PROVIDER || 'demo-acquiring').trim() || 'demo-acquiring';
const paymentCardNumber = String(process.env.PAYMENT_CARD_NUMBER || '').trim();
const paymentCardHolder = String(process.env.PAYMENT_CARD_HOLDER || '').trim();
const yookassaConfig = {
  apiBaseUrl: String(process.env.MVP_YOOKASSA_API_URL || 'https://api.yookassa.ru/v3')
    .trim()
    .replace(/\/+$/, ''),
  returnUrl: String(
    process.env.MVP_YOOKASSA_RETURN_URL ||
      process.env.MVP_PAYMENT_RETURN_URL ||
      (configuredLinksOrigin
        ? `${configuredLinksOrigin}/payments/driver-return`
        : 'taxipartner://payments/driver-return'),
  ).trim(),
  secretKey: String(process.env.MVP_YOOKASSA_SECRET_KEY || process.env.MVP_PAYMENT_SECRET_KEY || '').trim(),
  shopId: String(process.env.MVP_YOOKASSA_SHOP_ID || process.env.MVP_PAYMENT_SHOP_ID || '').trim(),
  webhookToken: String(process.env.MVP_YOOKASSA_WEBHOOK_TOKEN || '').trim(),
};
const tbankConfig = {
  apiBaseUrl: String(process.env.MVP_TBANK_API_URL || 'https://securepay.tinkoff.ru/v2')
    .trim()
    .replace(/\/+$/, ''),
  failUrl: String(
    process.env.MVP_TBANK_FAIL_URL ||
      process.env.MVP_TBANK_RETURN_URL ||
      process.env.MVP_PAYMENT_RETURN_URL ||
      (configuredLinksOrigin
        ? `${configuredLinksOrigin}/payments/driver-return`
        : 'taxipartner://payments/driver-return'),
  ).trim(),
  notificationUrl: String(
    process.env.MVP_TBANK_NOTIFICATION_URL ||
      (configuredApiOrigin ? `${configuredApiOrigin}/payments/tbank/webhook` : ''),
  ).trim(),
  password: String(process.env.MVP_TBANK_PASSWORD || process.env.MVP_PAYMENT_SECRET_KEY || '').trim(),
  recurrent: String(process.env.MVP_TBANK_RECURRENT || 'Y').trim().toUpperCase() === 'Y',
  returnUrl: String(
    process.env.MVP_TBANK_SUCCESS_URL ||
      process.env.MVP_TBANK_RETURN_URL ||
      process.env.MVP_PAYMENT_RETURN_URL ||
      (configuredLinksOrigin
        ? `${configuredLinksOrigin}/payments/driver-return`
        : 'taxipartner://payments/driver-return'),
  ).trim(),
  taxation: String(process.env.MVP_TBANK_TAXATION || 'usn_income').trim(),
  terminalKey: String(process.env.MVP_TBANK_TERMINAL_KEY || process.env.MVP_PAYMENT_SHOP_ID || '').trim(),
  vat: String(process.env.MVP_TBANK_VAT || 'none').trim(),
  webhookToken: String(process.env.MVP_TBANK_WEBHOOK_TOKEN || '').trim(),
};
const paymentProviderShopId =
  (isTBankProviderName(paymentProviderName) ? tbankConfig.terminalKey : '') ||
  (isYooKassaProviderName(paymentProviderName) ? yookassaConfig.shopId : '') ||
  String(process.env.MVP_PAYMENT_SHOP_ID || 'demo-shop');
const driverPaymentProvider = {
  mode: paymentProviderMode,
  name: paymentProviderName,
  shopId: paymentProviderShopId,
};
const geoProvider = {
  addressSearchUrl: readLiveUrl(
    process.env.MVP_ADDRESS_SEARCH_URL || process.env.EXPO_PUBLIC_ADDRESS_SEARCH_URL,
  ),
  reverseGeocodeUrl: readLiveUrl(
    process.env.MVP_REVERSE_GEOCODE_URL || process.env.EXPO_PUBLIC_REVERSE_GEOCODE_URL,
  ),
  routeSearchUrl: readLiveUrl(
    process.env.MVP_ROUTE_SEARCH_URL || process.env.EXPO_PUBLIC_ROUTE_SEARCH_URL,
  ),
};
const localGeoProviderName = 'local-salavat-rf-mvp';
const referralStatuses = ['registered', 'qualified', 'rewarded', 'blocked'];
const walletStatuses = ['available', 'pending', 'used', 'cancelled'];
const paymentStatuses = ['pending', 'authorized', 'paid', 'failed', 'refunded'];
const driverPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
const serviceShareStatuses = ['not_applicable', 'pending_transfer', 'reported_transferred', 'confirmed'];
const driverComplianceStatusValues = ['missing', 'pending', 'approved', 'rejected'];
const driverContractStatusValues = ['missing', 'pending', 'signed', 'rejected'];
const driverDocumentKinds = ['passport', 'driverLicense', 'sts', 'osago', 'osgop'];
const driverDocumentReviewActions = ['uploaded', 'approved', 'rejected', 'reset', 'viewed'];
const driverDocumentReviewStatuses = ['missing', 'pending', 'approved', 'rejected'];
const driverRegistryStatusValues = ['missing', 'pending', 'active', 'rejected'];
const marketingActionStatuses = ['pending', 'confirmed', 'rewarded', 'paid', 'rejected'];
const marketingContractStatuses = ['draft', 'pending', 'confirmed', 'rejected'];
const marketingLevels = [
  { id: 1, name: 'Глашатай', coefficient: 1, min: 0, max: 3000, range: '0-3000 ПО' },
  { id: 2, name: 'Переговорщик', coefficient: 2, min: 3001, max: 10000, range: '3001-10000 ПО' },
  { id: 3, name: 'Легенда Малояза', coefficient: 3, min: 10001, max: Infinity, range: '10001+ ПО' },
];
const realtimeClients = new Map();
const realtimeSocketClients = new Set();
let firebaseAdminPromise;
let apnProviderPromise;
let postgresPoolPromise;

assertBackendConfig();

function readNumberEnv(key, fallback) {
  const value = Number(process.env[key]);

  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readBooleanEnv(key, fallback = false) {
  const value = String(process.env[key] || '').trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value);
}

function normalizeBackendEnvironment(value) {
  return String(value || 'development').trim().toLowerCase() === 'production'
    ? 'production'
    : 'development';
}

function normalizeStorageDriver(value) {
  const normalizedValue = String(value || 'json').trim().toLowerCase();

  if (normalizedValue === 'postgres' || normalizedValue === 'json') {
    return normalizedValue;
  }

  throw new Error('MVP_STORAGE_DRIVER must be either json or postgres');
}

function normalizePostgresIdentifier(value) {
  const identifier = String(value || '').trim();

  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error('MVP_POSTGRES_STATE_TABLE must be a plain SQL identifier');
  }

  return identifier;
}

function quotePostgresIdentifier(value) {
  return `"${normalizePostgresIdentifier(value).replaceAll('"', '""')}"`;
}

function makePublicBackendConfig() {
  return {
    environment: backendEnvironment,
    storage: {
      driver: storageDriver,
      jsonPath: storageDriver === 'json' ? dbPath : undefined,
      postgresStateKey: storageDriver === 'postgres' ? postgresStateKey : undefined,
      postgresStateTable: storageDriver === 'postgres' ? postgresStateTable : undefined,
    },
  };
}

function assertBackendConfig() {
  if (storageDriver === 'postgres' && !databaseUrl) {
    throw new Error('Postgres storage requires MVP_DATABASE_URL or DATABASE_URL');
  }

  if (!isProductionBackend) {
    return;
  }

  const errors = [];

  if (storageDriver !== 'postgres') {
    errors.push('MVP_STORAGE_DRIVER=postgres is required in production');
  }

  if (!process.env.MVP_ADMIN_PASSWORD) {
    errors.push('MVP_ADMIN_PASSWORD must be set explicitly in production');
  }

  if (verificationDeliveryMode !== 'live') {
    errors.push('MVP_DELIVERY_MODE=live is required in production');
  }

  if (skipPhoneVerification) {
    errors.push('MVP_SKIP_PHONE_VERIFICATION must be disabled in production');
  }

  if (!configuredLinksOrigin) {
    errors.push('MVP_LINKS_ORIGIN or EXPO_PUBLIC_LINKS_DOMAIN must point to a real HTTPS domain');
  }

  if (!configuredApiOrigin) {
    errors.push('MVP_API_ORIGIN or EXPO_PUBLIC_API_URL must point to the production API domain');
  }

  if (!process.env.MVP_DOCUMENT_STORAGE_PATH) {
    errors.push('MVP_DOCUMENT_STORAGE_PATH must point to a mounted persistent private directory');
  }

  if (paymentProviderMode === 'demo' || paymentProviderName === 'demo-acquiring') {
    errors.push('MVP_PAYMENT_PROVIDER_MODE and MVP_PAYMENT_PROVIDER must use a real provider or manual mode');
  }

  if (paymentProviderMode === 'live') {
    if (isYooKassaProviderName(paymentProviderName)) {
      try {
        assertYooKassaConfigured();
      } catch (error) {
        errors.push(error.message);
      }
    } else if (isTBankProviderName(paymentProviderName)) {
      try {
        assertTBankConfigured();
      } catch (error) {
        errors.push(error.message);
      }
    } else {
      errors.push('Live payments require MVP_PAYMENT_PROVIDER=yookassa or tbank');
    }
  }

  if (errors.length) {
    throw new Error(`Production backend config is incomplete: ${errors.join('; ')}`);
  }
}

function readLiveUrl(value) {
  const url = String(value || '').trim();

  if (!url || /example\.com/i.test(url)) {
    return '';
  }

  return url;
}

function normalizeLinksOrigin(value) {
  const trimmedValue = String(value || '').trim().replace(/\/+$/, '');

  if (!trimmedValue || /example\.com/i.test(trimmedValue) || isLocalOrigin(trimmedValue)) {
    return '';
  }

  return /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;
}

function isLocalOrigin(value) {
  return /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::|\/|$)/i.test(String(value || ''));
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
    lastLocation: {
      latitude: 55.1784,
      longitude: 58.1598,
      updatedAt: new Date().toISOString(),
    },
    locationUpdatedAt: new Date().toISOString(),
    billingMode: 'monthly',
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
    billingMode: 'monthly',
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

const localAddressCatalog = [
  {
    id: 'maloyaz-center',
    title: 'Центр Малояза',
    subtitle: 'с. Малояз, центральная площадь',
    settlement: 'Малояз',
    category: 'settlement',
    aliases: ['малояз', 'центр', 'центральная площадь'],
    coordinates: { latitude: 55.1784, longitude: 58.1598 },
  },
  {
    id: 'maloyaz-admin',
    title: 'Администрация Салаватского района',
    subtitle: 'с. Малояз, Советская улица, 64',
    settlement: 'Малояз',
    category: 'admin',
    aliases: ['администрация', 'советская 64', 'районная администрация'],
    coordinates: { latitude: 55.179, longitude: 58.1605 },
  },
  {
    id: 'maloyaz-hospital',
    title: 'Салаватская центральная районная больница',
    subtitle: 'с. Малояз, больничная зона',
    settlement: 'Малояз',
    category: 'health',
    aliases: ['црб', 'больница', 'поликлиника', 'малояз црб'],
    coordinates: { latitude: 55.1768, longitude: 58.1518 },
  },
  {
    id: 'yangantau-sanatorium',
    title: 'Санаторий Янгантау',
    subtitle: 'с. Янгантау, курортная зона',
    settlement: 'Янгантау',
    category: 'landmark',
    aliases: ['янгантау', 'санаторий', 'курорт', 'горячая гора'],
    coordinates: { latitude: 55.2973, longitude: 58.1274 },
  },
  {
    id: 'kurgazak-spring',
    title: 'Источник Кургазак',
    subtitle: 'рядом с д. Комсомол и курортом Янгантау',
    settlement: 'Комсомол',
    category: 'landmark',
    aliases: ['кургазак', 'источник', 'родник', 'комсомол'],
    coordinates: { latitude: 55.2901, longitude: 58.0949 },
  },
  {
    id: 'mursalimkino-station',
    title: 'Мурсалимкино, железнодорожная станция',
    subtitle: 'с. Мурсалимкино, станция и центр села',
    settlement: 'Мурсалимкино',
    category: 'transport',
    aliases: ['мурсалимкино', 'станция', 'жд', 'железнодорожная станция'],
    coordinates: { latitude: 55.0367, longitude: 58.5627 },
  },
  {
    id: 'arkaulovo-center',
    title: 'Центр Аркаулово',
    subtitle: 'с. Аркаулово, Салаватский район',
    settlement: 'Аркаулово',
    category: 'settlement',
    aliases: ['аркаулово', 'центр аркаулово'],
    coordinates: { latitude: 55.2366, longitude: 57.8494 },
  },
  {
    id: 'lakly-center',
    title: 'Центр Лаклы',
    subtitle: 'с. Лаклы, южная часть района',
    settlement: 'Лаклы',
    category: 'settlement',
    aliases: ['лаклы', 'лаклинская пещера'],
    coordinates: { latitude: 55.0002, longitude: 57.7531 },
  },
  {
    id: 'idrisovo-village',
    title: 'д. Идрисово',
    subtitle: 'Салаватский район, направление к Юрюзани',
    settlement: 'Идрисово',
    category: 'settlement',
    aliases: ['идрисово', 'идрисовская пещера'],
    coordinates: { latitude: 55.1086, longitude: 57.9097 },
  },
  {
    id: 'ufa-airport',
    title: 'Аэропорт Уфа',
    subtitle: 'г. Уфа, международный аэропорт',
    settlement: 'Уфа',
    category: 'transport',
    aliases: ['уфа аэропорт', 'аэропорт уфа', 'международный аэропорт уфа'],
    coordinates: { latitude: 54.5575, longitude: 55.8744 },
  },
  {
    id: 'ufa-center',
    title: 'Центр Уфы',
    subtitle: 'г. Уфа, центр города',
    settlement: 'Уфа',
    category: 'settlement',
    aliases: ['уфа', 'центр уфы', 'гостиный двор уфа'],
    coordinates: { latitude: 54.7351, longitude: 55.9587 },
  },
  {
    id: 'chelyabinsk-center',
    title: 'Центр Челябинска',
    subtitle: 'г. Челябинск, центр города',
    settlement: 'Челябинск',
    category: 'settlement',
    aliases: ['челябинск', 'центр челябинска'],
    coordinates: { latitude: 55.1644, longitude: 61.4368 },
  },
  {
    id: 'yekaterinburg-center',
    title: 'Центр Екатеринбурга',
    subtitle: 'г. Екатеринбург, центр города',
    settlement: 'Екатеринбург',
    category: 'settlement',
    aliases: ['екатеринбург', 'центр екатеринбурга', 'екб'],
    coordinates: { latitude: 56.8389, longitude: 60.6057 },
  },
];

const localRoutePresets = [
  {
    id: 'maloyaz-yangantau',
    pickup: 'Центр Малояза, с. Малояз',
    destination: 'Санаторий Янгантау, с. Янгантау',
    distanceKm: 17.5,
    durationMin: 30,
  },
  {
    id: 'yangantau-kurgazak',
    pickup: 'Санаторий Янгантау, с. Янгантау',
    destination: 'Источник Кургазак, д. Комсомол',
    distanceKm: 5.2,
    durationMin: 12,
  },
  {
    id: 'maloyaz-kurgazak',
    pickup: 'Центр Малояза, с. Малояз',
    destination: 'Источник Кургазак, д. Комсомол',
    distanceKm: 19.5,
    durationMin: 30,
  },
  {
    id: 'maloyaz-mursalimkino',
    pickup: 'Центр Малояза, с. Малояз',
    destination: 'Мурсалимкино, железнодорожная станция',
    distanceKm: 31,
    durationMin: 43,
  },
  {
    id: 'maloyaz-arkaulovo',
    pickup: 'Центр Малояза, с. Малояз',
    destination: 'Центр Аркаулово, с. Аркаулово',
    distanceKm: 22,
    durationMin: 32,
  },
  {
    id: 'maloyaz-lakly',
    pickup: 'Центр Малояза, с. Малояз',
    destination: 'Центр Лаклы, с. Лаклы',
    distanceKm: 34,
    durationMin: 45,
  },
  {
    id: 'maloyaz-idrisovo',
    pickup: 'Центр Малояза, с. Малояз',
    destination: 'д. Идрисово',
    distanceKm: 24,
    durationMin: 33,
  },
];

function createDefaultDb() {
  return {
    version: 1,
    orders: [],
    drivers: seedDrivers.map((driver) => ({ ...driver })),
    driverPayments: [],
    parkDrivers: [],
    parkVehicles: [],
    parks: [],
    subscriptions: [],
    users: [],
    sessions: [],
    supportThreads: [],
    referrals: [],
    referralAudit: [],
    accountDeletionAudit: [],
    addressPoints: [],
    driverDocumentAudit: [],
    deliveryEvents: [],
    marketingActions: [],
    marketingInstalls: [],
    marketingInvites: [],
    marketingLocations: [],
    marketingPartners: [],
    notifications: [],
    passwordResetTokens: [],
    pushTokens: [],
    verificationCodes: [],
    walletLedger: [],
  };
}

async function readDb() {
  if (storageDriver === 'postgres') {
    return readPostgresDb();
  }

  return readJsonDb();
}

async function readJsonDb() {
  try {
    const raw = await readFile(dbPath, 'utf8');
    const parsed = JSON.parse(raw);

    return normalizeDb(parsed);
  } catch (error) {
    const defaultDb = createDefaultDb();

    if (error.code !== 'ENOENT') {
      console.warn(`MVP DB read failed, starting with empty DB: ${error.message}`);
    }

    await writeDb(defaultDb);
    return defaultDb;
  }
}

// Записи состояния сериализуются через эту цепочку промисов: одновременные запросы
// не должны переписывать хранилище внахлёст. Запись на диск делается атомарно
// (temp-файл + rename), чтобы падение процесса посреди записи не оставляло
// наполовину записанный db-файл.
let dbWriteChain = Promise.resolve();

function writeDb(db) {
  const run = dbWriteChain.then(() => persistDb(db));
  // Ошибка одной записи не должна рвать очередь для последующих.
  dbWriteChain = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

async function persistDb(db) {
  pruneTransientAuthRecords(db);

  if (storageDriver === 'postgres') {
    await writePostgresDb(db);
    return;
  }

  await mkdir(dirname(dbPath), { recursive: true });

  const tempPath = `${dbPath}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await writeFile(tempPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
    await rename(tempPath, dbPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

// Сериализованная критическая секция read-modify-write. mutator получает СВЕЖЕЕ
// состояние, меняет его и сразу персистится — всё как одна неделимая операция.
// Это убирает гонку, когда два запроса читают каждый свою копию состояния и затирают
// изменения друг друга (например, два водителя одновременно принимают один заказ).
let dbMutationChain = Promise.resolve();

async function mutateDb(mutator) {
  const run = dbMutationChain.then(async () => {
    const db = await readDb();
    const result = await mutator(db);
    await writeDb(db);

    return result;
  });
  // Сбой одной мутации не должен рвать очередь для последующих.
  dbMutationChain = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

// Жизненный цикл заказа: created → searching → accepted/assigned → arrived → started →
// completed/closed, плюс отмена. Ранги нужны для проверки «только вперёд».
const ORDER_STATUS_RANK = {
  created: 0,
  searching: 1,
  assigned: 2,
  accepted: 2,
  arrived: 3,
  started: 4,
  completed: 5,
  closed: 5,
  cancelled: 6,
};

function isKnownOrderStatus(status) {
  return Object.prototype.hasOwnProperty.call(ORDER_STATUS_RANK, status);
}

// Разрешаем: тот же статус (идемпотентность), движение вперёд по схеме и отмену из
// любого активного статуса. Запрещаем: откат назад и «воскрешение» терминального заказа
// (completed/closed/cancelled нельзя вернуть в активные). Неизвестный исходный статус не
// блокируем — чтобы не падать на легаси-данных.
function isAllowedOrderStatusTransition(current, next) {
  if (current === next) {
    return true;
  }

  if (!isKnownOrderStatus(current)) {
    return true;
  }

  if (current === 'cancelled') {
    return false;
  }

  if (current === 'completed' || current === 'closed') {
    return next === 'completed' || next === 'closed';
  }

  if (next === 'cancelled') {
    return true;
  }

  return ORDER_STATUS_RANK[next] >= ORDER_STATUS_RANK[current];
}

function normalizeDb(parsed) {
  const source = parsed && typeof parsed === 'object' ? parsed : {};
  const defaultDb = createDefaultDb();

  return {
    ...defaultDb,
    ...source,
    drivers:
      Array.isArray(source.drivers) && source.drivers.length > 0
        ? source.drivers.map(normalizeDriver)
        : seedDrivers.map(normalizeDriver),
    driverPayments: Array.isArray(source.driverPayments)
      ? source.driverPayments.map(normalizeDriverPayment)
      : [],
    parkDrivers: Array.isArray(source.parkDrivers) ? source.parkDrivers.map(normalizeParkDriver) : [],
    parkVehicles: Array.isArray(source.parkVehicles) ? source.parkVehicles.map(normalizeParkVehicle) : [],
    parks: Array.isArray(source.parks) ? source.parks.map(normalizePark) : [],
    subscriptions: Array.isArray(source.subscriptions) ? source.subscriptions.map(normalizeSubscription) : [],
    addressPoints: Array.isArray(source.addressPoints) ? source.addressPoints.map(normalizeAddressPoint) : [],
    driverDocumentAudit: Array.isArray(source.driverDocumentAudit)
      ? source.driverDocumentAudit.map(normalizeDriverDocumentAuditEntry)
      : [],
    marketingActions: Array.isArray(source.marketingActions)
      ? source.marketingActions.map(normalizeMarketingAction)
      : [],
    marketingInstalls: Array.isArray(source.marketingInstalls)
      ? source.marketingInstalls.map(normalizeMarketingInstall)
      : [],
    marketingInvites: Array.isArray(source.marketingInvites)
      ? source.marketingInvites.map(normalizeMarketingInvite)
      : [],
    marketingLocations: Array.isArray(source.marketingLocations)
      ? source.marketingLocations.map(normalizeMarketingLocation)
      : [],
    marketingPartners: Array.isArray(source.marketingPartners)
      ? source.marketingPartners.map(normalizeMarketingPartner)
      : [],
    accountDeletionAudit: Array.isArray(source.accountDeletionAudit)
      ? source.accountDeletionAudit.map(normalizeAccountDeletionAuditEntry)
      : [],
    notifications: Array.isArray(source.notifications)
      ? source.notifications.map(normalizeRealtimeNotification)
      : [],
    orders: Array.isArray(source.orders) ? source.orders.map(normalizeOrder) : [],
    deliveryEvents: Array.isArray(source.deliveryEvents) ? source.deliveryEvents : [],
    passwordResetTokens: Array.isArray(source.passwordResetTokens)
      ? source.passwordResetTokens
      : [],
    pushTokens: Array.isArray(source.pushTokens) ? source.pushTokens.map(normalizePushToken).filter(Boolean) : [],
    referralAudit: Array.isArray(source.referralAudit) ? source.referralAudit : [],
    referrals: Array.isArray(source.referrals) ? source.referrals : [],
    sessions: Array.isArray(source.sessions)
      ? source.sessions.map(normalizeSessionRecord).filter(Boolean)
      : [],
    supportThreads: Array.isArray(source.supportThreads)
      ? source.supportThreads.map(normalizeSupportThread)
      : [],
    users: Array.isArray(source.users) ? source.users : [],
    verificationCodes: Array.isArray(source.verificationCodes) ? source.verificationCodes : [],
    walletLedger: Array.isArray(source.walletLedger) ? source.walletLedger : [],
  };
}

function normalizePark(park) {
  return {
    id: String(park.id || `park-${randomUUID().slice(0, 8)}`),
    organisationName: String(park.organisationName || park.companyName || ''),
    inn: String(park.inn || ''),
    ogrn: String(park.ogrn || ''),
    legalAddress: String(park.legalAddress || ''),
    contactPhone: normalizePhone(park.contactPhone || park.phone),
    settlementAccount: String(park.settlementAccount || park.fleetPayoutAccount || ''),
    ownerUserId: String(park.ownerUserId || park.userId || ''),
    subscriptionExpiresAt: park.subscriptionExpiresAt ? String(park.subscriptionExpiresAt) : undefined,
    status: ['pending', 'active', 'blocked'].includes(park.status) ? park.status : 'pending',
    createdAt: String(park.createdAt || new Date().toISOString()),
    updatedAt: String(park.updatedAt || new Date().toISOString()),
  };
}

function normalizeParkDriver(link) {
  return {
    id: String(link.id || `park-driver-${randomUUID().slice(0, 8)}`),
    userId: String(link.userId || ''),
    driverId: String(link.driverId || ''),
    parkId: String(link.parkId || ''),
    contact: String(link.contact || ''),
    inviteCode: String(link.inviteCode || '').trim().toUpperCase(),
    invitedAt: String(link.invitedAt || link.createdAt || new Date().toISOString()),
    invitedByUserId: String(link.invitedByUserId || ''),
    status: ['invited', 'active', 'blocked'].includes(link.status) ? link.status : 'invited',
    createdAt: String(link.createdAt || new Date().toISOString()),
    updatedAt: String(link.updatedAt || new Date().toISOString()),
  };
}

function normalizeParkVehicle(vehicle) {
  return {
    id: String(vehicle.id || `vehicle-${randomUUID().slice(0, 8)}`),
    parkId: String(vehicle.parkId || ''),
    driverId: vehicle.driverId ? String(vehicle.driverId) : undefined,
    brand: String(vehicle.brand || vehicle.carBrand || ''),
    model: String(vehicle.model || vehicle.carModel || ''),
    plate: String(vehicle.plate || vehicle.carPlate || ''),
    stsNumber: String(vehicle.stsNumber || ''),
    status: ['active', 'maintenance', 'disabled'].includes(vehicle.status) ? vehicle.status : 'active',
    createdAt: String(vehicle.createdAt || new Date().toISOString()),
    updatedAt: String(vehicle.updatedAt || new Date().toISOString()),
  };
}

function normalizeSubscription(subscription) {
  return {
    id: String(subscription.id || `sub-${randomUUID().slice(0, 8)}`),
    userId: subscription.userId ? String(subscription.userId) : undefined,
    parkId: subscription.parkId ? String(subscription.parkId) : undefined,
    type: subscription.type === 'park_monthly' ? 'park_monthly' : 'driver_monthly',
    amount: Number(subscription.amount || (subscription.type === 'park_monthly' ? parkAccessPlan.monthlyPrice : driverAccessPlans.monthly.monthlyPrice)),
    startsAt: String(subscription.startsAt || new Date().toISOString()),
    expiresAt: String(subscription.expiresAt || subscription.accessExpiresAt || new Date().toISOString()),
    status: ['active', 'expired', 'cancelled'].includes(subscription.status) ? subscription.status : 'active',
    createdAt: String(subscription.createdAt || new Date().toISOString()),
    updatedAt: String(subscription.updatedAt || new Date().toISOString()),
  };
}

function normalizeAddressPoint(point) {
  const coordinates = readGeoPoint(point.coordinates || point);
  const title = String(point.title || point.name || '').trim();
  const subtitle = String(point.subtitle || point.fullAddress || point.address || '').trim();
  const settlement = String(point.settlement || 'Салаватский район').trim();
  const category = String(point.category || point.type || 'address').trim() || 'address';

  return {
    aliases: Array.isArray(point.aliases) ? point.aliases.map(String) : [],
    category,
    coordinates: coordinates || undefined,
    createdAt: String(point.createdAt || new Date().toISOString()),
    displayAddress: String(point.displayAddress || [title, subtitle].filter(Boolean).join(', ')),
    id: String(point.id || `addr-${randomUUID().slice(0, 10)}`),
    settlement,
    source: String(point.source || 'admin'),
    subtitle: subtitle || settlement,
    title: title || subtitle || settlement,
    updatedAt: String(point.updatedAt || new Date().toISOString()),
  };
}

function normalizeMarketingPartner(partner) {
  const totalEarnedPoints = Number(partner.totalEarnedPoints || partner.balancePoints || 0);
  const level = calculateMarketingLevel(totalEarnedPoints);

  return {
    balancePoints: Math.max(0, Number(partner.balancePoints || 0)),
    baseEarnedPoints: Math.max(0, Number(partner.baseEarnedPoints || partner.totalBasePoints || 0)),
    createdAt: String(partner.createdAt || new Date().toISOString()),
    email: normalizeEmail(partner.email),
    id: String(partner.id || `mp-${randomUUID().slice(0, 10)}`),
    inviteCode: normalizeReferralCode(partner.inviteCode || partner.referralCode || ''),
    levelId: Number(partner.levelId || level.id),
    name: String(partner.name || '').trim(),
    paidOutPoints: Math.max(0, Number(partner.paidOutPoints || 0)),
    phone: normalizePhone(partner.phone),
    status: ['active', 'blocked', 'pending'].includes(partner.status) ? partner.status : 'active',
    totalEarnedPoints,
    updatedAt: String(partner.updatedAt || new Date().toISOString()),
    userId: String(partner.userId || ''),
  };
}

function normalizeMarketingAction(action) {
  return {
    basePoints: Number(action.basePoints || 0),
    confirmedAt: action.confirmedAt ? String(action.confirmedAt) : undefined,
    createdAt: String(action.createdAt || new Date().toISOString()),
    description: String(action.description || ''),
    id: String(action.id || `ma-${randomUUID().slice(0, 10)}`),
    marketerId: String(action.marketerId || ''),
    metadata: action.metadata && typeof action.metadata === 'object' ? action.metadata : {},
    paidAt: action.paidAt ? String(action.paidAt) : undefined,
    points: Number(action.points || action.basePoints || 0),
    sourceId: String(action.sourceId || ''),
    status: marketingActionStatuses.includes(action.status) ? action.status : 'rewarded',
    type: String(action.type || 'manual'),
  };
}

function normalizeMarketingInvite(invite) {
  return {
    code: normalizeReferralCode(invite.code || `MKT${randomUUID().slice(0, 6)}`),
    createdAt: String(invite.createdAt || new Date().toISOString()),
    createdByUserId: String(invite.createdByUserId || 'admin-local'),
    email: normalizeEmail(invite.email),
    phone: normalizePhone(invite.phone),
    status: ['pending', 'used', 'cancelled'].includes(invite.status) ? invite.status : 'pending',
    usedAt: invite.usedAt ? String(invite.usedAt) : undefined,
    usedByUserId: invite.usedByUserId ? String(invite.usedByUserId) : undefined,
  };
}

function normalizeMarketingInstall(install) {
  return {
    createdAt: String(install.createdAt || new Date().toISOString()),
    deviceId: String(install.deviceId || install.fingerprint || '').trim(),
    id: String(install.id || `mi-${randomUUID().slice(0, 10)}`),
    marketerId: String(install.marketerId || ''),
    qrCodeId: String(install.qrCodeId || ''),
    sourceId: String(install.sourceId || ''),
    sourceType: String(install.sourceType || 'client_qr'),
  };
}

function normalizeMarketingLocation(location) {
  const coordinates = readGeoPoint(location.coordinates || location);

  return {
    contractConfirmedAt: location.contractConfirmedAt ? String(location.contractConfirmedAt) : undefined,
    contractStatus: marketingContractStatuses.includes(location.contractStatus)
      ? location.contractStatus
      : 'pending',
    coordinates: coordinates || undefined,
    createdAt: String(location.createdAt || new Date().toISOString()),
    id: String(location.id || `mloc-${randomUUID().slice(0, 10)}`),
    installs: Math.max(0, Number(location.installs || 0)),
    lastMonthlyBonusAt: location.lastMonthlyBonusAt ? String(location.lastMonthlyBonusAt) : undefined,
    marketerId: String(location.marketerId || ''),
    qrCodeId: String(location.qrCodeId || ''),
    title: String(location.title || location.name || '').trim(),
    type: String(location.type || 'point').trim(),
    updatedAt: String(location.updatedAt || new Date().toISOString()),
  };
}

async function getPostgresPool() {
  if (!postgresPoolPromise) {
    postgresPoolPromise = import('pg').then((pg) => {
      const Pool = pg.Pool || pg.default?.Pool;

      if (!Pool) {
        throw new Error('pg package is not available');
      }

      return new Pool({
        connectionString: databaseUrl,
        max: readNumberEnv('MVP_DATABASE_POOL_SIZE', 5),
        ssl: readPostgresSslConfig(),
      });
    });
  }

  return postgresPoolPromise;
}

function readPostgresSslConfig() {
  const value = String(process.env.MVP_DATABASE_SSL || '').trim().toLowerCase();

  if (!value || value === '0' || value === 'false' || value === 'disable') {
    return undefined;
  }

  if (value === 'verify-full') {
    return { rejectUnauthorized: true };
  }

  return { rejectUnauthorized: false };
}

async function ensurePostgresStorage() {
  const pool = await getPostgresPool();
  const table = quotePostgresIdentifier(postgresStateTable);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${table} (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  return { pool, table };
}

async function readPostgresDb() {
  const { pool, table } = await ensurePostgresStorage();
  const result = await pool.query(`SELECT value FROM ${table} WHERE key = $1`, [postgresStateKey]);

  if (!result.rows.length) {
    const defaultDb = createDefaultDb();
    await writePostgresDb(defaultDb);
    return defaultDb;
  }

  return normalizeDb(result.rows[0].value);
}

async function writePostgresDb(db) {
  const { pool, table } = await ensurePostgresStorage();

  await pool.query(
    `
      INSERT INTO ${table} (key, value, updated_at)
      VALUES ($1, $2::jsonb, now())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `,
    [postgresStateKey, JSON.stringify(db)],
  );
}

async function closeStorage() {
  if (!postgresPoolPromise) {
    return;
  }

  const pool = await postgresPoolPromise.catch(() => null);
  postgresPoolPromise = undefined;
  await pool?.end();
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Webhook-Token',
    'Access-Control-Allow-Methods': 'DELETE,GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function sendBinary(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Length': payload.length,
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(payload);
}

function createRealtimeSnapshot(db, sessionContext) {
  return {
    drivers: makeDriversResponse(db, sessionContext),
    generatedAt: new Date().toISOString(),
    notifications: makeNotificationsResponse(db, sessionContext),
    orders: makeOrdersResponse(db, sessionContext),
    supportThreads: makeSupportThreadsResponse(db, sessionContext),
  };
}

function openRealtimeStream(request, response, db, sessionContext) {
  const clientId = randomUUID();
  const client = {
    heartbeat: undefined,
    id: clientId,
    response,
    sessionContext,
  };

  response.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream; charset=utf-8',
    'X-Accel-Buffering': 'no',
  });
  response.write(': taxi-partner realtime connected\n\n');

  realtimeClients.set(clientId, client);
  sendRealtimeEvent(client, 'snapshot', {
    clientId,
    snapshot: createRealtimeSnapshot(db, sessionContext),
    type: 'snapshot',
  });

  client.heartbeat = setInterval(() => {
    if (response.writableEnded) {
      closeRealtimeClient(clientId);
      return;
    }

    response.write(`: heartbeat ${new Date().toISOString()}\n\n`);
  }, 25_000);

  request.on('close', () => {
    closeRealtimeClient(clientId);
  });
}

function closeRealtimeClient(clientId) {
  const client = realtimeClients.get(clientId);

  if (!client) {
    return;
  }

  clearInterval(client.heartbeat);
  realtimeClients.delete(clientId);
}

function sendRealtimeEvent(client, eventType, payload) {
  if (client.response.writableEnded) {
    closeRealtimeClient(client.id);
    return;
  }

  try {
    client.response.write(`event: ${eventType}\n`);
    client.response.write(`data: ${JSON.stringify({ sentAt: new Date().toISOString(), ...payload })}\n\n`);
  } catch {
    closeRealtimeClient(client.id);
  }
}

function sendRealtimeSocketEvent(socket, eventType, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    realtimeSocketClients.delete(socket);
    return;
  }

  try {
    socket.send(
      JSON.stringify({
        sentAt: new Date().toISOString(),
        type: eventType,
        ...payload,
      }),
    );
  } catch {
    realtimeSocketClients.delete(socket);
    socket.close();
  }
}

function makeRealtimeEventPayload(eventType, payload, db, sessionContext) {
  const scopedPayload = { ...payload };

  if (scopedPayload.order) {
    scopedPayload.order = canReadOrder(db, sessionContext, scopedPayload.order)
      ? makeOrderResponse(db, scopedPayload.order, sessionContext)
      : undefined;
  }

  if (scopedPayload.driver) {
    scopedPayload.driver = makeDriverResponse(db, scopedPayload.driver, sessionContext);
  }

  if (scopedPayload.notification && !canReadNotification(db, sessionContext, scopedPayload.notification)) {
    scopedPayload.notification = undefined;
  }

  if (scopedPayload.thread && !canReadSupportThread(sessionContext, scopedPayload.thread)) {
    scopedPayload.thread = undefined;
  }

  return {
    ...scopedPayload,
    snapshot: createRealtimeSnapshot(db, sessionContext),
    type: eventType,
  };
}

function broadcastRealtime(eventType, payload, db) {
  if (realtimeClients.size === 0 && realtimeSocketClients.size === 0) {
    return;
  }

  for (const client of realtimeClients.values()) {
    sendRealtimeEvent(client, eventType, makeRealtimeEventPayload(eventType, payload, db, client.sessionContext));
  }

  for (const socket of realtimeSocketClients) {
    sendRealtimeSocketEvent(socket, eventType, makeRealtimeEventPayload(eventType, payload, db, socket.sessionContext));
  }
}

// Лёгкий канал координат: одна точка вместо полного snapshot, чтобы
// периодические GPS-пинги водителей не гоняли всю базу всем клиентам.
function broadcastDriverLocation(driver) {
  if (realtimeClients.size === 0 && realtimeSocketClients.size === 0) {
    return;
  }

  const payload = {
    driverId: driver.id,
    location: {
      accuracy: driver.lastLocation?.accuracy,
      latitude: driver.lastLocation?.latitude,
      longitude: driver.lastLocation?.longitude,
      updatedAt: driver.lastLocation?.updatedAt,
    },
    type: 'driver_location',
  };

  for (const client of realtimeClients.values()) {
    sendRealtimeEvent(client, 'driver_location', payload);
  }

  for (const socket of realtimeSocketClients) {
    sendRealtimeSocketEvent(socket, 'driver_location', payload);
  }
}

function addRealtimeNotification(db, input) {
  const notification = normalizeRealtimeNotification({
    ...input,
    createdAt: input.createdAt || new Date().toISOString(),
    id: input.id || `NTF-${Date.now().toString().slice(-8)}-${randomUUID().slice(0, 6)}`,
  });

  db.notifications = [notification, ...(Array.isArray(db.notifications) ? db.notifications : [])].slice(0, 200);
  return notification;
}

function normalizeRealtimeNotification(notification) {
  const audience = ['admin', 'all', 'client', 'driver', 'park'].includes(notification.audience)
    ? notification.audience
    : 'all';

  return {
    audience,
    body: String(notification.body || ''),
    createdAt: String(notification.createdAt || new Date().toISOString()),
    driverId: notification.driverId ? String(notification.driverId) : undefined,
    id: String(notification.id || `NTF-${Date.now().toString().slice(-8)}`),
    kind: String(notification.kind || 'system'),
    orderId: notification.orderId ? String(notification.orderId) : undefined,
    readAt: notification.readAt ? String(notification.readAt) : undefined,
    title: String(notification.title || 'Событие сервера'),
    userId: notification.userId ? String(notification.userId) : undefined,
  };
}

function normalizePushToken(token) {
  const value = String(token?.token || '').trim();
  const userId = String(token?.userId || '').trim();

  if (!value || !userId) {
    return null;
  }

  return {
    appOwnership: token.appOwnership ? String(token.appOwnership) : undefined,
    createdAt: String(token.createdAt || new Date().toISOString()),
    deviceName: token.deviceName ? String(token.deviceName) : undefined,
    deviceType: token.deviceType ? String(token.deviceType) : undefined,
    id: String(token.id || `PT-${randomUUID().slice(0, 10)}`),
    platform: String(token.platform || 'unknown'),
    role: token.role === 'admin' ? 'admin' : normalizeRole(token.role),
    token: value,
    tokenType: ['fcm', 'apns', 'expo'].includes(token.tokenType) ? token.tokenType : String(token.tokenType || 'unknown'),
    updatedAt: String(token.updatedAt || token.createdAt || new Date().toISOString()),
    userId,
  };
}

async function sendPushToDriver(db, driverId, notification, data = {}) {
  const driver = db.drivers.find((item) => item.id === driverId);
  const userId = driver?.userId;
  await sendPushToUser(db, userId, notification, data, ['self_employed_driver', 'park_driver', 'driver']);
}

async function sendPushToDrivers(db, driverIds, notification, data = {}) {
  const uniqueDriverIds = Array.from(new Set((driverIds || []).map(String).filter(Boolean)));

  await Promise.all(uniqueDriverIds.map((driverId) => sendPushToDriver(db, driverId, notification, data)));
}

async function sendPushToUser(db, userId, notification, data = {}, allowedRoles) {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return;
  }

  const tokens = (db.pushTokens || []).filter((token) => {
    if (token.userId !== normalizedUserId) {
      return false;
    }

    return !allowedRoles || allowedRoles.includes(token.role);
  });

  await Promise.all(
    tokens.map((token) =>
      sendPushToken(token, notification, data).catch((error) => {
        console.info('[push] delivery failed', {
          error: error instanceof Error ? error.message : String(error),
          tokenType: token.tokenType,
          userId: token.userId,
        });
      }),
    ),
  );
}

async function sendPushToPark(db, parkId, notification, data = {}) {
  const park = db.parks.find((item) => item.id === parkId);

  if (!park?.ownerUserId) {
    return;
  }

  await sendPushToUser(db, park.ownerUserId, notification, data, ['park_admin']);
}

async function sendPushToAdmins(db, notification, data = {}) {
  const adminUserIds = Array.from(
    new Set(
      (db.pushTokens || [])
        .filter((token) => token.role === 'admin')
        .map((token) => String(token.userId || '').trim())
        .filter(Boolean),
    ),
  );

  await Promise.all(adminUserIds.map((userId) => sendPushToUser(db, userId, notification, data, ['admin'])));
}

function getAvailableDriverIds(db) {
  return db.drivers
    .filter((driver) => {
      applyDriverAccessState(driver);
      return driver.isOnline && driver.canReceiveOrders && !isDriverBusy(db, driver.id);
    })
    .map((driver) => driver.id);
}

async function sendPushToken(token, notification, data) {
  if (token.tokenType === 'fcm') {
    await sendFcmPush(token, notification, data);
    return;
  }

  if (token.tokenType === 'apns') {
    await sendApnsPush(token, notification, data);
  }
}

async function sendFcmPush(token, notification, data) {
  const admin = await getFirebaseAdmin();

  if (!admin) {
    console.info('[push] FCM skipped: firebase-admin is not configured');
    return;
  }

  await admin.messaging().send({
    android: {
      notification: {
        channelId: 'driver-orders',
        sound: 'default',
      },
      priority: 'high',
    },
    data: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, String(value ?? '')]),
    ),
    notification: {
      body: notification.body,
      title: notification.title,
    },
    token: token.token,
  });
}

async function sendApnsPush(token, notification, data) {
  const provider = await getApnProvider();

  if (!provider) {
    console.info('[push] APNs skipped: APNs credentials are not configured');
    return;
  }

  const apn = await import('apn');
  const note = new apn.default.Notification({
    alert: {
      body: notification.body,
      title: notification.title,
    },
    category: 'driver_order_offer',
    sound: 'default',
    topic: process.env.MVP_APNS_BUNDLE_ID || 'ru.taxipartner.app',
  });

  note.payload = data;
  await provider.send(note, token.token);
}

async function getFirebaseAdmin() {
  if (firebaseAdminPromise) {
    return firebaseAdminPromise;
  }

  firebaseAdminPromise = (async () => {
    const serviceAccountJson = String(process.env.MVP_FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    const serviceAccountPath = String(process.env.MVP_FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();

    if (!serviceAccountJson && !serviceAccountPath && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return null;
    }

    const admin = await import('firebase-admin');

    if (!admin.default.apps.length) {
      const credential = serviceAccountJson
        ? admin.default.credential.cert(JSON.parse(serviceAccountJson))
        : serviceAccountPath
        ? admin.default.credential.cert(JSON.parse(await readFile(serviceAccountPath, 'utf8')))
        : admin.default.credential.applicationDefault();

      admin.default.initializeApp({ credential });
    }

    return admin.default;
  })();

  return firebaseAdminPromise;
}

async function getApnProvider() {
  if (apnProviderPromise) {
    return apnProviderPromise;
  }

  apnProviderPromise = (async () => {
    if (!process.env.MVP_APNS_KEY_PATH || !process.env.MVP_APNS_KEY_ID || !process.env.MVP_APNS_TEAM_ID) {
      return null;
    }

    const apn = await import('apn');
    return new apn.default.Provider({
      production: isProductionBackend,
      token: {
        key: process.env.MVP_APNS_KEY_PATH,
        keyId: process.env.MVP_APNS_KEY_ID,
        teamId: process.env.MVP_APNS_TEAM_ID,
      },
    });
  })();

  return apnProviderPromise;
}

function formatOrderRoute(order) {
  return `${order.pickup} → ${order.destination}`;
}

function getOrderStatusLabel(status) {
  const labels = {
    accepted: 'водитель назначен',
    arrived: 'водитель на месте',
    cancelled: 'поездка отменена',
    canceled: 'поездка отменена',
    closed: 'заказ закрыт',
    completed: 'поездка завершена',
    created: 'заказ создан',
    searching: 'поиск водителя',
    started: 'поездка началась',
  };

  return labels[status] || status;
}

function notifyDriverChange(db, driver, title, body, kind = 'driver_status') {
  return addRealtimeNotification(db, {
    audience: 'all',
    body,
    driverId: driver.id,
    kind,
    title,
    userId: driver.userId,
  });
}

function notifyOrderChange(db, order, title, body, kind = 'order_status') {
  return addRealtimeNotification(db, {
    audience: 'all',
    body,
    driverId: order.driver?.id,
    kind,
    orderId: order.id,
    title,
    userId: order.userId,
  });
}

async function searchAddresses(payload, db) {
  const query = String(payload.query || '').trim();
  const limit = clampNumber(payload.limit, 1, 20, 8);
  const point = readGeoPoint(payload);

  if (geoProvider.addressSearchUrl) {
    const providerPayload = await fetchGeoProviderJson(geoProvider.addressSearchUrl, {
      lat: point?.latitude,
      latitude: point?.latitude,
      limit,
      lon: point?.longitude,
      longitude: point?.longitude,
      q: query,
      query,
    });
    const providerSuggestions = normalizeProviderAddressSuggestions(providerPayload, limit);

    if (providerSuggestions.length > 0) {
      return {
        coverage: makeGeoCoverage('provider'),
        provider: makeGeoProviderMeta('provider', geoProvider.addressSearchUrl),
        suggestions: providerSuggestions,
      };
    }
  }

  return {
    coverage: makeGeoCoverage('local'),
    provider: makeGeoProviderMeta('local'),
    suggestions: searchLocalAddresses(query, limit, point, db),
  };
}

async function reverseGeocode(payload) {
  const point = readGeoPoint(payload);

  if (!point) {
    throw new Error('latitude and longitude are required');
  }

  if (geoProvider.reverseGeocodeUrl) {
    const providerPayload = await fetchGeoProviderJson(geoProvider.reverseGeocodeUrl, {
      lat: point.latitude,
      latitude: point.latitude,
      lon: point.longitude,
      longitude: point.longitude,
    });
    const providerAddress = normalizeProviderReverseAddress(providerPayload, point);

    if (providerAddress) {
      return {
        address: providerAddress,
        provider: makeGeoProviderMeta('provider', geoProvider.reverseGeocodeUrl),
        status: 'resolved',
      };
    }
  }

  return {
    address: reverseGeocodeLocal(point),
    provider: makeGeoProviderMeta('local'),
    status: 'resolved',
  };
}

async function estimateRoute(payload) {
  if (geoProvider.routeSearchUrl) {
    const providerPayload = await fetchGeoProviderJson(geoProvider.routeSearchUrl, {}, payload);
    const providerEstimate = normalizeProviderRouteEstimate(providerPayload, payload);

    if (providerEstimate) {
      return {
        estimate: providerEstimate,
        provider: makeGeoProviderMeta('provider', geoProvider.routeSearchUrl),
      };
    }
  }

  const estimate = estimateRouteFare(payload);

  return {
    estimate,
    provider: estimate.provider,
  };
}

async function fetchGeoProviderJson(endpoint, params = {}, body) {
  try {
    const url = new URL(endpoint);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && String(value).trim()) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      method: body ? 'POST' : 'GET',
    });

    if (!response.ok) {
      return null;
    }

    return response.json().catch(() => null);
  } catch {
    return null;
  }
}

function normalizeProviderAddressSuggestions(payload, limit) {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.suggestions)
    ? payload.suggestions
    : Array.isArray(payload?.results)
    ? payload.results
    : Array.isArray(payload?.items)
    ? payload.items
    : [];

  return items
    .map((item, index) => normalizeAddressSuggestion(item, `provider-${index}`))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeProviderReverseAddress(payload, point) {
  const data = payload?.address && typeof payload.address === 'object' ? payload.address : payload;
  const address = normalizeAddressSuggestion(data, 'reverse-provider');

  if (!address) {
    return null;
  }

  return {
    ...address,
    latitude: readNumber(data?.latitude ?? data?.lat, point.latitude),
    longitude: readNumber(data?.longitude ?? data?.lon, point.longitude),
  };
}

function normalizeProviderRouteEstimate(payload, requestPayload) {
  const data = payload?.estimate && typeof payload.estimate === 'object' ? payload.estimate : payload;
  const distanceKm = readNumber(data?.distanceKm ?? data?.distance_km ?? data?.distance, 0);
  const durationMin = Math.round(readNumber(data?.durationMin ?? data?.duration_min ?? data?.etaMin, 0));
  const total = readNumber(data?.total ?? data?.price ?? data?.amount, 0);

  if (!distanceKm || !durationMin || !total) {
    return null;
  }

  return {
    calculatedAt: new Date().toISOString(),
    confidence: ['draft', 'estimated', 'preset'].includes(data?.confidence) ? data.confidence : 'estimated',
    currency: 'RUB',
    distanceKm: roundDistance(distanceKm),
    distancePrice: readNumber(data?.distancePrice ?? data?.distance_price, total),
    durationMin,
    eta: `${durationMin} мин`,
    note: String(data?.note || 'серверный маршрут'),
    provider: makeGeoProviderMeta('provider', geoProvider.routeSearchUrl),
    tariffId: normalizeTariffId(requestPayload.tariffId || requestPayload.tariff),
    total: roundToTen(total),
  };
}

function normalizeAddressSuggestion(item, fallbackId) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const address = item.address && typeof item.address === 'object' ? item.address : {};
  const source = { ...address, ...item };
  const title =
    readText(source.title) ||
    readText(source.name) ||
    readText(source.displayName) ||
    readText(source.displayAddress) ||
    readText(source.formatted);
  const settlement =
    readText(source.settlement) ||
    readText(source.city) ||
    readText(source.town) ||
    readText(source.village) ||
    readText(source.locality) ||
    '';
  const street = readText(source.street) || readText(source.road);
  const house = readText(source.house) || readText(source.houseNumber);
  const subtitle =
    readText(source.subtitle) ||
    readText(source.formatted) ||
    [settlement, street && house ? `${street}, ${house}` : street].filter(Boolean).join(', ');

  if (!title && !subtitle) {
    return null;
  }

  const latitude = readOptionalNumber(source.latitude ?? source.lat);
  const longitude = readOptionalNumber(source.longitude ?? source.lon ?? source.lng);

  return {
    aliases: Array.isArray(source.aliases) ? source.aliases.map(String) : [title, subtitle].filter(Boolean),
    category: readText(source.category) || 'address',
    coordinates:
      latitude !== undefined && longitude !== undefined
        ? {
            latitude,
            longitude,
          }
        : undefined,
    displayAddress: readText(source.displayAddress) || [title, subtitle].filter(Boolean).join(', '),
    id: readText(source.id) || fallbackId,
    settlement,
    source: readText(source.source) || 'server',
    subtitle: subtitle || title,
    title: title || subtitle,
  };
}

function getAddressCatalog(db) {
  const manualAddresses = Array.isArray(db?.addressPoints) ? db.addressPoints.map(normalizeAddressPoint) : [];

  return [...manualAddresses, ...localAddressCatalog];
}

function searchLocalAddresses(query, limit, point, db) {
  const normalizedQuery = normalizeSearchText(query);
  const catalog = getAddressCatalog(db);
  const exactHouse = createLocalExactHouseSuggestion(query, catalog);
  const scored = catalog
    .map((address) => ({
      address: localAddressToSuggestion(address),
      score: scoreLocalAddress(address, normalizedQuery, point),
    }))
    .filter((item) => item.score > 0 || !normalizedQuery)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.address);

  return uniqueAddressSuggestions([exactHouse, ...scored].filter(Boolean)).slice(0, limit);
}

function localAddressToSuggestion(address) {
  return {
    aliases: Array.isArray(address.aliases) ? address.aliases : [],
    category: address.category,
    coordinates: address.coordinates,
    displayAddress: address.displayAddress || `${address.title}, ${address.subtitle}`,
    id: address.id,
    settlement: address.settlement,
    source: address.source || localGeoProviderName,
    subtitle: address.subtitle,
    title: address.title,
  };
}

function createLocalExactHouseSuggestion(query, catalog = localAddressCatalog) {
  const normalizedQuery = normalizeSearchText(query);
  const houseMatch = normalizedQuery.match(/(\d+[а-яa-z]?(?:[/-]\d+[а-яa-z]?)?)$/i);

  if (!houseMatch || normalizedQuery.length < 5) {
    return null;
  }

  const house = houseMatch[1];
  const streetQuery = normalizedQuery.replace(houseMatch[0], '').trim();
  const settlement = catalog.find((address) =>
    [address.title, address.subtitle, address.settlement, ...address.aliases]
      .map(normalizeSearchText)
      .some((value) => value.includes(streetQuery)),
  );

  if (!settlement) {
    return null;
  }

  return {
    aliases: [`${streetQuery} ${house}`, `${settlement.settlement} ${streetQuery} ${house}`],
    category: 'address',
    coordinates: settlement.coordinates,
    displayAddress: `${settlement.settlement}, ${streetQuery}, ${house}`,
    id: `local-house-${slugKey(settlement.settlement)}-${slugKey(streetQuery)}-${slugKey(house)}`,
    settlement: settlement.settlement,
    source: localGeoProviderName,
    subtitle: `${settlement.settlement}, ${streetQuery}, ${house}`,
    title: `${streetQuery}, дом ${house}`,
  };
}

function scoreLocalAddress(address, query, point) {
  const searchable = [address.title, address.subtitle, address.settlement, address.category, ...address.aliases]
    .map(normalizeSearchText)
    .filter(Boolean);
  let score = query ? 0 : 1;

  if (query && searchable.some((value) => value === query)) {
    score += 80;
  } else if (query && searchable.some((value) => value.startsWith(query))) {
    score += 60;
  } else if (query && searchable.some((value) => value.includes(query))) {
    score += 40;
  } else if (query) {
    const parts = query.split(' ').filter(Boolean);

    if (parts.length > 1 && parts.every((part) => searchable.some((value) => value.includes(part)))) {
      score += 25;
    }
  }

  if (point && address.coordinates) {
    const distanceKm = getDistanceKm(point, address.coordinates);
    score += Math.max(0, 20 - distanceKm / 3);
  }

  return score;
}

function reverseGeocodeLocal(point) {
  const nearest = localAddressCatalog
    .filter((address) => address.coordinates)
    .map((address) => ({
      address,
      distanceKm: getDistanceKm(point, address.coordinates),
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm)[0];

  if (!nearest || nearest.distanceKm > 80) {
    return {
      displayAddress: `Координаты ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`,
      latitude: point.latitude,
      longitude: point.longitude,
      region: 'Россия',
    };
  }

  return {
    displayAddress: `${nearest.address.title}, ${nearest.address.subtitle}`,
    latitude: point.latitude,
    longitude: point.longitude,
    region: nearest.address.settlement === 'Уфа' ? 'Республика Башкортостан' : 'Россия',
    settlement: nearest.address.settlement,
  };
}

function estimateRouteFare(payload) {
  const pickup = requireString(payload.pickup, 'pickup');
  const destination = requireString(payload.destination, 'destination');
  const role = normalizeRole(payload.role);
  const tariffId = normalizeTariffId(payload.tariffId || payload.tariff);
  const serviceType = normalizeOrderServiceType(payload.serviceType || payload.orderType || payload.kind);
  const optionsTotal = readNumber(payload.optionsTotal, estimateOptionsTotal(payload.options));
  const minimumPrice = readNumber(payload.minimumPrice, getTariffMinimum(tariffId) + optionsTotal);
  // Промежуточные остановки: та же надбавка, что в клиентской оценке
  // (buildRouteEstimate), чтобы показанная и записанная цена совпадали.
  const stopsCount = Math.max(
    0,
    Math.min(5, Math.trunc(readNumber(payload.stopsCount, Array.isArray(payload.stops) ? payload.stops.length : 0))),
  );
  const preset = findLocalRoutePreset(pickup, destination);
  const pickupPoint = findRoutePoint(pickup);
  const destinationPoint = findRoutePoint(destination);
  const baseDistanceKm =
    preset?.distanceKm ??
    (pickupPoint && destinationPoint
      ? Math.max(3.2, getDistanceKm(pickupPoint, destinationPoint) * 1.28)
      : pickupPoint || destinationPoint
      ? 14
      : 9);
  const distanceKm = baseDistanceKm + stopsCount * 1.8;
  const durationMin =
    (preset?.durationMin ?? Math.max(8, Math.round(baseDistanceKm * 1.35 + 6))) + stopsCount * 6;
  if (!isDriverLikeRole(role) && tariffId === 'economy') {
    const economyBase = serviceType === 'delivery' ? 160 : 120;
    const economyPrice = economyBase + stopsCount * 40;
    return {
      calculatedAt: new Date().toISOString(),
      confidence: preset ? 'preset' : pickupPoint && destinationPoint ? 'estimated' : 'draft',
      currency: 'RUB',
      distanceKm: roundDistance(distanceKm),
      distancePrice: economyPrice,
      durationMin,
      eta: `${durationMin} мин`,
      note: stopsCount ? `фикс по Малоязу · ${stopsCount} ост.` : 'фикс по Малоязу',
      provider: makeGeoProviderMeta('local'),
      surgeCoefficient: 1,
      tariffId,
      total: economyPrice + optionsTotal,
    };
  }

  const rate = getFareRate(tariffId, role);
  const distancePrice = roundToTen(distanceKm * rate.perKm + durationMin * rate.perMin);
  const total = roundToTen(Math.max(minimumPrice, rate.base + distancePrice + optionsTotal));

  return {
    calculatedAt: new Date().toISOString(),
    confidence: preset ? 'preset' : pickupPoint && destinationPoint ? 'estimated' : 'draft',
    currency: 'RUB',
    distanceKm: roundDistance(distanceKm),
    distancePrice,
    durationMin,
    eta: `${durationMin} мин`,
    note: preset ? 'популярный маршрут' : pickupPoint && destinationPoint ? 'серверная оценка РФ' : 'черновой расчет',
    provider: makeGeoProviderMeta('local'),
    tariffId,
    total,
  };
}

function findLocalRoutePreset(pickup, destination) {
  const normalizedPickup = normalizeSearchText(pickup);
  const normalizedDestination = normalizeSearchText(destination);

  return localRoutePresets.find(
    (route) =>
      addressLooksSame(normalizedPickup, normalizeSearchText(route.pickup)) &&
      addressLooksSame(normalizedDestination, normalizeSearchText(route.destination)),
  );
}

function findRoutePoint(value) {
  const normalizedValue = normalizeSearchText(value);
  const match = localAddressCatalog.find((address) =>
    [address.title, address.subtitle, address.settlement, ...address.aliases]
      .map(normalizeSearchText)
      .some((item) => addressLooksSame(normalizedValue, item)),
  );

  return match?.coordinates;
}

function getFareRate(tariffId, role) {
  if (isDriverLikeRole(role)) {
    return { base: 0, perKm: 22, perMin: 4 };
  }

  if (['business', 'airport'].includes(tariffId)) {
    return { base: 260, perKm: 42, perMin: 8 };
  }

  if (['comfort', 'current'].includes(tariffId)) {
    return { base: 160, perKm: 30, perMin: 5 };
  }

  return { base: 120, perKm: 24, perMin: 4 };
}

function getTariffMinimum(tariffId) {
  const minimums = {
    airport: 1180,
    business: 980,
    comfort: 590,
    current: 590,
    economy: 120,
    nearby: 420,
  };

  return minimums[tariffId] || 120;
}

function normalizeTariffId(value) {
  const normalized = normalizeSearchText(value);

  if (/бизнес|business/.test(normalized)) {
    return 'business';
  }

  if (/комфорт|comfort|current/.test(normalized)) {
    return 'comfort';
  }

  if (/аэропорт|airport/.test(normalized)) {
    return 'airport';
  }

  if (/ближайш|nearby/.test(normalized)) {
    return 'nearby';
  }

  return 'economy';
}

function estimateOptionsTotal(options) {
  if (!Array.isArray(options)) {
    return 0;
  }

  const prices = {
    багаж: 80,
    'детское кресло': 120,
    животное: 100,
    приоритет: 150,
  };

  return options.reduce((sum, option) => {
    const normalizedOption = normalizeSearchText(option);
    const price = Object.entries(prices).find(([key]) => normalizedOption.includes(key))?.[1] || 0;

    return sum + price;
  }, 0);
}

function makeGeoCoverage(source) {
  return {
    localAddresses: localAddressCatalog.length,
    localRoutes: localRoutePresets.length,
    mode: source === 'provider' ? 'provider' : 'local-fallback',
    region: 'Россия, MVP-пакет Салаватского района и межгородные якоря',
  };
}

function makeGeoProviderMeta(mode, url) {
  return {
    mode,
    name: mode === 'provider' ? 'configured-geo-provider' : localGeoProviderName,
    url: mode === 'provider' ? url : undefined,
  };
}

function readGeoPoint(payload) {
  const latitude = readOptionalNumber(payload.latitude ?? payload.lat);
  const longitude = readOptionalNumber(payload.longitude ?? payload.lon ?? payload.lng);

  if (latitude === undefined || longitude === undefined) {
    return null;
  }

  return { latitude, longitude };
}

function getDistanceKm(left, right) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(right.latitude - left.latitude);
  const lonDelta = toRadians(right.longitude - left.longitude);
  const leftLat = toRadians(left.latitude);
  const rightLat = toRadians(right.latitude);
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lonDelta / 2) * Math.sin(lonDelta / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getOrderPickupPoint(order) {
  return (
    readGeoPoint(order.pickupPoint || order.pickupCoordinates || {}) ||
    findRoutePoint(order.pickup)
  );
}

function getDriverLocationPoint(driver, at = Date.now()) {
  const location = driver?.lastLocation || driver?.location || driver?.coordinates || driver;
  const point = readGeoPoint(location || {});

  if (!point) {
    return null;
  }

  const updatedAt = Date.parse(location.updatedAt || driver.locationUpdatedAt || driver.updatedAt || '');
  const hasFreshTimestamp = Number.isFinite(updatedAt)
    ? at - updatedAt <= driverLocationMaxAgeMinutes * 60 * 1000
    : false;

  if (!hasFreshTimestamp && !driver.coordinates && !driver.latitude) {
    return null;
  }

  return point;
}

function isDriverBusy(db, driverId) {
  const busyStatuses = new Set(['assigned', 'accepted', 'arrived', 'started']);

  return db.orders.some(
    (order) => String(order.driver?.id || '') === String(driverId) && busyStatuses.has(order.status),
  );
}

function findNearestAvailableDriver(db, order) {
  const pickupPoint = getOrderPickupPoint(order);

  if (!pickupPoint) {
    return null;
  }

  return db.drivers
    .map((driver) => {
      applyDriverAccessState(driver);
      const driverPoint = getDriverLocationPoint(driver);

      if (!driver.isOnline || !driver.canReceiveOrders || !driverPoint || isDriverBusy(db, driver.id)) {
        return null;
      }

      return {
        distanceKm: getDistanceKm(pickupPoint, driverPoint),
        driver,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.distanceKm - right.distanceKm)[0] || null;
}

function isExclusiveOfferActive(order, at = Date.now()) {
  if (!order?.exclusiveDriverId || order.exclusiveOfferStatus !== 'pending') {
    return false;
  }

  const expiresAt = Date.parse(order.exclusiveOfferExpiresAt || '');

  return Number.isFinite(expiresAt) && expiresAt > at;
}

function releaseExclusiveOffer(order, reason = 'expired') {
  if (!order?.exclusiveDriverId || order.driver?.id || order.exclusiveOfferStatus !== 'pending') {
    return false;
  }

  const now = new Date().toISOString();
  order.dispatchMode = 'feed';
  order.dispatchStatus = reason === 'declined' ? 'driver_declined_open_feed' : 'open_feed';
  order.exclusiveOfferStatus = reason === 'declined' ? 'declined' : 'expired';
  order.exclusiveOfferReleasedAt = order.exclusiveOfferReleasedAt || now;
  order.updatedAt = now;
  addOrderStatusHistory(order, order.status, `exclusive-${reason}`);

  return true;
}

async function publishOrderOpenFeed(db, order) {
  const notification = addRealtimeNotification(db, {
    audience: 'driver',
    body: `${order.pickup} → ${order.destination} · ${order.total} ₽`,
    kind: 'order_open_feed',
    orderId: order.id,
    title: 'Заказ открыт всем водителям',
  });
  await sendPushToDrivers(db, getAvailableDriverIds(db), notification, {
    actionCategory: 'driver_order_offer',
    orderId: order.id,
    status: 'open_feed',
  });
  await sendPushToAdmins(db, notification, {
    orderId: order.id,
    status: 'open_feed',
  });
  broadcastRealtime('order_open_feed', { notification, order }, db);
  return notification;
}

function scheduleExclusiveOfferRelease(db, orderId) {
  const order = db.orders.find((item) => item.id === orderId);
  const expiresAt = Date.parse(order?.exclusiveOfferExpiresAt || '');

  if (!order || !Number.isFinite(expiresAt)) {
    return;
  }

  const delayMs = Math.max(0, expiresAt - Date.now() + 150);

  // Освобождение идёт через очередь мутаций на свежей копии базы: запись
  // копии, замкнутой таймером 30 секунд назад, откатывала бы все изменения,
  // сделанные за это время.
  setTimeout(() => {
    mutateDb(async (freshDb) => {
      const currentOrder = freshDb.orders.find((item) => item.id === orderId);

      if (!releaseExclusiveOffer(currentOrder, 'expired')) {
        return;
      }

      await publishOrderOpenFeed(freshDb, currentOrder);
    }).catch((error) => {
      console.error('[dispatch] failed to release exclusive offer', error);
    });
  }, delayMs);
}

// Быстрая read-only проверка перед mutateDb, чтобы GET-запросы не платили
// за сериализованную запись, когда освобождать нечего.
function hasExpiredExclusiveOffers(db) {
  return db.orders.some(
    (order) =>
      isExclusiveOfferActive(order) === false &&
      order.exclusiveDriverId &&
      order.exclusiveOfferStatus === 'pending' &&
      !order.driver?.id,
  );
}

function applyExclusiveOffer(db, order) {
  const nearest = findNearestAvailableDriver(db, order);

  if (!nearest?.driver) {
    order.dispatchMode = 'feed';
    order.dispatchStatus = 'open_feed';
    return null;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + dispatchExclusiveOfferSeconds * 1000);
  order.dispatchMode = 'exclusive';
  order.dispatchStatus = 'exclusive_offer';
  order.exclusiveDriverId = nearest.driver.id;
  order.exclusiveDriverName = nearest.driver.name;
  order.exclusiveOfferCreatedAt = now.toISOString();
  order.exclusiveOfferExpiresAt = expiresAt.toISOString();
  order.exclusiveOfferSeconds = dispatchExclusiveOfferSeconds;
  order.exclusiveOfferStatus = 'pending';
  order.exclusiveDistanceKm = roundDistance(nearest.distanceKm);

  return nearest;
}

async function releaseExpiredExclusiveOffers(db) {
  const releasedOrders = db.orders.filter((order) => isExclusiveOfferActive(order) === false)
    .filter((order) => order.exclusiveDriverId && order.exclusiveOfferStatus === 'pending' && !order.driver?.id);

  if (releasedOrders.length === 0) {
    return [];
  }

  for (const order of releasedOrders) {
    if (releaseExclusiveOffer(order, 'expired')) {
      await publishOrderOpenFeed(db, order);
    }
  }

  return releasedOrders;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function readOptionalNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}

function readNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

// Ключ сравнения адресов: регистр, ё/е и пунктуация не должны различать
// «Малояз, Советская 1» и «малояз советская 1».
function normalizeAddressKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(number)));
}

function roundDistance(value) {
  return Math.round(value * 10) / 10;
}

function roundToTen(value) {
  return Math.round(value / 10) * 10;
}

function normalizeSearchText(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/[.,;:()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addressLooksSame(left, right) {
  return left === right || left.includes(right) || right.includes(left);
}

function readText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function uniqueAddressSuggestions(items) {
  const seen = new Set();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

function slugKey(value) {
  return normalizeSearchText(value).replace(/[^a-zа-я0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeSupportThread(thread) {
  const now = new Date().toISOString();
  const messages = Array.isArray(thread.messages)
    ? thread.messages.map(normalizeSupportMessage).filter(Boolean)
    : [];

  return {
    category: String(thread.category || 'Общий вопрос'),
    createdAt: String(thread.createdAt || thread.updatedAt || now),
    id: String(thread.id || `support-${Date.now().toString().slice(-7)}`),
    messages,
    role: normalizeRole(thread.role),
    status: ['closed', 'open', 'waiting'].includes(thread.status) ? thread.status : 'waiting',
    title: String(thread.title || thread.category || 'Обращение в поддержку'),
    updatedAt: String(thread.updatedAt || messages.at(-1)?.createdAt || now),
    userId: thread.userId ? String(thread.userId) : undefined,
  };
}

function normalizeSupportMessage(message) {
  if (!message || typeof message !== 'object') {
    return null;
  }

  return {
    author: ['support', 'system', 'user'].includes(message.author) ? message.author : 'system',
    createdAt: String(message.createdAt || new Date().toISOString()),
    deliveryStatus: ['delivered', 'read', 'sent'].includes(message.deliveryStatus)
      ? message.deliveryStatus
      : 'delivered',
    id: String(message.id || `MSG-${Date.now().toString().slice(-8)}`),
    readAt: message.readAt ? String(message.readAt) : undefined,
    text: String(message.text || ''),
  };
}

function listSupportThreads(db, filters = {}) {
  const role = filters.role ? normalizeRole(filters.role) : '';
  const category = normalizeSearchText(filters.category);
  const userId = String(filters.userId || '');

  return (Array.isArray(db.supportThreads) ? db.supportThreads : [])
    .map(normalizeSupportThread)
    .filter((thread) => !role || thread.role === role)
    .filter((thread) => !category || normalizeSearchText(thread.category) === category)
    .filter((thread) => !userId || thread.userId === userId)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function appendSupportMessage(db, payload, sessionContext) {
  const now = new Date().toISOString();
  const role = isAdminSession(sessionContext) && payload.role
    ? normalizeRole(payload.role)
    : getSessionRole(sessionContext);
  const category = String(payload.category || 'Общий вопрос').trim() || 'Общий вопрос';
  const title = String(payload.title || category).trim() || category;
  const text = requireString(payload.text, 'text');
  const userId = isAdminSession(sessionContext)
    ? String(payload.userId || sessionContext?.user?.id || '')
    : String(sessionContext?.user?.id || '');
  const threadId = String(
    payload.threadId && isAdminSession(sessionContext)
      ? payload.threadId
      : `${role}-${userId || 'anonymous'}-${slugKey(category)}`,
  );
  const currentThreads = Array.isArray(db.supportThreads) ? db.supportThreads.map(normalizeSupportThread) : [];
  const existing = currentThreads.find((thread) => thread.id === threadId);
  const actor = makeActorFromSession(sessionContext);
  const userMessage = normalizeSupportMessage({
    author: 'user',
    createdAt: now,
    deliveryStatus: 'delivered',
    id: `MSG-${Date.now()}-${randomUUID().slice(0, 6)}`,
    text,
  });
  const supportMessage = normalizeSupportMessage({
    author: 'support',
    createdAt: now,
    deliveryStatus: 'sent',
    id: `MSG-${Date.now()}-${randomUUID().slice(0, 6)}-support`,
    text:
      'Сообщение принято сервером. Оператор увидит категорию, роль пользователя и историю диалога.',
  });
  const systemMessage = existing
    ? null
    : normalizeSupportMessage({
        author: 'system',
        createdAt: now,
        id: `MSG-${Date.now()}-${randomUUID().slice(0, 6)}-system`,
        text: `Канал открыт: ${category}. Автор: ${actor.name}.`,
      });
  const thread = normalizeSupportThread({
    ...(existing || {}),
    category,
    createdAt: existing?.createdAt || now,
    id: threadId,
    messages: [
      ...(existing?.messages || []),
      ...[systemMessage, userMessage, supportMessage].filter(Boolean),
    ],
    role,
    status: 'waiting',
    title,
    updatedAt: now,
    userId: userId || existing?.userId,
  });

  db.supportThreads = [thread, ...currentThreads.filter((item) => item.id !== thread.id)].slice(0, 300);
  addRealtimeNotification(db, {
    audience: 'admin',
    body: `${category}: ${text.slice(0, 120)}`,
    kind: 'support-message',
    title: 'Новое сообщение поддержки',
    userId: userId || undefined,
  });

  return thread;
}

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = '';
    const contentType = String(request.headers['content-type'] || '').toLowerCase();

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
        if (contentType.includes('application/x-www-form-urlencoded')) {
          resolveBody(Object.fromEntries(new URLSearchParams(body)));
          return;
        }

        resolveBody(JSON.parse(body));
      } catch {
        rejectBody(new Error(contentType.includes('application/x-www-form-urlencoded') ? 'Invalid form body' : 'Invalid JSON'));
      }
    });
  });
}

function makeOrder(payload) {
  const now = new Date().toISOString();
  const role = normalizeRole(payload.role);
  const serviceType = normalizeOrderServiceType(payload.serviceType || payload.orderType || payload.kind);
  const status = isDriverLikeRole(role) ? 'accepted' : isParkAdminRole(role) ? 'created' : 'searching';
  const safetyPinRequired = payload.safetyPinRequired === true || payload.tripPinEnabled === true ? true : false;
  const paymentMethod = String(payload.paymentMethod || 'Наличные');
  const pickup = requireString(payload.pickup, 'pickup');
  const destination = requireString(payload.destination, 'destination');

  if (normalizeAddressKey(pickup) === normalizeAddressKey(destination)) {
    throw new Error('Точка подачи и назначение совпадают');
  }

  const pickupPoint = readGeoPoint(payload.pickupPoint || payload.pickupCoordinates || payload);
  const stops = Array.isArray(payload.stops)
    ? payload.stops
        .map((stop) => String(stop).trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const scheduledAt = payload.scheduledAt ? String(payload.scheduledAt).trim().slice(0, 120) : undefined;
  // Клиентской цене не доверяем: пересчитываем на сервере для любых
  // клиентских тарифов. payload.total влияет на расчёт только у доверенных
  // ролей (водитель принимает готовый заказ, админ создаёт вручную).
  const trustedPricing = isDriverLikeRole(role) || isParkAdminRole(role);
  const routeEstimate = estimateRouteFare({
    destination,
    minimumPrice: trustedPricing ? Number(payload.total || 0) : undefined,
    options: payload.options,
    optionsTotal: payload.optionsTotal,
    pickup,
    role,
    serviceType,
    stopsCount: stops.length,
    tariff: payload.tariff,
    tariffId: payload.tariffId,
  });
  const tariffId = normalizeTariffId(payload.tariffId || payload.tariff);
  const total = trustedPricing ? Number(payload.total || routeEstimate.total) : routeEstimate.total;
  const paymentStatus = normalizePaymentStatus(
    payload.paymentStatus,
    getInitialPaymentStatus(paymentMethod, total),
  );

  return {
    id: makeOrderId(),
    clientRequestId: payload.clientRequestId ? String(payload.clientRequestId) : undefined,
    role,
    serviceType,
    pickup,
    pickupPoint: pickupPoint || findRoutePoint(pickup) || undefined,
    destination,
    stops,
    scheduledAt,
    deliveryHandoff: payload.deliveryHandoff ? String(payload.deliveryHandoff).trim() : undefined,
    deliveryPackageType: payload.deliveryPackageType ? String(payload.deliveryPackageType).trim() : undefined,
    packageDescription: payload.packageDescription ? String(payload.packageDescription).trim() : undefined,
    recipientName: payload.recipientName ? String(payload.recipientName).trim() : undefined,
    recipientPhone: payload.recipientPhone ? String(payload.recipientPhone).trim() : undefined,
    deliveryComment: payload.deliveryComment ? String(payload.deliveryComment).trim() : undefined,
    tariff: String(payload.tariff || 'Эконом'),
    tariffId,
    total,
    routeEstimate,
    paymentMethod,
    paymentStatus,
    driverCommission: 0,
    driverCommissionRate: 0,
    serviceShareAmount: 0,
    serviceShareRate: 0,
    serviceShareStatus: 'not_applicable',
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
    safetyPinRequired,
    safetyPinVerifiedAt: undefined,
    options: Array.isArray(payload.options) ? payload.options.map(String) : [],
    clientName: String(payload.clientName || ''),
    clientPhone: String(payload.clientPhone || ''),
    userId: String(payload.userId || ''),
    batchId: payload.batchId ? String(payload.batchId) : undefined,
    fulfilledByRole: normalizeFulfilledByRole(payload.fulfilledByRole, role),
    parkId: payload.parkId ? String(payload.parkId) : undefined,
    quoteId: payload.quoteId ? String(payload.quoteId) : undefined,
    surgeCoefficient: Number(payload.surgeCoefficient || payload.surge_coefficient || 1),
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

function makeOrderId() {
  return `TX-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function createTripPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function isValidTripPin(order, value) {
  return String(order.tripPin || '').trim() === String(value || '').trim();
}

function normalizeRole(value) {
  if (value === 'driver') {
    return 'self_employed_driver';
  }

  if (value === 'fleet') {
    return 'park_admin';
  }

  return ['client', 'self_employed_driver', 'park_admin', 'park_driver'].includes(value)
    ? value
    : 'client';
}

function normalizeOrderServiceType(value) {
  return String(value || '').trim().toLowerCase() === 'delivery' ? 'delivery' : 'taxi';
}

function isSelfEmployedDriverRole(value) {
  return normalizeRole(value) === 'self_employed_driver';
}

function isParkAdminRole(value) {
  return normalizeRole(value) === 'park_admin';
}

function isParkDriverRole(value) {
  return normalizeRole(value) === 'park_driver';
}

function isMarketerRole(value) {
  return String(value || '') === 'marketer';
}

function isDisabledMarketerUser(user) {
  return isMarketerRole(user?.role);
}

function isDriverLikeRole(value) {
  const role = normalizeRole(value);
  return role === 'self_employed_driver' || role === 'park_driver';
}

function normalizeFulfilledByRole(value, role) {
  if (value === 'park_driver' || isParkDriverRole(role)) {
    return 'park_driver';
  }

  if (value === 'self_employed' || isSelfEmployedDriverRole(role)) {
    return 'self_employed';
  }

  return undefined;
}

function requireString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function sanitizeFileName(value) {
  const sanitized = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 96);

  return sanitized || 'document.jpg';
}

function sanitizeStorageSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 80);
}

function isPathInside(parentPath, childPath) {
  const relativePath = relative(resolve(parentPath), resolve(childPath));

  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function normalizeImageMimeType(value) {
  const mimeType = String(value || '').trim().toLowerCase();

  return ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp'].includes(
    mimeType,
  )
    ? mimeType.replace('image/jpg', 'image/jpeg')
    : 'image/jpeg';
}

function getImageExtension(mimeType) {
  const extensions = {
    'image/heic': '.heic',
    'image/heif': '.heif',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };

  return extensions[normalizeImageMimeType(mimeType)] || '.jpg';
}

function normalizeOrder(order) {
  const normalizedOrder = {
    ...order,
    paymentMethod: String(order.paymentMethod || 'Наличные'),
    role: normalizeRole(order.role),
    serviceType: normalizeOrderServiceType(order.serviceType || order.orderType || order.kind),
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

  normalizedOrder.batchId = order.batchId || order.batch_id || undefined;
  normalizedOrder.fulfilledByRole = normalizeFulfilledByRole(order.fulfilledByRole, normalizedOrder.role);
  normalizedOrder.parkId = order.parkId ? String(order.parkId) : undefined;
  normalizedOrder.quoteId = order.quoteId || order.quote_id || undefined;
  normalizedOrder.deliveryHandoff = order.deliveryHandoff ? String(order.deliveryHandoff) : undefined;
  normalizedOrder.deliveryPackageType = order.deliveryPackageType ? String(order.deliveryPackageType) : undefined;
  normalizedOrder.packageDescription = order.packageDescription ? String(order.packageDescription) : undefined;
  normalizedOrder.recipientName = order.recipientName ? String(order.recipientName) : undefined;
  normalizedOrder.recipientPhone = order.recipientPhone ? String(order.recipientPhone) : undefined;
  normalizedOrder.deliveryComment = order.deliveryComment ? String(order.deliveryComment) : undefined;
  normalizedOrder.driverCommission = 0;
  normalizedOrder.driverCommissionRate = 0;
  normalizedOrder.serviceShareAmount = 0;
  normalizedOrder.serviceShareRate = 0;
  normalizedOrder.serviceShareStatus = 'not_applicable';
  if (['closed', 'completed'].includes(normalizedOrder.status)) {
    const driverCollectedAmount = Number(normalizedOrder.driverCollectedAmount || normalizedOrder.total || 0);
    normalizedOrder.driverCollectedAmount = driverCollectedAmount;
    normalizedOrder.driverNetAmount = driverCollectedAmount;
    normalizedOrder.driverPayout = driverCollectedAmount;
  }
  normalizedOrder.serviceShareEvents = Array.isArray(order.serviceShareEvents)
    ? order.serviceShareEvents.map(normalizeServiceShareEvent)
    : [];
  normalizedOrder.safetyPinRequired = order.safetyPinRequired === false ? false : Boolean(order.safetyPinRequired || order.tripPin);
  normalizedOrder.safetyPinVerifiedAt = order.safetyPinVerifiedAt ? String(order.safetyPinVerifiedAt) : undefined;
  normalizedOrder.tripPin = order.tripPin ? String(order.tripPin) : undefined;
  normalizedOrder.surgeCoefficient = Number(order.surgeCoefficient || order.surge_coefficient || 1);

  return normalizedOrder;
}

function normalizeServiceShareStatus(value, fallback = 'not_applicable') {
  return serviceShareStatuses.includes(value) ? value : fallback;
}

function normalizeServiceShareEvent(event = {}) {
  return {
    actor: String(event.actor || 'system'),
    at: String(event.at || new Date().toISOString()),
    note: String(event.note || ''),
    status: normalizeServiceShareStatus(event.status, 'pending_transfer'),
  };
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

function getOrderSettlementDate(order) {
  return String(order.serviceShareBatchDate || order.completedAt || order.updatedAt || new Date().toISOString()).slice(0, 10);
}

function getOrderSettlementTimestamp(order) {
  return Date.parse(order.completedAt || order.updatedAt || order.createdAt || '') || 0;
}

function applyOrderSettlement(order, billingMode) {
  const driverCollectedAmount = Number(order.total || 0);

  order.driverBillingMode = normalizeBillingMode(billingMode);
  order.driverCollectedAmount = driverCollectedAmount;
  order.driverCommissionRate = 0;
  order.driverCommission = 0;
  order.driverDailyOrderNumber = 0;
  order.driverNetAmount = driverCollectedAmount;
  order.driverPayout = driverCollectedAmount;
  order.serviceShareRate = 0;
  order.serviceShareAmount = 0;
  order.serviceShareBatchDate = getOrderSettlementDate(order);
  order.serviceShareStatus = 'not_applicable';
}

function recalculateDriverDailyServiceShare(db, driverId, batchDate) {
  const targetDate = String(batchDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const completedOrders = db.orders
    .filter(
      (item) =>
        ['closed', 'completed'].includes(item.status) &&
        String(item.driver?.id || '') === String(driverId) &&
        getOrderSettlementDate(item) === targetDate,
    )
    .sort((left, right) => getOrderSettlementTimestamp(left) - getOrderSettlementTimestamp(right));

  completedOrders.forEach((item, index) => {
    const driver = db.drivers.find((driverItem) => driverItem.id === item.driver?.id);
    const driverSnapshot = { ...(driver || {}), ...(item.driver || {}) };
    const billingMode = item.fulfilledByRole === 'park_driver'
      ? 'monthly'
      : getEffectiveDriverBillingMode(driverSnapshot);

    applyOrderSettlement(item, billingMode);
    item.driverTrialActive = false;
    item.driverTrialRemainingOrders = 0;
  });
}

function settleOrderPayment(db, order, actor = 'system') {
  if (order.paymentStatus !== 'paid') {
    updateOrderPayment(order, 'paid', actor, `Payment captured after ${order.status}`);
  }

  const batchDate = getOrderSettlementDate(order);
  order.serviceShareBatchDate = batchDate;
  if (order.driver?.id) {
    recalculateDriverDailyServiceShare(db, order.driver.id, batchDate);
  } else {
    applyOrderSettlement(order, 'daily');
  }

  if (!order.receipt) {
    order.receipt = createReceipt(order);
  }
}

function makeServiceShareSummary(db, batchDate = new Date().toISOString().slice(0, 10)) {
  const targetDate = String(batchDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const orders = db.orders.filter((order) => {
    return (
      ['closed', 'completed'].includes(order.status) &&
      getOrderSettlementDate(order) === targetDate
    );
  });
  const byDriver = new Map();
  const summary = {
    confirmedAmount: 0,
    ordersCount: orders.length,
    pendingTransferAmount: 0,
    reportedTransferAmount: 0,
    totalCollectedAmount: 0,
    totalServiceShareAmount: 0,
  };

  for (const order of orders) {
    const driverId = String(order.driver?.id || 'unassigned-driver');
    const driverName = String(order.driver?.name || 'Driver not assigned');
    const collectedAmount = Number(order.driverCollectedAmount || order.total || 0);
    const serviceShareAmount = 0;
    const status = 'not_applicable';

    if (!byDriver.has(driverId)) {
      byDriver.set(driverId, {
        confirmedAmount: 0,
        currentCommissionPercent: 0,
        billingMode: normalizeBillingMode(order.driverBillingMode || order.driver?.billingMode),
        driverId,
        driverName,
        ordersCount: 0,
        pendingTransferAmount: 0,
        reportedTransferAmount: 0,
        settlementStatus: 'not_applicable',
        subscriptionExpiresAt: order.driver?.subscriptionExpiresAt || order.driver?.accessExpiresAt,
        subscriptionPlan: order.driver?.subscriptionPlan || getDriverSubscriptionPlanId(order.driverBillingMode),
        totalCollectedAmount: 0,
        totalDriverNetAmount: 0,
        totalServiceShareAmount: 0,
      });
    }

    const driverSummary = byDriver.get(driverId);
    driverSummary.ordersCount += 1;
    driverSummary.billingMode = normalizeBillingMode(order.driverBillingMode || order.driver?.billingMode);
    driverSummary.currentCommissionPercent = 0;
    driverSummary.subscriptionExpiresAt = order.driver?.subscriptionExpiresAt || order.driver?.accessExpiresAt;
    driverSummary.subscriptionPlan =
      order.driver?.subscriptionPlan || getDriverSubscriptionPlanId(driverSummary.billingMode);
    driverSummary.totalCollectedAmount += collectedAmount;
    driverSummary.totalDriverNetAmount += collectedAmount;
    driverSummary.totalServiceShareAmount += serviceShareAmount;
    summary.totalCollectedAmount += collectedAmount;
    summary.totalServiceShareAmount += serviceShareAmount;

    if (status === 'confirmed') {
      driverSummary.confirmedAmount += serviceShareAmount;
      summary.confirmedAmount += serviceShareAmount;
    } else if (status === 'reported_transferred') {
      driverSummary.reportedTransferAmount += serviceShareAmount;
      summary.reportedTransferAmount += serviceShareAmount;
    } else {
      driverSummary.pendingTransferAmount += serviceShareAmount;
      summary.pendingTransferAmount += serviceShareAmount;
    }
  }

  for (const driverSummary of byDriver.values()) {
    driverSummary.currentCommissionPercent = 0;
    driverSummary.settlementStatus = 'not_applicable';
  }

  return {
    date: targetDate,
    drivers: Array.from(byDriver.values()).sort((left, right) =>
      right.totalServiceShareAmount - left.totalServiceShareAmount,
    ),
    orders: orders.map((order) => ({
      commissionPercent: 0,
      dailyOrderNumber: 0,
      driverId: order.driver?.id,
      driverName: order.driver?.name,
      id: order.id,
      serviceShareAmount: 0,
      status: 'not_applicable',
      total: Number(order.total || 0),
    })),
    summary,
  };
}

function updateOrderServiceShare(order) {
  applyOrderSettlement(order, order.driverBillingMode || order.driver?.billingMode || 'daily');
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
  return value === 'monthly' ? 'monthly' : value === 'daily' ? 'daily' : 'daily';
}

function getDriverAccessPlan(value) {
  return driverAccessPlans[normalizeBillingMode(value)] || driverAccessPlans.daily;
}

function getDriverSubscriptionPlanId(value) {
  return normalizeBillingMode(value) === 'monthly' ? 'partner_pro' : 'daily_line';
}

function maskPaymentCardNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (digits.length < 4) {
    return '';
  }

  return `**** **** **** ${digits.slice(-4)}`;
}

// Полный номер карты владельца для ручного перевода за доступ: группируем
// по 4 цифры. Пусто, если карта не настроена (env PAYMENT_CARD_NUMBER).
function formatPaymentCardNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (digits.length < 12) {
    return '';
  }

  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function isDriverPartnerProActive(driver, at = Date.now()) {
  if (!driver || normalizeBillingMode(driver.billingMode) !== 'monthly' || driver.subscriptionStatus !== 'active') {
    return false;
  }

  const expiresAt = Date.parse(driver.subscriptionExpiresAt || driver.accessExpiresAt || '');
  const timestamp = at instanceof Date ? at.getTime() : Number(at);
  return Number.isFinite(expiresAt) && Number.isFinite(timestamp) && expiresAt > timestamp;
}

function getEffectiveDriverBillingMode(driver) {
  return normalizeBillingMode(driver?.billingMode);
}

function normalizeDriverPaymentProvider(provider = driverPaymentProvider) {
  const mode = ['demo', 'live', 'manual'].includes(provider.mode) ? provider.mode : driverPaymentProvider.mode;
  const name = String(provider.name || driverPaymentProvider.name);
  const shopId = String(provider.shopId || driverPaymentProvider.shopId || '');

  return { mode, name, shopId };
}

function isYooKassaProvider(provider = driverPaymentProvider) {
  const name = String(provider.name || '').trim().toLowerCase();

  return ['yookassa', 'юkassa', 'юкасса'].includes(name) || name.includes('yookassa');
}

function shouldUseYooKassa(provider = driverPaymentProvider, amount = 0) {
  return provider.mode === 'live' && isYooKassaProvider(provider) && Number(amount) > 0;
}

function isYooKassaProviderName(value) {
  return isYooKassaProvider({ name: value });
}

function isTBankProviderName(value) {
  const name = String(value || '').trim().toLowerCase();

  return ['tbank', 't-bank', 'tinkoff', 'tinkoff-kassa', 'tinkoff-acquiring'].includes(name);
}

function isTBankProvider(provider = driverPaymentProvider) {
  return isTBankProviderName(provider.name);
}

function shouldUseTBank(provider = driverPaymentProvider, amount = 0) {
  return provider.mode === 'live' && isTBankProvider(provider) && Number(amount) > 0;
}

function shouldUseLivePaymentProvider(provider = driverPaymentProvider, amount = 0) {
  return shouldUseYooKassa(provider, amount) || shouldUseTBank(provider, amount);
}

function assertSupportedLiveProvider(provider, amount) {
  if (provider.mode !== 'live' || Number(amount) <= 0 || shouldUseLivePaymentProvider(provider, amount)) {
    return;
  }

  throw new Error('Live provider is not supported yet. Set MVP_PAYMENT_PROVIDER=tbank or yookassa, or use demo/manual mode.');
}

function assertYooKassaConfigured() {
  if (!yookassaConfig.shopId || !yookassaConfig.secretKey) {
    throw new Error('YooKassa live mode requires MVP_YOOKASSA_SHOP_ID and MVP_YOOKASSA_SECRET_KEY');
  }

  if (isProductionBackend && !yookassaConfig.webhookToken) {
    throw new Error('YooKassa production webhooks require MVP_YOOKASSA_WEBHOOK_TOKEN');
  }
}

function assertTBankConfigured() {
  if (!tbankConfig.terminalKey || !tbankConfig.password) {
    throw new Error('T-Bank live mode requires MVP_TBANK_TERMINAL_KEY and MVP_TBANK_PASSWORD');
  }

  if (isProductionBackend && (!tbankConfig.notificationUrl || !tbankConfig.webhookToken)) {
    throw new Error('T-Bank production webhooks require MVP_TBANK_NOTIFICATION_URL and MVP_TBANK_WEBHOOK_TOKEN');
  }
}

function formatRubAmount(value) {
  return (Math.round(Number(value || 0) * 100) / 100).toFixed(2);
}

function makeYooKassaAuthHeader() {
  assertYooKassaConfigured();
  return `Basic ${Buffer.from(`${yookassaConfig.shopId}:${yookassaConfig.secretKey}`).toString('base64')}`;
}

function getYooKassaErrorMessage(payload) {
  if (payload && typeof payload === 'object') {
    return payload.description || payload.error_description || payload.message || payload.type;
  }

  return undefined;
}

async function requestYooKassa(path, { body, idempotenceKey, method = 'GET' } = {}) {
  const response = await fetch(`${yookassaConfig.apiBaseUrl}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      accept: 'application/json',
      authorization: makeYooKassaAuthHeader(),
      'content-type': 'application/json',
      ...(idempotenceKey ? { 'Idempotence-Key': idempotenceKey } : {}),
    },
    method,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getYooKassaErrorMessage(payload) || `YooKassa request failed: ${response.status}`);
  }

  return payload;
}

function mapYooKassaPaymentStatus(providerPayment) {
  if (providerPayment?.paid === true || providerPayment?.status === 'succeeded') {
    return 'paid';
  }

  if (providerPayment?.status === 'canceled') {
    return 'failed';
  }

  return 'pending';
}

function applyYooKassaPaymentObject(payment, providerPayment) {
  if (!providerPayment || typeof providerPayment !== 'object') {
    return payment;
  }

  const now = new Date().toISOString();
  const status = mapYooKassaPaymentStatus(providerPayment);
  const confirmationUrl = providerPayment.confirmation?.confirmation_url;

  payment.providerPaymentId = String(providerPayment.id || payment.providerPaymentId || '');
  payment.providerPaymentStatus = String(providerPayment.status || payment.providerPaymentStatus || '');
  payment.status = status;
  payment.updatedAt = now;

  if (confirmationUrl && status === 'pending') {
    payment.confirmationUrl = String(confirmationUrl);
  }

  if (status === 'paid') {
    payment.confirmationUrl = undefined;
    payment.paidAt = payment.paidAt || String(providerPayment.captured_at || providerPayment.created_at || now);
    payment.providerError = undefined;
  }

  if (status === 'failed') {
    payment.confirmationUrl = undefined;
    payment.providerError = String(
      providerPayment.cancellation_details?.reason ||
        providerPayment.cancellation_details?.party ||
        'payment_canceled',
    );
  }

  return payment;
}

function makeYooKassaPaymentPayload(driver, payment) {
  const customerContact = String(driver.email || driver.phone || '').trim();

  return {
    amount: {
      currency: 'RUB',
      value: formatRubAmount(payment.amount),
    },
    capture: true,
    confirmation: {
      return_url: yookassaConfig.returnUrl,
      type: 'redirect',
    },
    description: `${payment.planName}: ${driver.name}`,
    metadata: {
      billing_mode: payment.billingMode,
      driver_id: driver.id,
      local_payment_id: payment.id,
    },
    ...(customerContact
      ? {
          receipt: {
            customer: /@/.test(customerContact) ? { email: customerContact } : { phone: customerContact },
            items: [
              {
                amount: {
                  currency: 'RUB',
                  value: formatRubAmount(payment.amount),
                },
                description: payment.planName,
                payment_mode: 'full_payment',
                payment_subject: 'service',
                quantity: '1.00',
                vat_code: 1,
              },
            ],
          },
        }
      : {}),
  };
}

function formatTBankAmount(value) {
  return Math.max(0, Math.round(Number(value || 0) * 100));
}

function makeTBankToken(payload) {
  assertTBankConfigured();

  const tokenPayload = {
    ...payload,
    Password: tbankConfig.password,
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

function getTBankErrorMessage(payload) {
  if (payload && typeof payload === 'object') {
    return payload.Details || payload.Message || payload.ErrorCode || payload.Status;
  }

  return undefined;
}

async function requestTBank(action, { body } = {}) {
  assertTBankConfigured();

  const requestBody = {
    ...(body || {}),
    TerminalKey: tbankConfig.terminalKey,
  };
  requestBody.Token = makeTBankToken(requestBody);

  const response = await fetch(`${tbankConfig.apiBaseUrl}/${action}`, {
    body: JSON.stringify(requestBody),
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    method: 'POST',
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.Success === false) {
    throw new Error(getTBankErrorMessage(payload) || `T-Bank request failed: ${response.status}`);
  }

  return payload;
}

function mapTBankPaymentStatus(providerPayment) {
  const status = String(providerPayment?.Status || providerPayment?.status || '').toUpperCase();

  if (status === 'CONFIRMED') {
    return 'paid';
  }

  if (['REFUNDED', 'PARTIAL_REFUNDED'].includes(status)) {
    return 'refunded';
  }

  if (['CANCELED', 'DEADLINE_EXPIRED', 'ATTEMPTS_EXPIRED', 'REJECTED', 'REVERSED'].includes(status)) {
    return 'failed';
  }

  return 'pending';
}

function applyTBankPaymentObject(payment, providerPayment) {
  if (!providerPayment || typeof providerPayment !== 'object') {
    return payment;
  }

  const now = new Date().toISOString();
  const status = mapTBankPaymentStatus(providerPayment);
  const confirmationUrl = providerPayment.PaymentURL || providerPayment.PaymentUrl || providerPayment.paymentUrl;

  payment.providerPaymentId = String(providerPayment.PaymentId || providerPayment.PaymentID || payment.providerPaymentId || '');
  payment.providerPaymentStatus = String(providerPayment.Status || payment.providerPaymentStatus || '');
  payment.providerOrderId = String(providerPayment.OrderId || payment.providerOrderId || payment.id);
  payment.providerRebillId = providerPayment.RebillId ? String(providerPayment.RebillId) : payment.providerRebillId;
  payment.status = status;
  payment.updatedAt = now;

  if (confirmationUrl && status === 'pending') {
    payment.confirmationUrl = String(confirmationUrl);
  }

  if (status === 'paid') {
    payment.confirmationUrl = undefined;
    payment.paidAt = payment.paidAt || now;
    payment.providerError = undefined;
  }

  if (status === 'failed') {
    payment.confirmationUrl = undefined;
    payment.providerError = getTBankErrorMessage(providerPayment) || 'payment_failed';
  }

  return payment;
}

function makeTBankReceipt(driver, payment) {
  const email = String(driver.email || '').trim();
  const phone = normalizeE164Phone(driver.phone);
  const amount = formatTBankAmount(payment.amount);
  const contact = email
    ? { Email: email }
    : phone
      ? { Phone: phone.startsWith('+') ? phone : `+${phone}` }
      : {};

  if (!contact.Email && !contact.Phone) {
    return undefined;
  }

  return {
    ...contact,
    Taxation: tbankConfig.taxation,
    Items: [
      {
        Amount: amount,
        Name: payment.planName,
        PaymentMethod: 'full_payment',
        PaymentObject: 'service',
        Price: amount,
        Quantity: 1,
        Tax: tbankConfig.vat,
      },
    ],
  };
}

function makeTBankInitPayload(driver, payment) {
  const receipt = makeTBankReceipt(driver, payment);

  return {
    Amount: formatTBankAmount(payment.amount),
    CustomerKey: String(driver.userId || driver.id),
    DATA: {
      billing_mode: payment.billingMode,
      driver_id: driver.id,
      local_payment_id: payment.id,
      provider: 'tbank',
    },
    Description: `${payment.planName}: ${driver.name}`.slice(0, 250),
    FailURL: tbankConfig.failUrl,
    NotificationURL: tbankConfig.notificationUrl || undefined,
    OrderId: payment.id,
    PayType: 'O',
    Receipt: receipt,
    Recurrent: tbankConfig.recurrent ? 'Y' : undefined,
    SuccessURL: tbankConfig.returnUrl,
  };
}

async function attachTBankPayment(driver, payment) {
  const providerPayment = await requestTBank('Init', {
    body: makeTBankInitPayload(driver, payment),
  });

  return applyTBankPaymentObject(payment, providerPayment);
}

async function attachProviderPayment(driver, payment) {
  if (payment.status === 'paid') {
    return payment;
  }

  if (shouldUseTBank(payment.provider, payment.amount)) {
    return attachTBankPayment(driver, payment);
  }

  if (shouldUseYooKassa(payment.provider, payment.amount)) {
    const providerPayment = await requestYooKassa('/payments', {
      body: makeYooKassaPaymentPayload(driver, payment),
      idempotenceKey: `driver-subscription-${payment.id}`,
      method: 'POST',
    });

    return applyYooKassaPaymentObject(payment, providerPayment);
  }

  return payment;
}

async function syncDriverPaymentWithProvider(db, payment) {
  const driver = db.drivers.find((item) => item.id === payment.driverId);

  if (!shouldUseLivePaymentProvider(payment.provider, payment.amount) || !payment.providerPaymentId) {
    return driver;
  }

  const previousStatus = payment.status;

  if (shouldUseTBank(payment.provider, payment.amount)) {
    const providerPayment = await requestTBank('GetState', {
      body: {
        PaymentId: payment.providerPaymentId,
      },
    });

    applyTBankPaymentObject(payment, providerPayment);
  } else {
    const providerPayment = await requestYooKassa(`/payments/${encodeURIComponent(payment.providerPaymentId)}`);

    applyYooKassaPaymentObject(payment, providerPayment);
  }

  if (driver && payment.status === 'paid' && previousStatus !== 'paid') {
    applyDriverAccessFromPayment(driver, payment);
  } else if (driver && payment.status === 'refunded' && previousStatus === 'paid') {
    payment.status = 'paid';
    refundDriverSubscriptionPayment(db, payment, 'Provider refund sync');
  } else if (driver) {
    applyDriverAccessState(driver);
  }

  return driver;
}

function findDriverPaymentFromYooKassaObject(db, providerObject) {
  const localPaymentId = providerObject?.metadata?.local_payment_id;

  return db.driverPayments.find(
    (payment) =>
      (localPaymentId && payment.id === localPaymentId) ||
      (providerObject?.id && payment.providerPaymentId === providerObject.id) ||
      (providerObject?.payment_id && payment.providerPaymentId === providerObject.payment_id),
  );
}

function findDriverPaymentFromTBankObject(db, providerObject) {
  const localPaymentId =
    providerObject?.DATA?.local_payment_id ||
    providerObject?.Data?.local_payment_id ||
    providerObject?.data?.local_payment_id;
  const orderId = providerObject?.OrderId || providerObject?.OrderID || providerObject?.orderId;
  const paymentId = providerObject?.PaymentId || providerObject?.PaymentID || providerObject?.paymentId;

  return db.driverPayments.find(
    (payment) =>
      (localPaymentId && payment.id === localPaymentId) ||
      (orderId && payment.id === orderId) ||
      (paymentId && payment.providerPaymentId === String(paymentId)),
  );
}

async function applyTBankWebhook(db, payload) {
  const event = String(payload.Status || payload.Event || payload.event || 'payment.notification');
  const payment = findDriverPaymentFromTBankObject(db, payload);

  if (!payment) {
    return { accepted: false, event, reason: 'payment_not_found' };
  }

  const driver = db.drivers.find((item) => item.id === payment.driverId);
  const previousStatus = payment.status;
  const verifiedObject =
    shouldUseTBank(payment.provider, payment.amount) && payment.providerPaymentId
      ? await requestTBank('GetState', {
          body: {
            PaymentId: payment.providerPaymentId,
          },
        })
      : payload;

  applyTBankPaymentObject(payment, verifiedObject);

  if (driver && payment.status === 'paid' && previousStatus !== 'paid') {
    applyDriverAccessFromPayment(driver, payment);
  } else if (driver && payment.status === 'refunded' && previousStatus === 'paid') {
    payment.status = 'paid';
    refundDriverSubscriptionPayment(db, payment, 'T-Bank refund webhook');
  } else if (driver) {
    applyDriverAccessState(driver);
  }

  return { accepted: true, event, paymentId: payment.id, status: payment.status };
}

async function applyYooKassaWebhook(db, payload) {
  const event = String(payload.event || '');
  const providerObject = payload.object && typeof payload.object === 'object' ? payload.object : {};
  const payment = findDriverPaymentFromYooKassaObject(db, providerObject);

  if (!payment) {
    return { accepted: false, event, reason: 'payment_not_found' };
  }

  if (event.startsWith('payment.')) {
    const driver = db.drivers.find((item) => item.id === payment.driverId);
    const previousStatus = payment.status;
    const verifiedObject =
      shouldUseYooKassa(payment.provider, payment.amount) && payment.providerPaymentId
        ? await requestYooKassa(`/payments/${encodeURIComponent(payment.providerPaymentId)}`)
        : providerObject;

    applyYooKassaPaymentObject(payment, verifiedObject);

    if (driver && payment.status === 'paid' && previousStatus !== 'paid') {
      applyDriverAccessFromPayment(driver, payment);
    } else if (driver) {
      applyDriverAccessState(driver);
      applyParkDriverAccessState(driver, db);
    }

    return { accepted: true, event, paymentId: payment.id, status: payment.status };
  }

  if (event.startsWith('refund.')) {
    payment.providerRefundId = String(providerObject.id || payment.providerRefundId || '');
    payment.providerRefundStatus = String(providerObject.status || payment.providerRefundStatus || '');
    payment.updatedAt = new Date().toISOString();

    if (providerObject.status === 'succeeded' && payment.status === 'paid') {
      refundDriverSubscriptionPayment(db, payment, payment.refundReason || 'YooKassa refund webhook');
    }

    return { accepted: true, event, paymentId: payment.id, refundStatus: payment.providerRefundStatus };
  }

  return { accepted: false, event, reason: 'unsupported_event' };
}

async function refundDriverSubscriptionPaymentWithProvider(db, payment, reason) {
  if (!shouldUseLivePaymentProvider(payment.provider, payment.amount)) {
    return refundDriverSubscriptionPayment(db, payment, reason);
  }

  if (!payment.providerPaymentId) {
    throw new Error('Provider payment id is missing');
  }

  if (shouldUseTBank(payment.provider, payment.amount)) {
    const providerRefund = await requestTBank('Cancel', {
      body: {
        Amount: formatTBankAmount(payment.amount),
        PaymentId: payment.providerPaymentId,
      },
    });

    payment.providerRefundId = String(providerRefund.PaymentId || payment.providerPaymentId);
    payment.providerRefundStatus = String(providerRefund.Status || providerRefund.ErrorCode || '');
    payment.refundReason = reason;
    payment.updatedAt = new Date().toISOString();

    if (providerRefund.Success !== false) {
      return refundDriverSubscriptionPayment(db, payment, reason);
    }

    throw new Error(getTBankErrorMessage(providerRefund) || 'T-Bank refund was rejected');
  }

  const providerRefund = await requestYooKassa('/refunds', {
    body: {
      amount: {
        currency: 'RUB',
        value: formatRubAmount(payment.amount),
      },
      description: reason,
      payment_id: payment.providerPaymentId,
    },
    idempotenceKey: `driver-refund-${payment.id}`,
    method: 'POST',
  });

  payment.providerRefundId = String(providerRefund.id || '');
  payment.providerRefundStatus = String(providerRefund.status || '');
  payment.refundReason = reason;
  payment.updatedAt = new Date().toISOString();

  if (providerRefund.status === 'succeeded') {
    return refundDriverSubscriptionPayment(db, payment, reason);
  }

  if (providerRefund.status === 'canceled') {
    throw new Error('YooKassa refund was canceled');
  }

  return db.drivers.find((item) => item.id === payment.driverId);
}

function hasValidYooKassaWebhookToken(request, url) {
  if (!yookassaConfig.webhookToken) {
    return true;
  }

  return (
    String(request.headers['x-webhook-token'] || '') === yookassaConfig.webhookToken ||
    String(url.searchParams.get('token') || '') === yookassaConfig.webhookToken
  );
}

function hasValidTBankWebhookToken(request, url, payload) {
  if (tbankConfig.webhookToken) {
    return (
      String(request.headers['x-webhook-token'] || '') === tbankConfig.webhookToken ||
      String(url.searchParams.get('token') || '') === tbankConfig.webhookToken
    );
  }

  const providerToken = String(payload?.Token || payload?.token || '');

  if (!providerToken || !tbankConfig.terminalKey || !tbankConfig.password) {
    return true;
  }

  return safeEqual(providerToken, makeTBankToken(payload));
}

function normalizeDriverPayment(payment) {
  const now = new Date().toISOString();
  const billingMode = normalizeBillingMode(payment.billingMode);
  const provider =
    payment.provider && typeof payment.provider === 'object'
      ? normalizeDriverPaymentProvider(payment.provider)
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

async function makeDriverSubscriptionPayment(driver, payload = {}) {
  const now = new Date().toISOString();
  const billingMode = normalizeBillingMode(payload.billingMode || driver.billingMode);
  const plan = getDriverAccessPlan(billingMode);
  const amount = Number(payload.amount ?? plan.monthlyPrice);
  const provider = normalizeDriverPaymentProvider(payload.provider || driverPaymentProvider);
  const shouldUseProvider = billingMode === 'daily' ? false : shouldUseLivePaymentProvider(provider, amount);
  const shouldCaptureNow = billingMode === 'daily' || (!shouldUseProvider && (payload.captureNow === true || amount === 0));

  assertSupportedLiveProvider(provider, amount);

  const payment = {
    id: `DSP-${Date.now().toString().slice(-7)}-${randomUUID().slice(0, 6)}`,
    driverId: driver.id,
    driverName: driver.name,
    billingMode,
    planName: plan.name,
    amount,
    currency: 'RUB',
    paymentMethod: String(payload.paymentMethod || (amount > 0 ? 'Банковская карта' : 'Доступ к линии')),
    provider: { ...provider },
    providerPaymentId: `${provider.mode}_${randomUUID()}`,
    confirmationUrl: shouldCaptureNow ? undefined : String(payload.confirmationUrl || ''),
    status: shouldCaptureNow ? 'paid' : 'pending',
    createdAt: now,
    updatedAt: now,
  };

  if (!shouldCaptureNow && payment.billingMode === 'monthly') {
    payment.providerPaymentStatus = 'awaiting_manual_transfer';
  }

  if (payment.status === 'paid') {
    payment.paidAt = now;
  }

  return attachProviderPayment(driver, payment);
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
  const previousBillingMode = normalizeBillingMode(driver.billingMode);

  driver.billingMode = payment.billingMode;
  driver.driverTariff = plan.name;
  driver.subscriptionPlan = getDriverSubscriptionPlanId(payment.billingMode);

  if (payment.status !== 'paid') {
    driver.updatedAt = new Date().toISOString();
    return applyDriverAccessState(driver);
  }

  if (payment.billingMode === 'monthly' || payment.billingMode === 'daily') {
    if (!payment.accessStartsAt || !payment.accessExpiresAt) {
      const currentExpiry =
        previousBillingMode === payment.billingMode ? Date.parse(driver.accessExpiresAt || '') : NaN;
      const startsAt =
        driver.subscriptionStatus === 'active' && Number.isFinite(currentExpiry) && currentExpiry > now.getTime()
          ? new Date(currentExpiry)
          : now;
      const expiresAt = new Date(startsAt);

      expiresAt.setDate(expiresAt.getDate() + Number(plan.accessDays || 1));
      payment.accessStartsAt = startsAt.toISOString();
      payment.accessExpiresAt = expiresAt.toISOString();
    }

    driver.accessExpiresAt = payment.accessExpiresAt;
    driver.subscriptionExpiresAt = payment.accessExpiresAt;
  } else {
    payment.accessStartsAt = now.toISOString();
    payment.accessExpiresAt = undefined;
    driver.accessExpiresAt = undefined;
    driver.subscriptionExpiresAt = undefined;
    driver.commissionTrialEndsAt = undefined;
    driver.commissionBillingStartedAt = driver.commissionBillingStartedAt || now.toISOString();
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
  if (payment.status === 'refunded') {
    return db.drivers.find((item) => item.id === payment.driverId);
  }

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
      driver.driverTariff = getDriverAccessPlan(replacement.billingMode).name;
      driver.subscriptionStatus = 'active';
      driver.accessExpiresAt = replacement.accessExpiresAt;
      driver.subscriptionExpiresAt = replacement.accessExpiresAt;
      driver.subscriptionPlan = getDriverSubscriptionPlanId(replacement.billingMode);
      driver.lastPaymentId = replacement.id;
    } else if (driver.lastPaymentId === payment.id || driver.accessExpiresAt === payment.accessExpiresAt) {
      driver.billingMode = 'daily';
      driver.driverTariff = getDriverAccessPlan('daily').name;
      driver.subscriptionStatus = 'inactive';
      driver.accessExpiresAt = undefined;
      driver.subscriptionExpiresAt = undefined;
      driver.subscriptionPlan = getDriverSubscriptionPlanId('daily');
      driver.lastPaymentId = undefined;
      driver.isOnline = false;
    }

    driver.updatedAt = now;
    applyDriverAccessState(driver);
  }

  return driver;
}

function makeDriverBillingDashboard(db, driver, sessionContext) {
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
    driver: makeDriverResponse(db, normalizedDriver, sessionContext),
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
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');

  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const hash = String(storedHash || '');

  if (hash.startsWith('scrypt$')) {
    const [, salt, expectedHash] = hash.split('$');

    if (!salt || !expectedHash) {
      return false;
    }

    const actual = Buffer.from(scryptSync(String(password), salt, 64).toString('hex'), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  return hash === createHash('sha256').update(String(password)).digest('hex');
}

function hashCode(code) {
  return createHash('sha256').update(String(code)).digest('hex');
}

function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

function makeOpaqueToken() {
  return randomBytes(32).toString('base64url');
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function makeSession(userId, role) {
  const token = makeOpaqueToken();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + sessionTtlDays);

  const record = {
    id: randomUUID(),
    role,
    tokenHash: hashToken(token),
    userId,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  return {
    record,
    session: {
      id: record.id,
      role,
      token,
      userId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
    },
  };
}

function normalizeSessionRecord(session) {
  if (!session || typeof session !== 'object') {
    return undefined;
  }

  const userId = String(session.userId || '').trim();
  const tokenHash = session.tokenHash || (session.token ? hashToken(session.token) : '');

  if (!userId || !tokenHash) {
    return undefined;
  }

  const createdAt = typeof session.createdAt === 'string' ? session.createdAt : new Date().toISOString();
  const expiresAt = typeof session.expiresAt === 'string' ? session.expiresAt : createSessionExpiry(createdAt);

  return {
    id: String(session.id || randomUUID()),
    role: session.role === 'admin' ? 'admin' : normalizeRole(session.role),
    tokenHash,
    userId,
    createdAt,
    expiresAt,
    revokedAt: typeof session.revokedAt === 'string' ? session.revokedAt : undefined,
  };
}

function createSessionExpiry(createdAtValue) {
  const createdAt = new Date(createdAtValue);
  const expiresAt = Number.isFinite(createdAt.getTime()) ? createdAt : new Date();

  expiresAt.setDate(expiresAt.getDate() + sessionTtlDays);
  return expiresAt.toISOString();
}

function getSessionContext(db, request, options = {}) {
  const authHeader = String(request.headers.authorization || '');
  const headerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const queryToken = options.allowQueryToken && options.url
    ? String(options.url.searchParams.get('token') || '').trim()
    : '';
  const token = headerToken || queryToken;

  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const session = db.sessions.find(
    (item) =>
      !item.revokedAt &&
      ((item.tokenHash && safeEqual(item.tokenHash, tokenHash)) || (!item.tokenHash && item.token === token)),
  );

  if (!session) {
    return null;
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
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

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function revokeSession(db, sessionId) {
  const session = db.sessions.find((item) => item.id === sessionId);

  if (session) {
    session.revokedAt = new Date().toISOString();
  }
}

function revokeUserSessions(db, userId) {
  const now = new Date().toISOString();

  db.sessions.forEach((session) => {
    if (session.userId === userId && !session.revokedAt) {
      session.revokedAt = now;
    }
  });
}

function pruneTransientAuthRecords(db) {
  const now = Date.now();
  const revokedKeepAfter = now - 7 * 24 * 60 * 60 * 1000;

  db.sessions = (Array.isArray(db.sessions) ? db.sessions : []).filter((session) => {
    if (session.revokedAt) {
      return Date.parse(session.revokedAt) >= revokedKeepAfter;
    }

    return !session.expiresAt || Date.parse(session.expiresAt) > now;
  });
  db.verificationCodes = (Array.isArray(db.verificationCodes) ? db.verificationCodes : []).filter(
    (record) => !record.usedAt && (!record.expiresAt || Date.parse(record.expiresAt) > now),
  );
  db.passwordResetTokens = (Array.isArray(db.passwordResetTokens) ? db.passwordResetTokens : []).filter(
    (record) => !record.usedAt && (!record.expiresAt || Date.parse(record.expiresAt) > now),
  );
  db.deliveryEvents = (Array.isArray(db.deliveryEvents) ? db.deliveryEvents : []).slice(0, deliveryAuditLimit);
}

function normalizeAccountDeletionAuditEntry(entry) {
  return {
    actorId: String(entry?.actorId || ''),
    actorRole: String(entry?.actorRole || 'user'),
    createdAt: typeof entry?.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
    id: String(entry?.id || `ada-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`),
    reason: String(entry?.reason || ''),
    removed: entry?.removed && typeof entry.removed === 'object' ? entry.removed : {},
    role: String(entry?.role || ''),
    userHash: String(entry?.userHash || ''),
  };
}

function addAccountDeletionAudit(db, user, actor, reason, removed) {
  const entry = normalizeAccountDeletionAuditEntry({
    actorId: actor.id,
    actorRole: actor.role,
    createdAt: new Date().toISOString(),
    id: `ada-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    reason,
    removed,
    role: user.role,
    userHash: hashCode([user.id, normalizeEmail(user.email), normalizePhone(user.phone)].join(':')),
  });

  db.accountDeletionAudit = [
    entry,
    ...(Array.isArray(db.accountDeletionAudit) ? db.accountDeletionAudit : []),
  ].slice(0, 500);
  return entry;
}

async function deleteDriverDocumentFiles(driver) {
  const uploads = normalizeDriverDocumentUploads(driver.documentUploads);
  const storageRoot = resolve(documentStoragePath);
  let removedFiles = 0;

  for (const upload of Object.values(uploads)) {
    if (!upload?.storageKey) {
      continue;
    }

    const targetPath = resolve(storageRoot, upload.storageKey);

    if (!isPathInside(storageRoot, targetPath)) {
      continue;
    }

    try {
      await rm(targetPath, { force: true });
      removedFiles += 1;
    } catch {
      // Missing document files should not block account deletion.
    }
  }

  return removedFiles;
}

async function deleteUserAccount(db, user, actor, reason = '') {
  const userId = user.id;
  const now = new Date().toISOString();
  const userDrivers = db.drivers.filter((driver) => driver.userId === userId);
  const driverIds = new Set(userDrivers.map((driver) => driver.id));
  const removed = {
    account: 1,
    driverDocuments: 0,
    driverPayments: 0,
    drivers: userDrivers.length,
    notifications: 0,
    ordersAnonymized: 0,
    passwordResetTokens: 0,
    referrals: 0,
    sessions: 0,
    supportThreads: 0,
    verificationCodes: 0,
    walletLedger: 0,
  };

  for (const driver of userDrivers) {
    removed.driverDocuments += await deleteDriverDocumentFiles(driver);
  }

  db.orders = db.orders.map((order) => {
    let changed = false;
    const nextOrder = { ...order };

    if (nextOrder.userId === userId) {
      nextOrder.userId = '';
      nextOrder.clientName = 'Удаленный пользователь';
      nextOrder.clientPhone = '';
      changed = true;
    }

    if (nextOrder.driver?.id && driverIds.has(nextOrder.driver.id)) {
      nextOrder.driver = {
        ...nextOrder.driver,
        name: 'Удаленный водитель',
        phone: '',
        plate: '',
        vehicle: '',
      };
      changed = true;
    }

    if (!changed) {
      return order;
    }

    removed.ordersAnonymized += 1;
    return {
      ...nextOrder,
      statusHistory: [
        {
          actor: actor.id || 'account-deletion',
          at: now,
          status: 'personal_data_deleted',
        },
        ...(Array.isArray(nextOrder.statusHistory) ? nextOrder.statusHistory : []),
      ],
      updatedAt: now,
    };
  });

  removed.driverPayments = db.driverPayments.filter((payment) => driverIds.has(payment.driverId)).length;
  db.driverPayments = db.driverPayments.filter((payment) => !driverIds.has(payment.driverId));

  db.driverDocumentAudit = (Array.isArray(db.driverDocumentAudit) ? db.driverDocumentAudit : []).filter(
    (entry) => !driverIds.has(entry.driverId),
  );
  db.drivers = db.drivers.filter((driver) => driver.userId !== userId);

  removed.referrals = db.referrals.filter(
    (referral) => referral.inviterUserId === userId || referral.inviteeUserId === userId,
  ).length;
  const removedReferralIds = new Set(
    db.referrals
      .filter((referral) => referral.inviterUserId === userId || referral.inviteeUserId === userId)
      .map((referral) => referral.id),
  );
  db.referrals = db.referrals.filter(
    (referral) => referral.inviterUserId !== userId && referral.inviteeUserId !== userId,
  );
  db.referralAudit = (Array.isArray(db.referralAudit) ? db.referralAudit : []).filter(
    (entry) => !removedReferralIds.has(entry.referralId) && entry.actorUserId !== userId,
  );

  removed.walletLedger = db.walletLedger.filter((entry) => entry.userId === userId).length;
  db.walletLedger = db.walletLedger.filter((entry) => entry.userId !== userId);

  removed.sessions = db.sessions.filter((session) => session.userId === userId).length;
  db.sessions = db.sessions.filter((session) => session.userId !== userId);

  removed.verificationCodes = db.verificationCodes.filter((record) => record.userId === userId).length;
  db.verificationCodes = db.verificationCodes.filter((record) => record.userId !== userId);

  removed.passwordResetTokens = db.passwordResetTokens.filter((record) => record.userId === userId).length;
  db.passwordResetTokens = db.passwordResetTokens.filter((record) => record.userId !== userId);

  removed.notifications = db.notifications.filter(
    (notification) => notification.userId === userId || (notification.driverId && driverIds.has(notification.driverId)),
  ).length;
  db.notifications = db.notifications.filter(
    (notification) => notification.userId !== userId && (!notification.driverId || !driverIds.has(notification.driverId)),
  );

  removed.supportThreads = db.supportThreads.filter((thread) => thread.userId === userId).length;
  db.supportThreads = db.supportThreads.filter((thread) => thread.userId !== userId);

  db.deliveryEvents = (Array.isArray(db.deliveryEvents) ? db.deliveryEvents : []).map((event) =>
    event.userId === userId
      ? {
          ...event,
          maskedTarget: 'deleted-account',
          messageId: undefined,
          userId: 'deleted-account',
        }
      : event,
  );

  db.users = db.users.filter((item) => item.id !== userId);
  const audit = addAccountDeletionAudit(db, user, actor, reason, removed);

  return {
    deletedAt: audit.createdAt,
    ok: true,
    removed,
  };
}

function canAccessUser(sessionContext, userId) {
  return sessionContext?.user?.role === 'admin' || sessionContext?.user?.id === userId;
}

function isAdminSession(sessionContext) {
  return sessionContext?.user?.role === 'admin';
}

function getSessionRole(sessionContext) {
  return sessionContext?.user?.role === 'admin' ? 'admin' : normalizeRole(sessionContext?.user?.role);
}

function getSessionDriverProfiles(db, sessionContext) {
  if (!sessionContext) {
    return [];
  }

  return db.drivers.filter((driver) => driver.userId === sessionContext.user.id);
}

function getSessionDriverIds(db, sessionContext) {
  return new Set(getSessionDriverProfiles(db, sessionContext).map((driver) => String(driver.id)));
}

function canAccessPark(sessionContext, park) {
  if (isAdminSession(sessionContext)) {
    return true;
  }

  if (!sessionContext || !park) {
    return false;
  }

  return (
    getSessionRole(sessionContext) === 'park_admin' &&
    (park.ownerUserId === sessionContext.user.id || park.id === sessionContext.user.parkId)
  );
}

function canAccessDriver(sessionContext, driver) {
  if (isAdminSession(sessionContext) || (driver?.userId && driver.userId === sessionContext?.user?.id)) {
    return true;
  }

  return (
    getSessionRole(sessionContext) === 'park_admin' &&
    driver?.parkId &&
    driver.parkId === sessionContext?.user?.parkId
  );
}

function canReadDriver(sessionContext, driver) {
  if (canAccessDriver(sessionContext, driver)) {
    return true;
  }

  return Boolean(driver?.status === 'approved' && driver.canReceiveOrders);
}

function makeDriversResponse(db, sessionContext) {
  return db.drivers
    .map((driver) => {
      const normalizedDriver = normalizeDriver(driver);
      return canReadDriver(sessionContext, normalizedDriver)
        ? makeDriverResponse(db, normalizedDriver, sessionContext)
        : null;
    })
    .filter(Boolean);
}

function canReadOrder(db, sessionContext, order) {
  if (isAdminSession(sessionContext)) {
    return true;
  }

  if (!sessionContext || !order) {
    return false;
  }

  const role = getSessionRole(sessionContext);

  if (role === 'client') {
    return Boolean(order.userId && order.userId === sessionContext.user.id);
  }

  if (isDriverLikeRole(role)) {
    const driverIds = getSessionDriverIds(db, sessionContext);

    if (order.driver?.id && driverIds.has(String(order.driver.id))) {
      return true;
    }

    return (
      order.role === 'client' &&
      !order.driver &&
      ['created', 'searching'].includes(order.status)
    );
  }

  if (role === 'park_admin') {
    return Boolean(order.parkId && order.parkId === sessionContext.user.parkId);
  }

  return false;
}

function makeOrderResponse(db, order, sessionContext) {
  const responseOrder = { ...order };
  const isOwnerClient = Boolean(order.userId && order.userId === sessionContext?.user?.id);
  const driverIds = getSessionDriverIds(db, sessionContext);
  const isAssignedDriver = Boolean(order.driver?.id && driverIds.has(String(order.driver.id)));

  if (!isAdminSession(sessionContext) && !isOwnerClient) {
    delete responseOrder.tripPin;
  }

  if (!isAdminSession(sessionContext) && !isOwnerClient && !isAssignedDriver) {
    delete responseOrder.clientPhone;
    delete responseOrder.recipientPhone;
  }

  return responseOrder;
}

function makeOrdersResponse(db, sessionContext) {
  return db.orders
    .filter((order) => canReadOrder(db, sessionContext, order))
    .map((order) => makeOrderResponse(db, order, sessionContext));
}

function canReadNotification(db, sessionContext, notification) {
  if (isAdminSession(sessionContext)) {
    return true;
  }

  if (!sessionContext || !notification) {
    return false;
  }

  const role = getSessionRole(sessionContext);

  if (notification.userId && notification.userId === sessionContext.user.id) {
    return true;
  }

  if (notification.driverId && getSessionDriverIds(db, sessionContext).has(String(notification.driverId))) {
    return true;
  }

  if (notification.audience === 'client' && role === 'client') {
    return true;
  }

  if (notification.audience === 'driver' && isDriverLikeRole(role)) {
    return true;
  }

  if (notification.audience === 'park' && role === 'park_admin') {
    return true;
  }

  if (notification.orderId) {
    const order = db.orders.find((item) => item.id === notification.orderId);
    return canReadOrder(db, sessionContext, order);
  }

  return notification.audience === 'all';
}

function makeNotificationsResponse(db, sessionContext) {
  return (Array.isArray(db.notifications) ? db.notifications : [])
    .filter((notification) => canReadNotification(db, sessionContext, notification))
    .slice(0, 50);
}

function canReadSupportThread(sessionContext, thread) {
  if (isAdminSession(sessionContext)) {
    return true;
  }

  return Boolean(sessionContext && thread?.userId && thread.userId === sessionContext.user.id);
}

function makeSupportThreadsResponse(db, sessionContext, filters = {}) {
  const userId = isAdminSession(sessionContext)
    ? filters.userId
    : sessionContext?.user?.id;

  return listSupportThreads(db, {
    ...filters,
    userId,
  })
    .filter((thread) => canReadSupportThread(sessionContext, thread))
    .slice(0, 50);
}

function getDriverForSession(db, sessionContext, requestedDriverId) {
  if (!sessionContext) {
    return null;
  }

  if (isAdminSession(sessionContext)) {
    return db.drivers.find((driver) => driver.id === requestedDriverId) || null;
  }

  const role = getSessionRole(sessionContext);
  const ownDrivers = getSessionDriverProfiles(db, sessionContext);

  if (isDriverLikeRole(role)) {
    return ownDrivers.find((driver) => !requestedDriverId || driver.id === requestedDriverId) || null;
  }

  if (role === 'park_admin') {
    return db.drivers.find(
      (driver) => driver.id === requestedDriverId && driver.parkId === sessionContext.user.parkId,
    ) || null;
  }

  return null;
}

function canMutateOrder(sessionContext, db, order) {
  if (isAdminSession(sessionContext)) {
    return true;
  }

  if (!sessionContext || !order) {
    return false;
  }

  const role = getSessionRole(sessionContext);

  if (role === 'client') {
    return Boolean(order.userId && order.userId === sessionContext.user.id);
  }

  if (isDriverLikeRole(role)) {
    const driverIds = getSessionDriverIds(db, sessionContext);
    return Boolean(order.driver?.id && driverIds.has(String(order.driver.id)));
  }

  if (role === 'park_admin') {
    return Boolean(order.parkId && order.parkId === sessionContext.user.parkId);
  }

  return false;
}

function hasInternalAccess(request, url) {
  const token =
    String(request.headers['x-internal-token'] || '') ||
    String(request.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
    String(url.searchParams.get('token') || '');

  return Boolean(internalApiToken && token && safeEqual(token, internalApiToken));
}

function makeActorFromSession(sessionContext) {
  if (!sessionContext) {
    return {
      id: 'anonymous',
      role: 'anonymous',
      name: 'Неизвестный пользователь',
    };
  }

  return {
    id: sessionContext.user.id,
    role: sessionContext.user.role,
    name: [sessionContext.user.firstName, sessionContext.user.lastName].filter(Boolean).join(' ') ||
      (sessionContext.user.role === 'admin' ? 'Админ' : 'Пользователь'),
  };
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

function normalizeProviderMode(value) {
  return value === 'live' ? 'live' : 'demo';
}

function normalizePhoneDeliveryChannel(value) {
  const channel = String(value || '').trim().toLowerCase();

  if (channel === 'telegram' || channel === 'tg') {
    return 'telegram';
  }

  if (channel === 'max') {
    return 'max';
  }

  return 'sms';
}

function normalizeVerificationDeliveryChannel(channel, value) {
  if (channel === 'email') {
    return 'email';
  }

  return normalizePhoneDeliveryChannel(value || defaultPhoneDeliveryChannel);
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

function createVerificationRecord(user, channel, deliveryChannel) {
  const code = makeVerificationCode(channel);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + verificationCodeTtlMinutes);

  return {
    code,
    record: {
      id: randomUUID(),
      userId: user.id,
      channel,
      deliveryChannel,
      target: getVerificationTarget(user, channel),
      codeHash: hashCode(code),
      attempts: 0,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  };
}

function createSmsLoginRecord(user, deliveryChannel) {
  const code = makeVerificationCode('phone');
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + verificationCodeTtlMinutes);

  return {
    code,
    record: {
      id: randomUUID(),
      userId: user.id,
      channel: 'phone',
      deliveryChannel,
      purpose: 'sms-login',
      target: normalizePhone(user.phone),
      codeHash: hashCode(code),
      attempts: 0,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  };
}

function createPasswordResetRecord(user, deliveryChannel) {
  const code = makeVerificationCode(deliveryChannel === 'email' ? 'email' : 'phone');
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + passwordResetCodeTtlMinutes);

  return {
    code,
    record: {
      id: randomUUID(),
      userId: user.id,
      deliveryChannel,
      target: getPasswordResetTarget(user, deliveryChannel),
      codeHash: hashCode(code),
      attempts: 0,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  };
}

function getPasswordResetTarget(user, deliveryChannel) {
  return deliveryChannel === 'email' ? normalizeEmail(user.email) : normalizePhone(user.phone);
}

function choosePasswordResetDeliveryChannel(user, value) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  const requested =
    normalizedValue === 'telegram' || normalizedValue === 'tg'
      ? 'telegram'
      : normalizedValue === 'max'
        ? 'max'
        : normalizedValue === 'sms'
          ? 'sms'
          : normalizedValue === 'email'
            ? 'email'
            : '';

  if (requested === 'email' && normalizeEmail(user.email)) {
    return 'email';
  }

  if (['max', 'sms', 'telegram'].includes(requested) && normalizePhone(user.phone)) {
    return requested;
  }

  if (normalizeEmail(user.email)) {
    return 'email';
  }

  return normalizePhoneDeliveryChannel(requested || defaultPhoneDeliveryChannel);
}

function maskTarget(target, deliveryChannel) {
  const value = String(target || '');

  if (!value) {
    return '';
  }

  if (deliveryChannel === 'email') {
    const [name, domain] = value.split('@');
    const safeName = name ? `${name.slice(0, 2)}***` : '***';
    return domain ? `${safeName}@${domain}` : safeName;
  }

  const digits = normalizePhone(value);
  return digits.length > 4 ? `***${digits.slice(-4)}` : '***';
}

function addDeliveryEvent(db, event) {
  db.deliveryEvents = [
    {
      id: `delivery-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      ...event,
    },
    ...(Array.isArray(db.deliveryEvents) ? db.deliveryEvents : []),
  ].slice(0, deliveryAuditLimit);
}

async function deliverAuthCode(db, params) {
  const { channel, code, deliveryChannel, purpose, target, user } = params;
  const maskedTarget = maskTarget(target, deliveryChannel);

  if (verificationDeliveryMode !== 'live') {
    const delivery = {
      deliveryMode: 'mvp-returned-code',
      provider: 'demo',
      status: 'created',
    };
    addDeliveryEvent(db, {
      channel,
      deliveryChannel,
      maskedTarget,
      provider: delivery.provider,
      purpose,
      status: delivery.status,
      userId: user.id,
    });
    return delivery;
  }

  try {
    const delivery = await sendProviderAuthCode({
      channel,
      code,
      deliveryChannel,
      purpose,
      target,
      user,
    });
    addDeliveryEvent(db, {
      channel,
      deliveryChannel,
      maskedTarget,
      messageId: delivery.messageId,
      provider: delivery.provider,
      purpose,
      status: 'sent',
      userId: user.id,
    });
    return {
      ...delivery,
      deliveryMode: 'provider-sent',
      status: 'sent',
    };
  } catch (error) {
    addDeliveryEvent(db, {
      channel,
      deliveryChannel,
      error: error instanceof Error ? error.message : 'Delivery failed',
      maskedTarget,
      purpose,
      status: 'failed',
      userId: user.id,
    });
    throw error;
  }
}

async function sendProviderAuthCode(params) {
  const text = makeAuthCodeText(params.purpose, params.code);

  if (params.deliveryChannel === 'email') {
    return sendEmailAuthCode(params.target, text, params.code, params.purpose);
  }

  if (params.deliveryChannel === 'telegram') {
    return sendTelegramAuthCode(params.target, text, params.code, params.purpose, params.user);
  }

  if (params.deliveryChannel === 'max') {
    return sendMaxAuthCode(params.target, text, params.code, params.purpose, params.user);
  }

  return sendSmsAuthCode(params.target, text, params.code, params.purpose);
}

function makeAuthCodeText(purpose, code) {
  if (purpose === 'sms-login') {
    return `Код входа Такси Партнер: ${code}. Никому не сообщайте этот код.`;
  }

  return purpose === 'password-reset'
    ? `Код восстановления пароля Такси Партнер: ${code}. Если это были не вы, не сообщайте код никому.`
    : `Код подтверждения Такси Партнер: ${code}. Никому не сообщайте этот код.`;
}

async function sendSmsAuthCode(target, text, code, purpose) {
  const provider = String(
    process.env.MVP_SMS_PROVIDER ||
      (process.env.MVP_SMSRU_API_ID ? 'smsru' : process.env.MVP_SMS_HTTP_URL ? 'http' : ''),
  ).toLowerCase();

  if (provider === 'smsru') {
    return sendSmsRuAuthCode(target, text);
  }

  if (provider === 'http') {
    return sendGenericHttpDelivery('sms', process.env.MVP_SMS_HTTP_URL, process.env.MVP_SMS_HTTP_TOKEN, {
      code,
      purpose,
      text,
      to: normalizeE164Phone(target),
    });
  }

  throw new Error('SMS provider is not configured');
}

async function sendSmsRuAuthCode(target, text) {
  const apiId = process.env.MVP_SMSRU_API_ID;

  if (!apiId) {
    throw new Error('MVP_SMSRU_API_ID is required');
  }

  const params = new URLSearchParams({
    api_id: apiId,
    json: '1',
    msg: text,
    to: normalizeE164Phone(target),
  });
  const from = String(process.env.MVP_SMS_FROM || '').trim();

  if (from) {
    params.set('from', from);
  }

  const payload = await fetchProviderJson(`https://sms.ru/sms/send?${params.toString()}`, {
    method: 'GET',
  });

  if (payload?.status && payload.status !== 'OK') {
    throw new Error(String(payload.status_text || 'SMS.RU delivery failed'));
  }

  const smsInfo = payload?.sms ? Object.values(payload.sms)[0] : undefined;
  return {
    messageId: smsInfo?.sms_id ? String(smsInfo.sms_id) : undefined,
    provider: 'smsru',
  };
}

async function sendTelegramAuthCode(target, text, code, purpose, user) {
  const provider = String(
    process.env.MVP_TELEGRAM_PROVIDER ||
      (process.env.MVP_TELEGRAM_BOT_TOKEN ? 'botapi' : process.env.MVP_TELEGRAM_HTTP_URL ? 'http' : ''),
  ).toLowerCase();

  if (provider === 'botapi' || provider === 'telegram') {
    return sendTelegramBotApiAuthCode(target, text, user);
  }

  if (provider === 'http') {
    return sendGenericHttpDelivery(
      'telegram',
      process.env.MVP_TELEGRAM_HTTP_URL,
      process.env.MVP_TELEGRAM_HTTP_TOKEN,
      {
        code,
        phone: normalizeE164Phone(target),
        purpose,
        text,
        to: normalizeE164Phone(target),
        userId: user.id,
      },
    );
  }

  throw new Error('Telegram provider is not configured');
}

async function sendTelegramBotApiAuthCode(target, text, user) {
  const botToken = String(process.env.MVP_TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = resolveMessengerRecipient({
    defaultEnvKey: 'MVP_TELEGRAM_CHAT_ID',
    mapEnvKey: 'MVP_TELEGRAM_CHAT_MAP',
    target,
    user,
  });

  if (!botToken || !chatId) {
    throw new Error('MVP_TELEGRAM_BOT_TOKEN and Telegram chat id are required');
  }

  const apiBaseUrl = String(process.env.MVP_TELEGRAM_API_URL || 'https://api.telegram.org')
    .trim()
    .replace(/\/+$/, '');
  const payload = await fetchProviderJson(`${apiBaseUrl}/bot${botToken}/sendMessage`, {
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  if (payload?.ok === false) {
    throw new Error(String(payload.description || 'Telegram delivery failed'));
  }

  return {
    messageId: payload?.result?.message_id ? String(payload.result.message_id) : undefined,
    provider: 'telegram-bot',
  };
}

async function sendMaxAuthCode(target, text, code, purpose, user) {
  const provider = String(
    process.env.MVP_MAX_PROVIDER ||
      (process.env.MVP_MAX_ACCESS_TOKEN
        ? 'platform'
        : process.env.MVP_MAX_HTTP_URL
          ? 'http'
          : ''),
  ).toLowerCase();

  if (provider === 'platform' || provider === 'max') {
    return sendMaxPlatformAuthCode(target, text, user);
  }

  if (provider === 'http') {
    return sendGenericHttpDelivery(
      'max',
      process.env.MVP_MAX_HTTP_URL,
      process.env.MVP_MAX_HTTP_TOKEN,
      {
        code,
        phone: normalizeE164Phone(target),
        purpose,
        text,
        to: normalizeE164Phone(target),
        userId: user.id,
      },
    );
  }

  throw new Error('MAX provider is not configured');
}

async function sendMaxPlatformAuthCode(target, text, user) {
  const accessToken = String(process.env.MVP_MAX_ACCESS_TOKEN || '').trim();
  const userId = resolveMessengerRecipient({
    defaultEnvKey: 'MVP_MAX_USER_ID',
    mapEnvKey: 'MVP_MAX_USER_MAP',
    target,
    user,
  });
  const chatId = userId
    ? ''
    : resolveMessengerRecipient({
        defaultEnvKey: 'MVP_MAX_CHAT_ID',
        mapEnvKey: 'MVP_MAX_CHAT_MAP',
        target,
        user,
      });

  if (!accessToken || (!userId && !chatId)) {
    throw new Error('MVP_MAX_ACCESS_TOKEN and MAX user/chat id are required');
  }

  const params = new URLSearchParams(userId ? { user_id: userId } : { chat_id: chatId });
  const apiBaseUrl = String(process.env.MVP_MAX_API_URL || 'https://platform-api.max.ru')
    .trim()
    .replace(/\/+$/, '');
  const payload = await fetchProviderJson(`${apiBaseUrl}/messages?${params.toString()}`, {
    body: JSON.stringify({
      text,
    }),
    headers: {
      authorization: accessToken,
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  return {
    messageId:
      payload?.message?.body?.mid || payload?.message?.id
        ? String(payload.message.body?.mid || payload.message.id)
        : undefined,
    provider: 'max-platform',
  };
}

function resolveMessengerRecipient({ defaultEnvKey, mapEnvKey, target, user }) {
  const direct = String(process.env[defaultEnvKey] || '').trim();

  if (direct) {
    return direct;
  }

  return findMappedMessengerRecipient(process.env[mapEnvKey], user, target);
}

function findMappedMessengerRecipient(rawValue, user, target) {
  const raw = String(rawValue || '').trim();

  if (!raw) {
    return '';
  }

  const keys = [
    user?.id,
    normalizeEmail(user?.email),
    normalizePhone(user?.phone),
    normalizeE164Phone(user?.phone),
    normalizePhone(target),
    normalizeE164Phone(target),
    String(target || '').trim(),
  ].filter(Boolean);

  try {
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const key of keys) {
        if (parsed[key]) {
          return String(parsed[key]).trim();
        }
      }
    }
  } catch {
    // Comma-separated maps are supported for simple local configuration.
  }

  for (const pair of raw.split(/[\n;,]+/)) {
    const [key, value] = pair.split(/[=:]/).map((item) => item.trim());

    if (key && value && keys.includes(key)) {
      return value;
    }
  }

  return '';
}

async function sendEmailAuthCode(target, text, code, purpose) {
  const provider = String(
    process.env.MVP_EMAIL_PROVIDER ||
      (process.env.MVP_RESEND_API_KEY ? 'resend' : process.env.MVP_EMAIL_HTTP_URL ? 'http' : ''),
  ).toLowerCase();
  const subject =
    purpose === 'password-reset'
      ? 'Код восстановления пароля Такси Партнер'
      : 'Код подтверждения Такси Партнер';

  if (provider === 'resend') {
    return sendResendAuthCode(target, subject, text);
  }

  if (provider === 'http') {
    return sendGenericHttpDelivery('email', process.env.MVP_EMAIL_HTTP_URL, process.env.MVP_EMAIL_HTTP_TOKEN, {
      code,
      from: process.env.MVP_EMAIL_FROM,
      purpose,
      subject,
      text,
      to: target,
    });
  }

  throw new Error('Email provider is not configured');
}

async function sendResendAuthCode(target, subject, text) {
  const apiKey = process.env.MVP_RESEND_API_KEY;
  const from = process.env.MVP_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error('MVP_RESEND_API_KEY and MVP_EMAIL_FROM are required');
  }

  const payload = await fetchProviderJson('https://api.resend.com/emails', {
    body: JSON.stringify({
      from,
      subject,
      text,
      to: [target],
    }),
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  return {
    messageId: payload?.id ? String(payload.id) : undefined,
    provider: 'resend',
  };
}

async function sendGenericHttpDelivery(kind, url, token, payload) {
  if (!url) {
    throw new Error(`${kind.toUpperCase()} HTTP provider URL is not configured`);
  }

  const responsePayload = await fetchProviderJson(url, {
    body: JSON.stringify({
      kind,
      ...payload,
    }),
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  return {
    messageId: responsePayload?.id || responsePayload?.messageId,
    provider: `${kind}-http`,
  };
}

async function fetchProviderJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload;

  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object'
        ? payload.message || payload.error || payload.error_description
        : payload;
    throw new Error(String(message || `Provider request failed: ${response.status}`));
  }

  return payload;
}

function normalizeE164Phone(value) {
  const digits = normalizePhone(value);

  if (digits.length === 11 && digits.startsWith('8')) {
    return `7${digits.slice(1)}`;
  }

  return digits;
}

function markUserContactVerified(user, channel) {
  const now = new Date().toISOString();

  if (channel === 'email') {
    user.emailVerifiedAt = user.emailVerifiedAt || now;
  } else {
    user.phoneVerifiedAt = user.phoneVerifiedAt || now;
  }

  if (isDriverLikeRole(user.role)) {
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
    rewardAmount: isDriverLikeRole(inviteeRole) ? referralRewards.driverReward : referralRewards.clientReward,
    inviteeBonusAmount: isDriverLikeRole(inviteeRole) ? 0 : referralRewards.invitedClientBonus,
    createdAt: now,
    riskFlags: [],
    note:
      isDriverLikeRole(inviteeRole)
        ? `Водитель получит дневной доступ после одобрения; пригласивший получит бонус после первых ${referralRewards.driverQualificationOrders} заказов.`
        : `Пригласивший получит бонус после первых ${referralRewards.clientQualificationOrders} завершенных поездок клиента.`,
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

// Баланс с честным сгоранием: списания гасят начисления по FIFO (старые
// первыми), и сгорает только непотраченный остаток истёкшего начисления.
function calculateBonusBalance(db, userId, at = Date.now()) {
  const entries = db.walletLedger.filter((entry) => entry.userId === userId);
  const credits = entries
    .filter(
      (entry) => Number(entry.amount || 0) > 0 && normalizeWalletStatus(entry.status) === 'available',
    )
    .sort((left, right) => Date.parse(left.createdAt || '') - Date.parse(right.createdAt || ''));
  let debt = entries
    .filter(
      (entry) => Number(entry.amount || 0) < 0 && normalizeWalletStatus(entry.status) === 'used',
    )
    .reduce((sum, entry) => sum - Number(entry.amount), 0);

  let balance = 0;

  for (const credit of credits) {
    const amount = Number(credit.amount || 0);
    const consumed = Math.min(amount, debt);

    debt -= consumed;
    const remaining = amount - consumed;
    const expiresAt = Date.parse(credit.expiresAt || '');
    const expired = Number.isFinite(expiresAt) && expiresAt <= at;

    if (remaining > 0 && !expired) {
      balance += remaining;
    }
  }

  return balance;
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
      // Для реферальных начислений текст причины может отличаться
      // (авто-начисление vs заметка админа) — дедупим по источнику.
      (sourceType === 'referral' || entry.reason === reason) &&
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

// Отменённая поездка не должна съедать бонусы: возвращаем списанное.
// Идемпотентно за счёт дедупа creditWallet по (userId, trip_refund, orderId).
function refundOrderBonus(db, order) {
  const bonusApplied = Number(order.bonusApplied || 0);

  if (!bonusApplied || !order.userId || order.bonusRefundedAt) {
    return;
  }

  const refunded = creditWallet(
    db,
    order.userId,
    bonusApplied,
    `Возврат бонусов за отменённый заказ ${order.id}`,
    'trip_refund',
    order.id,
  );

  if (refunded) {
    order.bonusRefundedAt = new Date().toISOString();
  }
}

function createInviteUrl(code, role) {
  const normalizedRole = normalizeRole(role);
  const roleParam = ['client', 'self_employed_driver', 'park_admin', 'park_driver'].includes(normalizedRole)
    ? `?role=${normalizedRole}`
    : '';

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
    (order) =>
      order.driver?.id === driver.id &&
      ['closed', 'completed'].includes(order.status) &&
      !order.isTestOrder &&
      !order.disputeStatus,
  ).length;
}

function getReferralProgress(db, referral) {
  const requiredOrders =
    isDriverLikeRole(referral.inviteeRole)
      ? referralRewards.driverQualificationOrders
      : referralRewards.clientQualificationOrders;
  const actualCompletedOrders =
    isDriverLikeRole(referral.inviteeRole)
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
      driver: createInviteUrl(code, 'self_employed_driver'),
      self_employed_driver: createInviteUrl(code, 'self_employed_driver'),
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

function calculateMarketingLevel(points) {
  const total = Number(points || 0);
  return marketingLevels.find((level) => total >= level.min && total <= level.max) || marketingLevels[0];
}

function publicMarketingLevel(level) {
  return {
    coefficient: level.coefficient,
    id: level.id,
    name: level.name,
    range: level.range,
  };
}

function makeMarketingInviteCode() {
  return normalizeReferralCode(`MKT${randomUUID().slice(0, 8)}`);
}

function findMarketingPartnerByCode(db, code) {
  const normalizedCode = normalizeReferralCode(code);

  if (!normalizedCode) {
    return undefined;
  }

  return db.marketingPartners.find((partner) => normalizeReferralCode(partner.inviteCode) === normalizedCode);
}

function getMarketingPartnerForUser(db, userId) {
  return db.marketingPartners.find((partner) => partner.userId === userId);
}

function ensureMarketingPartnerForUser(db, user, payload = {}) {
  let partner = getMarketingPartnerForUser(db, user.id);

  if (partner) {
    return partner;
  }

  const inviteCode = ensureUserReferralCode(user, db.users);
  partner = normalizeMarketingPartner({
    email: user.email,
    id: `mp-${user.id}`,
    inviteCode,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.phone || user.email,
    phone: user.phone,
    status: 'active',
    userId: user.id,
    ...payload,
  });
  db.marketingPartners.unshift(partner);
  return partner;
}

function applyMarketingPointMultiplier(partner, basePoints) {
  let remaining = Math.max(0, Number(basePoints || 0));
  let cursor = Math.max(0, Number(partner.baseEarnedPoints || 0));
  let points = 0;
  const tiers = [
    { limit: 3000, coefficient: 1 },
    { limit: 10000, coefficient: 2 },
    { limit: Infinity, coefficient: 3 },
  ];

  for (const tier of tiers) {
    if (!remaining) {
      break;
    }

    const available = tier.limit === Infinity ? remaining : Math.max(0, tier.limit - cursor);
    const chunk = Math.min(remaining, available);

    points += chunk * tier.coefficient;
    cursor += chunk;
    remaining -= chunk;
  }

  partner.baseEarnedPoints = Math.max(0, Number(partner.baseEarnedPoints || 0)) + basePoints;
  return Math.round(points);
}

function creditMarketingPoints(db, partner, actionInput) {
  if (!partner || partner.status === 'blocked') {
    return undefined;
  }

  const sourceId = String(actionInput.sourceId || '').trim();
  const type = String(actionInput.type || 'manual');

  if (
    sourceId &&
    db.marketingActions.some((action) => action.marketerId === partner.id && action.type === type && action.sourceId === sourceId)
  ) {
    return undefined;
  }

  const previousLevel = calculateMarketingLevel(partner.totalEarnedPoints);
  const basePoints = Math.max(0, Number(actionInput.basePoints || 0));
  const points = Number.isFinite(actionInput.points)
    ? Math.max(0, Number(actionInput.points))
    : applyMarketingPointMultiplier(partner, basePoints);
  const now = new Date().toISOString();
  const action = normalizeMarketingAction({
    ...actionInput,
    basePoints,
    confirmedAt: actionInput.confirmedAt || now,
    createdAt: actionInput.createdAt || now,
    marketerId: partner.id,
    points,
    status: actionInput.status || 'rewarded',
  });

  db.marketingActions.unshift(action);
  partner.balancePoints = Math.max(0, Number(partner.balancePoints || 0)) + action.points;
  partner.totalEarnedPoints = Math.max(0, Number(partner.totalEarnedPoints || 0)) + action.points;
  partner.levelId = calculateMarketingLevel(partner.totalEarnedPoints).id;
  partner.updatedAt = now;

  const nextLevel = calculateMarketingLevel(partner.totalEarnedPoints);
  if (nextLevel.id !== previousLevel.id) {
    addRealtimeNotification(db, {
      audience: 'all',
      body: `${partner.name} перешел на уровень "${nextLevel.name}".`,
      kind: 'marketing_level_up',
      title: 'Новый уровень Победных Очков',
      userId: partner.userId,
    });
  }

  return action;
}

function getMarketingInviteUrls(partner) {
  return {
    client: createInviteUrl(partner.inviteCode, 'client'),
    driver: createInviteUrl(partner.inviteCode, 'self_employed_driver'),
    location: `${inviteBaseUrl}/${encodeURIComponent(partner.inviteCode)}?role=client&source=location`,
  };
}

function makeMarketingDashboard(db, partner) {
  const user = db.users.find((item) => item.id === partner.userId);
  const normalizedPartner = normalizeMarketingPartner({
    ...partner,
    email: partner.email || user?.email,
    name: partner.name || getUserDisplayName(user),
    phone: partner.phone || user?.phone,
  });
  const level = calculateMarketingLevel(normalizedPartner.totalEarnedPoints);

  Object.assign(partner, normalizedPartner, { levelId: level.id });

  return {
    actions: db.marketingActions
      .filter((action) => action.marketerId === partner.id)
      .map(normalizeMarketingAction),
    invited: db.referrals
      .filter((referral) => referral.marketerId === partner.id)
      .map((referral) => decorateReferral(db, referral, partner.userId)),
    locations: db.marketingLocations
      .filter((location) => location.marketerId === partner.id)
      .map(normalizeMarketingLocation),
    partner: {
      ...partner,
      inviteUrls: getMarketingInviteUrls(partner),
      level: publicMarketingLevel(level),
    },
  };
}

function settleMarketingForOrder(db, order) {
  if (!['closed', 'completed'].includes(order.status)) {
    return;
  }

  const driver = order.driver?.id ? db.drivers.find((item) => item.id === order.driver.id) : undefined;
  const referral = driver?.userId
    ? db.referrals.find((item) => item.inviteeUserId === driver.userId && item.marketerId)
    : undefined;
  const partner = referral ? db.marketingPartners.find((item) => item.id === referral.marketerId) : undefined;

  if (!driver || !referral || !partner) {
    return;
  }

  const completedOrders = db.orders.filter(
    (item) => item.driver?.id === driver.id && ['closed', 'completed'].includes(item.status),
  ).length;

  if (completedOrders === 5) {
    creditMarketingPoints(db, partner, {
      basePoints: 500,
      description: `500 ПО за 5 выполненных заказов приглашенного водителя ${driver.name}.`,
      sourceId: `${driver.id}:orders:5`,
      type: 'driver_5_orders',
    });
  }

  if (completedOrders >= 6 && completedOrders <= 20) {
    const netProfit = Number(order.kinetixProfit || order.platformProfit || order.serviceFee || 0);
    const basePoints = Math.max(0, Math.round(netProfit * 0.1));

    if (basePoints > 0) {
      creditMarketingPoints(db, partner, {
        basePoints,
        description: `10% от чистой прибыли Kinetix по поездке ${order.id}.`,
        sourceId: `${order.id}:driver_profit_share`,
        type: 'driver_profit_share',
      });
    }
  }

  if (completedOrders === 20) {
    creditMarketingPoints(db, partner, {
      basePoints: 200,
      description: `200 ПО за 20-й заказ приглашенного водителя ${driver.name}.`,
      sourceId: `${driver.id}:orders:20`,
      type: 'driver_20_orders',
    });
  }
}

function recordMarketingInstall(db, payload) {
  const qrCodeId = String(payload.qrCodeId || payload.qr || '').trim();
  const deviceId = String(payload.deviceId || payload.fingerprint || '').trim();
  const sourceType = String(payload.sourceType || 'client_qr');

  if (!qrCodeId || !deviceId) {
    throw new Error('qrCodeId and deviceId are required');
  }

  const existing = db.marketingInstalls.find(
    (install) => install.qrCodeId === qrCodeId && install.deviceId === deviceId,
  );

  if (existing) {
    return { duplicate: true, install: existing };
  }

  const location = db.marketingLocations.find((item) => item.qrCodeId === qrCodeId);
  const partner =
    db.marketingPartners.find((item) => item.inviteCode === qrCodeId || item.id === payload.marketerId) ||
    (location ? db.marketingPartners.find((item) => item.id === location.marketerId) : undefined);

  if (!partner) {
    throw new Error('Marketing partner not found for QR code');
  }

  const install = normalizeMarketingInstall({
    deviceId,
    marketerId: partner.id,
    qrCodeId,
    sourceId: location?.id || partner.id,
    sourceType: location ? 'location_qr' : sourceType,
  });
  db.marketingInstalls.unshift(install);

  if (location) {
    location.installs = Number(location.installs || 0) + 1;
    location.updatedAt = new Date().toISOString();
    creditMarketingPoints(db, partner, {
      basePoints: 5,
      description: `5 ПО за установку с QR точки "${location.title}".`,
      sourceId: `${install.id}:location_install`,
      type: 'location_install',
    });
  } else {
    const partnerInstalls = db.marketingInstalls.filter(
      (item) => item.marketerId === partner.id && item.sourceType === sourceType,
    ).length;
    const thresholdBonus = partnerInstalls % 10 === 0 ? 100 : 0;

    creditMarketingPoints(db, partner, {
      basePoints: 5 + thresholdBonus,
      description:
        thresholdBonus > 0
          ? '5 ПО за установку и 100 ПО за каждые 10 уникальных установок.'
          : '5 ПО за уникальную установку по QR-коду.',
      sourceId: `${install.id}:client_install`,
      type: 'client_install',
    });
  }

  return { duplicate: false, install };
}

function createMarketingLocation(db, payload) {
  const marketerId = String(payload.marketerId || '').trim();
  const partner = db.marketingPartners.find((item) => item.id === marketerId || item.userId === marketerId);

  if (!partner) {
    throw new Error('Marketing partner not found');
  }

  const location = normalizeMarketingLocation({
    ...payload,
    id: `mloc-${randomUUID().slice(0, 10)}`,
    marketerId: partner.id,
    qrCodeId: payload.qrCodeId || `LOC${randomUUID().slice(0, 8).toUpperCase()}`,
  });
  db.marketingLocations.unshift(location);
  return location;
}

function confirmMarketingLocation(db, locationId, payload = {}) {
  const location = db.marketingLocations.find((item) => item.id === locationId);

  if (!location) {
    throw new Error('Marketing location not found');
  }

  location.contractStatus = marketingContractStatuses.includes(payload.contractStatus)
    ? payload.contractStatus
    : 'confirmed';
  location.contractConfirmedAt =
    location.contractStatus === 'confirmed' ? new Date().toISOString() : location.contractConfirmedAt;
  location.updatedAt = new Date().toISOString();

  if (location.contractStatus === 'confirmed') {
    const partner = db.marketingPartners.find((item) => item.id === location.marketerId);
    creditMarketingPoints(db, partner, {
      basePoints: 300,
      description: `300 ПО за подтвержденный договор с точкой "${location.title}".`,
      sourceId: `${location.id}:contract`,
      type: 'location_contract',
    });
  }

  return location;
}

function confirmMarketingPost(db, payload) {
  const marketerId = String(payload.marketerId || '').trim();
  const partner = db.marketingPartners.find((item) => item.id === marketerId || item.userId === marketerId);
  const likes = Number(payload.likes || 0);
  const reposts = Number(payload.reposts || payload.shares || 0);
  const sourceId = String(payload.sourceId || payload.url || `post-${randomUUID().slice(0, 8)}`);

  if (!partner) {
    throw new Error('Marketing partner not found');
  }

  if (likes < 30 || reposts < 10) {
    throw new Error('Post does not meet viral thresholds');
  }

  return creditMarketingPoints(db, partner, {
    basePoints: 200,
    description: '200 ПО за вирусный пост.',
    metadata: { likes, reposts, url: payload.url },
    sourceId,
    type: 'viral_post',
  });
}

function payMarketingPartnerBalance(db, partnerId, amountPoints) {
  const partner = db.marketingPartners.find((item) => item.id === partnerId || item.userId === partnerId);

  if (!partner) {
    throw new Error('Marketing partner not found');
  }

  const amount = Math.min(
    Math.max(0, Number(amountPoints || partner.balancePoints || 0)),
    Number(partner.balancePoints || 0),
  );

  if (!amount) {
    throw new Error('Marketing partner balance is empty');
  }

  partner.balancePoints = Number(partner.balancePoints || 0) - amount;
  partner.paidOutPoints = Number(partner.paidOutPoints || 0) + amount;
  partner.updatedAt = new Date().toISOString();

  db.marketingActions
    .filter((action) => action.marketerId === partner.id && action.status === 'rewarded')
    .forEach((action) => {
      action.status = 'paid';
      action.paidAt = partner.updatedAt;
    });

  db.marketingActions.unshift(
    normalizeMarketingAction({
      basePoints: 0,
      description: `Выплата ${amount} ПО маркетологу.`,
      marketerId: partner.id,
      points: -amount,
      sourceId: `payout-${Date.now().toString(36)}`,
      status: 'paid',
      type: 'payout',
    }),
  );

  return partner;
}

function accrueMonthlyMarketingLocationBonuses(db, now = new Date()) {
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let rewarded = 0;

  for (const location of db.marketingLocations) {
    if (Number(location.installs || 0) < 50 || location.lastMonthlyBonusAt === monthKey) {
      continue;
    }

    const partner = db.marketingPartners.find((item) => item.id === location.marketerId);
    const action = creditMarketingPoints(db, partner, {
      basePoints: 150,
      description: `150 ПО за топ-точку "${location.title}" с 50+ установками за месяц.`,
      sourceId: `${location.id}:monthly:${monthKey}`,
      type: 'location_monthly_top',
    });

    if (action) {
      location.lastMonthlyBonusAt = monthKey;
      rewarded += 1;
    }
  }

  return rewarded;
}

function attachReferral(db, invitee, rawCode) {
  const code = normalizeReferralCode(rawCode);
  const inviter = findUserByReferralCode(db.users, code);
  const marketingPartner = findMarketingPartnerByCode(db, code);

  if ((!inviter && !marketingPartner) || inviter?.id === invitee.id) {
    return;
  }

  invitee.referredByCode = code;
  const referral = makeReferral(inviter || { id: marketingPartner.userId, role: 'marketer' }, invitee, code);
  if (marketingPartner) {
    referral.marketerId = marketingPartner.id;
  }
  db.referrals.unshift(referral);
  addReferralAudit(db, referral.id, 'created', invitee.id, `Регистрация по коду ${code}`);

  if (invitee.role === 'client' && referralRewards.invitedClientBonus > 0) {
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

  // Уже выплачено — повторное «Начислено» (в т.ч. из админки с другой
  // заметкой) не должно создавать второе начисление.
  if (referral.status === 'rewarded') {
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

  const completedOrders = countClientCompletedOrders(db, order.userId);

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
          isDriverLikeRole(item.inviteeRole) &&
          !['blocked', 'rewarded'].includes(item.status),
      )
    : undefined;

  if (!driver || !referral) {
    return;
  }

  const completedOrders = countDriverCompletedOrders(db, driver.userId);

  if (completedOrders < referralRewards.driverQualificationOrders) {
    // Статус не понижаем: ручной «qualified» от админа не должен
    // перетираться очередной поездкой ниже порога.
    addReferralAudit(db, referral.id, 'progress', 'system', `Прогресс водителя: ${completedOrders}/${referralRewards.driverQualificationOrders}`);
    return;
  }

  referral.status = 'qualified';
  referral.qualifiedAt = referral.qualifiedAt || new Date().toISOString();
  referral.note = `Готов к начислению: водитель выполнил ${completedOrders}/${referralRewards.driverQualificationOrders} поездок.`;
  addReferralAudit(db, referral.id, 'qualified', 'system', referral.note);
}

function makeDriverFromUser(user, payload, options = {}) {
  const employmentType = options.employmentType || (isParkDriverRole(user.role) ? 'park_driver' : 'self_employed');
  const isParkDriver = employmentType === 'park_driver';
  const billingMode = isParkDriver ? 'monthly' : 'daily';
  return {
    id: `driver-${user.id}`,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Водитель',
    phone: user.phone,
    rating: 5,
    vehicle: [payload.carBrand, payload.carModel].filter(Boolean).join(' '),
    plate: String(payload.carPlate || ''),
    status: 'pending',
    isOnline: false,
    billingMode,
    driverTariff: getDriverAccessPlan(billingMode).name,
    subscriptionPlan: getDriverSubscriptionPlanId(billingMode),
    subscriptionStatus: isParkDriver ? 'active' : 'inactive',
    canReceiveOrders: false,
    contractStatus: 'pending',
    documentsStatus: 'pending',
    registryStatus: 'pending',
    taxProfileStatus: 'pending',
    vehiclePermitStatus: 'pending',
    employmentType,
    parkDriverStatus: isParkDriver ? 'invited' : undefined,
    parkId: options.parkId,
    vehicleDocumentsReady: String(payload.vehicleDocumentsReady || ''),
    // Реквизиты водителя, куда клиент переводит оплату за поездку напрямую.
    payoutAccount: String(payload.payoutAccount || payload.fleetPayoutAccount || '').trim(),
    userId: user.id,
    updatedAt: new Date().toISOString(),
  };
}

function makeParkFromUser(user, payload) {
  const now = new Date().toISOString();
  return normalizePark({
    id: `park-${user.id}`,
    organisationName: payload.companyName || payload.organisationName,
    inn: payload.inn,
    ogrn: payload.ogrn,
    legalAddress: payload.legalAddress,
    contactPhone: payload.fleetContact || user.phone,
    settlementAccount: payload.fleetPayoutAccount || payload.settlementAccount,
    ownerUserId: user.id,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
}

function makeParkDriverLink({ user, driver, invite, parkId, invitedByUserId = '' }) {
  const now = new Date().toISOString();
  return normalizeParkDriver({
    id: `park-driver-${user.id}`,
    userId: user.id,
    driverId: driver.id,
    parkId,
    inviteCode: invite?.inviteCode || '',
    invitedAt: invite?.invitedAt || now,
    invitedByUserId: invite?.invitedByUserId || invitedByUserId,
    status: 'invited',
    createdAt: now,
    updatedAt: now,
  });
}

function findParkDriverInvite(db, code) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) {
    return undefined;
  }

  return db.parkDrivers.find(
    (item) => item.inviteCode === normalizedCode && item.status === 'invited' && !item.userId,
  );
}

function makeParkInviteCode(park) {
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  const prefix = String(park.inn || park.id || 'PARK').replace(/\D/g, '').slice(-4) || 'PARK';
  return `PARK-${prefix}-${suffix}`;
}

function getOpenParkInvites(db, parkId) {
  return db.parkDrivers.filter((item) => item.parkId === parkId && item.status === 'invited' && !item.userId);
}

function getParkDriverProfiles(db, parkId) {
  const links = db.parkDrivers.filter((item) => item.parkId === parkId && item.driverId);
  return links
    .map((link) => {
      const driver = db.drivers.find((item) => item.id === link.driverId || item.userId === link.userId);
      if (!driver) {
        return undefined;
      }
      driver.parkDriverStatus = link.status;
      driver.parkId = parkId;
      applyDriverAccessState(driver);
      applyParkDriverAccessState(driver, db);
      return driver;
    })
    .filter(Boolean);
}

function getParkSubscriptionSummary(park) {
  const expiresAt = Date.parse(park.subscriptionExpiresAt || '');
  const active = park.status === 'active' && Number.isFinite(expiresAt) && expiresAt > Date.now();
  return {
    amount: parkAccessPlan.monthlyPrice,
    commissionPercent: 0,
    expiresAt: park.subscriptionExpiresAt,
    status: active ? 'active' : 'expired',
    type: 'park_monthly',
  };
}

function normalizeDriver(driver) {
  const billingMode = normalizeBillingMode(driver.billingMode);
  const subscriptionExpiresAt = driver.subscriptionExpiresAt || driver.accessExpiresAt;
  const plan = getDriverAccessPlan(billingMode);
  const subscriptionStatus = normalizeDriverSubscriptionStatus(driver);
  const workMode =
    billingMode === 'monthly' && subscriptionStatus === 'active'
      ? 'partner_pro'
      : 'daily';
  const normalizedDriver = {
    ...driver,
    billingMode,
    contractStatus: normalizeDriverContractStatus(driver.contractStatus),
    documentReview: normalizeDriverDocumentReview(driver.documentReview, driver.documentsStatus),
    documentUploads: normalizeDriverDocumentUploads(driver.documentUploads),
    documentsStatus: normalizeDriverComplianceStatus(driver.documentsStatus, driver),
    driverTariff: plan.name,
    registryStatus: normalizeDriverRegistryStatus(driver.registryStatus, driver),
    subscriptionExpiresAt: subscriptionExpiresAt ? String(subscriptionExpiresAt) : undefined,
    subscriptionPlan: getDriverSubscriptionPlanId(billingMode),
    subscriptionStatus,
    taxProfileStatus: normalizeDriverComplianceStatus(driver.taxProfileStatus, driver),
    vehiclePermitStatus: normalizeDriverComplianceStatus(driver.vehiclePermitStatus, driver),
    workMode,
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
    checksum: typeof upload.checksum === 'string' ? upload.checksum : undefined,
    expiresAt: typeof upload.expiresAt === 'string' ? upload.expiresAt : undefined,
    fileName: sanitizeFileName(upload.fileName || `${kind}.jpg`),
    fileSize: Math.max(0, Number(upload.fileSize || 0)),
    height: Math.max(0, Number(upload.height || 0)),
    kind,
    mimeType: normalizeImageMimeType(upload.mimeType),
    rejectionReason: typeof upload.rejectionReason === 'string' ? upload.rejectionReason : undefined,
    reviewedAt: typeof upload.reviewedAt === 'string' ? upload.reviewedAt : undefined,
    reviewedBy: normalizeDocumentActor(upload.reviewedBy),
    source: upload.source === 'camera' ? 'camera' : 'library',
    status: driverComplianceStatusValues.includes(upload.status) ? upload.status : 'pending',
    storageKey: typeof upload.storageKey === 'string' ? upload.storageKey : undefined,
    uploadedAt: typeof upload.uploadedAt === 'string' ? upload.uploadedAt : new Date().toISOString(),
    width: Math.max(0, Number(upload.width || 0)),
  };
}

function normalizeDocumentActor(value) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const id = String(value.id || '').trim();
  const role = String(value.role || '').trim();

  if (!id || !role) {
    return undefined;
  }

  return {
    id,
    name: String(value.name || ''),
    role,
  };
}

function normalizeDriverDocumentReview(value, fallbackStatus = 'missing') {
  const statusFallback = driverDocumentReviewStatuses.includes(fallbackStatus) ? fallbackStatus : 'missing';

  if (!value || typeof value !== 'object') {
    return {
      rejectedKinds: [],
      status: statusFallback,
    };
  }

  return {
    note: typeof value.note === 'string' ? value.note : '',
    reason: typeof value.reason === 'string' ? value.reason : '',
    rejectedKinds: Array.isArray(value.rejectedKinds)
      ? value.rejectedKinds.filter((kind) => driverDocumentKinds.includes(kind))
      : [],
    reviewedAt: typeof value.reviewedAt === 'string' ? value.reviewedAt : undefined,
    reviewedBy: normalizeDocumentActor(value.reviewedBy),
    status: driverDocumentReviewStatuses.includes(value.status) ? value.status : 'missing',
    submittedAt: typeof value.submittedAt === 'string' ? value.submittedAt : undefined,
    submittedBy: normalizeDocumentActor(value.submittedBy),
  };
}

function normalizeDriverDocumentAuditEntry(entry) {
  const action = driverDocumentReviewActions.includes(entry?.action) ? entry.action : 'uploaded';

  return {
    action,
    actor: normalizeDocumentActor(entry?.actor) || {
      id: 'system',
      name: 'Система',
      role: 'system',
    },
    createdAt: typeof entry?.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
    driverId: String(entry?.driverId || ''),
    driverName: String(entry?.driverName || ''),
    id: String(entry?.id || `dda-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`),
    kinds: Array.isArray(entry?.kinds)
      ? entry.kinds.filter((kind) => driverDocumentKinds.includes(kind))
      : [],
    note: String(entry?.note || ''),
    reason: String(entry?.reason || ''),
    status: driverDocumentReviewStatuses.includes(entry?.status) ? entry.status : 'pending',
    userId: String(entry?.userId || ''),
  };
}

function addDriverDocumentAudit(db, driver, action, actor, details = {}) {
  const entry = normalizeDriverDocumentAuditEntry({
    action,
    actor,
    createdAt: new Date().toISOString(),
    driverId: driver.id,
    driverName: driver.name,
    id: `dda-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    kinds: details.kinds,
    note: details.note,
    reason: details.reason,
    status: details.status,
    userId: driver.userId,
  });

  db.driverDocumentAudit = Array.isArray(db.driverDocumentAudit) ? db.driverDocumentAudit : [];
  db.driverDocumentAudit.unshift(entry);
  db.driverDocumentAudit = db.driverDocumentAudit.slice(0, 500);
  return entry;
}

function getDriverDocumentAudit(db, driverId) {
  return (Array.isArray(db.driverDocumentAudit) ? db.driverDocumentAudit : [])
    .filter((entry) => entry.driverId === driverId)
    .map(normalizeDriverDocumentAuditEntry)
    .slice(0, 30);
}

function sanitizeDriverDocumentUploadForSession(upload, sessionContext) {
  const sanitizedUpload = { ...upload };

  if (!isAdminSession(sessionContext)) {
    delete sanitizedUpload.storageKey;
  }

  return sanitizedUpload;
}

function makeDriverResponse(db, driver, sessionContext) {
  const normalizedDriver = normalizeDriver(driver);

  if (!canAccessDriver(sessionContext, normalizedDriver)) {
    const { documentAudit, documentReview, documentUploads, phone, userId, ...publicDriver } = normalizedDriver;
    return publicDriver;
  }

  return {
    ...normalizedDriver,
    documentAudit: getDriverDocumentAudit(db, normalizedDriver.id),
    documentUploads: Object.fromEntries(
      Object.entries(normalizedDriver.documentUploads || {}).map(([kind, upload]) => [
        kind,
        sanitizeDriverDocumentUploadForSession(upload, sessionContext),
      ]),
    ),
  };
}

async function applyDriverDocumentUploads(db, driver, payload, actor) {
  const now = new Date().toISOString();
  const currentUploads = normalizeDriverDocumentUploads(driver.documentUploads);
  const documents = Array.isArray(payload.documents) ? payload.documents : [];

  if (!documents.length) {
    throw new Error('documents are required');
  }

  // Сначала валидируем и декодируем всю пачку, и только потом пишем на диск:
  // ошибка в любом документе отклоняет запрос целиком, без осиротевших файлов
  // и наполовину обновлённого водителя.
  const preparedDocuments = documents.map((item) => {
    const kind = normalizeDriverDocumentKind(item.kind);
    const mimeType = normalizeImageMimeType(item.mimeType);

    return {
      fileBuffer: decodeDocumentImage(item.base64, mimeType),
      fileName: sanitizeFileName(item.fileName || `${kind}${getImageExtension(mimeType)}`),
      height: Math.max(0, Number(item.height || 0)),
      kind,
      mimeType,
      source: item.source === 'camera' ? 'camera' : 'library',
      width: Math.max(0, Number(item.width || 0)),
    };
  });

  const duplicateKind = preparedDocuments.find(
    (item, index) => preparedDocuments.findIndex((other) => other.kind === item.kind) !== index,
  );

  if (duplicateKind) {
    throw new Error(`Duplicate document kind in batch: ${duplicateKind.kind}`);
  }

  const replacedStorageKeys = [];

  for (const item of preparedDocuments) {
    const previousStorageKey = currentUploads[item.kind]?.storageKey;
    const storageKey = await writeDriverDocumentFile(driver.id, item.kind, item.mimeType, item.fileBuffer);

    if (previousStorageKey && previousStorageKey !== storageKey) {
      replacedStorageKeys.push(previousStorageKey);
    }

    currentUploads[item.kind] = {
      checksum: hashBuffer(item.fileBuffer),
      fileName: item.fileName,
      fileSize: item.fileBuffer.length,
      height: item.height,
      kind: item.kind,
      mimeType: item.mimeType,
      source: item.source,
      status: 'pending',
      storageKey,
      uploadedAt: now,
      width: item.width,
    };
  }

  // Заменённые файлы удаляем в фоне: неудача чистки не должна ронять загрузку.
  void removeDriverDocumentFiles(replacedStorageKeys);

  driver.documentUploads = currentUploads;
  driver.documentReview = {
    rejectedKinds: [],
    status: 'pending',
    submittedAt: now,
    submittedBy: actor,
  };
  driver.documentsStatus = 'pending';

  if (currentUploads.sts || currentUploads.osago || currentUploads.osgop) {
    driver.vehiclePermitStatus = 'pending';
  }

  addDriverDocumentAudit(db, driver, 'uploaded', actor, {
    kinds: documents.map((item) => normalizeDriverDocumentKind(item.kind)),
    note: String(payload.note || ''),
    status: 'pending',
  });

  return applyDriverAccessState(driver);
}

function applyDriverDocumentReview(db, driver, payload, actor) {
  const status = driverDocumentReviewStatuses.includes(payload.status) ? payload.status : '';

  if (!['approved', 'pending', 'rejected'].includes(status)) {
    throw new Error('Unsupported document review status');
  }

  const now = new Date().toISOString();
  const currentUploads = normalizeDriverDocumentUploads(driver.documentUploads);
  const uploadedKinds = driverDocumentKinds.filter((kind) => currentUploads[kind]);
  const requestedRejectedKinds = Array.isArray(payload.rejectedKinds)
    ? payload.rejectedKinds.map(normalizeDriverDocumentKind)
    : [];
  const rejectedKinds =
    status === 'rejected'
      ? requestedRejectedKinds.length
        ? requestedRejectedKinds
        : uploadedKinds
      : [];
  const reason = String(payload.reason || '').trim();
  const note = String(payload.note || '').trim();

  if (status === 'approved') {
    const missingKinds = driverDocumentKinds.filter((kind) => !currentUploads[kind]);

    if (missingKinds.length) {
      throw new Error(`Cannot approve documents before all files are uploaded: ${missingKinds.join(', ')}`);
    }
  }

  if (status === 'rejected' && reason.length < 3) {
    throw new Error('Rejection reason is required');
  }

  for (const kind of uploadedKinds) {
    const upload = currentUploads[kind];

    if (status === 'approved') {
      currentUploads[kind] = {
        ...upload,
        rejectionReason: undefined,
        reviewedAt: now,
        reviewedBy: actor,
        status: 'approved',
      };
      continue;
    }

    if (status === 'rejected' && rejectedKinds.includes(kind)) {
      currentUploads[kind] = {
        ...upload,
        rejectionReason: reason,
        reviewedAt: now,
        reviewedBy: actor,
        status: 'rejected',
      };
      continue;
    }

    if (status === 'pending') {
      currentUploads[kind] = {
        ...upload,
        rejectionReason: undefined,
        reviewedAt: undefined,
        reviewedBy: undefined,
        status: 'pending',
      };
    }
  }

  driver.documentUploads = currentUploads;
  driver.documentReview = {
    note,
    reason,
    rejectedKinds,
    reviewedAt: status === 'pending' ? undefined : now,
    reviewedBy: status === 'pending' ? undefined : actor,
    status,
    submittedAt: driver.documentReview?.submittedAt,
    submittedBy: normalizeDocumentActor(driver.documentReview?.submittedBy),
  };
  driver.documentsStatus = status;

  if (status === 'approved') {
    driver.vehiclePermitStatus = 'approved';
  }

  if (status === 'rejected' && rejectedKinds.some((kind) => ['sts', 'osago', 'osgop'].includes(kind))) {
    driver.vehiclePermitStatus = 'rejected';
  }

  addDriverDocumentAudit(db, driver, status === 'pending' ? 'reset' : status, actor, {
    kinds: status === 'approved' ? uploadedKinds : rejectedKinds,
    note,
    reason,
    status,
  });

  return applyDriverAccessState(driver);
}

function normalizeDriverDocumentKind(value) {
  const kind = String(value || '').trim();

  if (!driverDocumentKinds.includes(kind)) {
    throw new Error('Unsupported document type');
  }

  return kind;
}

function decodeDocumentImage(value, mimeType) {
  let rawValue = String(value || '').trim();
  const dataUriMatch = rawValue.match(/^data:([^;]+);base64,(.+)$/i);

  if (dataUriMatch) {
    const declaredMimeType = normalizeImageMimeType(dataUriMatch[1]);

    if (declaredMimeType !== normalizeImageMimeType(mimeType)) {
      throw new Error('Image MIME type mismatch');
    }

    rawValue = dataUriMatch[2];
  }

  const normalizedBase64 = rawValue.replace(/\s+/g, '');

  if (!normalizedBase64) {
    throw new Error('Image data is required');
  }

  const fileBuffer = Buffer.from(normalizedBase64, 'base64');

  if (!fileBuffer.length) {
    throw new Error('Image data is empty');
  }

  if (fileBuffer.length > 5_000_000) {
    throw new Error('Image file is too large');
  }

  return fileBuffer;
}

async function writeDriverDocumentFile(driverId, kind, mimeType, fileBuffer) {
  const safeDriverId = sanitizeStorageSegment(driverId) || 'driver';
  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${kind}${getImageExtension(mimeType)}`;
  const relativeStorageKey = `${safeDriverId}/${fileName}`;
  const storageRoot = resolve(documentStoragePath);
  const targetPath = resolve(storageRoot, safeDriverId, fileName);

  if (!isPathInside(storageRoot, targetPath)) {
    throw new Error('Document storage path is invalid');
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, fileBuffer);
  await chmod(targetPath, 0o600).catch(() => undefined);

  return relativeStorageKey;
}

async function readDriverDocumentFile(upload) {
  if (!upload?.storageKey) {
    return null;
  }

  const storageRoot = resolve(documentStoragePath);
  const targetPath = resolve(storageRoot, upload.storageKey);

  if (!isPathInside(storageRoot, targetPath)) {
    throw new Error('Document storage path is invalid');
  }

  return readFile(targetPath);
}

async function removeDriverDocumentFiles(storageKeys) {
  const storageRoot = resolve(documentStoragePath);

  for (const storageKey of storageKeys) {
    const targetPath = resolve(storageRoot, storageKey);

    if (!isPathInside(storageRoot, targetPath)) {
      continue;
    }

    await rm(targetPath, { force: true }).catch(() => undefined);
  }
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
  const expiresAt = Date.parse(driver.subscriptionExpiresAt || driver.accessExpiresAt || '');

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

  const isParkDriver = driver.employmentType === 'park_driver' || Boolean(driver.parkId);

  if (!isParkDriver && driver.subscriptionStatus !== 'active') {
    blockers.push('paid_access');
  }

  if (isParkDriver && driver.parkDriverStatus && driver.parkDriverStatus !== 'active') {
    blockers.push('park_driver_status');
  }

  if (isParkDriver && driver.parkSubscriptionStatus && driver.parkSubscriptionStatus !== 'active') {
    blockers.push('park_subscription');
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

function applyParkDriverAccessState(driver, db) {
  if (!(driver.employmentType === 'park_driver' || driver.parkId)) {
    return driver;
  }

  const link = db.parkDrivers.find((item) => item.driverId === driver.id || item.userId === driver.userId);
  const park = db.parks.find((item) => item.id === (driver.parkId || link?.parkId));
  const expiresAt = Date.parse(park?.subscriptionExpiresAt || '');
  const parkSubscriptionActive =
    park?.status === 'active' && Number.isFinite(expiresAt) && expiresAt > Date.now();

  driver.parkId = park?.id || link?.parkId || driver.parkId;
  driver.parkName = park?.organisationName;
  driver.parkDriverStatus = link?.status || driver.parkDriverStatus || 'invited';
  driver.parkSubscriptionStatus = parkSubscriptionActive ? 'active' : 'expired';
  driver.subscriptionStatus = parkSubscriptionActive ? 'active' : 'expired';
  driver.accessBlockers = getDriverAccessBlockers(driver);
  driver.canReceiveOrders = driver.accessBlockers.length === 0;
  driver.isOnline = Boolean(driver.isOnline) && driver.canReceiveOrders;
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
      sendJson(response, 200, {
        geo: {
          addressSearch: geoProvider.addressSearchUrl ? 'provider' : 'local-fallback',
          reverseGeocode: geoProvider.reverseGeocodeUrl ? 'provider' : 'local-fallback',
          routes: geoProvider.routeSearchUrl ? 'provider' : 'local-fallback',
        },
        messageServer: {
          mode: 'websocket+sse+polling',
          websocketPath: '/realtime/ws',
          streamPath: '/realtime/stream',
          snapshotPath: '/realtime/snapshot',
          threadsPath: '/support/threads',
        },
        ok: true,
        backend: makePublicBackendConfig(),
        service: 'taxi-partner-mvp',
      });
      return;
    }

    const db = await readDb();

    if (request.method === 'GET' && url.pathname === '/realtime/snapshot') {
      const sessionContext = getSessionContext(db, request);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      // Истёкшие офферы освобождаем через очередь мутаций на свежей копии:
      // запись request-копии затирала бы конкурентные изменения.
      let snapshotDb = db;
      if (hasExpiredExclusiveOffers(db)) {
        await mutateDb(async (freshDb) => {
          await releaseExpiredExclusiveOffers(freshDb);
        });
        snapshotDb = await readDb();
      }
      sendJson(response, 200, createRealtimeSnapshot(snapshotDb, sessionContext));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/realtime/stream') {
      const sessionContext = getSessionContext(db, request, { allowQueryToken: true, url });

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      openRealtimeStream(request, response, db, sessionContext);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/push-tokens') {
      const sessionContext = getSessionContext(db, request);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      const payload = await readBody(request);
      const token = normalizePushToken({
        ...payload,
        createdAt: new Date().toISOString(),
        role: sessionContext.user.role,
        updatedAt: new Date().toISOString(),
        userId: sessionContext.user.id,
      });

      if (!token) {
        sendJson(response, 400, { error: 'Push token and userId are required' });
        return;
      }

      db.pushTokens = [
        token,
        ...(db.pushTokens || []).filter(
          (item) => !(item.userId === token.userId && item.token === token.token),
        ),
      ].slice(0, 1000);
      await writeDb(db);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/geo/coverage') {
      sendJson(response, 200, {
        coverage: makeGeoCoverage(
          geoProvider.addressSearchUrl || geoProvider.reverseGeocodeUrl || geoProvider.routeSearchUrl
            ? 'provider'
            : 'local',
        ),
        provider: makeGeoProviderMeta(
          geoProvider.addressSearchUrl || geoProvider.reverseGeocodeUrl || geoProvider.routeSearchUrl
            ? 'provider'
            : 'local',
          geoProvider.addressSearchUrl || geoProvider.reverseGeocodeUrl || geoProvider.routeSearchUrl,
        ),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/geo/address-search') {
      const result = await searchAddresses({
        lat: url.searchParams.get('lat'),
        latitude: url.searchParams.get('latitude'),
        limit: url.searchParams.get('limit'),
        lon: url.searchParams.get('lon'),
        longitude: url.searchParams.get('longitude'),
        query: url.searchParams.get('query') || url.searchParams.get('q') || '',
      }, db);

      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/geo/reverse') {
      const result = await reverseGeocode({
        lat: url.searchParams.get('lat'),
        latitude: url.searchParams.get('latitude'),
        lon: url.searchParams.get('lon'),
        longitude: url.searchParams.get('longitude'),
      });

      sendJson(response, 200, result);
      return;
    }

    if (url.pathname === '/geo/routes' && ['GET', 'POST'].includes(request.method)) {
      const payload =
        request.method === 'POST'
          ? await readBody(request)
          : {
              destination: url.searchParams.get('destination'),
              minimumPrice: url.searchParams.get('minimumPrice'),
              optionsTotal: url.searchParams.get('optionsTotal'),
              pickup: url.searchParams.get('pickup'),
              role: url.searchParams.get('role'),
              serviceType: url.searchParams.get('serviceType'),
              tariff: url.searchParams.get('tariff'),
              tariffId: url.searchParams.get('tariffId'),
            };
      const result = await estimateRoute(payload);

      sendJson(response, 200, result);
      return;
    }

    if (pathParts[0] === 'admin' && pathParts[1] === 'addresses') {
      const sessionContext = getSessionContext(db, request);

      if (!isAdminSession(sessionContext)) {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }

      if (request.method === 'GET' && !pathParts[2]) {
        sendJson(response, 200, { addresses: db.addressPoints.map(normalizeAddressPoint) });
        return;
      }

      if (request.method === 'POST' && !pathParts[2]) {
        const payload = await readBody(request);
        const address = normalizeAddressPoint({
          ...payload,
          id: `addr-${randomUUID().slice(0, 10)}`,
          source: 'admin',
        });
        db.addressPoints.unshift(address);
        await writeDb(db);
        sendJson(response, 201, { address });
        return;
      }

      if (request.method === 'PATCH' && pathParts[2]) {
        const payload = await readBody(request);
        const index = db.addressPoints.findIndex((item) => item.id === pathParts[2]);

        if (index < 0) {
          sendJson(response, 404, { error: 'Address not found' });
          return;
        }

        db.addressPoints[index] = normalizeAddressPoint({
          ...db.addressPoints[index],
          ...payload,
          id: db.addressPoints[index].id,
          source: db.addressPoints[index].source || 'admin',
          updatedAt: new Date().toISOString(),
        });
        await writeDb(db);
        sendJson(response, 200, { address: db.addressPoints[index] });
        return;
      }

      if (request.method === 'DELETE' && pathParts[2]) {
        const before = db.addressPoints.length;
        db.addressPoints = db.addressPoints.filter((item) => item.id !== pathParts[2]);

        if (db.addressPoints.length === before) {
          sendJson(response, 404, { error: 'Address not found' });
          return;
        }

        await writeDb(db);
        sendJson(response, 200, { ok: true });
        return;
      }
    }

    if (request.method === 'GET' && url.pathname === '/marketing/dashboard') {
      sendJson(response, 404, { error: 'Marketing role is disabled' });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/marketing/installs') {
      sendJson(response, 404, { error: 'Marketing role is disabled' });
      return;
    }

    if (pathParts[0] === 'admin' && pathParts[1] === 'marketing') {
      sendJson(response, 404, { error: 'Marketing role is disabled' });
      return;
    }

    if (false && request.method === 'GET' && url.pathname === '/marketing/dashboard') {
      const sessionContext = getSessionContext(db, request);
      const requestedUserId = String(url.searchParams.get('userId') || '').trim();
      const userId = requestedUserId || sessionContext?.user?.id || '';
      const partner = db.marketingPartners.find((item) => item.userId === userId || item.id === userId);

      if (!partner) {
        sendJson(response, 404, { error: 'Marketing partner not found' });
        return;
      }

      if (
        !isAdminSession(sessionContext) &&
        (!sessionContext || sessionContext.user.id !== partner.userId)
      ) {
        sendJson(response, 403, { error: 'Marketing dashboard access denied' });
        return;
      }

      sendJson(response, 200, makeMarketingDashboard(db, partner));
      return;
    }

    if (false && request.method === 'POST' && url.pathname === '/marketing/installs') {
      const payload = await readBody(request);
      const result = recordMarketingInstall(db, payload);

      await writeDb(db);
      sendJson(response, result.duplicate ? 200 : 201, result);
      return;
    }

    if (false && pathParts[0] === 'admin' && pathParts[1] === 'marketing') {
      const sessionContext = getSessionContext(db, request);

      if (!isAdminSession(sessionContext)) {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }

      if (request.method === 'GET' && pathParts[2] === 'partners') {
        sendJson(response, 200, {
          partners: db.marketingPartners.map((partner) => makeMarketingDashboard(db, partner).partner),
        });
        return;
      }

      if (request.method === 'POST' && pathParts[2] === 'invites') {
        const payload = await readBody(request);
        const invite = normalizeMarketingInvite({
          code: makeMarketingInviteCode(),
          createdByUserId: sessionContext.user.id,
          email: payload.email,
          phone: payload.phone,
          status: 'pending',
        });
        db.marketingInvites.unshift(invite);
        await writeDb(db);
        sendJson(response, 201, {
          invite,
          inviteUrl: `${inviteBaseUrl}/${encodeURIComponent(invite.code)}?role=marketer`,
        });
        return;
      }

      if (request.method === 'POST' && pathParts[2] === 'locations') {
        const payload = await readBody(request);
        const location = createMarketingLocation(db, payload);

        await writeDb(db);
        sendJson(response, 201, { location });
        return;
      }

      if (request.method === 'PATCH' && pathParts[2] === 'locations' && pathParts[4] === 'contract') {
        const payload = await readBody(request);
        const location = confirmMarketingLocation(db, pathParts[3], payload);

        await writeDb(db);
        sendJson(response, 200, { location });
        return;
      }

      if (request.method === 'POST' && pathParts[2] === 'posts' && pathParts[3] === 'confirm') {
        const payload = await readBody(request);
        const action = confirmMarketingPost(db, payload);

        await writeDb(db);
        sendJson(response, 200, { action });
        return;
      }

      if (request.method === 'POST' && pathParts[2] === 'monthly-location-bonuses') {
        const rewarded = accrueMonthlyMarketingLocationBonuses(db);

        await writeDb(db);
        sendJson(response, 200, { rewarded });
        return;
      }

      if (request.method === 'POST' && pathParts[2] === 'partners' && pathParts[4] === 'payout') {
        const payload = await readBody(request);
        const partner = payMarketingPartnerBalance(db, pathParts[3], payload.amountPoints);

        await writeDb(db);
        sendJson(response, 200, makeMarketingDashboard(db, partner));
        return;
      }
    }

    if (request.method === 'GET' && url.pathname === '/support/threads') {
      const sessionContext = getSessionContext(db, request);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      const threads = makeSupportThreadsResponse(db, sessionContext, {
        category: url.searchParams.get('category'),
        role: url.searchParams.get('role'),
        userId: url.searchParams.get('userId'),
      });

      sendJson(response, 200, { threads });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/support/messages') {
      const sessionContext = getSessionContext(db, request);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      const payload = await readBody(request);
      const thread = appendSupportMessage(db, payload, sessionContext);

      await writeDb(db);
      broadcastRealtime('support-message', { thread }, db);
      sendJson(response, 201, { thread });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/register') {
      const payload = await readBody(request);

      if (isMarketerRole(payload.role)) {
        sendJson(response, 410, { error: 'Marketing role is disabled' });
        return;
      }

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

      // Проверка уникальности и запись нового пользователя идут одной критической
      // секцией: два одновременных запроса с одним телефоном не создадут дубликат.
      const outcome = await mutateDb(async (freshDb) => {
        if (
          (email && findUserByIdentifier(freshDb.users, email)) ||
          (phone && findUserByIdentifier(freshDb.users, phone))
        ) {
          return { status: 409, body: { error: 'User already exists' } };
        }

        freshDb.users.forEach((existingUser) => ensureUserReferralCode(existingUser, freshDb.users));
        const normalizedReferralCode = normalizeReferralCode(payload.referralCode);
        const referralInviter = normalizedReferralCode
          ? findUserByReferralCode(freshDb.users, normalizedReferralCode)
          : undefined;
        const referralMarketingPartner = normalizedReferralCode
          ? findMarketingPartnerByCode(freshDb, normalizedReferralCode)
          : undefined;

        if (normalizedReferralCode && !referralInviter && !referralMarketingPartner) {
          return { status: 400, body: { error: 'Referral code not found' } };
        }

        const referralRegistrationError = referralInviter
          ? getReferralRegistrationError(referralInviter, { email, phone })
          : '';

        if (referralRegistrationError) {
          return { status: 400, body: { error: referralRegistrationError } };
        }

        const now = new Date().toISOString();
        const pendingParkInvite =
          role === 'park_driver' ? findParkDriverInvite(freshDb, payload.parkInviteCode) : undefined;
        const marketingInviteCode = normalizeReferralCode(payload.marketingInviteCode);
        const pendingMarketingInvite =
          role === 'marketer'
            ? freshDb.marketingInvites.find(
                (invite) => invite.code === marketingInviteCode && invite.status === 'pending',
              )
            : undefined;

        if (role === 'park_driver' && !pendingParkInvite) {
          return { status: 400, body: { error: 'Valid taxi park invite code is required' } };
        }

        if (role === 'marketer' && !pendingMarketingInvite) {
          return { status: 400, body: { error: 'Valid marketing invite code is required' } };
        }

        const invitedPark = pendingParkInvite
          ? freshDb.parks.find((item) => item.id === pendingParkInvite.parkId)
          : undefined;
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
          parkId: pendingParkInvite?.parkId,
          parkName: invitedPark?.organisationName,
          verificationStatus: 'pending_contacts',
          createdAt: now,
          updatedAt: now,
        };

        if (skipPhoneVerification) {
          user.phoneVerifiedAt = now;
        }

        const { record: sessionRecord, session } = makeSession(user.id, role);

        ensureUserReferralCode(user, freshDb.users);
        freshDb.users.unshift(user);
        freshDb.sessions.unshift(sessionRecord);
        attachReferral(freshDb, user, payload.referralCode);

        if (
          isSelfEmployedDriverRole(role) &&
          !freshDb.drivers.some((driver) => driver.userId === user.id)
        ) {
          freshDb.drivers.unshift(makeDriverFromUser(user, payload, { employmentType: 'self_employed' }));
        }

        if (isParkAdminRole(role)) {
          const park = makeParkFromUser(user, payload);
          user.parkId = park.id;
          user.parkName = park.organisationName;
          freshDb.parks.unshift(park);
        }

        if (isParkDriverRole(role)) {
          const driver = makeDriverFromUser(user, payload, {
            employmentType: 'park_driver',
            parkId: pendingParkInvite.parkId,
          });
          user.parkId = pendingParkInvite.parkId;
          user.parkName = invitedPark?.organisationName;
          pendingParkInvite.userId = user.id;
          pendingParkInvite.driverId = driver.id;
          pendingParkInvite.status = 'invited';
          pendingParkInvite.updatedAt = now;
          freshDb.drivers.unshift(driver);
        }

        if (isMarketerRole(role)) {
          pendingMarketingInvite.status = 'used';
          pendingMarketingInvite.usedAt = now;
          pendingMarketingInvite.usedByUserId = user.id;
          ensureMarketingPartnerForUser(freshDb, user);
        }

        return { status: 201, body: { session, user: publicUser(user) } };
      });

      sendJson(response, outcome.status, outcome.body);
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

      if (!user) {
        sendJson(response, 404, { error: 'User not found' });
        return;
      }

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

      const deliveryChannel = normalizeVerificationDeliveryChannel(channel, payload.deliveryChannel);
      const { code, record } = createVerificationRecord(user, channel, deliveryChannel);
      let delivery;

      try {
        delivery = await deliverAuthCode(db, {
          channel,
          code,
          deliveryChannel,
          purpose: 'verification',
          target,
          user,
        });
      } catch (error) {
        await writeDb(db);
        sendJson(response, 502, {
          error: error instanceof Error ? error.message : 'Verification code delivery failed',
        });
        return;
      }

      db.verificationCodes = [
        record,
        ...db.verificationCodes.filter(
          (item) => !(item.userId === user.id && item.channel === channel && !item.usedAt),
        ),
      ].slice(0, 200);

      await writeDb(db);
      const payloadResponse = {
        channel,
        deliveryChannel,
        deliveryMode: delivery.deliveryMode,
        expiresAt: record.expiresAt,
        messageId: delivery.messageId,
        provider: delivery.provider,
        target: channel === 'email' ? user.email : user.phone,
      };

      if (delivery.deliveryMode === 'mvp-returned-code') {
        payloadResponse.code = code;
      }

      sendJson(response, 201, payloadResponse);
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

      if (!user) {
        sendJson(response, 404, { error: 'User not found' });
        return;
      }

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

      if (record.attempts > verificationMaxAttempts) {
        await writeDb(db);
        sendJson(response, 429, { error: 'Too many verification attempts. Request a new code.' });
        return;
      }

      if (!safeEqual(record.codeHash, hashCode(code))) {
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

    if (request.method === 'POST' && url.pathname === '/auth/sms-login/request') {
      const payload = await readBody(request);
      const phone = normalizePhone(payload.phone || payload.identifier);

      if (!phone || phone.length < 10 || phone.length > 15) {
        sendJson(response, 400, { error: 'Valid phone is required' });
        return;
      }

      const user = findUserByIdentifier(db.users, phone);

      if (!user) {
        sendJson(response, 202, {
          deliveryMode: 'accepted',
          ok: true,
        });
        return;
      }

      if (isDisabledMarketerUser(user)) {
        sendJson(response, 410, { error: 'Marketing role is disabled' });
        return;
      }

      if (payload.role && normalizeRole(user.role) !== normalizeRole(payload.role)) {
        sendJson(response, 403, { error: 'Role mismatch' });
        return;
      }

      const deliveryChannel = normalizePhoneDeliveryChannel(payload.deliveryChannel || defaultPhoneDeliveryChannel);
      const { code, record } = createSmsLoginRecord(user, deliveryChannel);
      let delivery;

      try {
        delivery = await deliverAuthCode(db, {
          channel: 'phone',
          code,
          deliveryChannel,
          purpose: 'sms-login',
          target: normalizePhone(user.phone),
          user,
        });
      } catch (error) {
        await writeDb(db);
        sendJson(response, 502, {
          error: error instanceof Error ? error.message : 'SMS login code delivery failed',
        });
        return;
      }

      db.verificationCodes = [
        record,
        ...db.verificationCodes.filter(
          (item) => !(item.userId === user.id && item.purpose === 'sms-login' && !item.usedAt),
        ),
      ].slice(0, 200);

      await writeDb(db);
      const loginCodeResponse = {
        deliveryChannel,
        deliveryMode: delivery.deliveryMode,
        expiresAt: record.expiresAt,
        messageId: delivery.messageId,
        ok: true,
        provider: delivery.provider,
        target: maskTarget(record.target, deliveryChannel),
      };

      if (delivery.deliveryMode === 'mvp-returned-code') {
        loginCodeResponse.code = code;
      }

      sendJson(response, 202, loginCodeResponse);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/sms-login/confirm') {
      const payload = await readBody(request);
      const phone = normalizePhone(payload.phone || payload.identifier);
      const code = String(payload.code || '').trim();
      const user = findUserByIdentifier(db.users, phone);

      if (!phone || !code || !user) {
        sendJson(response, 400, { error: 'Invalid or expired SMS login code' });
        return;
      }

      if (isDisabledMarketerUser(user)) {
        sendJson(response, 410, { error: 'Marketing role is disabled' });
        return;
      }

      if (payload.role && normalizeRole(user.role) !== normalizeRole(payload.role)) {
        sendJson(response, 403, { error: 'Role mismatch' });
        return;
      }

      const target = normalizePhone(user.phone);
      const record = db.verificationCodes.find(
        (item) =>
          item.userId === user.id &&
          item.channel === 'phone' &&
          item.purpose === 'sms-login' &&
          item.target === target &&
          !item.usedAt,
      );

      if (!record || new Date(record.expiresAt).getTime() < Date.now()) {
        sendJson(response, 400, { error: 'Invalid or expired SMS login code' });
        return;
      }

      record.attempts = Number(record.attempts || 0) + 1;

      if (record.attempts > verificationMaxAttempts) {
        await writeDb(db);
        sendJson(response, 429, { error: 'Too many SMS login attempts. Request a new code.' });
        return;
      }

      if (!safeEqual(record.codeHash, hashCode(code))) {
        await writeDb(db);
        sendJson(response, 400, { error: 'Invalid or expired SMS login code' });
        return;
      }

      record.usedAt = new Date().toISOString();
      markUserContactVerified(user, 'phone');
      const { record: sessionRecord, session } = makeSession(user.id, user.role);
      db.sessions.unshift(sessionRecord);
      await writeDb(db);
      sendJson(response, 200, { session, user: publicUser(user) });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/login') {
      const payload = await readBody(request);
      const user = findUserByIdentifier(db.users, payload.identifier);

      if (!user || !verifyPassword(payload.password || '', user.passwordHash)) {
        sendJson(response, 401, { error: 'Invalid login or password' });
        return;
      }

      if (isDisabledMarketerUser(user)) {
        sendJson(response, 410, { error: 'Marketing role is disabled' });
        return;
      }

      if (!String(user.passwordHash || '').startsWith('scrypt$')) {
        user.passwordHash = hashPassword(payload.password || '');
        user.updatedAt = new Date().toISOString();
      }

      if (payload.role && normalizeRole(user.role) !== normalizeRole(payload.role)) {
        sendJson(response, 403, { error: 'Role mismatch' });
        return;
      }

      const { record: sessionRecord, session } = makeSession(user.id, user.role);
      db.sessions.unshift(sessionRecord);
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
      const { record: sessionRecord, session } = makeSession(user.id, 'admin');
      db.sessions.unshift(sessionRecord);
      await writeDb(db);
      sendJson(response, 200, { session, user });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/logout') {
      const sessionContext = getSessionContext(db, request);

      if (!sessionContext) {
        sendJson(response, 200, { ok: true });
        return;
      }

      revokeSession(db, sessionContext.session.id);
      await writeDb(db);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/logout-all') {
      const sessionContext = getSessionContext(db, request);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      revokeUserSessions(db, sessionContext.user.id);
      await writeDb(db);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (
      (request.method === 'POST' && url.pathname === '/account/delete') ||
      (request.method === 'DELETE' && url.pathname === '/account')
    ) {
      const sessionContext = getSessionContext(db, request);
      const payload = request.method === 'DELETE' ? await readBody(request).catch(() => ({})) : await readBody(request);

      if (!sessionContext || sessionContext.user.role === 'admin') {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      const user = db.users.find((item) => item.id === sessionContext.user.id);

      if (!user) {
        sendJson(response, 404, { error: 'User not found' });
        return;
      }

      const result = await deleteUserAccount(
        db,
        user,
        makeActorFromSession(sessionContext),
        String(payload.reason || '').trim(),
      );

      await writeDb(db);
      broadcastRealtime('account.deleted', { removed: result.removed }, db);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/password-reset/request') {
      const payload = await readBody(request);
      const user = findUserByIdentifier(db.users, payload.identifier);

      if (!user) {
        sendJson(response, 202, {
          deliveryMode: 'accepted',
          ok: true,
        });
        return;
      }

      if (isDisabledMarketerUser(user)) {
        sendJson(response, 410, { error: 'Marketing role is disabled' });
        return;
      }

      const deliveryChannel = choosePasswordResetDeliveryChannel(user, payload.deliveryChannel);
      const target = getPasswordResetTarget(user, deliveryChannel);

      if (!target) {
        sendJson(response, 202, {
          deliveryMode: 'accepted',
          ok: true,
        });
        return;
      }

      const { code, record } = createPasswordResetRecord(user, deliveryChannel);
      const channel = deliveryChannel === 'email' ? 'email' : 'phone';
      let delivery;

      try {
        delivery = await deliverAuthCode(db, {
          channel,
          code,
          deliveryChannel,
          purpose: 'password-reset',
          target,
          user,
        });
      } catch (error) {
        await writeDb(db);
        sendJson(response, 502, {
          error: error instanceof Error ? error.message : 'Password reset code delivery failed',
        });
        return;
      }

      db.passwordResetTokens = [
        record,
        ...db.passwordResetTokens.filter((item) => !(item.userId === user.id && !item.usedAt)),
      ].slice(0, 200);

      await writeDb(db);
      const resetResponse = {
        deliveryChannel,
        deliveryMode: delivery.deliveryMode,
        expiresAt: record.expiresAt,
        messageId: delivery.messageId,
        ok: true,
        provider: delivery.provider,
        target: maskTarget(target, deliveryChannel),
      };

      if (delivery.deliveryMode === 'mvp-returned-code') {
        resetResponse.code = code;
      }

      sendJson(response, 202, resetResponse);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/password-reset/confirm') {
      const payload = await readBody(request);
      const user = findUserByIdentifier(db.users, payload.identifier);
      const code = String(payload.code || '').trim();
      const password = String(payload.password || '');

      if (password.length < 4) {
        sendJson(response, 400, { error: 'Password is too short' });
        return;
      }

      if (!user) {
        sendJson(response, 400, { error: 'Invalid or expired reset code' });
        return;
      }

      if (isDisabledMarketerUser(user)) {
        sendJson(response, 410, { error: 'Marketing role is disabled' });
        return;
      }

      const record = db.passwordResetTokens.find((item) => item.userId === user.id && !item.usedAt);

      if (!record || new Date(record.expiresAt).getTime() < Date.now()) {
        sendJson(response, 400, { error: 'Invalid or expired reset code' });
        return;
      }

      record.attempts = Number(record.attempts || 0) + 1;

      if (record.attempts > verificationMaxAttempts) {
        await writeDb(db);
        sendJson(response, 429, { error: 'Too many reset attempts. Request a new code.' });
        return;
      }

      if (!safeEqual(record.codeHash, hashCode(code))) {
        await writeDb(db);
        sendJson(response, 400, { error: 'Invalid or expired reset code' });
        return;
      }

      record.usedAt = new Date().toISOString();
      user.passwordHash = hashPassword(password);
      user.updatedAt = new Date().toISOString();
      revokeUserSessions(db, user.id);
      const { record: sessionRecord, session } = makeSession(user.id, user.role);
      db.sessions.unshift(sessionRecord);
      await writeDb(db);
      sendJson(response, 200, { session, user: publicUser(user) });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/users') {
      const sessionContext = getSessionContext(db, request);

      if (!isAdminSession(sessionContext)) {
        sendJson(response, sessionContext ? 403 : 401, { error: 'Admin access required' });
        return;
      }

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

    if (request.method === 'GET' && url.pathname === '/admin/driver-payments') {
      const sessionContext = getSessionContext(db, request);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      if (sessionContext.user.role !== 'admin') {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }

      sendJson(response, 200, {
        payments: db.driverPayments.map(normalizeDriverPayment),
      });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'admin' && pathParts[1] === 'referrals' && pathParts[3] === 'status') {
      const sessionContext = getSessionContext(db, request);
      const payload = await readBody(request);
      const referral = db.referrals.find((item) => item.id === pathParts[2]);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      if (sessionContext.user.role !== 'admin') {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }

      if (!referral) {
        sendJson(response, 404, { error: 'Referral not found' });
        return;
      }

      const nextStatus = referralStatuses.includes(payload.status) ? payload.status : '';
      if (!nextStatus) {
        sendJson(response, 400, { error: 'Invalid referral status' });
        return;
      }

      // Меняем статус через очередь мутаций на свежей копии: запись
      // request-копии затирала бы конкурентные изменения.
      const dashboard = await mutateDb(async (freshDb) => {
        const freshReferral = freshDb.referrals.find((item) => item.id === pathParts[2]);

        if (!freshReferral) {
          return null;
        }

        if (nextStatus === 'rewarded') {
          rewardReferral(freshDb, freshReferral, payload.note || 'Реферальный бонус подтвержден администратором', sessionContext.user.id);
        } else {
          freshReferral.status = nextStatus;
          if (nextStatus === 'qualified') {
            freshReferral.qualifiedAt = freshReferral.qualifiedAt || new Date().toISOString();
          }
          if (nextStatus === 'blocked') {
            freshReferral.blockedAt = freshReferral.blockedAt || new Date().toISOString();
          }
          addReferralAudit(freshDb, freshReferral.id, nextStatus, sessionContext.user.id, payload.note || 'Статус изменен администратором');
        }

        return makeAdminReferralDashboard(freshDb);
      });

      if (!dashboard) {
        sendJson(response, 404, { error: 'Referral not found' });
        return;
      }

      sendJson(response, 200, dashboard);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/drivers') {
      const sessionContext = getSessionContext(db, request);

      sendJson(response, 200, { drivers: makeDriversResponse(db, sessionContext) });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/driver-payments/settings') {
      const sessionContext = getSessionContext(db, request);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      const dailyAmount = driverAccessPlans.daily.monthlyPrice;
      const monthlyAmount = driverAccessPlans.monthly.monthlyPrice;
      sendJson(response, 200, {
        // amount оставлен для обратной совместимости (месячный тариф).
        amount: monthlyAmount,
        dailyAmount,
        monthlyAmount,
        cardMask: maskPaymentCardNumber(paymentCardNumber),
        cardNumber: formatPaymentCardNumber(paymentCardNumber),
        cardHolder: paymentCardHolder,
        instructions:
          'Оплата доступа — переводом на карту владельца. Переведите сумму тарифа и нажмите «Я оплатил»: администратор проверит перевод и откроет доступ.',
        planName: driverAccessPlans.monthly.name,
      });
      return;
    }

    if (request.method === 'GET' && pathParts[0] === 'drivers' && pathParts[2] === 'billing') {
      const sessionContext = getSessionContext(db, request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      if (!canAccessDriver(sessionContext, driver)) {
        sendJson(response, 403, { error: 'Driver billing access denied' });
        return;
      }

      sendJson(response, 200, makeDriverBillingDashboard(db, driver, sessionContext));
      return;
    }

    if (request.method === 'POST' && pathParts[0] === 'drivers' && pathParts[2] === 'billing' && pathParts[3] === 'pay') {
      const sessionContext = getSessionContext(db, request);
      const payload = await readBody(request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      if (!canAccessDriver(sessionContext, driver)) {
        sendJson(response, 403, { error: 'Driver billing access denied' });
        return;
      }

      if (driver.status !== 'approved') {
        sendJson(response, 409, {
          driver: applyDriverAccessState(driver),
          error: 'Driver must be approved before paid access can be activated',
        });
        return;
      }

      const payment = await makeDriverSubscriptionPayment(driver, payload);
      db.driverPayments.unshift(payment);
      applyDriverAccessFromPayment(driver, payment);
      const notification = notifyDriverChange(
        db,
        driver,
        'Доступ водителя активен',
        `${driver.name} может получать заказы после оплаты доступа.`,
        'driver_access',
      );
      await writeDb(db);
      broadcastRealtime('driver_access', { driver: makeDriverResponse(db, driver, null), notification }, db);
      sendJson(response, 201, makeDriverBillingDashboard(db, driver, sessionContext));
      return;
    }

    if (request.method === 'POST' && pathParts[0] === 'driver-payments' && pathParts[2] === 'sync') {
      // Денежный путь под замком: синк статуса платежа у провайдера и пересчёт доступа
      // водителя не должны пересекаться с вебхуком или другим синком того же платежа.
      // Ошибка провайдера пробрасывается из mutateDb, поэтому запись пропускается.
      try {
        const outcome = await mutateDb(async (db) => {
          const sessionContext = getSessionContext(db, request);
          const payment = db.driverPayments.find((item) => item.id === pathParts[1]);

          if (!sessionContext) {
            return { status: 401, body: { error: 'Authentication required' } };
          }

          if (!payment) {
            return { status: 404, body: { error: 'Driver payment not found' } };
          }

          const paymentDriver = db.drivers.find((item) => item.id === payment.driverId);

          if (
            (paymentDriver && !canAccessDriver(sessionContext, paymentDriver)) ||
            (!paymentDriver && !isAdminSession(sessionContext))
          ) {
            return { status: 403, body: { error: 'Driver payment access denied' } };
          }

          const driver = await syncDriverPaymentWithProvider(db, payment);
          const notification = driver
            ? notifyDriverChange(
                db,
                driver,
                'Платеж водителя обновлен',
                `${driver.name}: статус платежа ${payment.status}.`,
                'driver_payment',
              )
            : undefined;

          if (driver) {
            broadcastRealtime(
              'driver_payment',
              { driver: makeDriverResponse(db, driver, null), notification },
              db,
            );
          }

          return {
            status: 200,
            body: makeDriverBillingDashboard(db, driver || { id: payment.driverId }, sessionContext),
          };
        });

        sendJson(response, outcome.status, outcome.body);
      } catch (error) {
        sendJson(response, 409, { error: error.message });
      }

      return;
    }

    if (request.method === 'POST' && pathParts[0] === 'driver-payments' && pathParts[2] === 'refund') {
      const payload = await readBody(request);
      // Денежный путь под замком: возврат через провайдера и пересчёт доступа водителя
      // сериализуются, чтобы не пересечься с вебхуком/синком того же платежа. Ошибка
      // провайдера пробрасывается из mutateDb, поэтому запись пропускается.
      try {
        const outcome = await mutateDb(async (db) => {
          const sessionContext = getSessionContext(db, request);
          const payment = db.driverPayments.find((item) => item.id === pathParts[1]);

          if (!sessionContext) {
            return { status: 401, body: { error: 'Authentication required' } };
          }

          if (!payment) {
            return { status: 404, body: { error: 'Driver payment not found' } };
          }

          const paymentDriver = db.drivers.find((item) => item.id === payment.driverId);

          if (
            (paymentDriver && !canAccessDriver(sessionContext, paymentDriver)) ||
            (!paymentDriver && !isAdminSession(sessionContext))
          ) {
            return { status: 403, body: { error: 'Driver payment access denied' } };
          }

          const driver = await refundDriverSubscriptionPaymentWithProvider(
            db,
            payment,
            String(payload.reason || 'Refund requested in MVP'),
          );
          const notification = driver
            ? notifyDriverChange(
                db,
                driver,
                'Возврат подписки',
                `${driver.name}: доступ пересчитан после возврата.`,
                'driver_payment_refund',
              )
            : undefined;

          if (driver) {
            broadcastRealtime(
              'driver_payment_refund',
              { driver: makeDriverResponse(db, driver, null), notification },
              db,
            );
          }

          return {
            status: 200,
            body: makeDriverBillingDashboard(db, driver || { id: payment.driverId }, sessionContext),
          };
        });

        sendJson(response, outcome.status, outcome.body);
      } catch (error) {
        sendJson(response, 409, { error: error.message });
      }

      return;
    }

    if (request.method === 'POST' && url.pathname === '/payments/yookassa/webhook') {
      if (!hasValidYooKassaWebhookToken(request, url)) {
        sendJson(response, 401, { error: 'Invalid YooKassa webhook token' });
        return;
      }

      const payload = await readBody(request);

      try {
        // Под замком: вебхук — денежный путь. Сериализация не даёт параллельной
        // обработке/синку затереть выданный водителю доступ и защищает идемпотентность
        // (повторный вебхук не выдаст доступ дважды).
        const result = await mutateDb((db) => applyYooKassaWebhook(db, payload));
        sendJson(response, 200, { ok: true, ...result });
      } catch (error) {
        sendJson(response, 409, { error: error.message });
      }

      return;
    }

    if (request.method === 'POST' && url.pathname === '/payments/tbank/webhook') {
      const payload = await readBody(request);

      if (!hasValidTBankWebhookToken(request, url, payload)) {
        sendJson(response, 401, { error: 'Invalid T-Bank webhook token' });
        return;
      }

      try {
        // Под замком — тот же денежный путь, что и YooKassa-вебхук.
        const result = await mutateDb((db) => applyTBankWebhook(db, payload));
        sendJson(response, 200, { ok: true, ...result });
      } catch (error) {
        sendJson(response, 409, { error: error.message });
      }

      return;
    }

    if (request.method === 'POST' && url.pathname === '/drivers') {
      const sessionContext = getSessionContext(db, request);
      const payload = await readBody(request);
      const now = new Date().toISOString();

      if (!isAdminSession(sessionContext)) {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }

      const driver = {
        id: `driver-${Date.now().toString(36)}`,
        name: requireString(payload.name, 'name'),
        phone: String(payload.phone || ''),
        rating: Number(payload.rating || 5),
        vehicle: String(payload.vehicle || ''),
        plate: String(payload.plate || ''),
        status: payload.status === 'approved' ? 'approved' : 'pending',
        billingMode: normalizeBillingMode(payload.billingMode),
        documentUploads: {},
        payoutAccount: String(payload.payoutAccount || '').trim(),
        subscriptionStatus: payload.subscriptionStatus === 'active' ? 'active' : 'inactive',
        updatedAt: now,
      };
      db.drivers.unshift(applyDriverAccessState(driver));
      const notification = notifyDriverChange(
        db,
        driver,
        'Водитель добавлен',
        `${driver.name} появился в серверном списке водителей.`,
        'driver_created',
      );
      await writeDb(db);
      broadcastRealtime('driver_created', { driver: makeDriverResponse(db, driver, null), notification }, db);
      sendJson(response, 201, { driver: makeDriverResponse(db, driver, sessionContext) });
      return;
    }

    if (request.method === 'POST' && pathParts[0] === 'drivers' && pathParts[2] === 'documents') {
      const sessionContext = getSessionContext(db, request);
      const payload = await readBody(request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      if (sessionContext.user.role !== 'admin' && driver.userId !== sessionContext.user.id) {
        sendJson(response, 403, { error: 'Driver document access denied' });
        return;
      }

      await applyDriverDocumentUploads(db, driver, payload, makeActorFromSession(sessionContext));
      driver.updatedAt = new Date().toISOString();
      const notification = notifyDriverChange(
        db,
        driver,
        'Документы загружены',
        `${driver.name}: новые документы отправлены на серверную проверку.`,
        'driver_documents',
      );
      await writeDb(db);
      broadcastRealtime('driver_documents', { driver: makeDriverResponse(db, driver, null), notification }, db);
      sendJson(response, 200, { driver: makeDriverResponse(db, driver, sessionContext) });
      return;
    }

    if (
      request.method === 'GET' &&
      pathParts[0] === 'drivers' &&
      pathParts[2] === 'documents' &&
      pathParts[4] === 'file'
    ) {
      const sessionContext = getSessionContext(db, request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!isAdminSession(sessionContext)) {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      const kind = normalizeDriverDocumentKind(pathParts[3]);
      const upload = normalizeDriverDocumentUploads(driver.documentUploads)[kind];
      const fileBuffer = await readDriverDocumentFile(upload).catch((error) => {
        if (error?.code === 'ENOENT') {
          return null;
        }

        throw error;
      });

      if (!upload || !fileBuffer) {
        sendJson(response, 404, { error: 'Driver document file not found' });
        return;
      }

      addDriverDocumentAudit(db, driver, 'viewed', makeActorFromSession(sessionContext), {
        kinds: [kind],
        note: upload.fileName,
        status: driver.documentsStatus,
      });
      await writeDb(db);
      sendBinary(response, 200, fileBuffer, {
        'Content-Disposition': `inline; filename="${sanitizeFileName(upload.fileName)}"`,
        'Content-Type': upload.mimeType,
      });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'drivers' && pathParts[2] === 'documents' && pathParts[3] === 'review') {
      const sessionContext = getSessionContext(db, request);
      const payload = await readBody(request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!isAdminSession(sessionContext)) {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      applyDriverDocumentReview(db, driver, payload, makeActorFromSession(sessionContext));
      driver.updatedAt = new Date().toISOString();
      const notification = notifyDriverChange(
        db,
        driver,
        'Проверка документов обновлена',
        `${driver.name}: статус документов ${driver.documentsStatus}.`,
        'driver_documents_review',
      );
      await writeDb(db);
      broadcastRealtime(
        'driver_documents_review',
        { driver: makeDriverResponse(db, driver, null), notification },
        db,
      );
      sendJson(response, 200, { driver: makeDriverResponse(db, driver, sessionContext) });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'drivers' && pathParts[2] === 'status') {
      const sessionContext = getSessionContext(db, request);
      const payload = await readBody(request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!isAdminSession(sessionContext)) {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }

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
                isDriverLikeRole(item.inviteeRole) &&
                item.status === 'registered',
            )
          : undefined;

        if (driverReferral && driver.subscriptionStatus !== 'active') {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + driverAccessPlans.daily.accessDays);
          driver.subscriptionStatus = 'active';
          driver.accessExpiresAt = expiresAt.toISOString();
          driverReferral.status = 'qualified';
          driverReferral.qualifiedAt = driverReferral.qualifiedAt || new Date().toISOString();
        }
      }
      applyDriverAccessState(driver);
      driver.updatedAt = new Date().toISOString();
      const notification = notifyDriverChange(
        db,
        driver,
        'Статус водителя обновлен',
        `${driver.name}: ${driver.status}.`,
        'driver_status',
      );
      await writeDb(db);
      broadcastRealtime('driver_status', { driver: makeDriverResponse(db, driver, null), notification }, db);
      sendJson(response, 200, { driver: makeDriverResponse(db, driver, sessionContext) });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'drivers' && pathParts[2] === 'compliance') {
      const sessionContext = getSessionContext(db, request);
      const payload = await readBody(request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!isAdminSession(sessionContext)) {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      updateDriverCompliance(driver, payload);
      driver.updatedAt = new Date().toISOString();
      const notification = notifyDriverChange(
        db,
        driver,
        'Допуск водителя обновлен',
        `${driver.name}: ${driver.canReceiveOrders ? 'допущен к заказам' : 'допуск еще не закрыт'}.`,
        'driver_compliance',
      );
      await writeDb(db);
      broadcastRealtime('driver_compliance', { driver: makeDriverResponse(db, driver, null), notification }, db);
      sendJson(response, 200, { driver: makeDriverResponse(db, driver, sessionContext) });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'drivers' && pathParts[2] === 'access') {
      const sessionContext = getSessionContext(db, request);
      const payload = await readBody(request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!isAdminSession(sessionContext)) {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      driver.billingMode = normalizeBillingMode(payload.billingMode);
      driver.subscriptionStatus = payload.subscriptionStatus === 'inactive' ? 'inactive' : 'active';
      if (driver.subscriptionStatus === 'active') {
        const payment = await makeDriverSubscriptionPayment(driver, {
          amount: Number(payload.amount ?? getDriverAccessPlan(driver.billingMode).monthlyPrice),
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
        const pendingRequest = db.driverPayments.find(
          (item) =>
            item.id !== payment.id &&
            item.driverId === driver.id &&
            item.billingMode === 'monthly' &&
            item.status === 'pending',
        );
        if (pendingRequest) {
          pendingRequest.status = 'paid';
          pendingRequest.paidAt = pendingRequest.paidAt || payment.paidAt || new Date().toISOString();
          pendingRequest.providerPaymentStatus = 'manual_admin_confirmed';
          pendingRequest.updatedAt = new Date().toISOString();
        }
        applyDriverAccessFromPayment(driver, payment);
      }
      if (driver.subscriptionStatus !== 'active') {
        driver.billingMode = 'daily';
        driver.driverTariff = getDriverAccessPlan('daily').name;
        driver.isOnline = false;
        driver.accessExpiresAt = undefined;
        driver.subscriptionExpiresAt = undefined;
        driver.subscriptionPlan = getDriverSubscriptionPlanId('daily');
      }
      applyDriverAccessState(driver);
      driver.updatedAt = new Date().toISOString();
      const notification = notifyDriverChange(
        db,
        driver,
        'Доступ к заказам обновлен',
        `${driver.name}: ${driver.subscriptionStatus}.`,
        'driver_access',
      );
      await writeDb(db);
      broadcastRealtime('driver_access', { driver: makeDriverResponse(db, driver, null), notification }, db);
      sendJson(response, 200, { driver: makeDriverResponse(db, driver, sessionContext) });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'drivers' && pathParts[2] === 'availability') {
      const sessionContext = getSessionContext(db, request);
      const payload = await readBody(request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      if (!canAccessDriver(sessionContext, driver)) {
        sendJson(response, 403, { error: 'Driver availability access denied' });
        return;
      }

      applyDriverAccessState(driver);

      if (!driver.canReceiveOrders) {
        driver.isOnline = false;
        driver.updatedAt = new Date().toISOString();
        await writeDb(db);
        sendJson(response, 403, {
          error: 'Driver needs completed compliance and active access before going online',
          driver: makeDriverResponse(db, driver, sessionContext),
        });
        return;
      }

      driver.isOnline = Boolean(payload.isOnline);
      const locationPoint = readGeoPoint(payload.location || payload.lastLocation || payload);
      if (driver.isOnline && locationPoint) {
        driver.lastLocation = {
          accuracy: readOptionalNumber(payload.accuracy ?? payload.location?.accuracy),
          latitude: locationPoint.latitude,
          longitude: locationPoint.longitude,
          updatedAt: new Date().toISOString(),
        };
        driver.locationUpdatedAt = driver.lastLocation.updatedAt;
      }
      driver.updatedAt = new Date().toISOString();
      const notification = notifyDriverChange(
        db,
        driver,
        driver.isOnline ? 'Водитель на линии' : 'Водитель ушел с линии',
        `${driver.name}: ${driver.isOnline ? 'доступен для заказов' : 'не принимает новые заказы'}.`,
        'driver_availability',
      );
      await writeDb(db);
      broadcastRealtime(
        'driver_availability',
        { driver: makeDriverResponse(db, driver, null), notification },
        db,
      );
      sendJson(response, 200, { driver: makeDriverResponse(db, driver, sessionContext) });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'drivers' && pathParts[2] === 'location') {
      const sessionContext = getSessionContext(db, request);
      const payload = await readBody(request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      if (!canAccessDriver(sessionContext, driver)) {
        sendJson(response, 403, { error: 'Driver location access denied' });
        return;
      }

      const locationPoint = readGeoPoint(payload.location || payload);

      if (!locationPoint) {
        sendJson(response, 400, { error: 'location with latitude and longitude is required' });
        return;
      }

      driver.lastLocation = {
        accuracy: readOptionalNumber(payload.accuracy ?? payload.location?.accuracy),
        latitude: locationPoint.latitude,
        longitude: locationPoint.longitude,
        updatedAt: new Date().toISOString(),
      };
      driver.locationUpdatedAt = driver.lastLocation.updatedAt;
      driver.updatedAt = driver.lastLocation.updatedAt;
      await writeDb(db);

      if (driver.isOnline) {
        broadcastDriverLocation(driver);
      }

      sendJson(response, 200, { driver: makeDriverResponse(db, driver, sessionContext) });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/orders') {
      const sessionContext = getSessionContext(db, request);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      // См. /realtime/snapshot: освобождение офферов — только через mutateDb.
      let ordersDb = db;
      if (hasExpiredExclusiveOffers(db)) {
        await mutateDb(async (freshDb) => {
          await releaseExpiredExclusiveOffers(freshDb);
        });
        ordersDb = await readDb();
      }
      sendJson(response, 200, { orders: makeOrdersResponse(ordersDb, sessionContext) });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/service-share/summary') {
      const sessionContext = getSessionContext(db, request);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      if (!isAdminSession(sessionContext)) {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }

      sendJson(response, 200, {
        summary: makeServiceShareSummary(db, url.searchParams.get('date')),
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/orders') {
      const sessionContext = getSessionContext(db, request);

      if (!sessionContext) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }

      const payload = await readBody(request);
      const actorRole = isAdminSession(sessionContext) && payload.role
        ? normalizeRole(payload.role)
        : getSessionRole(sessionContext);
      const clientRequestId = String(payload.clientRequestId || payload.id || '').trim();
      const orderPayload = {
        ...payload,
        clientName: payload.clientName || [sessionContext.user.firstName, sessionContext.user.lastName].filter(Boolean).join(' '),
        clientPhone: sessionContext.user.phone || payload.clientPhone,
        clientRequestId,
        parkId: sessionContext.user.parkId || payload.parkId,
        role: actorRole,
        userId: sessionContext.user.id,
      };

      const outcome = await mutateDb(async (db) => {
        const existingOrder = clientRequestId
          ? db.orders.find(
              (item) => item.clientRequestId === clientRequestId && item.userId === sessionContext.user.id,
            )
          : undefined;

        if (existingOrder) {
          return {
            status: 200,
            body: { order: makeOrderResponse(db, existingOrder, sessionContext) },
          };
        }

        // Анти-спам: у клиента не больше 2 активных заказов одновременно
        // (каждый новый заказ рассылает пуши всем доступным водителям).
        if (actorRole === 'client') {
          const activeCount = db.orders.filter(
            (item) =>
              item.userId === sessionContext.user.id &&
              !['cancelled', 'canceled', 'closed', 'completed'].includes(item.status),
          ).length;

          if (activeCount >= 2) {
            return {
              status: 409,
              body: {
                error: 'У вас уже есть 2 активных заказа. Дождитесь их завершения или отмените один.',
              },
            };
          }
        }

        const order = applyBonusToOrder(db, makeOrder(orderPayload), orderPayload);
        const exclusiveOffer = applyExclusiveOffer(db, order);
        db.orders.unshift(order);
        const notification = notifyOrderChange(
          db,
          order,
          exclusiveOffer ? 'Заказ предложен ближайшему водителю' : 'Новый заказ в ленте',
          `${formatOrderRoute(order)} · ${order.total} ₽`,
          'order_created',
        );
        if (exclusiveOffer?.driver) {
          const driverNotification = addRealtimeNotification(db, {
            audience: 'driver',
            body: `${order.pickup} → ${order.destination} · ${order.total} ₽`,
            driverId: exclusiveOffer.driver.id,
            kind: 'dispatch_exclusive_offer',
            orderId: order.id,
            title: 'Заказ рядом с вами',
          });
          await sendPushToDriver(db, exclusiveOffer.driver.id, driverNotification, {
            actionCategory: 'driver_order_offer',
            distanceKm: order.exclusiveDistanceKm || '',
            expiresInSeconds: order.exclusiveOfferSeconds || dispatchExclusiveOfferSeconds,
            offerId: `${order.id}:${exclusiveOffer.driver.id}`,
            orderId: order.id,
            status: 'exclusive_offer',
          });
          scheduleExclusiveOfferRelease(db, order.id);
        } else {
          await sendPushToDrivers(db, getAvailableDriverIds(db), notification, {
            actionCategory: 'driver_order_offer',
            orderId: order.id,
            status: 'open_feed',
          });
        }
        await sendPushToAdmins(db, notification, {
          orderId: order.id,
          status: order.dispatchStatus || order.status,
        });
        broadcastRealtime('order_created', { notification, order }, db);

        return {
          status: 201,
          body: { order: makeOrderResponse(db, order, sessionContext) },
        };
      });

      sendJson(response, outcome.status, outcome.body);
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'orders' && pathParts[2] === 'status') {
      const payload = await readBody(request);
      // Смена статуса — через сериализованную критическую секцию: переход, расчёт
      // (settlement) и реферальные/маркетинговые начисления идут на свежем состоянии
      // под замком, чтобы не затирать параллельное назначение/оплату того же заказа.
      const outcome = await mutateDb(async (db) => {
        const sessionContext = getSessionContext(db, request);
        const order = db.orders.find((item) => item.id === pathParts[1]);

        if (!sessionContext) {
          return { status: 401, body: { error: 'Authentication required' } };
        }

        if (!order) {
          return { status: 404, body: { error: 'Order not found' } };
        }

        if (!canMutateOrder(sessionContext, db, order)) {
          return { status: 403, body: { error: 'Order access denied' } };
        }

        const nextStatus = String(payload.status || order.status);

        if (!isKnownOrderStatus(nextStatus)) {
          return {
            status: 400,
            body: { error: `Unknown order status: ${nextStatus}`, order: makeOrderResponse(db, order, sessionContext) },
          };
        }

        if (!isAllowedOrderStatusTransition(order.status, nextStatus)) {
          return {
            status: 422,
            body: {
              error: `Illegal status transition ${order.status} -> ${nextStatus}`,
              order: makeOrderResponse(db, order, sessionContext),
            },
          };
        }

        if (
          nextStatus === 'started' &&
          order.safetyPinRequired &&
          !order.safetyPinVerifiedAt &&
          !isValidTripPin(order, payload.pinCode || payload.tripPin)
        ) {
          return {
            status: 403,
            body: { error: 'Trip PIN does not match', order: makeOrderResponse(db, order, sessionContext) },
          };
        }

        order.status = nextStatus;
        order.updatedAt = new Date().toISOString();
        addOrderStatusHistory(order, order.status, 'status-patch');

        if (order.status === 'arrived') {
          order.arrivedAt = order.arrivedAt || order.updatedAt;
        }

        if (order.status === 'started') {
          order.startedAt = order.startedAt || order.updatedAt;
          order.safetyPinVerifiedAt = order.safetyPinRequired
            ? order.safetyPinVerifiedAt || order.updatedAt
            : order.safetyPinVerifiedAt;
        }

        if (['closed', 'completed'].includes(order.status)) {
          order.completedAt = order.completedAt || order.updatedAt;
          settleOrderPayment(db, order, 'status-patch');
        }

        if (['cancelled', 'canceled'].includes(order.status)) {
          refundOrderBonus(db, order);
        }
        settleClientReferralForOrder(db, order);
        settleDriverReferralForOrder(db, order);
        settleMarketingForOrder(db, order);

        // Отмену клиентом показываем водителю отдельным понятным сообщением,
        // а не обезличенным «Статус заказа обновлён».
        const cancelledByClient =
          ['cancelled', 'canceled'].includes(order.status) && getSessionRole(sessionContext) === 'client';
        const notification = notifyOrderChange(
          db,
          order,
          cancelledByClient ? 'Клиент отменил поездку' : 'Статус заказа обновлен',
          cancelledByClient
            ? `Заказ ${order.id}: клиент отменил поездку.`
            : `${order.id}: ${getOrderStatusLabel(order.status)}.`,
          cancelledByClient ? 'order_cancelled' : 'order_status',
        );
        await sendPushToUser(db, order.userId, notification, {
          orderId: order.id,
          status: order.status,
        }, ['client']);
        if (order.driver?.id) {
          await sendPushToDriver(db, order.driver.id, notification, {
            orderId: order.id,
            status: order.status,
          });
        }
        if (order.parkId) {
          await sendPushToPark(db, order.parkId, notification, {
            orderId: order.id,
            status: order.status,
          });
        }
        await sendPushToAdmins(db, notification, {
          orderId: order.id,
          status: order.status,
        });
        broadcastRealtime('order_status', { notification, order }, db);

        return { status: 200, body: { order: makeOrderResponse(db, order, sessionContext) } };
      });

      sendJson(response, outcome.status, outcome.body);
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'orders' && pathParts[2] === 'offer') {
      const payload = await readBody(request);
      const driverId = String(payload.driverId || '');
      const action = String(payload.action || '').trim();
      // Отклонение эксклюзивного оффера — под замком, чтобы не пересечься с принятием
      // того же заказа другим водителем и не вернуть заказ в общий фид внахлёст.
      const outcome = await mutateDb(async (db) => {
        const sessionContext = getSessionContext(db, request);
        const order = db.orders.find((item) => item.id === pathParts[1]);
        const sessionDriver = getDriverForSession(db, sessionContext, driverId);

        if (!sessionContext) {
          return { status: 401, body: { error: 'Authentication required' } };
        }

        if (!order) {
          return { status: 404, body: { error: 'Order not found' } };
        }

        if (!isAdminSession(sessionContext) && !sessionDriver) {
          return { status: 403, body: { error: 'Driver access required' } };
        }

        if (action !== 'decline') {
          return { status: 400, body: { error: 'Unsupported offer action' } };
        }

        const actorDriverId = isAdminSession(sessionContext) ? driverId : sessionDriver.id;

        if (!isExclusiveOfferActive(order) || String(order.exclusiveDriverId || '') !== String(actorDriverId)) {
          return {
            status: 409,
            body: {
              error: 'Exclusive offer is not active for this driver',
              order: makeOrderResponse(db, order, sessionContext),
            },
          };
        }

        releaseExclusiveOffer(order, 'declined');
        await publishOrderOpenFeed(db, order);

        return { status: 200, body: { order: makeOrderResponse(db, order, sessionContext) } };
      });

      sendJson(response, outcome.status, outcome.body);
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'orders' && pathParts[2] === 'payment') {
      const payload = await readBody(request);
      // Обновление оплаты — через сериализованную критическую секцию, чтобы оплата и
      // смена статуса того же заказа не затирали друг друга при одновременных запросах.
      const outcome = await mutateDb(async (db) => {
        const sessionContext = getSessionContext(db, request);
        const order = db.orders.find((item) => item.id === pathParts[1]);
        const paymentStatus = normalizePaymentStatus(payload.paymentStatus || payload.status, '');

        if (!isAdminSession(sessionContext)) {
          return { status: sessionContext ? 403 : 401, body: { error: 'Admin access required' } };
        }

        if (!order) {
          return { status: 404, body: { error: 'Order not found' } };
        }

        if (!paymentStatus) {
          return { status: 400, body: { error: 'Invalid payment status' } };
        }

        updateOrderPayment(
          order,
          paymentStatus,
          payload.actor || 'payment-patch',
          payload.note || 'Payment status updated manually in MVP',
        );

        const notification = notifyOrderChange(
          db,
          order,
          'Оплата заказа обновлена',
          `${order.id}: ${order.paymentStatus}.`,
          'order_payment',
        );
        broadcastRealtime('order_payment', { notification, order }, db);

        return { status: 200, body: { order: makeOrderResponse(db, order, sessionContext) } };
      });

      sendJson(response, outcome.status, outcome.body);
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'orders' && pathParts[2] === 'service-share') {
      // Service-share оставлен для обратной совместимости. Доля сервиса больше
      // не начисляется, endpoint только нормализует старые поля в no-op режиме.
      const outcome = await mutateDb(async (db) => {
        const sessionContext = getSessionContext(db, request);
        const order = db.orders.find((item) => item.id === pathParts[1]);

        if (!sessionContext) {
          return { status: 401, body: { error: 'Authentication required' } };
        }

        if (!order) {
          return { status: 404, body: { error: 'Order not found' } };
        }

        const driver = order.driver?.id
          ? db.drivers.find((item) => item.id === order.driver.id)
          : undefined;

        if (!isAdminSession(sessionContext) && !canAccessDriver(sessionContext, driver)) {
          return { status: 403, body: { error: 'Service share access denied' } };
        }

        updateOrderServiceShare(order);

        return {
          status: 200,
          body: {
            order: makeOrderResponse(db, order, sessionContext),
            summary: makeServiceShareSummary(db, order.serviceShareBatchDate),
          },
        };
      });

      sendJson(response, outcome.status, outcome.body);
      return;
    }

    if (pathParts[0] === 'internal' && !hasInternalAccess(request, url)) {
      sendJson(response, 401, { error: 'Internal API token required' });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/internal/billing/client-charge') {
      const payload = await readBody(request);
      if (payload.forceFail) {
        sendJson(response, 402, { error: 'Client charge failed by test flag' });
        return;
      }

      sendJson(response, 200, {
        charge: {
          amount: Number(payload.amount || 0),
          id: `charge-${randomUUID().slice(0, 10)}`,
          orderId: String(payload.orderId || ''),
          status: 'paid',
        },
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/internal/billing/driver-credit') {
      const payload = await readBody(request);
      const ledgerItem = {
        amount: Number(payload.amount || 0),
        createdAt: new Date().toISOString(),
        driverId: String(payload.driverId || ''),
        id: `ledger-${randomUUID().slice(0, 10)}`,
        kind: payload.compensation ? 'driver_compensation' : 'driver_trip_credit',
        orderId: String(payload.orderId || ''),
      };
      db.walletLedger.unshift(ledgerItem);
      await writeDb(db);
      sendJson(response, 200, { credit: ledgerItem });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/internal/dispatch/offers') {
      const payload = await readBody(request);
      const offerOrder = payload.order && typeof payload.order === 'object' ? payload.order : {};
      const notification = addRealtimeNotification(db, {
        audience: 'driver',
        body: `${offerOrder.pickup || 'Адрес подачи'} → ${offerOrder.destination || 'назначение'} · ${offerOrder.total || ''} ₽`,
        driverId: payload.driverId,
        kind: 'dispatch_offer',
        orderId: payload.orderId,
        title: 'Новый заказ',
      });
      await sendPushToDriver(db, String(payload.driverId || ''), notification, {
        actionCategory: 'driver_order_offer',
        distanceMeters: payload.distanceMeters || payload.distance_meters || '',
        expiresInSeconds: payload.expiresInSeconds || 15,
        offerId: payload.offerId || '',
        orderId: payload.orderId || '',
      });
      await writeDb(db);
      broadcastRealtime('dispatch_offer', { notification, offer: payload }, db);
      sendJson(response, 200, { notification, ok: true });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/internal/notifications') {
      const payload = await readBody(request);
      const notification = addRealtimeNotification(db, {
        audience: payload.audience || 'all',
        body: payload.body,
        driverId: payload.driverId,
        kind: payload.kind || 'system',
        orderId: payload.orderId,
        title: payload.title || 'Уведомление',
        userId: payload.userId,
      });
      await writeDb(db);
      broadcastRealtime('notification', { notification }, db);
      sendJson(response, 200, { notification });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/internal/marketing/monthly-location-bonuses') {
      const rewarded = accrueMonthlyMarketingLocationBonuses(db);

      await writeDb(db);
      sendJson(response, 200, { rewarded });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/internal/marketing/check-thresholds') {
      let checked = 0;

      for (const order of db.orders) {
        if (['closed', 'completed'].includes(order.status)) {
          settleMarketingForOrder(db, order);
          checked += 1;
        }
      }

      await writeDb(db);
      sendJson(response, 200, { checked });
      return;
    }

    if (pathParts[0] === 'parks' && pathParts[1]) {
      const sessionContext = getSessionContext(db, request);
      const parkId = pathParts[1];
      const park = db.parks.find((item) => item.id === parkId);

      if (!park) {
        sendJson(response, 404, { error: 'Park not found' });
        return;
      }

      if (!canAccessPark(sessionContext, park)) {
        sendJson(response, sessionContext ? 403 : 401, { error: 'Park access denied' });
        return;
      }

      if (request.method === 'GET' && pathParts[2] === 'dashboard') {
        const parkDrivers = getParkDriverProfiles(db, parkId);
        const parkOrders = db.orders.filter((order) => order.parkId === parkId);
        const completedOrders = parkOrders.filter((order) => ['closed', 'completed'].includes(order.status));
        const revenue = completedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
        sendJson(response, 200, {
          dashboard: {
            activeDrivers: parkDrivers.filter((driver) => driver.parkDriverStatus === 'active').length,
            commission: 0,
            orders: parkOrders.length,
            park,
            revenue,
            subscription: getParkSubscriptionSummary(park),
          },
        });
        return;
      }

      if (request.method === 'GET' && pathParts[2] === 'drivers' && !pathParts[3]) {
        sendJson(response, 200, { drivers: getParkDriverProfiles(db, parkId), invites: getOpenParkInvites(db, parkId) });
        return;
      }

      if (request.method === 'POST' && pathParts[2] === 'drivers' && pathParts[3] === 'invite') {
        const payload = await readBody(request);
        const inviteCode = makeParkInviteCode(park);
        const invite = normalizeParkDriver({
          id: `park-driver-invite-${randomUUID().slice(0, 8)}`,
          parkId,
          inviteCode,
          invitedByUserId: park.ownerUserId,
          invitedAt: new Date().toISOString(),
          status: 'invited',
          contact: payload.email || payload.phone || '',
        });
        db.parkDrivers.unshift(invite);
        await writeDb(db);
        sendJson(response, 201, {
          invite,
          inviteUrl: `${inviteBaseUrl}/${inviteCode}?role=park_driver`,
        });
        return;
      }

      if (request.method === 'PATCH' && pathParts[2] === 'drivers' && pathParts[3]) {
        const payload = await readBody(request);
        const link = db.parkDrivers.find(
          (item) => item.parkId === parkId && (item.driverId === pathParts[3] || item.userId === pathParts[3]),
        );
        const driver = db.drivers.find((item) => item.id === pathParts[3] || item.userId === pathParts[3]);

        if (!link || !driver) {
          sendJson(response, 404, { error: 'Park driver not found' });
          return;
        }

        link.status = ['active', 'blocked', 'invited'].includes(payload.status) ? payload.status : link.status;
        link.updatedAt = new Date().toISOString();
        driver.parkDriverStatus = link.status;
        applyDriverAccessState(driver);
        applyParkDriverAccessState(driver, db);
        await writeDb(db);
        sendJson(response, 200, { driver, link });
        return;
      }

      if (request.method === 'GET' && pathParts[2] === 'vehicles') {
        sendJson(response, 200, { vehicles: db.parkVehicles.filter((vehicle) => vehicle.parkId === parkId) });
        return;
      }

      if (request.method === 'POST' && pathParts[2] === 'vehicles') {
        const payload = await readBody(request);
        const vehicle = normalizeParkVehicle({
          ...payload,
          id: `vehicle-${randomUUID().slice(0, 8)}`,
          parkId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        db.parkVehicles.unshift(vehicle);
        await writeDb(db);
        sendJson(response, 201, { vehicle });
        return;
      }

      if (request.method === 'GET' && pathParts[2] === 'orders') {
        sendJson(response, 200, {
          orders: db.orders
            .filter((order) => order.parkId === parkId)
            .map((order) => makeOrderResponse(db, order, sessionContext)),
        });
        return;
      }

      if (request.method === 'GET' && pathParts[2] === 'finance') {
        const orders = db.orders.filter((order) => order.parkId === parkId);
        const completedOrders = orders.filter((order) => ['closed', 'completed'].includes(order.status));
        const revenue = completedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
        sendJson(response, 200, {
          finance: {
            commission: 0,
            payouts: revenue,
            revenue,
            subscription: getParkSubscriptionSummary(park),
            subscriptionPayments: db.subscriptions.filter((subscription) => subscription.parkId === parkId),
          },
        });
        return;
      }

      if (request.method === 'POST' && pathParts[2] === 'subscription' && pathParts[3] === 'activate') {
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + parkAccessPlan.accessDays);
        park.status = 'active';
        park.subscriptionExpiresAt = expiresAt.toISOString();
        park.updatedAt = now.toISOString();
        const subscription = normalizeSubscription({
          id: `sub-${randomUUID().slice(0, 10)}`,
          parkId,
          type: 'park_monthly',
          amount: parkAccessPlan.monthlyPrice,
          startsAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          status: 'active',
        });
        db.subscriptions.unshift(subscription);
        db.drivers.filter((driver) => driver.parkId === parkId).forEach((driver) => {
          applyDriverAccessState(driver);
          applyParkDriverAccessState(driver, db);
        });
        await writeDb(db);
        sendJson(response, 200, { park, subscription });
        return;
      }

      if (request.method === 'GET' && pathParts[2] === 'documents') {
        sendJson(response, 200, {
          documents: getParkDriverProfiles(db, parkId).map((driver) => ({
            driverId: driver.id,
            documentsStatus: driver.documentsStatus,
            osago: driver.documentUploads?.osago,
            permitStatus: driver.vehiclePermitStatus,
            license: driver.documentUploads?.driverLicense,
          })),
        });
        return;
      }
    }

    if (request.method === 'PATCH' && pathParts[0] === 'orders' && pathParts[2] === 'assign') {
      const payload = await readBody(request);
      // Назначение заказа идёт через сериализованную критическую секцию: проверка
      // доступности и присвоение водителя выполняются на свежем состоянии под замком,
      // поэтому два водителя не могут одновременно «принять» один и тот же заказ.
      const outcome = await mutateDb(async (db) => {
        const sessionContext = getSessionContext(db, request);
        const order = db.orders.find((item) => item.id === pathParts[1]);
        const driver = getDriverForSession(db, sessionContext, String(payload.driverId || ''));

        if (!sessionContext) {
          return { status: 401, body: { error: 'Authentication required' } };
        }

        if (!order) {
          return { status: 404, body: { error: 'Order not found' } };
        }

        if (!driver) {
          return { status: 404, body: { error: 'Driver not found' } };
        }

        applyDriverAccessState(driver);

        if (!driver.canReceiveOrders) {
          return {
            status: 403,
            body: { driver: makeDriverResponse(db, driver, sessionContext), error: 'Driver is not allowed to receive orders yet' },
          };
        }

        if (order.driver?.id) {
          // Идемпотентность: повторный «принять» тем же водителем (ретрай сети, двойной
          // тап) — не конфликт, а no-op. Возвращаем текущий заказ и НЕ трогаем статус,
          // чтобы не откатить уже продвинувшийся заказ (arrived/started) обратно в accepted.
          if (String(order.driver.id) === String(driver.id)) {
            return { status: 200, body: { order: makeOrderResponse(db, order, sessionContext) } };
          }
          return {
            status: 409,
            body: { error: 'Order is already accepted by another driver', order: makeOrderResponse(db, order, sessionContext) },
          };
        }

        if (isExclusiveOfferActive(order) && String(order.exclusiveDriverId) !== String(driver.id)) {
          return {
            status: 409,
            body: { error: 'Order is temporarily offered to another driver', order: makeOrderResponse(db, order, sessionContext) },
          };
        }

        if (order.exclusiveDriverId && order.exclusiveOfferStatus === 'pending' && !isExclusiveOfferActive(order)) {
          releaseExclusiveOffer(order, 'expired');
        }

        if (!['created', 'searching'].includes(order.status)) {
          return {
            status: 409,
            body: { error: 'Order is not open for dispatch', order: makeOrderResponse(db, order, sessionContext) },
          };
        }

        const now = new Date().toISOString();
        order.driver = {
          billingMode: driver.billingMode,
          commissionTrialEndsAt: driver.commissionTrialEndsAt,
          commissionTrialOrderLimit: driver.commissionTrialOrderLimit,
          commissionTrialStartedAt: driver.commissionTrialStartedAt,
          driverTariff: getDriverAccessPlan(driver.billingMode).name,
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          rating: driver.rating,
          subscriptionExpiresAt: driver.subscriptionExpiresAt || driver.accessExpiresAt,
          subscriptionPlan: driver.subscriptionPlan || getDriverSubscriptionPlanId(driver.billingMode),
          subscriptionStatus: driver.subscriptionStatus,
          vehicle: driver.vehicle,
          plate: driver.plate,
          payoutAccount: driver.payoutAccount || '',
        };
        order.fulfilledByRole = normalizeFulfilledByRole(payload.fulfilledByRole, driver.employmentType === 'park_driver' ? 'park_driver' : 'self_employed_driver');
        order.parkId = payload.parkId ? String(payload.parkId) : driver.parkId || order.parkId;
        order.batchId = payload.batchId ? String(payload.batchId) : order.batchId;
        if (order.safetyPinRequired && !order.tripPin) {
          order.tripPin = createTripPin();
        }
        order.acceptedAt = now;
        order.status = 'accepted';
        if (String(order.exclusiveDriverId || '') === String(driver.id)) {
          order.exclusiveOfferStatus = 'accepted';
          order.dispatchStatus = 'accepted_from_exclusive';
        } else {
          order.dispatchStatus = 'accepted_from_feed';
        }
        order.updatedAt = now;
        addOrderStatusHistory(order, order.status, driver.id);
        const notification = notifyOrderChange(
          db,
          order,
          'Водитель назначен',
          `${driver.name} принял ${order.id}: ${formatOrderRoute(order)}.`,
          'order_assigned',
        );
        await sendPushToUser(db, order.userId, notification, {
          orderId: order.id,
          status: order.status,
        }, ['client']);
        if (order.parkId) {
          await sendPushToPark(db, order.parkId, notification, {
            orderId: order.id,
            status: order.status,
          });
        }
        await sendPushToAdmins(db, notification, {
          orderId: order.id,
          status: order.status,
        });
        broadcastRealtime('order_assigned', { notification, order }, db);

        return { status: 200, body: { order: makeOrderResponse(db, order, sessionContext) } };
      });

      sendJson(response, outcome.status, outcome.body);
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

const realtimeWebSocketServer = new WebSocketServer({ path: '/realtime/ws', server });

realtimeWebSocketServer.on('connection', async (socket, request) => {
  try {
    const db = await readDb();
    const url = new URL(request.url || '/realtime/ws', `http://${request.headers.host || 'localhost'}`);
    const sessionContext = getSessionContext(db, request, { allowQueryToken: true, url });

    if (!sessionContext) {
      sendRealtimeSocketEvent(socket, 'error', {
        error: 'Authentication required',
        snapshot: {
          drivers: [],
          generatedAt: new Date().toISOString(),
          notifications: [],
          orders: [],
          supportThreads: [],
        },
      });
      socket.close();
      return;
    }

    socket.sessionContext = sessionContext;
    realtimeSocketClients.add(socket);

    socket.on('close', () => {
      realtimeSocketClients.delete(socket);
    });

    socket.on('error', () => {
      realtimeSocketClients.delete(socket);
    });

    sendRealtimeSocketEvent(socket, 'snapshot', {
      clientId: randomUUID(),
      snapshot: createRealtimeSnapshot(db, sessionContext),
    });
  } catch (error) {
    sendRealtimeSocketEvent(socket, 'error', {
      error: error.message || 'Realtime snapshot failed',
      snapshot: {
        drivers: [],
        generatedAt: new Date().toISOString(),
        notifications: [],
        orders: [],
        supportThreads: [],
      },
    });
    socket.close();
  }
});

const realtimeWebSocketHeartbeat = setInterval(() => {
  for (const socket of realtimeSocketClients) {
    if (socket.readyState !== WebSocket.OPEN) {
      realtimeSocketClients.delete(socket);
      continue;
    }

    socket.ping();
  }
}, 25000);

server.listen(port, () => {
  console.log(`Taxi Partner MVP backend: http://localhost:${port}`);
  console.log(`Backend env: ${backendEnvironment}`);
  console.log(
    storageDriver === 'postgres'
      ? `Storage: postgres table=${postgresStateTable} key=${postgresStateKey}`
      : `Storage: json path=${dbPath}`,
  );
});

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down backend`);
  clearInterval(realtimeWebSocketHeartbeat);
  realtimeWebSocketServer.close();
  for (const socket of realtimeSocketClients) {
    socket.close();
  }
  server.close(() => {
    closeStorage()
      .catch((error) => {
        console.error(`Storage close failed: ${error.message}`);
      })
      .finally(() => {
        process.exit(0);
      });
  });

  setTimeout(() => {
    process.exit(1);
  }, 10000).unref();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
