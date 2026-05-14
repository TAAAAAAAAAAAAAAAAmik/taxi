import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Car, LogIn, UserPlus } from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Car color="#FFFFFF" size={28} strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.appName}>Такси Партнер</Text>
            <Text style={styles.appMeta}>Клиенты и водители напрямую</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>Добро пожаловать</Text>
          <Text style={styles.subtitle}>
            Клиенты заказывают поездки, а водители работают по месячной подписке без автопарка и
            комиссии с каждого заказа.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Registration')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <UserPlus color="#FFFFFF" size={20} strokeWidth={2.4} />
            <Text style={styles.primaryButtonText}>Зарегистрироваться</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <LogIn color="#146C5D" size={20} strokeWidth={2.4} />
            <Text style={styles.secondaryButtonText}>Войти</Text>
          </Pressable>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Клиент</Text>
            <Text style={styles.infoText}>Заказ поездок, история, оплата и поддержка.</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Водитель-партнер</Text>
            <Text style={styles.infoText}>Месячный доступ, заказы без комиссии, выплаты и рейтинг.</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Модель сервиса</Text>
            <Text style={styles.infoText}>Мы приводим трафик, водитель получает понятную экономику.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  appMeta: {
    color: '#59616C',
    fontSize: 13,
    marginTop: 2,
  },
  appName: {
    color: '#20242A',
    fontSize: 20,
    fontWeight: '900',
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#146C5D',
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  brandRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  hero: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minWidth: 180,
    padding: 14,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoText: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 19,
  },
  infoTitle: {
    color: '#20242A',
    fontSize: 15,
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
    minHeight: 52,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#146C5D',
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    color: '#59616C',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: '#20242A',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
  },
});
