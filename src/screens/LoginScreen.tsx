import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Building2,
  Car,
  LockKeyhole,
  LogIn,
  MessageSquareText,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AccountRole, roleCopy, normalizeAccountRole } from '../data/registration';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';
import { isDemoModeEnabled } from '../utils/runtimeFlags';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const roles: AccountRole[] = ['client', 'self_employed_driver', 'park_admin', 'park_driver'];
const roleIcons = {
  client: UserRound,
  self_employed_driver: Car,
  park_admin: Building2,
  park_driver: Car,
  driver: Car,
  fleet: Building2,
};

const demoAccounts: Array<{
  identifier: string;
  label: string;
  password: string;
  role: AccountRole;
}> = [
  {
    identifier: 'demo-client@example.test',
    label: 'Клиент',
    password: 'Kinetix123',
    role: 'client',
  },
  {
    identifier: 'demo-driver@example.test',
    label: 'Самозанятый водитель',
    password: 'Kinetix123',
    role: 'self_employed_driver',
  },
];

export function LoginScreen({ navigation }: Props) {
  const { confirmSmsLoginCode, loginAccount, requestSmsLoginCode, serverMessage, serverStatus } = useAppState();
  const [role, setRole] = useState<AccountRole>('client');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsDemoCode, setSmsDemoCode] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const canPasswordContinue = identifier.trim().length > 2 && password.length >= 4 && !isSubmitting;
  const canRequestSms = identifier.trim().length >= 10 && !isSubmitting;
  const canConfirmSms = identifier.trim().length >= 10 && smsCode.trim().length >= 4 && !isSubmitting;
  const showDemoLogin = isDemoModeEnabled();

  const submitLogin = async (
    nextIdentifier: string,
    nextPassword: string,
    nextRole: AccountRole,
  ) => {
    setIsSubmitting(true);
    setErrorText(null);
    const user = await loginAccount(nextIdentifier, nextPassword, normalizeAccountRole(nextRole));
    setIsSubmitting(false);

    if (!user) {
      setErrorText('Не удалось войти. Проверьте роль, телефон/почту и пароль.');
      return;
    }

    const resolvedRole = normalizeAccountRole(user.role);

    navigation.replace(resolvedRole === 'client' ? 'OrderFlow' : 'Dashboard', {
      firstName: user.firstName || undefined,
      role: resolvedRole,
    });
  };

  const handleLogin = async () => {
    await submitLogin(identifier, password, role);
  };

  const handleRequestSmsCode = async () => {
    setIsSubmitting(true);
    setErrorText(null);
    setNotice('');
    setSmsDemoCode('');
    const result = await requestSmsLoginCode(identifier, normalizeAccountRole(role), 'sms');
    setIsSubmitting(false);

    if (!result) {
      setErrorText(serverMessage || 'Не удалось отправить SMS-код.');
      return;
    }

    setSmsDemoCode(result.code ?? '');
    setNotice(
      result.deliveryMode === 'mvp-returned-code' && result.code
        ? `MVP-код входа: ${result.code}`
        : 'Если номер зарегистрирован, SMS-код отправлен.',
    );
  };

  const handleSmsLogin = async () => {
    setIsSubmitting(true);
    setErrorText(null);
    setNotice('');
    const user = await confirmSmsLoginCode(identifier, smsCode, normalizeAccountRole(role));
    setIsSubmitting(false);

    if (!user) {
      setErrorText(serverMessage || 'SMS-код не подошел.');
      return;
    }

    const nextRole = normalizeAccountRole(user.role);

    navigation.replace(nextRole === 'client' ? 'OrderFlow' : 'Dashboard', {
      firstName: user.firstName || undefined,
      role: nextRole,
    });
  };

  const handleDemoLogin = async (account: (typeof demoAccounts)[number]) => {
    setRole(account.role);
    setIdentifier(account.identifier);
    setPassword(account.password);
    await submitLogin(account.identifier, account.password, account.role);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Вход</Text>
          <Text style={styles.subtitle}>
            Вход идет через MVP backend. Роль должна совпадать с аккаунтом.
          </Text>
          <Text style={styles.serverText}>
            {serverStatus === 'connected' ? 'Backend подключен' : serverMessage}
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Тип аккаунта</Text>
          <View style={styles.roleGrid}>
            {roles.map((item) => {
              const Icon = roleIcons[item];
              const active = item === role;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={item}
                  onPress={() => setRole(item)}
                  style={({ pressed }) => [
                    styles.roleButton,
                    active && styles.roleButtonActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon color={active ? '#F4FAF6' : '#008D49'} size={18} strokeWidth={2.4} />
                  <Text style={[styles.roleButtonText, active && styles.roleButtonTextActive]}>
                    {roleCopy[item].title}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {showDemoLogin ? (
            <>
              <Text style={styles.sectionTitle}>Демо-вход</Text>
              <View style={styles.demoGrid}>
                {demoAccounts.map((account) => {
                  const Icon = roleIcons[account.role];

                  return (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isSubmitting}
                      key={account.role}
                      onPress={() => handleDemoLogin(account)}
                      style={({ pressed }) => [
                        styles.demoButton,
                        isSubmitting && styles.demoButtonMuted,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Icon color="#008D49" size={18} strokeWidth={2.4} />
                      <Text style={styles.demoButtonText}>{account.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

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

          <View style={styles.field}>
            <Text style={styles.label}>Пароль для приложения</Text>
            <TextInput
              onChangeText={setPassword}
              placeholder="Введите пароль"
              placeholderTextColor="#557669"
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canPasswordContinue}
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.primaryButton,
              !canPasswordContinue && styles.primaryButtonMuted,
              pressed && styles.pressed,
            ]}
          >
            <LogIn color="#12382C" size={19} strokeWidth={2.4} />
            <Text style={styles.primaryButtonText}>{isSubmitting ? 'Проверяем...' : 'Войти'}</Text>
          </Pressable>

          <View style={styles.smsPanel}>
            <Text style={styles.sectionTitle}>Вход по SMS</Text>
            <Pressable
              accessibilityRole="button"
              disabled={!canRequestSms}
              onPress={handleRequestSmsCode}
              style={({ pressed }) => [
                styles.secondaryButton,
                !canRequestSms && styles.secondaryButtonMuted,
                pressed && styles.pressed,
              ]}
            >
              <MessageSquareText color="#008D49" size={18} strokeWidth={2.4} />
              <Text style={styles.secondaryButtonText}>
                {isSubmitting ? 'Отправляем...' : 'Получить SMS-код'}
              </Text>
            </Pressable>

            {smsDemoCode ? <Text style={styles.demoCode}>MVP-код: {smsDemoCode}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <View style={styles.field}>
              <Text style={styles.label}>SMS-код</Text>
              <TextInput
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={setSmsCode}
                placeholder="0000"
                placeholderTextColor="#557669"
                style={styles.input}
                value={smsCode}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={!canConfirmSms}
              onPress={handleSmsLogin}
              style={({ pressed }) => [
                styles.primaryButton,
                !canConfirmSms && styles.primaryButtonMuted,
                pressed && styles.pressed,
              ]}
            >
              <ShieldCheck color="#12382C" size={19} strokeWidth={2.4} />
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Проверяем...' : 'Войти по SMS'}
              </Text>
            </Pressable>
          </View>

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Registration')}
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          >
            <Text style={styles.linkButtonText}>Создать новый аккаунт</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('PasswordReset')}
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          >
            <Text style={styles.linkButtonText}>Восстановить пароль</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('AdminPanel')}
            style={({ pressed }) => [styles.adminButton, pressed && styles.pressed]}
          >
            <LockKeyhole color="#12382C" size={18} strokeWidth={2.4} />
            <Text style={styles.adminButtonText}>Админ-панель</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  adminButton: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  adminButtonText: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  field: {
    gap: 8,
  },
  errorText: {
    color: '#C17A70',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  demoButton: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 150,
    paddingHorizontal: 12,
  },
  demoButtonMuted: {
    opacity: 0.55,
  },
  demoButtonText: {
    color: '#008D49',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  demoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#557669',
    borderRadius: 8,
    borderWidth: 1,
    color: '#12382C',
    fontSize: 16,
    minHeight: 56,
    paddingHorizontal: 14,
  },
  label: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '800',
  },
  linkButton: {
    alignItems: 'center',
    minHeight: 42,
    justifyContent: 'center',
  },
  linkButtonText: {
    color: '#008D49',
    fontSize: 14,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#F4FAF6',
    gap: 16,
    minHeight: '100%',
    padding: 16,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.95 }],
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#008D49',
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
    color: '#F4FAF6',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
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
  demoCode: {
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    color: '#008D49',
    fontSize: 16,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notice: {
    color: '#557669',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  roleButton: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: 170,
    paddingHorizontal: 12,
  },
  roleButtonActive: {
    backgroundColor: '#008D49',
    borderColor: '#008D49',
  },
  roleButtonText: {
    color: '#008D49',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  roleButtonTextActive: {
    color: '#FFFFFF',
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  smsPanel: {
    borderColor: '#3D3D3D',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  safeArea: {
    backgroundColor: '#F4FAF6',
    flex: 1,
  },
  sectionTitle: {
    color: '#12382C',
    fontSize: 18,
    fontWeight: '900',
  },
  serverText: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  subtitle: {
    color: '#557669',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: '#12382C',
    fontSize: 30,
    fontWeight: '900',
  },
});
