import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Clock3, Heart, ReceiptText, Route, Star, Wallet } from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  completed: 'Завершен',
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
  const currentDriver =
    isDriverRole && currentUser
      ? drivers.find((driver) => driver.userId === currentUser.id)
      : undefined;
  const visibleOrders = orders.filter((order) =>
    isDriverRole
      ? isDriverLikeRole(order.role) || order.driver?.id === currentDriver?.id
      : order.role === role,
  );
  const completedCount = visibleOrders.filter((order) =>
    ['completed', 'closed'].includes(String(order.status)),
  ).length;

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
              <ArrowLeft color="#D4A853" size={20} strokeWidth={2.4} />
              <Text style={styles.backButtonText}>Назад</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('OrderFlow', { firstName, role })}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>
                {isDriverRole ? 'К ленте заказов' : 'Новый заказ'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.historyMeta}>
            <Text style={styles.roleText}>{roleCopy[role].title}</Text>
            <Text style={styles.completedText}>Завершено: {completedCount}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <ReceiptText color="#D4A853" size={30} strokeWidth={2.4} />
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
            value={`${visibleOrders.reduce((sum, order) => sum + order.total, 0)} ₽`}
          />
          <StatCard
            label={role === 'client' ? 'Отзывы' : 'Активные'}
            value={
              role === 'client'
                ? String(visibleOrders.filter((order) => order.review).length)
                : String(
                    visibleOrders.filter((order) => !['closed', 'completed'].includes(order.status))
                      .length,
                  )
            }
          />
        </View>

        <View style={styles.list}>
          {visibleOrders.length > 0 ? (
            visibleOrders.map((order) => (
              <OrderCard
                key={order.id}
                favorite={Boolean(
                  order.driver && favoriteDrivers.some((driver) => driver.id === order.driver?.id),
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
                onPress={() =>
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
  onFavorite,
  onPress,
  onReportServiceShareTransfer,
  order,
}: {
  favorite: boolean;
  isDriverRole: boolean;
  onFavorite: () => void;
  onPress: () => void;
  onReportServiceShareTransfer: () => void;
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
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.orderCard, pressed && styles.pressed]}
    >
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>{order.id}</Text>
        <Text style={styles.status}>{statusLabels[order.status] ?? order.status}</Text>
      </View>
      <View style={styles.routeRow}>
        <Route color="#D4A853" size={18} strokeWidth={2.4} />
        <View style={styles.routeCopy}>
          <Text style={styles.routeText}>{order.pickup}</Text>
          <Text style={styles.routeText}>{order.destination}</Text>
        </View>
      </View>
      <View style={styles.orderFooter}>
        <View style={styles.footerItem}>
          <Clock3 color="#A89F91" size={16} strokeWidth={2.4} />
          <Text style={styles.footerText}>{new Date(order.createdAt).toLocaleDateString('ru-RU')}</Text>
        </View>
        <Text style={styles.total}>{order.total} ₽</Text>
      </View>
      <Text style={styles.paymentLine}>
        {paymentStatusLabels[order.paymentStatus ?? 'pending']} · {order.paymentMethod}
      </Text>

      {isCompleted ? (
        <View style={styles.afterTripBox}>
          <View style={styles.afterTripRow}>
            <ReceiptText color="#D4A853" size={17} strokeWidth={2.4} />
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
            <Star color="#D4A853" fill="#D4A853" size={17} strokeWidth={2.4} />
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
              <Wallet color="#D4A853" size={17} strokeWidth={2.4} />
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
              <Wallet color="#D4A853" size={17} strokeWidth={2.4} />
              <Text style={styles.favoriteButtonText}>Я перевел долю сервиса</Text>
            </Pressable>
          ) : null}

          {order.driver ? (
            <Pressable
              accessibilityRole="button"
              onPress={onFavorite}
              style={({ pressed }) => [styles.favoriteButton, pressed && styles.pressed]}
            >
              <Heart color="#D4A853" size={17} strokeWidth={2.4} />
              <Text style={styles.favoriteButtonText}>
                {favorite ? 'Водитель в избранном' : 'Добавить водителя в избранные'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
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

const styles = StyleSheet.create({
  afterTripBox: {
    backgroundColor: '#37322E',
    borderColor: '#D4A853',
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
    color: '#A89F91',
    fontSize: 12,
    lineHeight: 17,
  },
  afterTripTitle: {
    color: '#F5F0E8',
    fontSize: 13,
    fontWeight: '900',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#D4A853',
    fontSize: 14,
    fontWeight: '900',
  },
  empty: {
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  emptyText: {
    color: '#A89F91',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyTitle: {
    color: '#F5F0E8',
    fontSize: 18,
    fontWeight: '900',
  },
  favoriteButton: {
    alignItems: 'center',
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  favoriteButtonText: {
    color: '#D4A853',
    fontSize: 13,
    fontWeight: '900',
  },
  footerItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  footerText: {
    color: '#A89F91',
    fontSize: 12,
    fontWeight: '800',
  },
  hero: {
    alignItems: 'flex-start',
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
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
    backgroundColor: '#37322E',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  list: {
    gap: 10,
  },
  metaLine: {
    color: '#D4A853',
    fontSize: 13,
    fontWeight: '900',
  },
  orderCard: {
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
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
    color: '#F5F0E8',
    fontSize: 16,
    fontWeight: '900',
  },
  paymentLine: {
    color: '#D4A853',
    fontSize: 12,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#1E1C1A',
    gap: 16,
    minHeight: '100%',
    padding: 16,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.95 }],
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#D4A853',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: '#1E1C1A',
    fontSize: 14,
    fontWeight: '900',
  },
  completedText: {
    color: '#A89F91',
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
    color: '#D4A853',
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
    color: '#F5F0E8',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  safeArea: {
    backgroundColor: '#1E1C1A',
    flex: 1,
  },
  statCard: {
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 130,
    padding: 14,
  },
  statLabel: {
    color: '#A89F91',
    fontSize: 12,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statValue: {
    color: '#F5F0E8',
    fontSize: 22,
    fontWeight: '900',
  },
  status: {
    backgroundColor: '#37322E',
    borderRadius: 6,
    color: '#D4A853',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  subtitle: {
    color: '#A89F91',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: '#F5F0E8',
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
    color: '#F5F0E8',
    fontSize: 16,
    fontWeight: '900',
  },
});
