import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { AppNavigator } from './src/navigation/AppNavigator';
import { AppStateProvider } from './src/state/AppState';
import { kinetixColors } from './src/theme/kinetixTokens';

const splashColors = {
  background: kinetixColors.graphite,
  brand: kinetixColors.textPrimary,
  guideLine: 'rgba(0, 107, 182, 0.08)',
  markerCore: kinetixColors.surface,
  panel: 'rgba(255, 255, 255, 0.86)',
  panelBorder: 'rgba(0, 141, 73, 0.18)',
  route: kinetixColors.amber,
  routeGlow: 'rgba(0, 141, 73, 0.32)',
  routeSoft: 'rgba(0, 141, 73, 0.14)',
  secondaryText: kinetixColors.textSecondary,
} as const;

export default function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  const handleSplashDone = useCallback(() => setSplashVisible(false), []);

  return (
    <AppStateProvider>
      <StatusBar style="dark" />
      {splashVisible ? <SalavatSplash onDone={handleSplashDone} /> : <AppNavigator />}
    </AppStateProvider>
  );
}

function SalavatSplash({ onDone }: { onDone: () => void }) {
  const backgroundProgress = useRef(new Animated.Value(0)).current;
  const routeStartProgress = useRef(new Animated.Value(0)).current;
  const routeTurnProgress = useRef(new Animated.Value(0)).current;
  const routeEndProgress = useRef(new Animated.Value(0)).current;
  const markerProgress = useRef(new Animated.Value(0)).current;
  const pulseProgress = useRef(new Animated.Value(0)).current;
  const brandProgress = useRef(new Animated.Value(0)).current;
  const sloganProgress = useRef(new Animated.Value(0)).current;
  const exitProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
        duration: 360,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(routeStartProgress, {
            duration: 520,
            easing: Easing.bezier(0.2, 0, 0, 1),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(routeTurnProgress, {
            duration: 360,
            easing: Easing.inOut(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(routeEndProgress, {
            duration: 520,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(820),
          Animated.timing(markerProgress, {
            duration: 460,
            easing: Easing.out(Easing.back(1.35)),
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.stagger(140, [
        Animated.timing(brandProgress, {
          duration: 560,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(sloganProgress, {
          duration: 520,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(720),
      Animated.timing(exitProgress, {
        duration: 420,
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
    markerProgress,
    onDone,
    pulseProgress,
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
    outputRange: [0, -10],
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
    shadowColor: splashColors.routeGlow,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
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
