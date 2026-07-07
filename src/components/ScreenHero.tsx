import type { ComponentType, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, type LucideProps, Menu as MenuIcon } from 'lucide-react-native';

import { kinetixColors } from '../theme/kinetixTokens';
import { PressableScale } from './KinetixUI';

type ScreenHeroProps = {
  title: string;
  subtitle?: string;
  onBack: () => void;
  // ☰ справа — переход на главный экран, где открывается боковое меню.
  onMenu?: () => void;
  Icon?: ComponentType<LucideProps>;
  right?: ReactNode;
  // Отрицательные поля, чтобы hero уходил в край поверх padding страницы.
  bleed?: number;
};

// Единый тёмный премиальный заголовок для вложенных экранов (История,
// Рефералы, Адрес, Подписка и т.д.) — тот же язык, что hero на главной.
export function ScreenHero({ title, subtitle, onBack, onMenu, Icon, right, bleed = 16 }: ScreenHeroProps) {
  return (
    <View style={[styles.hero, { marginHorizontal: -bleed, marginTop: -bleed }]}>
      <View style={styles.glow} />
      <View style={styles.top}>
        <PressableScale
          accessibilityLabel="Назад"
          accessibilityRole="button"
          onPress={onBack}
          style={styles.back}
        >
          <ArrowLeft color={kinetixColors.lime} size={21} strokeWidth={2.3} />
        </PressableScale>
        {right ??
          (onMenu ? (
            <PressableScale
              accessibilityLabel="Меню"
              accessibilityRole="button"
              onPress={onMenu}
              style={styles.back}
            >
              <MenuIcon color={kinetixColors.lime} size={21} strokeWidth={2.3} />
            </PressableScale>
          ) : null)}
      </View>
      <View style={styles.main}>
        {Icon ? (
          <View style={styles.icon}>
            <Icon color={kinetixColors.lime} size={23} strokeWidth={2.3} />
          </View>
        ) : null}
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? (
            <Text numberOfLines={2} style={styles.sub}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(92, 230, 160, 0.22)',
    borderRadius: 13,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  glow: {
    backgroundColor: 'rgba(92, 230, 160, 0.10)',
    borderRadius: 90,
    height: 180,
    position: 'absolute',
    right: -40,
    top: -30,
    width: 180,
  },
  hero: {
    backgroundColor: '#0A1411',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: 'hidden',
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 22,
    position: 'relative',
  },
  icon: {
    alignItems: 'center',
    backgroundColor: 'rgba(92, 230, 160, 0.12)',
    borderColor: 'rgba(92, 230, 160, 0.22)',
    borderRadius: 16,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  main: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 16,
    position: 'relative',
    zIndex: 1,
  },
  sub: {
    color: '#93BAA8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  title: {
    color: '#F2FBF6',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  top: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 1,
  },
});
