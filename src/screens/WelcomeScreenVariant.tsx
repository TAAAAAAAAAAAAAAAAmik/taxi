import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowRight,
  Car,
  Check,
  ChevronRight,
  Globe,
  Home,
  MapPin,
  MessageCircle,
  Moon,
  Navigation as NavigationIcon,
  Route,
  Settings,
  ShieldCheck,
  Sun,
  User,
} from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BashkortostanEmblem } from '../components/BashkortostanEmblem';
import { RootStackParamList } from '../navigation/types';

const themes = {
  light: {
    bg: '#F6F8F5',
    border: 'rgba(18,56,44,.1)',
    brand: '#008D49',
    muted: '#58776A',
    onBrand: '#FFFFFF',
    surface: '#FFFFFF',
    text: '#12382C',
  },
  dark: {
    bg: '#0E1A15',
    border: 'rgba(255,255,255,.08)',
    brand: '#1FA85B',
    muted: '#9DB5AA',
    onBrand: '#FFFFFF',
    surface: '#16241E',
    text: '#EAF3EE',
  },
} as const;

type ThemeName = keyof typeof themes;
type Theme = (typeof themes)[ThemeName];
type AppStyles = ReturnType<typeof createStyles>;
type IconComponent = ComponentType<LucideProps>;

const passengerFeatures = [
  { subtitle: 'Подача за 3 мин', title: 'Быстро' },
  { subtitle: 'Честные цены', title: 'Выгодно' },
];

const driverFeatures = [
  { subtitle: 'Рядом с вами', title: 'Больше заказов' },
  { subtitle: 'Простой интерфейс', title: 'Удобно' },
];

export function WelcomeScreenVariant({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Welcome'>) {
  const [themeName, setThemeName] = useState<ThemeName>('light');
  const theme = themes[themeName];
  const styles = useMemo(() => createStyles(theme), [theme]);
  const ThemeIcon = themeName === 'light' ? Moon : Sun;

  const bottomItems: Array<{
    active?: boolean;
    icon: IconComponent;
    label: string;
    onPress?: () => void;
  }> = [
    { active: true, icon: Home, label: 'Главная' },
    { icon: Route, label: 'Поездки', onPress: () => navigation.navigate('Login') },
    { icon: MessageCircle, label: 'Сообщения', onPress: () => navigation.navigate('Login') },
    { icon: Settings, label: 'Настройки', onPress: () => navigation.navigate('Login') },
    { icon: User, label: 'Профиль', onPress: () => navigation.navigate('Login') },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.logo}>Kinetix</Text>
            <Pressable
              accessibilityLabel="Скрытый переход в админ-панель"
              accessibilityRole="button"
              onLongPress={() => navigation.navigate('AdminPanel')}
              style={({ pressed }) => [styles.emblemButton, pressed && styles.pressed]}
            >
              <BashkortostanEmblem size={48} />
            </Pressable>
          </View>

          <RoleCard
            arrowColor={theme.onBrand}
            arrowStyle={styles.passengerArrow}
            cardStyle={styles.passengerCard}
            features={passengerFeatures}
            illustration={<PassengerIllustration styles={styles} theme={theme} />}
            mode="passenger"
            onPress={() => navigation.navigate('Registration', { role: 'client' })}
            styles={styles}
            subtitle="Заказать поездку"
            theme={theme}
            title="Пассажир"
          />

          <RoleCard
            arrowColor={theme.brand}
            arrowStyle={styles.driverArrow}
            cardStyle={styles.driverCard}
            features={driverFeatures}
            illustration={<DriverIllustration styles={styles} theme={theme} />}
            mode="driver"
            onPress={() => navigation.navigate('Registration', { role: 'self_employed_driver' })}
            styles={styles}
            subtitle="Принимать заказы"
            theme={theme}
            title="Водитель"
          />

          <View style={styles.controlRow}>
            <Pressable
              accessibilityLabel="Продолжить как Гость"
              accessibilityRole="button"
              onPress={() => navigation.navigate('Dashboard', { firstName: 'Гость', role: 'client' })}
              style={({ pressed }) => [styles.guestButton, pressed && styles.pressed]}
            >
              <User color={theme.brand} size={18} strokeWidth={2.35} />
              <Text style={styles.guestText}>Продолжить как Гость</Text>
            </Pressable>

            <View style={styles.langChip}>
              <Globe color={theme.brand} size={17} strokeWidth={2.35} />
              <Text style={styles.langText}>RU</Text>
            </View>

            <Pressable
              accessibilityLabel={themeName === 'light' ? 'Включить темную тему' : 'Включить светлую тему'}
              accessibilityRole="button"
              onPress={() => setThemeName((current) => (current === 'light' ? 'dark' : 'light'))}
              style={({ pressed }) => [styles.themeButton, pressed && styles.pressed]}
            >
              <ThemeIcon color={theme.text} size={20} strokeWidth={2.45} />
            </Pressable>
          </View>

          <Pressable
            accessibilityLabel="Войти или зарегистрироваться"
            accessibilityRole="button"
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <ShieldCheck color={theme.onBrand} size={22} strokeWidth={2.5} />
            <View style={styles.primaryCopy}>
              <Text style={styles.primaryTitle}>Войти / Регистрация</Text>
              <Text style={styles.primarySubtitle}>Безопасный доступ к сервису</Text>
            </View>
            <ChevronRight color={theme.onBrand} size={22} strokeWidth={2.5} />
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        {bottomItems.map((item) => {
          const ItemIcon = item.icon;

          return (
            <Pressable
              accessibilityLabel={item.label}
              accessibilityRole="button"
              key={item.label}
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.bottomItem,
                item.active && styles.bottomItemActive,
                pressed && !item.active && styles.pressed,
              ]}
            >
              <ItemIcon
                color={item.active ? theme.onBrand : theme.muted}
                size={20}
                strokeWidth={2.35}
              />
              <Text style={[styles.bottomLabel, item.active && styles.bottomLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function RoleCard({
  arrowColor,
  arrowStyle,
  cardStyle,
  features,
  illustration,
  mode,
  onPress,
  styles,
  subtitle,
  theme,
  title,
}: {
  arrowColor: string;
  arrowStyle: object;
  cardStyle: object;
  features: Array<{ subtitle: string; title: string }>;
  illustration: ReactNode;
  mode: 'driver' | 'passenger';
  onPress: () => void;
  styles: AppStyles;
  subtitle: string;
  theme: Theme;
  title: string;
}) {
  const isDriver = mode === 'driver';

  return (
    <Pressable
      accessibilityLabel={isDriver ? 'Перейти к регистрации водителя' : 'Перейти к регистрации пассажира'}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.roleCard, cardStyle, pressed && styles.pressed]}
    >
      <View style={styles.roleCopy}>
        <Text style={[styles.roleTitle, isDriver && styles.driverText]}>{title}</Text>
        <Text style={[styles.roleSubtitle, isDriver && styles.driverSubtle]}>{subtitle}</Text>

        <View style={styles.featureStack}>
          {features.map((feature) => (
            <FeatureRow
              isDriver={isDriver}
              key={feature.title}
              styles={styles}
              subtitle={feature.subtitle}
              theme={theme}
              title={feature.title}
            />
          ))}
        </View>

        <View style={[styles.arrowButton, arrowStyle]}>
          <ArrowRight color={arrowColor} size={25} strokeWidth={2.7} />
        </View>
      </View>

      <View style={styles.illustrationWrap}>{illustration}</View>
    </Pressable>
  );
}

function FeatureRow({
  isDriver,
  styles,
  subtitle,
  theme,
  title,
}: {
  isDriver: boolean;
  styles: AppStyles;
  subtitle: string;
  theme: Theme;
  title: string;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIcon, isDriver && styles.driverFeatureIcon]}>
        <Check color={isDriver ? theme.brand : theme.onBrand} size={15} strokeWidth={3} />
      </View>
      <View style={styles.featureTextBlock}>
        <Text style={[styles.featureTitle, isDriver && styles.driverText]}>{title}</Text>
        <Text style={[styles.featureSubtitle, isDriver && styles.driverSubtle]}>{subtitle}</Text>
      </View>
    </View>
  );
}

function PassengerIllustration({ styles, theme }: { styles: AppStyles; theme: Theme }) {
  return (
    <View style={styles.passengerArt}>
      <View style={[styles.cityBuilding, styles.cityBuildingOne]} />
      <View style={[styles.cityBuilding, styles.cityBuildingTwo]} />
      <View style={[styles.cityBuilding, styles.cityBuildingThree]} />
      <View style={[styles.cityBuilding, styles.cityBuildingFour]} />

      <View style={styles.passengerRouteLine} />
      <View style={styles.passengerPin}>
        <MapPin color={theme.brand} size={18} strokeWidth={2.7} />
      </View>
      <Car color={theme.brand} size={82} strokeWidth={1.75} style={styles.passengerCar} />

      <View style={styles.passengerBadge}>
        <Text style={styles.passengerBadgeText}>● Онлайн</Text>
      </View>
    </View>
  );
}

function DriverIllustration({ styles, theme }: { styles: AppStyles; theme: Theme }) {
  return (
    <View style={styles.driverArt}>
      <View style={styles.driverRouteLine} />
      <View style={styles.driverGlow} />
      <View style={styles.driverPoint} />
      <View style={styles.navigationBadge}>
        <NavigationIcon color={theme.onBrand} size={18} strokeWidth={2.45} />
      </View>
      <View style={styles.driverCarPlate}>
        <Car color={theme.brand} size={72} strokeWidth={1.9} />
      </View>
      <View style={styles.driverBadge}>
        <Text style={styles.driverBadgeText}>● На линии</Text>
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  const bgSoft = alpha(theme.text, 0.035);
  const brandSoft = alpha(theme.brand, 0.1);
  const brandLine = alpha(theme.brand, 0.28);
  const brandShadow = alpha(theme.brand, 0.28);
  const onBrandSoft = alpha(theme.onBrand, 0.17);
  const onBrandLine = alpha(theme.onBrand, 0.34);
  const onBrandText = alpha(theme.onBrand, 0.78);
  const shadow = alpha(theme.text, 0.14);
  const skyline = alpha(theme.text, 0.075);

  return StyleSheet.create({
    arrowButton: {
      alignItems: 'center',
      borderRadius: 29,
      height: 58,
      justifyContent: 'center',
      marginTop: 'auto',
      width: 58,
    },
    bottomItem: {
      alignItems: 'center',
      borderRadius: 18,
      flex: 1,
      gap: 3,
      justifyContent: 'center',
      minHeight: 57,
      paddingHorizontal: 2,
      paddingVertical: 6,
    },
    bottomItemActive: {
      backgroundColor: theme.brand,
    },
    bottomLabel: {
      color: theme.muted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0,
    },
    bottomLabelActive: {
      color: theme.onBrand,
    },
    bottomNav: {
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 24,
      borderWidth: 1,
      bottom: 12,
      elevation: 8,
      flexDirection: 'row',
      gap: 2,
      left: 14,
      padding: 7,
      position: 'absolute',
      right: 14,
      shadowColor: shadow,
      shadowOffset: { height: 16, width: 0 },
      shadowOpacity: 1,
      shadowRadius: 28,
    },
    cityBuilding: {
      backgroundColor: skyline,
      borderRadius: 5,
      bottom: 14,
      position: 'absolute',
      width: 18,
    },
    cityBuildingFour: {
      height: 36,
      right: 14,
    },
    cityBuildingOne: {
      height: 44,
      left: 12,
    },
    cityBuildingThree: {
      height: 58,
      right: 38,
      width: 24,
    },
    cityBuildingTwo: {
      height: 70,
      left: 34,
      width: 22,
    },
    content: {
      alignSelf: 'center',
      gap: 14,
      maxWidth: 520,
      width: '100%',
    },
    controlRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    driverArt: {
      backgroundColor: alpha(theme.onBrand, 0.08),
      borderColor: onBrandSoft,
      borderRadius: 18,
      borderWidth: 1,
      height: '100%',
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
    },
    driverArrow: {
      backgroundColor: theme.onBrand,
    },
    driverBadge: {
      backgroundColor: alpha(theme.onBrand, 0.19),
      borderColor: alpha(theme.onBrand, 0.22),
      borderRadius: 999,
      borderWidth: 1,
      bottom: 11,
      paddingHorizontal: 9,
      paddingVertical: 5,
      position: 'absolute',
      right: 9,
    },
    driverBadgeText: {
      color: theme.onBrand,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0,
    },
    driverCard: {
      backgroundColor: theme.brand,
      borderColor: alpha(theme.onBrand, 0.16),
      shadowColor: brandShadow,
    },
    driverCarPlate: {
      alignItems: 'center',
      backgroundColor: theme.onBrand,
      borderRadius: 28,
      bottom: 36,
      height: 86,
      justifyContent: 'center',
      position: 'absolute',
      right: 16,
      width: 104,
    },
    driverFeatureIcon: {
      backgroundColor: theme.onBrand,
    },
    driverGlow: {
      backgroundColor: theme.onBrand,
      borderRadius: 23,
      height: 46,
      left: 19,
      opacity: 0.18,
      position: 'absolute',
      top: 83,
      width: 46,
    },
    driverPoint: {
      backgroundColor: theme.onBrand,
      borderRadius: 8,
      height: 16,
      left: 34,
      position: 'absolute',
      top: 98,
      width: 16,
    },
    driverRouteLine: {
      backgroundColor: onBrandLine,
      borderRadius: 999,
      height: 2,
      left: 25,
      position: 'absolute',
      right: 18,
      top: 105,
      transform: [{ rotate: '-17deg' }],
    },
    driverSubtle: {
      color: onBrandText,
    },
    driverText: {
      color: theme.onBrand,
    },
    emblemButton: {
      alignItems: 'center',
      borderRadius: 18,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    featureIcon: {
      alignItems: 'center',
      backgroundColor: theme.brand,
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    featureRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      minHeight: 40,
    },
    featureStack: {
      gap: 10,
      marginTop: 22,
    },
    featureSubtitle: {
      color: theme.muted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0,
      marginTop: 1,
    },
    featureTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    featureTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 0,
    },
    guestButton: {
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      minHeight: 52,
      paddingHorizontal: 14,
    },
    guestText: {
      color: theme.text,
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 0,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: 4,
      paddingTop: 2,
    },
    illustrationWrap: {
      alignSelf: 'stretch',
      flex: 0.9,
      minWidth: 128,
    },
    langChip: {
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      height: 52,
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    langText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0,
    },
    logo: {
      color: theme.text,
      fontSize: 31,
      fontWeight: '900',
      letterSpacing: 0,
    },
    navigationBadge: {
      alignItems: 'center',
      backgroundColor: alpha(theme.onBrand, 0.17),
      borderColor: alpha(theme.onBrand, 0.22),
      borderRadius: 17,
      borderWidth: 1,
      height: 38,
      justifyContent: 'center',
      position: 'absolute',
      right: 16,
      top: 14,
      width: 38,
    },
    page: {
      flexGrow: 1,
      paddingBottom: 106,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    passengerArrow: {
      backgroundColor: theme.brand,
      shadowColor: brandShadow,
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 1,
      shadowRadius: 18,
    },
    passengerArt: {
      backgroundColor: bgSoft,
      borderColor: theme.border,
      borderRadius: 18,
      borderWidth: 1,
      height: '100%',
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
    },
    passengerBadge: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 999,
      borderWidth: 1,
      bottom: 11,
      paddingHorizontal: 9,
      paddingVertical: 5,
      position: 'absolute',
      right: 9,
    },
    passengerBadgeText: {
      color: theme.brand,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0,
    },
    passengerCar: {
      bottom: 37,
      position: 'absolute',
      right: 16,
    },
    passengerCard: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      shadowColor: shadow,
    },
    passengerPin: {
      alignItems: 'center',
      backgroundColor: brandSoft,
      borderRadius: 16,
      height: 36,
      justifyContent: 'center',
      left: 17,
      position: 'absolute',
      top: 19,
      width: 36,
    },
    passengerRouteLine: {
      backgroundColor: brandLine,
      borderRadius: 999,
      height: 2,
      left: 43,
      position: 'absolute',
      right: 21,
      top: 50,
      transform: [{ rotate: '18deg' }],
    },
    pressed: {
      opacity: 0.92,
      transform: [{ scale: 0.985 }],
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: theme.brand,
      borderRadius: 20,
      elevation: 4,
      flexDirection: 'row',
      gap: 12,
      minHeight: 62,
      paddingHorizontal: 16,
      shadowColor: brandShadow,
      shadowOffset: { height: 12, width: 0 },
      shadowOpacity: 1,
      shadowRadius: 22,
    },
    primaryCopy: {
      flex: 1,
      minWidth: 0,
    },
    primarySubtitle: {
      color: alpha(theme.onBrand, 0.77),
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0,
      marginTop: 2,
    },
    primaryTitle: {
      color: theme.onBrand,
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0,
    },
    roleCard: {
      borderRadius: 20,
      borderWidth: 1,
      elevation: 4,
      flexDirection: 'row',
      gap: 14,
      minHeight: 224,
      padding: 16,
      shadowOffset: { height: 14, width: 0 },
      shadowOpacity: 1,
      shadowRadius: 28,
    },
    roleCopy: {
      flex: 1,
      minWidth: 0,
    },
    roleSubtitle: {
      color: theme.muted,
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0,
      marginTop: 4,
    },
    roleTitle: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: 0,
    },
    safeArea: {
      backgroundColor: theme.bg,
      flex: 1,
    },
    scroll: {
      backgroundColor: theme.bg,
      flex: 1,
    },
    themeButton: {
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 18,
      borderWidth: 1,
      height: 52,
      justifyContent: 'center',
      width: 52,
    },
  });
}

function alpha(color: string, opacity: number) {
  if (!color.startsWith('#')) {
    return color;
  }

  const normalized =
    color.length === 4
      ? color
          .slice(1)
          .split('')
          .map((value) => `${value}${value}`)
          .join('')
      : color.slice(1);
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red},${green},${blue},${opacity})`;
}
