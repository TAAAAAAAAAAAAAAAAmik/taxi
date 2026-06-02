import { useEffect, useState } from 'react';
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
import { AuthDeliveryChannel } from '../services/apiClient';
import { useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyPhone'>;

const deliveryOptions: Array<{
  channel: Extract<AuthDeliveryChannel, 'max' | 'sms' | 'telegram'>;
  label: string;
}> = [
  { channel: 'sms', label: 'SMS' },
  { channel: 'telegram', label: 'Telegram' },
  { channel: 'max', label: 'MAX' },
];

export function VerifyPhoneScreen({ navigation, route }: Props) {
  const { email, firstName, phone, role } = route.params;
  const { requestVerificationCode, serverMessage, verifyContactCode } = useAppState();
  const [code, setCode] = useState('');
  const [deliveryChannel, setDeliveryChannel] =
    useState<Extract<AuthDeliveryChannel, 'max' | 'sms' | 'telegram'>>('sms');
  const [demoCode, setDemoCode] = useState('');
  const [notice, setNotice] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const canContinue = code.trim().length >= 4 && !isVerifying;

  const sendCode = async () => {
    if (!phone) {
      setNotice('В анкете нет телефона для подтверждения.');
      return;
    }

    setIsSending(true);
    setNotice('');
    setDemoCode('');
    const result = await requestVerificationCode('phone', phone, deliveryChannel);
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
    const user = await verifyContactCode('phone', code, phone);
    setIsVerifying(false);

    if (!user) {
      setNotice(serverMessage || 'Код телефона не подошел.');
      return;
    }

    navigation.navigate('VerifyEmail', {
      email,
      firstName,
      role,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Phone color="#D4A853" size={30} strokeWidth={2.4} />
          </View>
          <Text style={styles.title}>Подтверждение телефона</Text>
          <Text style={styles.subtitle}>
            Введите код из SMS или мессенджера. В MVP backend создает код и показывает его здесь
            для ручной проверки пилотного сценария.
          </Text>
          <View style={styles.deliveryGrid}>
            {deliveryOptions.map((option) => {
              const active = option.channel === deliveryChannel;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  disabled={isSending}
                  key={option.channel}
                  onPress={() => setDeliveryChannel(option.channel)}
                  style={({ pressed }) => [
                    styles.deliveryButton,
                    active && styles.deliveryButtonActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <MessageSquareText color={active ? '#1E1C1A' : '#D4A853'} size={17} strokeWidth={2.4} />
                  <Text style={[styles.deliveryButtonText, active && styles.deliveryButtonTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.target}>{phone || 'Телефон из анкеты'}</Text>
          {demoCode ? <Text style={styles.demoCode}>MVP-код: {demoCode}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <View style={styles.field}>
            <Text style={styles.label}>Код подтверждения</Text>
            <TextInput
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={setCode}
              placeholder="0000"
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
              {isVerifying ? 'Проверяем...' : 'Подтвердить телефон'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isSending}
            onPress={sendCode}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <MessageSquareText color="#D4A853" size={18} strokeWidth={2.4} />
            <Text style={styles.secondaryButtonText}>
              {isSending ? 'Отправляем...' : 'Отправить код повторно'}
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
  deliveryButton: {
    alignItems: 'center',
    backgroundColor: '#37322E',
    borderColor: '#D4A853',
    borderRadius: 8,
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
    backgroundColor: '#D4A853',
    borderColor: '#D4A853',
  },
  deliveryButtonText: {
    color: '#D4A853',
    fontSize: 13,
    fontWeight: '900',
  },
  deliveryButtonTextActive: {
    color: '#F5F0E8',
  },
  deliveryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    fontSize: 24,
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
