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
        placeholderTextColor="#A89F91"
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
    gap: 8,
  },
  helper: {
    color: kx.text.secondary,
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    backgroundColor: kx.surface.input,
    borderColor: kx.text.secondary,
    borderRadius: kx.radius.control,
    borderWidth: 1,
    color: kx.text.primary,
    fontSize: 16,
    minHeight: kx.touch.regular,
    paddingHorizontal: 14,
  },
  label: {
    color: kx.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  required: {
    color: kx.color.danger,
  },
});
