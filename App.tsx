import { StatusBar } from 'expo-status-bar';

import { AppNavigator } from './src/navigation/AppNavigator';
import { AppStateProvider } from './src/state/AppState';

export default function App() {
  return (
    <AppStateProvider>
      <StatusBar style="dark" />
      <AppNavigator />
    </AppStateProvider>
  );
}
