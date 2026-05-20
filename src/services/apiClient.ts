import { AccountRole } from '../data/registration';
import { DriverBillingMode } from '../data/subscription';
import { OrderStatusSummary } from '../navigation/types';
import type { AppOrder, DriverProfile } from '../state/AppState';

const fallbackApiUrl = 'http://localhost:3100';

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
  phone?: string;
  verificationStatus?: string;
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
};

export type CreateOrderPayload = OrderStatusSummary & {
  role: AccountRole;
  clientName?: string;
  clientPhone?: string;
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

export async function assignOrder(orderId: string, driverId: string) {
  const response = await request<{ order: AppOrder }>(`/orders/${encodeURIComponent(orderId)}/assign`, {
    body: JSON.stringify({ driverId }),
    method: 'PATCH',
  });

  return response.order;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
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
