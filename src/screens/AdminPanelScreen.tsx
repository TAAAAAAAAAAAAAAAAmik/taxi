import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Eye,
  Gift,
  Headphones,
  LockKeyhole,
  Menu as MenuIcon,
  ShieldCheck,
  MapPinned,
  ReceiptText,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react-native';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  salavatAddressSuggestionCount,
  salavatDistrictSettlements,
  salavatDistrictStreetSourceSummary,
} from '../data/salavatDistrict';
import { KinetixCard, KinetixStatus } from '../components/KinetixUI';
import { salavatDistrictHouseSourceSummary } from '../data/salavatDistrictHouseSourceSummary';
import { isSelfEmployedDriverRole } from '../data/registration';
import { driverAccessPlans, DriverSubscriptionPayment } from '../data/subscription';
import { RootStackParamList } from '../navigation/types';
import {
  AdminAddressPoint,
  createAdminAddress,
  deleteAdminAddress,
  fetchAdminAddresses,
  fetchAdminDriverPayments,
  fetchDriverDocumentFile,
  ReferralStatus,
  updateAdminAddress,
  updateAdminReferralStatus,
} from '../services/apiClient';
import {
  AppOrder,
  DriverDocumentAuditEntry,
  DriverDocumentKind,
  DriverDocumentUpload,
  useAppState,
} from '../state/AppState';
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference';
import { isDemoModeEnabled } from '../utils/runtimeFlags';
import { styles } from './AdminPanelScreen.styles';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminPanel'>;

const demoAdminPassword = 'admin-demo-5000';

type AdminSectionId =
  | 'stats'
  | 'overview'
  | 'orders'
  | 'drivers'
  | 'clients'
  | 'settlements'
  | 'pro'
  | 'referrals'
  | 'settings'
  | 'users'
  | 'fleets'
  | 'system'
  | 'support';

type AdminNavItem = {
  id: AdminSectionId;
  title: string;
  subtitle: string;
  icon: typeof ShieldCheck;
};

type AdminDriverSort = 'earnings' | 'hours' | 'rating';

type AdminClientAnalytics = {
  completedCount: number;
  key: string;
  lastOrderAt: string;
  name: string;
  ordersCount: number;
  totalSpent: number;
};

const adminPrimarySections: AdminNavItem[] = [
  { id: 'stats', title: 'Статистика', subtitle: 'Ключевые показатели', icon: ShieldCheck },
  { id: 'drivers', title: 'Водители', subtitle: 'Рейтинг и активность', icon: UsersRound },
  { id: 'clients', title: 'Клиенты', subtitle: 'Активность и база', icon: UsersRound },
  { id: 'orders', title: 'Поездки', subtitle: 'Количество и маршруты', icon: ReceiptText },
];

const adminDrawerSections: AdminNavItem[] = [
  { id: 'settlements', title: 'Расчеты', subtitle: 'Сверки и оплаты', icon: Wallet },
  { id: 'pro', title: 'PRO-заявки', subtitle: 'Партнер PRO и оплаты', icon: Wallet },
  { id: 'referrals', title: 'Рефералы', subtitle: 'Бонусы на подтверждение', icon: Gift },
  { id: 'settings', title: 'Настройки', subtitle: 'Адресный слой и данные', icon: MapPinned },
  { id: 'users', title: 'Пользователи', subtitle: 'Роли и доступы', icon: UsersRound },
  { id: 'system', title: 'Системные действия', subtitle: 'Обновления и сервисы', icon: ShieldCheck },
  { id: 'support', title: 'Поддержка', subtitle: 'Обращения пользователей', icon: Headphones },
];

export function AdminPanelScreen({ navigation }: Props) {
  const [password, setPassword] = useState('');
  const [documentAccessNotices, setDocumentAccessNotices] = useState<Record<string, string>>({});
  const [documentReviewReasons, setDocumentReviewReasons] = useState<Record<string, string>>({});
  const [addressNotice, setAddressNotice] = useState('');
  const [adminAddresses, setAdminAddresses] = useState<AdminAddressPoint[]>([]);
  const [adminDriverPayments, setAdminDriverPayments] = useState<DriverSubscriptionPayment[]>([]);
  const [serviceShareDate, setServiceShareDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [referralBusyId, setReferralBusyId] = useState<string | undefined>();
  const [activeSection, setActiveSection] = useState<AdminSectionId>('stats');
  const [driverSort, setDriverSort] = useState<AdminDriverSort>('rating');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addressForm, setAddressForm] = useState({
    category: 'address',
    latitude: '',
    longitude: '',
    settlement: 'Салаватский район',
    subtitle: '',
    title: '',
  });
  const [editingAddressId, setEditingAddressId] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const {
    adminReferralDashboard,
    assignOrderToDriver,
    driverSubscription,
    drivers,
    orders,
    loginAdmin,
    notifications,
    refreshAdminReferralDashboard,
    refreshServerData,
    refreshServiceShareSummary,
    realtimeMessage,
    realtimeStatus,
    realtimeUpdatedAt,
    reviewDriverDocuments,
    serverMessage,
    serverStatus,
    serviceShareSummary,
    supportThreads,
    updateDriverAccess,
    updateDriverComplianceStatus,
    updateOrderServiceShareStatus,
    updateDriverReviewStatus,
  } = useAppState();
  const approvedDrivers = useMemo(
    () => drivers.filter((driver) => driver.canReceiveOrders),
    [drivers],
  );
  const expiringPolicyUploads = useMemo(
    () =>
      drivers.flatMap((driver) =>
        (['osago', 'osgop'] as DriverDocumentKind[])
          .map((kind) => ({ driver, kind, upload: driver.documentUploads?.[kind] }))
          .filter(({ upload }) => isExpiringPolicy(upload)),
      ),
    [drivers],
  );
  const showDemoAdmin = isDemoModeEnabled();
  const activePartnerProDrivers = useMemo(
    () => drivers.filter((driver) => isPartnerProActive(driver)),
    [drivers],
  );
  const onlineDriversCount = useMemo(
    () => drivers.reduce((count, driver) => count + (driver.isOnline ? 1 : 0), 0),
    [drivers],
  );
  const pendingPartnerProPayments = useMemo(
    () =>
      adminDriverPayments.filter(
        (payment) => payment.billingMode === 'monthly' && payment.status === 'pending',
      ),
    [adminDriverPayments],
  );
  const {
    active: activeAdminOrders,
    byDriver: ordersByDriver,
    cancelled: cancelledAdminOrders,
    client: clientAdminOrders,
    completed: completedAdminOrders,
    delivery: deliveryAdminOrders,
    longest: longestAdminOrder,
  } = useMemo(
    () => {
      const active: AppOrder[] = [];
      const cancelled: AppOrder[] = [];
      const client: AppOrder[] = [];
      const completed: AppOrder[] = [];
      const delivery: AppOrder[] = [];
      const byDriver = new Map<string, AppOrder[]>();
      let longest: AppOrder | undefined;

      orders.forEach((order) => {
        const status = String(order.status);

        if (status === 'completed') {
          completed.push(order);
        }

        if (status === 'cancelled' || status === 'canceled') {
          cancelled.push(order);
        }

        if (status !== 'completed' && status !== 'cancelled' && status !== 'canceled') {
          active.push(order);
        }

        if (order.serviceType === 'delivery') {
          delivery.push(order);
        }

        if (order.role === 'client') {
          client.push(order);
        }

        if (order.driver?.id) {
          const driverOrders = byDriver.get(order.driver.id) ?? [];
          driverOrders.push(order);
          byDriver.set(order.driver.id, driverOrders);
        }

        if ((order.routeEstimate?.distanceKm ?? 0) > (longest?.routeEstimate?.distanceKm ?? 0)) {
          longest = order;
        }
      });

      return { active, byDriver, cancelled, client, completed, delivery, longest };
    },
    [orders],
  );
  const dailyServiceShare = useMemo(
    () => serviceShareSummary ?? buildLocalServiceShareSummary(orders, serviceShareDate),
    [orders, serviceShareDate, serviceShareSummary],
  );
  const driverAnalytics = useMemo(
    () =>
      drivers.map((driver) => {
        const driverOrders = ordersByDriver.get(driver.id) ?? [];
        const completedOrders = driverOrders.filter(isCompletedOrder);
        const earnings = completedOrders.reduce(
          (sum, order) => sum + (order.driverCollectedAmount ?? order.total ?? 0),
          0,
        );
        const workHours = completedOrders.reduce((sum, order) => sum + getOrderWorkHours(order), 0);

        return {
          driver,
          earnings,
          ordersCount: driverOrders.length,
          completedCount: completedOrders.length,
          rating: driver.rating ?? 0,
          workHours,
        };
      }),
    [drivers, ordersByDriver],
  );
  const sortedDriverAnalytics = useMemo(
    () =>
      [...driverAnalytics].sort((left, right) => {
        if (driverSort === 'earnings') {
          return right.earnings - left.earnings;
        }

        if (driverSort === 'hours') {
          return right.workHours - left.workHours;
        }

        return right.rating - left.rating;
      }),
    [driverAnalytics, driverSort],
  );
  const clientAnalytics = useMemo(() => buildClientAnalytics(orders), [orders]);
  const totalClientSpend = useMemo(
    () => clientAnalytics.reduce((sum, client) => sum + client.totalSpent, 0),
    [clientAnalytics],
  );
  const pendingPartnerProOverview = useMemo(
    () => pendingPartnerProPayments.slice(0, 8),
    [pendingPartnerProPayments],
  );
  const pendingPartnerProList = useMemo(
    () => pendingPartnerProPayments.slice(0, 12),
    [pendingPartnerProPayments],
  );
  const dailyServiceShareDriversPreview = useMemo(
    () => dailyServiceShare.drivers.slice(0, 6),
    [dailyServiceShare],
  );
  const referralPreviewItems = useMemo(
    () => adminReferralDashboard?.referrals.slice(0, 8) ?? [],
    [adminReferralDashboard?.referrals],
  );
  const clientAnalyticsPreview = useMemo(
    () => clientAnalytics.slice(0, 10),
    [clientAnalytics],
  );
  const adminAddressesPreview = useMemo(
    () => adminAddresses.slice(0, 6),
    [adminAddresses],
  );
  const adminDriversPreview = useMemo(
    () => drivers.slice(0, 6),
    [drivers],
  );
  const supportThreadsPreview = useMemo(
    () => supportThreads.slice(0, 8),
    [supportThreads],
  );
  const adminOrdersPreview = useMemo(
    () => orders.slice(0, 5),
    [orders],
  );
  const approvedDriverAssignPreview = useMemo(
    () => approvedDrivers.slice(0, 2),
    [approvedDrivers],
  );

  const loadAdminAddresses = useCallback(async () => {
    try {
      const addresses = await fetchAdminAddresses();
      setAdminAddresses(addresses);
      setAddressNotice(`Адресный слой обновлен: ${addresses.length} ручных точек.`);
    } catch (error) {
      setAddressNotice(error instanceof Error ? error.message : 'Не удалось загрузить адреса.');
    }
  }, []);

  const loadAdminDriverPayments = useCallback(async () => {
    try {
      const payments = await fetchAdminDriverPayments();
      setAdminDriverPayments(payments);
    } catch {
      setAdminDriverPayments([]);
    }
  }, []);

  useEffect(() => {
    if (unlocked) {
      void loadAdminAddresses();
      void refreshServiceShareSummary(serviceShareDate);
      void loadAdminDriverPayments();
    }
  }, [loadAdminAddresses, loadAdminDriverPayments, refreshServiceShareSummary, serviceShareDate, unlocked]);

  const updateAddressForm = (field: keyof typeof addressForm, value: string) => {
    setAddressForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const resetAddressForm = () => {
    setEditingAddressId(undefined);
    setAddressForm({
      category: 'address',
      latitude: '',
      longitude: '',
      settlement: 'Салаватский район',
      subtitle: '',
      title: '',
    });
  };

  const editAddress = (address: AdminAddressPoint) => {
    setEditingAddressId(address.id);
    setAddressForm({
      category: address.category,
      latitude: address.coordinates?.latitude ? String(address.coordinates.latitude) : '',
      longitude: address.coordinates?.longitude ? String(address.coordinates.longitude) : '',
      settlement: address.settlement,
      subtitle: address.subtitle,
      title: address.title,
    });
  };

  const saveAddress = async () => {
    const title = addressForm.title.trim();

    if (!title) {
      setAddressNotice('Укажите название улицы, дома или POI.');
      return;
    }

    const latitude = Number(addressForm.latitude.replace(',', '.'));
    const longitude = Number(addressForm.longitude.replace(',', '.'));
    const coordinates =
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude, longitude }
        : undefined;
    const payload = {
      category: addressForm.category.trim() || 'address',
      coordinates,
      displayAddress: [title, addressForm.subtitle.trim()].filter(Boolean).join(', '),
      settlement: addressForm.settlement.trim() || 'Салаватский район',
      subtitle: addressForm.subtitle.trim(),
      title,
    };

    try {
      const address = editingAddressId
        ? await updateAdminAddress(editingAddressId, payload)
        : await createAdminAddress(payload);
      setAdminAddresses((current) => [
        address,
        ...current.filter((item) => item.id !== address.id),
      ]);
      setAddressNotice(editingAddressId ? 'Адрес обновлен и попадет в подсказки.' : 'Адрес добавлен в подсказки.');
      resetAddressForm();
    } catch (error) {
      setAddressNotice(error instanceof Error ? error.message : 'Не удалось сохранить адрес.');
    }
  };

  const removeAddress = async (addressId: string) => {
    try {
      await deleteAdminAddress(addressId);
      setAdminAddresses((current) => current.filter((address) => address.id !== addressId));
      setAddressNotice('Адрес удален из ручного слоя подсказок.');
      if (editingAddressId === addressId) {
        resetAddressForm();
      }
    } catch (error) {
      setAddressNotice(error instanceof Error ? error.message : 'Не удалось удалить адрес.');
    }
  };

  const updateDocumentReviewReason = (driverId: string, reason: string) => {
    setDocumentReviewReasons((current) => ({
      ...current,
      [driverId]: reason,
    }));
  };

  const approveDriverDocuments = async (driverId: string) => {
    await reviewDriverDocuments(driverId, {
      note: documentReviewReasons[driverId],
      status: 'approved',
    });
    updateDocumentReviewReason(driverId, '');
  };

  const openDriverDocumentFile = async (driverId: string, kind: DriverDocumentKind) => {
    const noticeKey = `${driverId}:${kind}`;

    setDocumentAccessNotices((current) => ({
      ...current,
      [noticeKey]: 'Открываем защищенный файл...',
    }));

    try {
      const file = await fetchDriverDocumentFile(driverId, kind);
      const browserBridge = globalThis as typeof globalThis & {
        URL?: {
          createObjectURL?: (blob: Blob) => string;
          revokeObjectURL?: (url: string) => void;
        };
        open?: (url: string, target?: string, features?: string) => unknown;
      };
      const objectUrl = browserBridge.URL?.createObjectURL?.(file.blob);

      if (objectUrl && typeof browserBridge.open === 'function') {
        browserBridge.open(objectUrl, '_blank', 'noopener,noreferrer');
        setTimeout(() => browserBridge.URL?.revokeObjectURL?.(objectUrl), 60_000);
      }

      setDocumentAccessNotices((current) => ({
        ...current,
        [noticeKey]: `${documentLabels[kind]}: файл доступен сотруднику (${formatFileSize(file.size)}).`,
      }));
    } catch (error) {
      setDocumentAccessNotices((current) => ({
        ...current,
        [noticeKey]: `Не удалось открыть ${documentLabels[kind]}: ${
          error instanceof Error ? error.message : 'ошибка доступа'
        }`,
      }));
    }
  };

  const rejectDriverDocuments = async (driverId: string, rejectedKinds: DriverDocumentKind[]) => {
    const reason = documentReviewReasons[driverId]?.trim() || 'Фото не читается или данные не совпадают.';

    await reviewDriverDocuments(driverId, {
      reason,
      rejectedKinds,
      status: 'rejected',
    });
  };

  const stats = useMemo(
    () => [
      {
        label: 'Заказы',
        value: String(orders.length),
        helper: serverStatus === 'connected' ? 'Загружены с MVP backend' : 'Локальная сессия приложения',
      },
      {
        label: 'Доставка',
        value: String(deliveryAdminOrders.length),
        helper: 'Заказы с типом delivery',
      },
      {
        label: 'Водители',
        value: String(drivers.length),
        helper: `${approvedDrivers.length} одобрено для заказов`,
      },
      {
        label: 'Клиенты',
        value: String(clientAnalytics.length),
        helper: `${totalClientSpend} ₽ сумма поездок`,
      },
      {
        label: 'Обращения поддержки',
        value: String(supportThreads.length),
        helper: 'Локальные обращения до подключения сервера сообщений',
      },
      {
        label: 'Улицы и дороги',
        value: String(salavatDistrictStreetSourceSummary.streets),
        helper: `${salavatDistrictSettlements.length} населенных пунктов Салаватского района`,
      },
      {
        label: 'Точные дома',
        value: String(salavatDistrictHouseSourceSummary.houses),
        helper:
          salavatDistrictHouseSourceSummary.houses > 0
            ? 'Загружены из открытого адресного слоя'
            : 'Запустите импорт домов из OpenStreetMap/GAR',
      },
      {
        label: 'Рефералы',
        value: String(adminReferralDashboard?.summary.referrals ?? 0),
        helper: `${adminReferralDashboard?.summary.rewarded ?? 0} начислено, ${
          adminReferralDashboard?.summary.walletTotal ?? 0
        } ₽ бонусами`,
      },
    ],
    [
      adminReferralDashboard?.summary.referrals,
      adminReferralDashboard?.summary.rewarded,
      adminReferralDashboard?.summary.walletTotal,
      approvedDrivers.length,
      clientAnalytics.length,
      deliveryAdminOrders.length,
      drivers.length,
      orders.length,
      serverStatus,
      supportThreads.length,
      totalClientSpend,
    ],
  );

  const handleSubmit = async (nextPassword?: string) => {
    const passwordToSubmit = typeof nextPassword === 'string' ? nextPassword : password;

    setSubmitted(true);

    if (await loginAdmin(passwordToSubmit)) {
      setUnlocked(true);
    }
  };

  const handleDemoSubmit = async () => {
    setPassword(demoAdminPassword);
    setSubmitted(false);
    await handleSubmit(demoAdminPassword);
  };

  const markDriverDailySettlementPaid = async (driverId: string) => {
    const driverOrders = dailyServiceShare.orders.filter(
      (order) => order.driverId === driverId && order.serviceShareAmount > 0 && order.status !== 'confirmed',
    );

    await Promise.all(
      driverOrders.map((order) =>
        updateOrderServiceShareStatus(order.id, 'confirmed', 'Admin marked daily driver settlement as paid'),
      ),
    );
    await refreshServiceShareSummary(serviceShareDate);
  };

  const updateReferralStatus = async (referralId: string, status: ReferralStatus) => {
    setReferralBusyId(referralId);
    try {
      await updateAdminReferralStatus(referralId, status, 'Ручное решение администратора');
      await refreshAdminReferralDashboard();
    } finally {
      setReferralBusyId(undefined);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.adminShell}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" style={styles.adminScroll}>
        <View style={styles.topBar}>
          {unlocked ? (
            <Pressable
              accessibilityLabel="Открыть меню"
              accessibilityRole="button"
              onPress={() => setDrawerOpen(true)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <MenuIcon color="#008D49" size={24} strokeWidth={2.5} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color="#008D49" size={20} strokeWidth={2.4} />
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
        </View>

        {!unlocked ? (
          <View style={styles.loginCard}>
            <View style={styles.iconWrap}>
              <LockKeyhole color="#008D49" size={30} strokeWidth={2.4} />
            </View>
            <Text numberOfLines={2} style={styles.title}>Админ-панель</Text>
            <Text numberOfLines={3} style={styles.subtitle}>
              Для входа нужен только личный пароль администратора. Логин, телефон и почта не
              запрашиваются.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Пароль администратора</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(value) => {
                  setPassword(value);
                  setSubmitted(false);
                }}
                onSubmitEditing={() => handleSubmit()}
                placeholder="Введите личный пароль"
                placeholderTextColor="#557669"
                secureTextEntry
                style={styles.input}
                value={password}
              />
              {submitted && !unlocked ? (
                <Text style={styles.errorText}>Пароль не подошел. Проверьте ввод.</Text>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => handleSubmit()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <ShieldCheck color="#12382C" size={18} strokeWidth={2.4} />
              <Text style={styles.primaryButtonText}>Войти в админ-панель</Text>
            </Pressable>

            {showDemoAdmin ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleDemoSubmit}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <LockKeyhole color="#008D49" size={18} strokeWidth={2.4} />
                <Text style={styles.secondaryButtonText}>Демо-админ</Text>
              </Pressable>
            ) : null}

            <Text numberOfLines={3} style={styles.helperText}>
              {showDemoAdmin
                ? 'Пароль проверяется на MVP backend. Для локального запуска по умолчанию: admin-demo-5000. Перед пилотом задайте MVP_ADMIN_PASSWORD.'
                : 'Пароль проверяется на backend. Для production задайте MVP_ADMIN_PASSWORD в секретах окружения.'}
            </Text>
          </View>
        ) : (
          <View style={styles.adminLayout}>
            <View style={styles.headerCard}>
              <Text numberOfLines={2} style={styles.title}>Админ-панель</Text>
              <Text numberOfLines={2} style={styles.subtitle}>
                Основные разделы снизу. Дополнительные проверки, рефералы, PRO и системные действия в меню.
              </Text>
            </View>

            <View style={styles.adminPathRow}>
              <Text style={styles.adminPathMuted}>Админ</Text>
              <Text style={styles.adminPathDivider}>/</Text>
              <Text style={styles.adminPathActive}>{getAdminSectionTitle(activeSection)}</Text>
            </View>

            <AdminWorkbench
              activeOrdersCount={activeAdminOrders.length}
              clientsCount={clientAnalytics.length}
              driversCount={drivers.length}
              onSelect={setActiveSection}
              pendingProCount={pendingPartnerProPayments.length}
              pendingReferralCount={adminReferralDashboard?.summary.qualified ?? 0}
              selectedSection={activeSection}
              settlementsAmount={dailyServiceShare.summary.pendingTransferAmount}
            />

            <View style={[styles.sectionCard, activeSection !== 'stats' && styles.hiddenSection]}>
              <View style={styles.sectionHeader}>
                <ShieldCheck color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Backend</Text>
              </View>
              <Text style={styles.sectionText}>
                Статус: {serverStatus === 'connected' ? 'подключен' : 'локальный режим'}.
              </Text>
              <Text style={styles.sectionText}>
                Real-time: {formatRealtimeStatus(realtimeStatus)}
                {realtimeUpdatedAt ? ` · ${new Date(realtimeUpdatedAt).toLocaleTimeString('ru-RU')}` : ''}.
              </Text>
              <Text numberOfLines={2} style={styles.sectionTextMuted}>{serverMessage}</Text>
              <Text numberOfLines={2} style={styles.sectionTextMuted}>{realtimeMessage}</Text>
              {notifications[0] ? (
                <View style={styles.orderRow}>
                  <Text numberOfLines={1} style={styles.orderTitle}>{notifications[0].title}</Text>
                  <Text numberOfLines={2} style={styles.orderText}>{notifications[0].body}</Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={refreshServerData}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Обновить данные</Text>
              </Pressable>
            </View>

            <View style={[styles.statsGrid, activeSection !== 'stats' && styles.hiddenSection]}>
              {stats.map((item) => (
                <View key={item.label} style={styles.statCard}>
                  <Text numberOfLines={1} style={styles.statLabel}>{item.label}</Text>
                  <Text style={styles.statValue}>{item.value}</Text>
                  <Text numberOfLines={2} style={styles.statHelper}>{item.helper}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.sectionCard, activeSection !== 'settlements' && styles.hiddenSection]}>
              <View style={styles.sectionHeader}>
                <Wallet color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Расчеты с водителем</Text>
              </View>
              <PlanRow title={driverAccessPlans.monthly.name} value={driverAccessPlans.monthly.headline} />
              <PlanRow title={driverAccessPlans.daily.name} value={driverAccessPlans.daily.headline} />
              <View style={styles.inlineForm}>
                <TextInput
                  onChangeText={setServiceShareDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#557669"
                  style={[styles.input, styles.inlineInput]}
                  value={serviceShareDate}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => refreshServiceShareSummary(serviceShareDate)}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>Показать дату</Text>
                </Pressable>
              </View>
              <Text style={styles.sectionText}>
                Сегодня: собрано {dailyServiceShare.summary.totalCollectedAmount} ₽, доля сервиса{' '}
                {dailyServiceShare.summary.totalServiceShareAmount} ₽, ожидает перевода{' '}
                {dailyServiceShare.summary.pendingTransferAmount} ₽, водитель отметил{' '}
                {dailyServiceShare.summary.reportedTransferAmount} ₽, подтверждено{' '}
                {dailyServiceShare.summary.confirmedAmount} ₽.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => refreshServiceShareSummary(serviceShareDate)}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Обновить сверку</Text>
              </Pressable>
              {activePartnerProDrivers.length ? (
                <View style={styles.reviewBox}>
                  <Text style={styles.orderTitle}>Партнёр PRO активен</Text>
                  {activePartnerProDrivers.map((driver) => (
                    <Text key={driver.id} style={styles.orderText}>
                      {driver.name} · до {formatDate(driver.subscriptionExpiresAt ?? driver.accessExpiresAt)}
                    </Text>
                  ))}
                </View>
              ) : null}
              {pendingPartnerProPayments.length ? (
                <View style={styles.reviewBox}>
                  <Text style={styles.orderTitle}>Заявки на PRO</Text>
                  {pendingPartnerProOverview.map((payment) => (
                    <View key={payment.id} style={styles.orderRow}>
                      <Text style={styles.orderText}>
                        {payment.driverName || payment.driverId} · {payment.amount} ₽ · ожидает оплаты/проверки
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={async () => {
                          await updateDriverAccess(payment.driverId, 'monthly', 'active');
                          await loadAdminDriverPayments();
                        }}
                        style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.smallButtonText}>Активировать на 30 дней</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              {dailyServiceShare.drivers.length ? (
                dailyServiceShareDriversPreview.map((driver) => (
                  <View key={driver.driverId} style={styles.orderRow}>
                    <Text style={styles.orderTitle}>
                      {driver.driverName} · {driver.ordersCount} заказов
                    </Text>
                    <Text style={styles.orderText}>
                      Оборот {driver.totalCollectedAmount} ₽ · доля сервиса {driver.totalServiceShareAmount} ₽ ·{' '}
                      {driver.currentCommissionPercent ?? 0}%
                    </Text>
                    <Text style={styles.orderText}>
                      Статус: {formatServiceShareStatus(driver.settlementStatus)} · ожидает {driver.pendingTransferAmount} ₽ · оплачено {driver.confirmedAmount} ₽
                    </Text>
                    {driver.totalServiceShareAmount > 0 && driver.settlementStatus !== 'confirmed' ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => markDriverDailySettlementPaid(driver.driverId)}
                        style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.smallButtonText}>Отметить как оплачено</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.sectionTextMuted}>Сегодня нет начисленной доли сервиса.</Text>
              )}
              <Text numberOfLines={2} style={styles.sectionText}>
                В схеме доли сервиса клиент платит водителю напрямую, а backend начисляет сумму к
                вечернему переводу по завершенным поездкам.
              </Text>
            </View>

            <View style={[styles.sectionCard, activeSection !== 'pro' && styles.hiddenSection]}>
              <View style={styles.sectionHeader}>
                <Wallet color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>PRO-заявки</Text>
              </View>
              <PlanRow title={driverAccessPlans.monthly.name} value={driverAccessPlans.monthly.headline} />
              <Text numberOfLines={2} style={styles.sectionTextMuted}>
                Ручная оплата и активация на 30 дней остаются через админ-панель.
              </Text>
              {pendingPartnerProPayments.length ? (
                pendingPartnerProList.map((payment) => (
                  <View key={payment.id} style={styles.orderRow}>
                    <Text numberOfLines={1} style={styles.orderTitle}>
                      {payment.driverName || payment.driverId} · {payment.amount} ₽
                    </Text>
                    <Text numberOfLines={1} style={styles.orderText}>
                      Статус оплаты: {payment.status} · создано {formatDate(payment.createdAt)}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={async () => {
                        await updateDriverAccess(payment.driverId, 'monthly', 'active');
                        await loadAdminDriverPayments();
                      }}
                      style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.smallButtonText}>Активировать на 30 дней</Text>
                    </Pressable>
                  </View>
                ))
              ) : (
                <Text style={styles.sectionTextMuted}>Новых заявок на PRO пока нет.</Text>
              )}
              {activePartnerProDrivers.length ? (
                <View style={styles.reviewBox}>
                  <Text style={styles.orderTitle}>Активные PRO-водители</Text>
                  {activePartnerProDrivers.map((driver) => (
                    <Text key={driver.id} style={styles.orderText}>
                      {driver.name} · до {formatDate(driver.subscriptionExpiresAt ?? driver.accessExpiresAt)}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={[styles.sectionCard, activeSection !== 'referrals' && styles.hiddenSection]}>
              <View style={styles.sectionHeader}>
                <Gift color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Рефералы</Text>
              </View>
              <Text numberOfLines={2} style={styles.sectionText}>
                Всего: {adminReferralDashboard?.summary.referrals ?? 0}. Регистрация:{' '}
                {adminReferralDashboard?.summary.registered ?? 0}. В процессе:{' '}
                {adminReferralDashboard?.summary.qualified ?? 0}. Начислено:{' '}
                {adminReferralDashboard?.summary.rewarded ?? 0}.
              </Text>
              <Text numberOfLines={1} style={styles.sectionTextMuted}>
                Бонусных операций: {adminReferralDashboard?.summary.walletEntries ?? 0}. Сумма:{' '}
                {adminReferralDashboard?.summary.walletTotal ?? 0} ₽.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={refreshAdminReferralDashboard}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Обновить рефералы</Text>
              </Pressable>
              {adminReferralDashboard?.referrals.length ? (
                referralPreviewItems.map((referral) => (
                  <View key={referral.id} style={styles.orderRow}>
                    <Text numberOfLines={1} style={styles.orderTitle}>
                      {referral.inviterName} → {referral.inviteeName}
                    </Text>
                    <Text numberOfLines={1} style={styles.orderText}>
                      {isSelfEmployedDriverRole(referral.inviteeRole) ? 'Водитель' : 'Клиент'} · {referral.status} ·{' '}
                      {referral.rewardAmount} ₽
                    </Text>
                    <Text numberOfLines={1} style={styles.orderText}>
                      Прогресс: {referral.progress?.completedOrders ?? 0}/
                      {referral.progress?.requiredOrders ?? 0} поездок · код {referral.code}
                    </Text>
                    {isSelfEmployedDriverRole(referral.inviteeRole) && referral.status === 'qualified' ? (
                      <View style={styles.rowActions}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={referralBusyId === referral.id}
                          onPress={() => updateReferralStatus(referral.id, 'rewarded')}
                          style={({ pressed }) => [
                            styles.smallButton,
                            referralBusyId === referral.id && styles.mutedButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.smallButtonText}>Начислить 200 ₽</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          disabled={referralBusyId === referral.id}
                          onPress={() => updateReferralStatus(referral.id, 'blocked')}
                          style={({ pressed }) => [
                            styles.smallButton,
                            styles.dangerButton,
                            referralBusyId === referral.id && styles.mutedButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.dangerButtonText}>Отклонить бонус</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.sectionTextMuted}>Реферальных приглашений пока нет.</Text>
              )}
            </View>

            <View style={[styles.sectionCard, activeSection !== 'drivers' && styles.hiddenSection]}>
              <View style={styles.sectionHeader}>
                <ShieldCheck color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Водители</Text>
              </View>
              <View style={styles.adminTabs}>
                {(['rating', 'earnings', 'hours'] as AdminDriverSort[]).map((sort) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: driverSort === sort }}
                    key={sort}
                    onPress={() => setDriverSort(sort)}
                    style={({ pressed }) => [
                      styles.adminTab,
                      driverSort === sort && styles.adminTabActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.adminTabText, driverSort === sort && styles.adminTabTextActive]}>
                      {formatDriverSortTitle(sort)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.statsGridCompact}>
                <PlanRow title="Всего" value={String(drivers.length)} />
                <PlanRow title="Одобрены" value={String(approvedDrivers.length)} />
                <PlanRow title="На линии" value={String(onlineDriversCount)} />
              </View>
              {expiringPolicyUploads.length ? (
                <View style={styles.reviewBox}>
                  <Text style={styles.orderTitle}>Истекающие полисы</Text>
                  {expiringPolicyUploads.map(({ driver, kind, upload }) => (
                    <Text numberOfLines={1} key={`${driver.id}:${kind}`} style={styles.orderText}>
                      {driver.name}: {documentLabels[kind]} до {formatDate(upload?.expiresAt)}
                    </Text>
                  ))}
                </View>
              ) : null}
              {sortedDriverAnalytics.map(({ completedCount, driver, earnings, ordersCount, rating, workHours }) => {
                const uploadedDocumentKinds = (Object.keys(driver.documentUploads ?? {}) as DriverDocumentKind[]);
                const requiredDocumentCount = Object.keys(documentLabels).length;
                const rejectedDocumentKinds = driver.documentReview?.rejectedKinds.length
                  ? driver.documentReview.rejectedKinds
                  : uploadedDocumentKinds;

                return (
                <View key={driver.id} style={styles.orderRow}>
                  <Text numberOfLines={1} style={styles.orderTitle}>
                    {driver.name} · {driver.vehicle || 'авто не указано'}
                  </Text>
                  <Text numberOfLines={1} style={styles.orderText}>
                    {driver.phone || 'телефон не указан'} · {driver.plate || 'номер не указан'} · статус:{' '}
                    {driver.status}
                  </Text>
                  <Text numberOfLines={1} style={styles.orderText}>
                    Допуск к заказам: {driver.canReceiveOrders ? 'открыт' : 'закрыт'}.
                  </Text>
                  <Text numberOfLines={1} style={styles.orderText}>
                    Рейтинг {rating ? rating.toFixed(2) : '-'} · заработок {earnings} ₽ · часы {formatWorkHours(workHours)} · заказы {ordersCount}/{completedCount}
                  </Text>
                  <Text numberOfLines={1} style={styles.orderText}>
                    Тариф: {driver.subscriptionPlan === 'partner_pro' ? 'Партнёр PRO' : 'Дневной доступ'} · статус:{' '}
                    {driver.subscriptionStatus}
                    {driver.subscriptionExpiresAt || driver.accessExpiresAt
                      ? ` до ${formatDate(driver.subscriptionExpiresAt ?? driver.accessExpiresAt)}`
                      : ''}.
                  </Text>
                  <Text numberOfLines={1} style={styles.orderText}>
                    Доступ: {driver.workMode || (driver.subscriptionPlan === 'partner_pro' ? 'partner_pro' : 'daily')}
                    {driver.subscriptionExpiresAt || driver.accessExpiresAt
                      ? ` до ${formatDate(driver.subscriptionExpiresAt ?? driver.accessExpiresAt)}`
                      : ''}
                  </Text>
                  <View style={styles.complianceGrid}>
                    <CompliancePill label="Документы" value={driver.documentsStatus} readyValue="approved" />
                    <CompliancePill label="Договор" value={driver.contractStatus} readyValue="signed" />
                    <CompliancePill label="Разрешение авто" value={driver.vehiclePermitStatus} readyValue="approved" />
                    <CompliancePill label="Реестр" value={driver.registryStatus} readyValue="active" />
                    <CompliancePill label="Налоги" value={driver.taxProfileStatus} readyValue="approved" />
                  </View>
                  <DocumentUploadSummary
                    audit={driver.documentAudit}
                    getAccessNotice={(kind) => documentAccessNotices[`${driver.id}:${kind}`]}
                    onOpenDocument={(kind) => openDriverDocumentFile(driver.id, kind)}
                    uploads={driver.documentUploads}
                  />
                  <View style={styles.reviewBox}>
                    <Text style={styles.documentUploadTitle}>Модерация документов</Text>
                    <Text numberOfLines={2} style={styles.orderText}>
                      Решение: {driver.documentReview?.status ?? driver.documentsStatus}. Причина:{' '}
                      {driver.documentReview?.reason || 'не указана'}.
                    </Text>
                    <TextInput
                      onChangeText={(value) => updateDocumentReviewReason(driver.id, value)}
                      placeholder="Причина отказа или заметка проверки"
                      placeholderTextColor="#81786B"
                      style={styles.reasonInput}
                      value={documentReviewReasons[driver.id] ?? ''}
                    />
                    <View style={styles.rowActions}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={uploadedDocumentKinds.length < requiredDocumentCount}
                        onPress={() => approveDriverDocuments(driver.id)}
                        style={({ pressed }) => [
                          styles.smallButton,
                          uploadedDocumentKinds.length < requiredDocumentCount && styles.mutedButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.smallButtonText}>Одобрить документы</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={!uploadedDocumentKinds.length}
                        onPress={() => rejectDriverDocuments(driver.id, rejectedDocumentKinds)}
                        style={({ pressed }) => [
                          styles.smallButton,
                          styles.dangerButton,
                          !uploadedDocumentKinds.length && styles.mutedButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.dangerButtonText}>Отклонить с причиной</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.rowActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => updateDriverReviewStatus(driver.id, 'approved')}
                      style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.smallButtonText}>Одобрить</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => updateDriverReviewStatus(driver.id, 'blocked')}
                      style={({ pressed }) => [
                        styles.smallButton,
                        styles.dangerButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.dangerButtonText}>Блок</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        updateDriverComplianceStatus(driver.id, {
                          contractStatus: 'signed',
                          documentsStatus: 'approved',
                          registryStatus: 'active',
                          taxProfileStatus: 'approved',
                          vehiclePermitStatus: 'approved',
                        })
                      }
                      style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.smallButtonText}>Открыть допуск</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => updateDriverAccess(driver.id, 'monthly', 'active')}
                      style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.smallButtonText}>Активировать PRO</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => updateDriverAccess(driver.id, 'daily', 'active')}
                      style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.smallButtonText}>Дневной доступ</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => updateDriverAccess(driver.id, 'monthly', 'inactive')}
                      style={({ pressed }) => [
                        styles.smallButton,
                        styles.dangerButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.dangerButtonText}>Отключить PRO</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => rejectDriverDocuments(driver.id, rejectedDocumentKinds)}
                      style={({ pressed }) => [
                        styles.smallButton,
                        styles.dangerButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.dangerButtonText}>Отклонить документы</Text>
                    </Pressable>
                  </View>
                </View>
                );
              })}
              <View style={styles.reviewBox}>
                <Text style={styles.orderTitle}>Общее количество водителей: {drivers.length}</Text>
                <Text style={styles.orderText}>Сортировка не скрывает водителей и не меняет статусы допуска.</Text>
              </View>
            </View>

            <View style={[styles.sectionCard, activeSection !== 'clients' && styles.hiddenSection]}>
              <View style={styles.sectionHeader}>
                <UsersRound color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Клиенты</Text>
              </View>
              <View style={styles.statsGridCompact}>
                <PlanRow title="Всего" value={String(clientAnalytics.length)} />
                <PlanRow title="Поездки" value={String(clientAdminOrders.length)} />
                <PlanRow title="Сумма" value={`${totalClientSpend} ₽`} />
              </View>
              {clientAnalytics.length ? (
                clientAnalyticsPreview.map((client) => (
                  <View key={client.key} style={styles.orderRow}>
                    <Text numberOfLines={1} style={styles.orderTitle}>{client.name}</Text>
                    <Text numberOfLines={1} style={styles.orderText}>
                      Поездок: {client.ordersCount} · завершено: {client.completedCount} · сумма: {client.totalSpent} ₽
                    </Text>
                    <Text numberOfLines={1} style={styles.orderText}>
                      Последняя активность: {formatDate(client.lastOrderAt)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.sectionTextMuted}>Клиенты появятся после первых заказов.</Text>
              )}
              <View style={styles.reviewBox}>
                <Text style={styles.orderTitle}>Общее количество клиентов: {clientAnalytics.length}</Text>
                <Text style={styles.orderText}>Список считается по заказам и не отключает клиентскую логику.</Text>
              </View>
            </View>

            <View style={[styles.sectionCard, activeSection !== 'settings' && styles.hiddenSection]}>
              <View style={styles.sectionHeader}>
                <MapPinned color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Адресный слой</Text>
              </View>
              <Text numberOfLines={2} style={styles.sectionText}>
                Подсказок адресов и POI: {salavatAddressSuggestionCount}. Улиц/дорог:{' '}
                {salavatDistrictStreetSourceSummary.streets}. Домов:{' '}
                {salavatDistrictHouseSourceSummary.houses}.
              </Text>
              <Text numberOfLines={2} style={styles.sectionTextMuted}>{salavatDistrictHouseSourceSummary.note}</Text>
              <Text numberOfLines={2} style={styles.sectionTextMuted}>
                Ручные изменения сохраняются на backend и сразу участвуют в `/geo/address-search`.
              </Text>
              <View style={styles.inlineForm}>
                <TextInput
                  onChangeText={(value) => updateAddressForm('title', value)}
                  placeholder="Название"
                  placeholderTextColor="#557669"
                  style={[styles.input, styles.inlineInput]}
                  value={addressForm.title}
                />
                <TextInput
                  onChangeText={(value) => updateAddressForm('category', value)}
                  placeholder="тип: street/house/poi"
                  placeholderTextColor="#557669"
                  style={[styles.input, styles.inlineInput]}
                  value={addressForm.category}
                />
              </View>
              <TextInput
                onChangeText={(value) => updateAddressForm('subtitle', value)}
                placeholder="Описание или адрес"
                placeholderTextColor="#557669"
                style={styles.input}
                value={addressForm.subtitle}
              />
              <View style={styles.inlineForm}>
                <TextInput
                  onChangeText={(value) => updateAddressForm('settlement', value)}
                  placeholder="населенный пункт"
                  placeholderTextColor="#557669"
                  style={[styles.input, styles.inlineInput]}
                  value={addressForm.settlement}
                />
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={(value) => updateAddressForm('latitude', value)}
                  placeholder="широта"
                  placeholderTextColor="#557669"
                  style={[styles.input, styles.inlineInput]}
                  value={addressForm.latitude}
                />
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={(value) => updateAddressForm('longitude', value)}
                  placeholder="долгота"
                  placeholderTextColor="#557669"
                  style={[styles.input, styles.inlineInput]}
                  value={addressForm.longitude}
                />
              </View>
              <View style={styles.rowActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={saveAddress}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>
                    {editingAddressId ? 'Сохранить адрес' : 'Добавить адрес'}
                  </Text>
                </Pressable>
                {editingAddressId ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={resetAddressForm}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.secondaryButtonText}>Отмена</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void loadAdminAddresses();
                  }}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>Обновить</Text>
                </Pressable>
              </View>
              {addressNotice ? <Text numberOfLines={2} style={styles.sectionTextMuted}>{addressNotice}</Text> : null}
              {adminAddressesPreview.map((address) => (
                <View key={address.id} style={styles.orderRow}>
                  <Text numberOfLines={1} style={styles.orderTitle}>
                    {address.title} · {address.category}
                  </Text>
                  <Text numberOfLines={1} style={styles.orderText}>{address.displayAddress || address.subtitle}</Text>
                  <View style={styles.rowActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => editAddress(address)}
                      style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.smallButtonText}>Редактировать</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        void removeAddress(address.id);
                      }}
                      style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.dangerButtonText}>Удалить</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.sectionCard, activeSection !== 'users' && styles.hiddenSection]}>
              <View style={styles.sectionHeader}>
                <UsersRound color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Пользователи</Text>
              </View>
              <Text style={styles.sectionText}>
                Клиентская, водительская, таксопарковая и админская логика остаются раздельными по ролям.
              </Text>
              <View style={styles.statsGridCompact}>
                <PlanRow title="Водители" value={String(drivers.length)} />
                <PlanRow title="Допущены" value={String(approvedDrivers.length)} />
                <PlanRow title="Обращения" value={String(supportThreads.length)} />
              </View>
              {adminDriversPreview.map((driver) => (
                <View key={driver.id} style={styles.orderRow}>
                  <Text numberOfLines={1} style={styles.orderTitle}>{driver.name}</Text>
                  <Text numberOfLines={1} style={styles.orderText}>
                    {driver.phone || 'телефон не указан'} · {driver.status} · доступ:{' '}
                    {driver.canReceiveOrders ? 'открыт' : 'закрыт'}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.sectionCard, activeSection !== 'fleets' && styles.hiddenSection]}>
              <View style={styles.sectionHeader}>
                <BriefcaseBusiness color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Таксопарки</Text>
              </View>
              <Text style={styles.sectionText}>
                Роль таксопарка сохранена: парк управляет водителями, автомобилями, заказами и расчетами отдельно от водителя.
              </Text>
              <View style={styles.statsGridCompact}>
                <PlanRow title="Модель" value="B2B-доступ" />
                <PlanRow title="Водители парка" value="через приглашение" />
                <PlanRow title="Расчеты" value="ручная сверка" />
              </View>
              <View style={styles.reviewBox}>
                <Text style={styles.orderTitle}>Что контролирует парк</Text>
                <Text style={styles.orderText}>Подключение водителей, автомобили, статусы допуска и дневные расчеты.</Text>
              </View>
            </View>

            <View style={[styles.sectionCard, activeSection !== 'system' && styles.hiddenSection]}>
              <View style={styles.sectionHeader}>
                <ShieldCheck color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Системные действия</Text>
              </View>
              <Text style={styles.sectionText}>
                Backend, realtime, адресный слой, PRO-платежи и реферальная панель обновляются вручную из админки.
              </Text>
              <View style={styles.rowActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={refreshServerData}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>Обновить backend</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void refreshServiceShareSummary(serviceShareDate);
                  }}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>Обновить расчеты</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void loadAdminDriverPayments();
                  }}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>Обновить PRO</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void loadAdminAddresses();
                  }}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>Обновить адреса</Text>
                </Pressable>
              </View>
              <Text numberOfLines={2} style={styles.sectionTextMuted}>
                Статус: {serverStatus === 'connected' ? 'backend подключен' : 'локальный режим'} · realtime:{' '}
                {formatRealtimeStatus(realtimeStatus)}.
              </Text>
            </View>

            <View style={[styles.sectionCard, activeSection !== 'support' && styles.hiddenSection]}>
              <View style={styles.sectionHeader}>
                <Headphones color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Поддержка</Text>
              </View>
              <Text style={styles.sectionText}>
                Обращения пользователей не удалены из админки, но вынесены из основных вкладок.
              </Text>
              {supportThreads.length ? (
                supportThreadsPreview.map((thread) => (
                  <View key={thread.id} style={styles.orderRow}>
                    <Text numberOfLines={1} style={styles.orderTitle}>{thread.title}</Text>
                    <Text numberOfLines={1} style={styles.orderText}>
                      {thread.role} · {thread.category} · {thread.status} · {formatDate(thread.updatedAt)}
                    </Text>
                    <Text numberOfLines={2} style={styles.orderText}>
                      {thread.messages[thread.messages.length - 1]?.text || 'Сообщений пока нет.'}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.sectionTextMuted}>Открытых обращений пока нет.</Text>
              )}
            </View>

            <View style={[styles.sectionCard, activeSection !== 'orders' && styles.hiddenSection]}>
              <View style={styles.sectionHeader}>
                <ReceiptText color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Поездки</Text>
              </View>
              <View style={styles.statsGridCompact}>
                <PlanRow title="Количество" value={String(orders.length)} />
                <PlanRow title="Доставка" value={String(deliveryAdminOrders.length)} />
                <PlanRow title="Активные" value={String(activeAdminOrders.length)} />
                <PlanRow title="Завершенные" value={String(completedAdminOrders.length)} />
                <PlanRow
                  title="Самая долгая"
                  value={longestAdminOrder ? formatDistanceKm(longestAdminOrder.routeEstimate?.distanceKm ?? 0) : '0 км'}
                />
              </View>
              {longestAdminOrder ? (
                <View style={styles.reviewBox}>
                  <Text style={styles.orderTitle}>Самый долгий заказ: {formatAdminOrderService(longestAdminOrder)}</Text>
                  <Text numberOfLines={1} style={styles.orderText}>
                    {longestAdminOrder.pickup} → {longestAdminOrder.destination}
                  </Text>
                  <Text style={styles.orderText}>
                    {formatDistanceKm(longestAdminOrder.routeEstimate?.distanceKm ?? 0)} · {longestAdminOrder.total} ₽
                  </Text>
                </View>
              ) : null}
              {orders.length > 0 ? (
                adminOrdersPreview.map((order) => (
                  <View key={order.id} style={styles.orderRow}>
                    <Text numberOfLines={1} style={styles.orderTitle}>
                      {order.id} · {formatAdminOrderService(order)} · {order.total} ₽ · {order.status}
                    </Text>
                    <Text numberOfLines={1} style={styles.orderText}>
                      {order.pickup} → {order.destination}
                    </Text>
                    {order.serviceType === 'delivery' ? (
                      <Text numberOfLines={1} style={styles.orderText}>
                        {formatDeliveryAdminMeta(order)}
                      </Text>
                    ) : null}
                    <Text numberOfLines={1} style={styles.orderText}>
                      Водитель: {order.driver ? `${order.driver.name}, ${order.driver.vehicle}` : 'не назначен'}
                    </Text>
                    {(order.serviceShareAmount ?? order.driverCommission ?? 0) > 0 ? (
                      <Text style={styles.orderText}>
                        Доля сервиса: {order.serviceShareAmount ?? order.driverCommission ?? 0} ₽ ·{' '}
                        {formatServiceShareStatus(order.serviceShareStatus)}
                      </Text>
                    ) : null}
                    {order.serviceShareStatus === 'reported_transferred' ? (
                      <View style={styles.rowActions}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            updateOrderServiceShareStatus(
                              order.id,
                              'confirmed',
                              'Admin confirmed service share receipt',
                            )
                          }
                          style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.smallButtonText}>Подтвердить перевод</Text>
                        </Pressable>
                      </View>
                    ) : null}
                    {!order.driver && approvedDrivers.length > 0 ? (
                      <View style={styles.rowActions}>
                        {approvedDriverAssignPreview.map((driver) => (
                          <Pressable
                            accessibilityRole="button"
                            key={driver.id}
                            onPress={() => assignOrderToDriver(order.id, driver.id)}
                            style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                          >
                            <Text style={styles.smallButtonText}>Назначить {driver.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.sectionTextMuted}>Заказов в текущей сессии пока нет.</Text>
              )}
              <View style={styles.reviewBox}>
                <Text style={styles.orderTitle}>Всего поездок: {orders.length}</Text>
                <Text style={styles.orderText}>Отмененные поездки: {cancelledAdminOrders.length}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
      {unlocked ? (
        <View style={styles.adminBottomTabs}>
          {adminPrimarySections.map((section) => (
            <AdminBottomTab
              active={section.id === activeSection}
              item={section}
              key={section.id}
              onPress={() => setActiveSection(section.id)}
            />
          ))}
        </View>
      ) : null}
      <AdminSideDrawer
        activeSection={activeSection}
        items={adminDrawerSections}
        onClose={() => setDrawerOpen(false)}
        onItemPress={(section) => {
          setActiveSection(section.id);
          setDrawerOpen(false);
        }}
        onLogout={() => {
          setDrawerOpen(false);
          setUnlocked(false);
          setPassword('');
        }}
        open={drawerOpen}
      />
      </View>
    </SafeAreaView>
  );
}

type PlanRowProps = {
  title: string;
  value: string;
};

type AdminBottomTabProps = {
  active: boolean;
  item: AdminNavItem;
  onPress: () => void;
};

type AdminWorkbenchProps = {
  activeOrdersCount: number;
  clientsCount: number;
  driversCount: number;
  onSelect: (section: AdminSectionId) => void;
  pendingProCount: number;
  pendingReferralCount: number;
  selectedSection: AdminSectionId;
  settlementsAmount: number;
};

function AdminWorkbench({
  activeOrdersCount,
  clientsCount,
  driversCount,
  onSelect,
  pendingProCount,
  pendingReferralCount,
  selectedSection,
  settlementsAmount,
}: AdminWorkbenchProps) {
  const tiles: Array<{
    helper: string;
    icon: typeof ShieldCheck;
    id: AdminSectionId;
    title: string;
    tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning';
    value: string;
  }> = [
    {
      helper: 'общая картина',
      icon: ShieldCheck,
      id: 'stats',
      title: 'Статистика',
      tone: activeOrdersCount > 0 ? 'success' : 'neutral',
      value: `${activeOrdersCount} активных`,
    },
    {
      helper: 'рейтинг, выручка, часы',
      icon: UsersRound,
      id: 'drivers',
      title: 'Водители',
      tone: driversCount > 0 ? 'info' : 'neutral',
      value: `${driversCount} всего`,
    },
    {
      helper: 'активность и траты',
      icon: BriefcaseBusiness,
      id: 'clients',
      title: 'Клиенты',
      tone: clientsCount > 0 ? 'success' : 'neutral',
      value: `${clientsCount} всего`,
    },
    {
      helper: 'долги и оплаты',
      icon: Wallet,
      id: 'settlements',
      title: 'Расчеты',
      tone: settlementsAmount > 0 ? 'warning' : 'success',
      value: `${settlementsAmount} ₽`,
    },
    {
      helper: 'подключение тарифа',
      icon: ReceiptText,
      id: 'pro',
      title: 'PRO-заявки',
      tone: pendingProCount > 0 ? 'warning' : 'neutral',
      value: `${pendingProCount} новых`,
    },
    {
      helper: 'бонусы к проверке',
      icon: Gift,
      id: 'referrals',
      title: 'Рефералы',
      tone: pendingReferralCount > 0 ? 'warning' : 'neutral',
      value: `${pendingReferralCount} ждут`,
    },
  ];

  return (
    <KinetixCard tone="accent" style={styles.adminWorkbench}>
      <View style={styles.adminWorkbenchHeader}>
        <View style={styles.adminWorkbenchCopy}>
          <Text style={styles.adminWorkbenchTitle}>Рабочая панель</Text>
          <Text numberOfLines={2} style={styles.adminWorkbenchText}>
            Быстрый вход в разделы, где чаще всего нужны решения.
          </Text>
        </View>
        <KinetixStatus
          label={settlementsAmount > 0 || pendingProCount > 0 || pendingReferralCount > 0 ? 'Есть задачи' : 'Спокойно'}
          tone={settlementsAmount > 0 || pendingProCount > 0 || pendingReferralCount > 0 ? 'warning' : 'success'}
        />
      </View>
      <View style={styles.adminWorkbenchGrid}>
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const selected = selectedSection === tile.id;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={tile.id}
              onPress={() => onSelect(tile.id)}
              style={({ pressed }) => [
                styles.adminWorkbenchTile,
                selected && styles.adminWorkbenchTileActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.adminWorkbenchTileTop}>
                <View style={[styles.adminWorkbenchIcon, selected && styles.adminWorkbenchIconActive]}>
                  <Icon color={selected ? '#F4FAF6' : '#008D49'} size={19} strokeWidth={2.4} />
                </View>
                <KinetixStatus label={tile.value} tone={tile.tone} />
              </View>
              <Text numberOfLines={1} style={styles.adminWorkbenchTileTitle}>{tile.title}</Text>
              <Text numberOfLines={1} style={styles.adminWorkbenchTileText}>{tile.helper}</Text>
            </Pressable>
          );
        })}
      </View>
    </KinetixCard>
  );
}

function AdminBottomTab({ active, item, onPress }: AdminBottomTabProps) {
  const Icon = item.icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.adminBottomTab, active && styles.adminBottomTabActive, pressed && styles.pressed]}
    >
      <View style={[styles.adminBottomIndicator, active && styles.adminBottomIndicatorActive]} />
      <View style={[styles.adminBottomIcon, active && styles.adminBottomIconActive]}>
        <Icon color={active ? '#F4FAF6' : '#008D49'} size={19} strokeWidth={2.4} />
      </View>
      <Text numberOfLines={1} style={[styles.adminBottomText, active && styles.adminBottomTextActive]}>
        {item.title}
      </Text>
    </Pressable>
  );
}

type AdminSideDrawerProps = {
  activeSection: AdminSectionId;
  items: AdminNavItem[];
  onClose: () => void;
  onItemPress: (item: AdminNavItem) => void;
  onLogout: () => void;
  open: boolean;
};

function AdminSideDrawer({
  activeSection,
  items,
  onClose,
  onItemPress,
  onLogout,
  open,
}: AdminSideDrawerProps) {
  const reducedMotion = useReducedMotionPreference();
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reducedMotion ? 0 : 285,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, progress, reducedMotion]);

  const panelAnimatedStyle = {
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-360, 0],
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.72, 1],
    }),
  };
  const scrimAnimatedStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
  };

  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.drawerRoot}>
        <Animated.View style={[styles.drawerPanel, panelAnimatedStyle]}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerTitleCopy}>
              <Text style={styles.drawerTitle}>Админ-панель</Text>
              <Text style={styles.drawerSubtitle}>Дополнительные разделы</Text>
            </View>
            <Pressable
              accessibilityLabel="Закрыть меню"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.drawerClose, pressed && styles.pressed]}
            >
              <X color="#008D49" size={22} strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.drawerList} showsVerticalScrollIndicator={false}>
            {items.map((item) => (
              <AdminDrawerItem
                active={item.id === activeSection}
                item={item}
                key={item.id}
                onPress={() => onItemPress(item)}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={onLogout}
              style={({ pressed }) => [styles.drawerItem, pressed && styles.pressed]}
            >
              <View style={styles.drawerIconWrap}>
                <ArrowLeft color="#008D49" size={19} strokeWidth={2.4} />
              </View>
              <View style={styles.drawerItemCopy}>
                <Text style={styles.drawerItemTitle}>Сменить роль / выйти</Text>
                <Text style={styles.drawerItemSubtitle}>Закрыть админ-сессию и вернуться к входу.</Text>
              </View>
            </Pressable>
          </ScrollView>
        </Animated.View>
        <Animated.View style={[styles.drawerScrim, scrimAnimatedStyle]}>
          <Pressable accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFillObject} />
        </Animated.View>
      </View>
    </Modal>
  );
}

type AdminDrawerItemProps = {
  active: boolean;
  item: AdminNavItem;
  onPress: () => void;
};

function AdminDrawerItem({ active, item, onPress }: AdminDrawerItemProps) {
  const Icon = item.icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.drawerItem, active && styles.drawerItemActive, pressed && styles.pressed]}
    >
      <View style={[styles.drawerIconWrap, active && styles.drawerIconWrapActive]}>
        <Icon color={active ? '#F4FAF6' : '#008D49'} size={19} strokeWidth={2.4} />
      </View>
      <View style={styles.drawerItemCopy}>
        <Text numberOfLines={1} style={[styles.drawerItemTitle, active && styles.drawerItemTitleActive]}>
          {item.title}
        </Text>
        <Text numberOfLines={2} style={styles.drawerItemSubtitle}>{item.subtitle}</Text>
      </View>
    </Pressable>
  );
}

function getAdminSectionTitle(sectionId: AdminSectionId) {
  return (
    adminPrimarySections.find((section) => section.id === sectionId)?.title ??
    adminDrawerSections.find((section) => section.id === sectionId)?.title ??
    'Раздел'
  );
}

const documentLabels: Record<DriverDocumentKind, string> = {
  driverLicense: 'ВУ',
  osago: 'ОСАГО',
  osgop: 'ОСГОП',
  passport: 'Паспорт',
  sts: 'СТС',
};

function formatFileSize(size: number) {
  if (size >= 1_000_000) {
    return `${(size / 1_000_000).toFixed(1)} МБ`;
  }

  if (size >= 1_000) {
    return `${Math.ceil(size / 1_000)} КБ`;
  }

  return `${size} Б`;
}

function isExpiringPolicy(upload?: DriverDocumentUpload) {
  if (!upload?.expiresAt || upload.status !== 'approved') {
    return false;
  }

  const expiresAt = Date.parse(upload.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    return false;
  }

  const daysLeft = (expiresAt - Date.now()) / 86_400_000;
  return daysLeft >= 0 && daysLeft <= 14;
}

function formatDate(value?: string) {
  if (!value) {
    return 'дата не указана';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('ru-RU');
}

function formatDriverSortTitle(sort: AdminDriverSort) {
  const labels: Record<AdminDriverSort, string> = {
    earnings: 'По заработку',
    hours: 'По часам',
    rating: 'По рейтингу',
  };

  return labels[sort];
}

function isCompletedOrder(order: AppOrder) {
  return ['closed', 'completed'].includes(order.status);
}

function getOrderWorkHours(order: AppOrder) {
  const endAt = Date.parse(order.completedAt || '');
  const startAt = Date.parse(order.startedAt || order.acceptedAt || order.createdAt || '');

  if (Number.isFinite(startAt) && Number.isFinite(endAt) && endAt > startAt) {
    return (endAt - startAt) / 3_600_000;
  }

  if (isCompletedOrder(order)) {
    return Math.max(0.25, (order.routeEstimate?.durationMin ?? 30) / 60);
  }

  return 0;
}

function formatWorkHours(hours: number) {
  if (hours <= 0) {
    return '0 ч';
  }

  return `${hours.toLocaleString('ru-RU', {
    maximumFractionDigits: hours < 10 ? 1 : 0,
    minimumFractionDigits: hours < 10 ? 1 : 0,
  })} ч`;
}

function formatDistanceKm(distanceKm: number) {
  if (!distanceKm) {
    return '0 км';
  }

  return `${distanceKm.toLocaleString('ru-RU', {
    maximumFractionDigits: distanceKm < 10 ? 1 : 0,
    minimumFractionDigits: distanceKm % 1 === 0 ? 0 : 1,
  })} км`;
}

function formatAdminOrderService(order: AppOrder) {
  return order.serviceType === 'delivery' ? 'Доставка' : 'Такси';
}

function formatDeliveryAdminMeta(order: AppOrder) {
  return [
    formatDeliveryPackageType(order.deliveryPackageType),
    order.packageDescription,
    formatDeliveryHandoff(order.deliveryHandoff),
    order.recipientName || order.recipientPhone,
  ]
    .filter(Boolean)
    .join(' · ');
}

function formatDeliveryPackageType(value?: string) {
  if (value === 'documents') {
    return 'Документы';
  }

  if (value === 'food') {
    return 'Еда / цветы';
  }

  if (value === 'fragile') {
    return 'Хрупкое';
  }

  if (value === 'parcel') {
    return 'Пакет';
  }

  if (value === 'other') {
    return 'Другое';
  }

  return 'Посылка';
}

function formatDeliveryHandoff(value?: string) {
  if (value === 'leave_at_door') {
    return 'оставить у двери';
  }

  if (value === 'meet_outside') {
    return 'встретят у входа';
  }

  return 'от двери до двери';
}

function buildClientAnalytics(orders: AppOrder[]): AdminClientAnalytics[] {
  const clients = new Map<string, AdminClientAnalytics>();

  orders
    .filter((order) => order.role === 'client')
    .forEach((order) => {
      const key = order.userId || order.clientPhone || order.clientName || order.id;
      const current = clients.get(key) ?? {
        completedCount: 0,
        key,
        lastOrderAt: order.createdAt,
        name: order.clientName || order.clientPhone || 'Клиент без имени',
        ordersCount: 0,
        totalSpent: 0,
      };

      current.ordersCount += 1;
      current.completedCount += isCompletedOrder(order) ? 1 : 0;
      current.totalSpent += order.total ?? 0;
      current.lastOrderAt =
        Date.parse(order.createdAt || '') > Date.parse(current.lastOrderAt || '')
          ? order.createdAt
          : current.lastOrderAt;

      clients.set(key, current);
    });

  return Array.from(clients.values()).sort((left, right) => {
    if (right.ordersCount !== left.ordersCount) {
      return right.ordersCount - left.ordersCount;
    }

    return right.totalSpent - left.totalSpent;
  });
}

function formatRealtimeStatus(status: 'connecting' | 'live' | 'offline' | 'polling') {
  if (status === 'live') {
    return 'события приходят сразу';
  }

  if (status === 'polling') {
    return 'fallback-обновление';
  }

  if (status === 'offline') {
    return 'недоступен';
  }

  return 'подключается';
}

function isPartnerProActive(driver: {
  accessExpiresAt?: string;
  billingMode?: string;
  subscriptionExpiresAt?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
}) {
  const expiresAt = Date.parse(driver.subscriptionExpiresAt || driver.accessExpiresAt || '');

  return (
    driver.billingMode === 'monthly' &&
    driver.subscriptionPlan === 'partner_pro' &&
    driver.subscriptionStatus === 'active' &&
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now()
  );
}

function buildLocalServiceShareSummary(orders: AppOrder[], targetDate = new Date().toISOString().slice(0, 10)) {
  const completedOrders = orders.filter((order) => {
    const batchDate = order.serviceShareBatchDate ?? order.completedAt?.slice(0, 10);

    return (
      ['closed', 'completed'].includes(order.status) &&
      batchDate === targetDate
    );
  });
  const byDriver = new Map<
    string,
    {
      confirmedAmount: number;
      billingMode?: AppOrder['driverBillingMode'];
      currentCommissionPercent?: number;
      driverId: string;
      driverName: string;
      ordersCount: number;
      pendingTransferAmount: number;
      reportedTransferAmount: number;
      settlementStatus?: AppOrder['serviceShareStatus'];
      subscriptionExpiresAt?: string;
      subscriptionPlan?: string;
      totalCollectedAmount: number;
      totalDriverNetAmount?: number;
      totalServiceShareAmount: number;
    }
  >();
  const summary = {
    confirmedAmount: 0,
    ordersCount: completedOrders.length,
    pendingTransferAmount: 0,
    reportedTransferAmount: 0,
    totalCollectedAmount: 0,
    totalServiceShareAmount: 0,
  };

  completedOrders.forEach((order) => {
    const driverId = order.driver?.id ?? 'unassigned-driver';
    const driverName = order.driver?.name ?? 'Водитель не назначен';
    const collectedAmount = order.driverCollectedAmount ?? order.total;
    const serviceShareAmount = order.serviceShareAmount ?? order.driverCommission ?? 0;
    const status = order.serviceShareStatus ?? 'pending_transfer';

    if (!byDriver.has(driverId)) {
      byDriver.set(driverId, {
        confirmedAmount: 0,
        billingMode: order.driverBillingMode ?? order.driver?.billingMode,
        currentCommissionPercent: order.serviceShareRate ?? order.driverCommissionRate ?? 0,
        driverId,
        driverName,
        ordersCount: 0,
        pendingTransferAmount: 0,
        reportedTransferAmount: 0,
        settlementStatus: 'not_applicable',
        subscriptionExpiresAt: order.driver?.subscriptionExpiresAt,
        subscriptionPlan: order.driver?.subscriptionPlan,
        totalCollectedAmount: 0,
        totalDriverNetAmount: 0,
        totalServiceShareAmount: 0,
      });
    }

    const driverSummary = byDriver.get(driverId);

    if (!driverSummary) {
      return;
    }

    driverSummary.ordersCount += 1;
    driverSummary.billingMode = order.driverBillingMode ?? order.driver?.billingMode;
    driverSummary.currentCommissionPercent = order.serviceShareRate ?? order.driverCommissionRate ?? 0;
    driverSummary.subscriptionExpiresAt = order.driver?.subscriptionExpiresAt;
    driverSummary.subscriptionPlan = order.driver?.subscriptionPlan;
    driverSummary.totalCollectedAmount += collectedAmount;
    driverSummary.totalDriverNetAmount =
      (driverSummary.totalDriverNetAmount ?? 0) + (order.driverNetAmount ?? Math.max(0, collectedAmount - serviceShareAmount));
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
  });

  byDriver.forEach((driverSummary) => {
    if (driverSummary.totalServiceShareAmount <= 0) {
      driverSummary.settlementStatus = 'not_applicable';
    } else if (driverSummary.confirmedAmount >= driverSummary.totalServiceShareAmount) {
      driverSummary.settlementStatus = 'confirmed';
    } else if (driverSummary.reportedTransferAmount > 0) {
      driverSummary.settlementStatus = 'reported_transferred';
    } else {
      driverSummary.settlementStatus = 'pending_transfer';
    }
  });

  return {
    date: targetDate,
    drivers: Array.from(byDriver.values()).sort((left, right) =>
      right.totalServiceShareAmount - left.totalServiceShareAmount,
    ),
    orders: completedOrders.map((order) => ({
      commissionPercent: order.serviceShareRate ?? order.driverCommissionRate ?? 0,
      dailyOrderNumber: order.driverDailyOrderNumber ?? 0,
      driverId: order.driver?.id,
      driverName: order.driver?.name,
      id: order.id,
      serviceShareAmount: order.serviceShareAmount ?? order.driverCommission ?? 0,
      status: order.serviceShareStatus ?? 'pending_transfer',
      total: order.total,
    })),
    summary,
  };
}

function formatServiceShareStatus(status: AppOrder['serviceShareStatus']) {
  const labels: Record<NonNullable<AppOrder['serviceShareStatus']>, string> = {
    confirmed: 'перевод подтвержден',
    not_applicable: 'доля не начислена',
    pending_transfer: 'ожидает перевод',
    reported_transferred: 'водитель отметил перевод',
  };

  return labels[status ?? 'not_applicable'];
}

function PlanRow({ title, value }: PlanRowProps) {
  return (
    <View style={styles.planRow}>
      <Text style={styles.planTitle}>{title}</Text>
      <Text style={styles.planValue}>{value}</Text>
    </View>
  );
}

function DocumentUploadSummary({
  audit,
  getAccessNotice,
  onOpenDocument,
  uploads,
}: {
  audit?: DriverDocumentAuditEntry[];
  getAccessNotice?: (kind: DriverDocumentKind) => string | undefined;
  onOpenDocument?: (kind: DriverDocumentKind) => void;
  uploads?: Partial<Record<DriverDocumentKind, DriverDocumentUpload>>;
}) {
  const uploadedItems = useMemo(
    () =>
      (Object.keys(documentLabels) as DriverDocumentKind[])
        .map((kind) => uploads?.[kind])
        .filter(Boolean) as DriverDocumentUpload[],
    [uploads],
  );
  const auditPreview = useMemo(() => audit?.slice(0, 3) ?? [], [audit]);

  if (!uploadedItems.length) {
    return <Text style={styles.orderText}>Фото документов еще не загружены водителем.</Text>;
  }

  return (
    <View style={styles.documentUploadBox}>
      <Text style={styles.documentUploadTitle}>
        Загружено файлов: {uploadedItems.length}/{Object.keys(documentLabels).length}
      </Text>
      {uploadedItems.map((item) => (
        <View key={item.kind} style={styles.documentUploadItem}>
          <Text numberOfLines={1} style={styles.documentUploadText}>
            {documentLabels[item.kind]} · {item.fileName} · {item.status}
          </Text>
          {onOpenDocument ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenDocument(item.kind)}
              style={({ pressed }) => [styles.documentAccessButton, pressed && styles.pressed]}
            >
              <Eye color="#008D49" size={14} strokeWidth={2.4} />
              <Text style={styles.documentAccessButtonText}>Открыть</Text>
            </Pressable>
          ) : null}
          {getAccessNotice?.(item.kind) ? (
            <Text numberOfLines={2} style={styles.documentMetaText}>{getAccessNotice(item.kind)}</Text>
          ) : null}
          {item.rejectionReason ? (
            <Text numberOfLines={2} style={styles.documentRejectText}>{item.rejectionReason}</Text>
          ) : null}
          {item.checksum ? (
            <Text style={styles.documentMetaText}>sha256: {item.checksum.slice(0, 12)}...</Text>
          ) : null}
        </View>
      ))}
      {auditPreview.length ? (
        <View style={styles.auditBox}>
          <Text style={styles.documentUploadTitle}>Журнал проверки</Text>
          {auditPreview.map((entry) => (
            <Text numberOfLines={1} key={entry.id} style={styles.documentMetaText}>
              {entry.action} · {entry.actor.name || entry.actor.role} · {entry.reason || entry.note || entry.status}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CompliancePill({
  label,
  readyValue,
  value,
}: {
  label: string;
  readyValue: string;
  value?: string;
}) {
  const isReady = value === readyValue;

  return (
    <View style={[styles.compliancePill, isReady && styles.compliancePillReady]}>
      <Text style={[styles.complianceLabel, isReady && styles.complianceLabelReady]}>{label}</Text>
      <Text style={[styles.complianceValue, isReady && styles.complianceValueReady]}>
        {isReady ? 'ок' : value || 'pending'}
      </Text>
    </View>
  );
}
