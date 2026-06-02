import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { AppNavigator } from './src/navigation/AppNavigator';
import { AppStateProvider } from './src/state/AppState';

export default function App() {
  const [splashVisible, setSplashVisible] = useState(true);

  return (
    <AppStateProvider>
      <StatusBar style="light" />
      {splashVisible ? <KinetixSplash onDone={() => setSplashVisible(false)} /> : <AppNavigator />}
    </AppStateProvider>
  );
}

function KinetixSplash({ onDone }: { onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      duration: 2500,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onDone();
      }
    });
  }, [onDone, progress]);

  const dotScale = progress.interpolate({
    inputRange: [0, 0.25, 0.45, 1],
    outputRange: [1, 12, 18, 22],
  });
  const ringOpacity = progress.interpolate({
    inputRange: [0, 0.18, 0.62, 1],
    outputRange: [0, 1, 1, 0],
  });
  const logoOpacity = progress.interpolate({
    inputRange: [0, 0.5, 0.72, 1],
    outputRange: [0, 0, 1, 1],
  });
  const logoTranslate = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [14, 14, 0],
  });
  const pulseScale = progress.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [0.3, 0.3, 3.2],
  });
  const pulseOpacity = progress.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [0, 0.45, 0],
  });

  return (
    <View style={styles.splash}>
      <Animated.View
        style={[
          styles.splashPulse,
          {
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.splashRing,
          {
            opacity: ringOpacity,
            transform: [{ scale: dotScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: logoOpacity,
            transform: [{ translateY: logoTranslate }],
          },
        ]}
      >
        <Text style={styles.logo}>Kinetix</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    color: '#F6C600',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splash: {
    alignItems: 'center',
    backgroundColor: '#0C0C0C',
    flex: 1,
    justifyContent: 'center',
  },
  splashPulse: {
    borderColor: '#F6C600',
    borderRadius: 120,
    borderWidth: 1,
    height: 160,
    position: 'absolute',
    width: 160,
  },
  splashRing: {
    backgroundColor: '#F6C600',
    borderRadius: 8,
    height: 16,
    position: 'absolute',
    width: 16,
  },
});
