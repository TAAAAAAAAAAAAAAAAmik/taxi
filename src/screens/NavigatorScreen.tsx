import { useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  LocateFixed,
  Navigation,
  RotateCcw,
  RotateCw,
} from 'lucide-react-native';
import {
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  DriverNavigatorMap,
  type NavigatorLiveState,
  type NavigatorPhase,
} from '../components/DriverNavigatorMap';
import { findSalavatAddressSuggestions, type GeoPoint } from '../data/salavatDistrict';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Navigator'>;

// Центр Салаватского района (с. Малояз) — фолбэк координат.
const SALAVAT_CENTER: GeoPoint = { latitude: 55.155, longitude: 58.184 };

function resolveCoord(address: string | undefined): GeoPoint | undefined {
  const query = address?.trim();

  if (!query) {
    return undefined;
  }

  return findSalavatAddressSuggestions(query, 1)[0]?.coordinates;
}

function maneuverInstruction(type: string, modifier: string) {
  if (type === 'arrive') {
    return 'Вы на месте';
  }

  if (type === 'roundabout' || type === 'rotary') {
    return 'Круговое движение';
  }

  if (type === 'fork') {
    return modifier.includes('left') ? 'Держитесь левее' : 'Держитесь правее';
  }

  if (type === 'merge') {
    return 'Перестройтесь в поток';
  }

  if (type === 'end of road') {
    return modifier.includes('left') ? 'В конце дороги — налево' : 'В конце дороги — направо';
  }

  const byModifier: Record<string, string> = {
    left: 'Поверните налево',
    right: 'Поверните направо',
    'sharp left': 'Круто налево',
    'sharp right': 'Круто направо',
    'slight left': 'Плавно налево',
    'slight right': 'Плавно направо',
    straight: 'Двигайтесь прямо',
    uturn: 'Разворот',
  };

  return byModifier[modifier] || 'Двигайтесь прямо';
}

function ManeuverIcon({ modifier, type }: { modifier: string; type: string }) {
  const common = { color: '#0A1411', size: 30, strokeWidth: 2.8 } as const;

  if (type === 'arrive') {
    return <Flag {...common} />;
  }

  if (type === 'roundabout' || type === 'rotary') {
    return <RotateCw {...common} />;
  }

  if (modifier === 'uturn') {
    return <RotateCcw {...common} />;
  }

  if (modifier.includes('left')) {
    return modifier.includes('slight') ? <ArrowUpLeft {...common} /> : <CornerUpLeft {...common} />;
  }

  if (modifier.includes('right')) {
    return modifier.includes('slight') ? <ArrowUpRight {...common} /> : <CornerUpRight {...common} />;
  }

  return <ArrowUp {...common} />;
}

function formatManeuverDistance(meters: number) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1).replace('.', ',')} км`;
  }

  return `${Math.max(10, Math.round(meters / 10) * 10)} м`;
}

function formatArrivalTime(remainingMin: number) {
  const at = new Date(Date.now() + remainingMin * 60000);

  return at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function NavigatorScreen({ navigation, route }: Props) {
  const { destination, phase: initialPhase, pickup } = route.params;
  const { height } = useWindowDimensions();
  const [phase, setPhase] = useState<NavigatorPhase>(initialPhase ?? 'pickup');
  const [nav, setNav] = useState<NavigatorLiveState | null>(null);
  const iframeRef = useRef<{ contentWindow?: Window } | null>(null);

  const pickupPoint = useMemo(() => resolveCoord(pickup) ?? SALAVAT_CENTER, [pickup]);
  const destinationPoint = useMemo(
    () => resolveCoord(destination) ?? SALAVAT_CENTER,
    [destination],
  );
  const target = phase === 'pickup' ? pickupPoint : destinationPoint;
  // Старт симуляции (без GPS): к подаче едем «из центра», к назначению — от подачи.
  const simStart = useMemo<GeoPoint>(
    () =>
      phase === 'pickup'
        ? { latitude: SALAVAT_CENTER.latitude - 0.012, longitude: SALAVAT_CENTER.longitude - 0.02 }
        : pickupPoint,
    [phase, pickupPoint],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data as (NavigatorLiveState & { kind?: string; type?: string }) | undefined;

      if (data?.type === 'kinetix-nav' && data.kind === 'state') {
        setNav(data);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const recenter = () => {
    iframeRef.current?.contentWindow?.postMessage({ kind: 'recenter', type: 'kinetix-nav' }, '*');
  };

  const switchPhase = (nextPhase: NavigatorPhase) => {
    if (nextPhase !== phase) {
      setNav(null);
      setPhase(nextPhase);
    }
  };

  if (Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.nativeFallback}>
        <Navigation color="#B7F46A" size={34} strokeWidth={2.2} />
        <Text style={styles.nativeFallbackTitle}>Навигатор доступен в web-версии</Text>
        <Text style={styles.nativeFallbackText}>
          Маршрут: {pickup} → {destination}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.nativeFallbackButton, pressed && styles.pressed]}
        >
          <Text style={styles.nativeFallbackButtonText}>Назад</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <DriverNavigatorMap
        height={height}
        iframeRef={iframeRef}
        key={phase}
        simStart={simStart}
        target={target}
      />

      {/* Верх: выход + баннер следующего манёвра */}
      <View pointerEvents="box-none" style={styles.topOverlay}>
        <Pressable
          accessibilityLabel="Выйти из навигатора"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.exitButton, pressed && styles.pressed]}
        >
          <ArrowLeft color="#B7F46A" size={22} strokeWidth={2.4} />
        </Pressable>

        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            {nav ? (
              <ManeuverIcon modifier={nav.maneuverModifier} type={nav.maneuverType} />
            ) : (
              <Navigation color="#0A1411" size={26} strokeWidth={2.6} />
            )}
          </View>
          <View style={styles.bannerCopy}>
            {nav ? (
              <>
                <Text style={styles.bannerDistance}>
                  {nav.arrived ? 'Финиш' : formatManeuverDistance(nav.distToManeuverM)}
                </Text>
                <Text numberOfLines={1} style={styles.bannerText}>
                  {nav.arrived
                    ? phase === 'pickup'
                      ? 'Вы у точки подачи'
                      : 'Вы на месте назначения'
                    : maneuverInstruction(nav.maneuverType, nav.maneuverModifier)}
                </Text>
                {nav.streetName && !nav.arrived ? (
                  <Text numberOfLines={1} style={styles.bannerStreet}>
                    {nav.streetName}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.bannerDistance}>Маршрут</Text>
                <Text numberOfLines={1} style={styles.bannerText}>
                  Строим путь по дорогам…
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Низ: фаза, ETA-панель, recenter */}
      <View pointerEvents="box-none" style={styles.bottomOverlay}>
        <View style={styles.phaseRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: phase === 'pickup' }}
            onPress={() => switchPhase('pickup')}
            style={({ pressed }) => [
              styles.phaseChip,
              phase === 'pickup' && styles.phaseChipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.phaseChipText, phase === 'pickup' && styles.phaseChipTextActive]}>
              Подача
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: phase === 'trip' }}
            onPress={() => switchPhase('trip')}
            style={({ pressed }) => [
              styles.phaseChip,
              phase === 'trip' && styles.phaseChipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.phaseChipText, phase === 'trip' && styles.phaseChipTextActive]}>
              Поездка
            </Text>
          </Pressable>
          {nav?.simulated ? (
            <View style={styles.simChip}>
              <Text style={styles.simChipText}>Демо GPS</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.etaPanel}>
          <View style={styles.etaCopy}>
            <Text style={styles.etaTime}>{nav ? `${nav.remainingMin} мин` : '—'}</Text>
            <Text numberOfLines={1} style={styles.etaMeta}>
              {nav
                ? `${nav.remainingKm.toFixed(1).replace('.', ',')} км · прибытие ${formatArrivalTime(nav.remainingMin)}`
                : 'Ждём сигнал GPS'}
            </Text>
            <Text numberOfLines={1} style={styles.etaTarget}>
              {phase === 'pickup' ? `Подача: ${pickup}` : `Куда: ${destination}`}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Следовать за машиной"
            accessibilityRole="button"
            onPress={recenter}
            style={({ pressed }) => [styles.recenterButton, pressed && styles.pressed]}
          >
            <LocateFixed color="#B7F46A" size={22} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const DARK = 'rgba(9, 19, 15, 0.94)';

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    backgroundColor: DARK,
    borderColor: 'rgba(183, 244, 106, 0.16)',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 13,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  bannerCopy: { flex: 1, gap: 1, minWidth: 0 },
  bannerDistance: { color: '#B7F46A', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  bannerIcon: {
    alignItems: 'center',
    backgroundColor: '#B7F46A',
    borderRadius: 15,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  bannerStreet: { color: 'rgba(244, 250, 246, 0.55)', fontSize: 12, fontWeight: '600' },
  bannerText: { color: '#F4FAF6', fontSize: 15, fontWeight: '800' },
  bottomOverlay: {
    bottom: 0,
    gap: 10,
    left: 0,
    padding: 14,
    position: 'absolute',
    right: 0,
  },
  etaCopy: { flex: 1, gap: 2, minWidth: 0 },
  etaMeta: { color: 'rgba(244, 250, 246, 0.72)', fontSize: 13, fontWeight: '700' },
  etaPanel: {
    alignItems: 'center',
    backgroundColor: DARK,
    borderColor: 'rgba(183, 244, 106, 0.16)',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  etaTarget: { color: 'rgba(244, 250, 246, 0.5)', fontSize: 12, fontWeight: '600' },
  etaTime: { color: '#B7F46A', fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  exitButton: {
    alignItems: 'center',
    backgroundColor: DARK,
    borderColor: 'rgba(183, 244, 106, 0.16)',
    borderRadius: 16,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  nativeFallback: {
    alignItems: 'center',
    backgroundColor: '#0A1411',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  nativeFallbackButton: {
    backgroundColor: '#B7F46A',
    borderRadius: 14,
    marginTop: 10,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  nativeFallbackButtonText: { color: '#0A1411', fontSize: 15, fontWeight: '900' },
  nativeFallbackText: { color: 'rgba(244, 250, 246, 0.6)', fontSize: 14, textAlign: 'center' },
  nativeFallbackTitle: { color: '#F4FAF6', fontSize: 18, fontWeight: '900' },
  phaseChip: {
    backgroundColor: DARK,
    borderColor: 'rgba(183, 244, 106, 0.16)',
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  phaseChipActive: { backgroundColor: '#B7F46A', borderColor: '#B7F46A' },
  phaseChipText: { color: '#F4FAF6', fontSize: 13, fontWeight: '800' },
  phaseChipTextActive: { color: '#0A1411' },
  phaseRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  recenterButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(183, 244, 106, 0.12)',
    borderColor: 'rgba(183, 244, 106, 0.3)',
    borderRadius: 15,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  root: { backgroundColor: '#0A1411', flex: 1 },
  simChip: {
    backgroundColor: 'rgba(9, 19, 15, 0.8)',
    borderColor: 'rgba(183, 244, 106, 0.25)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
  },
  simChipText: { color: '#B7F46A', fontSize: 12, fontWeight: '800' },
  topOverlay: {
    flexDirection: 'row',
    gap: 10,
    left: 0,
    padding: 14,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
