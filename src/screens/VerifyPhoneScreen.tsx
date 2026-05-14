import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MessageSquareText, Phone, ShieldCheck } from 'lucide-react-native';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyPhone'>;

export function VerifyPhoneScreen({ navigation, route }: Props) {
  const { email, firstName, phone, role } = route.params;
  const [code, setCode] = useState('');
  const canContinue = code.trim().length >= 4;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Phone color="#146C5D" size={30} strokeWidth={2.4} />
          </View>
          <Text style={styles.title}>Подтверждение телефона</Text>
          <Text style={styles.subtitle}>
            Введите код из SMS или мессенджера. Сейчас это заготовка экрана, позже код будет
            приходить через API.
          </Text>
          <Text style={styles.target}>{phone || 'Телефон из анкеты'}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Код подтверждения</Text>
            <TextInput
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={setCode}
              placeholder="0000"
              placeholderTextColor="#8A8F98"
              style={styles.input}
              value={code}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canContinue}
            onPress={() =>
              navigation.navigate('VerifyEmail', {
                email,
                firstName,
                role,
              })
            }
            style={({ pressed }) => [
              styles.primaryButton,
              !canContinue && styles.primaryButtonMuted,
              pressed && styles.pressed,
            ]}
          >
            <ShieldCheck color="#FFFFFF" size={19} strokeWidth={2.4} />
            <Text style={styles.primaryButtonText}>Подтвердить телефон</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <MessageSquareText color="#146C5D" size={18} strokeWidth={2.4} />
            <Text style={styles.secondaryButtonText}>Отправить код повторно</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 18,
  },
  field: {
    gap: 8,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    color: '#20242A',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    minHeight: 56,
    paddingHorizontal: 14,
  },
  label: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#F4F7F5',
    justifyContent: 'center',
    minHeight: '100%',
    padding: 16,
  },
  pressed: {
    opacity: 0.76,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#146C5D',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  primaryButtonMuted: {
    backgroundColor: '#89958F',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#F4F7F5',
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#146C5D',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#146C5D',
    fontSize: 14,
    fontWeight: '900',
  },
  subtitle: {
    color: '#59616C',
    fontSize: 15,
    lineHeight: 22,
  },
  target: {
    color: '#146C5D',
    fontSize: 16,
    fontWeight: '900',
  },
  title: {
    color: '#20242A',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
});
