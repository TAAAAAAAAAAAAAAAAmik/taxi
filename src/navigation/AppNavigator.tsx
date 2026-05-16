import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AdminPanelScreen } from '../screens/AdminPanelScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OrderFlowScreen } from '../screens/OrderFlowScreen';
import { OrderHistoryScreen } from '../screens/OrderHistoryScreen';
import { OrderStatusScreen } from '../screens/OrderStatusScreen';
import { RegistrationScreen } from '../screens/RegistrationScreen';
import { SavedPlaceScreen } from '../screens/SavedPlaceScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { SupportChatScreen } from '../screens/SupportChatScreen';
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen';
import { VerifyPhoneScreen } from '../screens/VerifyPhoneScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
