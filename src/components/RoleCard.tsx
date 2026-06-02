import { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LucideProps } from 'lucide-react-native';

import { kx } from '../theme/kinetixTheme';

type RoleCardProps = {
  title: string;
  subtitle: string;
  active: boolean;
  Icon: ComponentType<LucideProps>;
  onPress: () => void;
};

export function RoleCard({ title, subtitle, active, Icon, onPress }: RoleCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        active && styles.activeCard,
        pressed && styles.pressedCard,
      ]}
    >
      <View style={[styles.iconWrap, active && styles.activeIconWrap]}>
        <Icon color={active ? kx.color.graphite : kx.color.amber} size={20} strokeWidth={2.2} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, active && styles.activeTitle]}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  activeCard: {
    backgroundColor: kx.surface.selected,
    borderColor: kx.color.amber,
  },
  activeIconWrap: {
    backgroundColor: kx.color.amber,
  },
  activeTitle: {
    color: kx.color.graphite,
  },
  card: {
    alignItems: 'flex-start',
    backgroundColor: kx.surface.card,
    borderColor: kx.color.amber,
    borderRadius: kx.radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
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
  pressedCard: {
    opacity: 0.82,
  },
  subtitle: {
    color: kx.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    color: kx.text.primary,
    fontSize: 16,
    fontWeight: '800',
  },
});
