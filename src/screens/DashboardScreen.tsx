import { useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  ClientOrderSummary,
  ClientOrderSummaryTrip,
  DriverFeedPreviewOrder,
  DriverStatsSummary,
  PostRegistrationMenu,
} from '../components/PostRegistrationMenu';
import { AccountRole, isDriverLikeRole, isSelfEmployedDriverRole } from '../data/registration';
import { driverAccessPlans } from '../data/subscription';
import { RootStackParamList } from '../navigation/types';
import { requestUserLocation } from '../services/locationService';
import { AppOrder, DriverProfile, DriverSubscription, useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const {
    currentUser,
    deleteAccount,
    driverSubscription,
    drivers,
    orders,
    assignOrderToDriver,
    realtimeMessage,
    realtimeStatus,
    realtimeUpdatedAt,
    logoutAccount,
    requestVerificationCode,
    savedHomeAddress,
    updateDriverAvailability,
    updateDriverLocation,
    verifyContactCode,
    setSimpleMode,
    simpleMode,
  } = useAppState();
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteFlowOpen, setDeleteFlowOpen] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [driverFeedBusyId, setDriverFeedBusyId] = useState<string | undefined>();
  const isDriverRole = isDriverLikeRole(role);
  const isSelfEmployedDriver = isSelfEmployedDriverRole(role);
  const fleetInviteCode =
    role === 'park_admin'
      ? createFleetInviteCode(currentUser?.id || currentUser?.email || firstName || 'salavat')
      : undefined;
  const availableCarsCount = useMemo(
    () =>
      drivers.reduce(
        (count, driver) =>
          count +
          (driver.status === 'approved' &&
          driver.isOnline &&
          driver.subscriptionStatus === 'active' &&
          driver.canReceiveOrders
            ? 1
            : 0),
        0,
      ),
    [drivers],
  );
  const currentDriver = useMemo(
    () =>
      isDriverRole && currentUser
        ? drivers.find((driver) => driver.userId === currentUser.id)
        : undefined,
    [currentUser, drivers, isDriverRole],
  );

  // Пока водитель на линии — периодически шлём его координаты (живой GPS для клиента).
  const onlineDriverId = currentDriver?.isOnline ? currentDriver.id : undefined;
  useEffect(() => {
    if (!onlineDriverId) {
      return;
    }

    let cancelled = false;
    const report = async () => {
      const result = await requestUserLocation();

      if (cancelled || result.status !== 'granted') {
        return;
      }

      // Лёгкий канал: только точка, без полного snapshot всем клиентам.
      updateDriverLocation(onlineDriverId, {
        accuracy: result.accuracy,
        latitude: result.point.latitude,
        longitude: result.point.longitude,
      });
    };

    const timer = setInterval(report, 25000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [onlineDriverId, updateDriverLocation]);

  const hasActiveAccess =
    currentDriver?.subscriptionStatus === 'active' ||
    (!isSelfEmployedDriver && Boolean(currentDriver?.canReceiveOrders)) ||
    driverSubscription.status === 'active';
  const canToggleLine = Boolean(currentDriver?.canReceiveOrders && hasActiveAccess);
  const driverAccessBlockers = currentDriver?.accessBlockers ?? [];
  // Смена платная: самозанятый водитель не может выйти на линию без оплаты
  // доступа (дневной доступ истекает ровно через 24 часа). Пока доступ не
  // активен — кнопка «Выйти на линию» ведёт к оплате.
  const driverNeedsPayment = isDriverRole && isSelfEmployedDriver && !hasActiveAccess;
  const driverStats = useMemo(
    () =>
      currentDriver
        ? createDriverStats(currentDriver, orders, driverSubscription)
        : undefined,
    [currentDriver, driverSubscription, orders],
  );
  const driverFeedLockedReason =
    isDriverRole && !currentDriver?.canReceiveOrders ? formatDriverAccessStatus(currentDriver) : undefined;
  const driverFeedOrders = useMemo(
    () => createDriverFeedOrders(orders, currentDriver),
    [currentDriver, orders],
  );
  const clientOrderSummary = useMemo(
    () => createClientOrderSummary(orders, role, currentUser?.id),
    [currentUser?.id, orders, role],
  );
  const activeClientOrder = useMemo(() => {
    if (role !== 'client') {
      return undefined;
    }

    return orders
      .filter(
        (order) =>
          order.role === 'client' &&
          (!currentUser?.id || !order.userId || order.userId === currentUser.id) &&
          !isFinalOrderStatus(order.status),
      )
      .sort((left, right) => Date.parse(right.createdAt || '') - Date.parse(left.createdAt || ''))[0];
  }, [currentUser?.id, orders, role]);

  const handleAcceptDashboardOrder = async (orderId: string) => {
    if (!currentDriver) {
      return;
    }

    setDriverFeedBusyId(orderId);

    try {
      const assignedOrder = await assignOrderToDriver(orderId, currentDriver.id, 'accepted');

      if (assignedOrder) {
        navigation.navigate('OrderStatus', {
          firstName,
          order: assignedOrder,
          role,
        });
      }
    } finally {
      setDriverFeedBusyId(undefined);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) {
      setDeleteMessage('Сначала нужно войти в аккаунт.');
      return;
    }

    if (!deleteCode.trim()) {
      setDeleteMessage('Введите код подтверждения.');
      return;
    }

    setDeleteBusy(true);
    const verified = await verifyContactCode(
      currentUser.phone ? 'phone' : 'email',
      deleteCode.trim(),
      currentUser.phone || currentUser.email,
    );

    if (!verified) {
      setDeleteBusy(false);
      setDeleteMessage('Код не подошел или истек.');
      return;
    }

    const result = await deleteAccount('Удаление аккаунта из профиля пользователя');
    setDeleteBusy(false);

    if (result) {
      navigation.replace('Welcome');
    }
  };
  const beginDeleteAccount = async () => {
    if (!currentUser) {
      setDeleteMessage('Сначала нужно войти в аккаунт.');
      return;
    }

    setDeleteFlowOpen(true);
    setDeleteMessage('Отправляем код подтверждения...');
    const channel = currentUser.phone ? 'phone' : 'email';
    const target = currentUser.phone || currentUser.email;
    const result = await requestVerificationCode(channel, target);
    setDeleteMessage(
      result
        ? `Код отправлен на ${target}. Удаление необратимо, финансовая история останется для отчетности.`
        : 'Не удалось отправить код подтверждения.',
    );
  };
  const confirmDeleteAccount = () => {
    const message =
      'Аккаунт будет помечен как deleted, сессии будут отозваны. Финансовая история сохранится для отчетности.';
    const maybeGlobal = globalThis as typeof globalThis & { confirm?: (text: string) => boolean };

    if (typeof maybeGlobal.confirm === 'function') {
      if (maybeGlobal.confirm(message)) {
        void beginDeleteAccount();
      }

      return;
    }

    Alert.alert('Удалить аккаунт?', message, [
      { style: 'cancel', text: 'Отмена' },
      {
        onPress: () => {
          void beginDeleteAccount();
        },
        style: 'destructive',
        text: 'Удалить',
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <PostRegistrationMenu
        availableCarsCount={availableCarsCount}
        clientOrderSummary={role === 'client' ? clientOrderSummary : undefined}
        driverFeedBusyId={driverFeedBusyId}
        driverFeedLockedReason={driverFeedLockedReason}
        driverFeedOrders={isDriverRole ? driverFeedOrders : []}
        driverStats={driverStats}
        driverLine={
          isDriverRole
            ? {
                canToggle: canToggleLine,
                accessBlockers: driverAccessBlockers,
                isOnline: Boolean(currentDriver?.isOnline),
                requiresPayment: driverNeedsPayment,
                status: currentDriver?.canReceiveOrders
                  ? 'Допущен к заказам'
                  : formatDriverAccessStatus(currentDriver),
              }
            : undefined
        }
        firstName={firstName}
        fleetInviteCode={fleetInviteCode}
        savedHomeAddressLabel={savedHomeAddress?.address}
        simpleMode={simpleMode}
        realtimeMessage={realtimeMessage}
        realtimeStatus={realtimeStatus}
        realtimeUpdatedAt={realtimeUpdatedAt}
        onBackToRegistration={() => navigation.navigate('Registration')}
        onDeleteAccount={confirmDeleteAccount}
        onToggleDriverLine={async () => {
          if (!currentDriver || !canToggleLine) {
            return;
          }

          const nextIsOnline = !currentDriver.isOnline;
          let location:
            | {
                accuracy?: number;
                latitude: number;
                longitude: number;
              }
            | undefined;

          if (nextIsOnline) {
            const result = await requestUserLocation();

            if (result.status === 'granted') {
              location = {
                accuracy: result.accuracy,
                latitude: result.point.latitude,
                longitude: result.point.longitude,
              };
            }
          }

          updateDriverAvailability(currentDriver.id, nextIsOnline, location);
        }}
        onOpenDelivery={() => navigation.navigate('OrderFlow', { firstName, role, serviceType: 'delivery' })}
        onOpenOrderFlow={() => navigation.navigate('OrderFlow', { firstName, role })}
        onOrderHome={() =>
          navigation.navigate('OrderFlow', {
            firstName,
            role,
            ...(savedHomeAddress?.address ? { presetDestination: savedHomeAddress.address } : {}),
          })
        }
        onOpenDriverDocuments={() => navigation.navigate('DriverDocuments', { firstName, role })}
        onOpenFleetDriverRegistration={() =>
          navigation.navigate('Registration', {
            referralCode: fleetInviteCode,
            role: 'park_driver',
          })
        }
        onOpenActiveOrder={
          activeClientOrder
            ? () => navigation.navigate('OrderStatus', { firstName, order: activeClientOrder, role })
            : undefined
        }
        onOpenOrderHistory={() => navigation.navigate('OrderHistory', { firstName, role })}
        onOpenReferral={() => navigation.navigate('Referral', { firstName, role })}
        onOpenSavedPlace={() => navigation.navigate('SavedPlace', { firstName, role })}
        onOpenSubscription={() => navigation.navigate('Subscription', { firstName, role })}
        onOpenSupportChat={(category?: string) =>
          navigation.navigate('SupportChat', { firstName, role, ...(category ? { category } : {}) })
        }
        onAcceptDriverOrder={isDriverRole ? handleAcceptDashboardOrder : undefined}
        onToggleSimpleMode={() => setSimpleMode(!simpleMode)}
        onLogout={async () => {
          await logoutAccount();
          navigation.replace('Welcome');
        }}
        role={role}
      />
      {deleteFlowOpen ? (
        <View style={styles.deletePanel}>
          <Text style={styles.deleteTitle}>Подтверждение удаления</Text>
          <Text style={styles.deleteText}>{deleteMessage}</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={setDeleteCode}
            placeholder="Код из SMS/email"
            placeholderTextColor="#557669"
            style={styles.deleteInput}
            value={deleteCode}
          />
          <View style={styles.deleteActions}>
            <Pressable
              accessibilityRole="button"
              disabled={deleteBusy}
              onPress={handleDeleteAccount}
              style={({ pressed }) => [
                styles.deleteButton,
                deleteBusy && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.deleteButtonText}>
                {deleteBusy ? 'Удаляем...' : 'Удалить аккаунт'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDeleteFlowOpen(false)}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function createFleetInviteCode(seed: string) {
  const normalized = seed
    .toUpperCase()
    .replace(/[^A-ZА-Я0-9]/g, '')
    .slice(0, 10);

  return `PARK-${normalized || 'SALAVAT'}`;
}

function createClientOrderSummary(
  orders: AppOrder[],
  role: AccountRole,
  userId?: string,
): ClientOrderSummary {
  if (role !== 'client') {
    return {
      activeCount: 0,
      completedCount: 0,
      lastOrderLabel: 'Пока нет поездок',
      lastOrderStatus: 'Пусто',
      totalCount: 0,
      totalSpent: 0,
    };
  }

  const clientOrders = orders
    .filter((order) => order.role === 'client' && (!userId || !order.userId || order.userId === userId))
    .sort((left, right) => Date.parse(right.createdAt || '') - Date.parse(left.createdAt || ''));
  const activeOrders = clientOrders.filter((order) => !isFinalOrderStatus(order.status));
  const completedCount = clientOrders.filter((order) => isFinalOrderStatus(order.status)).length;
  const lastOrder = clientOrders[0];
  const activeOrder = activeOrders[0];

  return {
    activeCount: activeOrders.length,
    completedCount,
    lastOrderLabel: lastOrder ? formatRouteTitle(lastOrder) : 'Пока нет поездок',
    lastOrderStatus: lastOrder ? formatClientOrderStatus(lastOrder.status) : 'Пусто',
    lastOrder: lastOrder ? createClientSummaryTrip(lastOrder) : undefined,
    totalCount: clientOrders.length,
    totalSpent: clientOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    activeOrder: activeOrder ? createClientSummaryTrip(activeOrder) : undefined,
  };
}

function createClientSummaryTrip(order: AppOrder): ClientOrderSummaryTrip {
  return {
    createdAt: order.createdAt,
    destination: order.destination,
    driverLabel: order.driver?.name ?? (isFinalOrderStatus(order.status) ? 'водитель не назначен' : 'водитель ищется'),
    id: order.id,
    pickup: order.pickup,
    priceLabel: `${order.total} ₽`,
    routeLabel: `${getOrderServiceLabel(order)}: ${formatRouteTitle(order)}`,
    routeTitle: formatRouteTitle(order),
    serviceType: order.serviceType === 'delivery' ? 'delivery' : 'taxi',
    statusLabel: formatClientOrderStatus(order.status),
  };
}

function formatRouteTitle(order: AppOrder) {
  return `${order.pickup} → ${order.destination}`;
}

function isFinalOrderStatus(status: string) {
  return ['cancelled', 'canceled', 'closed', 'completed'].includes(status);
}

function formatClientOrderStatus(status: string) {
  const labels: Record<string, string> = {
    accepted: 'Принят',
    arrived: 'Водитель на месте',
    arriving: 'Едет к вам',
    assigned: 'Назначен',
    canceled: 'Отменён',
    cancelled: 'Отменён',
    closed: 'Закрыт',
    completed: 'Завершён',
    created: 'Создан',
    in_progress: 'В поездке',
    searching: 'Ищем водителя',
    started: 'В поездке',
    to_pickup: 'Едет к вам',
  };

  return labels[status] ?? status;
}

function createDriverFeedOrders(orders: AppOrder[], driver?: DriverProfile): DriverFeedPreviewOrder[] {
  if (!driver?.canReceiveOrders) {
    return [];
  }

  const nowMs = Date.now();

  return orders
    .filter(
      (order) =>
        order.role === 'client' &&
        !order.driver &&
        ['created', 'searching'].includes(order.status) &&
        isOrderVisibleToDriver(order, driver.id, nowMs),
    )
    .sort((left, right) => {
      const leftExclusive = isOrderExclusiveForDriver(left, driver.id, nowMs);
      const rightExclusive = isOrderExclusiveForDriver(right, driver.id, nowMs);

      if (leftExclusive !== rightExclusive) {
        return rightExclusive ? 1 : -1;
      }

      const distanceDiff = getDriverOrderDistanceKm(left, driver) - getDriverOrderDistanceKm(right, driver);

      if (Number.isFinite(distanceDiff) && distanceDiff !== 0) {
        return distanceDiff;
      }

      return Date.parse(right.createdAt || '') - Date.parse(left.createdAt || '');
    })
    .map((order) => createDriverFeedPreviewOrder(order, driver, nowMs));
}

function createDriverFeedPreviewOrder(
  order: AppOrder,
  driver: DriverProfile,
  nowMs: number,
): DriverFeedPreviewOrder {
  const duration = order.routeEstimate?.durationMin ? ` · ${order.routeEstimate.durationMin} мин` : '';

  return {
    address: `${order.pickup} → ${order.destination}`,
    badges: getDriverOrderBadges(order, driver, nowMs),
    distanceLabel: getDriverOrderDistanceLabel(order, driver),
    id: order.id,
    metaLabel: `${getOrderServiceLabel(order)} · ${order.tariff} · ${order.paymentMethod}${duration}`,
    priceLabel: `${order.total} ₽`,
    serviceLabel: getOrderServiceLabel(order),
  };
}

function getOrderServiceLabel(order: AppOrder) {
  return order.serviceType === 'delivery' ? 'Доставка' : 'Такси';
}

function getExclusiveOfferRemainingSeconds(order: AppOrder, driverId?: string, nowMs = Date.now()) {
  if (!driverId || order.exclusiveOfferStatus !== 'pending' || order.exclusiveDriverId !== driverId) {
    return 0;
  }

  const expiresAt = Date.parse(order.exclusiveOfferExpiresAt || '');

  if (!Number.isFinite(expiresAt)) {
    return 0;
  }

  return Math.max(0, Math.ceil((expiresAt - nowMs) / 1000));
}

function isOrderExclusiveForDriver(order: AppOrder, driverId?: string, nowMs = Date.now()) {
  return getExclusiveOfferRemainingSeconds(order, driverId, nowMs) > 0;
}

function isOrderVisibleToDriver(order: AppOrder, driverId?: string, nowMs = Date.now()) {
  if (!order.exclusiveDriverId || order.exclusiveOfferStatus !== 'pending') {
    return true;
  }

  const expiresAt = Date.parse(order.exclusiveOfferExpiresAt || '');

  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
    return true;
  }

  return order.exclusiveDriverId === driverId;
}

function getDriverOrderDistanceKm(order: AppOrder, driver?: DriverProfile) {
  if (order.pickupPoint && driver?.lastLocation) {
    return getGeoDistanceKm(driver.lastLocation, order.pickupPoint);
  }

  if (typeof order.exclusiveDistanceKm === 'number') {
    return order.exclusiveDistanceKm;
  }

  return Number.POSITIVE_INFINITY;
}

function getDriverOrderDistanceLabel(order: AppOrder, driver?: DriverProfile) {
  const distance = getDriverOrderDistanceKm(order, driver);

  return Number.isFinite(distance) ? `${formatDistance(distance)}` : '—';
}

function getDriverOrderBadges(order: AppOrder, driver: DriverProfile | undefined, nowMs: number) {
  const badges: string[] = [];
  const distance = getDriverOrderDistanceKm(order, driver);

  if (order.serviceType === 'delivery') {
    badges.push('доставка');
  }

  if (isOrderExclusiveForDriver(order, driver?.id, nowMs)) {
    badges.push('эксклюзив');
  }

  if (Number.isFinite(distance) && distance <= 2) {
    badges.push('рядом');
  }

  if (order.total >= 500) {
    badges.push('выгодно');
  }

  if (/нал/i.test(order.paymentMethod)) {
    badges.push('наличные');
  } else if (/карт|card/i.test(order.paymentMethod)) {
    badges.push('карта');
  }

  for (const option of order.options ?? []) {
    if (/багаж/i.test(option)) {
      badges.push('багаж');
    }

    if (/дет/i.test(option)) {
      badges.push('детское');
    }
  }

  return Array.from(new Set(badges));
}

function getGeoDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) ** 2;

  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) * 10) / 10;
}

function formatDistance(km: number) {
  if (km < 1) {
    return `${Math.max(50, Math.round(km * 1000))} м`;
  }

  return `${km.toFixed(km < 10 ? 1 : 0)} км`;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function formatDriverAccessStatus(driver?: DriverProfile) {
  if (!driver) {
    return 'нужна заявка';
  }

  if (driver.status !== 'approved') {
    return 'ожидает проверки';
  }

  if (!driver.canReceiveOrders) {
    return 'нужны документы и договор';
  }

  return 'допущен';
}

function createDriverStats(
  driver: DriverProfile,
  orders: AppOrder[],
  subscription: DriverSubscription,
): DriverStatsSummary {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const completedOrders = orders.filter(
    (order) => order.driver?.id === driver.id && ['closed', 'completed'].includes(order.status),
  );
  const monthOrders = completedOrders.filter((order) => new Date(order.updatedAt ?? order.createdAt) >= monthStart);
  const weekOrders = completedOrders.filter((order) => new Date(order.updatedAt ?? order.createdAt) >= weekStart);
  const todayOrders = completedOrders.filter((order) => new Date(order.updatedAt ?? order.createdAt) >= dayStart);
  const billingMode = driver.billingMode ?? subscription.billingMode;
  const accessExpiresAt = driver.subscriptionExpiresAt ?? driver.accessExpiresAt ?? subscription.expiresAt;
  const gross = monthOrders.reduce((sum, order) => sum + getDriverCollectedAmount(order), 0);
  const grossToday = todayOrders.reduce((sum, order) => sum + getDriverCollectedAmount(order), 0);
  const serviceShare = 0;
  const serviceShareToday = 0;
  const subscriptionCost = driverAccessPlans[billingMode].monthlyPrice;
  const settlementStatus = 'not_applicable';

  return {
    billingMode,
    driverNet: gross,
    gross,
    grossToday,
    monthOrders: monthOrders.length,
    serviceShare,
    serviceShareRate: 0,
    serviceShareToday,
    settlementStatus,
    subscriptionExpiresAt: accessExpiresAt,
    subscriptionCost,
    todayOrders: todayOrders.length,
    weekOrders: weekOrders.length,
  };
}

function getDriverCollectedAmount(order: AppOrder) {
  return typeof order.driverCollectedAmount === 'number' ? order.driverCollectedAmount : order.total;
}

const styles = StyleSheet.create({
  cancelButton: {
    alignItems: 'center',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  cancelButtonText: {
    color: '#008D49',
    fontSize: 14,
    fontWeight: '900',
  },
  deleteActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#C17A70',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  deleteButtonText: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  deleteInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#557669',
    borderRadius: 8,
    borderWidth: 1,
    color: '#12382C',
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  deletePanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C17A70',
    borderRadius: 8,
    borderWidth: 1,
    bottom: 16,
    gap: 10,
    left: 16,
    padding: 14,
    position: 'absolute',
    right: 16,
  },
  deleteText: {
    color: '#557669',
    fontSize: 13,
    lineHeight: 18,
  },
  deleteTitle: {
    color: '#12382C',
    fontSize: 16,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.95 }],
  },
  safeArea: {
    backgroundColor: '#F4FAF6',
    flex: 1,
  },
});
