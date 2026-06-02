import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Car, LockKeyhole, LogIn, UserPlus } from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { driverAccessPlans } from '../data/subscription';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const driverCommissionPercent = driverAccessPlans.commission.commissionPercent;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Car color="#F5F0E8" size={28} strokeWidth={2.4} />
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.appName}>Такси Салават</Text>
            <Text style={styles.appMeta}>Клиенты и водители напрямую</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>Добро пожаловать</Text>
          <Text numberOfLines={4} style={styles.subtitle}>
            Клиенты заказывают поездки, самозанятые водители получают оплату напрямую и
            выбирают: 3000 ₽ в месяц без комиссии или {driverCommissionPercent}% с поездки.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Registration')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <UserPlus color="#1E1C1A" size={20} strokeWidth={2.4} />
            <Text style={styles.primaryButtonText}>Зарегистрироваться</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <LogIn color="#D4A853" size={20} strokeWidth={2.4} />
            <Text style={styles.secondaryButtonText}>Войти</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('AdminPanel')}
            style={({ pressed }) => [styles.adminButton, pressed && styles.pressed]}
          >
            <LockKeyhole color="#F5F0E8" size={20} strokeWidth={2.4} />
            <Text style={styles.adminButtonText}>Админ-панель</Text>
          </Pressable>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Клиент</Text>
            <Text numberOfLines={2} style={styles.infoText}>Заказ поездок, история, оплата и поддержка.</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Самозанятый водитель</Text>
            <Text numberOfLines={2} style={styles.infoText}>
              Подписка 3000 ₽ или {driverCommissionPercent}% к вечернему переводу,
              документы и рейтинг.
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Две модели</Text>
            <Text numberOfLines={2} style={styles.infoText}>
              Модель можно сменить, изменение применяется со следующего расчетного периода.
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Админ</Text>
            <Text numberOfLines={2} style={styles.infoText}>Вход только по личному паролю без логина и телефона.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  adminButton: {
    alignItems: 'center',
    backgroundColor: '#37322E',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    minWidth: 148,
    paddingHorizontal: 16,
  },
  adminButtonText: {
    color: '#F5F0E8',
    fontSize: 15,
    fontWeight: '900',
  },
  appMeta: {
    color: '#A89F91',
    fontSize: 13,
    marginTop: 2,
  },
  appName: {
    color: '#F5F0E8',
    fontSize: 20,
    fontWeight: '900',
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#D4A853',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandRow: {
    alignItems: 'center',
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 12,
  },
  hero: {
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minHeight: 82,
    minWidth: 150,
    padding: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoText: {
    color: '#A89F91',
    fontSize: 13,
    lineHeight: 19,
  },
  infoTitle: {
    color: '#F5F0E8',
    fontSize: 15,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#1E1C1A',
    gap: 12,
    minHeight: '100%',
    padding: 14,
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
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    minWidth: 190,
    paddingHorizontal: 16,
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
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    minWidth: 148,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#D4A853',
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    color: '#A89F91',
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    color: '#F5F0E8',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
  },
});
