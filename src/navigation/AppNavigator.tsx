import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AdminPanelScreen } from '../screens/AdminPanelScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OrderFlowScreen } from '../screens/OrderFlowScreen';
import { OrderHistoryScreen } from '../screens/OrderHistoryScreen';
import { OrderStatusScreen } from '../screens/OrderStatusScreen';
import { RegistrationScreen } from '../screens/RegistrationScreen';
import { ReferralScreen } from '../screens/ReferralScreen';
import { SavedPlaceScreen } from '../screens/SavedPlaceScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { SupportChatScreen } from '../screens/SupportChatScreen';
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen';
import { VerifyPhoneScreen } from '../screens/VerifyPhoneScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const webOrigin =
  typeof window === 'undefined' || !window.location?.origin ? undefined : window.location.origin;
const linksOrigin = normalizeLinksOrigin(getPublicEnv('EXPO_PUBLIC_LINKS_DOMAIN') || 'links.example.com');

const linking: LinkingOptions<RootStackParamList> = {
  config: {
    screens: {
      AdminPanel: 'admin',
      Login: 'login',
      Registration: {
        parse: {
          referralCode: normalizeReferralCodeParam,
          role: normalizeRoleParam,
        },
        path: 'invite/:referralCode?',
      },
      Welcome: '',
    },
  },
  prefixes: [
    'taxipartner://',
    linksOrigin,
    ...(webOrigin ? [webOrigin] : []),
  ],
};

function normalizeReferralCodeParam(value: string) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-ZА-Я0-9]/g, '');
}

function normalizeRoleParam(value: string) {
  return value === 'driver' ? 'driver' : 'client';
}

function normalizeLinksOrigin(value: string) {
  const trimmedValue = value.trim().replace(/\/+$/, '');

  return /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;
}

function getPublicEnv(key: string) {
  const env = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return env.process?.env?.[key];
}

export function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: '#F4F7F5' },
          headerShown: false,
        }}
      >
        <Stack.Screen component={WelcomeScreen} name="Welcome" />
        <Stack.Screen component={LoginScreen} name="Login" />
        <Stack.Screen component={AdminPanelScreen} name="AdminPanel" />
        <Stack.Screen component={RegistrationScreen} name="Registration" />
        <Stack.Screen component={VerifyPhoneScreen} name="VerifyPhone" />
        <Stack.Screen component={VerifyEmailScreen} name="VerifyEmail" />
        <Stack.Screen component={DashboardScreen} name="Dashboard" />
        <Stack.Screen component={OrderFlowScreen} name="OrderFlow" />
        <Stack.Screen component={OrderStatusScreen} name="OrderStatus" />
        <Stack.Screen component={SubscriptionScreen} name="Subscription" />
        <Stack.Screen component={OrderHistoryScreen} name="OrderHistory" />
        <Stack.Screen component={SavedPlaceScreen} name="SavedPlace" />
        <Stack.Screen component={SupportChatScreen} name="SupportChat" />
        <Stack.Screen component={ReferralScreen} name="Referral" />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
