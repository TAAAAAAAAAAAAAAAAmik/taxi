import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Building2, Car, LogIn, UserRound } from 'lucide-react-native';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AccountRole, roleCopy } from '../data/registration';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const roles: AccountRole[] = ['client', 'driver'];
const roleIcons = {
  client: UserRound,
  driver: Car,
  fleet: Building2,
};

export function LoginScreen({ navigation }: Props) {
  const [role, setRole] = useState<AccountRole>('client');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const canContinue = identifier.trim().length > 2 && password.length >= 4;

  const handleLogin = () => {
    navigation.replace('Dashboard', {
      firstName: identifier.includes('@') ? undefined : identifier.trim(),
      role,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Вход</Text>
          <Text style={styles.subtitle}>
            Пока сервер авторизации не подключен, экран ведет в кабинет выбранной роли.
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
                  <Icon color={active ? '#FFFFFF' : '#146C5D'} size={18} strokeWidth={2.4} />
                  <Text style={[styles.roleButtonText, active && styles.roleButtonTextActive]}>
                    {roleCopy[item].title}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Почта или телефон</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setIdentifier}
              placeholder="name@example.com или +7 900 000-00-00"
              placeholderTextColor="#8A8F98"
              style={styles.input}
              value={identifier}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Пароль для приложения</Text>
            <TextInput
              onChangeText={setPassword}
              placeholder="Введите пароль"
              placeholderTextColor="#8A8F98"
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canContinue}
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.primaryButton,
              !canContinue && styles.primaryButtonMuted,
              pressed && styles.pressed,
            ]}
          >
            <LogIn color="#FFFFFF" size={19} strokeWidth={2.4} />
            <Text style={styles.primaryButtonText}>Войти</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Registration')}
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          >
            <Text style={styles.linkButtonText}>Создать новый аккаунт</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 18,
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
    fontWeight: '800',
  },
  linkButton: {
    alignItems: 'center',
    minHeight: 42,
    justifyContent: 'center',
  },
  linkButtonText: {
    color: '#146C5D',
    fontSize: 14,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#F4F7F5',
    gap: 16,
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
  roleButton: {
    alignItems: 'center',
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
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
    backgroundColor: '#146C5D',
    borderColor: '#146C5D',
  },
  roleButtonText: {
    color: '#146C5D',
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
  safeArea: {
    backgroundColor: '#F4F7F5',
    flex: 1,
  },
  sectionTitle: {
    color: '#20242A',
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    color: '#59616C',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: '#20242A',
    fontSize: 30,
    fontWeight: '900',
  },
});
