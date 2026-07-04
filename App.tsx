import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { AppNavigator } from './src/navigation/AppNavigator';
import { AppStateProvider } from './src/state/AppState';
import { useReducedMotionPreference } from './src/hooks/useReducedMotionPreference';

// Ночная сцена запуска: глубокий графит и лайм из premium-токенов hero.
// Сплэш и Welcome живут в одном мире — переход между ними бесшовный.
const splashColors = {
  background: '#0A1411',
  brand: '#F2FBF6',
  glow: 'rgba(92, 230, 160, 0.10)',
  guideLine: 'rgba(92, 230, 160, 0.07)',
  markerCore: '#0A1411',
  panel: 'rgba(255, 255, 255, 0.04)',
  panelBorder: 'rgba(92, 230, 160, 0.16)',
  route: '#B7F46A',
  routeGlow: 'rgba(183, 244, 106, 0.45)',
  routeSoft: 'rgba(183, 244, 106, 0.14)',
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
  const backgroundProgress = useRef(new Animated.Value(0)).current;
  const routeStartProgress = useRef(new Animated.Value(0)).current;
  const routeTurnProgress = useRef(new Animated.Value(0)).current;
  const routeEndProgress = useRef(new Animated.Value(0)).current;
  const markerProgress = useRef(new Animated.Value(0)).current;
  const pulseProgress = useRef(new Animated.Value(0)).current;
  const brandProgress = useRef(new Animated.Value(0)).current;
  const sloganProgress = useRef(new Animated.Value(0)).current;
  const exitProgress = useRef(new Animated.Value(0)).current;
  // Светящаяся «фара» едет по маршруту от старта к пину, ведя кончик линии —
  // motion объясняет продукт: такси проходит маршрут. Синхронна с прорисовкой.
  const driveProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      // Reduced-motion = меньше и мягче движения, а не мгновенный кадр.
      // Маршрут показываем сразу целиком (без «езды»), но сцену спокойно
      // проявляем и держим, чтобы не мелькала как слайд-шоу.
      routeStartProgress.setValue(1);
      routeTurnProgress.setValue(1);
      routeEndProgress.setValue(1);
      markerProgress.setValue(1);
      driveProgress.setValue(1);

      const calm = Animated.sequence([
        Animated.timing(backgroundProgress, {
          duration: 460,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(brandProgress, {
          duration: 520,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(sloganProgress, {
          duration: 420,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.delay(1100),
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

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseProgress, {
          duration: 1180,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulseProgress, {
          duration: 0,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    const intro = Animated.sequence([
      Animated.timing(backgroundProgress, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(routeStartProgress, {
            duration: 900,
            easing: Easing.bezier(0.2, 0, 0, 1),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(routeTurnProgress, {
            duration: 620,
            easing: Easing.inOut(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(routeEndProgress, {
            duration: 900,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(1520),
          Animated.timing(markerProgress, {
            duration: 560,
            easing: Easing.out(Easing.back(1.35)),
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
        // Фара едет ровно за прорисовкой линии (900+620+900 = 2420мс),
        // сегментные скорости заданы точками inputRange в carX/carY.
        Animated.timing(driveProgress, {
          duration: 2420,
          easing: Easing.linear,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(160, [
        Animated.timing(brandProgress, {
          duration: 720,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(sloganProgress, {
          duration: 640,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(760),
      Animated.timing(exitProgress, {
        duration: 520,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);

    pulseLoop.start();
    intro.start(({ finished }) => {
      pulseLoop.stop();

      if (finished) {
        onDone();
      }
    });

    return () => {
      intro.stop();
      pulseLoop.stop();
    };
  }, [
    backgroundProgress,
    brandProgress,
    exitProgress,
    driveProgress,
    markerProgress,
    onDone,
    pulseProgress,
    reducedMotion,
    routeEndProgress,
    routeStartProgress,
    routeTurnProgress,
    sloganProgress,
  ]);

  const splashOpacity = exitProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const splashTranslate = exitProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  });
  const backdropOpacity = backgroundProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const backdropTranslate = backgroundProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const routeStartScale = routeStartProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.02, 1],
  });
  const routeTurnScale = routeTurnProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.02, 1],
  });
  const routeEndScale = routeEndProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.02, 1],
  });
  // Путь фары по центрам сегментов маршрута (top-left с учётом размера 14):
  // старт → угол1 → угол2 → пин. Точки inputRange = доли 520/360/520 от 1400мс.
  const carTranslateX = driveProgress.interpolate({
    inputRange: [0, 0.371, 0.629, 1],
    outputRange: [37, 167, 167, 269],
  });
  const carTranslateY = driveProgress.interpolate({
    inputRange: [0, 0.371, 0.629, 1],
    outputRange: [139, 139, 71, 73],
  });
  const carOpacity = driveProgress.interpolate({
    inputRange: [0, 0.05, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  });
  const markerOpacity = markerProgress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 1, 1],
  });
  const markerScale = markerProgress.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [0.42, 1.12, 1],
  });
  const pulseOpacity = pulseProgress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.28, 0.08, 0],
  });
  const pulseScale = pulseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.55],
  });
  const brandOpacity = brandProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.85, 1],
  });
  const brandTranslate = brandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const sloganOpacity = sloganProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.75, 1],
  });
  const sloganTranslate = sloganProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  return (
    <Animated.View
      style={[
        styles.splash,
        {
          opacity: splashOpacity,
          transform: [{ translateY: splashTranslate }],
        },
      ]}
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <View style={[styles.glowBlob, styles.glowBlobTop]} />
        <View style={[styles.glowBlob, styles.glowBlobBottom]} />
        <Animated.View
          style={[
            styles.backdropPanel,
            styles.backdropPanelTop,
            { transform: [{ translateY: backdropTranslate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.backdropPanel,
            styles.backdropPanelBottom,
            { transform: [{ translateY: backdropTranslate }] },
          ]}
        />
        <View style={[styles.gridLine, styles.gridLineOne]} />
        <View style={[styles.gridLine, styles.gridLineTwo]} />
        <View style={[styles.gridLine, styles.gridLineThree]} />
      </Animated.View>

      <View style={styles.introStage}>
        <View style={styles.routeScene}>
          <View style={[styles.routeAnchor, styles.routeAnchorStart]} />
          <Animated.View
            style={[
              styles.routeSegment,
              styles.routeSegmentStart,
              { transform: [{ scaleX: routeStartScale }] },
            ]}
          />
          <Animated.View
            style={[
              styles.routeSegment,
              styles.routeSegmentTurn,
              { transform: [{ scaleY: routeTurnScale }] },
            ]}
          />
          <Animated.View
            style={[
              styles.routeSegment,
              styles.routeSegmentEnd,
              { transform: [{ scaleX: routeEndScale }] },
            ]}
          />
          <Animated.View
            style={[
              styles.cometGroup,
              {
                opacity: carOpacity,
                transform: [{ translateX: carTranslateX }, { translateY: carTranslateY }],
              },
            ]}
          >
            <View style={styles.cometHalo} />
            <View style={styles.cometGlow} />
            <View style={styles.cometCore}>
              <View style={styles.cometSpark} />
            </View>
          </Animated.View>
          <Animated.View
            style={[
              styles.markerCluster,
              {
                opacity: markerOpacity,
                transform: [{ scale: markerScale }],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.markerPulse,
                {
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                },
              ]}
            />
            <View style={styles.markerPin}>
              <View style={styles.markerCore} />
            </View>
            <View style={styles.markerStem} />
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.brandBlock,
            {
              opacity: brandOpacity,
              transform: [{ translateY: brandTranslate }],
            },
          ]}
        >
          <Text style={styles.logoKinetix}>Kinetix</Text>
          <Text style={styles.logoPartner}>Такси Партнер</Text>
        </Animated.View>

        <Animated.Text
          style={[
            styles.splashText,
            {
              opacity: sloganOpacity,
              transform: [{ translateY: sloganTranslate }],
            },
          ]}
        >
          Такси и доставка для Салаватского района
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  backdropPanel: {
    backgroundColor: splashColors.panel,
    borderColor: splashColors.panelBorder,
    borderRadius: 8,
    borderWidth: 1,
    height: 178,
    position: 'absolute',
    width: 280,
  },
  backdropPanelBottom: {
    bottom: 82,
    right: -110,
    transform: [{ rotate: '-10deg' }],
  },
  backdropPanelTop: {
    left: -104,
    top: 72,
    transform: [{ rotate: '-10deg' }],
  },
  brandBlock: {
    alignItems: 'center',
    marginTop: 28,
  },
  // Едет одним transform-узлом без box-shadow (тень на движущемся объекте
  // роняет FPS в вебе). Свечение — концентрические круги на backgroundColor,
  // они композитятся на GPU и не требуют перерисовки при движении.
  cometGroup: {
    alignItems: 'center',
    height: 14,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
    width: 14,
  },
  cometHalo: {
    backgroundColor: 'rgba(183, 244, 106, 0.12)',
    borderRadius: 999,
    height: 40,
    left: -13,
    position: 'absolute',
    top: -13,
    width: 40,
  },
  cometGlow: {
    backgroundColor: 'rgba(183, 244, 106, 0.34)',
    borderRadius: 999,
    height: 24,
    left: -5,
    position: 'absolute',
    top: -5,
    width: 24,
  },
  cometCore: {
    alignItems: 'center',
    backgroundColor: splashColors.route,
    borderRadius: 999,
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
  cometSpark: {
    backgroundColor: '#F2FBF6',
    borderRadius: 999,
    height: 5,
    width: 5,
  },
  glowBlob: {
    backgroundColor: splashColors.glow,
    borderRadius: 999,
    height: 260,
    position: 'absolute',
    width: 260,
  },
  glowBlobBottom: {
    bottom: -90,
    left: -80,
  },
  glowBlobTop: {
    right: -70,
    top: -60,
  },
  gridLine: {
    backgroundColor: splashColors.guideLine,
    height: 1,
    position: 'absolute',
    width: '120%',
  },
  gridLineOne: {
    top: '30%',
    transform: [{ rotate: '-10deg' }],
  },
  gridLineThree: {
    top: '70%',
    transform: [{ rotate: '-10deg' }],
  },
  gridLineTwo: {
    top: '50%',
    transform: [{ rotate: '-10deg' }],
  },
  introStage: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 380,
    width: '100%',
  },
  logoKinetix: {
    color: splashColors.brand,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 44,
  },
  logoPartner: {
    color: splashColors.secondaryText,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 22,
    marginTop: 2,
  },
  markerCluster: {
    alignItems: 'center',
    height: 62,
    justifyContent: 'center',
    position: 'absolute',
    right: 30,
    top: 50,
    width: 62,
  },
  markerCore: {
    backgroundColor: splashColors.markerCore,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  markerPin: {
    alignItems: 'center',
    backgroundColor: splashColors.route,
    borderColor: splashColors.markerCore,
    borderRadius: 999,
    borderWidth: 2,
    height: 26,
    justifyContent: 'center',
    shadowColor: splashColors.routeGlow,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 16,
    width: 26,
  },
  markerPulse: {
    backgroundColor: splashColors.routeSoft,
    borderColor: splashColors.panelBorder,
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    position: 'absolute',
    width: 38,
  },
  markerStem: {
    backgroundColor: splashColors.route,
    borderRadius: 999,
    height: 10,
    marginTop: -2,
    width: 3,
  },
  routeAnchor: {
    backgroundColor: splashColors.markerCore,
    borderColor: splashColors.route,
    borderRadius: 999,
    borderWidth: 3,
    height: 18,
    position: 'absolute',
    width: 18,
  },
  routeAnchorStart: {
    left: 28,
    top: 136,
  },
  routeScene: {
    height: 230,
    maxWidth: 340,
    position: 'relative',
    width: '100%',
  },
  routeSegment: {
    backgroundColor: splashColors.route,
    borderRadius: 999,
    position: 'absolute',
  },
  routeSegmentEnd: {
    height: 4,
    right: 58,
    top: 76,
    transformOrigin: 'left',
    width: 124,
  },
  routeSegmentStart: {
    height: 4,
    left: 42,
    top: 144,
    transformOrigin: 'left',
    width: 132,
  },
  routeSegmentTurn: {
    height: 72,
    left: 172,
    top: 76,
    transformOrigin: 'top',
    width: 4,
  },
  splash: {
    alignItems: 'center',
    backgroundColor: splashColors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  splashLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  splashText: {
    color: splashColors.secondaryText,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 14,
    maxWidth: 280,
    textAlign: 'center',
  },
});
