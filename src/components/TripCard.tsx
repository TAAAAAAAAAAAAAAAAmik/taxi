import { ReactNode } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Car, Truck } from 'lucide-react-native';

import {
  kinetixBorders,
  kinetixColors,
  kinetixIconography,
  kinetixRadii,
  kinetixSpacing,
  kinetixTouchTargets,
  kinetixTypography,
} from '../theme/kinetixTokens';

export type TripCardServiceType = 'taxi' | 'delivery';

type TripCardProps = {
  children?: ReactNode;
  dateTimeLabel: string;
  destination: string;
  driverLabel: string;
  onPress?: () => void;
  pickup: string;
  priceLabel?: string;
  serviceType?: TripCardServiceType;
  statusLabel: string;
  style?: StyleProp<ViewStyle>;
  title: string;
  tone?: 'active' | 'done';
};

export function TripCard({
  children,
  dateTimeLabel,
  destination,
  driverLabel,
  onPress,
  pickup,
  priceLabel,
  serviceType = 'taxi',
  statusLabel,
  style,
  title,
  tone = 'done',
}: TripCardProps) {
  const Icon = serviceType === 'delivery' ? Truck : Car;
  const active = tone === 'active';
  const content = (
    <>
      <View style={styles.mainRow}>
        <View style={[styles.thumbnail, active && styles.thumbnailActive]}>
          <Icon
            color={active ? kinetixColors.surface : kinetixColors.amber}
            size={kinetixIconography.sizes.regular}
            strokeWidth={2.35}
          />
        </View>

        <View style={styles.copy}>
          <View style={styles.headerRow}>
            <Text numberOfLines={1} style={styles.title}>{title}</Text>
            <Text numberOfLines={1} style={[styles.status, active && styles.statusActive]}>
              {statusLabel}
            </Text>
          </View>

          <View style={styles.addressBlock}>
            <Text numberOfLines={1} style={styles.addressText}>Откуда: {pickup || 'не указано'}</Text>
            <Text numberOfLines={1} style={styles.addressText}>Куда: {destination || 'не указано'}</Text>
            <Text numberOfLines={1} style={styles.driverText}>{driverLabel}</Text>
          </View>

          <View style={styles.footerRow}>
            <Text numberOfLines={1} style={styles.dateText}>{dateTimeLabel}</Text>
            {priceLabel ? <Text numberOfLines={1} style={styles.price}>{priceLabel}</Text> : null}
          </View>
        </View>
      </View>

      {children ? <View style={styles.extra}>{children}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          active && styles.cardActive,
          pressed && styles.pressed,
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.card, active && styles.cardActive, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  addressBlock: {
    gap: kinetixSpacing.xxs,
  },
  addressText: {
    color: kinetixColors.textSecondary,
    fontSize: kinetixTypography.sizes.caption,
    fontWeight: kinetixTypography.weights.medium,
    lineHeight: kinetixTypography.lineHeights.caption,
  },
  card: {
    backgroundColor: kinetixColors.surface,
    borderColor: kinetixColors.line,
    borderRadius: kinetixRadii.card,
    borderWidth: kinetixBorders.hairline,
    elevation: 2,
    gap: kinetixSpacing.sm,
    padding: kinetixSpacing.sm,
    shadowColor: kinetixColors.shadow,
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
  },
  cardActive: {
    borderColor: kinetixColors.amber,
  },
  copy: {
    flex: 1,
    gap: kinetixSpacing.xs,
    minWidth: 0,
  },
  dateText: {
    color: kinetixColors.textMuted,
    flex: 1,
    fontSize: kinetixTypography.sizes.caption,
    fontWeight: kinetixTypography.weights.semibold,
    minWidth: 0,
  },
  driverText: {
    color: kinetixColors.textSecondary,
    fontSize: kinetixTypography.sizes.caption,
    fontWeight: kinetixTypography.weights.semibold,
    lineHeight: kinetixTypography.lineHeights.caption,
  },
  extra: {
    gap: kinetixSpacing.xs,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: kinetixSpacing.xs,
    justifyContent: 'space-between',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: kinetixSpacing.xs,
  },
  mainRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: kinetixSpacing.sm,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  price: {
    color: kinetixColors.textPrimary,
    flexShrink: 0,
    fontSize: kinetixTypography.sizes.meta,
    fontWeight: kinetixTypography.weights.bold,
  },
  status: {
    backgroundColor: kinetixColors.amberSoft,
    borderColor: kinetixColors.amberSoft,
    borderRadius: kinetixRadii.mapPin,
    borderWidth: kinetixBorders.hairline,
    color: kinetixColors.amber,
    flexShrink: 0,
    fontSize: kinetixTypography.sizes.caption - 1,
    fontWeight: kinetixTypography.weights.bold,
    maxWidth: 112,
    overflow: 'hidden',
    paddingHorizontal: kinetixSpacing.xs,
    paddingVertical: kinetixSpacing.xxs,
  },
  statusActive: {
    backgroundColor: kinetixColors.amber,
    borderColor: kinetixColors.amber,
    color: kinetixColors.surface,
  },
  thumbnail: {
    alignItems: 'center',
    backgroundColor: kinetixColors.amberSoft,
    borderColor: kinetixColors.line,
    borderRadius: kinetixRadii.card,
    borderWidth: kinetixBorders.hairline,
    height: kinetixTouchTargets.iconLarge - kinetixSpacing.xxs,
    justifyContent: 'center',
    width: kinetixTouchTargets.iconLarge - kinetixSpacing.xxs,
  },
  thumbnailActive: {
    backgroundColor: kinetixColors.amber,
    borderColor: kinetixColors.amber,
  },
  title: {
    color: kinetixColors.textPrimary,
    flex: 1,
    fontSize: kinetixTypography.sizes.meta,
    fontWeight: kinetixTypography.weights.bold,
    lineHeight: kinetixTypography.lineHeights.meta,
    minWidth: 0,
  },
});
