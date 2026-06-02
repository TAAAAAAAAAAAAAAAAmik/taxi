import { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Mail, Send, ShieldCheck } from 'lucide-react-native';
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
import { useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

export function VerifyEmailScreen({ navigation, route }: Props) {
  const { email, firstName, role } = route.params;
  const { requestVerificationCode, serverMessage, verifyContactCode } = useAppState();
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [notice, setNotice] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const canContinue = code.trim().length >= 4 && !isVerifying;

  const sendCode = async () => {
    if (!email) {
      setNotice('В анкете нет почты для подтверждения.');
      return;
    }

    setIsSending(true);
    setNotice('');
    const result = await requestVerificationCode('email', email);
    setIsSending(false);

    if (!result) {
      setNotice(serverMessage || 'Backend не создал код подтверждения.');
      return;
    }

    setDemoCode(result.code ?? '');
    setNotice(
      result.deliveryMode === 'mvp-returned-code' && result.code
        ? `MVP-код создан и действует до ${formatTime(result.expiresAt)}.`
        : 'Код подтверждения отправлен по выбранному каналу.',
    );
  };

  useEffect(() => {
    void sendCode();
  }, []);

  const handleVerify = async () => {
    setIsVerifying(true);
    setNotice('');
    const user = await verifyContactCode('email', code, email);
    setIsVerifying(false);

    if (!user) {
      setNotice(serverMessage || 'Код почты не подошел.');
      return;
    }

    navigation.replace(role === 'client' ? 'OrderFlow' : 'Dashboard', {
      firstName,
      role,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Mail color="#D4A853" size={30} strokeWidth={2.4} />
          </View>
          <Text style={styles.title}>Подтверждение почты</Text>
          <Text style={styles.subtitle}>
            Почту подтверждаем кодом или ссылкой. В MVP backend создает код и показывает его здесь,
            пароль от почты пользователя по-прежнему не нужен.
          </Text>
          <Text style={styles.target}>{email || 'Почта из анкеты'}</Text>
          {demoCode ? <Text style={styles.demoCode}>MVP-код: {demoCode}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <View style={styles.field}>
            <Text style={styles.label}>Код из письма</Text>
            <TextInput
              autoCapitalize="characters"
              maxLength={8}
              onChangeText={setCode}
              placeholder="A1B2"
              placeholderTextColor="#A89F91"
              style={styles.input}
              value={code}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canContinue}
            onPress={handleVerify}
            style={({ pressed }) => [
              styles.primaryButton,
              !canContinue && styles.primaryButtonMuted,
              pressed && styles.pressed,
            ]}
          >
            <ShieldCheck color="#F5F0E8" size={19} strokeWidth={2.4} />
            <Text style={styles.primaryButtonText}>
              {isVerifying ? 'Проверяем...' : 'Открыть кабинет'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isSending}
            onPress={sendCode}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Send color="#D4A853" size={18} strokeWidth={2.4} />
            <Text style={styles.secondaryButtonText}>
              {isSending ? 'Отправляем...' : 'Отправить письмо повторно'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 18,
  },
  demoCode: {
    backgroundColor: '#37322E',
    borderRadius: 8,
    color: '#D4A853',
    fontSize: 18,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  field: {
    gap: 8,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: '#37322E',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  input: {
    backgroundColor: '#2C2926',
    borderColor: '#A89F91',
    borderRadius: 8,
    borderWidth: 1,
    color: '#F5F0E8',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    minHeight: 56,
    paddingHorizontal: 14,
  },
  label: {
    color: '#F5F0E8',
    fontSize: 14,
    fontWeight: '900',
  },
  notice: {
    color: '#A89F91',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  page: {
    backgroundColor: '#1E1C1A',
    justifyContent: 'center',
    minHeight: '100%',
    padding: 16,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.95 }],
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#D4A853',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  primaryButtonMuted: {
    backgroundColor: '#5A544E',
  },
  primaryButtonText: {
    color: '#1E1C1A',
    fontSize: 15,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#1E1C1A',
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#D4A853',
    fontSize: 14,
    fontWeight: '900',
  },
  subtitle: {
    color: '#A89F91',
    fontSize: 15,
    lineHeight: 22,
  },
  target: {
    color: '#D4A853',
    fontSize: 16,
    fontWeight: '900',
  },
  title: {
    color: '#F5F0E8',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
});

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
