import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { normalizeAccountRole } from '../data/registration';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';
import { kinetixColors } from '../theme/kinetixTokens';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;
type Step = 'phone' | 'code';

const CODE_LENGTH = 4;

// Показываем телефон как +7 999 123-45-67, а на сервер шлём только цифры.
function formatPhone(digits: string) {
  const rest = digits.slice(1);
  const parts = [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 8), rest.slice(8, 10)].filter(Boolean);

  if (!parts.length) {
    return '+7';
  }

  return `+7 ${parts[0]}${parts[1] ? ` ${parts[1]}` : ''}${parts[2] ? `-${parts[2]}` : ''}${
    parts[3] ? `-${parts[3]}` : ''
  }`;
}

function readDigits(value: string) {
  const digits = value.replace(/\D/g, '');
  const withoutCountry = digits.startsWith('8') ? `7${digits.slice(1)}` : digits;

  return `7${withoutCountry.replace(/^7/, '').slice(0, 10)}`;
}

export function SignInScreen({ navigation }: Props) {
  const { confirmSmsLoginCode, requestSmsLoginCode } = useAppState();
  const [step, setStep] = useState<Step>('phone');
  const [digits, setDigits] = useState('7');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useRef<TextInput>(null);

  const phoneReady = digits.length === 11;
  const codeReady = code.length === CODE_LENGTH;
  const phone = useMemo(() => `+${digits}`, [digits]);

  // Обратный отсчёт до повторной отправки: сервер не примет запрос чаще
  // раза в минуту, и человек должен видеть, сколько ждать.
  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') {
      const focus = setTimeout(() => codeInput.current?.focus(), 250);

      return () => clearTimeout(focus);
    }

    return undefined;
  }, [step]);

  const sendCode = async () => {
    if (busy || !phoneReady || cooldown > 0) {
      return;
    }

    setBusy(true);
    setError(null);
    const result = await requestSmsLoginCode(phone);
    setBusy(false);

    if (!result) {
      setError('Не удалось отправить код. Проверьте связь и попробуйте ещё раз.');
      return;
    }

    setStep('code');
    setCode('');
    setCooldown(60);
    // В демо-режиме сервер возвращает код прямо в ответе — показываем его,
    // чтобы приложение можно было проверить без реальных SMS.
    setHint(result.deliveryMode === 'mvp-returned-code' && result.code ? `Код для проверки: ${result.code}` : null);
  };

  const submitCode = async () => {
    if (busy || !codeReady) {
      return;
    }

    setBusy(true);
    setError(null);
    const user = await confirmSmsLoginCode(phone, code);
    setBusy(false);

    if (!user) {
      setError('Код не подошёл. Проверьте цифры или запросите новый.');
      setCode('');
      return;
    }

    navigation.replace('Dashboard', {
      firstName: user.firstName || undefined,
      role: normalizeAccountRole(user.role),
    });
  };

  const goBack = () => {
    if (step === 'code') {
      setStep('phone');
      setError(null);
      setHint(null);
      return;
    }

    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityLabel="Назад"
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <ArrowLeft color={kinetixColors.textPrimary} size={22} strokeWidth={2.4} />
        </Pressable>

        <Text style={styles.title}>{step === 'phone' ? 'Вход' : 'Код из SMS'}</Text>
        <Text style={styles.subtitle}>
          {step === 'phone'
            ? 'Введите номер телефона — пришлём код для входа.'
            : `Отправили на ${formatPhone(digits)}`}
        </Text>

        {step === 'phone' ? (
          <TextInput
            accessibilityLabel="Номер телефона"
            autoFocus
            keyboardType="phone-pad"
            onChangeText={(value) => setDigits(readDigits(value))}
            onSubmitEditing={sendCode}
            placeholder="+7 999 123-45-67"
            placeholderTextColor={kinetixColors.textMuted}
            style={styles.input}
            value={formatPhone(digits)}
          />
        ) : (
          <TextInput
            accessibilityLabel="Код из SMS"
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            onSubmitEditing={submitCode}
            ref={codeInput}
            style={[styles.input, styles.codeInput]}
            value={code}
          />
        )}

        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy || (step === 'phone' ? !phoneReady : !codeReady)}
          onPress={step === 'phone' ? sendCode : submitCode}
          style={({ pressed }) => [
            styles.primary,
            (busy || (step === 'phone' ? !phoneReady : !codeReady)) && styles.primaryDisabled,
            pressed && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.primaryText}>{step === 'phone' ? 'Получить код' : 'Войти'}</Text>
              <ArrowRight color="#FFFFFF" size={20} strokeWidth={2.6} />
            </>
          )}
        </Pressable>

        {step === 'code' ? (
          <Pressable
            accessibilityRole="button"
            disabled={cooldown > 0 || busy}
            onPress={sendCode}
            style={({ pressed }) => [styles.resend, pressed && styles.pressed]}
          >
            <Text style={[styles.resendText, cooldown > 0 && styles.resendTextMuted]}>
              {cooldown > 0 ? `Новый код через ${cooldown} с` : 'Отправить код заново'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Registration')}
          style={({ pressed }) => [styles.resend, pressed && styles.pressed]}
        >
          <Text style={styles.resendText}>Ещё нет аккаунта — зарегистрироваться</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: kinetixColors.graphite,
    flex: 1,
  },
  page: {
    gap: 14,
    padding: 20,
    paddingTop: 8,
  },
  back: {
    alignItems: 'center',
    backgroundColor: kinetixColors.surface,
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    marginBottom: 10,
    width: 44,
  },
  title: {
    color: kinetixColors.textPrimary,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: kinetixColors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 6,
  },
  input: {
    backgroundColor: kinetixColors.surface,
    borderColor: kinetixColors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: kinetixColors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    height: 60,
    letterSpacing: 0.4,
    paddingHorizontal: 18,
  },
  codeInput: {
    fontSize: 30,
    letterSpacing: 12,
    textAlign: 'center',
  },
  hint: {
    color: kinetixColors.textSecondary,
    fontSize: 14,
  },
  error: {
    color: kinetixColors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  primary: {
    alignItems: 'center',
    backgroundColor: kinetixColors.amber,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    height: 58,
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryDisabled: {
    backgroundColor: kinetixColors.disabled,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  resend: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendText: {
    color: kinetixColors.amber,
    fontSize: 15,
    fontWeight: '600',
  },
  resendTextMuted: {
    color: kinetixColors.textMuted,
  },
  pressed: {
    opacity: 0.75,
  },
});
