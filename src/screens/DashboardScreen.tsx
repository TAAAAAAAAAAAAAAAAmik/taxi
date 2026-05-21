import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, StyleSheet } from 'react-native';

import { PostRegistrationMenu } from '../components/PostRegistrationMenu';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const { currentUser, drivers, updateDriverAvailability } = useAppState();
  const availableCarsCount = drivers.filter(
    (driver) => driver.status === 'approved' && driver.isOnline,
  ).length;
  const currentDriver =
    role === 'driver' && currentUser
      ? drivers.find((driver) => driver.userId === currentUser.id)
      : undefined;
  const canToggleLine = currentDriver?.status === 'approved';

  return (
    <SafeAreaView style={styles.safeArea}>
      <PostRegistrationMenu
        availableCarsCount={availableCarsCount}
        driverLine={
          role === 'driver'
            ? {
                canToggle: canToggleLine,
                isOnline: Boolean(currentDriver?.isOnline),
                status: currentDriver?.status ?? 'pending',
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
        onOpenOrderHistory={() => navigation.navigate('OrderHistory', { firstName, role })}
        onOpenSavedPlace={() => navigation.navigate('SavedPlace', { firstName, role })}
        onOpenSubscription={() => navigation.navigate('Subscription', { firstName, role })}
        onOpenSupportChat={() => navigation.navigate('SupportChat', { firstName, role })}
        role={role}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F4F7F5',
    flex: 1,
  },
});
