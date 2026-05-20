import { ReactNode, createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';

import { AccountRole } from '../data/registration';
import { DriverBillingMode, driverAccessPlans } from '../data/subscription';
import { OrderStatusSummary } from '../navigation/types';
import {
  AuthUser,
  assignOrder as assignOrderApi,
  createOrder as createOrderApi,
  fetchApiHealth,
  fetchDrivers,
  fetchOrders,
  loginAccount as loginAccountApi,
  loginAdmin as loginAdminApi,
  registerAccount as registerAccountApi,
  RegisterAccountPayload,
  updateDriverStatus as updateDriverStatusApi,
  updateOrderStatus as updateOrderStatusApi,
} from '../services/apiClient';

export type SavedPlace = {
  id: 'home';
  title: string;
  address: string;
  entrance?: string;
  comment?: string;
  updatedAt: string;
};

export type DriverSubscription = {
  status: 'inactive' | 'active';
  billingMode: DriverBillingMode;
  planName: string;
  monthlyPrice: number;
  ordersCommission: number;
  expiresAt?: string;
};

export type ApiConnectionState = 'checking' | 'connected' | 'offline';

export type OrderParticipant = {
  id: string;
  name: string;
  phone?: string;
  vehicle?: string;
  rating?: number;
  plate?: string;
};

export type DriverProfile = OrderParticipant & {
  billingMode: DriverBillingMode;
  status: 'pending' | 'approved' | 'blocked';
  subscriptionStatus: DriverSubscription['status'];
  updatedAt?: string;
};

export type TripReceipt = {
  id: string;
  orderId: string;
  issuedAt: string;
  total: number;
  paymentMethod: string;
  fiscalStatus: 'demo' | 'server';
};

export type TripReview = {
  orderId: string;
  rating: number;
  mood: string;
  facets: string[];
  comment: string;
  driverId: string;
  driverName: string;
  routeSignature: string;
  createdAt: string;
};

export type FavoriteDriver = OrderParticipant & {
  addedAt: string;
  lastOrderId: string;
  reason: string;
};

export type AppOrder = OrderStatusSummary & {
  role: AccountRole;
  status: string;
  createdAt: string;
  updatedAt?: string;
  clientName?: string;
  clientPhone?: string;
  driver?: OrderParticipant;
  receipt?: TripReceipt;
  review?: TripReview;
};

export type SupportMessage = {
  id: string;
  author: 'support' | 'system' | 'user';
  text: string;
  createdAt: string;
};

export type SupportThread = {
  id: string;
  role: AccountRole;
  category: string;
  title: string;
  status: 'open' | 'waiting' | 'closed';
  updatedAt: string;
  messages: SupportMessage[];
};

type AppStateValue = {
  orders: AppOrder[];
  drivers: DriverProfile[];
  currentUser?: AuthUser;
  driverSubscription: DriverSubscription;
  favoriteDrivers: FavoriteDriver[];
  savedHomeAddress?: SavedPlace;
  supportThreads: SupportThread[];
  serverStatus: ApiConnectionState;
  serverMessage: string;
  addOrder: (order: OrderStatusSummary, role: AccountRole, clientName?: string) => Promise<AppOrder>;
  assignOrderToDriver: (orderId: string, driverId: string) => Promise<void>;
  loginAccount: (identifier: string, password: string, role: AccountRole) => Promise<AuthUser | null>;
  loginAdmin: (password: string) => Promise<boolean>;
  registerAccount: (payload: RegisterAccountPayload) => Promise<AuthUser | null>;
  refreshServerData: () => Promise<void>;
  addFavoriteDriver: (driver: FavoriteDriver) => void;
  addOrderReview: (orderId: string, review: Omit<TripReview, 'createdAt' | 'routeSignature'>) => void;
  saveHomeAddress: (place: Omit<SavedPlace, 'id' | 'title' | 'updatedAt'>) => void;
  sendSupportMessage: (params: {
    role: AccountRole;
    category: string;
    text: string;
    title?: string;
  }) => void;
  updateDriverReviewStatus: (driverId: string, status: DriverProfile['status']) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  activateDriverSubscription: (billingMode?: DriverBillingMode) => void;
};

const AppStateContext = createContext<AppStateValue | undefined>(undefined);

function createDriverAccessState(billingMode: DriverBillingMode, status: DriverSubscription['status']) {
  const plan = driverAccessPlans[billingMode];
  const accessDays = plan.accessDays ?? 0;
  const expiresAt = accessDays ? new Date() : undefined;

  if (expiresAt) {
    expiresAt.setDate(expiresAt.getDate() + accessDays);
  }

  return {
    billingMode,
    expiresAt: expiresAt?.toISOString(),
    monthlyPrice: plan.monthlyPrice,
    ordersCommission: plan.commissionPercent,
    planName: plan.name,
    status,
  };
}

const initialDriverSubscription: DriverSubscription = createDriverAccessState('monthly', 'inactive');

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<AppOrder[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>(initialDrivers);
  const [currentUser, setCurrentUser] = useState<AuthUser | undefined>();
  const [favoriteDrivers, setFavoriteDrivers] = useState<FavoriteDriver[]>([]);
  const [savedHomeAddress, setSavedHomeAddress] = useState<SavedPlace | undefined>();
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([]);
  const [driverSubscription, setDriverSubscription] =
    useState<DriverSubscription>(initialDriverSubscription);
  const [serverStatus, setServerStatus] = useState<ApiConnectionState>('checking');
  const [serverMessage, setServerMessage] = useState('Проверяем MVP backend...');

  const refreshServerData = useCallback(async () => {
    try {
      const [health, serverOrders, serverDrivers] = await Promise.all([
        fetchApiHealth(),
        fetchOrders(),
        fetchDrivers(),
      ]);

      setOrders(serverOrders);
      setDrivers(serverDrivers);
      setServerStatus('connected');
      setServerMessage(`Backend подключен: ${health.service}`);
    } catch {
      setServerStatus('offline');
      setServerMessage('Backend не отвечает. Приложение работает локально, данные не сохранятся.');
    }
  }, []);

  useEffect(() => {
    refreshServerData();
  }, [refreshServerData]);

  const value = useMemo<AppStateValue>(
    () => ({
      activateDriverSubscription: (billingMode = 'monthly') => {
        setDriverSubscription(createDriverAccessState(billingMode, 'active'));
      },
      addOrder: async (order, role, clientName) => {
        const localOrder = createLocalOrder(order, role, clientName);

        try {
          const serverOrder = await createOrderApi({ ...order, role, clientName });

          setOrders((current) => [serverOrder, ...current.filter((item) => item.id !== serverOrder.id)]);
          setServerStatus('connected');
          setServerMessage('Заказ сохранен на backend.');
          return serverOrder;
        } catch {
          setServerStatus('offline');
          setServerMessage('Backend не отвечает. Заказ сохранен только локально.');
          setOrders((current) => [localOrder, ...current.filter((item) => item.id !== localOrder.id)]);
          return localOrder;
        }
      },
      assignOrderToDriver: async (orderId, driverId) => {
        const driver = drivers.find((item) => item.id === driverId);

        if (!driver) {
          return;
        }

        try {
          const serverOrder = await assignOrderApi(orderId, driverId);
          setOrders((current) =>
            current.map((order) => (order.id === serverOrder.id ? serverOrder : order)),
          );
          setServerStatus('connected');
          setServerMessage('Водитель назначен на backend.');
        } catch {
          setServerStatus('offline');
          setServerMessage('Backend не отвечает. Назначение сохранено только локально.');
          setOrders((current) =>
            current.map((order) =>
              order.id === orderId
                ? {
                    ...order,
                    driver,
                    status: 'assigned',
                  }
                : order,
            ),
          );
        }
      },
      addFavoriteDriver: (driver) => {
        setFavoriteDrivers((current) => [
          driver,
          ...current.filter((item) => item.id !== driver.id),
        ]);
      },
      addOrderReview: (orderId, review) => {
        setOrders((current) =>
          current.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  review: {
                    ...review,
                    createdAt: new Date().toISOString(),
                    routeSignature: createRouteSignature(order),
                  },
                }
              : order,
          ),
        );
      },
      currentUser,
      driverSubscription,
      drivers,
      favoriteDrivers,
      loginAccount: async (identifier, password, role) => {
        try {
          const result = await loginAccountApi(identifier, password, role);
          setCurrentUser(result.user);
          setServerStatus('connected');
          setServerMessage('Вход выполнен через backend.');
          await refreshServerData();
          return result.user;
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Не удалось войти.');
          return null;
        }
      },
      loginAdmin: async (password) => {
        try {
          const result = await loginAdminApi(password);
          setCurrentUser(result.user);
          setServerStatus('connected');
          setServerMessage('Админ подтвержден на backend.');
          await refreshServerData();
          return true;
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Админ-пароль не подошел.');
          return false;
        }
      },
      orders,
      registerAccount: async (payload) => {
        try {
          const result = await registerAccountApi(payload);
          setCurrentUser(result.user);
          setServerStatus('connected');
          setServerMessage('Аккаунт создан на backend.');
          await refreshServerData();
          return result.user;
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Не удалось создать аккаунт.');
          return null;
        }
      },
      refreshServerData,
      saveHomeAddress: (place) => {
        setSavedHomeAddress({
          ...place,
          id: 'home',
          title: 'Дом',
          updatedAt: new Date().toISOString(),
        });
      },
      savedHomeAddress,
      serverMessage,
      serverStatus,
      sendSupportMessage: ({ category, role, text, title }) => {
        const now = new Date().toISOString();
        const normalizedCategory = category.trim() || 'Общий вопрос';
        const threadId = `${role}-${normalizeThreadKey(normalizedCategory)}`;
        const userMessage: SupportMessage = {
          author: 'user',
          createdAt: now,
          id: `MSG-${Date.now()}`,
          text: text.trim(),
        };
        const supportMessage: SupportMessage = {
          author: 'support',
          createdAt: now,
          id: `MSG-${Date.now()}-support`,
          text:
            'Мы получили сообщение. Специалист увидит категорию, поездку и историю переписки в сервере сообщений.',
        };

        setSupportThreads((current) => {
          const existing = current.find((thread) => thread.id === threadId);

          if (existing) {
            return [
              {
                ...existing,
                messages: [...existing.messages, userMessage, supportMessage],
                status: 'waiting',
                updatedAt: now,
              },
              ...current.filter((thread) => thread.id !== threadId),
            ];
          }

          const systemMessage: SupportMessage = {
            author: 'system',
            createdAt: now,
            id: `MSG-${Date.now()}-system`,
            text: `Категория: ${normalizedCategory}. Канал готов к подключению WebSocket/API.`,
          };

          return [
            {
              category: normalizedCategory,
              id: threadId,
              messages: [systemMessage, userMessage, supportMessage],
              role,
              status: 'waiting',
              title: title?.trim() || normalizedCategory,
              updatedAt: now,
            },
            ...current,
          ];
        });
      },
      supportThreads,
      updateDriverReviewStatus: async (driverId, status) => {
        try {
          const serverDriver = await updateDriverStatusApi(driverId, status);
          setDrivers((current) =>
            current.map((driver) => (driver.id === serverDriver.id ? serverDriver : driver)),
          );
          setServerStatus('connected');
          setServerMessage('Статус водителя сохранен на backend.');
        } catch {
          setServerStatus('offline');
          setServerMessage('Backend не отвечает. Статус водителя сохранен только локально.');
          setDrivers((current) =>
            current.map((driver) => (driver.id === driverId ? { ...driver, status } : driver)),
          );
        }
      },
      updateOrderStatus: async (orderId, status) => {
        setOrders((current) =>
          current.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  receipt:
                    ['closed', 'completed'].includes(status) && !order.receipt
                      ? createReceipt(order)
                      : order.receipt,
                  status,
                }
              : order,
          ),
        );

        try {
          const serverOrder = await updateOrderStatusApi(orderId, status);
          setOrders((current) =>
            current.map((order) => (order.id === serverOrder.id ? serverOrder : order)),
          );
          setServerStatus('connected');
          setServerMessage('Статус заказа сохранен на backend.');
        } catch {
          setServerStatus('offline');
          setServerMessage('Backend не отвечает. Статус заказа сохранен только локально.');
        }
      },
    }),
    [
      driverSubscription,
      drivers,
      currentUser,
      favoriteDrivers,
      orders,
      refreshServerData,
      savedHomeAddress,
      serverMessage,
      serverStatus,
      supportThreads,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);

  if (!value) {
    throw new Error('useAppState must be used inside AppStateProvider');
  }

  return value;
}

const defaultDriver: OrderParticipant = {
  id: 'driver-alexey-solaris',
  name: 'Алексей',
  phone: '+7 917 000-42-11',
  plate: 'А123ВС 96',
  rating: 4.92,
  vehicle: 'Hyundai Solaris',
};

const initialDrivers: DriverProfile[] = [
  {
    ...defaultDriver,
    billingMode: 'commission',
    status: 'approved',
    subscriptionStatus: 'active',
    updatedAt: new Date().toISOString(),
  },
];

function createLocalOrder(
  order: OrderStatusSummary,
  role: AccountRole,
  clientName?: string,
): AppOrder {
  return {
    ...order,
    clientName,
    createdAt: new Date().toISOString(),
    driver: role === 'client' ? undefined : defaultDriver,
    role,
    status: role === 'client' ? 'searching' : role === 'driver' ? 'accepted' : 'created',
  };
}

function createReceipt(order: OrderStatusSummary): TripReceipt {
  return {
    fiscalStatus: 'demo',
    id: `RC-${Date.now().toString().slice(-7)}`,
    issuedAt: new Date().toISOString(),
    orderId: order.id,
    paymentMethod: order.paymentMethod,
    total: order.total,
  };
}

function createRouteSignature(order: OrderStatusSummary) {
  return `${order.pickup} -> ${order.destination}`;
}

function normalizeThreadKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
