import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, CreditCard, Percent, WalletCards } from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DriverBillingMode, driverAccessPlans } from '../data/subscription';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'Subscription'>;

export function SubscriptionScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const { activateDriverSubscription, driverSubscription } = useAppState();
  const [selectedMode, setSelectedMode] = useState<DriverBillingMode>(driverSubscription.billingMode);
  const selectedPlan = driverAccessPlans[selectedMode];
  const isActive = driverSubscription.status === 'active';

  const confirmPlan = () => {
    if (!isActive || driverSubscription.billingMode !== selectedMode) {
      activateDriverSubscription(selectedMode);
      return;
    }

    navigation.navigate('OrderFlow', { firstName, role });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <ArrowLeft color="#146C5D" size={20} strokeWidth={2.4} />
          <Text style={styles.backButtonText}>Назад</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <WalletCards color="#146C5D" size={30} strokeWidth={2.4} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Оплата доступа водителя</Text>
            <Text style={styles.subtitle}>
              Выберите: платить каждый месяц по 5000 ₽ и ездить без комиссии или работать без
              оплаты заранее и отдавать 12% с каждой выполненной поездки.
            </Text>
            <Text style={styles.metaLine}>{firstName?.trim() || 'Водитель-партнер'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Модель оплаты</Text>
          <View style={styles.planGrid}>
            <PlanChoice
              active={selectedMode === 'monthly'}
              icon="card"
              onPress={() => setSelectedMode('monthly')}
              title={driverAccessPlans.monthly.name}
              headline={driverAccessPlans.monthly.headline}
              text={driverAccessPlans.monthly.description}
            />
            <PlanChoice
              active={selectedMode === 'commission'}
              icon="percent"
              onPress={() => setSelectedMode('commission')}
              title={driverAccessPlans.commission.name}
              headline={driverAccessPlans.commission.headline}
              text={driverAccessPlans.commission.description}
            />
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Выбрано: {selectedPlan.shortName}</Text>
            <Text style={styles.summaryText}>{selectedPlan.description}</Text>
            <Text style={styles.summaryText}>
              Текущий статус: {driverSubscription.status}. Активная модель:{' '}
              {driverSubscription.planName}.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={confirmPlan}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <CreditCard color="#FFFFFF" size={18} strokeWidth={2.4} />
            <Text style={styles.primaryButtonText}>
              {isActive && driverSubscription.billingMode === selectedMode
                ? 'Перейти к заказам'
                : selectedPlan.primaryAction}
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

type PlanChoiceProps = {
  active: boolean;
  icon: 'card' | 'percent';
  title: string;
  headline: string;
  text: string;
  onPress: () => void;
};

function PlanChoice({ active, headline, icon, onPress, text, title }: PlanChoiceProps) {
  const Icon = icon === 'card' ? CreditCard : Percent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.planChoice, active && styles.planChoiceActive, pressed && styles.pressed]}
    >
      <View style={styles.planTop}>
        <Icon color={active ? '#FFFFFF' : '#146C5D'} size={20} strokeWidth={2.4} />
        <Text style={[styles.planTitle, active && styles.planTextActive]}>{title}</Text>
      </View>
      <Text style={[styles.planHeadline, active && styles.planTextActive]}>{headline}</Text>
      <Text style={[styles.planText, active && styles.planTextActive]}>{text}</Text>
    </Pressable>
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
  backButtonText: { color: '#146C5D', fontSize: 14, fontWeight: '900' },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16,
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
  heroCopy: { flex: 1, gap: 7, minWidth: 0 },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  metaLine: { color: '#146C5D', fontSize: 13, fontWeight: '900' },
  page: { backgroundColor: '#F4F7F5', gap: 16, minHeight: '100%', padding: 16 },
  planChoice: {
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minWidth: 230,
    padding: 14,
  },
  planChoiceActive: { backgroundColor: '#146C5D', borderColor: '#146C5D' },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  planHeadline: { color: '#146C5D', fontSize: 16, fontWeight: '900' },
  planText: { color: '#59616C', fontSize: 13, lineHeight: 19 },
  planTextActive: { color: '#FFFFFF' },
  planTitle: { color: '#20242A', flex: 1, fontSize: 15, fontWeight: '900' },
  planTop: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  pressed: { opacity: 0.76 },
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
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  safeArea: { backgroundColor: '#F4F7F5', flex: 1 },
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
  secondaryButtonText: { color: '#20242A', fontSize: 14, fontWeight: '900' },
  sectionTitle: { color: '#20242A', fontSize: 18, fontWeight: '900' },
  subtitle: { color: '#59616C', fontSize: 15, lineHeight: 22 },
  summaryBox: {
    backgroundColor: '#E9F4F1',
    borderColor: '#C5DDD7',
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  summaryText: { color: '#59616C', fontSize: 13, lineHeight: 19 },
  summaryTitle: { color: '#0B4C42', fontSize: 15, fontWeight: '900' },
  title: { color: '#20242A', fontSize: 30, fontWeight: '900', lineHeight: 36 },
});
