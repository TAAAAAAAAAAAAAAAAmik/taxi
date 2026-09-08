import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ComponentType } from 'react';
import { useMemo, useState } from 'react';
import { Car, ChevronRight, type LucideProps, Package, User } from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BashkortostanEmblem } from '../components/BashkortostanEmblem';
import { AccountRole, normalizeAccountRole } from '../data/registration';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';
import { kinetixColors } from '../theme/kinetixTokens';
import { isDemoModeEnabled } from '../utils/runtimeFlags';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;
type IconType = ComponentType<LucideProps>;
type DemoAccount = { Icon: IconType; identifier: string; label: string; password: string; role: AccountRole };

const demoAccounts: DemoAccount[] = [
  { Icon: User, identifier: 'demo-client@example.test', label: 'Клиент', password: 'Kinetix123', role: 'client' },
  { Icon: Car, identifier: 'demo-driver@example.test', label: 'Водитель', password: 'Kinetix123', role: 'self_employed_driver' },
];

export function WelcomeScreen({ navigation }: Props) {
  const { loginAccount } = useAppState();
  const { width } = useWindowDimensions();
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const showDemo = isDemoModeEnabled();
  const heroWidth = Math.max(280, Math.min(640, width) - 40);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <RouteMark width={heroWidth} />

          <View style={styles.heroTop}>
            <Text style={styles.wordmark}>KINETIX</Text>
            <Pressable
              accessibilityLabel="Скрытый вход администратора"
              accessibilityRole="button"
              onLongPress={() => navigation.navigate('AdminPanel')}
              style={({ pressed }) => [styles.emblem, pressed && styles.pressed]}
            >
              <BashkortostanEmblem size={30} tone="muted" />
            </Pressable>
          </View>

          <Text style={styles.heroTitle}>Такси и доставка по Салаватскому району</Text>
          <Text style={styles.heroLine}>Цена известна до заказа. Оплата водителю.</Text>
        </View>

        <View style={styles.choices}>
          <RoleRow
            Icon={User}
            onPress={() => navigation.navigate('Registration', { role: 'client' })}
            subtitle="Поездка или доставка по селу и району"
            title="Мне нужна машина"
            tone="primary"
          />
          <RoleRow
            Icon={Car}
            onPress={() => navigation.navigate('Registration', { role: 'self_employed_driver' })}
            subtitle="Свой график, без процента с поездок"
            title="Хочу работать водителем"
            tone="plain"
          />
        </View>

        {showDemo ? (
          <View style={styles.demo}>
            <Text style={styles.demoTitle}>Демо-вход</Text>
            <View style={styles.demoRow}>
              {demoAccounts.map((account) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={demoBusy}
                  key={account.role}
                  onPress={() => handleDemoLogin(account)}
                  style={({ pressed }) => [styles.demoButton, demoBusy && styles.demoBusy, pressed && styles.pressed]}
                >
                  <account.Icon color={kinetixColors.amber} size={17} strokeWidth={2.4} />
                  <Text style={styles.demoButtonText}>{account.label}</Text>
                </Pressable>
              ))}
            </View>
            {demoError ? <Text style={styles.demoError}>{demoError}</Text> : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('SignIn')}
            style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
          >
            <Text style={styles.footerStrong}>Уже пользуюсь — войти</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Dashboard', { firstName: 'Гость', role: 'client' })}
            style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
          >
            <Text style={styles.footerMuted}>Осмотреться без регистрации</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type RoleRowProps = {
  Icon: IconType;
  onPress: () => void;
  subtitle: string;
  title: string;
  tone: 'plain' | 'primary';
};

function RoleRow({ Icon, onPress, subtitle, title, tone }: RoleRowProps) {
  const primary = tone === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, primary ? styles.rowPrimary : styles.rowPlain, pressed && styles.pressed]}
    >
      <View style={[styles.rowIcon, primary ? styles.rowIconPrimary : styles.rowIconPlain]}>
        <Icon color={primary ? '#FFFFFF' : kinetixColors.amber} size={22} strokeWidth={2.4} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, primary && styles.rowTitlePrimary]}>{title}</Text>
        <Text style={[styles.rowSubtitle, primary && styles.rowSubtitlePrimary]}>{subtitle}</Text>
      </View>
      <ChevronRight
        color={primary ? 'rgba(255, 255, 255, 0.82)' : kinetixColors.textMuted}
        size={22}
        strokeWidth={2.5}
      />
    </Pressable>
  );
}

// Один штрих маршрута вместо городского скайлайна: район — это дорога
// между сёлами, а не силуэт многоэтажек.
function RouteMark({ width }: { width: number }) {
  const height = 44;

  return (
    <View pointerEvents="none" style={styles.routeMark}>
      <Svg height={height} width={width}>
        <Path
          d={`M0 ${height - 8} C ${width * 0.28} ${height - 6}, ${width * 0.4} 14, ${width * 0.66} 12 S ${
            width * 0.9
          } 26, ${width} 16`}
          fill="none"
          stroke="rgba(183, 244, 106, 0.28)"
          strokeLinecap="round"
          strokeWidth={2}
        />
        <Path
          d={`M0 ${height - 8} C ${width * 0.28} ${height - 6}, ${width * 0.4} 14, ${width * 0.66} 12`}
          fill="none"
          stroke={kinetixColors.lime}
          strokeLinecap="round"
          strokeWidth={3}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: kinetixColors.graphite,
    flex: 1,
  },
  page: {
    gap: 18,
    padding: 20,
  },
  hero: {
    backgroundColor: kinetixColors.ink,
    borderRadius: 20,
    gap: 8,
    overflow: 'hidden',
    padding: 22,
    paddingBottom: 52,
  },
  routeMark: {
    bottom: 0,
    left: 0,
    opacity: 0.9,
    position: 'absolute',
    right: 0,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  wordmark: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 3.4,
  },
  emblem: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 31,
  },
  heroLine: {
    color: 'rgba(255, 255, 255, 0.76)',
    fontSize: 15,
    lineHeight: 21,
  },
  choices: {
    gap: 12,
  },
  row: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 14,
    minHeight: 84,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  rowPrimary: {
    backgroundColor: kinetixColors.amber,
  },
  rowPlain: {
    backgroundColor: kinetixColors.surface,
    borderColor: kinetixColors.line,
    borderWidth: 1,
  },
  rowIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  rowIconPrimary: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  rowIconPlain: {
    backgroundColor: kinetixColors.amberSoft,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: kinetixColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  rowTitlePrimary: {
    color: '#FFFFFF',
  },
  rowSubtitle: {
    color: kinetixColors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
  },
  rowSubtitlePrimary: {
    color: 'rgba(255, 255, 255, 0.88)',
  },
  demo: {
    backgroundColor: kinetixColors.surfaceRaised,
    borderRadius: 16,
    gap: 10,
    padding: 16,
  },
  demoTitle: {
    color: kinetixColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  demoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  demoButton: {
    alignItems: 'center',
    backgroundColor: kinetixColors.surface,
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  demoBusy: {
    opacity: 0.6,
  },
  demoButtonText: {
    color: kinetixColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  demoError: {
    color: kinetixColors.danger,
    fontSize: 13,
  },
  footer: {
    gap: 2,
  },
  footerButton: {
    alignItems: 'center',
    paddingVertical: 11,
  },
  footerStrong: {
    color: kinetixColors.amber,
    fontSize: 16,
    fontWeight: '700',
  },
  footerMuted: {
    color: kinetixColors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.78,
  },
});
