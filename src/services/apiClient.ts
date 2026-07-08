import RNEventSource from 'react-native-sse';

import { AccountRole } from '../data/registration';
import {
  DriverBillingMode,
  DriverPaymentProvider,
  DriverSubscriptionPayment,
} from '../data/subscription';
import { OrderStatusSummary } from '../navigation/types';
import type {
  AppOrder,
  DriverDocumentKind,
  DriverDocumentUpload,
  DriverDocumentUploadInput,
  DriverProfile,
  DriverServiceShareStatus,
  PaymentStatus,
  SupportThread,
} from '../state/AppState';
import {
  getPublicEnv,
  isProductionApp,
  isReleaseUnsafePublicValue,
} from '../utils/runtimeFlags';

const developmentApiUrl = 'http://localhost:3100';
let apiAuthToken: string | undefined;

export type ApiHealth = {
  ok: boolean;
  service: string;
  dbPath: string;
};

export type AuthRole = AccountRole | 'admin';

export type AuthUser = {
  id: string;
  role: AuthRole;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailVerifiedAt?: string;
  phone?: string;
  phoneVerifiedAt?: string;
  parkId?: string;
  parkName?: string;
  verificationStatus?: string;
  referralCode?: string;
  referredByCode?: string;
  bonusBalance?: number;
};

export type AuthSession = {
  id: string;
  token: string;
  userId: string;
  role: AuthRole;
  createdAt: string;
  expiresAt?: string;
};

export type AuthResult = {
  session: AuthSession;
  user: AuthUser;
};

export type PushTokenPayload = {
  appOwnership?: string;
  deviceName?: string;
  deviceType?: string;
  platform: 'android' | 'ios' | 'web' | string;
  role: AuthRole;
  token: string;
  tokenType: 'fcm' | 'apns' | 'expo' | string;
  userId: string;
};

export type VerificationChannel = 'email' | 'phone';
export type AuthDeliveryChannel = 'email' | 'max' | 'sms' | 'telegram';

export type VerificationCodeResult = {
  channel: VerificationChannel;
  code?: string;
  deliveryChannel?: AuthDeliveryChannel;
  deliveryMode: 'accepted' | 'mvp-returned-code' | 'provider-sent';
  expiresAt: string;
  messageId?: string;
  provider?: string;
  target: string;
};

export type VerifyCodeResult = {
  channel: VerificationChannel;
  user: AuthUser;
};

export type PasswordResetCodeResult = {
  code?: string;
  deliveryChannel?: AuthDeliveryChannel;
  deliveryMode: 'accepted' | 'mvp-returned-code' | 'provider-sent';
  expiresAt?: string;
  messageId?: string;
  ok: boolean;
  provider?: string;
  target?: string;
};

export type SmsLoginCodeResult = {
  code?: string;
  deliveryChannel?: Extract<AuthDeliveryChannel, 'max' | 'sms' | 'telegram'>;
  deliveryMode: 'accepted' | 'mvp-returned-code' | 'provider-sent';
  expiresAt?: string;
  messageId?: string;
  ok: boolean;
  provider?: string;
  target?: string;
};

export type AccountDeletionResult = {
  deletedAt: string;
  ok: boolean;
  removed: {
    account: number;
    driverDocuments: number;
    driverPayments: number;
    drivers: number;
    notifications: number;
    ordersAnonymized: number;
    passwordResetTokens: number;
    referrals: number;
    sessions: number;
    supportThreads: number;
    verificationCodes: number;
    walletLedger: number;
  };
};

export type RegisterAccountPayload = {
  role: AccountRole;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password: string;
  carBrand?: string;
  carModel?: string;
  carPlate?: string;
  companyName?: string;
  driverInn?: string;
  driverLicense?: string;
  drivingExperienceSince?: string;
  fleetContact?: string;
  fleetPayoutAccount?: string;
  inn?: string;
  legalAddress?: string;
  noLegalRestrictionsDeclaration?: string;
  ogrn?: string;
  parkInviteCode?: string;
  passportSeriesNumber?: string;
  payoutAccount?: string;
  stsNumber?: string;
  taxiParkDriverAgreement?: string;
  taxStatus?: string;
  vehicleDocumentsReady?: string;
  referralCode?: string;
};

export type CreateOrderPayload = OrderStatusSummary & {
  role: AccountRole;
  clientName?: string;
  clientPhone?: string;
  clientRequestId?: string;
  optionsTotal?: number;
  pickupPoint?: ApiGeoPoint;
  routeEstimate?: ApiRouteEstimate;
  safetyPinRequired?: boolean;
  tariffId?: string;
  useBonus?: boolean;
  userId?: string;
};

export type CreateDriverPayload = {
  name: string;
  phone?: string;
  vehicle?: string;
  plate?: string;
  status?: DriverProfile['status'];
  billingMode?: DriverBillingMode;
  subscriptionStatus?: DriverProfile['subscriptionStatus'];
};

export type DriverBillingDashboard = {
  driver: DriverProfile;
  payments: DriverSubscriptionPayment[];
  provider: DriverPaymentProvider;
  activePayment?: DriverSubscriptionPayment;
};

export type DriverPaymentSettings = {
  amount: number;
  dailyAmount?: number;
  monthlyAmount?: number;
  cardMask?: string;
  cardNumber?: string;
  cardHolder?: string;
  instructions: string;
  planName: string;
};

export type DriverServiceShareSummaryDriver = {
  billingMode?: DriverBillingMode;
  confirmedAmount: number;
  currentCommissionPercent?: number;
  driverId: string;
  driverName: string;
  ordersCount: number;
  pendingTransferAmount: number;
  reportedTransferAmount: number;
  settlementStatus?: DriverServiceShareStatus;
  subscriptionExpiresAt?: string;
  subscriptionPlan?: string;
  totalCollectedAmount: number;
  totalDriverNetAmount?: number;
  totalServiceShareAmount: number;
};

export type DriverServiceShareSummaryOrder = {
  commissionPercent?: number;
  dailyOrderNumber?: number;
  driverId?: string;
  driverName?: string;
  id: string;
  serviceShareAmount: number;
  status: DriverServiceShareStatus;
  total: number;
};

export type DriverServiceShareSummary = {
  date: string;
  drivers: DriverServiceShareSummaryDriver[];
  orders: DriverServiceShareSummaryOrder[];
  summary: {
    confirmedAmount: number;
    ordersCount: number;
    pendingTransferAmount: number;
    reportedTransferAmount: number;
    totalCollectedAmount: number;
    totalServiceShareAmount: number;
  };
};

export type DriverCompliancePatch = {
  contractStatus?: DriverProfile['contractStatus'];
  documentsStatus?: DriverProfile['documentsStatus'];
  registryStatus?: DriverProfile['registryStatus'];
  taxProfileStatus?: DriverProfile['taxProfileStatus'];
  vehiclePermitStatus?: DriverProfile['vehiclePermitStatus'];
};

export type DriverDocumentReviewPayload = {
  note?: string;
  reason?: string;
  rejectedKinds?: Array<DriverDocumentUploadInput['kind']>;
  status: DriverProfile['documentsStatus'];
};

export type DriverDocumentFileResult = {
  blob: Blob;
  contentType: string;
  fileName?: string;
  size: number;
};

export type ReferralStatus = 'registered' | 'qualified' | 'rewarded' | 'blocked';

export type ReferralRecord = {
  id: string;
  inviterUserId: string;
  inviterName?: string;
  inviterPhone?: string;
  inviteeUserId: string;
  inviteeName?: string;
  inviteePhone?: string;
  inviteeRole: AccountRole;
  code: string;
  status: ReferralStatus;
  rewardAmount: number;
  inviteeBonusAmount: number;
  createdAt: string;
  qualifiedAt?: string;
  rewardedAt?: string;
  note: string;
  progress?: ReferralProgress;
  viewerRelation?: 'inviter' | 'invitee' | 'none';
};

export type ReferralProgress = {
  actualCompletedOrders: number;
  completedOrders: number;
  requiredOrders: number;
  remainingOrders: number;
  percent: number;
};

export type WalletLedgerEntry = {
  id: string;
  userId: string;
  amount: number;
  status: 'available' | 'pending' | 'used' | 'cancelled';
  reason: string;
  sourceType: 'referral' | 'trip' | 'manual';
  sourceId: string;
  createdAt: string;
  balanceAfter?: number;
  expiresAt?: string;
};

export type ReferralDashboard = {
  userId: string;
  referralCode: string;
  inviteUrl: string;
  inviteUrls?: {
    client: string;
    driver?: string;
    self_employed_driver?: string;
  };
  bonusBalance: number;
  referrals: ReferralRecord[];
  walletLedger: WalletLedgerEntry[];
  rewards: {
    bonusExpiresDays?: number;
    clientQualificationOrders: number;
    invitedClientBonus: number;
    clientReward: number;
    driverReward: number;
    driverQualificationOrders: number;
    driverTrialDays: number;
  };
};

export type AdminReferralDashboard = {
  referrals: ReferralRecord[];
  rewards: ReferralDashboard['rewards'];
  summary: {
    referrals: number;
    registered: number;
    qualified: number;
    rewarded: number;
    blocked?: number;
    walletEntries: number;
    walletAvailable?: number;
    walletTotal: number;
    walletUsed?: number;
  };
  walletLedger: WalletLedgerEntry[];
};

export type Park = {
  id: string;
  organisationName: string;
  inn: string;
  ogrn: string;
  legalAddress: string;
  contactPhone: string;
  settlementAccount: string;
  ownerUserId: string;
  subscriptionExpiresAt?: string;
  status: 'active' | 'blocked' | 'pending';
  createdAt: string;
  updatedAt: string;
};

export type ParkDriverLink = {
  id: string;
  userId: string;
  driverId: string;
  parkId: string;
  contact: string;
  inviteCode: string;
  invitedAt: string;
  invitedByUserId: string;
  status: 'active' | 'blocked' | 'invited';
  createdAt: string;
  updatedAt: string;
};

export type ParkVehicle = {
  id: string;
  parkId: string;
  driverId?: string;
  brand: string;
  model: string;
  plate: string;
  stsNumber: string;
  status: 'active' | 'disabled' | 'maintenance';
  createdAt: string;
  updatedAt: string;
};

export type ParkVehiclePayload = {
  brand?: string;
  carBrand?: string;
  carModel?: string;
  carPlate?: string;
  driverId?: string;
  model?: string;
  plate?: string;
  status?: ParkVehicle['status'];
  stsNumber?: string;
};

export type ParkSubscriptionSummary = {
  amount: number;
  commissionPercent: number;
  expiresAt?: string;
  status: 'active' | 'expired';
  type: 'park_monthly';
};

export type ParkSubscriptionRecord = {
  id: string;
  userId?: string;
  parkId?: string;
  type: 'driver_monthly' | 'park_monthly';
  amount: number;
  startsAt: string;
  expiresAt: string;
  status: 'active' | 'cancelled' | 'expired';
  createdAt: string;
  updatedAt: string;
};

export type ParkDashboard = {
  activeDrivers: number;
  commission: number;
  orders: number;
  park: Park;
  revenue: number;
  subscription: ParkSubscriptionSummary;
};

export type ParkDriversResult = {
  drivers: DriverProfile[];
  invites: ParkDriverLink[];
};

export type ParkInviteResult = {
  invite: ParkDriverLink;
  inviteUrl: string;
};

export type ParkFinance = {
  commission: number;
  payouts: number;
  revenue: number;
  subscription: ParkSubscriptionSummary;
  subscriptionPayments: ParkSubscriptionRecord[];
};

export type ParkDriverDocumentSummary = {
  driverId: string;
  documentsStatus: DriverProfile['documentsStatus'];
  osago?: DriverDocumentUpload;
  permitStatus: DriverProfile['vehiclePermitStatus'];
  license?: DriverDocumentUpload;
};

export type ApiGeoPoint = {
  latitude: number;
  longitude: number;
};

export type ApiGeoProvider = {
  mode: 'local' | 'provider' | string;
  name: string;
  url?: string;
};

export type ApiAddressSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  settlement: string;
  category: string;
  aliases: string[];
  source: string;
  displayAddress: string;
  coordinates?: ApiGeoPoint;
};

export type AdminAddressPoint = {
  aliases?: string[];
  category: string;
  coordinates?: ApiGeoPoint;
  createdAt?: string;
  displayAddress?: string;
  id: string;
  settlement: string;
  source: string;
  subtitle: string;
  title: string;
  updatedAt?: string;
};

export type AdminAddressPointPayload = {
  aliases?: string[];
  category?: string;
  coordinates?: ApiGeoPoint;
  displayAddress?: string;
  settlement?: string;
  subtitle?: string;
  title: string;
};

export type ApiRouteEstimate = {
  calculatedAt?: string;
  confidence: 'draft' | 'estimated' | 'preset';
  currency?: 'RUB' | string;
  distanceKm: number;
  distancePrice: number;
  durationMin: number;
  eta?: string;
  note: string;
  provider?: ApiGeoProvider;
  tariffId?: string;
  total: number;
};

export type ApiRouteEstimateRequest = {
  destination: string;
  minimumPrice?: number;
  options?: string[];
  optionsTotal?: number;
  pickup: string;
  role: AccountRole;
  serviceType?: 'delivery' | 'taxi';
  stopsCount?: number;
  tariff?: string;
  tariffId?: string;
};

export type ReverseGeocodeAddress = ApiAddressSuggestion & {
  latitude: number;
  longitude: number;
  region?: string;
};

export type ReferralCodeValidation = {
  code: string;
  error?: string;
  inviterName?: string;
  valid: boolean;
};

export type RealtimeNotification = {
  audience: 'admin' | 'all' | 'client' | 'driver' | 'park';
  body: string;
  createdAt: string;
  driverId?: string;
  id: string;
  kind: string;
  orderId?: string;
  readAt?: string;
  title: string;
  userId?: string;
};

export type RealtimeSnapshot = {
  drivers: DriverProfile[];
  generatedAt: string;
  notifications: RealtimeNotification[];
  orders: AppOrder[];
  supportThreads?: SupportThread[];
};

export type RealtimeDriverLocation = {
  accuracy?: number;
  latitude: number;
  longitude: number;
  updatedAt?: string;
};

export type RealtimeEventPayload = {
  clientId?: string;
  driver?: DriverProfile;
  // Лёгкое событие driver_location: точка без snapshot.
  driverId?: string;
  location?: RealtimeDriverLocation;
  notification?: RealtimeNotification;
  order?: AppOrder;
  offer?: unknown;
  sentAt: string;
  snapshot?: RealtimeSnapshot;
  type: string;
};

export type RealtimeConnectionMode = 'websocket' | 'event-stream' | 'polling';

type EventSourceLike = {
  addEventListener?: (event: string, listener: (event: { data?: string }) => void) => void;
  close: () => void;
  onopen?: unknown;
  onerror?: unknown;
  onmessage?: unknown;
};

type WebSocketLike = {
  close: () => void;
  onclose?: unknown;
  onerror?: unknown;
  onmessage?: unknown;
  onopen?: unknown;
  readyState?: number;
};

export function setApiAuthToken(token?: string) {
  apiAuthToken = token;
}

export function getApiBaseUrl() {
  const value = String(getPublicEnv('EXPO_PUBLIC_API_URL') || '').trim().replace(/\/+$/, '');

  if (value && !isReleaseUnsafePublicValue(value)) {
    if (isProductionApp() && !/^https:\/\//i.test(value)) {
      return getBrowserFallbackApiUrl();
    }

    return value;
  }

  if (isProductionApp()) {
    return getBrowserFallbackApiUrl();
  }

  return developmentApiUrl;
}

function getBrowserFallbackApiUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return developmentApiUrl;
}

export async function fetchApiHealth() {
  return request<ApiHealth>('/health');
}

export async function fetchRealtimeSnapshot() {
  return request<RealtimeSnapshot>('/realtime/snapshot');
}

function getRealtimeWebSocketUrl() {
  const url = new URL('/realtime/ws', getApiBaseUrl());
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

  return appendRealtimeAuthToken(url.toString());
}

function appendRealtimeAuthToken(url: string) {
  if (!apiAuthToken) {
    return url;
  }

  const targetUrl = new URL(url);
  targetUrl.searchParams.set('token', apiAuthToken);

  return targetUrl.toString();
}

function getRealtimeDelay(attempt: number) {
  return Math.min(30000, 1000 * 2 ** Math.max(0, attempt - 1));
}

function logRealtime(message: string, details?: unknown) {
  if (details) {
    console.info(`[realtime] ${message}`, details);
    return;
  }

  console.info(`[realtime] ${message}`);
}

export function subscribeRealtime({
  onError,
  onMessage,
  onModeChange,
  pollingMs = 5000,
}: {
  onError?: (error: Error) => void;
  onMessage: (payload: RealtimeEventPayload) => void;
  onModeChange?: (mode: RealtimeConnectionMode) => void;
  pollingMs?: number;
}) {
  const wsUrl = getRealtimeWebSocketUrl();
  const streamUrl = appendRealtimeAuthToken(`${getApiBaseUrl()}/realtime/stream`);
  const WebSocketCtor = (
    globalThis as {
      WebSocket?: new (url: string) => WebSocketLike;
    }
  ).WebSocket;
  const EventSourceCtor = (
    globalThis as {
      EventSource?: new (url: string) => unknown;
    }
  ).EventSource ?? RNEventSource;
  let closed = false;
  let eventSource: EventSourceLike | undefined;
  let pollingId: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let websocket: WebSocketLike | undefined;
  let websocketAttempt = 0;

  const handlePayload = (payload: RealtimeEventPayload, channel: RealtimeConnectionMode) => {
    logRealtime(`status received via ${channel}`, { type: payload.type, sentAt: payload.sentAt });
    onMessage(payload);
  };

  const emitSnapshot = async (type = 'poll') => {
    try {
      const snapshot = await fetchRealtimeSnapshot();

      if (!closed) {
        handlePayload({
          sentAt: new Date().toISOString(),
          snapshot,
          type,
        }, 'polling');
      }
    } catch (error) {
      if (!closed) {
        onError?.(error instanceof Error ? error : new Error('Realtime snapshot failed'));
      }
    }
  };

  const stopPolling = () => {
    if (!pollingId) {
      return;
    }

    clearInterval(pollingId);
    pollingId = undefined;
  };

  const stopEventStream = () => {
    if (!eventSource) {
      return;
    }

    eventSource.close();
    eventSource = undefined;
  };

  const stopWebSocket = () => {
    if (!websocket) {
      return;
    }

    websocket.close();
    websocket = undefined;
  };

  const startPolling = () => {
    if (pollingId) {
      return;
    }

    logRealtime('fallback channel enabled: polling');
    onModeChange?.('polling');
    void emitSnapshot('snapshot');
    pollingId = setInterval(() => {
      void emitSnapshot('poll');
    }, pollingMs);
  };

  const scheduleWebSocketRetry = () => {
    if (closed || retryTimer || !WebSocketCtor) {
      return;
    }

    websocketAttempt += 1;
    const delay = getRealtimeDelay(websocketAttempt);
    logRealtime(`websocket reconnect scheduled in ${delay} ms`);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      startWebSocket();
    }, delay);
  };

  const startEventStream = () => {
    if (closed || eventSource) {
      return;
    }

    if (!EventSourceCtor) {
      startPolling();
      scheduleWebSocketRetry();
      return;
    }

    try {
      logRealtime('fallback channel connecting: sse');
      onModeChange?.('event-stream');
      stopPolling();
      const source = new EventSourceCtor(streamUrl) as EventSourceLike;
      eventSource = source;

      const handleEvent = (event: { data?: string | null }) => {
        if (!event.data) {
          return;
        }

        try {
          const payload = JSON.parse(event.data) as RealtimeEventPayload;
          handlePayload(payload, 'event-stream');
        } catch (error) {
          onError?.(error instanceof Error ? error : new Error('Realtime event parse failed'));
        }
      };

      source.onmessage = handleEvent;
      source.onopen = () => {
        logRealtime('fallback channel connected: sse');
      };
      for (const eventName of [
        'driver_access',
        'driver_availability',
        'driver_compliance',
        'driver_created',
        'driver_documents',
        'driver_documents_review',
        'driver_location',
        'driver_payment',
        'driver_payment_refund',
        'driver_status',
        'dispatch_offer',
        'notification',
        'order_assigned',
        'order_created',
        'order_payment',
        'order_status',
        'snapshot',
      ]) {
        source.addEventListener?.(eventName, handleEvent);
      }
      source.onerror = () => {
        onError?.(new Error('Realtime stream disconnected, polling enabled'));
        logRealtime('fallback channel disconnected: sse');
        source.close();
        eventSource = undefined;
        startPolling();
        scheduleWebSocketRetry();
      };
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Realtime stream failed'));
      startPolling();
      scheduleWebSocketRetry();
    }
  };

  const handleWebSocketMessage = (event: { data?: unknown }) => {
    if (!event.data || typeof event.data !== 'string') {
      return;
    }

    try {
      const payload = JSON.parse(event.data) as RealtimeEventPayload;
      handlePayload(payload, 'websocket');
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Realtime websocket event parse failed'));
    }
  };

  function startWebSocket() {
    if (closed || websocket) {
      return;
    }

    if (!WebSocketCtor) {
      logRealtime('websocket unavailable in this runtime');
      startEventStream();
      return;
    }

    let socket: WebSocketLike | undefined;
    let connectTimeout: ReturnType<typeof setTimeout> | undefined;

    try {
      logRealtime('primary channel connecting: websocket');
      socket = new WebSocketCtor(wsUrl);
      websocket = socket;
      connectTimeout = setTimeout(() => {
        if (websocket === socket) {
          logRealtime('websocket connect timeout');
          socket?.close();
          websocket = undefined;
          startEventStream();
          scheduleWebSocketRetry();
        }
      }, 5000);

      socket.onopen = () => {
        if (connectTimeout) {
          clearTimeout(connectTimeout);
        }
        websocketAttempt = 0;
        logRealtime('primary channel connected: websocket');
        stopEventStream();
        stopPolling();
        onModeChange?.('websocket');
      };
      socket.onmessage = handleWebSocketMessage;
      socket.onerror = () => {
        onError?.(new Error('Realtime websocket error'));
      };
      socket.onclose = () => {
        if (connectTimeout) {
          clearTimeout(connectTimeout);
        }
        if (websocket === socket) {
          websocket = undefined;
        }
        if (!closed) {
          logRealtime('primary channel disconnected: websocket');
          startEventStream();
          scheduleWebSocketRetry();
        }
      };
    } catch (error) {
      if (connectTimeout) {
        clearTimeout(connectTimeout);
      }
      websocket = undefined;
      onError?.(error instanceof Error ? error : new Error('Realtime websocket failed'));
      startEventStream();
      scheduleWebSocketRetry();
    }
  }

  startWebSocket();

  return () => {
    closed = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
    }
    stopWebSocket();
    stopEventStream();
    stopPolling();
  };
}

export async function registerAccount(payload: RegisterAccountPayload) {
  return request<AuthResult>('/auth/register', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export async function loginAccount(identifier: string, password: string, role: AccountRole) {
  return request<AuthResult>('/auth/login', {
    body: JSON.stringify({ identifier, password, role }),
    method: 'POST',
  });
}

export async function requestSmsLoginCode(
  phone: string,
  role: AccountRole,
  deliveryChannel?: Extract<AuthDeliveryChannel, 'max' | 'sms' | 'telegram'>,
) {
  return request<SmsLoginCodeResult>('/auth/sms-login/request', {
    body: JSON.stringify({ deliveryChannel, phone, role }),
    method: 'POST',
  });
}

export async function confirmSmsLoginCode(phone: string, code: string, role: AccountRole) {
  return request<AuthResult>('/auth/sms-login/confirm', {
    body: JSON.stringify({ code, phone, role }),
    method: 'POST',
  });
}

export async function loginAdmin(password: string) {
  return request<AuthResult>('/auth/admin-login', {
    body: JSON.stringify({ password }),
    method: 'POST',
  });
}

export async function logoutAccount() {
  return request<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
  });
}

export async function logoutAllAccountSessions() {
  return request<{ ok: boolean }>('/auth/logout-all', {
    method: 'POST',
  });
}

export async function registerPushToken(payload: PushTokenPayload) {
  return request<{ ok: boolean }>('/push-tokens', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export async function deleteAccount(reason?: string) {
  return request<AccountDeletionResult>('/account/delete', {
    body: JSON.stringify({ reason }),
    method: 'POST',
  });
}

export async function requestVerificationCode(
  channel: VerificationChannel,
  target?: string,
  deliveryChannel?: AuthDeliveryChannel,
) {
  return request<VerificationCodeResult>('/auth/verification-code', {
    body: JSON.stringify({ channel, deliveryChannel, target }),
    method: 'POST',
  });
}

export async function verifyContactCode(channel: VerificationChannel, code: string, target?: string) {
  return request<VerifyCodeResult>('/auth/verify-code', {
    body: JSON.stringify({ channel, code, target }),
    method: 'POST',
  });
}

export async function requestPasswordResetCode(
  identifier: string,
  deliveryChannel?: AuthDeliveryChannel,
) {
  return request<PasswordResetCodeResult>('/auth/password-reset/request', {
    body: JSON.stringify({ deliveryChannel, identifier }),
    method: 'POST',
  });
}

export async function confirmPasswordReset(identifier: string, code: string, password: string) {
  return request<AuthResult>('/auth/password-reset/confirm', {
    body: JSON.stringify({ code, identifier, password }),
    method: 'POST',
  });
}

export async function fetchUsers() {
  const payload = await request<{ users: AuthUser[] }>('/users');
  return payload.users;
}

export async function fetchOrders() {
  const payload = await request<{ orders: AppOrder[] }>('/orders');
  return payload.orders;
}

export async function searchAddressSuggestions(query: string, point?: ApiGeoPoint, limit = 8) {
  const params = new URLSearchParams({
    limit: String(limit),
    query,
  });

  if (point) {
    params.set('latitude', String(point.latitude));
    params.set('longitude', String(point.longitude));
  }

  const payload = await request<{ suggestions: ApiAddressSuggestion[] }>(
    `/geo/address-search?${params.toString()}`,
  );

  return payload.suggestions;
}

export async function reverseGeocodeAddress(point: ApiGeoPoint) {
  const params = new URLSearchParams({
    latitude: String(point.latitude),
    longitude: String(point.longitude),
  });
  const payload = await request<{ address: ReverseGeocodeAddress; status: 'resolved' }>(
    `/geo/reverse?${params.toString()}`,
  );

  return payload.address;
}

export async function fetchAdminAddresses() {
  const payload = await request<{ addresses: AdminAddressPoint[] }>('/admin/addresses');
  return payload.addresses;
}

export async function createAdminAddress(payload: AdminAddressPointPayload) {
  const response = await request<{ address: AdminAddressPoint }>('/admin/addresses', {
    body: JSON.stringify(payload),
    method: 'POST',
  });

  return response.address;
}

export async function updateAdminAddress(addressId: string, payload: AdminAddressPointPayload) {
  const response = await request<{ address: AdminAddressPoint }>(
    `/admin/addresses/${encodeURIComponent(addressId)}`,
    {
      body: JSON.stringify(payload),
      method: 'PATCH',
    },
  );

  return response.address;
}

export async function deleteAdminAddress(addressId: string) {
  return request<{ ok: boolean }>(`/admin/addresses/${encodeURIComponent(addressId)}`, {
    method: 'DELETE',
  });
}

export async function estimateRoutePrice(payload: ApiRouteEstimateRequest) {
  const response = await request<{ estimate: ApiRouteEstimate }>('/geo/routes', {
    body: JSON.stringify(payload),
    method: 'POST',
  });

  return response.estimate;
}

export async function createOrder(payload: CreateOrderPayload) {
  const response = await request<{ order: AppOrder }>('/orders', {
    body: JSON.stringify({
      ...payload,
      clientRequestId: payload.clientRequestId || payload.id,
    }),
    method: 'POST',
  });

  return response.order;
}

export async function updateOrderStatus(orderId: string, status: string, pinCode?: string) {
  const response = await request<{ order: AppOrder }>(`/orders/${encodeURIComponent(orderId)}/status`, {
    body: JSON.stringify({ pinCode, status }),
    method: 'PATCH',
  });

  return response.order;
}

export async function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus,
  note?: string,
) {
  const response = await request<{ order: AppOrder }>(
    `/orders/${encodeURIComponent(orderId)}/payment`,
    {
      body: JSON.stringify({ note, paymentStatus }),
      method: 'PATCH',
    },
  );

  return response.order;
}

export async function fetchServiceShareSummary(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const response = await request<{ summary: DriverServiceShareSummary }>(
    `/service-share/summary${query}`,
  );

  return response.summary;
}

export async function fetchDriverPaymentSettings() {
  return request<DriverPaymentSettings>('/driver-payments/settings');
}

export async function updateOrderServiceShareStatus(
  orderId: string,
  status: DriverServiceShareStatus,
  note?: string,
) {
  return request<{
    order: AppOrder;
    summary?: DriverServiceShareSummary;
  }>(`/orders/${encodeURIComponent(orderId)}/service-share`, {
    body: JSON.stringify({ note, status }),
    method: 'PATCH',
  });
}

export async function assignOrder(orderId: string, driverId: string) {
  const response = await request<{ order: AppOrder }>(`/orders/${encodeURIComponent(orderId)}/assign`, {
    body: JSON.stringify({ driverId }),
    method: 'PATCH',
  });

  return response.order;
}

export async function assignOrderWithStatus(orderId: string, driverId: string, status: string) {
  const response = await request<{ order: AppOrder }>(`/orders/${encodeURIComponent(orderId)}/assign`, {
    body: JSON.stringify({ driverId, status }),
    method: 'PATCH',
  });

  return response.order;
}

export async function declineOrderOffer(orderId: string, driverId: string) {
  const response = await request<{ order: AppOrder }>(`/orders/${encodeURIComponent(orderId)}/offer`, {
    body: JSON.stringify({ action: 'decline', driverId }),
    method: 'PATCH',
  });

  return response.order;
}

export async function validateReferralCode(code: string, email?: string, phone?: string) {
  const params = new URLSearchParams({ code });

  if (email) {
    params.set('email', email);
  }

  if (phone) {
    params.set('phone', phone);
  }

  return request<ReferralCodeValidation>(`/referrals/validate?${params.toString()}`);
}

export async function fetchReferralDashboard(userId: string) {
  return request<ReferralDashboard>(`/referrals?userId=${encodeURIComponent(userId)}`);
}

export async function ensureReferralCode(userId: string) {
  return request<ReferralDashboard>('/referrals/code', {
    body: JSON.stringify({ userId }),
    method: 'POST',
  });
}

export async function fetchAdminReferralDashboard() {
  return request<AdminReferralDashboard>('/admin/referrals');
}

export async function updateAdminReferralStatus(referralId: string, status: ReferralStatus, note?: string) {
  return request<AdminReferralDashboard>(`/admin/referrals/${encodeURIComponent(referralId)}/status`, {
    body: JSON.stringify({ note, status }),
    method: 'PATCH',
  });
}

export async function fetchAdminDriverPayments() {
  const response = await request<{ payments: DriverSubscriptionPayment[] }>('/admin/driver-payments');
  return response.payments;
}

export type AdminPricing = { dailyPrice: number; monthlyPrice: number };

export type AdminBlacklistEntry = {
  id: string;
  type: 'client' | 'driver';
  name: string;
  reason: string;
  addedAt: string;
};

export type AdminStats = {
  generatedAt: string;
  users: {
    total: number;
    clients: number;
    drivers: number;
    newBy: { hour: number; day: number; week: number; month: number; year: number };
    monthly: Array<{ label: string; total: number; clients: number; drivers: number }>;
  };
  money: {
    clientSpendTotal: number;
    driverEarningsTotal: number;
    myRevenueTotal: number;
    myRevenueBy: { day: number; week: number; month: number };
    clientSpendBy: { day: number; week: number; month: number };
    revenueMonthly: Array<{ label: string; access: number; trips: number }>;
    avgCheck: number;
  };
  orders: {
    total: number;
    completed: number;
    cancelled: number;
    active: number;
    byDay: Array<{ label: string; count: number }>;
    byVillage: Array<{ name: string; count: number }>;
  };
  drivers: {
    total: number;
    online: number;
    canReceiveOrders: number;
    blacklisted: number;
    byBilling: { daily: number; monthly: number };
    byStatus: { approved: number; pending: number };
    topVehicles: Array<{ name: string; count: number }>;
    ratingAvg: number;
  };
};

export async function fetchAdminStats() {
  return request<AdminStats>('/admin/stats');
}

export async function fetchAdminPricing() {
  const payload = await request<{ pricing: AdminPricing }>('/admin/settings');
  return payload.pricing;
}

export async function updateAdminPricing(pricing: Partial<AdminPricing>) {
  const payload = await request<{ pricing: AdminPricing }>('/admin/pricing', {
    body: JSON.stringify(pricing),
    method: 'PATCH',
  });
  return payload.pricing;
}

export async function fetchAdminBlacklist() {
  const payload = await request<{ items: AdminBlacklistEntry[] }>('/admin/blacklist');
  return payload.items;
}

export async function addToAdminBlacklist(entry: { id: string; type: 'client' | 'driver'; reason?: string }) {
  const payload = await request<{ items: AdminBlacklistEntry[] }>('/admin/blacklist', {
    body: JSON.stringify(entry),
    method: 'POST',
  });
  return payload.items;
}

export async function updateDriverAvatar(driverId: string, image: string) {
  const response = await request<{ driver: DriverProfile }>(
    `/drivers/${encodeURIComponent(driverId)}/avatar`,
    { body: JSON.stringify({ image }), method: 'PATCH' },
  );
  return response.driver;
}

export type DriverChatMessage = {
  id: string;
  driverId: string;
  driverName: string;
  avatar?: string;
  text: string;
  createdAt: string;
};

export async function fetchDriverChatMessages() {
  const payload = await request<{ messages: DriverChatMessage[] }>('/driver-chat');
  return payload.messages;
}

export async function sendDriverChatMessage(text: string) {
  const payload = await request<{ message: DriverChatMessage }>('/driver-chat', {
    body: JSON.stringify({ text }),
    method: 'POST',
  });
  return payload.message;
}

export async function removeFromAdminBlacklist(entryId: string) {
  const payload = await request<{ items: AdminBlacklistEntry[] }>(
    `/admin/blacklist/${encodeURIComponent(entryId)}`,
    { method: 'DELETE' },
  );
  return payload.items;
}

export async function fetchDrivers() {
  const payload = await request<{ drivers: DriverProfile[] }>('/drivers');
  return payload.drivers;
}

export async function fetchParkDashboard(parkId: string) {
  const payload = await request<{ dashboard: ParkDashboard }>(
    `/parks/${encodeURIComponent(parkId)}/dashboard`,
  );

  return payload.dashboard;
}

export async function fetchParkDrivers(parkId: string) {
  return request<ParkDriversResult>(`/parks/${encodeURIComponent(parkId)}/drivers`);
}

export async function inviteParkDriver(
  parkId: string,
  payload: {
    email?: string;
    phone?: string;
  },
) {
  return request<ParkInviteResult>(`/parks/${encodeURIComponent(parkId)}/drivers/invite`, {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export async function updateParkDriverStatus(
  parkId: string,
  driverId: string,
  status: ParkDriverLink['status'],
) {
  return request<{ driver: DriverProfile; link: ParkDriverLink }>(
    `/parks/${encodeURIComponent(parkId)}/drivers/${encodeURIComponent(driverId)}`,
    {
      body: JSON.stringify({ status }),
      method: 'PATCH',
    },
  );
}

export async function fetchParkVehicles(parkId: string) {
  const payload = await request<{ vehicles: ParkVehicle[] }>(
    `/parks/${encodeURIComponent(parkId)}/vehicles`,
  );

  return payload.vehicles;
}

export async function createParkVehicle(parkId: string, payload: ParkVehiclePayload) {
  const response = await request<{ vehicle: ParkVehicle }>(
    `/parks/${encodeURIComponent(parkId)}/vehicles`,
    {
      body: JSON.stringify(payload),
      method: 'POST',
    },
  );

  return response.vehicle;
}

export async function fetchParkOrders(parkId: string) {
  const payload = await request<{ orders: AppOrder[] }>(`/parks/${encodeURIComponent(parkId)}/orders`);

  return payload.orders;
}

export async function fetchParkFinance(parkId: string) {
  const payload = await request<{ finance: ParkFinance }>(
    `/parks/${encodeURIComponent(parkId)}/finance`,
  );

  return payload.finance;
}

export async function activateParkSubscription(parkId: string) {
  return request<{ park: Park; subscription: ParkSubscriptionRecord }>(
    `/parks/${encodeURIComponent(parkId)}/subscription/activate`,
    {
      method: 'POST',
    },
  );
}

export async function fetchParkDriverDocuments(parkId: string) {
  const payload = await request<{ documents: ParkDriverDocumentSummary[] }>(
    `/parks/${encodeURIComponent(parkId)}/documents`,
  );

  return payload.documents;
}

export async function fetchSupportThreads(role?: AccountRole, userId?: string) {
  const params = new URLSearchParams();

  if (role) {
    params.set('role', role);
  }

  if (userId) {
    params.set('userId', userId);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const payload = await request<{ threads: SupportThread[] }>(`/support/threads${suffix}`);

  return payload.threads;
}

export async function sendSupportMessageToServer(payload: {
  category: string;
  role: AccountRole;
  text: string;
  threadId?: string;
  title?: string;
  userId?: string;
  // Ответ администратора от лица поддержки в существующий тред.
  asSupport?: boolean;
}) {
  const response = await request<{ thread: SupportThread }>('/support/messages', {
    body: JSON.stringify(payload),
    method: 'POST',
  });

  return response.thread;
}

export async function createDriver(payload: CreateDriverPayload) {
  const response = await request<{ driver: DriverProfile }>('/drivers', {
    body: JSON.stringify(payload),
    method: 'POST',
  });

  return response.driver;
}

export async function updateDriverStatus(driverId: string, status: DriverProfile['status']) {
  const response = await request<{ driver: DriverProfile }>(
    `/drivers/${encodeURIComponent(driverId)}/status`,
    {
      body: JSON.stringify({ status }),
      method: 'PATCH',
    },
  );

  return response.driver;
}

export async function updateDriverCompliance(driverId: string, payload: DriverCompliancePatch) {
  const response = await request<{ driver: DriverProfile }>(
    `/drivers/${encodeURIComponent(driverId)}/compliance`,
    {
      body: JSON.stringify(payload),
      method: 'PATCH',
    },
  );

  return response.driver;
}

export async function submitDriverDocuments(
  driverId: string,
  documents: DriverDocumentUploadInput[],
) {
  const response = await request<{ driver: DriverProfile }>(
    `/drivers/${encodeURIComponent(driverId)}/documents`,
    {
      body: JSON.stringify({ documents }),
      method: 'POST',
    },
  );

  return response.driver;
}

export async function reviewDriverDocuments(driverId: string, payload: DriverDocumentReviewPayload) {
  const response = await request<{ driver: DriverProfile }>(
    `/drivers/${encodeURIComponent(driverId)}/documents/review`,
    {
      body: JSON.stringify(payload),
      method: 'PATCH',
    },
  );

  return response.driver;
}

export async function fetchDriverDocumentFile(
  driverId: string,
  kind: DriverDocumentKind,
): Promise<DriverDocumentFileResult> {
  const response = await fetch(
    `${getApiBaseUrl()}/drivers/${encodeURIComponent(driverId)}/documents/${encodeURIComponent(kind)}/file`,
    {
      headers: {
        ...(apiAuthToken ? { authorization: `Bearer ${apiAuthToken}` } : {}),
        accept: 'image/*',
      },
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Driver document request failed: ${response.status}`;

    throw new Error(message);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('content-disposition') || '';
  const fileName = contentDisposition.match(/filename="([^"]+)"/i)?.[1];

  return {
    blob,
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    fileName,
    size: blob.size,
  };
}

export async function updateDriverAvailability(
  driverId: string,
  isOnline: boolean,
  location?: ApiGeoPoint & { accuracy?: number },
) {
  const response = await request<{ driver: DriverProfile }>(
    `/drivers/${encodeURIComponent(driverId)}/availability`,
    {
      body: JSON.stringify({ isOnline, location }),
      method: 'PATCH',
    },
  );

  return response.driver;
}

// Лёгкий периодический GPS-пинг: только точка, без смены статуса линии.
export async function updateDriverLocation(
  driverId: string,
  location: ApiGeoPoint & { accuracy?: number },
) {
  const response = await request<{ driver: DriverProfile }>(
    `/drivers/${encodeURIComponent(driverId)}/location`,
    {
      body: JSON.stringify({ location }),
      method: 'PATCH',
    },
  );

  return response.driver;
}

export async function updateDriverAccess(
  driverId: string,
  billingMode: DriverBillingMode,
  subscriptionStatus: DriverProfile['subscriptionStatus'] = 'active',
  paymentMethod = 'Пилотная ручная активация',
) {
  const response = await request<{ driver: DriverProfile }>(
    `/drivers/${encodeURIComponent(driverId)}/access`,
    {
      body: JSON.stringify({ accessDays: 30, billingMode, paymentMethod, subscriptionStatus }),
      method: 'PATCH',
    },
  );

  return response.driver;
}

export async function fetchDriverBilling(driverId: string) {
  return request<DriverBillingDashboard>(`/drivers/${encodeURIComponent(driverId)}/billing`);
}

export async function payDriverSubscription(
  driverId: string,
  billingMode: DriverBillingMode,
  paymentMethod = 'Ручная сверка',
) {
  return request<DriverBillingDashboard>(`/drivers/${encodeURIComponent(driverId)}/billing/pay`, {
    body: JSON.stringify({ billingMode, paymentMethod }),
    method: 'POST',
  });
}

export async function refundDriverSubscriptionPayment(paymentId: string, reason?: string) {
  return request<DriverBillingDashboard>(`/driver-payments/${encodeURIComponent(paymentId)}/refund`, {
    body: JSON.stringify({ reason }),
    method: 'POST',
  });
}

export async function syncDriverSubscriptionPayment(paymentId: string) {
  return request<DriverBillingDashboard>(`/driver-payments/${encodeURIComponent(paymentId)}/sync`, {
    method: 'POST',
  });
}

// Осознанный отказ НАШЕГО бэкенда (4xx/5xx со структурированной ошибкой
// {error}): его нельзя путать с обрывом сети или ответом чужого хоста.
export class ApiHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(apiAuthToken ? { authorization: `Bearer ${apiAuthToken}` } : {}),
      accept: 'application/json',
      'content-type': 'application/json',
      ...init?.headers,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const apiErrorMessage =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : undefined;

    if (!apiErrorMessage) {
      // Ответ без нашего формата ошибки — это не бэкенд (статический хостинг
      // на 405/404, прокси и т.п.). Для вызывающих это «сервер недоступен»,
      // офлайн-фолбэк должен сработать как при обрыве сети.
      throw new Error(`API request failed: ${response.status}`);
    }

    throw new ApiHttpError(apiErrorMessage, response.status);
  }

  return payload as T;
}
