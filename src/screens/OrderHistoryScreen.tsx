import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Clock3, Heart, ReceiptText, Route, Star } from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { roleCopy } from '../data/registration';
import { RootStackParamList } from '../navigation/types';
import { AppOrder, useAppState } from '../state/AppState';

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
  to_pickup: 'Едет к клиенту',
};

export function OrderHistoryScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const { addFavoriteDriver, favoriteDrivers, orders } = useAppState();
  const visibleOrders = orders.filter((order) => order.role === role);

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
              <ArrowLeft color="#146C5D" size={20} strokeWidth={2.4} />
              <Text style={styles.backButtonText}>Назад</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('OrderFlow', { firstName, role })}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>
                {role === 'driver' ? 'К ленте заказов' : 'Новый заказ'}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.roleText}>{roleCopy[role].title}</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <ReceiptText color="#146C5D" size={30} strokeWidth={2.4} />
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
  onFavorite,
  onPress,
  order,
}: {
  favorite: boolean;
  onFavorite: () => void;
  onPress: () => void;
  order: AppOrder;
}) {
  const isCompleted = ['closed', 'completed'].includes(order.status);

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
        <Route color="#146C5D" size={18} strokeWidth={2.4} />
        <View style={styles.routeCopy}>
          <Text style={styles.routeText}>{order.pickup}</Text>
          <Text style={styles.routeText}>{order.destination}</Text>
        </View>
      </View>
      <View style={styles.orderFooter}>
        <View style={styles.footerItem}>
          <Clock3 color="#59616C" size={16} strokeWidth={2.4} />
          <Text style={styles.footerText}>{new Date(order.createdAt).toLocaleDateString('ru-RU')}</Text>
        </View>
        <Text style={styles.total}>{order.total} ₽</Text>
      </View>

      {isCompleted ? (
        <View style={styles.afterTripBox}>
          <View style={styles.afterTripRow}>
            <ReceiptText color="#146C5D" size={17} strokeWidth={2.4} />
            <View style={styles.afterTripCopy}>
              <Text style={styles.afterTripTitle}>
                Чек {order.receipt?.id ?? `RC-${order.id.replace(/\D/g, '')}`}
              </Text>
              <Text style={styles.afterTripText}>
                {order.paymentMethod} · {order.total} ₽ ·{' '}
                {order.receipt ? 'сформирован' : 'будет выгружен с сервера'}
              </Text>
            </View>
          </View>

          <View style={styles.afterTripRow}>
            <Star color="#F5A524" fill="#F5A524" size={17} strokeWidth={2.4} />
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

          {order.driver ? (
            <Pressable
              accessibilityRole="button"
              onPress={onFavorite}
              style={({ pressed }) => [styles.favoriteButton, pressed && styles.pressed]}
            >
              <Heart color="#146C5D" size={17} strokeWidth={2.4} />
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

const styles = StyleSheet.create({
  afterTripBox: {
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
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
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  afterTripTitle: {
    color: '#20242A',
    fontSize: 13,
    fontWeight: '900',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#146C5D',
    fontSize: 14,
    fontWeight: '900',
  },
  empty: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  emptyText: {
    color: '#59616C',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyTitle: {
    color: '#20242A',
    fontSize: 18,
    fontWeight: '900',
  },
  favoriteButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#146C5D',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  favoriteButtonText: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
  footerItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  footerText: {
    color: '#59616C',
    fontSize: 12,
    fontWeight: '800',
  },
  hero: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
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
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  list: {
    gap: 10,
  },
  metaLine: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
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
    color: '#20242A',
    fontSize: 16,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#F4F7F5',
    gap: 16,
    minHeight: '100%',
    padding: 16,
  },
  pressed: {
    opacity: 0.76,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#146C5D',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  roleText: {
    color: '#146C5D',
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
    color: '#20242A',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  safeArea: {
    backgroundColor: '#F4F7F5',
    flex: 1,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 130,
    padding: 14,
  },
  statLabel: {
    color: '#59616C',
    fontSize: 12,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statValue: {
    color: '#20242A',
    fontSize: 22,
    fontWeight: '900',
  },
  status: {
    backgroundColor: '#E9F4F1',
    borderRadius: 6,
    color: '#146C5D',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  subtitle: {
    color: '#59616C',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: '#20242A',
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
    color: '#20242A',
    fontSize: 16,
    fontWeight: '900',
  },
});
