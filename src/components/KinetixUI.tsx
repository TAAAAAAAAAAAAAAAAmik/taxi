import { ReactNode, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { X } from 'lucide-react-native';

import { kinetixColors, kinetixRadii, kinetixSpacing } from '../theme/kinetixTokens';
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference';

type KinetixCardProps = {
  children: ReactNode;
  tone?: 'plain' | 'accent' | 'soft';
  style?: StyleProp<ViewStyle>;
};

export function KinetixCard({ children, style, tone = 'plain' }: KinetixCardProps) {
  return <View style={[styles.card, tone === 'accent' && styles.cardAccent, tone === 'soft' && styles.cardSoft, style]}>{children}</View>;
}

type KinetixButtonProps = {
  children?: ReactNode;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function KinetixButton({
  children,
  disabled,
  label,
  onPress,
  style,
  tone = 'primary',
}: KinetixButtonProps) {
  const textStyle =
    tone === 'primary' ? styles.buttonTextPrimary : tone === 'danger' ? styles.buttonTextDanger : styles.buttonTextSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'secondary' && styles.buttonSecondary,
        tone === 'danger' && styles.buttonDanger,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {children}
      <Text numberOfLines={1} style={textStyle}>{label}</Text>
    </Pressable>
  );
}

type KinetixStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function KinetixStatus({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: KinetixStatusTone;
}) {
  return (
    <View style={[styles.status, statusToneStyles[tone]]}>
      <View style={[styles.statusDot, statusDotStyles[tone]]} />
      <Text numberOfLines={1} style={[styles.statusText, statusTextStyles[tone]]}>{label}</Text>
    </View>
  );
}

export function KinetixEmptyState({
  action,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  description: string;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <KinetixCard tone="soft" style={styles.empty}>
      <View style={styles.emptyIcon}>{icon ?? <View style={styles.emptyGlyph} />}</View>
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>{description}</Text>
      </View>
      {action}
    </KinetixCard>
  );
}

export function KinetixSkeleton({
  rows = 3,
}: {
  rows?: number;
}) {
  const reducedMotion = useReducedMotionPreference();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      shimmer.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(shimmer, {
        duration: 1450,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: false,
      }),
    );

    animation.start();

    return () => animation.stop();
  }, [reducedMotion, shimmer]);

  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, 220],
  });

  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={styles.skeletonCard}>
          <View style={styles.skeletonTopRow}>
            <View style={[styles.skeletonLine, styles.skeletonShort]} />
            <View style={[styles.skeletonLine, styles.skeletonPrice]} />
          </View>
          <View style={[styles.skeletonLine, styles.skeletonLong]} />
          {!reducedMotion ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.skeletonSheen,
                {
                  transform: [{ translateX: shimmerTranslate }, { rotate: '12deg' }],
                },
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

type KinetixBottomSheetProps = {
  children: ReactNode;
  onClose: () => void;
  subtitle?: string;
  title: string;
  visible: boolean;
};

export function KinetixBottomSheet({
  children,
  onClose,
  subtitle,
  title,
  visible,
}: KinetixBottomSheetProps) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.sheetRoot}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetScrim} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleCopy}>
              <Text numberOfLines={1} style={styles.sheetTitle}>{title}</Text>
              {subtitle ? <Text numberOfLines={1} style={styles.sheetSubtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable
              accessibilityLabel="Закрыть"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.sheetClose, pressed && styles.pressed]}
            >
              <X color={kinetixColors.amber} size={21} strokeWidth={2.5} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: kinetixColors.amber,
    borderColor: kinetixColors.amber,
    borderRadius: kinetixRadii.control,
    borderWidth: 1,
    elevation: 2,
    flexDirection: 'row',
    gap: kinetixSpacing.xs,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: kinetixSpacing.md,
    shadowColor: 'rgba(0, 111, 58, 0.24)',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
  },
  buttonDanger: {
    backgroundColor: '#FFF3F1',
    borderColor: 'rgba(255, 59, 48, 0.34)',
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonSecondary: {
    backgroundColor: kinetixColors.surface,
    borderColor: 'rgba(0, 141, 73, 0.28)',
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonTextDanger: {
    color: '#B43129',
    fontSize: 14,
    fontWeight: '900',
  },
  buttonTextPrimary: {
    color: kinetixColors.graphite,
    fontSize: 14,
    fontWeight: '900',
  },
  buttonTextSecondary: {
    color: kinetixColors.amber,
    fontSize: 14,
    fontWeight: '900',
  },
  card: {
    backgroundColor: kinetixColors.surface,
    borderColor: 'rgba(18, 56, 44, 0.12)',
    borderRadius: kinetixRadii.card,
    borderWidth: 1,
    elevation: 1,
    shadowColor: 'rgba(18, 56, 44, 0.16)',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardAccent: {
    borderColor: 'rgba(0, 141, 73, 0.24)',
    elevation: 3,
    shadowOpacity: 0.12,
  },
  cardSoft: {
    backgroundColor: kinetixColors.surfaceLight,
    borderColor: 'rgba(0, 141, 73, 0.18)',
  },
  disabled: {
    backgroundColor: kinetixColors.disabled,
    borderColor: kinetixColors.disabled,
    shadowOpacity: 0,
  },
  empty: {
    alignItems: 'flex-start',
    gap: kinetixSpacing.sm,
    padding: kinetixSpacing.md,
  },
  emptyCopy: {
    gap: kinetixSpacing.xs,
  },
  emptyGlyph: {
    backgroundColor: kinetixColors.amber,
    borderRadius: 999,
    height: 14,
    width: 14,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: kinetixColors.amberSoft,
    borderRadius: kinetixRadii.control,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  emptyText: {
    color: kinetixColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyTitle: {
    color: kinetixColors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  sheet: {
    backgroundColor: kinetixColors.graphite,
    borderTopLeftRadius: kinetixRadii.sheet,
    borderTopRightRadius: kinetixRadii.sheet,
    gap: kinetixSpacing.md,
    maxHeight: '86%',
    padding: kinetixSpacing.md,
  },
  sheetClose: {
    alignItems: 'center',
    backgroundColor: kinetixColors.surface,
    borderColor: 'rgba(0, 141, 73, 0.28)',
    borderRadius: kinetixRadii.control,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(18, 56, 44, 0.22)',
    borderRadius: 999,
    height: 4,
    width: 48,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: kinetixSpacing.md,
    justifyContent: 'space-between',
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetScrim: {
    backgroundColor: 'rgba(18, 56, 44, 0.34)',
    flex: 1,
  },
  sheetSubtitle: {
    color: kinetixColors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  sheetTitle: {
    color: kinetixColors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  sheetTitleCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  skeletonCard: {
    backgroundColor: kinetixColors.surfaceRaised,
    borderColor: 'rgba(18, 56, 44, 0.08)',
    borderRadius: kinetixRadii.card,
    borderWidth: 1,
    gap: kinetixSpacing.sm,
    overflow: 'hidden',
    padding: kinetixSpacing.sm,
  },
  skeletonLine: {
    backgroundColor: 'rgba(11, 47, 37, 0.1)',
    borderRadius: 999,
    height: 12,
  },
  skeletonList: {
    gap: kinetixSpacing.xs,
  },
  skeletonLong: {
    width: '72%',
  },
  skeletonPrice: {
    width: 64,
  },
  skeletonShort: {
    width: '38%',
  },
  skeletonSheen: {
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    bottom: -22,
    position: 'absolute',
    top: -22,
    width: 74,
  },
  skeletonTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  status: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    minHeight: 28,
    paddingHorizontal: 10,
  },
  statusDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
  },
});

const statusToneStyles: Record<KinetixStatusTone, ViewStyle> = {
  danger: { backgroundColor: 'rgba(255, 59, 48, 0.12)' },
  info: { backgroundColor: kinetixColors.tealSoft },
  neutral: { backgroundColor: 'rgba(18, 56, 44, 0.08)' },
  success: { backgroundColor: kinetixColors.amberSoft },
  warning: { backgroundColor: 'rgba(231, 180, 22, 0.16)' },
};

const statusDotStyles: Record<KinetixStatusTone, ViewStyle> = {
  danger: { backgroundColor: kinetixColors.danger },
  info: { backgroundColor: kinetixColors.teal },
  neutral: { backgroundColor: kinetixColors.textMuted },
  success: { backgroundColor: kinetixColors.success },
  warning: { backgroundColor: kinetixColors.warning },
};

const statusTextStyles = StyleSheet.create({
  danger: { color: '#B43129' },
  info: { color: kinetixColors.teal },
  neutral: { color: kinetixColors.textSecondary },
  success: { color: kinetixColors.amber },
  warning: { color: '#7A5520' },
});
