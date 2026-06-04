import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DriverStatsSummary, PostRegistrationMenu } from '../components/PostRegistrationMenu';
import { AccountRole, isDriverLikeRole, isParkDriverRole, isSelfEmployedDriverRole } from '../data/registration';
import { driverAccessPlans } from '../data/subscription';
import { RootStackParamList } from '../navigation/types';
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
    realtimeMessage,
    realtimeStatus,
    realtimeUpdatedAt,
    logoutAccount,
    requestVerificationCode,
    updateDriverAvailability,
    verifyContactCode,
    setSimpleMode,
    simpleMode,
  } = useAppState();
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteFlowOpen, setDeleteFlowOpen] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const isDriverRole = isDriverLikeRole(role);
  const isSelfEmployedDriver = isSelfEmployedDriverRole(role);
  const fleetInviteCode =
    role === 'park_admin'
      ? createFleetInviteCode(currentUser?.id || currentUser?.email || firstName || 'salavat')
      : undefined;
  const availableCarsCount = drivers.filter(
    (driver) =>
      driver.status === 'approved' &&
      driver.isOnline &&
      driver.subscriptionStatus === 'active' &&
      driver.canReceiveOrders,
  ).length;
  const currentDriver =
    isDriverRole && currentUser
      ? drivers.find((driver) => driver.userId === currentUser.id)
      : undefined;
  const hasActiveAccess =
    currentDriver?.subscriptionStatus === 'active' ||
    (!isSelfEmployedDriver && Boolean(currentDriver?.canReceiveOrders)) ||
    driverSubscription.status === 'active';
  const canToggleLine = Boolean(currentDriver?.canReceiveOrders && hasActiveAccess);
  const driverStats = currentDriver
    ? createDriverStats(currentDriver, orders, driverSubscription, role)
    : undefined;
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
        driverStats={driverStats}
        driverLine={
          isDriverRole
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
        fleetInviteCode={fleetInviteCode}
        simpleMode={simpleMode}
        realtimeMessage={realtimeMessage}
        realtimeStatus={realtimeStatus}
        realtimeUpdatedAt={realtimeUpdatedAt}
        onBackToRegistration={() => navigation.navigate('Registration')}
        onDeleteAccount={confirmDeleteAccount}
        onToggleDriverLine={() => {
          if (!currentDriver || !canToggleLine) {
            return;
          }

          updateDriverAvailability(currentDriver.id, !currentDriver.isOnline);
        }}
        onOpenOrderFlow={() => navigation.navigate('OrderFlow', { firstName, role })}
        onOpenDriverDocuments={() => navigation.navigate('DriverDocuments', { firstName, role })}
        onOpenFleetDriverRegistration={() =>
          navigation.navigate('Registration', {
            referralCode: fleetInviteCode,
            role: 'park_driver',
          })
        }
        onOpenOrderHistory={() => navigation.navigate('OrderHistory', { firstName, role })}
        onOpenReferral={() => navigation.navigate('Referral', { firstName, role })}
        onOpenSavedPlace={() => navigation.navigate('SavedPlace', { firstName, role })}
        onOpenSubscription={() => navigation.navigate('Subscription', { firstName, role })}
        onOpenSupportChat={() => navigation.navigate('SupportChat', { firstName, role })}
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
  role: AccountRole,
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
  const serviceShareRate = isParkDriverRole(role) ? 0 : driverAccessPlans[billingMode].commissionPercent;
  const gross = monthOrders.reduce((sum, order) => sum + getDriverCollectedAmount(order), 0);
  const serviceShare = monthOrders.reduce(
    (sum, order) => sum + getOrderServiceShareAmount(order, serviceShareRate),
    0,
  );
  const serviceShareToday = todayOrders.reduce(
    (sum, order) => sum + getOrderServiceShareAmount(order, serviceShareRate),
    0,
  );
  const subscriptionCost =
    !isParkDriverRole(role) && billingMode === 'monthly' ? subscription.monthlyPrice : 0;

  return {
    billingMode,
    driverNet: gross - serviceShare,
    gross,
    monthOrders: monthOrders.length,
    serviceShare,
    serviceShareRate,
    serviceShareToday,
    subscriptionCost,
    todayOrders: todayOrders.length,
    weekOrders: weekOrders.length,
  };
}

function getDriverCollectedAmount(order: AppOrder) {
  return typeof order.driverCollectedAmount === 'number' ? order.driverCollectedAmount : order.total;
}

function getOrderServiceShareAmount(order: AppOrder, fallbackRate: number) {
  if (typeof order.serviceShareAmount === 'number') {
    return order.serviceShareAmount;
  }

  const rate = typeof order.serviceShareRate === 'number' ? order.serviceShareRate : fallbackRate;

  return Math.round((getDriverCollectedAmount(order) * rate) / 100);
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
