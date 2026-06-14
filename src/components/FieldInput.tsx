import { StyleSheet, Text, TextInput, View } from 'react-native';

import { RegistrationField } from '../data/registration';
import { kx } from '../theme/kinetixTheme';

type FieldInputProps = {
  field: RegistrationField;
  value: string;
  onChangeText: (value: string) => void;
};

export function FieldInput({ field, value, onChangeText }: FieldInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {field.label}
        {field.required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        autoCapitalize={field.keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={false}
        keyboardType={field.keyboardType ?? 'default'}
        onChangeText={onChangeText}
        placeholder={field.placeholder}
        placeholderTextColor={kx.text.muted}
        secureTextEntry={field.secureTextEntry}
        style={styles.input}
        textContentType={field.textContentType}
        value={value}
      />
      {field.helper ? <Text style={styles.helper}>{field.helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 7,
  },
  helper: {
    color: kx.text.secondary,
    fontSize: 12,
    lineHeight: 18,
  },
  input: {
    backgroundColor: kx.surface.input,
    borderColor: kx.border.muted,
    borderRadius: kx.radius.control,
    borderWidth: 1,
    color: kx.text.primary,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    minHeight: 58,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  label: {
    color: kx.text.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  required: {
    color: kx.color.danger,
  },
});
