import { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LucideProps } from 'lucide-react-native';

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
        <Icon color={active ? '#FFFFFF' : '#146C5D'} size={20} strokeWidth={2.2} />
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
    backgroundColor: '#E9F4F1',
    borderColor: '#146C5D',
  },
  activeIconWrap: {
    backgroundColor: '#146C5D',
  },
  activeTitle: {
    color: '#0B4C42',
  },
  card: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
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
    backgroundColor: '#EAF1EF',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  pressedCard: {
    opacity: 0.82,
  },
  subtitle: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    color: '#20242A',
    fontSize: 16,
    fontWeight: '800',
  },
});
