import { ReactNode, createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';

import { AccountRole, isDriverLikeRole, isParkDriverRole } from '../data/registration';
import {
  DriverBillingMode,
  DriverSubscriptionPayment,
  driverAccessPlans,
} from '../data/subscription';
import { OrderStatusSummary } from '../navigation/types';
import {
  AccountDeletionResult,
  AdminReferralDashboard,
  ApiHttpError,
  AuthDeliveryChannel,
  AuthUser,
  assignOrderWithStatus as assignOrderApi,
  confirmSmsLoginCode as confirmSmsLoginCodeApi,
  confirmPasswordReset as confirmPasswordResetApi,
  createOrder as createOrderApi,
  deleteAccount as deleteAccountApi,
  declineOrderOffer as declineOrderOfferApi,
  DriverCompliancePatch,
  DriverDocumentReviewPayload,
  fetchAdminReferralDashboard,
  fetchApiHealth,
  fetchDriverBilling,
  fetchDrivers,
  fetchOrders,
  fetchReferralDashboard,
  fetchServiceShareSummary,
  fetchSupportThreads,
  loginAccount as loginAccountApi,
  loginAdmin as loginAdminApi,
  logoutAccount as logoutAccountApi,
  PasswordResetCodeResult,
  ReferralDashboard,
  RealtimeConnectionMode,
  RealtimeNotification,
  RealtimeSnapshot,
  payDriverSubscription as payDriverSubscriptionApi,
  requestSmsLoginCode as requestSmsLoginCodeApi,
  requestPasswordResetCode as requestPasswordResetCodeApi,
  registerAccount as registerAccountApi,
  RegisterAccountPayload,
  refundDriverSubscriptionPayment as refundDriverSubscriptionPaymentApi,
  requestVerificationCode as requestVerificationCodeApi,
  reviewDriverDocuments as reviewDriverDocumentsApi,
  setApiAuthToken,
  SmsLoginCodeResult,
  sendSupportMessageToServer,
  subscribeRealtime,
  submitDriverDocuments as submitDriverDocumentsApi,
  syncDriverSubscriptionPayment as syncDriverSubscriptionPaymentApi,
  updateDriverAccess as updateDriverAccessApi,
  updateDriverAvailability as updateDriverAvailabilityApi,
  updateDriverLocation as updateDriverLocationApi,
  updateDriverCompliance as updateDriverComplianceApi,
  updateDriverStatus as updateDriverStatusApi,
  updateOrderPaymentStatus as updateOrderPaymentStatusApi,
  updateOrderServiceShareStatus as updateOrderServiceShareStatusApi,
  updateOrderStatus as updateOrderStatusApi,
  VerificationChannel,
  VerificationCodeResult,
  verifyContactCode as verifyContactCodeApi,
} from '../services/apiClient';
import type { DriverServiceShareSummary } from '../services/apiClient';
import { configurePushNotifications } from '../services/pushNotifications';
import { isDemoModeEnabled } from '../utils/runtimeFlags';

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
  expiresAt?: string;
};

export type ApiConnectionState = 'checking' | 'connected' | 'offline';
export type RealtimeConnectionState = 'connecting' | 'live' | 'offline' | 'polling';
export type PaymentStatus = 'authorized' | 'failed' | 'paid' | 'pending' | 'refunded';
export type DriverServiceShareStatus =
  | 'confirmed'
  | 'not_applicable'
  | 'pending_transfer'
  | 'reported_transferred';
export type DriverDocumentKind = 'driverLicense' | 'osago' | 'osgop' | 'passport' | 'sts';

export type DriverDocumentActor = {
  id: string;
  name?: string;
  role: string;
};

export type DriverDocumentAuditEntry = {
  action: 'uploaded' | 'approved' | 'rejected' | 'reset' | 'viewed';
  actor: DriverDocumentActor;
  createdAt: string;
  driverId: string;
  driverName?: string;
  id: string;
  kinds: DriverDocumentKind[];
  note?: string;
  reason?: string;
  status: 'missing' | 'pending' | 'approved' | 'rejected';
  userId?: string;
};

export type DriverDocumentReview = {
  note?: string;
  reason?: string;
  rejectedKinds: DriverDocumentKind[];
  reviewedAt?: string;
  reviewedBy?: DriverDocumentActor;
  status: 'missing' | 'pending' | 'approved' | 'rejected';
  submittedAt?: string;
  submittedBy?: DriverDocumentActor;
};

export type DriverDocumentUpload = {
  checksum?: string;
  expiresAt?: string;
  fileName: string;
  fileSize?: number;
  height?: number;
  kind: DriverDocumentKind;
  mimeType: string;
  rejectionReason?: string;
  reviewedAt?: string;
  reviewedBy?: DriverDocumentActor;
  source: 'camera' | 'library';
  status: 'missing' | 'pending' | 'approved' | 'rejected';
  storageKey?: string;
  uploadedAt: string;
  width?: number;
};

export type DriverDocumentUploadInput = {
  base64: string;
  fileName?: string | null;
  fileSize?: number;
  height?: number;
  kind: DriverDocumentKind;
  mimeType?: string | null;
  source: 'camera' | 'library';
  width?: number;
};

export type OrderParticipant = {
  id: string;
  name: string;
  billingMode?: DriverBillingMode;
  commissionTrialEndsAt?: string;
  commissionTrialOrderLimit?: number;
  commissionTrialStartedAt?: string;
  driverTariff?: string;
  phone?: string;
  vehicle?: string;
  rating?: number;
  plate?: string;
  subscriptionExpiresAt?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: DriverSubscription['status'];
};

export type DriverProfile = OrderParticipant & {
  billingMode: DriverBillingMode;
  canReceiveOrders?: boolean;
  contractStatus: 'missing' | 'pending' | 'signed' | 'rejected';
  documentAudit?: DriverDocumentAuditEntry[];
  documentReview?: DriverDocumentReview;
  documentUploads?: Partial<Record<DriverDocumentKind, DriverDocumentUpload>>;
  documentsStatus: 'missing' | 'pending' | 'approved' | 'rejected';
  isOnline?: boolean;
  lastLocation?: {
    accuracy?: number;
    latitude: number;
    longitude: number;
    updatedAt?: string;
  };
  locationUpdatedAt?: string;
  registryStatus: 'missing' | 'pending' | 'active' | 'rejected';
  status: 'pending' | 'approved' | 'blocked';
  subscriptionStatus: DriverSubscription['status'];
  subscriptionExpiresAt?: string;
  subscriptionPlan?: string;
  taxProfileStatus: 'missing' | 'pending' | 'approved' | 'rejected';
  vehiclePermitStatus: 'missing' | 'pending' | 'approved' | 'rejected';
  accessBlockers?: string[];
  accessExpiresAt?: string;
  commissionTrialOrderLimit?: number;
  commissionTrialEndsAt?: string;
  commissionTrialStartedAt?: string;
  createdAt?: string;
  userId?: string;
  updatedAt?: string;
  workMode?: 'daily' | 'partner_pro' | 'trial';
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
  driverBillingMode?: DriverBillingMode;
  driverCollectedAmount?: number;
  driverCommission?: number;
  driverCommissionRate?: number;
  driverNetAmount?: number;
  driverPayout?: number;
  serviceShareAmount?: number;
  serviceShareBatchDate?: string;
  serviceShareConfirmedAt?: string;
  serviceShareEvents?: Array<{
    actor: string;
    at: string;
    note?: string;
    status: DriverServiceShareStatus;
  }>;
  serviceShareRate?: number;
  serviceShareReportedAt?: string;
  serviceShareStatus?: DriverServiceShareStatus;
  driverDailyOrderNumber?: number;
  driverTrialActive?: boolean;
  driverTrialRemainingOrders?: number;
  dispatchMode?: 'exclusive' | 'feed';
  dispatchStatus?: 'exclusive_offer' | 'open_feed' | 'driver_declined_open_feed' | 'accepted_from_exclusive' | 'accepted_from_feed';
  exclusiveDistanceKm?: number;
  exclusiveDriverId?: string;
  exclusiveDriverName?: string;
  exclusiveOfferCreatedAt?: string;
  exclusiveOfferExpiresAt?: string;
  exclusiveOfferReleasedAt?: string;
  exclusiveOfferSeconds?: number;
  exclusiveOfferStatus?: 'pending' | 'accepted' | 'declined' | 'expired';
  pickupPoint?: {
    latitude: number;
    longitude: number;
  };
  safetyPinRequired?: boolean;
  safetyPinVerifiedAt?: string;
  tripPin?: string;
  fulfilledByRole?: 'self_employed' | 'park_driver';
  parkId?: string;
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
  serviceShareSummary?: DriverServiceShareSummary;
  driverSubscription: DriverSubscription;
  driverPayments: DriverSubscriptionPayment[];
  favoriteDrivers: FavoriteDriver[];
  savedHomeAddress?: SavedPlace;
  supportThreads: SupportThread[];
  serverStatus: ApiConnectionState;
  serverMessage: string;
  notifications: RealtimeNotification[];
  realtimeMessage: string;
  realtimeStatus: RealtimeConnectionState;
  realtimeUpdatedAt?: string;
  simpleMode: boolean;
  addOrder: (order: OrderStatusSummary, role: AccountRole, clientName?: string) => Promise<AppOrder>;
  assignOrderToDriver: (orderId: string, driverId: string, status?: string) => Promise<AppOrder | null>;
  declineOrderOffer: (orderId: string, driverId: string) => Promise<AppOrder | null>;
  loginAccount: (identifier: string, password: string, role: AccountRole) => Promise<AuthUser | null>;
  requestSmsLoginCode: (
    phone: string,
    role: AccountRole,
    deliveryChannel?: Extract<AuthDeliveryChannel, 'max' | 'sms' | 'telegram'>,
  ) => Promise<SmsLoginCodeResult | null>;
  confirmSmsLoginCode: (
    phone: string,
    code: string,
    role: AccountRole,
  ) => Promise<AuthUser | null>;
  loginAdmin: (password: string) => Promise<boolean>;
  registerAccount: (payload: RegisterAccountPayload) => Promise<AuthUser | null>;
  requestVerificationCode: (
    channel: VerificationChannel,
    target?: string,
    deliveryChannel?: AuthDeliveryChannel,
  ) => Promise<VerificationCodeResult | null>;
  verifyContactCode: (
    channel: VerificationChannel,
    code: string,
    target?: string,
  ) => Promise<AuthUser | null>;
  requestPasswordResetCode: (
    identifier: string,
    deliveryChannel?: AuthDeliveryChannel,
  ) => Promise<PasswordResetCodeResult | null>;
  confirmPasswordReset: (
    identifier: string,
    code: string,
    password: string,
  ) => Promise<AuthUser | null>;
  deleteAccount: (reason?: string) => Promise<AccountDeletionResult | null>;
  logoutAccount: () => Promise<void>;
  refreshServerData: () => Promise<void>;
  refreshAdminReferralDashboard: () => Promise<void>;
  refreshServiceShareSummary: (date?: string) => Promise<void>;
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
  setSimpleMode: (enabled: boolean) => void;
  updateDriverComplianceStatus: (driverId: string, payload: DriverCompliancePatch) => Promise<void>;
  updateDriverAccess: (
    driverId: string,
    billingMode: DriverBillingMode,
    subscriptionStatus?: DriverProfile['subscriptionStatus'],
  ) => Promise<void>;
  reviewDriverDocuments: (driverId: string, payload: DriverDocumentReviewPayload) => Promise<void>;
  submitDriverDocuments: (
    driverId: string,
    documents: DriverDocumentUploadInput[],
  ) => Promise<{ message: string; ok: boolean }>;
  updateDriverAvailability: (
    driverId: string,
    isOnline: boolean,
    location?: { accuracy?: number; latitude: number; longitude: number },
  ) => Promise<void>;
  updateDriverLocation: (
    driverId: string,
    location: { accuracy?: number; latitude: number; longitude: number },
  ) => Promise<void>;
  updateDriverReviewStatus: (driverId: string, status: DriverProfile['status']) => Promise<void>;
  updateOrderPaymentStatus: (orderId: string, status: PaymentStatus, note?: string) => Promise<void>;
  updateOrderServiceShareStatus: (
    orderId: string,
    status: DriverServiceShareStatus,
    note?: string,
  ) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string, pinCode?: string) => Promise<void>;
  activateDriverSubscription: (billingMode?: DriverBillingMode) => void;
  payDriverSubscription: (billingMode?: DriverBillingMode) => Promise<void>;
  refundDriverSubscriptionPayment: (paymentId: string, reason?: string) => Promise<void>;
  syncDriverSubscriptionPayment: (paymentId: string) => Promise<void>;
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
    planName: plan.name,
    status,
  };
}

function formatRealtimeErrorMessage(error: Error) {
  const message = error.message || '';
  const technicalFragments = [
    'Cannot read',
    'undefined',
    'null',
    'JSON',
    'NetworkError',
  ];

  if (technicalFragments.some((fragment) => message.includes(fragment))) {
    return 'Статус сверяется каждые 5 секунд.';
  }

  return message || 'Статус сверяется каждые 5 секунд.';
}

const initialDriverSubscription: DriverSubscription = createDriverAccessState('daily', 'inactive');

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<AppOrder[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>(initialDrivers);
  const [currentUser, setCurrentUser] = useState<AuthUser | undefined>();
  const [referralDashboard, setReferralDashboard] = useState<ReferralDashboard | undefined>();
  const [adminReferralDashboard, setAdminReferralDashboard] =
    useState<AdminReferralDashboard | undefined>();
  const [serviceShareSummary, setServiceShareSummary] =
    useState<DriverServiceShareSummary | undefined>();
  const [favoriteDrivers, setFavoriteDrivers] = useState<FavoriteDriver[]>([]);
  const [savedHomeAddress, setSavedHomeAddress] = useState<SavedPlace | undefined>();
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([]);
  const [driverSubscription, setDriverSubscription] =
    useState<DriverSubscription>(initialDriverSubscription);
  const [driverPayments, setDriverPayments] = useState<DriverSubscriptionPayment[]>([]);
  const [serverStatus, setServerStatus] = useState<ApiConnectionState>('checking');
  const [serverMessage, setServerMessage] = useState('Проверяем MVP backend...');
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionState>('connecting');
  const [realtimeMessage, setRealtimeMessage] = useState('Подключаем серверный поток заказов...');
  const [realtimeUpdatedAt, setRealtimeUpdatedAt] = useState<string | undefined>();
  const [simpleMode, setSimpleMode] = useState(false);

  const refreshServerData = useCallback(async () => {
    try {
      const [health, serverOrders, serverDrivers, serverSupportThreads] = await Promise.all([
        fetchApiHealth(),
        fetchOrders(),
        fetchDrivers(),
        fetchSupportThreads(),
      ]);

      setOrders(serverOrders);
      setDrivers(serverDrivers);
      setSupportThreads(serverSupportThreads);
      setServerStatus('connected');
      setServerMessage(`Backend подключен: ${health.service}`);
    } catch {
      setServerStatus('offline');
      setServerMessage('Backend не отвечает. Приложение работает локально, данные не сохранятся.');
    }
  }, []);

  const applyRealtimeSnapshot = useCallback((snapshot?: RealtimeSnapshot) => {
    if (
      !snapshot ||
      !Array.isArray(snapshot.orders) ||
      !Array.isArray(snapshot.drivers) ||
      !Array.isArray(snapshot.notifications)
    ) {
      setRealtimeStatus('polling');
      setRealtimeMessage('Статус сверяется каждые 5 секунд.');
      return;
    }

    setOrders(snapshot.orders);
    setDrivers(snapshot.drivers);
    setNotifications(snapshot.notifications);
    if (snapshot.supportThreads) {
      setSupportThreads(snapshot.supportThreads);
    }
    setRealtimeUpdatedAt(snapshot.generatedAt);
    setServerStatus('connected');
  }, []);

  useEffect(() => {
    refreshServerData();
  }, [refreshServerData]);

  useEffect(() => {
    configurePushNotifications(currentUser).catch((error) => {
      console.info(
        '[push] registration skipped',
        error instanceof Error ? error.message : 'unknown push registration error',
      );
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setRealtimeStatus('offline');
      setRealtimeMessage('Войдите, чтобы подключить поток заказов.');
      return undefined;
    }

    setRealtimeStatus('connecting');
    const unsubscribe = subscribeRealtime({
      onError: (error) => {
        setRealtimeStatus((current) => (current === 'live' ? 'polling' : current));
        setRealtimeMessage(formatRealtimeErrorMessage(error));
      },
      onMessage: (payload) => {
        // Лёгкое событие координат: точечно патчим одного водителя,
        // не трогая snapshot-ветку (у события snapshot нет).
        if (payload.type === 'driver_location' && payload.driverId && payload.location) {
          const { driverId, location } = payload;

          setDrivers((current) =>
            current.map((driver) =>
              driver.id === driverId
                ? {
                    ...driver,
                    lastLocation: location,
                    locationUpdatedAt: location.updatedAt,
                  }
                : driver,
            ),
          );
          setRealtimeUpdatedAt(payload.sentAt);
          setRealtimeStatus((current) => (current === 'connecting' ? 'live' : current));
          return;
        }

        applyRealtimeSnapshot(payload.snapshot);
        setRealtimeStatus((current) => (current === 'connecting' ? 'live' : current));
        if (payload.notification) {
          setRealtimeMessage(payload.notification.title);
        } else if (payload.type === 'snapshot') {
          setRealtimeMessage('Серверный поток заказов подключен.');
        }
      },
      onModeChange: (mode: RealtimeConnectionMode) => {
        if (mode === 'websocket') {
          setRealtimeStatus('live');
          setRealtimeMessage('WebSocket заказов подключен.');
          return;
        }

        if (mode === 'event-stream') {
          setRealtimeStatus('live');
          setRealtimeMessage('Серверный поток заказов подключен.');
          return;
        }

        setRealtimeStatus('polling');
        setRealtimeMessage('Поток событий недоступен, включено обновление каждые 5 секунд.');
      },
    });

    return unsubscribe;
  }, [applyRealtimeSnapshot, currentUser]);

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

  const refreshServiceShareSummary = useCallback(async (date?: string) => {
    try {
      const summary = await fetchServiceShareSummary(date);
      setServiceShareSummary(summary);
      setServerStatus('connected');
    } catch {
      setServiceShareSummary(undefined);
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
  }, [
    currentDriver?.id,
    currentDriver?.subscriptionStatus,
    currentDriver?.accessExpiresAt,
    currentDriver?.subscriptionExpiresAt,
  ]);

  const applyBillingDashboard = useCallback((dashboard: Awaited<ReturnType<typeof fetchDriverBilling>>) => {
    setDriverPayments(dashboard.payments);
    setDriverSubscription(createDriverSubscriptionFromProfile(dashboard.driver));
    setDrivers((current) =>
      current.map((driver) => (driver.id === dashboard.driver.id ? dashboard.driver : driver)),
    );
  }, []);

  const payDriverSubscription = useCallback(
    async (billingMode: DriverBillingMode = 'daily') => {
      const nextSubscription = createDriverAccessState(
        billingMode,
        billingMode === 'monthly' ? 'inactive' : 'active',
      );

      if (currentDriver && currentDriver.status !== 'approved') {
        setServerMessage('Сначала администратор должен одобрить водителя.');
        return;
      }

      if (!currentDriver) {
        setDriverSubscription(nextSubscription);
        setDriverPayments((current) => [
          createLocalDriverPayment(undefined, billingMode, nextSubscription),
          ...current,
        ]);
        setServerMessage(
          billingMode === 'monthly'
            ? 'Заявка на подключение тарифа отправлена. Администратор свяжется с вами для оплаты и активации.'
            : 'Дневной доступ открыт локально на 24 часа. Backend не привязан к текущему водителю.',
        );
        return;
      }

      try {
        const dashboard = await payDriverSubscriptionApi(currentDriver.id, billingMode);
        const pendingPayment = dashboard.payments.find(
          (payment) => payment.status === 'pending' && payment.confirmationUrl,
        );

        applyBillingDashboard(dashboard);
        setServerStatus('connected');
        setServerMessage(
          billingMode === 'monthly'
            ? 'Заявка на подключение тарифа отправлена. Администратор свяжется с вами для оплаты и активации.'
            : pendingPayment
              ? 'Backend создал внешнюю операцию. Для пилота используйте ручную сверку.'
              : 'Дневной доступ открыт на backend.',
        );
      } catch (error) {
        setDriverSubscription(nextSubscription);
        setDriverPayments((current) => [
          createLocalDriverPayment(currentDriver, billingMode, nextSubscription),
          ...current,
        ]);
        setServerStatus('offline');
        setServerMessage(
          billingMode === 'monthly'
            ? 'Заявка на подключение тарифа сохранена локально. Администратор свяжется с вами для оплаты и активации.'
            : error instanceof Error
              ? error.message
              : 'Backend не отвечает. Дневной доступ отмечен только локально.',
        );
      }
    },
    [applyBillingDashboard, currentDriver],
  );

  const syncDriverSubscriptionPayment = useCallback(
    async (paymentId: string) => {
      try {
        const dashboard = await syncDriverSubscriptionPaymentApi(paymentId);

        applyBillingDashboard(dashboard);
        setServerStatus('connected');
        setServerMessage('Статус ручной операции обновлен.');
      } catch (error) {
        setServerStatus('offline');
        setServerMessage(error instanceof Error ? error.message : 'Не удалось проверить ручную операцию.');
      }
    },
    [applyBillingDashboard],
  );

  const refundDriverSubscriptionPayment = useCallback(
    async (paymentId: string, reason = 'Отмена ручной операции в MVP') => {
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
        setServerMessage('Отмена ручной операции сохранена на backend.');
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
      activateDriverSubscription: (billingMode = 'daily') => {
        void payDriverSubscription(billingMode);
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
      declineOrderOffer: async (orderId, driverId) => {
        setOrders((current) =>
          current.map((order) =>
            order.id === orderId && order.exclusiveDriverId === driverId
              ? releaseLocalExclusiveOffer(order, 'declined')
              : order,
          ),
        );

        try {
          const serverOrder = await declineOrderOfferApi(orderId, driverId);
          setOrders((current) =>
            current.map((order) => (order.id === serverOrder.id ? serverOrder : order)),
          );
          setServerStatus('connected');
          setServerMessage('Заказ отправлен в общую ленту.');
          return serverOrder;
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Не удалось пропустить заказ.');
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
          const demoUser = createDemoAuthUser(identifier, password, role);

          if (demoUser) {
            setApiAuthToken(undefined);
            setCurrentUser(demoUser);
            setServerStatus('offline');
            setServerMessage('Открыт демо-вход без backend. Данные сохраняются только в браузере.');
            return demoUser;
          }

          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Не удалось войти.');
          return null;
        }
      },
      requestSmsLoginCode: async (phone, role, deliveryChannel = 'sms') => {
        try {
          const result = await requestSmsLoginCodeApi(phone, role, deliveryChannel);
          setServerStatus('connected');
          setServerMessage('SMS-код входа отправлен.');
          return result;
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Не удалось отправить SMS-код входа.');
          return null;
        }
      },
      confirmSmsLoginCode: async (phone, code, role) => {
        try {
          const result = await confirmSmsLoginCodeApi(phone, code, role);
          setApiAuthToken(result.session.token);
          setCurrentUser(result.user);
          setServerStatus('connected');
          setServerMessage('Вход по SMS выполнен.');
          await refreshServerData();
          await refreshReferralDashboard(result.user.id);
          return result.user;
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'SMS-код входа не подошел.');
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
          await refreshServiceShareSummary();
          return true;
        } catch (error) {
          const demoAdmin = createDemoAdminUser(password);

          if (demoAdmin) {
            setApiAuthToken('demo-admin-local-token');
            setCurrentUser(demoAdmin);
            setAdminReferralDashboard(undefined);
            setServiceShareSummary(undefined);
            setServerStatus('offline');
            setServerMessage('Демо-админ открыт локально без MVP backend.');
            return true;
          }

          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Админ-пароль не подошел.');
          return false;
        }
      },
      logoutAccount: async () => {
        try {
          await logoutAccountApi();
        } catch {
          // Local session state is cleared even when the backend is unreachable.
        }

        setApiAuthToken(undefined);
        setCurrentUser(undefined);
        setReferralDashboard(undefined);
        setAdminReferralDashboard(undefined);
        setServiceShareSummary(undefined);
        setDriverPayments([]);
        setDriverSubscription(initialDriverSubscription);
        setServerMessage('Вы вышли из аккаунта.');
      },
      deleteAccount: async (reason) => {
        try {
          const result = await deleteAccountApi(reason);
          setApiAuthToken(undefined);
          setCurrentUser(undefined);
          setReferralDashboard(undefined);
          setAdminReferralDashboard(undefined);
          setServiceShareSummary(undefined);
          setDriverPayments([]);
          setFavoriteDrivers([]);
          setSavedHomeAddress(undefined);
          setSupportThreads([]);
          setDriverSubscription(initialDriverSubscription);
          setServerStatus('connected');
          setServerMessage('Аккаунт и связанные персональные данные удалены.');
          await refreshServerData();
          return result;
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Не удалось удалить аккаунт.');
          return null;
        }
      },
      orders,
      notifications,
      payDriverSubscription,
      realtimeMessage,
      realtimeStatus,
      realtimeUpdatedAt,
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
      refundDriverSubscriptionPayment,
      syncDriverSubscriptionPayment,
      requestPasswordResetCode: async (identifier, deliveryChannel) => {
        try {
          const result = await requestPasswordResetCodeApi(identifier, deliveryChannel);
          setServerStatus('connected');
          setServerMessage('Код восстановления пароля отправлен.');
          return result;
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Не удалось отправить код.');
          return null;
        }
      },
      confirmPasswordReset: async (identifier, code, password) => {
        try {
          const result = await confirmPasswordResetApi(identifier, code, password);
          setApiAuthToken(result.session.token);
          setCurrentUser(result.user);
          setServerStatus('connected');
          setServerMessage('Пароль обновлен, вход выполнен.');
          await refreshServerData();
          await refreshReferralDashboard(result.user.id);
          return result.user;
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Код восстановления не подошел.');
          return null;
        }
      },
      requestVerificationCode: async (channel, target, deliveryChannel) => {
        try {
          const result = await requestVerificationCodeApi(channel, target, deliveryChannel);
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
      refreshAdminReferralDashboard,
      refreshServerData,
      refreshServiceShareSummary,
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
      serviceShareSummary,
      serverMessage,
      serverStatus,
      sendSupportMessage: ({ category, role, text, title }) => {
        const now = new Date().toISOString();
        const normalizedCategory = category.trim() || 'Общий вопрос';
        const threadId = `${role}-${normalizeThreadKey(normalizedCategory)}`;
        const trimmedText = text.trim();
        const userMessage: SupportMessage = {
          author: 'user',
          createdAt: now,
          id: `MSG-${Date.now()}`,
          text: trimmedText,
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

        void sendSupportMessageToServer({
          category: normalizedCategory,
          role,
          text: trimmedText,
          threadId,
          title: title?.trim() || normalizedCategory,
          userId: currentUser?.id,
        })
          .then((serverThread) => {
            setSupportThreads((current) => [
              serverThread,
              ...current.filter((thread) => thread.id !== serverThread.id),
            ]);
            setServerStatus('connected');
            setServerMessage('Сообщение отправлено на сервер сообщений.');
          })
          .catch((error) => {
            setServerStatus('offline');
            setServerMessage(
              error instanceof Error
                ? error.message
                : 'Сервер сообщений не отвечает. Сообщение сохранено локально.',
            );
          });
      },
      setSimpleMode,
      simpleMode,
      supportThreads,
      updateDriverAccess: async (driverId, billingMode, subscriptionStatus = 'active') => {
        try {
          const serverDriver = await updateDriverAccessApi(
            driverId,
            billingMode,
            subscriptionStatus,
            subscriptionStatus === 'active'
              ? 'Пилотная ручная активация'
              : 'Пилотное отключение доступа',
          );
          setDrivers((current) =>
            current.map((driver) => (driver.id === serverDriver.id ? serverDriver : driver)),
          );
          setServerStatus('connected');
          setServerMessage(
            subscriptionStatus === 'active'
              ? 'Пилотный доступ водителя активирован вручную.'
              : 'Пилотный доступ водителя отключен.',
          );
        } catch {
          setServerStatus('offline');
          setServerMessage('Backend не отвечает. Доступ водителя сохранен только локально.');
          setDrivers((current) =>
            current.map((driver) => {
              if (driver.id !== driverId) {
                return driver;
              }

              const plan = driverAccessPlans[billingMode];
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + (plan.accessDays ?? 1));
              const subscriptionExpiresAt =
                subscriptionStatus === 'active'
                  ? expiresAt.toISOString()
                  : undefined;
              const nextDriver = {
                ...driver,
                accessExpiresAt: subscriptionExpiresAt,
                billingMode,
                driverTariff: driverAccessPlans[billingMode].name,
                isOnline: subscriptionStatus === 'active' ? driver.isOnline : false,
                subscriptionExpiresAt,
                subscriptionPlan: driverAccessPlans[billingMode].subscriptionPlan,
                subscriptionStatus,
              };

              return {
                ...nextDriver,
                canReceiveOrders: hasCompletedDriverCompliance(nextDriver),
              };
            }),
          );
        }
      },
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
      reviewDriverDocuments: async (driverId, payload) => {
        try {
          const serverDriver = await reviewDriverDocumentsApi(driverId, payload);
          setDrivers((current) =>
            current.map((driver) => (driver.id === serverDriver.id ? serverDriver : driver)),
          );
          setServerStatus('connected');
          setServerMessage(
            payload.status === 'approved'
              ? 'Документы водителя одобрены на backend.'
              : payload.status === 'rejected'
                ? 'Отказ по документам сохранен на backend.'
                : 'Проверка документов возвращена в работу.',
          );
        } catch {
          setServerStatus('offline');
          setServerMessage('Backend не отвечает. Решение по документам сохранено только локально.');
          setDrivers((current) =>
            current.map((driver) => {
              if (driver.id !== driverId) {
                return driver;
              }

              const now = new Date().toISOString();
              const rejectedKinds =
                payload.status === 'rejected'
                  ? payload.rejectedKinds?.length
                    ? payload.rejectedKinds
                    : (Object.keys(driver.documentUploads ?? {}) as DriverDocumentKind[])
                  : [];
              const nextUploads = Object.fromEntries(
                Object.entries(driver.documentUploads ?? {}).map(([kind, upload]) => [
                  kind,
                  {
                    ...upload,
                    rejectionReason:
                      payload.status === 'rejected' && rejectedKinds.includes(kind as DriverDocumentKind)
                        ? payload.reason
                        : undefined,
                    reviewedAt: payload.status === 'pending' ? undefined : now,
                    status:
                      payload.status === 'rejected' && rejectedKinds.includes(kind as DriverDocumentKind)
                        ? 'rejected'
                        : payload.status,
                  },
                ]),
              ) as Partial<Record<DriverDocumentKind, DriverDocumentUpload>>;
              const nextDriver = {
                ...driver,
                documentReview: {
                  note: payload.note,
                  reason: payload.reason,
                  rejectedKinds,
                  reviewedAt: payload.status === 'pending' ? undefined : now,
                  status: payload.status,
                  submittedAt: driver.documentReview?.submittedAt,
                  submittedBy: driver.documentReview?.submittedBy,
                },
                documentUploads: nextUploads,
                documentsStatus: payload.status,
                vehiclePermitStatus:
                  payload.status === 'approved'
                    ? ('approved' as const)
                    : payload.status === 'rejected' &&
                        rejectedKinds.some((kind) => ['osago', 'osgop', 'sts'].includes(kind))
                      ? ('rejected' as const)
                      : driver.vehiclePermitStatus,
              };

              return {
                ...nextDriver,
                canReceiveOrders: hasCompletedDriverCompliance(nextDriver),
              };
            }),
          );
        }
      },
      submitDriverDocuments: async (driverId, documents) => {
        try {
          const serverDriver = await submitDriverDocumentsApi(driverId, documents);
          setDrivers((current) =>
            current.map((driver) => (driver.id === serverDriver.id ? serverDriver : driver)),
          );
          setServerStatus('connected');
          const message = 'Документы отправлены на проверку.';
          setServerMessage(message);
          return { message, ok: true };
        } catch (error) {
          if (error instanceof ApiHttpError) {
            // Сервер жив и осознанно отклонил пачку (например, файл больше
            // лимита): не подделываем локальный статус «на проверке»,
            // а показываем реальную причину.
            setServerStatus('connected');
            const message = `Сервер отклонил документы: ${error.message}`;
            setServerMessage(message);
            return { message, ok: false };
          }

          setServerStatus('offline');
          const message =
            'Backend не отвечает. Документы отмечены локально, файлы не сохранены на сервер.';
          setServerMessage(message);
          setDrivers((current) =>
            current.map((driver) => {
              if (driver.id !== driverId) {
                return driver;
              }

              const nextDriver = {
                ...driver,
                documentReview: {
                  rejectedKinds: [],
                  status: 'pending' as const,
                  submittedAt: new Date().toISOString(),
                },
                documentUploads: {
                  ...(driver.documentUploads ?? {}),
                  ...createLocalDocumentUploads(documents),
                },
                documentsStatus: 'pending' as const,
                vehiclePermitStatus:
                  documents.some((document) => ['osago', 'osgop', 'sts'].includes(document.kind))
                    ? ('pending' as const)
                    : driver.vehiclePermitStatus,
              };

              return {
                ...nextDriver,
                canReceiveOrders: hasCompletedDriverCompliance(nextDriver),
              };
            }),
          );
          // Локальный фолбэк зафиксировал документы (демо-режим), поэтому
          // выбор на экране можно очищать — ok: true.
          return { message, ok: true };
        }
      },
      updateDriverAvailability: async (driverId, isOnline, location) => {
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

        const locationUpdatedAt = location ? new Date().toISOString() : undefined;
        setDrivers((current) =>
          current.map((item) =>
            item.id === driverId
              ? {
                  ...item,
                  isOnline,
                  lastLocation:
                    isOnline && location
                      ? {
                          accuracy: location.accuracy,
                          latitude: location.latitude,
                          longitude: location.longitude,
                          updatedAt: locationUpdatedAt,
                        }
                      : item.lastLocation,
                  locationUpdatedAt: isOnline && location ? locationUpdatedAt : item.locationUpdatedAt,
                }
              : item,
          ),
        );

        try {
          const serverDriver = await updateDriverAvailabilityApi(driverId, isOnline, location);
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
      updateDriverLocation: async (driverId, location) => {
        // Лёгкий GPS-пинг: оптимистичный локальный патч + узкий PATCH без
        // смены статуса линии. Ошибки не шумят — следующий пинг догонит.
        const updatedAt = new Date().toISOString();

        setDrivers((current) =>
          current.map((item) =>
            item.id === driverId
              ? {
                  ...item,
                  lastLocation: {
                    accuracy: location.accuracy,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    updatedAt,
                  },
                  locationUpdatedAt: updatedAt,
                }
              : item,
          ),
        );

        try {
          const serverDriver = await updateDriverLocationApi(driverId, location);
          setDrivers((current) =>
            current.map((item) => (item.id === serverDriver.id ? serverDriver : item)),
          );
        } catch {
          // Локальная точка уже применена; статус сервера обновит
          // следующий пинг или основной канал.
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
      updateOrderStatus: async (orderId, status, pinCode) => {
        setOrders((current) => {
          const updatedOrders = current.map((order) =>
            order.id === orderId ? updateLocalOrderStatus(order, status) : order,
          );
          const changedOrder = updatedOrders.find((order) => order.id === orderId);

          return changedOrder?.driver?.id && ['closed', 'completed'].includes(changedOrder.status)
            ? recalculateLocalDriverDailyServiceShare(updatedOrders, changedOrder.driver.id, changedOrder)
            : updatedOrders;
        });

        try {
          const serverOrder = await updateOrderStatusApi(orderId, status, pinCode);
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
      updateOrderServiceShareStatus: async (orderId, status, note) => {
        setOrders((current) =>
          current.map((order) =>
            order.id === orderId ? updateLocalServiceShareStatus(order, status, note) : order,
          ),
        );

        try {
          const result = await updateOrderServiceShareStatusApi(orderId, status, note);
          setOrders((current) =>
            current.map((order) => (order.id === result.order.id ? result.order : order)),
          );
          if (result.summary) {
            setServiceShareSummary(result.summary);
          }
          setServerStatus('connected');
          setServerMessage('Сверка доли сервиса сохранена на сервере.');
        } catch (error) {
          setServerStatus('offline');
          setServerMessage(error instanceof Error ? error.message : 'Сверка отмечена только локально.');
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
      notifications,
      orders,
      realtimeMessage,
      realtimeStatus,
      realtimeUpdatedAt,
      referralDashboard,
      adminReferralDashboard,
      refreshAdminReferralDashboard,
      refreshReferralDashboard,
      refreshServerData,
      refreshServiceShareSummary,
      savedHomeAddress,
      serviceShareSummary,
      serverMessage,
      serverStatus,
      simpleMode,
      supportThreads,
      payDriverSubscription,
      refundDriverSubscriptionPayment,
      syncDriverSubscriptionPayment,
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

function createDemoAuthUser(identifier: string, password: string, role: AccountRole): AuthUser | null {
  if (!isDemoModeEnabled() || password !== 'Kinetix123') {
    return null;
  }

  const normalizedIdentifier = identifier.trim().toLowerCase();

  if (role === 'client' && normalizedIdentifier === 'demo-client@example.test') {
    return {
      id: 'demo-client-local',
      role: 'client',
      firstName: 'Демо',
      email: 'demo-client@example.test',
      emailVerifiedAt: new Date().toISOString(),
    };
  }

  if (
    role === 'self_employed_driver' &&
    normalizedIdentifier === 'demo-driver@example.test'
  ) {
    return {
      id: 'demo-driver-local',
      role: 'self_employed_driver',
      firstName: 'Демо-водитель',
      email: 'demo-driver@example.test',
      emailVerifiedAt: new Date().toISOString(),
    };
  }

  return null;
}

// Личный пароль владельца для входа в админку на бессерверном демо
// (github.io): бэкенда там нет, поэтому проверка локальная.
const localAdminPassword = '791021Tamik1221';

function createDemoAdminUser(password: string): AuthUser | null {
  if (!isDemoModeEnabled() || password.trim() !== localAdminPassword) {
    return null;
  }

  return {
    id: 'demo-admin-local',
    role: 'admin',
    firstName: 'Тамик',
    lastName: 'Админ',
    email: 'admin@kinetix.local',
    emailVerifiedAt: new Date().toISOString(),
    verificationStatus: 'approved',
  };
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
    billingMode: 'daily',
    canReceiveOrders: true,
    contractStatus: 'signed',
    documentsStatus: 'approved',
    isOnline: true,
    registryStatus: 'active',
    status: 'approved',
    subscriptionStatus: 'active',
    taxProfileStatus: 'approved',
    userId: 'demo-driver-local',
    vehiclePermitStatus: 'approved',
    updatedAt: new Date().toISOString(),
  },
];

function createDriverSubscriptionFromProfile(driver: DriverProfile): DriverSubscription {
  const expiresAt = getDriverSubscriptionExpiresAt(driver);
  const hasExpired =
    driver.subscriptionStatus === 'active' && expiresAt ? Date.parse(expiresAt) <= Date.now() : false;
  const billingMode = getEffectiveDriverBillingMode(driver);
  const plan = driverAccessPlans[billingMode];

  return {
    billingMode,
    expiresAt,
    monthlyPrice: plan.monthlyPrice,
    planName: plan.name,
    status: hasExpired ? 'expired' : driver.subscriptionStatus,
  };
}

function getDriverSubscriptionExpiresAt(driver: {
  accessExpiresAt?: string;
  subscriptionExpiresAt?: string;
}) {
  return driver.subscriptionExpiresAt ?? driver.accessExpiresAt;
}

function hasActiveDriverAccess(driver: {
  accessExpiresAt?: string;
  billingMode?: DriverBillingMode;
  subscriptionExpiresAt?: string;
  subscriptionStatus?: DriverSubscription['status'];
}) {
  if (!driver || driver.subscriptionStatus !== 'active') {
    return false;
  }

  const billingMode = normalizeBillingMode(driver.billingMode);
  if (billingMode !== 'daily' && billingMode !== 'monthly') {
    return false;
  }

  const expiresAt = getDriverSubscriptionExpiresAt(driver);
  if (!expiresAt) {
    return true;
  }

  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function isActivePartnerProDriver(driver?: {
  accessExpiresAt?: string;
  billingMode?: DriverBillingMode;
  subscriptionExpiresAt?: string;
  subscriptionStatus?: DriverSubscription['status'];
}) {
  if (!driver || driver.billingMode !== 'monthly' || driver.subscriptionStatus !== 'active') {
    return false;
  }

  const expiresAt = getDriverSubscriptionExpiresAt(driver);
  return Boolean(expiresAt && Date.parse(expiresAt) > Date.now());
}

function getEffectiveDriverBillingMode(driver?: {
  accessExpiresAt?: string;
  billingMode?: DriverBillingMode;
  subscriptionExpiresAt?: string;
  subscriptionStatus?: DriverSubscription['status'];
}) {
  return isActivePartnerProDriver(driver) ? 'monthly' : 'daily';
}

function createLocalDriverPayment(
  driver: DriverProfile | undefined,
  billingMode: DriverBillingMode,
  subscription: DriverSubscription,
): DriverSubscriptionPayment {
  const plan = driverAccessPlans[billingMode];
  const now = new Date().toISOString();
  const amount = plan.monthlyPrice;
  const id = `LOCAL-DSP-${Date.now().toString().slice(-7)}`;
  const isPendingManualPro = billingMode === 'monthly' && amount > 0;

  return {
    accessExpiresAt: isPendingManualPro ? undefined : subscription.expiresAt,
    accessStartsAt: now,
    amount,
    billingMode,
    createdAt: now,
    currency: 'RUB',
    driverId: driver?.id ?? 'local-driver',
    driverName: driver?.name,
    id,
    paidAt: isPendingManualPro ? undefined : now,
    paymentMethod: 'Ручной перевод на карту',
    planName: plan.name,
    provider: {
      mode: 'manual',
      name: 'manual-card-transfer',
    },
    providerPaymentStatus: isPendingManualPro ? 'awaiting_manual_transfer' : undefined,
    receipt: isPendingManualPro
      ? undefined
      : {
          currency: 'RUB',
          driverId: driver?.id ?? 'local-driver',
          fiscalNumber: `LOCAL-${id}`,
          fiscalStatus: 'demo',
          id: `LOCAL-RC-${Date.now().toString().slice(-7)}`,
          issuedAt: now,
          items: [{ amount, label: plan.name }],
          paymentId: id,
          paymentStatus: 'paid',
          total: amount,
        },
    status: isPendingManualPro ? 'pending' : 'paid',
    updatedAt: now,
  };
}

function hasCompletedDriverCompliance(driver: DriverProfile) {
  return (
    driver.status === 'approved' &&
    hasActiveDriverAccess(driver) &&
    driver.documentsStatus === 'approved' &&
    driver.contractStatus === 'signed' &&
    driver.vehiclePermitStatus === 'approved' &&
    driver.registryStatus === 'active' &&
    driver.taxProfileStatus === 'approved'
  );
}

function createLocalDocumentUploads(documents: DriverDocumentUploadInput[]) {
  return documents.reduce<Partial<Record<DriverDocumentKind, DriverDocumentUpload>>>((uploads, document) => {
    uploads[document.kind] = {
      fileName: document.fileName?.trim() || `${document.kind}.jpg`,
      fileSize: document.fileSize,
      height: document.height,
      kind: document.kind,
      mimeType: document.mimeType || 'image/jpeg',
      source: document.source,
      status: 'pending',
      uploadedAt: new Date().toISOString(),
      width: document.width,
    };

    return uploads;
  }, {});
}

function createLocalOrder(
  order: OrderStatusSummary,
  role: AccountRole,
  clientName?: string,
  user?: AuthUser,
): AppOrder {
  const createdAt = new Date().toISOString();
  const status = role === 'client' ? 'searching' : isDriverLikeRole(role) ? 'accepted' : 'created';
  const paymentStatus = getInitialPaymentStatus(order.paymentMethod, order.total);
  const fulfilledByRole = isDriverLikeRole(role)
    ? isParkDriverRole(role)
      ? 'park_driver'
      : 'self_employed'
    : undefined;

  return {
    ...order,
    clientName,
    clientPhone: user?.phone,
    createdAt,
    driver: isDriverLikeRole(role) ? defaultDriver : undefined,
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
    fulfilledByRole,
    parkId: user?.parkId,
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
  const serviceLabel = order.serviceType === 'delivery' ? 'Доставка' : 'Поездка';

  return {
    fiscalStatus: 'demo',
    fiscalNumber: `MVP-${order.id}`,
    id: `RC-${Date.now().toString().slice(-7)}`,
    items: [{ amount: order.total, label: `${serviceLabel} ${order.tariff}` }],
    issuedAt: new Date().toISOString(),
    orderId: order.id,
    paymentMethod: order.paymentMethod,
    paymentStatus: 'paid',
    subtotal: order.total,
    total: order.total,
  };
}

function updateLocalOrderStatus(order: AppOrder, status: string): AppOrder {
  const isFinal = ['closed', 'completed'].includes(status);
  const now = new Date().toISOString();
  const nextOrder: AppOrder = {
    ...order,
    arrivedAt: status === 'arrived' ? order.arrivedAt || now : order.arrivedAt,
    completedAt: isFinal ? order.completedAt || now : order.completedAt,
    paidAt: isFinal && order.paymentStatus !== 'paid' ? order.paidAt || now : order.paidAt,
    paymentStatus: isFinal ? 'paid' : order.paymentStatus,
    receipt: isFinal && !order.receipt ? createReceipt(order) : order.receipt,
    startedAt: status === 'started' ? order.startedAt || now : order.startedAt,
    status,
    statusHistory: [
      {
        actor: 'local',
        at: now,
        status,
      },
      ...(order.statusHistory ?? []),
    ],
    updatedAt: now,
  };

  return isFinal ? applyDriverCollectedSettlement(nextOrder) : nextOrder;
}

function releaseLocalExclusiveOffer(order: AppOrder, reason: 'declined' | 'expired'): AppOrder {
  const now = new Date().toISOString();

  return {
    ...order,
    dispatchMode: 'feed',
    dispatchStatus: reason === 'declined' ? 'driver_declined_open_feed' : 'open_feed',
    exclusiveOfferReleasedAt: order.exclusiveOfferReleasedAt || now,
    exclusiveOfferStatus: reason,
    statusHistory: [
      {
        actor: `exclusive-${reason}`,
        at: now,
        status: order.status,
      },
      ...(order.statusHistory ?? []),
    ],
    updatedAt: now,
  };
}

function applyDriverCollectedSettlement(order: AppOrder): AppOrder {
  const billingMode = order.driver
    ? getEffectiveDriverBillingMode(order.driver)
    : normalizeBillingMode(order.driverBillingMode);
  const driverCollectedAmount = Number(order.total || 0);
  const serviceShareRate = 0;
  const serviceShareAmount = 0;
  const driverNetAmount = driverCollectedAmount;
  const serviceShareStatus: DriverServiceShareStatus = 'not_applicable';

  return {
    ...order,
    driverBillingMode: billingMode,
    driverCollectedAmount,
    driverCommission: serviceShareAmount,
    driverCommissionRate: serviceShareRate,
    driverNetAmount,
    driverPayout: driverNetAmount,
    serviceShareAmount,
    serviceShareBatchDate: (order.completedAt || order.updatedAt || new Date().toISOString()).slice(0, 10),
    serviceShareRate,
    serviceShareStatus,
  };
}

function recalculateLocalDriverDailyServiceShare(orders: AppOrder[], driverId: string, changedOrder: AppOrder) {
  const batchDate = getLocalSettlementDate(changedOrder);
  const completedOrders = orders
    .filter(
      (order) =>
        order.driver?.id === driverId &&
        ['closed', 'completed'].includes(order.status) &&
        getLocalSettlementDate(order) === batchDate,
    )
    .sort((left, right) => getLocalSettlementTimestamp(left) - getLocalSettlementTimestamp(right));
  const orderIds = new Set(completedOrders.map((order) => order.id));

  return orders.map((order) => {
    if (!orderIds.has(order.id)) {
      return order;
    }

    const dailyIndex = completedOrders.findIndex((item) => item.id === order.id);
    const billingMode = order.driver ? getEffectiveDriverBillingMode(order.driver) : 'daily';

    return applyLocalOrderSettlement(order, billingMode, 0, dailyIndex + 1);
  });
}

function applyLocalOrderSettlement(
  order: AppOrder,
  billingMode: DriverBillingMode,
  serviceShareRate: number,
  driverDailyOrderNumber: number,
  trialActive = false,
) {
  const driverCollectedAmount = Number(order.total || 0);
  const serviceShareAmount = Math.round((driverCollectedAmount * serviceShareRate) / 100);
  const driverNetAmount = Math.max(0, driverCollectedAmount - serviceShareAmount);
  const serviceShareStatus: DriverServiceShareStatus =
    serviceShareAmount > 0
      ? ['reported_transferred', 'confirmed'].includes(order.serviceShareStatus ?? '')
        ? (order.serviceShareStatus as DriverServiceShareStatus)
        : 'pending_transfer'
      : 'not_applicable';

  return {
    ...order,
    driverBillingMode: billingMode,
    driverCollectedAmount,
    driverCommission: serviceShareAmount,
    driverCommissionRate: serviceShareRate,
    driverDailyOrderNumber,
    driverNetAmount,
    driverPayout: driverNetAmount,
    driverTrialActive: trialActive,
    serviceShareAmount,
    serviceShareBatchDate: getLocalSettlementDate(order),
    serviceShareRate,
    serviceShareStatus,
  };
}

function getLocalSettlementDate(order: AppOrder) {
  return String(order.serviceShareBatchDate || order.completedAt || order.updatedAt || order.createdAt).slice(0, 10);
}

function getLocalSettlementTimestamp(order: AppOrder) {
  return Date.parse(order.completedAt || order.updatedAt || order.createdAt || '') || 0;
}

function updateLocalServiceShareStatus(
  order: AppOrder,
  status: DriverServiceShareStatus,
  note?: string,
): AppOrder {
  const now = new Date().toISOString();

  return {
    ...order,
    serviceShareConfirmedAt:
      status === 'confirmed' ? now : order.serviceShareConfirmedAt,
    serviceShareEvents: [
      {
        actor: 'local',
        at: now,
        note,
        status,
      },
      ...(order.serviceShareEvents ?? []),
    ],
    serviceShareReportedAt:
      status === 'reported_transferred' || status === 'confirmed'
        ? order.serviceShareReportedAt || now
        : order.serviceShareReportedAt,
    serviceShareStatus: status,
    updatedAt: now,
  };
}

function normalizeBillingMode(value?: string): DriverBillingMode {
  return value === 'monthly' ? 'monthly' : 'daily';
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
