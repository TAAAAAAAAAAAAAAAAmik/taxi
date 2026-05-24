import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, StyleSheet } from 'react-native';

import { DriverStatsSummary, PostRegistrationMenu } from '../components/PostRegistrationMenu';
import { RootStackParamList } from '../navigation/types';
import { AppOrder, DriverProfile, DriverSubscription, useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const { currentUser, driverSubscription, drivers, orders, updateDriverAvailability } = useAppState();
  const availableCarsCount = drivers.filter(
    (driver) =>
      driver.status === 'approved' &&
      driver.isOnline &&
      driver.subscriptionStatus === 'active' &&
      driver.canReceiveOrders,
  ).length;
  const currentDriver =
    role === 'driver' && currentUser
      ? drivers.find((driver) => driver.userId === currentUser.id)
      : undefined;
  const hasActiveAccess =
    currentDriver?.subscriptionStatus === 'active' || driverSubscription.status === 'active';
  const canToggleLine = Boolean(currentDriver?.canReceiveOrders && hasActiveAccess);
  const driverStats = currentDriver
    ? createDriverStats(currentDriver, orders, driverSubscription)
    : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <PostRegistrationMenu
        availableCarsCount={availableCarsCount}
        driverStats={driverStats}
        driverLine={
          role === 'driver'
            ? {
                canToggle: canToggleLine,
                accessBlockers: currentDriver?.accessBlockers ?? [],
                isOnline: Boolean(currentDriver?.isOnline),
                status: currentDriver?.canReceiveOrders
                  ? 'Допущен к заказам'
                  : formatDriverAccessStatus(currentDriver),
              }
            : undefined
        }
        firstName={firstName}
        onBackToRegistration={() => navigation.navigate('Registration')}
        onToggleDriverLine={() => {
          if (!currentDriver || !canToggleLine) {
            return;
          }

          updateDriverAvailability(currentDriver.id, !currentDriver.isOnline);
        }}
        onOpenOrderFlow={() => navigation.navigate('OrderFlow', { firstName, role })}
        onOpenDriverDocuments={() => navigation.navigate('DriverDocuments', { firstName, role })}
        onOpenOrderHistory={() => navigation.navigate('OrderHistory', { firstName, role })}
        onOpenReferral={() => navigation.navigate('Referral', { firstName, role })}
        onOpenSavedPlace={() => navigation.navigate('SavedPlace', { firstName, role })}
        onOpenSubscription={() => navigation.navigate('Subscription', { firstName, role })}
        onOpenSupportChat={() => navigation.navigate('SupportChat', { firstName, role })}
        role={role}
      />
    </SafeAreaView>
  );
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
  const gross = monthOrders.reduce((sum, order) => sum + order.total, 0);
  const billingMode = driver.billingMode ?? subscription.billingMode;
  const commission = billingMode === 'commission' ? Math.round(gross * 0.12) : 0;
  const subscriptionCost = billingMode === 'monthly' ? subscription.monthlyPrice : 0;

  return {
    billingMode,
    commission,
    gross,
    monthOrders: monthOrders.length,
    payout: gross - commission,
    subscriptionCost,
    todayOrders: todayOrders.length,
    weekOrders: weekOrders.length,
  };
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F4F7F5',
    flex: 1,
  },
});
