import { ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LucideProps } from 'lucide-react-native';

import { kx } from '../theme/kinetixTheme';
import { PressableScale } from './KinetixUI';

type RoleCardProps = {
  title: string;
  subtitle: string;
  active: boolean;
  Icon: ComponentType<LucideProps>;
  onPress: () => void;
};

export function RoleCard({ title, subtitle, active, Icon, onPress }: RoleCardProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, active && styles.activeCard]}
    >
      <View style={[styles.iconWrap, active && styles.activeIconWrap]}>
        <Icon color={active ? '#FFFFFF' : kx.color.amber} size={20} strokeWidth={2.2} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, active && styles.activeTitle]}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  activeCard: {
    backgroundColor: '#F1F8F3',
    borderColor: kx.color.amber,
    borderWidth: 1.5,
  },
  activeIconWrap: {
    backgroundColor: kx.color.amber,
  },
  activeTitle: {
    color: kx.text.primary,
  },
  card: {
    alignItems: 'flex-start',
    backgroundColor: kx.surface.card,
    borderColor: kx.border.muted,
    borderRadius: kx.radius.card,
    borderWidth: 1,
    elevation: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 82,
    padding: 14,
    shadowColor: kx.color.shadow,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: kx.surface.raised,
    borderRadius: kx.radius.card,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  subtitle: {
    color: kx.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  title: {
    color: kx.text.primary,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
});
