import { StyleSheet, Text, TextInput, View } from 'react-native';

import { RegistrationField } from '../data/registration';

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
        placeholderTextColor="#8A8F98"
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
    color: '#68717D',
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    color: '#20242A',
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  label: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '700',
  },
  required: {
    color: '#C75319',
  },
});
