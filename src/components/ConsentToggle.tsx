import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

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
        {checked ? <Check color="#FFFFFF" size={16} strokeWidth={3} /> : null}
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
    backgroundColor: '#FFFFFF',
    borderColor: '#AEB8C4',
    borderRadius: 6,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkedBox: {
    backgroundColor: '#146C5D',
    borderColor: '#146C5D',
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  label: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '800',
  },
  pressedRow: {
    opacity: 0.75,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  text: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
});
