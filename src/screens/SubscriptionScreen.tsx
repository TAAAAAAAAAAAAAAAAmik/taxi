import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Check, CreditCard, ShieldCheck, WalletCards } from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  driverSubscriptionBenefits,
  driverSubscriptionEconomics,
  driverSubscriptionRules,
} from '../data/subscription';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'Subscription'>;

export function SubscriptionScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const { activateDriverSubscription, driverSubscription } = useAppState();
  const isActive = driverSubscription.status === 'active';

  const handlePrimaryAction = () => {
    if (!isActive) {
      activateDriverSubscription();
      return;
    }

    navigation.navigate('OrderFlow', { firstName, role });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color="#146C5D" size={20} strokeWidth={2.4} />
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <WalletCards color="#146C5D" size={30} strokeWidth={2.4} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Подписка водителя</Text>
            <Text style={styles.subtitle}>
              Водитель оплачивает месяц доступа, получает заказы из приложения и работает без
              автопарка, ежедневных удержаний и комиссии с каждой поездки.
            </Text>
            <Text style={styles.metaLine}>{firstName?.trim() || 'Водитель-партнер'}</Text>
          </View>
        </View>

        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planName}>{driverSubscription.planName}</Text>
              <Text style={styles.planMeta}>
                {isActive
                  ? `Активна до ${new Date(driverSubscription.expiresAt ?? '').toLocaleDateString('ru-RU')}`
                  : 'Доступ к заказам пока закрыт'}
              </Text>
            </View>
            <Text style={styles.planPrice}>{driverSubscription.monthlyPrice} ₽</Text>
          </View>

          <View style={styles.commissionBox}>
            <ShieldCheck color="#146C5D" size={20} strokeWidth={2.4} />
            <View style={styles.commissionCopy}>
              <Text style={styles.commissionTitle}>
                Комиссия с заказов: {driverSubscription.ordersCommission}%
              </Text>
              <Text style={styles.commissionText}>
                Сервис зарабатывает на подписке, а главная обязанность продукта - привести водителю
                достаточный поток клиентов.
              </Text>
            </View>
          </View>

          <View style={styles.economicsGrid}>
            {driverSubscriptionEconomics.map((item) => (
              <View key={item.label} style={styles.economicsCard}>
                <Text style={styles.economicsLabel}>{item.label}</Text>
                <Text style={styles.economicsValue}>{item.value}</Text>
                <Text style={styles.economicsHelper}>{item.helper}</Text>
              </View>
            ))}
          </View>

          <View style={styles.benefits}>
            {driverSubscriptionBenefits.map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <View style={styles.checkIcon}>
                  <Check color="#FFFFFF" size={14} strokeWidth={3} />
                </View>
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>

          <View style={styles.rulesBox}>
            <Text style={styles.rulesTitle}>Правила доступа</Text>
            {driverSubscriptionRules.map((rule) => (
              <Text key={rule} style={styles.ruleText}>
                {rule}
              </Text>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={handlePrimaryAction}
            style={({ pressed }) => [
              styles.primaryButton,
              isActive && styles.primaryButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <CreditCard color="#FFFFFF" size={18} strokeWidth={2.4} />
            <Text style={styles.primaryButtonText}>
              {isActive ? 'Перейти к заказам' : 'Оплатить месяц'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('OrderFlow', { firstName, role })}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Перейти к заказам</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#146C5D',
    fontSize: 14,
    fontWeight: '900',
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  benefits: {
    gap: 10,
  },
  benefitText: {
    color: '#20242A',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  checkIcon: {
    alignItems: 'center',
    backgroundColor: '#146C5D',
    borderRadius: 6,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  commissionBox: {
    alignItems: 'flex-start',
    backgroundColor: '#E9F4F1',
    borderColor: '#C5DDD7',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  commissionCopy: {
    flex: 1,
    gap: 4,
  },
  commissionText: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 19,
  },
  commissionTitle: {
    color: '#0B4C42',
    fontSize: 15,
    fontWeight: '900',
  },
  economicsCard: {
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 150,
    padding: 13,
  },
  economicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  economicsHelper: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  economicsLabel: {
    color: '#59616C',
    fontSize: 12,
    fontWeight: '800',
  },
  economicsValue: {
    color: '#20242A',
    fontSize: 18,
    fontWeight: '900',
  },
  hero: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
  },
  heroCopy: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  metaLine: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#F4F7F5',
    gap: 16,
    minHeight: '100%',
    padding: 16,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  planHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  planMeta: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  planName: {
    color: '#20242A',
    fontSize: 22,
    fontWeight: '900',
  },
  planPrice: {
    color: '#20242A',
    fontSize: 26,
    fontWeight: '900',
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
  primaryButtonActive: {
    backgroundColor: '#26733E',
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
  rulesBox: {
    backgroundColor: '#EEF5F3',
    borderColor: '#C5DDD7',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  rulesTitle: {
    color: '#0B4C42',
    fontSize: 15,
    fontWeight: '900',
  },
  ruleText: {
    color: '#20242A',
    fontSize: 13,
    lineHeight: 19,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#20242A',
    fontSize: 14,
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
    lineHeight: 36,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
});
