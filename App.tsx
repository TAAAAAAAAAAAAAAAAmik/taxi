import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Navigation } from 'lucide-react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { AppNavigator } from './src/navigation/AppNavigator';
import { AppStateProvider } from './src/state/AppState';
import { useReducedMotionPreference } from './src/hooks/useReducedMotionPreference';

// Кинематографичный запуск: ночная сцена-карта с градиентной виньеткой и
// городскими огнями, радар-пульс поиска машины из центра и премиальный
// тёмно-стеклянный значок. Графит и лайм из токенов hero — переход в
// Welcome бесшовный.
const splashColors = {
  background: '#0A1411',
  brand: '#F4FBF7',
  lime: '#B7F46A',
  mint: '#5CE6A0',
  badgeFill: 'rgba(183, 244, 106, 0.06)',
  badgeBorder: 'rgba(183, 244, 106, 0.42)',
  badgeHighlight: 'rgba(255, 255, 255, 0.10)',
  ring: 'rgba(183, 244, 106, 0.5)',
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

    boot.style.transition = 'opacity 520ms ease';
    boot.style.opacity = '0';
    const timer = setTimeout(() => boot.remove(), 560);
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

const RADAR_COUNT = 3;

function SalavatSplash({ onDone }: { onDone: () => void }) {
  const reducedMotion = useReducedMotionPreference();
  const { width, height } = useWindowDimensions();

  const badgeProgress = useRef(new Animated.Value(0)).current;
  const brandProgress = useRef(new Animated.Value(0)).current;
  const sloganProgress = useRef(new Animated.Value(0)).current;
  const sceneProgress = useRef(new Animated.Value(0)).current;
  const breatheProgress = useRef(new Animated.Value(0)).current;
  const exitProgress = useRef(new Animated.Value(0)).current;
  const radars = useRef(
    Array.from({ length: RADAR_COUNT }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    // Сцена, значок и бренд показываются сразу — React принимает эстафету от
    // статичного boot-splash в том же кадре, поэтому появление не «переигрывается»
    // (иначе значок/лого моргают: полная картинка boot → пропала → появилась
    // снова в React). Живут поверх только радар и дыхание света.
    sceneProgress.setValue(1);
    badgeProgress.setValue(1);
    brandProgress.setValue(1);
    sloganProgress.setValue(1);

    if (reducedMotion) {
      const calm = Animated.sequence([
        Animated.delay(1300),
        Animated.timing(exitProgress, {
          duration: 760,
          easing: Easing.inOut(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]);

      calm.start(({ finished }) => finished && onDone());
      return () => calm.stop();
    }

    // Радар-пульс: кольца бесконечно расходятся из центра со сдвигом фазы —
    // мотив «ищем машину рядом». Только transform+opacity, идёт гладко.
    const radarLoops = radars.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 1200),
          Animated.timing(value, {
            duration: 3600,
            easing: Easing.inOut(Easing.sin),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(value, { duration: 0, toValue: 0, useNativeDriver: true }),
        ]),
      ),
    );

    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheProgress, {
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(breatheProgress, {
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    // Держим кадр (радар пульсирует, свет дышит), затем долгий мягкий выход
    // (ease-in-out) — сплэш плавно растворяется в приложении, без рывка.
    const intro = Animated.sequence([
      Animated.delay(2000),
      Animated.timing(exitProgress, {
        duration: 820,
        easing: Easing.inOut(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);

    radarLoops.forEach((loop) => loop.start());
    breathe.start();
    intro.start(({ finished }) => {
      radarLoops.forEach((loop) => loop.stop());
      breathe.stop();
      if (finished) {
        onDone();
      }
    });

    return () => {
      intro.stop();
      breathe.stop();
      radarLoops.forEach((loop) => loop.stop());
    };
  }, [
    badgeProgress,
    brandProgress,
    breatheProgress,
    exitProgress,
    onDone,
    radars,
    reducedMotion,
    sceneProgress,
    sloganProgress,
  ]);

  const splashOpacity = exitProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  // Едва заметный зум на выходе — «раскрытие в приложение» без резкого прыжка.
  const splashScale = exitProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  const sceneOpacity = sceneProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const badgeOpacity = badgeProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] });
  const badgeScale = badgeProgress.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });
  const glowOpacity = breatheProgress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const glowScale = breatheProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const brandOpacity = brandProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.9, 1] });
  const brandTranslate = brandProgress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const sloganOpacity = sloganProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const sloganTranslate = sloganProgress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  const scene = useMemo(() => buildScene(width, height), [width, height]);

  return (
    <Animated.View
      style={[styles.splash, { opacity: splashOpacity, transform: [{ scale: splashScale }] }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: sceneOpacity }]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${scene.w} ${scene.h}`} preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="bg" cx="50%" cy="42%" r="78%">
              <Stop offset="0" stopColor="#12271E" />
              <Stop offset="0.55" stopColor="#0A1411" />
              <Stop offset="1" stopColor="#050D09" />
            </RadialGradient>
            <RadialGradient id="glow" cx="50%" cy="42%" r="30%">
              <Stop offset="0" stopColor={splashColors.mint} stopOpacity="0.16" />
              <Stop offset="1" stopColor={splashColors.mint} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          <Rect x="0" y="0" width={scene.w} height={scene.h} fill="url(#bg)" />
          <Rect x="0" y="0" width={scene.w} height={scene.h} fill="url(#glow)" />

          {scene.streets.map((s, i) => (
            <Line
              key={`st-${i}`}
              stroke={splashColors.mint}
              strokeOpacity={s.o}
              strokeWidth={s.w}
              x1={s.x1}
              x2={s.x2}
              y1={s.y1}
              y2={s.y2}
            />
          ))}

          <Path
            d={scene.route}
            fill="none"
            stroke={splashColors.lime}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.28}
            strokeWidth={2}
          />
          <Circle cx={scene.routeStart.x} cy={scene.routeStart.y} fill="#0A1411" r={5} stroke={splashColors.lime} strokeOpacity={0.6} strokeWidth={2} />
          <Circle cx={scene.routeEnd.x} cy={scene.routeEnd.y} fill={splashColors.lime} fillOpacity={0.7} r={4} />

          {scene.lights.map((p, i) => (
            <Circle key={`lt-${i}`} cx={p.x} cy={p.y} fill={splashColors.mint} fillOpacity={p.o} r={p.r} />
          ))}
        </Svg>
      </Animated.View>

      <View style={styles.center}>
        <View style={styles.badgeWrap}>
          {radars.map((value, index) => {
            const scale = value.interpolate({ inputRange: [0, 1], outputRange: [0.75, 3] });
            const opacity = value.interpolate({ inputRange: [0, 0.2, 0.75, 1], outputRange: [0, 0.34, 0.12, 0] });
            return (
              <Animated.View
                key={`radar-${index}`}
                style={[styles.radar, { opacity, transform: [{ scale }] }]}
              />
            );
          })}
          <Animated.View style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
          <Animated.View
            style={[styles.badge, { opacity: badgeOpacity, transform: [{ scale: badgeScale }] }]}
          >
            <View style={styles.badgeHighlight} />
            <Navigation color={splashColors.lime} fill={splashColors.lime} size={30} strokeWidth={2} />
          </Animated.View>
        </View>

        <Animated.Text
          style={[styles.brand, { opacity: brandOpacity, transform: [{ translateY: brandTranslate }] }]}
        >
          Kinetix
        </Animated.Text>
        <Animated.Text
          style={[styles.caption, { opacity: sloganOpacity, transform: [{ translateY: sloganTranslate }] }]}
        >
          ТАКСИ · ПАРТНЁР
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

// Детерминированная (без random-мерцания между кадрами) генерация сцены:
// диагональные улицы, короткий маршрут и рассыпанные городские огни.
function buildScene(width: number, height: number) {
  const w = Math.max(320, Math.round(width));
  const h = Math.max(560, Math.round(height));
  const cx = w / 2;

  const streets = [
    { x1: -40, y1: h * 0.26, x2: w + 40, y2: h * 0.2, o: 0.06, w: 1 },
    { x1: -40, y1: h * 0.44, x2: w + 40, y2: h * 0.36, o: 0.05, w: 1 },
    { x1: -40, y1: h * 0.62, x2: w + 40, y2: h * 0.54, o: 0.06, w: 1 },
    { x1: -40, y1: h * 0.8, x2: w + 40, y2: h * 0.72, o: 0.05, w: 1 },
    { x1: w * 0.24, y1: -40, x2: w * 0.16, y2: h + 40, o: 0.04, w: 1 },
    { x1: w * 0.72, y1: -40, x2: w * 0.8, y2: h + 40, o: 0.04, w: 1 },
  ];

  // Короткий маршрут-деталь в нижней трети, под подписью.
  const ry = h * 0.72;
  const routeStart = { x: cx - 96, y: ry };
  const corner = { x: cx + 8, y: ry };
  const up = { x: cx + 8, y: ry - 54 };
  const routeEnd = { x: cx + 92, y: ry - 54 };
  const route = `M ${routeStart.x} ${routeStart.y} L ${corner.x} ${corner.y} L ${up.x} ${up.y} L ${routeEnd.x} ${routeEnd.y}`;

  const lightSeeds = [
    [0.14, 0.18], [0.86, 0.12], [0.32, 0.1], [0.68, 0.24], [0.08, 0.5],
    [0.92, 0.46], [0.2, 0.86], [0.8, 0.9], [0.5, 0.08], [0.4, 0.9],
    [0.12, 0.68], [0.9, 0.7], [0.6, 0.86], [0.26, 0.6],
  ];
  const lights = lightSeeds.map(([fx, fy], i) => ({
    x: Math.round(fx * w),
    y: Math.round(fy * h),
    r: i % 3 === 0 ? 1.6 : 1.1,
    o: i % 4 === 0 ? 0.5 : 0.28,
  }));

  return { w, h, streets, route, routeStart, routeEnd, lights };
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
  radar: {
    borderColor: splashColors.ring,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 82,
    position: 'absolute',
    width: 82,
  },
  glow: {
    backgroundColor: 'rgba(92, 230, 160, 0.16)',
    borderRadius: 999,
    height: 150,
    position: 'absolute',
    width: 150,
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
});
