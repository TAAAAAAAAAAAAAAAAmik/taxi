import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { Navigation } from 'lucide-react-native';

import { AppNavigator } from './src/navigation/AppNavigator';
import { AppStateProvider } from './src/state/AppState';
import { useReducedMotionPreference } from './src/hooks/useReducedMotionPreference';

// Минималистичный запуск в духе Яндекс Go: спокойный тёмный экран, крупный
// фирменный значок и лого по центру, тонкий индикатор загрузки снизу.
// Графит и лайм из premium-токенов hero — переход в Welcome бесшовный.
const splashColors = {
  background: '#0A1411',
  brand: '#F2FBF6',
  glow: 'rgba(92, 230, 160, 0.12)',
  lime: '#B7F46A',
  graphite: '#0A1411',
  track: 'rgba(183, 244, 106, 0.16)',
  secondaryText: '#93BAA8',
} as const;

export default function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  const handleSplashDone = useCallback(() => setSplashVisible(false), []);

  // Статичный boot-splash из index.html (виден, пока грузится бандл) гаснет,
  // как только React-сплэш с той же тёмной сценой смонтирован — стык невидим.
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
  const loaderProgress = useRef(new Animated.Value(0)).current;
  const exitProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      // Reduced-motion: контент показываем сразу, но даём спокойный beat
      // загрузки и выдержку, чтобы экран не мелькал.
      badgeProgress.setValue(1);
      brandProgress.setValue(1);
      sloganProgress.setValue(1);

      const calm = Animated.sequence([
        Animated.timing(loaderProgress, {
          duration: 900,
          easing: Easing.linear,
          toValue: 1,
          useNativeDriver: false,
        }),
        Animated.delay(560),
        Animated.timing(exitProgress, {
          duration: 460,
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

    const intro = Animated.sequence([
      // Значок «влетает» лёгким пружинным масштабом — как иконка приложения.
      Animated.timing(badgeProgress, {
        duration: 560,
        easing: Easing.out(Easing.back(1.4)),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.stagger(150, [
          Animated.timing(brandProgress, {
            duration: 520,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(sloganProgress, {
            duration: 440,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
        // Тонкая полоса загрузки заполняется, пока читается лого.
        Animated.timing(loaderProgress, {
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          toValue: 1,
          useNativeDriver: false,
        }),
      ]),
      Animated.delay(240),
      // Выход: короткий «зум в приложение» (как раскрытие иконки в интерфейс).
      Animated.timing(exitProgress, {
        duration: 480,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);

    intro.start(({ finished }) => {
      if (finished) {
        onDone();
      }
    });

    return () => intro.stop();
  }, [badgeProgress, brandProgress, exitProgress, loaderProgress, onDone, reducedMotion, sloganProgress]);

  const splashOpacity = exitProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const splashScale = exitProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const badgeOpacity = badgeProgress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 1, 1],
  });
  const badgeScale = badgeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1],
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
  const loaderScaleX = loaderProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const loaderOpacity = exitProgress.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [1, 1, 0],
  });

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
        <Animated.View
          style={[
            styles.badge,
            {
              opacity: badgeOpacity,
              transform: [{ scale: badgeScale }],
            },
          ]}
        >
          <View style={styles.badgeGlow} />
          <Navigation color={splashColors.graphite} fill={splashColors.graphite} size={30} strokeWidth={2} />
        </Animated.View>

        <Animated.Text
          style={[
            styles.brand,
            {
              opacity: brandOpacity,
              transform: [{ translateY: brandTranslate }],
            },
          ]}
        >
          Kinetix
        </Animated.Text>

        <Animated.Text
          style={[
            styles.sub,
            {
              opacity: sloganOpacity,
              transform: [{ translateY: sloganTranslate }],
            },
          ]}
        >
          Такси Партнёр
        </Animated.Text>
      </View>

      <Animated.View style={[styles.loaderTrack, { opacity: loaderOpacity }]}>
        <Animated.View style={[styles.loaderFill, { transform: [{ scaleX: loaderScaleX }] }]} />
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
  badge: {
    alignItems: 'center',
    backgroundColor: splashColors.lime,
    borderRadius: 22,
    height: 72,
    justifyContent: 'center',
    marginBottom: 24,
    width: 72,
  },
  badgeGlow: {
    backgroundColor: splashColors.glow,
    borderRadius: 999,
    height: 150,
    position: 'absolute',
    width: 150,
    zIndex: -1,
  },
  brand: {
    color: splashColors.brand,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  sub: {
    color: splashColors.secondaryText,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 6,
  },
  loaderTrack: {
    backgroundColor: splashColors.track,
    borderRadius: 999,
    bottom: 72,
    height: 3,
    overflow: 'hidden',
    position: 'absolute',
    width: 128,
  },
  loaderFill: {
    backgroundColor: splashColors.lime,
    borderRadius: 999,
    height: 3,
    transformOrigin: 'left',
    width: '100%',
  },
});
