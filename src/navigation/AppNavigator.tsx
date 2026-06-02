import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AdminPanelScreen } from '../screens/AdminPanelScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DriverDocumentsScreen } from '../screens/DriverDocumentsScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OrderFlowScreen } from '../screens/OrderFlowScreen';
import { OrderHistoryScreen } from '../screens/OrderHistoryScreen';
import { OrderStatusScreen } from '../screens/OrderStatusScreen';
import { PasswordResetScreen } from '../screens/PasswordResetScreen';
import { RegistrationScreen } from '../screens/RegistrationScreen';
import { ReferralScreen } from '../screens/ReferralScreen';
import { SavedPlaceScreen } from '../screens/SavedPlaceScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { SupportChatScreen } from '../screens/SupportChatScreen';
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen';
import { VerifyPhoneScreen } from '../screens/VerifyPhoneScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { getPublicEnv, normalizePublicOrigin } from '../utils/runtimeFlags';
import { normalizeAccountRole } from '../data/registration';
import { kinetixColors } from '../theme/kinetixTokens';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const webOrigin =
  typeof window === 'undefined' || !window.location?.origin ? undefined : window.location.origin;
const webBasePath = normalizeWebBasePath(getPublicEnv('EXPO_PUBLIC_WEB_BASE_PATH'));
const webBaseOrigin = webOrigin && webBasePath ? `${webOrigin}${webBasePath}` : undefined;
const linksOrigin = normalizePublicOrigin(getPublicEnv('EXPO_PUBLIC_LINKS_DOMAIN'));

const linking: LinkingOptions<RootStackParamList> = {
  config: {
    screens: {
      AdminPanel: 'admin',
      Login: 'login',
      PasswordReset: 'password-reset',
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
    ...(linksOrigin ? [linksOrigin] : []),
    ...(webBaseOrigin ? [webBaseOrigin] : []),
    ...(webOrigin ? [webOrigin] : []),
  ],
};

function normalizeWebBasePath(value: string | undefined) {
  const rawPath = String(value || '').trim().replace(/^\/+|\/+$/g, '');

  return rawPath ? `/${rawPath}` : '';
}

function normalizeReferralCodeParam(value: string) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-ZА-Я0-9]/g, '');
}

function normalizeRoleParam(value: string) {
  return normalizeAccountRole(value);
}

export function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          animation: 'fade_from_bottom',
          contentStyle: { backgroundColor: kinetixColors.graphite },
          headerShown: false,
        }}
      >
        <Stack.Screen component={WelcomeScreen} name="Welcome" />
        <Stack.Screen component={LoginScreen} name="Login" />
        <Stack.Screen component={PasswordResetScreen} name="PasswordReset" />
        <Stack.Screen component={AdminPanelScreen} name="AdminPanel" />
        <Stack.Screen component={RegistrationScreen} name="Registration" />
        <Stack.Screen component={VerifyPhoneScreen} name="VerifyPhone" />
        <Stack.Screen component={VerifyEmailScreen} name="VerifyEmail" />
        <Stack.Screen component={DashboardScreen} name="Dashboard" />
        <Stack.Screen component={DriverDocumentsScreen} name="DriverDocuments" />
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
