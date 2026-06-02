import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { BashkortostanEmblem } from './src/components/BashkortostanEmblem';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AppStateProvider } from './src/state/AppState';

export default function App() {
  const [splashVisible, setSplashVisible] = useState(true);

  return (
    <AppStateProvider>
      <StatusBar style="dark" />
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

  const cardOpacity = progress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 1, 1],
  });
  const cardTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });
  const barScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 1],
  });

  return (
    <View style={styles.splash}>
      <Animated.View
        style={[
          styles.splashCard,
          {
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslate }],
          },
        ]}
      >
        <BashkortostanEmblem size={132} />
        <Text style={styles.logo}>Такси Салават</Text>
        <Text style={styles.splashText}>Салаватский район · Республика Башкортостан</Text>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { transform: [{ scaleX: barScale }] }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    color: '#12382C',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 12,
  },
  progressFill: {
    backgroundColor: '#008D49',
    borderRadius: 999,
    height: 6,
    transformOrigin: 'left',
    width: '100%',
  },
  progressTrack: {
    backgroundColor: '#DCECE5',
    borderRadius: 999,
    height: 6,
    marginTop: 20,
    overflow: 'hidden',
    width: 190,
  },
  splash: {
    alignItems: 'center',
    backgroundColor: '#F4FAF6',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  splashCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 141, 73, 0.16)',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: '100%',
    maxWidth: 360,
  },
  splashText: {
    color: '#557669',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
});
