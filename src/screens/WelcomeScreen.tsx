import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowRight, Car, LockKeyhole, LogIn, MapPin, UserPlus } from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BashkortostanEmblem } from '../components/BashkortostanEmblem';
import { driverAccessPlans } from '../data/subscription';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const driverCommissionPercent = driverAccessPlans.commission.commissionPercent;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Car color="#FFFFFF" size={24} strokeWidth={2.5} />
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.appName}>Такси Салават</Text>
              <Text numberOfLines={1} style={styles.appMeta}>
                Салаватский район · Башкортостан
              </Text>
            </View>
          </View>
          <BashkortostanEmblem size={72} />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Registration')}
          style={({ pressed }) => [styles.destinationCard, pressed && styles.pressed]}
        >
          <View style={styles.pinWrap}>
            <MapPin color="#008D49" size={24} strokeWidth={2.5} />
          </View>
          <View style={styles.destinationCopy}>
            <Text style={styles.destinationLabel}>Куда едем?</Text>
            <Text numberOfLines={1} style={styles.destinationHint}>
              Быстрый старт для пассажира или водителя
            </Text>
          </View>
          <ArrowRight color="#12382C" size={22} strokeWidth={2.4} />
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Registration')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <UserPlus color="#FFFFFF" size={20} strokeWidth={2.5} />
            <Text style={styles.primaryButtonText}>Регистрация</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <LogIn color="#008D49" size={20} strokeWidth={2.4} />
            <Text style={styles.secondaryButtonText}>Войти</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('AdminPanel')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <LockKeyhole color="#006BB6" size={20} strokeWidth={2.4} />
            <Text style={styles.secondaryButtonText}>Админ</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>Своя служба для района</Text>
          <Text numberOfLines={3} style={styles.subtitle}>
            Пассажиры вызывают поездку, самозанятые водители работают напрямую:
            3000 ₽ в месяц без комиссии или {driverCommissionPercent}% с поездки.
          </Text>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Пассажиру</Text>
            <Text numberOfLines={2} style={styles.infoText}>
              Заказ, история, оплата и поддержка без лишних экранов.
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Водителю</Text>
            <Text numberOfLines={2} style={styles.infoText}>
              Документы, рейтинг и выбор модели оплаты.
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Району</Text>
            <Text numberOfLines={2} style={styles.infoText}>
              Локальный сервис с башкирским визуальным стилем.
            </Text>
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
  appMeta: {
    color: '#557669',
    fontSize: 13,
    marginTop: 2,
  },
  appName: {
    color: '#12382C',
    fontSize: 21,
    fontWeight: '900',
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  brandRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  destinationCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 141, 73, 0.18)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 78,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  destinationCopy: {
    flex: 1,
    minWidth: 0,
  },
  destinationHint: {
    color: '#557669',
    fontSize: 14,
    marginTop: 4,
  },
  destinationLabel: {
    color: '#12382C',
    fontSize: 25,
    fontWeight: '900',
  },
  hero: {
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    gap: 8,
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 107, 182, 0.16)',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minHeight: 92,
    minWidth: 165,
    padding: 14,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoText: {
    color: '#557669',
    fontSize: 13,
    lineHeight: 19,
  },
  infoTitle: {
    color: '#12382C',
    fontSize: 16,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#F4FAF6',
    gap: 12,
    minHeight: '100%',
    padding: 14,
  },
  pinWrap: {
    alignItems: 'center',
    backgroundColor: '#DDF1E7',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 176,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
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
    borderColor: 'rgba(0, 141, 73, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 128,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: '#12382C',
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    color: '#557669',
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    color: '#12382C',
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 32,
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 12,
  },
});
