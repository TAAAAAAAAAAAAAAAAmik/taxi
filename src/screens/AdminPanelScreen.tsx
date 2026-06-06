import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Eye, Gift, LockKeyhole, ShieldCheck, MapPinned, ReceiptText, Wallet } from 'lucide-react-native';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  salavatAddressSuggestions,
  salavatDistrictSettlements,
  salavatDistrictStreetSourceSummary,
} from '../data/salavatDistrict';
import { salavatDistrictHouseSourceSummary, salavatDistrictHouses } from '../data/salavatDistrictHouses';
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
import { isDemoModeEnabled } from '../utils/runtimeFlags';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminPanel'>;

const demoAdminPassword = 'admin-demo-5000';

type AdminSectionId = 'overview' | 'orders' | 'drivers' | 'settlements' | 'pro' | 'referrals' | 'settings';

const adminSections: Array<{ id: AdminSectionId; title: string }> = [
  { id: 'overview', title: 'Обзор' },
  { id: 'orders', title: 'Заказы' },
  { id: 'drivers', title: 'Водители' },
  { id: 'settlements', title: 'Расчеты' },
  { id: 'pro', title: 'PRO-заявки' },
  { id: 'referrals', title: 'Рефералы' },
  { id: 'settings', title: 'Настройки' },
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
  const [activeSection, setActiveSection] = useState<AdminSectionId>('overview');
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
  const approvedDrivers = drivers.filter((driver) => driver.canReceiveOrders);
  const expiringPolicyUploads = drivers.flatMap((driver) =>
    (['osago', 'osgop'] as DriverDocumentKind[])
      .map((kind) => ({ driver, kind, upload: driver.documentUploads?.[kind] }))
      .filter(({ upload }) => isExpiringPolicy(upload)),
  );
  const showDemoAdmin = isDemoModeEnabled();
  const activePartnerProDrivers = drivers.filter((driver) => isPartnerProActive(driver));
  const pendingPartnerProPayments = adminDriverPayments.filter(
    (payment) => payment.billingMode === 'monthly' && payment.status === 'pending',
  );
  const activeAdminOrders = orders.filter((order) => !['completed', 'cancelled', 'canceled'].includes(order.status));
  const completedAdminOrders = orders.filter((order) => order.status === 'completed');
  const cancelledAdminOrders = orders.filter((order) => ['cancelled', 'canceled'].includes(order.status));
  const dailyServiceShare = useMemo(
    () => serviceShareSummary ?? buildLocalServiceShareSummary(orders, serviceShareDate),
    [orders, serviceShareDate, serviceShareSummary],
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
        label: 'Водители',
        value: String(drivers.length),
        helper: `${approvedDrivers.length} одобрено для заказов`,
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
      drivers.length,
      orders.length,
      serverStatus,
      supportThreads.length,
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
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
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
                Быстрый контроль MVP: заказы, поддержка, адресный слой и модель оплаты водителей.
              </Text>
            </View>

            <View style={styles.adminTabs}>
              {adminSections.map((section) => {
                const active = section.id === activeSection;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    key={section.id}
                    onPress={() => setActiveSection(section.id)}
                    style={({ pressed }) => [
                      styles.adminTab,
                      active && styles.adminTabActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.adminTabText, active && styles.adminTabTextActive]}>
                      {section.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.sectionCard, activeSection !== 'overview' && styles.hiddenSection]}>
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

            <View style={[styles.statsGrid, activeSection !== 'overview' && styles.hiddenSection]}>
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
              <PlanRow title={driverAccessPlans.commission.name} value={driverAccessPlans.commission.headline} />
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
                  {pendingPartnerProPayments.slice(0, 8).map((payment) => (
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
                dailyServiceShare.drivers.slice(0, 6).map((driver) => (
                  <View key={driver.driverId} style={styles.orderRow}>
                    <Text style={styles.orderTitle}>
                      {driver.driverName} · {driver.ordersCount} заказов
                    </Text>
                    <Text style={styles.orderText}>
                      Оборот {driver.totalCollectedAmount} ₽ · комиссия {driver.totalServiceShareAmount} ₽ ·{' '}
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
                pendingPartnerProPayments.slice(0, 12).map((payment) => (
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
                adminReferralDashboard.referrals.slice(0, 8).map((referral) => (
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
              {drivers.map((driver) => {
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
                    Тариф: {driver.subscriptionPlan === 'partner_pro' ? 'Партнёр PRO' : 'Комиссия 7% / 5% / 3%'} · статус:{' '}
                    {driver.subscriptionStatus}
                    {driver.subscriptionExpiresAt || driver.accessExpiresAt
                      ? ` до ${formatDate(driver.subscriptionExpiresAt ?? driver.accessExpiresAt)}`
                      : ''}.
                  </Text>
                  <Text numberOfLines={1} style={styles.orderText}>
                    Тест: {driver.commissionTrialStartedAt ? formatDate(driver.commissionTrialStartedAt) : 'не начат'} →{' '}
                    {driver.commissionTrialEndsAt ? formatDate(driver.commissionTrialEndsAt) : 'нет даты'} · режим:{' '}
                    {driver.workMode || (driver.subscriptionPlan === 'partner_pro' ? 'partner_pro' : 'commission')}
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
                      onPress={() => updateDriverAccess(driver.id, 'commission', 'active')}
                      style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.smallButtonText}>Режим комиссии</Text>
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
            </View>

            <View style={[styles.sectionCard, activeSection !== 'settings' && styles.hiddenSection]}>
              <View style={styles.sectionHeader}>
                <MapPinned color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Адресный слой</Text>
              </View>
              <Text numberOfLines={2} style={styles.sectionText}>
                Подсказок адресов и POI: {salavatAddressSuggestions.length}. Улиц/дорог:{' '}
                {salavatDistrictStreetSourceSummary.streets}. Домов:{' '}
                {salavatDistrictHouses.length}.
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
              {adminAddresses.slice(0, 6).map((address) => (
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

            <View style={[styles.sectionCard, activeSection !== 'orders' && styles.hiddenSection]}>
              <View style={styles.sectionHeader}>
                <ReceiptText color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Последние заказы</Text>
              </View>
              <View style={styles.statsGridCompact}>
                <PlanRow title="Активные" value={String(activeAdminOrders.length)} />
                <PlanRow title="Завершенные" value={String(completedAdminOrders.length)} />
                <PlanRow title="Отмененные" value={String(cancelledAdminOrders.length)} />
              </View>
              {orders.length > 0 ? (
                orders.slice(0, 5).map((order) => (
                  <View key={order.id} style={styles.orderRow}>
                    <Text numberOfLines={1} style={styles.orderTitle}>
                      {order.id} · {order.total} ₽ · {order.status}
                    </Text>
                    <Text numberOfLines={1} style={styles.orderText}>
                      {order.pickup} → {order.destination}
                    </Text>
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
                        {approvedDrivers.slice(0, 2).map((driver) => (
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
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type PlanRowProps = {
  title: string;
  value: string;
};

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
  const uploadedItems = (Object.keys(documentLabels) as DriverDocumentKind[])
    .map((kind) => uploads?.[kind])
    .filter(Boolean) as DriverDocumentUpload[];

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
      {audit?.length ? (
        <View style={styles.auditBox}>
          <Text style={styles.documentUploadTitle}>Журнал проверки</Text>
          {audit.slice(0, 3).map((entry) => (
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

const styles = StyleSheet.create({
  adminLayout: {
    gap: 10,
  },
  complianceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  complianceLabel: {
    color: '#557669',
    fontSize: 11,
    fontWeight: '800',
  },
  complianceLabelReady: {
    color: '#008D49',
  },
  compliancePill: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
    minWidth: 104,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  compliancePillReady: {
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
  },
  complianceValue: {
    color: '#12382C',
    fontSize: 11,
    fontWeight: '900',
  },
  complianceValueReady: {
    color: '#008D49',
  },
  dangerButton: {
    backgroundColor: '#E8F3EF',
    borderColor: '#C17A70',
  },
  dangerButtonText: {
    color: '#C17A70',
    fontSize: 12,
    fontWeight: '900',
  },
  auditBox: {
    borderColor: '#E8F3EF',
    borderTopWidth: 1,
    gap: 3,
    marginTop: 6,
    paddingTop: 8,
  },
  documentMetaText: {
    color: '#81786B',
    fontSize: 11,
    lineHeight: 16,
  },
  documentAccessButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 9,
  },
  documentAccessButtonText: {
    color: '#008D49',
    fontSize: 11,
    fontWeight: '900',
  },
  documentRejectText: {
    color: '#C17A70',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  documentUploadBox: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    marginTop: 4,
    padding: 10,
  },
  documentUploadItem: {
    gap: 2,
  },
  documentUploadText: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  documentUploadTitle: {
    color: '#12382C',
    fontSize: 13,
    fontWeight: '900',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#008D49',
    fontSize: 14,
    fontWeight: '900',
  },
  adminTab: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 141, 73, 0.22)',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  adminTabActive: {
    backgroundColor: '#008D49',
    borderColor: '#008D49',
  },
  adminTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  adminTabText: {
    color: '#12382C',
    fontSize: 13,
    fontWeight: '900',
  },
  adminTabTextActive: {
    color: '#FFFFFF',
  },
  errorText: {
    color: '#C17A70',
    fontSize: 13,
    fontWeight: '800',
  },
  field: {
    gap: 8,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  helperText: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 18,
  },
  hiddenSection: {
    display: 'none',
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#557669',
    borderRadius: 8,
    borderWidth: 1,
    color: '#12382C',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  disabledButton: {
    opacity: 0.45,
  },
  inlineForm: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineInput: {
    flex: 1,
    minWidth: 220,
  },
  label: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  loginCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  orderRow: {
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
  orderText: {
    color: '#557669',
    fontSize: 13,
    lineHeight: 18,
  },
  orderTitle: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  mutedButton: {
    opacity: 0.48,
  },
  page: {
    backgroundColor: '#F4FAF6',
    gap: 12,
    minHeight: '100%',
    padding: 14,
  },
  planRow: {
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
  planTitle: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  planValue: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.95 }],
  },
  reasonInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#557669',
    borderRadius: 8,
    borderWidth: 1,
    color: '#12382C',
    fontSize: 13,
    minHeight: 42,
    paddingHorizontal: 10,
  },
  reviewBox: {
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    marginTop: 6,
    padding: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#F4FAF6',
    fontSize: 15,
    fontWeight: '900',
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  safeArea: {
    backgroundColor: '#F4FAF6',
    flex: 1,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionText: {
    color: '#12382C',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTextMuted: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  sectionTitle: {
    color: '#12382C',
    fontSize: 17,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  smallButton: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 10,
  },
  smallButtonText: {
    color: '#008D49',
    fontSize: 12,
    fontWeight: '900',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 132,
    padding: 10,
  },
  statHelper: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  statLabel: {
    color: '#557669',
    fontSize: 12,
    fontWeight: '800',
  },
  statValue: {
    color: '#12382C',
    fontSize: 22,
    fontWeight: '900',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statsGridCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subtitle: {
    color: '#557669',
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    color: '#12382C',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  topBar: {
    alignItems: 'flex-start',
  },
});
