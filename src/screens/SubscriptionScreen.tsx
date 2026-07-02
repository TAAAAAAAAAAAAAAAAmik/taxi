import { useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  WalletCards,
} from 'lucide-react-native';
import { Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  DriverBillingMode,
  DriverSubscriptionPayment,
  driverAccessPlans,
} from '../data/subscription';
import { ScreenHero } from '../components/ScreenHero';
import { RootStackParamList } from '../navigation/types';
import { DriverPaymentSettings, fetchDriverPaymentSettings } from '../services/apiClient';
import { useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'Subscription'>;

export function SubscriptionScreen({ navigation, route }: Props) {
  const { context, firstName, role } = route.params;
  const {
    driverPayments,
    driverSubscription,
    payDriverSubscription,
    refundDriverSubscriptionPayment,
    syncDriverSubscriptionPayment,
  } = useAppState();
  const [selectedMode, setSelectedMode] = useState<DriverBillingMode>('monthly');
  const [busy, setBusy] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<DriverPaymentSettings | undefined>();
  const [paymentNotice, setPaymentNotice] = useState('');
  const [showPayments, setShowPayments] = useState(false);
  const [refundBusyId, setRefundBusyId] = useState<string | undefined>();
  const [syncBusyId, setSyncBusyId] = useState<string | undefined>();
  const selectedPlan = driverAccessPlans[selectedMode];
  const isActive = driverSubscription.status === 'active';
  const paidPayments = useMemo(
    () => driverPayments.filter((payment) => payment.status === 'paid'),
    [driverPayments],
  );
  const pendingProviderPayment = driverPayments.find(
    (payment) => payment.status === 'pending' && payment.confirmationUrl,
  );
  const lastRefundablePayment = paidPayments.find((payment) => payment.amount > 0);
  const hasPaymentActivity =
    driverPayments.length > 0 || Boolean(pendingProviderPayment || lastRefundablePayment);
  const hasActiveDriverAccess = isActive && ['monthly', 'daily'].includes(driverSubscription.billingMode);
  const isSelectedCurrentMode = hasActiveDriverAccess && selectedMode === driverSubscription.billingMode;
  const isTrialChoice = context === 'trial-ended' || driverSubscription.status === 'expired';
  const primaryButtonLabel = busy
    ? 'Подождите...'
    : isSelectedCurrentMode
    ? 'Перейти к заказам'
    : selectedPlan.primaryAction;

  useEffect(() => {
    setSelectedMode(driverSubscription.status === 'active' ? driverSubscription.billingMode : 'monthly');
  }, [driverSubscription.billingMode]);

  useEffect(() => {
    fetchDriverPaymentSettings()
      .then(setPaymentSettings)
      .catch(() => setPaymentSettings(undefined));
  }, []);

  const confirmPlan = async () => {
    if (isSelectedCurrentMode) {
      navigation.navigate('OrderFlow', { firstName, role });
      return;
    }

    setBusy(true);
    await payDriverSubscription(selectedMode);
    setBusy(false);
    if (selectedMode === 'daily') {
      navigation.navigate('Dashboard', { firstName, role });
      return;
    }

    if (selectedMode === 'monthly') {
      setPaymentNotice(
        'Заявка на подключение тарифа отправлена. Администратор свяжется с вами для оплаты и активации.',
      );
    }
  };

  const refundPayment = async (paymentId: string) => {
    setRefundBusyId(paymentId);
    await refundDriverSubscriptionPayment(paymentId, 'Отмена платежа доступа');
    setRefundBusyId(undefined);
    setPaymentNotice('Платеж отменен.');
  };

  const checkPayment = async (paymentId: string) => {
    setSyncBusyId(paymentId);
    await syncDriverSubscriptionPayment(paymentId);
    setSyncBusyId(undefined);
    setPaymentNotice('Статус оплаты обновлен.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <ScreenHero
          Icon={WalletCards}
          onBack={() => navigation.goBack()}
          subtitle="120 ₽ за день или Партнёр PRO на месяц"
          title="Доступ к заказам"
        />

        {isTrialChoice ? (
          <View style={styles.trialChoiceCard}>
            <Text style={styles.trialChoiceTitle}>Доступ закончился.</Text>
            <Text style={styles.trialChoiceText}>
              Выберите день или PRO. Процентов с заказов нет.
            </Text>
          </View>
        ) : null}

        <View style={styles.statusGrid}>
          <StatusCard
            label="Статус доступа"
            value={formatAccessStatus(driverSubscription.status)}
            helper={
              driverSubscription.expiresAt
                ? `Доступ до ${formatDate(driverSubscription.expiresAt)}`
                : 'Выберите дневной или месячный доступ'
            }
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Тариф</Text>
          <View style={styles.planGrid}>
            <PlanChoice
              active={selectedMode === 'daily'}
              onPress={() => setSelectedMode('daily')}
              title={driverAccessPlans.daily.name}
              headline={driverAccessPlans.daily.headline}
              text="24 часа доступа"
            />
            <PlanChoice
              active={selectedMode === 'monthly'}
              onPress={() => setSelectedMode('monthly')}
              title={driverAccessPlans.monthly.name}
              headline={driverAccessPlans.monthly.headline}
              text="30 дней доступа"
            />
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Выбрано: {selectedPlan.shortName}</Text>
            <Text style={styles.summaryText}>
              {selectedMode === 'monthly'
                ? '3 290 ₽ за 30 дней. Доступ включается после проверки оплаты.'
                : '120 ₽ за 24 часа. Доступ включается после проверки оплаты.'}
            </Text>
            {selectedMode === 'monthly' && paymentSettings?.cardMask ? (
              <Text style={styles.summaryText}>Карта: {paymentSettings.cardMask}</Text>
            ) : null}
            {paymentNotice ? <Text style={styles.noticeText}>{paymentNotice}</Text> : null}
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
            <CreditCard color="#F4FAF6" size={18} strokeWidth={2.4} />
            <Text style={styles.primaryButtonText}>{primaryButtonLabel}</Text>
            <Text style={styles.hiddenButtonLabel}>
              {busy
                ? 'Подождите...'
                : isSelectedCurrentMode
                ? 'Перейти к заказам'
                : selectedPlan.primaryAction}
            </Text>
          </Pressable>

          {hasPaymentActivity ? (
            <View style={styles.paymentPanel}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showPayments }}
                onPress={() => setShowPayments((current) => !current)}
                style={({ pressed }) => [styles.paymentsToggle, pressed && styles.pressed]}
              >
                <ReceiptText color="#008D49" size={18} strokeWidth={2.4} />
                <Text style={styles.paymentsToggleText}>
                  Платежи доступа{driverPayments.length ? ` · ${driverPayments.length}` : ''}
                </Text>
                {showPayments ? (
                  <ChevronUp color="#008D49" size={18} strokeWidth={2.4} />
                ) : (
                  <ChevronDown color="#008D49" size={18} strokeWidth={2.4} />
                )}
              </Pressable>

              {showPayments ? (
                <View style={styles.paymentDetails}>
                  {pendingProviderPayment ? (
                    <View style={styles.providerActions}>
                      <Pressable
                        accessibilityRole="link"
                        onPress={() => {
                          void Linking.openURL(pendingProviderPayment.confirmationUrl || '');
                        }}
                        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                      >
                        <ExternalLink color="#008D49" size={17} strokeWidth={2.4} />
                        <Text style={styles.providerButtonText}>Открыть оплату</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={syncBusyId === pendingProviderPayment.id}
                        onPress={() => checkPayment(pendingProviderPayment.id)}
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          syncBusyId === pendingProviderPayment.id && styles.disabledButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <RefreshCw color="#008D49" size={17} strokeWidth={2.4} />
                        <Text style={styles.providerButtonText}>
                          {syncBusyId === pendingProviderPayment.id ? 'Проверяем оплату' : 'Проверить оплату'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {lastRefundablePayment ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={refundBusyId === lastRefundablePayment.id}
                      onPress={() => refundPayment(lastRefundablePayment.id)}
                      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                    >
                      <RotateCcw color="#C17A70" size={17} strokeWidth={2.4} />
                      <Text style={styles.refundButtonText}>
                        {refundBusyId === lastRefundablePayment.id ? 'Отменяем платеж' : 'Отменить последний платеж'}
                      </Text>
                    </Pressable>
                  ) : null}

                  {driverPayments.map((payment) => (
                    <PaymentRow key={payment.id} payment={payment} />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type PlanChoiceProps = {
  active: boolean;
  title: string;
  headline: string;
  text: string;
  onPress: () => void;
};

function PlanChoice({ active, headline, onPress, text, title }: PlanChoiceProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.planChoice, active && styles.planChoiceActive, pressed && styles.pressed]}
    >
      <View style={styles.planTop}>
        <CreditCard color={active ? '#F4FAF6' : '#008D49'} size={20} strokeWidth={2.4} />
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
  const isPending = payment.status === 'pending';
  const receipt = payment.refundReceipt ?? payment.receipt;

  return (
    <View style={styles.paymentRow}>
      <View style={styles.paymentIcon}>
        {isRefunded ? (
          <RotateCcw color="#C17A70" size={18} strokeWidth={2.4} />
        ) : isPending ? (
          <CreditCard color="#008D49" size={18} strokeWidth={2.4} />
        ) : (
          <CheckCircle2 color="#008D49" size={18} strokeWidth={2.4} />
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
        {payment.providerPaymentStatus || payment.providerError ? (
          <Text style={styles.paymentText}>
            Источник: {payment.providerPaymentStatus || payment.providerError}
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

  return 'Не подключен';
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

const LINE = 'rgba(11, 47, 37, 0.10)';

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: LINE,
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
    padding: 18,
    shadowColor: '#0B2F25',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  disabledButton: { opacity: 0.64 },
  hiddenButtonLabel: { display: 'none' },
  noticeText: { color: '#008D49', fontSize: 13, fontWeight: '800', lineHeight: 19 },
  page: { backgroundColor: '#F4FAF6', gap: 14, minHeight: '100%', padding: 16 },
  paymentCopy: { flex: 1, gap: 4, minWidth: 0 },
  paymentDetails: { gap: 10 },
  paymentIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 141, 73, 0.10)',
    borderRadius: 11,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  paymentRow: {
    backgroundColor: '#F7FBF8',
    borderColor: LINE,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    padding: 12,
  },
  paymentPanel: {
    backgroundColor: '#F7FBF8',
    borderColor: LINE,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  paymentText: { color: '#71877D', fontSize: 12, lineHeight: 17 },
  paymentTitle: { color: '#12382C', fontSize: 14, fontWeight: '800' },
  paymentsToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
  },
  paymentsToggleText: { color: '#12382C', flex: 1, fontSize: 14, fontWeight: '800' },
  planChoice: {
    backgroundColor: '#FFFFFF',
    borderColor: LINE,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minWidth: 230,
    padding: 15,
    shadowColor: '#0B2F25',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  planChoiceActive: { backgroundColor: '#008D49', borderColor: '#008D49' },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  planHeadline: { color: '#008D49', fontSize: 16, fontWeight: '800' },
  planText: { color: '#71877D', fontSize: 13, lineHeight: 19 },
  planTextActive: { color: '#F4FAF6' },
  planTitle: { color: '#12382C', flex: 1, fontSize: 15, fontWeight: '800' },
  planTop: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
  providerActions: { gap: 10 },
  providerButtonText: { color: '#008D49', fontSize: 14, fontWeight: '800' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
    shadowColor: 'rgba(0, 111, 58, 0.22)',
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  primaryButtonText: { color: '#F4FAF6', fontSize: 15, fontWeight: '800' },
  receiptText: { color: '#008D49', fontSize: 12, fontWeight: '800' },
  refundButtonText: { color: '#D8352B', fontSize: 14, fontWeight: '800' },
  safeArea: { backgroundColor: '#F4FAF6', flex: 1 },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: LINE,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  sectionTitle: { color: '#12382C', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderColor: LINE,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 170,
    padding: 14,
    shadowColor: '#0B2F25',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusHelper: { color: '#71877D', fontSize: 12, lineHeight: 17 },
  statusLabel: { color: '#71877D', fontSize: 12, fontWeight: '700' },
  statusValue: { color: '#12382C', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  summaryBox: {
    backgroundColor: '#F7FBF8',
    borderColor: LINE,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  summaryText: { color: '#71877D', fontSize: 13, lineHeight: 19 },
  summaryTitle: { color: '#12382C', fontSize: 15, fontWeight: '800' },
  trialChoiceCard: {
    backgroundColor: '#FFFCF3',
    borderColor: 'rgba(231, 180, 22, 0.35)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  trialChoiceText: {
    color: '#8A6D1D',
    fontSize: 14,
    lineHeight: 20,
  },
  trialChoiceTitle: {
    color: '#12382C',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
});
