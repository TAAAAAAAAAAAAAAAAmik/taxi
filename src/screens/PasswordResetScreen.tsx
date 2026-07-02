import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyRound, Mail, MessageSquareText, ShieldCheck } from 'lucide-react-native';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AccountRole, normalizeAccountRole } from '../data/registration';
import { RootStackParamList } from '../navigation/types';
import { AuthDeliveryChannel } from '../services/apiClient';
import { useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'PasswordReset'>;

const deliveryOptions: Array<{
  channel: AuthDeliveryChannel;
  label: string;
}> = [
  { channel: 'email', label: 'Email' },
  { channel: 'sms', label: 'SMS' },
  { channel: 'telegram', label: 'Telegram' },
  { channel: 'max', label: 'MAX' },
];

export function PasswordResetScreen({ navigation }: Props) {
  const { confirmPasswordReset, requestPasswordResetCode, serverMessage } = useAppState();
  const [identifier, setIdentifier] = useState('');
  const [deliveryChannel, setDeliveryChannel] = useState<AuthDeliveryChannel>('email');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [notice, setNotice] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const canRequest = identifier.trim().length > 2 && !isSending;
  const canConfirm =
    identifier.trim().length > 2 &&
    code.trim().length >= 4 &&
    password.length >= 4 &&
    password === passwordRepeat &&
    !isConfirming;

  const handleRequestCode = async () => {
    setIsSending(true);
    setNotice('');
    setDemoCode('');
    const result = await requestPasswordResetCode(identifier, deliveryChannel);
    setIsSending(false);

    if (!result) {
      setNotice(serverMessage || 'Не удалось отправить код восстановления.');
      return;
    }

    setDemoCode(result.code ?? '');
    setNotice(
      result.deliveryMode === 'mvp-returned-code' && result.code
        ? `MVP-код создан и действует до ${formatTime(result.expiresAt)}.`
        : 'Если аккаунт найден, код восстановления отправлен выбранным каналом.',
    );
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    setNotice('');
    const user = await confirmPasswordReset(identifier, code, password);
    setIsConfirming(false);

    if (!user) {
      setNotice(serverMessage || 'Код восстановления не подошел.');
      return;
    }

    const nextRole = normalizeDashboardRole(user.role);

    navigation.replace('Dashboard', {
      firstName: user.firstName || undefined,
      role: nextRole,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <KeyRound color="#008D49" size={30} strokeWidth={2.4} />
          </View>
          <Text style={styles.title}>Восстановление пароля</Text>
          <Text style={styles.subtitle}>
            Код можно отправить на email, SMS, Telegram или MAX. Новый пароль сразу завершит старые
            сессии аккаунта.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Почта или телефон</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setIdentifier}
              placeholder="name@example.com или +7 900 000-00-00"
              placeholderTextColor="#557669"
              style={styles.input}
              value={identifier}
            />
          </View>

          <View style={styles.deliveryGrid}>
            {deliveryOptions.map((option) => {
              const active = option.channel === deliveryChannel;
              const Icon = option.channel === 'email' ? Mail : MessageSquareText;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={option.channel}
                  onPress={() => setDeliveryChannel(option.channel)}
                  style={({ pressed }) => [
                    styles.deliveryButton,
                    active && styles.deliveryButtonActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon color={active ? '#F4FAF6' : '#008D49'} size={17} strokeWidth={2.4} />
                  <Text style={[styles.deliveryButtonText, active && styles.deliveryButtonTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canRequest}
            onPress={handleRequestCode}
            style={({ pressed }) => [
              styles.secondaryButton,
              !canRequest && styles.secondaryButtonMuted,
              pressed && styles.pressed,
            ]}
          >
            <MessageSquareText color="#008D49" size={18} strokeWidth={2.4} />
            <Text style={styles.secondaryButtonText}>
              {isSending ? 'Отправляем...' : 'Получить код'}
            </Text>
          </Pressable>

          {demoCode ? <Text style={styles.demoCode}>MVP-код: {demoCode}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <View style={styles.field}>
            <Text style={styles.label}>Код восстановления</Text>
            <TextInput
              autoCapitalize="characters"
              keyboardType={deliveryChannel === 'email' ? 'default' : 'number-pad'}
              maxLength={8}
              onChangeText={setCode}
              placeholder="0000"
              placeholderTextColor="#557669"
              style={styles.input}
              value={code}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Новый пароль</Text>
            <TextInput
              onChangeText={setPassword}
              placeholder="Минимум 4 символа"
              placeholderTextColor="#557669"
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Повторите пароль</Text>
            <TextInput
              onChangeText={setPasswordRepeat}
              placeholder="Еще раз новый пароль"
              placeholderTextColor="#557669"
              secureTextEntry
              style={styles.input}
              value={passwordRepeat}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canConfirm}
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.primaryButton,
              !canConfirm && styles.primaryButtonMuted,
              pressed && styles.pressed,
            ]}
          >
            <ShieldCheck color="#F4FAF6" size={19} strokeWidth={2.4} />
            <Text style={styles.primaryButtonText}>
              {isConfirming ? 'Проверяем...' : 'Сменить пароль'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Welcome')}
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          >
            <Text style={styles.linkButtonText}>На главный экран</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function normalizeDashboardRole(role: string): AccountRole {
  return normalizeAccountRole(role);
}

function formatTime(value?: string) {
  if (!value) {
    return 'истечения срока';
  }

  return new Date(value).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(11, 47, 37, 0.10)',
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
    padding: 20,
    shadowColor: '#0B2F25',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  deliveryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 141, 73, 0.10)',
    borderColor: 'rgba(11, 47, 37, 0.10)',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 118,
    paddingHorizontal: 12,
  },
  deliveryButtonActive: {
    backgroundColor: '#008D49',
    borderColor: '#008D49',
  },
  deliveryButtonText: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  deliveryButtonTextActive: {
    color: '#FFFFFF',
  },
  deliveryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  demoCode: {
    backgroundColor: 'rgba(0, 141, 73, 0.10)',
    borderRadius: 12,
    color: '#008D49',
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
    backgroundColor: 'rgba(0, 141, 73, 0.10)',
    borderRadius: 12,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(11, 47, 37, 0.16)',
    borderRadius: 12,
    borderWidth: 1,
    color: '#12382C',
    fontSize: 16,
    minHeight: 56,
    paddingHorizontal: 14,
  },
  label: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  linkButtonText: {
    color: '#008D49',
    fontSize: 14,
    fontWeight: '900',
  },
  notice: {
    color: '#557669',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  page: {
    backgroundColor: '#F4FAF6',
    justifyContent: 'center',
    minHeight: '100%',
    padding: 16,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 14,
    shadowColor: 'rgba(0, 111, 58, 0.22)',
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  primaryButtonMuted: {
    backgroundColor: '#A9BBB3',
  },
  primaryButtonText: {
    color: '#F4FAF6',
    fontSize: 15,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#F4FAF6',
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(11, 47, 37, 0.10)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  secondaryButtonMuted: {
    opacity: 0.56,
  },
  secondaryButtonText: {
    color: '#008D49',
    fontSize: 14,
    fontWeight: '900',
  },
  subtitle: {
    color: '#557669',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: '#12382C',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
});
