import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { kx } from '../theme/kinetixTheme';

type ConsentToggleProps = {
  label: string;
  text: string;
  checked: boolean;
  onToggle: () => void;
};

export function ConsentToggle({ label, text, checked, onToggle }: ConsentToggleProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, pressed && styles.pressedRow]}
    >
      <View style={[styles.box, checked && styles.checkedBox]}>
        {checked ? <Check color={kx.color.graphite} size={16} strokeWidth={3} /> : null}
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    backgroundColor: kx.surface.input,
    borderColor: kx.color.amber,
    borderRadius: kx.radius.control,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkedBox: {
    backgroundColor: kx.color.amber,
    borderColor: kx.color.amber,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  label: {
    color: kx.text.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  pressedRow: {
    opacity: 0.82,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  text: {
    color: kx.text.secondary,
    fontSize: 12,
    lineHeight: 17,
  },
});
