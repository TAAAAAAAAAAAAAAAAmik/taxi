import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ComponentType } from 'react';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgePercent,
  Car,
  ChevronRight,
  Clock,
  Globe,
  Home,
  type LucideProps,
  MapPin,
  MessageCircle,
  Moon,
  Navigation,
  Route as RouteIcon,
  Settings,
  ShieldCheck,
  Sun,
  User,
} from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { BashkortostanEmblem } from '../components/BashkortostanEmblem';
import { AccountRole, normalizeAccountRole } from '../data/registration';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';
import { isDemoModeEnabled } from '../utils/runtimeFlags';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;
type ThemeName = keyof typeof themes;
type Theme = (typeof themes)[ThemeName];
type IconType = ComponentType<LucideProps>;
type Feature = { Icon: IconType; label: string; sub: string };

const themes = {
  light: {
    bg: '#F6F8F5',
    border: 'rgba(18, 56, 44, 0.10)',
    brand: '#008D49',
    brandSoft: 'rgba(0, 141, 73, 0.10)',
    muted: '#58776A',
    onBrand: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#EAF1ED',
    text: '#12382C',
  },
  dark: {
    bg: '#0E1A15',
    border: 'rgba(255, 255, 255, 0.08)',
    brand: '#1FA85B',
    brandSoft: 'rgba(31, 168, 91, 0.16)',
    muted: '#9DB5AA',
    onBrand: '#FFFFFF',
    surface: '#16241E',
    surfaceAlt: '#1E3128',
    text: '#EAF3EE',
  },
} as const;

function alpha(hex: string, a: number) {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

type DemoAccount = { Icon: IconType; identifier: string; label: string; password: string; role: AccountRole };

const demoAccounts: DemoAccount[] = [
  { Icon: User, identifier: 'demo-client@example.test', label: 'Клиент', password: 'Kinetix123', role: 'client' },
  { Icon: Car, identifier: 'demo-driver@example.test', label: 'Водитель', password: 'Kinetix123', role: 'self_employed_driver' },
];

export function WelcomeScreen({ navigation }: Props) {
  const { loginAccount } = useAppState();
  const [themeName, setThemeName] = useState<ThemeName>('light');
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const theme = themes[themeName];
  const styles = useMemo(() => createStyles(theme), [theme]);
  const ThemeIcon = themeName === 'light' ? Moon : Sun;
  const showDemo = isDemoModeEnabled();

  const handleDemoLogin = async (account: DemoAccount) => {
    if (demoBusy) {
      return;
    }

    setDemoBusy(true);
    setDemoError(null);
    const user = await loginAccount(account.identifier, account.password, normalizeAccountRole(account.role));
    setDemoBusy(false);

    if (!user) {
      setDemoError('Не удалось открыть демо-аккаунт. Попробуйте ещё раз.');
      return;
    }

    navigation.replace('Dashboard', {
      firstName: user.firstName || undefined,
      role: normalizeAccountRole(user.role),
    });
  };

  const passengerFeatures: Feature[] = [
    { Icon: Clock, label: 'Быстро', sub: 'Подача за 3 мин' },
    { Icon: BadgePercent, label: 'Выгодно', sub: 'Честные цены' },
  ];
  const driverFeatures: Feature[] = [
    { Icon: MapPin, label: 'Больше заказов', sub: 'Рядом с вами' },
    { Icon: ShieldCheck, label: 'Удобно', sub: 'Простой интерфейс' },
  ];
  const navItems = [
    { Icon: Home, active: true, label: 'Главная', onPress: undefined },
    { Icon: RouteIcon, active: false, label: 'Поездки', onPress: () => navigation.navigate('Registration') },
    { Icon: MessageCircle, active: false, label: 'Сообщения', onPress: () => navigation.navigate('Registration') },
    { Icon: Settings, active: false, label: 'Настройки', onPress: () => navigation.navigate('Registration') },
    { Icon: User, active: false, label: 'Профиль', onPress: () => navigation.navigate('Registration') },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.logo}>Kinetix</Text>
          <Pressable
            accessibilityLabel="Скрытый вход администратора"
            accessibilityRole="button"
            onLongPress={() => navigation.navigate('AdminPanel')}
            style={({ pressed }) => [styles.emblemButton, pressed && styles.pressed]}
          >
            <BashkortostanEmblem size={48} />
          </Pressable>
        </View>

        <RoleCard
          badge="Онлайн"
          dark={false}
          features={passengerFeatures}
          onPress={() => navigation.navigate('Registration', { role: 'client' })}
          styles={styles}
          subtitle="Заказать поездку"
          theme={theme}
          title="Пассажир"
        />

        <RoleCard
          badge="На линии"
          dark
          features={driverFeatures}
          onPress={() => navigation.navigate('Registration', { role: 'self_employed_driver' })}
          styles={styles}
          subtitle="Принимать заказы"
          theme={theme}
          title="Водитель"
        />

        <View style={styles.controlRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Dashboard', { firstName: 'Гость', role: 'client' })}
            style={({ pressed }) => [styles.guestButton, pressed && styles.pressed]}
          >
            <User color={theme.text} size={18} strokeWidth={2.3} />
            <Text style={styles.guestText}>Продолжить как Гость</Text>
          </Pressable>

          <View style={styles.langChip}>
            <Globe color={theme.text} size={15} strokeWidth={2.3} />
            <Text style={styles.langText}>RU</Text>
          </View>

          <Pressable
            accessibilityLabel={themeName === 'light' ? 'Тёмная тема' : 'Светлая тема'}
            accessibilityRole="button"
            onPress={() => setThemeName((current) => (current === 'light' ? 'dark' : 'light'))}
            style={({ pressed }) => [styles.themeButton, pressed && styles.pressed]}
          >
            <ThemeIcon color={theme.text} size={20} strokeWidth={2.3} />
          </Pressable>
        </View>

        {showDemo ? (
          <View style={styles.demoCard}>
            <Text style={styles.demoTitle}>Демо-вход</Text>
            <Text style={styles.demoSub}>Без backend, данные хранятся только в браузере.</Text>
            <View style={styles.demoGrid}>
              {demoAccounts.map((account) => {
                const DemoIcon = account.Icon;

                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={demoBusy}
                    key={account.role}
                    onPress={() => handleDemoLogin(account)}
                    style={({ pressed }) => [
                      styles.demoButton,
                      demoBusy && styles.demoButtonMuted,
                      pressed && styles.pressed,
                    ]}
                  >
                    <DemoIcon color={theme.brand} size={18} strokeWidth={2.4} />
                    <Text style={styles.demoButtonText}>{account.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {demoError ? <Text style={styles.demoError}>{demoError}</Text> : null}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Registration')}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <View style={styles.primaryIcon}>
            <ShieldCheck color={theme.onBrand} size={20} strokeWidth={2.3} />
          </View>
          <View style={styles.primaryCopy}>
            <Text style={styles.primaryTitle}>Регистрация</Text>
            <Text style={styles.primarySub}>Создайте аккаунт за минуту</Text>
          </View>
          <ChevronRight color={theme.onBrand} size={22} strokeWidth={2.5} />
        </Pressable>

        <View style={styles.bottomBar}>
          {navItems.map((item) => {
            const ItemIcon = item.Icon;

            return (
              <Pressable
                accessibilityLabel={item.label}
                accessibilityRole="button"
                key={item.label}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.navItem,
                  item.active && styles.navItemActive,
                  pressed && !item.active && styles.pressed,
                ]}
              >
                <ItemIcon color={item.active ? theme.brand : theme.muted} size={20} strokeWidth={2.3} />
                <Text style={[styles.navLabel, item.active && styles.navLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type RoleCardProps = {
  badge: string;
  dark: boolean;
  features: Feature[];
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  subtitle: string;
  theme: Theme;
  title: string;
};

function RoleCard({ badge, dark, features, onPress, styles, subtitle, theme, title }: RoleCardProps) {
  const onText = dark ? theme.onBrand : theme.text;
  const subText = dark ? alpha(theme.onBrand, 0.78) : theme.muted;
  const chipBg = dark ? alpha(theme.onBrand, 0.16) : theme.surfaceAlt;
  const iconColor = dark ? theme.onBrand : theme.brand;
  const routeColor = theme.brand;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.roleCard, dark && styles.roleCardDark, pressed && styles.pressed]}
    >
      <View style={styles.roleBody}>
        <Text style={[styles.roleTitle, { color: onText }]}>{title}</Text>
        <Text style={[styles.roleSubtitle, { color: subText }]}>{subtitle}</Text>

        <View style={styles.featureList}>
          {features.map((feature) => {
            const FeatureIcon = feature.Icon;

            return (
              <View key={feature.label} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: chipBg }]}>
                  <FeatureIcon color={iconColor} size={16} strokeWidth={2.3} />
                </View>
                <View style={styles.featureCopy}>
                  <Text style={[styles.featureLabel, { color: onText }]}>{feature.label}</Text>
                  <Text numberOfLines={1} style={[styles.featureSub, { color: subText }]}>
                    {feature.sub}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.roleArrow, dark && styles.roleArrowDark]}>
          <ArrowRight color={dark ? theme.brand : theme.onBrand} size={22} strokeWidth={2.6} />
        </View>
      </View>

      <View style={styles.roleScene}>
        <View style={[styles.skyA, { backgroundColor: alpha(routeColor, 0.1) }]} />
        <View style={[styles.skyB, { backgroundColor: alpha(routeColor, 0.14) }]} />
        <View style={[styles.skyC, { backgroundColor: alpha(routeColor, 0.08) }]} />
        <View style={[styles.sceneRoute, { backgroundColor: alpha(routeColor, 0.5) }]} />
        <View style={[styles.scenePin, { backgroundColor: chipBg }]}>
          {dark ? (
            <Navigation color={routeColor} size={15} strokeWidth={2.4} />
          ) : (
            <MapPin color={routeColor} size={15} strokeWidth={2.4} />
          )}
        </View>
        <View style={styles.sceneCar}>
          <CarArt dark={dark} theme={theme} />
        </View>
        <View style={[styles.statusBadge, { backgroundColor: chipBg }]}>
          <View style={[styles.statusDot, { backgroundColor: theme.brand }]} />
          <Text style={[styles.statusText, { color: onText }]}>{badge}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function CarArt({ dark, theme }: { dark: boolean; theme: Theme }) {
  const body = dark ? '#0B5C33' : '#FFFFFF';
  const bodyStroke = dark ? alpha(theme.onBrand, 0.45) : alpha(theme.text, 0.18);
  const cabin = dark ? '#0E6B3B' : '#F1F5F3';
  const glass = dark ? alpha(theme.onBrand, 0.34) : '#CFE0EA';
  const tire = dark ? '#08160F' : '#262F2A';
  const rim = dark ? alpha(theme.onBrand, 0.85) : '#C9D2CE';
  const accent = theme.brand;
  const head = dark ? '#EAF3EE' : '#FBE6A6';
  const tail = '#E24B4A';
  const shadow = dark ? 'rgba(0,0,0,0.32)' : 'rgba(18,56,44,0.16)';

  return (
    <Svg width={130} height={74} viewBox="0 0 200 112">
      <Ellipse cx={100} cy={101} rx={82} ry={7} fill={shadow} />
      <Path
        d="M62,60 L74,36 Q76,32 81,32 L121,32 Q126,32 128,36 L140,60 Z"
        fill={cabin}
        stroke={bodyStroke}
        strokeWidth={2}
      />
      <Rect x={80} y={40} width={24} height={17} rx={4} fill={glass} />
      <Rect x={108} y={40} width={24} height={17} rx={4} fill={glass} />
      <Rect x={22} y={56} width={156} height={32} rx={15} fill={body} stroke={bodyStroke} strokeWidth={2} />
      <Rect x={30} y={78} width={140} height={4} rx={2} fill={accent} opacity={0.85} />
      <Rect x={166} y={64} width={10} height={7} rx={3} fill={head} />
      <Rect x={24} y={64} width={9} height={7} rx={3} fill={tail} />
      <Circle cx={60} cy={88} r={17} fill={tire} />
      <Circle cx={60} cy={88} r={9} fill={rim} />
      <Circle cx={60} cy={88} r={3} fill={accent} />
      <Circle cx={142} cy={88} r={17} fill={tire} />
      <Circle cx={142} cy={88} r={9} fill={rim} />
      <Circle cx={142} cy={88} r={3} fill={accent} />
    </Svg>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    bottomBar: {
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 2,
      paddingHorizontal: 6,
      paddingVertical: 6,
    },
    controlRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    demoButton: {
      alignItems: 'center',
      backgroundColor: theme.surfaceAlt,
      borderColor: theme.border,
      borderRadius: 14,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 48,
      minWidth: 140,
      paddingHorizontal: 12,
    },
    demoButtonMuted: {
      opacity: 0.55,
    },
    demoButtonText: {
      color: theme.brand,
      fontSize: 14,
      fontWeight: '900',
    },
    demoCard: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: 10,
      padding: 16,
    },
    demoError: {
      color: '#C17A70',
      fontSize: 12,
      fontWeight: '800',
    },
    demoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    demoSub: {
      color: theme.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    demoTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '900',
    },
    emblemButton: {
      alignItems: 'center',
      backgroundColor: theme.surfaceAlt,
      borderColor: theme.border,
      borderRadius: 14,
      borderWidth: 1,
      height: 52,
      justifyContent: 'center',
      width: 52,
    },
    featureCopy: {
      flex: 1,
      minWidth: 0,
    },
    featureIcon: {
      alignItems: 'center',
      borderRadius: 11,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    featureLabel: {
      fontSize: 14,
      fontWeight: '800',
    },
    featureList: {
      gap: 10,
      marginTop: 12,
    },
    featureRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    featureSub: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 1,
    },
    guestButton: {
      alignItems: 'center',
      borderColor: theme.border,
      borderRadius: 14,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 50,
      paddingHorizontal: 12,
    },
    guestText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
    headerCard: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    langChip: {
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      height: 50,
      paddingHorizontal: 12,
    },
    langText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '900',
    },
    logo: {
      color: theme.text,
      fontSize: 28,
      fontWeight: '900',
    },
    navItem: {
      alignItems: 'center',
      borderRadius: 14,
      flex: 1,
      gap: 3,
      justifyContent: 'center',
      minHeight: 52,
      paddingHorizontal: 2,
    },
    navItemActive: {
      backgroundColor: theme.brandSoft,
    },
    navLabel: {
      color: theme.muted,
      fontSize: 10,
      fontWeight: '700',
    },
    navLabelActive: {
      color: theme.brand,
    },
    page: {
      backgroundColor: theme.bg,
      flexGrow: 1,
      gap: 14,
      paddingBottom: 18,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    pressed: {
      opacity: 0.92,
      transform: [{ scale: 0.98 }],
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: theme.brand,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 12,
      minHeight: 64,
      paddingHorizontal: 16,
    },
    primaryCopy: {
      flex: 1,
      minWidth: 0,
    },
    primaryIcon: {
      alignItems: 'center',
      backgroundColor: alpha('#FFFFFF', 0.18),
      borderRadius: 12,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    primarySub: {
      color: alpha('#FFFFFF', 0.82),
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    primaryTitle: {
      color: theme.onBrand,
      fontSize: 17,
      fontWeight: '900',
    },
    roleArrow: {
      alignItems: 'center',
      backgroundColor: theme.brand,
      borderRadius: 26,
      height: 52,
      justifyContent: 'center',
      marginTop: 16,
      width: 52,
    },
    roleArrowDark: {
      backgroundColor: theme.onBrand,
    },
    roleBody: {
      flex: 1,
      minWidth: 0,
      padding: 18,
    },
    roleCard: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 22,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 210,
      overflow: 'hidden',
    },
    roleCardDark: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    roleScene: {
      paddingVertical: 16,
      position: 'relative',
      width: 132,
    },
    roleSubtitle: {
      fontSize: 14,
      fontWeight: '700',
      marginTop: 4,
    },
    roleTitle: {
      fontSize: 24,
      fontWeight: '900',
    },
    safeArea: {
      backgroundColor: theme.bg,
      flex: 1,
    },
    sceneCar: {
      alignItems: 'center',
      bottom: 28,
      left: 0,
      position: 'absolute',
      right: 0,
    },
    scenePin: {
      alignItems: 'center',
      borderRadius: 13,
      height: 28,
      justifyContent: 'center',
      position: 'absolute',
      right: 14,
      top: 22,
      width: 28,
    },
    sceneRoute: {
      borderRadius: 2,
      height: 3,
      position: 'absolute',
      right: 26,
      top: 64,
      transform: [{ rotate: '24deg' }],
      width: 70,
    },
    skyA: {
      borderRadius: 3,
      bottom: 70,
      height: 44,
      position: 'absolute',
      right: 86,
      width: 16,
    },
    skyB: {
      borderRadius: 3,
      bottom: 70,
      height: 64,
      position: 'absolute',
      right: 64,
      width: 18,
    },
    skyC: {
      borderRadius: 3,
      bottom: 70,
      height: 34,
      position: 'absolute',
      right: 44,
      width: 14,
    },
    statusBadge: {
      alignItems: 'center',
      borderRadius: 999,
      bottom: 14,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      position: 'absolute',
      right: 10,
    },
    statusDot: {
      borderRadius: 999,
      height: 7,
      width: 7,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '800',
    },
    themeButton: {
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 14,
      borderWidth: 1,
      height: 50,
      justifyContent: 'center',
      width: 50,
    },
  });
}
