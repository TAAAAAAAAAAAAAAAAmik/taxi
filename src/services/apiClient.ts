import { AccountRole } from '../data/registration';
import {
  DriverBillingMode,
  DriverPaymentProvider,
  DriverSubscriptionPayment,
} from '../data/subscription';
import { OrderStatusSummary } from '../navigation/types';
import type { AppOrder, DriverProfile, PaymentStatus } from '../state/AppState';

const fallbackApiUrl = 'http://localhost:3100';
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
};

export type AuthResult = {
  session: AuthSession;
  user: AuthUser;
};

export type VerificationChannel = 'email' | 'phone';

export type VerificationCodeResult = {
  channel: VerificationChannel;
  code: string;
  deliveryMode: 'mvp-returned-code';
  expiresAt: string;
  target: string;
};

export type VerifyCodeResult = {
  channel: VerificationChannel;
  user: AuthUser;
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
  vehicleDocumentsReady?: string;
  referralCode?: string;
};

export type CreateOrderPayload = OrderStatusSummary & {
  role: AccountRole;
  clientName?: string;
  clientPhone?: string;
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

export type DriverCompliancePatch = {
  contractStatus?: DriverProfile['contractStatus'];
  documentsStatus?: DriverProfile['documentsStatus'];
  registryStatus?: DriverProfile['registryStatus'];
  taxProfileStatus?: DriverProfile['taxProfileStatus'];
  vehiclePermitStatus?: DriverProfile['vehiclePermitStatus'];
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
    driver: string;
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

export type ReferralCodeValidation = {
  code: string;
  error?: string;
  inviterName?: string;
  valid: boolean;
};

export function setApiAuthToken(token?: string) {
  apiAuthToken = token;
}

export function getApiBaseUrl() {
  const value = getPublicEnv('EXPO_PUBLIC_API_URL');

  if (!value || value.includes('api.example.com')) {
    return fallbackApiUrl;
  }

  return value.replace(/\/+$/, '');
}

export async function fetchApiHealth() {
  return request<ApiHealth>('/health');
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

export async function loginAdmin(password: string) {
  return request<AuthResult>('/auth/admin-login', {
    body: JSON.stringify({ password }),
    method: 'POST',
  });
}

export async function requestVerificationCode(channel: VerificationChannel, target?: string) {
  return request<VerificationCodeResult>('/auth/verification-code', {
    body: JSON.stringify({ channel, target }),
    method: 'POST',
  });
}

export async function verifyContactCode(channel: VerificationChannel, code: string, target?: string) {
  return request<VerifyCodeResult>('/auth/verify-code', {
    body: JSON.stringify({ channel, code, target }),
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

export async function createOrder(payload: CreateOrderPayload) {
  const response = await request<{ order: AppOrder }>('/orders', {
    body: JSON.stringify(payload),
    method: 'POST',
  });

  return response.order;
}

export async function updateOrderStatus(orderId: string, status: string) {
  const response = await request<{ order: AppOrder }>(`/orders/${encodeURIComponent(orderId)}/status`, {
    body: JSON.stringify({ status }),
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

export async function fetchDrivers() {
  const payload = await request<{ drivers: DriverProfile[] }>('/drivers');
  return payload.drivers;
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

export async function updateDriverAvailability(driverId: string, isOnline: boolean) {
  const response = await request<{ driver: DriverProfile }>(
    `/drivers/${encodeURIComponent(driverId)}/availability`,
    {
      body: JSON.stringify({ isOnline }),
      method: 'PATCH',
    },
  );

  return response.driver;
}

export async function updateDriverAccess(
  driverId: string,
  billingMode: DriverBillingMode,
  subscriptionStatus: DriverProfile['subscriptionStatus'] = 'active',
) {
  const response = await request<{ driver: DriverProfile }>(
    `/drivers/${encodeURIComponent(driverId)}/access`,
    {
      body: JSON.stringify({ accessDays: 30, billingMode, subscriptionStatus }),
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
  paymentMethod = 'Банковская карта',
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
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `API request failed: ${response.status}`;

    throw new Error(message);
  }

  return payload as T;
}

function getPublicEnv(key: string) {
  const env = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return env.process?.env?.[key];
}
