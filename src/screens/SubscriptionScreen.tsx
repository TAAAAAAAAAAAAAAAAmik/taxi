import { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Percent,
  ReceiptText,
  RotateCcw,
  WalletCards,
} from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  DriverBillingMode,
  DriverSubscriptionPayment,
  driverAccessPlans,
} from '../data/subscription';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'Subscription'>;

export function SubscriptionScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const {
    driverPayments,
    driverSubscription,
    payDriverSubscription,
    refundDriverSubscriptionPayment,
    serverMessage,
  } = useAppState();
  const [selectedMode, setSelectedMode] = useState<DriverBillingMode>(driverSubscription.billingMode);
  const [busy, setBusy] = useState(false);
  const [refundBusyId, setRefundBusyId] = useState<string | undefined>();
  const selectedPlan = driverAccessPlans[selectedMode];
  const isActive = driverSubscription.status === 'active';
  const paidPayments = useMemo(
    () => driverPayments.filter((payment) => payment.status === 'paid'),
    [driverPayments],
  );
  const lastRefundablePayment = paidPayments.find((payment) => payment.amount > 0);

  const confirmPlan = async () => {
    if (isActive && driverSubscription.billingMode === selectedMode) {
      navigation.navigate('OrderFlow', { firstName, role });
      return;
    }

    setBusy(true);
    await payDriverSubscription(selectedMode);
    setBusy(false);
  };

  const refundPayment = async (paymentId: string) => {
    setRefundBusyId(paymentId);
    await refundDriverSubscriptionPayment(paymentId, 'Возврат водителю из экрана подписки');
    setRefundBusyId(undefined);
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
              Выберите месячный доступ или комиссию с поездок. Backend сохраняет платеж,
              продление, возврат, историю и чек подписки.
            </Text>
            <Text style={styles.metaLine}>{firstName?.trim() || 'Водитель-партнер'}</Text>
          </View>
        </View>

        <View style={styles.statusGrid}>
          <StatusCard
            label="Статус"
            value={formatAccessStatus(driverSubscription.status)}
            helper={driverSubscription.expiresAt ? `До ${formatDate(driverSubscription.expiresAt)}` : 'Без даты окончания'}
          />
          <StatusCard label="Модель" value={driverSubscription.planName} helper={formatPlanCost(driverSubscription.billingMode)} />
          <StatusCard label="Платежи" value={String(driverPayments.length)} helper="Операции доступа" />
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
            <Text style={styles.summaryText}>{serverMessage}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={confirmPlan}
            style={({ pressed }) => [
              styles.primaryButton,
              busy && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            <CreditCard color="#FFFFFF" size={18} strokeWidth={2.4} />
            <Text style={styles.primaryButtonText}>
              {busy
                ? 'Проводим операцию'
                : isActive && driverSubscription.billingMode === selectedMode
                ? 'Перейти к заказам'
                : selectedPlan.primaryAction}
            </Text>
          </Pressable>

          {lastRefundablePayment ? (
            <Pressable
              accessibilityRole="button"
              disabled={refundBusyId === lastRefundablePayment.id}
              onPress={() => refundPayment(lastRefundablePayment.id)}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <RotateCcw color="#A33B2E" size={17} strokeWidth={2.4} />
              <Text style={styles.refundButtonText}>
                {refundBusyId === lastRefundablePayment.id ? 'Возвращаем платеж' : 'Вернуть последний платеж'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <ReceiptText color="#146C5D" size={20} strokeWidth={2.4} />
            <Text style={styles.sectionTitle}>История платежей и чеки</Text>
          </View>
          {driverPayments.length > 0 ? (
            driverPayments.map((payment) => <PaymentRow key={payment.id} payment={payment} />)
          ) : (
            <Text style={styles.emptyText}>Платежей пока нет. После оплаты здесь появится операция и чек.</Text>
          )}
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

function StatusCard({ helper, label, value }: { helper: string; label: string; value: string }) {
  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
      <Text style={styles.statusHelper}>{helper}</Text>
    </View>
  );
}

function PaymentRow({ payment }: { payment: DriverSubscriptionPayment }) {
  const isRefunded = payment.status === 'refunded';
  const receipt = payment.refundReceipt ?? payment.receipt;

  return (
    <View style={styles.paymentRow}>
      <View style={styles.paymentIcon}>
        {isRefunded ? (
          <RotateCcw color="#A33B2E" size={18} strokeWidth={2.4} />
        ) : (
          <CheckCircle2 color="#146C5D" size={18} strokeWidth={2.4} />
        )}
      </View>
      <View style={styles.paymentCopy}>
        <Text style={styles.paymentTitle}>
          {payment.planName} · {formatMoney(payment.amount)}
        </Text>
        <Text style={styles.paymentText}>
          {formatPaymentStatus(payment.status)} · {payment.paymentMethod} · {payment.provider.name}
        </Text>
        <Text style={styles.paymentText}>
          {formatDate(payment.paidAt ?? payment.createdAt)}
          {payment.accessExpiresAt ? ` · доступ до ${formatDate(payment.accessExpiresAt)}` : ''}
        </Text>
        {receipt ? (
          <Text style={styles.receiptText}>
            Чек {receipt.fiscalNumber} · {receipt.fiscalStatus}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function formatAccessStatus(status: string) {
  if (status === 'active') {
    return 'Активен';
  }

  if (status === 'expired') {
    return 'Истек';
  }

  return 'Не оплачен';
}

function formatPaymentStatus(status: DriverSubscriptionPayment['status']) {
  const labels: Record<DriverSubscriptionPayment['status'], string> = {
    failed: 'Ошибка',
    paid: 'Оплачен',
    pending: 'Ожидает',
    refunded: 'Возврат',
  };

  return labels[status];
}

function formatPlanCost(mode: DriverBillingMode) {
  const plan = driverAccessPlans[mode];

  return mode === 'monthly' ? `${plan.monthlyPrice} ₽ за 30 дней` : `${plan.commissionPercent}% с поездки`;
}

function formatMoney(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
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
  disabledButton: { opacity: 0.64 },
  emptyText: { color: '#59616C', fontSize: 14, lineHeight: 20 },
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
  paymentCopy: { flex: 1, gap: 4, minWidth: 0 },
  paymentIcon: {
    alignItems: 'center',
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  paymentRow: {
    backgroundColor: '#F8FAF9',
    borderColor: '#E1E6EC',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  paymentText: { color: '#59616C', fontSize: 12, lineHeight: 17 },
  paymentTitle: { color: '#20242A', fontSize: 14, fontWeight: '900' },
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
  receiptText: { color: '#146C5D', fontSize: 12, fontWeight: '800' },
  refundButtonText: { color: '#A33B2E', fontSize: 14, fontWeight: '900' },
  safeArea: { backgroundColor: '#F4F7F5', flex: 1 },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  sectionTitle: { color: '#20242A', fontSize: 18, fontWeight: '900' },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 170,
    padding: 14,
  },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusHelper: { color: '#59616C', fontSize: 12, lineHeight: 17 },
  statusLabel: { color: '#59616C', fontSize: 12, fontWeight: '800' },
  statusValue: { color: '#20242A', fontSize: 17, fontWeight: '900' },
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
