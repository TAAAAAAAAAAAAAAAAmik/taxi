import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, StyleSheet } from 'react-native';

import { PostRegistrationMenu } from '../components/PostRegistrationMenu';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;

  return (
    <SafeAreaView style={styles.safeArea}>
      <PostRegistrationMenu
        firstName={firstName}
        onBackToRegistration={() => navigation.navigate('Registration')}
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
