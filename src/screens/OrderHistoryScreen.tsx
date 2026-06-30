import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Heart, ReceiptText, Star, Wallet } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TripCard, type TripCardServiceType } from '../components/TripCard';
import { isDriverLikeRole, roleCopy } from '../data/registration';
import { RootStackParamList } from '../navigation/types';
import { AppOrder, PaymentStatus, useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderHistory'>;

const statusLabels: Record<string, string> = {
  accepted: 'Принят',
  arrived: 'На месте',
  arriving: 'Подача',
  assigned: 'Назначен',
  closed: 'Закрыт',
  completed: 'Завершён',
  created: 'Создан',
  in_progress: 'В поездке',
  searching: 'Поиск',
  started: 'В поездке',
  to_pickup: 'Едет к клиенту',
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  authorized: 'оплата авторизована',
  failed: 'оплата не прошла',
  paid: 'оплачено',
  pending: 'ожидает оплаты',
  refunded: 'возврат',
};

export function OrderHistoryScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const {
    addFavoriteDriver,
    currentUser,
    drivers,
    favoriteDrivers,
    orders,
    updateOrderServiceShareStatus,
  } = useAppState();
  const isDriverRole = isDriverLikeRole(role);
  const currentDriver = useMemo(
    () =>
      isDriverRole && currentUser
        ? drivers.find((driver) => driver.userId === currentUser.id)
        : undefined,
    [currentUser, drivers, isDriverRole],
  );
  const visibleOrders = useMemo(
    () =>
      orders.filter((order) =>
        isDriverRole
          ? isDriverLikeRole(order.role) || order.driver?.id === currentDriver?.id
          : order.role === role,
      ),
    [currentDriver?.id, isDriverRole, orders, role],
  );
  const favoriteDriverIds = useMemo(
    () => new Set(favoriteDrivers.map((driver) => driver.id)),
    [favoriteDrivers],
  );
  const historySummary = useMemo(
    () =>
      visibleOrders.reduce(
        (summary, order) => {
          const isCompleted = ['completed', 'closed'].includes(String(order.status));

          return {
            activeCount: summary.activeCount + (isCompleted ? 0 : 1),
            completedCount: summary.completedCount + (isCompleted ? 1 : 0),
            reviewedCount: summary.reviewedCount + (order.review ? 1 : 0),
            totalSpent: summary.totalSpent + order.total,
          };
        },
        {
          activeCount: 0,
          completedCount: 0,
          reviewedCount: 0,
          totalSpent: 0,
        },
      ),
    [visibleOrders],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <View style={styles.topActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <ArrowLeft color="#008D49" size={20} strokeWidth={2.4} />
              <Text style={styles.backButtonText}>Назад</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('OrderFlow', { firstName, role })}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>
                {isDriverRole ? 'К ленте заказов' : 'Повтор маршрута'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.historyMeta}>
            <Text style={styles.roleText}>{roleCopy[role].title}</Text>
            <Text style={styles.completedText}>Завершено: {historySummary.completedCount}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <ReceiptText color="#008D49" size={30} strokeWidth={2.4} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>История заказов</Text>
            <Text style={styles.subtitle}>
              Здесь сохраняются созданные поездки, принятые заказы и их текущие статусы.
            </Text>
            <Text style={styles.metaLine}>{firstName?.trim() || 'Пользователь'}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Всего" value={String(visibleOrders.length)} />
          <StatCard
            label="Сумма"
            value={`${historySummary.totalSpent} ₽`}
          />
          <StatCard
            label={role === 'client' ? 'Отзывы' : 'Активные'}
            value={
              role === 'client'
                ? String(historySummary.reviewedCount)
                : String(historySummary.activeCount)
            }
          />
        </View>

        <View style={styles.list}>
          {visibleOrders.length > 0 ? (
            visibleOrders.map((order) => (
              <OrderCard
                key={order.id}
                favorite={Boolean(
                  order.driver && favoriteDriverIds.has(order.driver.id),
                )}
                onFavorite={() => {
                  if (!order.driver) {
                    return;
                  }

                  addFavoriteDriver({
                    ...order.driver,
                    addedAt: new Date().toISOString(),
                    lastOrderId: order.id,
                    reason: order.review?.facets.join(', ') || 'Хорошая поездка',
                  });
                }}
                onComplaint={() =>
                  navigation.navigate('SupportChat', {
                    category: 'Жалоба',
                    firstName,
                    role,
                  })
                }
                onPress={() =>
                  navigation.navigate('OrderStatus', {
                    firstName,
                    order,
                    role,
                  })
                }
                onRepeatRoute={() =>
                  navigation.navigate('OrderFlow', {
                    firstName,
                    presetDestination: order.destination,
                    presetPickup: order.pickup,
                    role,
                  })
                }
                onReview={() =>
                  navigation.navigate('OrderStatus', {
                    firstName,
                    order,
                    role,
                  })
                }
                onReportServiceShareTransfer={() =>
                  updateOrderServiceShareStatus(
                    order.id,
                    'reported_transferred',
                    'Driver reported daily service share transfer',
                  )
                }
                isClientRole={!isDriverRole}
                isDriverRole={isDriverRole}
                order={order}
              />
            ))
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Заказов пока нет</Text>
              <Text style={styles.emptyText}>
                После оформления или принятия заказа он появится здесь.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderCard({
  favorite,
  isDriverRole,
  isClientRole,
  onComplaint,
  onFavorite,
  onPress,
  onRepeatRoute,
  onReportServiceShareTransfer,
  onReview,
  order,
}: {
  favorite: boolean;
  isDriverRole: boolean;
  isClientRole: boolean;
  onComplaint: () => void;
  onFavorite: () => void;
  onPress: () => void;
  onRepeatRoute: () => void;
  onReportServiceShareTransfer: () => void;
  onReview: () => void;
  order: AppOrder;
}) {
  const isCompleted = ['closed', 'completed'].includes(order.status);
  const serviceShareAmount = order.serviceShareAmount ?? order.driverCommission ?? 0;
  const canReportServiceShareTransfer =
    isDriverRole &&
    isCompleted &&
    serviceShareAmount > 0 &&
    order.serviceShareStatus === 'pending_transfer';

  return (
    <TripCard
      dateTimeLabel={formatTripDateTime(order.createdAt)}
      destination={order.destination}
      driverLabel={formatTripParticipantLine(order, isDriverRole)}
      onPress={onPress}
      pickup={order.pickup}
      priceLabel={`${order.total} ₽`}
      serviceType={getTripServiceType(order)}
      statusLabel={statusLabels[order.status] ?? order.status}
      title={formatRouteTitle(order)}
      tone={isCompleted ? 'done' : 'active'}
    >
      <Text style={styles.orderMetaLine}>{order.id} · {formatOrderService(order)}</Text>
      <Text style={styles.paymentLine}>
        {paymentStatusLabels[order.paymentStatus ?? 'pending']} · {order.paymentMethod}
      </Text>
      {order.serviceType === 'delivery' ? (
        <Text style={styles.paymentLine}>
          {formatDeliveryPackageType(order.deliveryPackageType)} · {order.packageDescription || 'Посылка'} · {formatDeliveryHandoff(order.deliveryHandoff)} · {[order.recipientName, order.recipientPhone].filter(Boolean).join(' · ') || 'получатель не указан'}
        </Text>
      ) : null}

      {isClientRole ? (
        <View style={styles.clientTripActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onReview}
            style={({ pressed }) => [styles.clientTripActionButton, pressed && styles.pressed]}
          >
            <Text style={styles.clientTripActionText}>Оставить отзыв</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onComplaint}
            style={({ pressed }) => [styles.clientTripActionButton, pressed && styles.pressed]}
          >
            <Text style={styles.clientTripActionText}>Жалоба</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onRepeatRoute}
            style={({ pressed }) => [styles.clientTripActionButtonPrimary, pressed && styles.pressed]}
          >
            <Text style={styles.clientTripActionTextPrimary}>Повтор маршрута</Text>
          </Pressable>
        </View>
      ) : null}

      {isCompleted ? (
        <View style={styles.afterTripBox}>
          <View style={styles.afterTripRow}>
            <ReceiptText color="#008D49" size={17} strokeWidth={2.4} />
            <View style={styles.afterTripCopy}>
              <Text style={styles.afterTripTitle}>
                Чек {order.receipt?.id ?? `RC-${order.id.replace(/\D/g, '')}`}
              </Text>
              <Text style={styles.afterTripText}>
                {order.paymentMethod} · {order.total} ₽ · {order.paymentStatus === 'paid' ? 'оплачено' : 'ожидает оплаты'} ·{' '}
                {order.receipt ? 'сформирован' : 'будет выгружен с сервера'}
              </Text>
            </View>
          </View>

          <View style={styles.afterTripRow}>
            <Star color="#008D49" fill="#008D49" size={17} strokeWidth={2.4} />
            <View style={styles.afterTripCopy}>
              <Text style={styles.afterTripTitle}>
                {order.review ? `${order.review.rating}/5 · ${order.review.mood}` : 'Отзыв ожидает'}
              </Text>
              <Text style={styles.afterTripText}>
                {order.review
                  ? `${order.review.facets.join(', ')}. ${order.review.comment}`
                  : 'Откройте завершенную поездку и оставьте слепок поездки.'}
              </Text>
            </View>
          </View>

          {isDriverRole ? (
            <View style={styles.afterTripRow}>
              <Wallet color="#008D49" size={17} strokeWidth={2.4} />
              <View style={styles.afterTripCopy}>
                <Text style={styles.afterTripTitle}>Сверка с сервисом</Text>
                <Text style={styles.afterTripText}>
                  Собрано водителем {order.driverCollectedAmount ?? order.total} ₽ · к переводу{' '}
                  {order.serviceShareAmount ?? order.driverCommission ?? 0} ₽ ·{' '}
                  {formatServiceShareStatus(order.serviceShareStatus)}
                </Text>
              </View>
            </View>
          ) : null}

          {canReportServiceShareTransfer ? (
            <Pressable
              accessibilityRole="button"
              onPress={onReportServiceShareTransfer}
              style={({ pressed }) => [styles.favoriteButton, pressed && styles.pressed]}
            >
              <Wallet color="#008D49" size={17} strokeWidth={2.4} />
              <Text style={styles.favoriteButtonText}>Я перевел долю сервиса</Text>
            </Pressable>
          ) : null}

          {order.driver ? (
            <Pressable
              accessibilityRole="button"
              onPress={onFavorite}
              style={({ pressed }) => [styles.favoriteButton, pressed && styles.pressed]}
            >
              <Heart color="#008D49" size={17} strokeWidth={2.4} />
              <Text style={styles.favoriteButtonText}>
                {favorite ? 'Водитель в избранном' : 'Добавить водителя в избранные'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </TripCard>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
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

function formatOrderService(order: AppOrder) {
  return order.serviceType === 'delivery' ? 'Доставка' : 'Такси';
}

function getTripServiceType(order: AppOrder): TripCardServiceType {
  return order.serviceType === 'delivery' ? 'delivery' : 'taxi';
}

function formatRouteTitle(order: AppOrder) {
  return `${order.pickup} → ${order.destination}`;
}

function formatTripDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

function formatTripParticipantLine(order: AppOrder, isDriverRole: boolean) {
  if (isDriverRole) {
    return `Клиент: ${order.clientName?.trim() || 'клиент'}`;
  }

  if (order.driver?.name) {
    return `Водитель: ${order.driver.name}`;
  }

  return ['created', 'searching'].includes(order.status)
    ? 'Водитель: ищем'
    : 'Водитель: не назначен';
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
    return 'у двери';
  }

  if (value === 'meet_outside') {
    return 'у входа';
  }

  return 'дверь-дверь';
}

const styles = StyleSheet.create({
  afterTripBox: {
    backgroundColor: '#F1F8F3',
    borderColor: 'rgba(0, 141, 73, 0.28)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  afterTripCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  afterTripRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 9,
  },
  afterTripText: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  afterTripTitle: {
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
  clientTripActionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(18, 56, 44, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 118,
    paddingHorizontal: 10,
  },
  clientTripActionButtonPrimary: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 132,
    paddingHorizontal: 10,
  },
  clientTripActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  clientTripActionText: {
    color: '#008D49',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  clientTripActionTextPrimary: {
    color: '#F4FAF6',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  empty: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(18, 56, 44, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    gap: 6,
    padding: 16,
    shadowColor: 'rgba(18, 56, 44, 0.14)',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  emptyText: {
    color: '#557669',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyTitle: {
    color: '#12382C',
    fontSize: 18,
    fontWeight: '900',
  },
  favoriteButton: {
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
  favoriteButtonText: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  footerItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  footerText: {
    color: '#557669',
    fontSize: 12,
    fontWeight: '800',
  },
  hero: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
  },
  heroCopy: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  list: {
    gap: 10,
  },
  metaLine: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(18, 56, 44, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    gap: 12,
    padding: 14,
    shadowColor: 'rgba(18, 56, 44, 0.14)',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  orderFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  orderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  orderId: {
    color: '#12382C',
    fontSize: 16,
    fontWeight: '900',
  },
  orderMetaLine: {
    color: '#557669',
    fontSize: 12,
    fontWeight: '800',
  },
  paymentLine: {
    color: '#008D49',
    fontSize: 12,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#F6F8F5',
    gap: 16,
    minHeight: '100%',
    padding: 16,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    elevation: 2,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
    shadowColor: 'rgba(0, 111, 58, 0.22)',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },
  primaryButtonText: {
    color: '#F4FAF6',
    fontSize: 14,
    fontWeight: '900',
  },
  completedText: {
    color: '#557669',
    fontSize: 12,
    fontWeight: '800',
  },
  historyMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roleText: {
    color: '#008D49',
    fontSize: 14,
    fontWeight: '900',
  },
  routeCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  routeRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  routeText: {
    color: '#12382C',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  safeArea: {
    backgroundColor: '#F4FAF6',
    flex: 1,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 130,
    padding: 14,
  },
  statLabel: {
    color: '#557669',
    fontSize: 12,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statValue: {
    color: '#12382C',
    fontSize: 22,
    fontWeight: '900',
  },
  status: {
    backgroundColor: '#E8F3EF',
    borderRadius: 6,
    color: '#008D49',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  subtitle: {
    color: '#557669',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: '#12382C',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  topActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  total: {
    color: '#12382C',
    fontSize: 16,
    fontWeight: '900',
  },
});
