import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { Navigation } from 'lucide-react-native';

import { AppNavigator } from './src/navigation/AppNavigator';
import { AppStateProvider } from './src/state/AppState';
import { useReducedMotionPreference } from './src/hooks/useReducedMotionPreference';

// Премиальный минимализм запуска: глубокий графит со светом за иконкой,
// тёмно-стеклянный значок с лайм-обводкой, благородная типографика и
// деликатный дуговой индикатор. Графит и лайм из токенов hero — переход
// в Welcome бесшовный.
const splashColors = {
  background: '#0A1411',
  brand: '#F4FBF7',
  lime: '#B7F46A',
  badgeFill: 'rgba(183, 244, 106, 0.06)',
  badgeBorder: 'rgba(183, 244, 106, 0.42)',
  badgeHighlight: 'rgba(255, 255, 255, 0.10)',
  glowInner: 'rgba(92, 230, 160, 0.16)',
  glowOuter: 'rgba(92, 230, 160, 0.06)',
  spinnerTrack: 'rgba(183, 244, 106, 0.16)',
  caption: 'rgba(159, 196, 178, 0.9)',
} as const;

export default function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  const handleSplashDone = useCallback(() => setSplashVisible(false), []);

  // Статичный boot-splash из index.html (виден, пока грузится бандл) гаснет,
  // как только React-сплэш с той же сценой смонтирован — стык невидим.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const boot = document.getElementById('kinetix-boot');

    if (!boot) {
      return;
    }

    boot.style.transition = 'opacity 260ms ease';
    boot.style.opacity = '0';
    const timer = setTimeout(() => boot.remove(), 320);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AppStateProvider>
      <StatusBar style="dark" />
      <AppNavigator />
      {splashVisible ? (
        <View style={styles.splashLayer}>
          <SalavatSplash onDone={handleSplashDone} />
        </View>
      ) : null}
    </AppStateProvider>
  );
}

function SalavatSplash({ onDone }: { onDone: () => void }) {
  const reducedMotion = useReducedMotionPreference();
  const badgeProgress = useRef(new Animated.Value(0)).current;
  const brandProgress = useRef(new Animated.Value(0)).current;
  const sloganProgress = useRef(new Animated.Value(0)).current;
  const breatheProgress = useRef(new Animated.Value(0)).current;
  const spinProgress = useRef(new Animated.Value(0)).current;
  const exitProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      badgeProgress.setValue(1);
      brandProgress.setValue(1);
      sloganProgress.setValue(1);

      const calm = Animated.sequence([
        Animated.delay(1200),
        Animated.timing(exitProgress, {
          duration: 480,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]);

      calm.start(({ finished }) => {
        if (finished) {
          onDone();
        }
      });

      return () => calm.stop();
    }

    // Едва заметное «дыхание» света за иконкой — премиальная живость.
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheProgress, {
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(breatheProgress, {
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    // Тонкая дуга-индикатор вращается, пока читается лого.
    const spin = Animated.loop(
      Animated.timing(spinProgress, {
        duration: 1000,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: true,
      }),
    );

    const intro = Animated.sequence([
      // Значок мягко «оседает» без отскока — сдержанно, дорого.
      Animated.timing(badgeProgress, {
        duration: 640,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.stagger(150, [
        Animated.timing(brandProgress, {
          duration: 560,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(sloganProgress, {
          duration: 480,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(900),
      Animated.timing(exitProgress, {
        duration: 500,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);

    breathe.start();
    spin.start();
    intro.start(({ finished }) => {
      breathe.stop();
      spin.stop();

      if (finished) {
        onDone();
      }
    });

    return () => {
      intro.stop();
      breathe.stop();
      spin.stop();
    };
  }, [badgeProgress, brandProgress, breatheProgress, exitProgress, onDone, reducedMotion, sloganProgress, spinProgress]);

  const splashOpacity = exitProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const splashScale = exitProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });
  const badgeOpacity = badgeProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 1],
  });
  const badgeScale = badgeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.86, 1],
  });
  const glowScale = breatheProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const glowOpacity = breatheProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
  });
  const brandOpacity = brandProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.9, 1],
  });
  const brandTranslate = brandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });
  const sloganOpacity = sloganProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const sloganTranslate = sloganProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });
  const spinRotate = spinProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const spinnerOpacity = Animated.multiply(
    sloganProgress,
    exitProgress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1, 0] }),
  );

  return (
    <Animated.View
      style={[
        styles.splash,
        {
          opacity: splashOpacity,
          transform: [{ scale: splashScale }],
        },
      ]}
    >
      <View style={styles.center}>
        <View style={styles.badgeWrap}>
          <Animated.View
            style={[
              styles.glowOuter,
              { opacity: glowOpacity, transform: [{ scale: glowScale }] },
            ]}
          />
          <Animated.View
            style={[
              styles.glowInner,
              { opacity: glowOpacity, transform: [{ scale: glowScale }] },
            ]}
          />
          <Animated.View
            style={[
              styles.badge,
              { opacity: badgeOpacity, transform: [{ scale: badgeScale }] },
            ]}
          >
            <View style={styles.badgeHighlight} />
            <Navigation color={splashColors.lime} fill={splashColors.lime} size={30} strokeWidth={2} />
          </Animated.View>
        </View>

        <Animated.Text
          style={[
            styles.brand,
            { opacity: brandOpacity, transform: [{ translateY: brandTranslate }] },
          ]}
        >
          Kinetix
        </Animated.Text>

        <Animated.Text
          style={[
            styles.caption,
            { opacity: sloganOpacity, transform: [{ translateY: sloganTranslate }] },
          ]}
        >
          ТАКСИ · ПАРТНЁР
        </Animated.Text>
      </View>

      <Animated.View style={[styles.spinner, { opacity: spinnerOpacity }]}>
        <Animated.View style={[styles.spinnerArc, { transform: [{ rotate: spinRotate }] }]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splashLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  splash: {
    alignItems: 'center',
    backgroundColor: splashColors.background,
    flex: 1,
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  badgeWrap: {
    alignItems: 'center',
    height: 82,
    justifyContent: 'center',
    marginBottom: 26,
    width: 82,
  },
  glowOuter: {
    backgroundColor: splashColors.glowOuter,
    borderRadius: 999,
    height: 220,
    position: 'absolute',
    width: 220,
  },
  glowInner: {
    backgroundColor: splashColors.glowInner,
    borderRadius: 999,
    height: 132,
    position: 'absolute',
    width: 132,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: splashColors.badgeFill,
    borderColor: splashColors.badgeBorder,
    borderRadius: 22,
    borderWidth: 1,
    height: 74,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: splashColors.lime,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    width: 74,
  },
  badgeHighlight: {
    backgroundColor: splashColors.badgeHighlight,
    borderRadius: 999,
    height: 60,
    left: -6,
    position: 'absolute',
    top: -34,
    width: 86,
  },
  brand: {
    color: splashColors.brand,
    fontSize: 33,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  caption: {
    color: splashColors.caption,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3.4,
    marginTop: 9,
  },
  spinner: {
    alignItems: 'center',
    bottom: 76,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    width: 22,
  },
  spinnerArc: {
    borderColor: splashColors.spinnerTrack,
    borderRadius: 999,
    borderTopColor: splashColors.lime,
    borderWidth: 2,
    height: 22,
    width: 22,
  },
});
