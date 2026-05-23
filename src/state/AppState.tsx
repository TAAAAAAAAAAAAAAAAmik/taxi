import { ReactNode, createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';

import { AccountRole } from '../data/registration';
import {
  DriverBillingMode,
  DriverSubscriptionPayment,
  driverAccessPlans,
} from '../data/subscription';
import { OrderStatusSummary } from '../navigation/types';
import {
  AdminReferralDashboard,
  AuthUser,
  assignOrderWithStatus as assignOrderApi,
  createOrder as createOrderApi,
  DriverCompliancePatch,
  fetchAdminReferralDashboard,
  fetchApiHealth,
  fetchDriverBilling,
  fetchDrivers,
  fetchOrders,
  fetchReferralDashboard,
  loginAccount as loginAccountApi,
  loginAdmin as loginAdminApi,
  ReferralDashboard,
  payDriverSubscription as payDriverSubscriptionApi,
  registerAccount as registerAccountApi,
  RegisterAccountPayload,
  refundDriverSubscriptionPayment as refundDriverSubscriptionPaymentApi,
  requestVerificationCode as requestVerificationCodeApi,
  setApiAuthToken,
  updateDriverAccess as updateDriverAccessApi,
  updateDriverAvailability as updateDriverAvailabilityApi,
  updateDriverCompliance as updateDriverComplianceApi,
  updateDriverStatus as updateDriverStatusApi,
  updateOrderPaymentStatus as updateOrderPaymentStatusApi,
  updateOrderStatus as updateOrderStatusApi,
  VerificationChannel,
  VerificationCodeResult,
  verifyContactCode as verifyContactCodeApi,
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
  status: 'inactive' | 'active' | 'expired';
  billingMode: DriverBillingMode;
  planName: string;
  monthlyPrice: number;
  ordersCommission: number;
  expiresAt?: string;
};

export type ApiConnectionState = 'checking' | 'connected' | 'offline';
export type PaymentStatus = 'authorized' | 'failed' | 'paid' | 'pending' | 'refunded';

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
  canReceiveOrders?: boolean;
  contractStatus: 'missing' | 'pending' | 'signed' | 'rejected';
  documentsStatus: 'missing' | 'pending' | 'approved' | 'rejected';
  isOnline?: boolean;
  registryStatus: 'missing' | 'pending' | 'active' | 'rejected';
  status: 'pending' | 'approved' | 'blocked';
  subscriptionStatus: DriverSubscription['status'];
  taxProfileStatus: 'missing' | 'pending' | 'approved' | 'rejected';
  vehiclePermitStatus: 'missing' | 'pending' | 'approved' | 'rejected';
  accessBlockers?: string[];
  accessExpiresAt?: string;
  userId?: string;
  updatedAt?: string;
};

export type TripReceipt = {
  id: string;
  orderId: string;
  issuedAt: string;
  total: number;
  subtotal?: number;
  bonusApplied?: number;
  paymentMethod: string;
  paymentStatus?: PaymentStatus;
  fiscalStatus: 'demo' | 'server';
  fiscalNumber?: string;
  items?: Array<{
    amount: number;
    label: string;
  }>;
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
  acceptedAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  createdAt: string;
  paymentAuthorizedAt?: string;
  paymentEvents?: Array<{
    actor: string;
    at: string;
    note?: string;
    status: PaymentStatus;
  }>;
  paymentStatus?: PaymentStatus;
  paidAt?: string;
  statusHistory?: Array<{
    actor: string;
    at: string;
    status: string;
  }>;
  startedAt?: string;
  updatedAt?: string;
  clientName?: string;
  clientPhone?: string;
  userId?: string;
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
  referralDashboard?: ReferralDashboard;
  adminReferralDashboard?: AdminReferralDashboard;
  driverSubscription: DriverSubscription;
  driverPayments: DriverSubscriptionPayment[];
  favoriteDrivers: FavoriteDriver[];
  savedHomeAddress?: SavedPlace;
  supportThreads: SupportThread[];
  serverStatus: ApiConnectionState;
  serverMessage: string;
  addOrder: (order: OrderStatusSummary, role: AccountRole, clientName?: string) => Promise<AppOrder>;
  assignOrderToDriver: (orderId: string, driverId: string, status?: string) => Promise<AppOrder | null>;
  loginAccount: (identifier: string, password: string, role: AccountRole) => Promise<AuthUser | null>;
  loginAdmin: (password: string) => Promise<boolean>;
  registerAccount: (payload: RegisterAccountPayload) => Promise<AuthUser | null>;
  requestVerificationCode: (
    channel: VerificationChannel,
    target?: string,
  ) => Promise<VerificationCodeResult | null>;
  verifyContactCode: (
    channel: VerificationChannel,
    code: string,
    target?: string,
  ) => Promise<AuthUser | null>;
  refreshServerData: () => Promise<void>;
  refreshAdminReferralDashboard: () => Promise<void>;
  refreshReferralDashboard: (userId?: string) => Promise<void>;
  addFavoriteDriver: (driver: FavoriteDriver) => void;
  addOrderReview: (orderId: string, review: Omit<TripReview, 'createdAt' | 'routeSignature'>) => void;
  saveHomeAddress: (place: Omit<SavedPlace, 'id' | 'title' | 'updatedAt'>) => void;
  sendSupportMessage: (params: {
    role: AccountRole;
    category: string;
    text: string;
    title?: string;
  }) => void;
  updateDriverComplianceStatus: (driverId: string, payload: DriverCompliancePatch) => Promise<void>;
  updateDriverAvailability: (driverId: string, isOnline: boolean) => Promise<void>;
  updateDriverReviewStatus: (driverId: string, status: DriverProfile['status']) => Promise<void>;
  updateOrderPaymentStatus: (orderId: string, status: PaymentStatus, note?: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  activateDriverSubscription: (billingMode?: DriverBillingMode) => void;
  payDriverSubscription: (billingMode?: DriverBillingMode) => Promise<void>;
  refundDriverSubscriptionPayment: (paymentId: string, reason?: string) => Promise<void>;
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

function createDriverSubscriptionFromProfile(driver: DriverProfile): DriverSubscription {
  const plan = driverAccessPlans[driver.billingMode];

  return {
    billingMode: driver.billingMode,
    expiresAt: driver.accessExpiresAt,
    monthlyPrice: plan.monthlyPrice,
    ordersCommission: plan.commissionPercent,
    planName: plan.name,
    status: driver.subscriptionStatus,
  };
}

const initialDriverSubscription: DriverSubscription = createDriverAccessState('monthly', 'inactive');

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<AppOrder[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>(initialDrivers);
  const [currentUser, setCurrentUser] = useState<AuthUser | undefined>();
  const [referralDashboard, setReferralDashboard] = useState<ReferralDashboard | undefined>();
  const [adminReferralDashboard, setAdminReferralDashboard] =
    useState<AdminReferralDashboard | undefined>();
  const [favoriteDrivers, setFavoriteDrivers] = useState<FavoriteDriver[]>([]);
  const [savedHomeAddress, setSavedHomeAddress] = useState<SavedPlace | undefined>();
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([]);
  const [driverSubscription, setDriverSubscription] =
    useState<DriverSubscription>(initialDriverSubscription);
  const [driverPayments, setDriverPayments] = useState<DriverSubscriptionPayment[]>([]);
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

  const refreshReferralDashboard = useCallback(
    async (userId = currentUser?.id) => {
      if (!userId) {
        return;
      }

      try {
        const dashboard = await fetchReferralDashboard(userId);
        setReferralDashboard(dashboard);
      } catch {
        setReferralDashboard(undefined);
      }
    },
    [currentUser?.id],
  );

  const refreshAdminReferralDashboard = useCallback(async () => {
    try {
      const dashboard = await fetchAdminReferralDashboard();
      setAdminReferralDashboard(dashboard);
    } catch {
      setAdminReferralDashboard(undefined);
    }
  }, []);

  const currentDriver = useMemo(
    () => (currentUser ? drivers.find((driver) => driver.userId === currentUser.id) : undefined),
    [currentUser, drivers],
  );
  const visibleDriverSubscription = currentDriver
    ? createDriverSubscriptionFromProfile(currentDriver)
    : driverSubscription;

  useEffect(() => {
    if (!currentDriver?.id) {
      setDriverPayments([]);
      return;
    }

    fetchDriverBilling(currentDriver.id)
      .then((dashboard) => {
        setDriverPayments(dashboard.payments);
        setDriverSubscription(createDriverSubscriptionFromProfile(dashboard.driver));
        setDrivers((current) =>
          current.map((driver) => (driver.id === dashboard.driver.id ? dashboard.driver : driver)),
        );
        setServerStatus('connected');
      })
      .catch(() => {
        setDriverPayments((current) => current);
      });
  }, [currentDriver?.id, currentDriver?.subscriptionStatus, currentDriver?.accessExpiresAt]);

  const applyBillingDashboard = useCallback((dashboard: Awaited<ReturnType<typeof fetchDriverBilling>>) => {
    setDriverPayments(dashboard.payments);
    setDriverSubscription(createDriverSubscriptionFromProfile(dashboard.driver));
    setDrivers((current) =>
      current.map((driver) => (driver.id === dashboard.driver.id ? dashboard.driver : driver)),
    );
  }, []);

  const payDriverSubscription = useCallback(
    async (billingMode: DriverBillingMode = 'monthly') => {
      const nextSubscription = createDriverAccessState(billingMode, 'active');

      if (currentDriver && currentDriver.status !== 'approved') {
        setServerMessage('Сначала администратор должен одобрить водителя.');
        return;
      }

      setDriverSubscription(nextSubscription);

      if (!currentDriver) {
        setDriverPayments((current) => [
          createLocalDriverPayment(undefined, billingMode, nextSubscription),
          ...current,
        ]);
        setServerMessage('Доступ отмечен локально. Backend не привязан к текущему водителю.');
        return;
      }

      try {
        const dashboard = await payDriverSubscriptionApi(currentDriver.id, billingMode);
        applyBillingDashboard(dashboard);
        setServerStatus('connected');
        setServerMessage(
          billingMode === 'monthly'
            ? 'Оплата подписки проведена, чек сохранен на backend.'
            : 'Модель комиссии подключена, запись сохранена на backend.',
        );
      } catch (error) {
        setDriverPayments((current) => [
          createLocalDriverPayment(currentDriver, billingMode, nextSubscription),
          ...current,
        ]);
        setServerStatus('offline');
        setServerMessage(
          error instanceof Error
            ? error.message
            : 'Backend не отвечает. Подписка отмечена только локально.',
        );
      }
    },
    [applyBillingDashboard, currentDriver],
  );

  const refundDriverSubscriptionPayment = useCallback(
    async (paymentId: string, reason = 'Возврат подписки в MVP') => {
      setDriverPayments((current) =>
        current.map((payment) =>
          payment.id === paymentId
            ? {
                ...payment,
                refundReason: reason,
                refundedAt: new Date().toISOString(),
                status: 'refunded',
                updatedAt: new Date().toISOString(),
              }
            : payment,
        ),
      );

      try {
        const dashboard = await refundDriverSubscriptionPaymentApi(paymentId, reason);
        applyBillingDashboard(dashboard);
        setServerStatus('connected');
        setServerMessage('Возврат подписки сохранен на backend.');
      } catch (error) {
        setServerStatus('offline');
        setServerMessage(error instanceof Error ? error.message : 'Не удалось оформить возврат.');
      }
    },
    [applyBillingDashboard],
  );

  const value = useMemo<AppStateValue>(
    () => ({
      adminReferralDashboard,
      activateDriverSubscription: (billingMode = 'monthly') => {
        void payDriverSubscription(billingMode);
        return;

        const nextSubscription = createDriverAccessState(billingMode, 'active');
        const currentDriver = currentUser
          ? drivers.find((driver) => driver.userId === currentUser.id)
          : undefined;

        setDriverSubscription(nextSubscription);
        if (currentDriver) {
          updateDriverAccessApi(currentDriver.id, billingMode)
            .then((serverDriver) => {
              setDrivers((current) =>
                current.map((driver) => (driver.id === serverDriver.id ? serverDriver : driver)),
              );
              setServerStatus('connected');
              setServerMessage('Доступ водителя активирован на backend.');
            })
            .catch(() => {
              setServerStatus('offline');
              setServerMessage('Backend не отвечает. Доступ отмечен только локально.');
            });
        }
      },
      addOrder: async (order, role, clientName) => {
        const localOrder = createLocalOrder(order, role, clientName, currentUser);

        try {
          const serverOrder = await createOrderApi({
            ...order,
            clientName,
            clientPhone: currentUser?.phone,
            role,
            userId: currentUser?.id,
          });

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
      assignOrderToDriver: async (orderId, driverId, status = 'assigned') => {
        const driver = drivers.find((item) => item.id === driverId);

        if (!driver) {
          return null;
        }

        if (!driver.canReceiveOrders) {
          setServerMessage('Водитель еще не прошел допуск к заказам.');
          return null;
        }

        try {
          const serverOrder = await assignOrderApi(orderId, driverId, status);
          setOrders((current) =>
            current.map((order) => (order.id === serverOrder.id ? serverOrder : order)),
          );
          setServerStatus('connected');
          setServerMessage('Заказ принят водителем на backend.');
          return serverOrder;
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Не удалось принять заказ.');
          return null;
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
      driverPayments,
      driverSubscription: visibleDriverSubscription,
      drivers,
      favoriteDrivers,
      loginAccount: async (identifier, password, role) => {
        try {
          const result = await loginAccountApi(identifier, password, role);
          setApiAuthToken(result.session.token);
          setCurrentUser(result.user);
          setServerStatus('connected');
          setServerMessage('Вход выполнен через backend.');
          await refreshServerData();
          await refreshReferralDashboard(result.user.id);
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
          setApiAuthToken(result.session.token);
          setCurrentUser(result.user);
          setServerStatus('connected');
          setServerMessage('Админ подтвержден на backend.');
          await refreshServerData();
          await refreshAdminReferralDashboard();
          return true;
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Админ-пароль не подошел.');
          return false;
        }
      },
      orders,
      referralDashboard,
      registerAccount: async (payload) => {
        try {
          const result = await registerAccountApi(payload);
          setApiAuthToken(result.session.token);
          setCurrentUser(result.user);
          setServerStatus('connected');
          setServerMessage('Аккаунт создан на backend.');
          await refreshServerData();
          await refreshReferralDashboard(result.user.id);
          return result.user;
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Не удалось создать аккаунт.');
          return null;
        }
      },
      requestVerificationCode: async (channel, target) => {
        try {
          const result = await requestVerificationCodeApi(channel, target);
          setServerStatus('connected');
          setServerMessage(
            channel === 'email'
              ? 'Код подтверждения почты создан на backend.'
              : 'Код подтверждения телефона создан на backend.',
          );
          return result;
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Не удалось отправить код.');
          return null;
        }
      },
      verifyContactCode: async (channel, code, target) => {
        try {
          const result = await verifyContactCodeApi(channel, code, target);
          setCurrentUser(result.user);
          setServerStatus('connected');
          setServerMessage(channel === 'email' ? 'Почта подтверждена.' : 'Телефон подтвержден.');
          return result.user;
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Код подтверждения не подошел.');
          return null;
        }
      },
      payDriverSubscription,
      refundDriverSubscriptionPayment,
      refreshAdminReferralDashboard,
      refreshServerData,
      refreshReferralDashboard,
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
      updateDriverComplianceStatus: async (driverId, payload) => {
        try {
          const serverDriver = await updateDriverComplianceApi(driverId, payload);
          setDrivers((current) =>
            current.map((driver) => (driver.id === serverDriver.id ? serverDriver : driver)),
          );
          setServerStatus('connected');
          setServerMessage('Допуск водителя сохранен на backend.');
        } catch {
          setServerStatus('offline');
          setServerMessage('Backend не отвечает. Допуск водителя сохранен только локально.');
          setDrivers((current) =>
            current.map((driver) =>
              driver.id === driverId
                ? {
                    ...driver,
                    ...payload,
                    canReceiveOrders: hasCompletedDriverCompliance({ ...driver, ...payload }),
                  }
                : driver,
            ),
          );
        }
      },
      updateDriverAvailability: async (driverId, isOnline) => {
        const driver = drivers.find((item) => item.id === driverId);

        if (!driver || driver.status !== 'approved') {
          setServerMessage('Сначала администратор должен одобрить водителя.');
          return;
        }

        if (driver.subscriptionStatus !== 'active' && driverSubscription.status !== 'active') {
          setServerMessage('Сначала нужно активировать доступ к заказам.');
          return;
        }

        if (!driver.canReceiveOrders) {
          setServerMessage('Сначала завершите допуск: документы, договор, разрешение, реестр и налоговый профиль.');
          return;
        }

        setDrivers((current) =>
          current.map((item) => (item.id === driverId ? { ...item, isOnline } : item)),
        );

        try {
          const serverDriver = await updateDriverAvailabilityApi(driverId, isOnline);
          setDrivers((current) =>
            current.map((item) => (item.id === serverDriver.id ? serverDriver : item)),
          );
          setServerStatus('connected');
          setServerMessage(isOnline ? 'Водитель вышел на линию.' : 'Водитель ушел с линии.');
        } catch {
          setServerStatus('offline');
          setServerMessage('Backend не отвечает. Статус линии сохранен только локально.');
        }
      },
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
                  paidAt:
                    ['closed', 'completed'].includes(status) && order.paymentStatus !== 'paid'
                      ? new Date().toISOString()
                      : order.paidAt,
                  paymentStatus: ['closed', 'completed'].includes(status) ? 'paid' : order.paymentStatus,
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
      updateOrderPaymentStatus: async (orderId, status, note) => {
        setOrders((current) =>
          current.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  paidAt: status === 'paid' ? order.paidAt || new Date().toISOString() : order.paidAt,
                  paymentEvents: [
                    {
                      actor: 'local',
                      at: new Date().toISOString(),
                      note,
                      status,
                    },
                    ...(order.paymentEvents ?? []),
                  ],
                  paymentStatus: status,
                  receipt:
                    status === 'paid' && ['closed', 'completed'].includes(order.status) && !order.receipt
                      ? createReceipt(order)
                      : order.receipt,
                }
              : order,
          ),
        );

        try {
          const serverOrder = await updateOrderPaymentStatusApi(orderId, status, note);
          setOrders((current) =>
            current.map((order) => (order.id === serverOrder.id ? serverOrder : order)),
          );
          setServerStatus('connected');
          setServerMessage('Статус оплаты сохранен на backend.');
        } catch {
          setServerStatus('offline');
          setServerMessage('Backend не отвечает. Оплата отмечена только локально.');
        }
      },
    }),
    [
      driverSubscription,
      driverPayments,
      drivers,
      currentUser,
      currentDriver?.id,
      favoriteDrivers,
      orders,
      referralDashboard,
      adminReferralDashboard,
      refreshAdminReferralDashboard,
      refreshReferralDashboard,
      refreshServerData,
      savedHomeAddress,
      serverMessage,
      serverStatus,
      supportThreads,
      payDriverSubscription,
      refundDriverSubscriptionPayment,
      visibleDriverSubscription,
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
    canReceiveOrders: true,
    contractStatus: 'signed',
    documentsStatus: 'approved',
    isOnline: true,
    registryStatus: 'active',
    status: 'approved',
    subscriptionStatus: 'active',
    taxProfileStatus: 'approved',
    vehiclePermitStatus: 'approved',
    updatedAt: new Date().toISOString(),
  },
];

function hasCompletedDriverCompliance(driver: DriverProfile) {
  return (
    driver.status === 'approved' &&
    driver.subscriptionStatus === 'active' &&
    driver.documentsStatus === 'approved' &&
    driver.contractStatus === 'signed' &&
    driver.vehiclePermitStatus === 'approved' &&
    driver.registryStatus === 'active' &&
    driver.taxProfileStatus === 'approved'
  );
}

function createLocalOrder(
  order: OrderStatusSummary,
  role: AccountRole,
  clientName?: string,
  user?: AuthUser,
): AppOrder {
  const createdAt = new Date().toISOString();
  const status = role === 'client' ? 'searching' : role === 'driver' ? 'accepted' : 'created';
  const paymentStatus = getInitialPaymentStatus(order.paymentMethod, order.total);

  return {
    ...order,
    clientName,
    clientPhone: user?.phone,
    createdAt,
    driver: role === 'client' ? undefined : defaultDriver,
    paidAt: paymentStatus === 'paid' ? createdAt : undefined,
    paymentAuthorizedAt: paymentStatus === 'authorized' ? createdAt : undefined,
    paymentEvents: [
      {
        actor: 'local',
        at: createdAt,
        note: paymentStatus === 'authorized' ? 'Демо-авторизация оплаты' : 'Ожидает оплаты',
        status: paymentStatus,
      },
    ],
    paymentStatus,
    role,
    status,
    statusHistory: [
      {
        actor: 'local',
        at: createdAt,
        status,
      },
    ],
    userId: user?.id,
  };
}

function createReceipt(order: OrderStatusSummary): TripReceipt {
  return {
    fiscalStatus: 'demo',
    fiscalNumber: `MVP-${order.id}`,
    id: `RC-${Date.now().toString().slice(-7)}`,
    items: [{ amount: order.total, label: `Поездка ${order.tariff}` }],
    issuedAt: new Date().toISOString(),
    orderId: order.id,
    paymentMethod: order.paymentMethod,
    paymentStatus: 'paid',
    subtotal: order.total,
    total: order.total,
  };
}

function createLocalDriverPayment(
  driver: DriverProfile | undefined,
  billingMode: DriverBillingMode,
  subscription: DriverSubscription,
): DriverSubscriptionPayment {
  const now = new Date().toISOString();
  const plan = driverAccessPlans[billingMode];
  const amount = billingMode === 'monthly' ? plan.monthlyPrice : 0;
  const paymentId = `DP-LOCAL-${Date.now().toString().slice(-7)}`;

  return {
    amount,
    billingMode,
    createdAt: now,
    currency: 'RUB',
    driverId: driver?.id ?? 'local-driver',
    driverName: driver?.name,
    id: paymentId,
    paidAt: now,
    paymentMethod: 'Локальная MVP-активация',
    planName: plan.name,
    provider: {
      mode: 'demo',
      name: 'local-demo',
    },
    receipt: {
      currency: 'RUB',
      driverId: driver?.id ?? 'local-driver',
      fiscalNumber: `LOCAL-${paymentId}`,
      fiscalStatus: 'demo',
      id: `RC-${paymentId}`,
      issuedAt: now,
      items: [{ amount, label: plan.name }],
      paymentId,
      paymentStatus: 'paid',
      total: amount,
    },
    status: 'paid',
    updatedAt: now,
    accessExpiresAt: subscription.expiresAt,
    accessStartsAt: now,
  };
}

function getInitialPaymentStatus(paymentMethod: string, total: number): PaymentStatus {
  if (total === 0 || /бонус/i.test(paymentMethod)) {
    return 'paid';
  }

  if (/карт|card|корпоратив|счет|счёт/i.test(paymentMethod)) {
    return 'authorized';
  }

  return 'pending';
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
