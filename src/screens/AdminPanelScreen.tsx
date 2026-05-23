import { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Gift, LockKeyhole, ShieldCheck, MapPinned, ReceiptText, Wallet } from 'lucide-react-native';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  salavatAddressSuggestions,
  salavatDistrictSettlements,
  salavatDistrictStreetSourceSummary,
} from '../data/salavatDistrict';
import { salavatDistrictHouseSourceSummary, salavatDistrictHouses } from '../data/salavatDistrictHouses';
import { driverAccessPlans } from '../data/subscription';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminPanel'>;

const demoAdminPassword = 'admin-demo-5000';

export function AdminPanelScreen({ navigation }: Props) {
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const {
    adminReferralDashboard,
    assignOrderToDriver,
    driverSubscription,
    drivers,
    orders,
    loginAdmin,
    refreshAdminReferralDashboard,
    refreshServerData,
    serverMessage,
    serverStatus,
    supportThreads,
    updateDriverComplianceStatus,
    updateDriverReviewStatus,
  } = useAppState();
  const approvedDrivers = drivers.filter((driver) => driver.canReceiveOrders);

  const stats = useMemo(
    () => [
      {
        label: 'Заказы',
        value: String(orders.length),
        helper: serverStatus === 'connected' ? 'Загружены с MVP backend' : 'Локальная сессия приложения',
      },
      {
        label: 'Водители',
        value: String(drivers.length),
        helper: `${approvedDrivers.length} одобрено для заказов`,
      },
      {
        label: 'Обращения поддержки',
        value: String(supportThreads.length),
        helper: 'Локальные обращения до подключения сервера сообщений',
      },
      {
        label: 'Улицы и дороги',
        value: String(salavatDistrictStreetSourceSummary.streets),
        helper: `${salavatDistrictSettlements.length} населенных пунктов Салаватского района`,
      },
      {
        label: 'Точные дома',
        value: String(salavatDistrictHouseSourceSummary.houses),
        helper:
          salavatDistrictHouseSourceSummary.houses > 0
            ? 'Загружены из открытого адресного слоя'
            : 'Запустите импорт домов из OpenStreetMap/GAR',
      },
      {
        label: 'Рефералы',
        value: String(adminReferralDashboard?.summary.referrals ?? 0),
        helper: `${adminReferralDashboard?.summary.rewarded ?? 0} начислено, ${
          adminReferralDashboard?.summary.walletTotal ?? 0
        } ₽ бонусами`,
      },
    ],
    [
      adminReferralDashboard?.summary.referrals,
      adminReferralDashboard?.summary.rewarded,
      adminReferralDashboard?.summary.walletTotal,
      approvedDrivers.length,
      drivers.length,
      orders.length,
      serverStatus,
      supportThreads.length,
    ],
  );

  const handleSubmit = async (nextPassword?: string) => {
    const passwordToSubmit = typeof nextPassword === 'string' ? nextPassword : password;

    setSubmitted(true);

    if (await loginAdmin(passwordToSubmit)) {
      setUnlocked(true);
    }
  };

  const handleDemoSubmit = async () => {
    setPassword(demoAdminPassword);
    setSubmitted(false);
    await handleSubmit(demoAdminPassword);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
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

        {!unlocked ? (
          <View style={styles.loginCard}>
            <View style={styles.iconWrap}>
              <LockKeyhole color="#146C5D" size={30} strokeWidth={2.4} />
            </View>
            <Text style={styles.title}>Админ-панель</Text>
            <Text style={styles.subtitle}>
              Для входа нужен только личный пароль администратора. Логин, телефон и почта не
              запрашиваются.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Пароль администратора</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(value) => {
                  setPassword(value);
                  setSubmitted(false);
                }}
                onSubmitEditing={() => handleSubmit()}
                placeholder="Введите личный пароль"
                placeholderTextColor="#8A8F98"
                secureTextEntry
                style={styles.input}
                value={password}
              />
              {submitted && !unlocked ? (
                <Text style={styles.errorText}>Пароль не подошел. Проверьте ввод.</Text>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => handleSubmit()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <ShieldCheck color="#FFFFFF" size={18} strokeWidth={2.4} />
              <Text style={styles.primaryButtonText}>Войти в админ-панель</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={handleDemoSubmit}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <LockKeyhole color="#146C5D" size={18} strokeWidth={2.4} />
              <Text style={styles.secondaryButtonText}>Демо-админ</Text>
            </Pressable>

            <Text style={styles.helperText}>
              Пароль проверяется на MVP backend. Для локального запуска по умолчанию:
              admin-demo-5000. Перед пилотом задайте MVP_ADMIN_PASSWORD.
            </Text>
          </View>
        ) : (
          <View style={styles.adminLayout}>
            <View style={styles.headerCard}>
              <Text style={styles.title}>Админ-панель</Text>
              <Text style={styles.subtitle}>
                Быстрый контроль MVP: заказы, поддержка, адресный слой и модель оплаты водителей.
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <ShieldCheck color="#146C5D" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Backend</Text>
              </View>
              <Text style={styles.sectionText}>
                Статус: {serverStatus === 'connected' ? 'подключен' : 'локальный режим'}.
              </Text>
              <Text style={styles.sectionTextMuted}>{serverMessage}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={refreshServerData}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Обновить данные</Text>
              </Pressable>
            </View>

            <View style={styles.statsGrid}>
              {stats.map((item) => (
                <View key={item.label} style={styles.statCard}>
                  <Text style={styles.statLabel}>{item.label}</Text>
                  <Text style={styles.statValue}>{item.value}</Text>
                  <Text style={styles.statHelper}>{item.helper}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Wallet color="#146C5D" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Оплата водителя</Text>
              </View>
              <PlanRow title={driverAccessPlans.monthly.name} value={driverAccessPlans.monthly.headline} />
              <PlanRow title={driverAccessPlans.commission.name} value={driverAccessPlans.commission.headline} />
              <Text style={styles.sectionText}>
                Текущая локальная модель водителя: {driverSubscription.planName}. Статус:{' '}
                {driverSubscription.status}.
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Gift color="#146C5D" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Рефералы</Text>
              </View>
              <Text style={styles.sectionText}>
                Всего: {adminReferralDashboard?.summary.referrals ?? 0}. Регистрация:{' '}
                {adminReferralDashboard?.summary.registered ?? 0}. В процессе:{' '}
                {adminReferralDashboard?.summary.qualified ?? 0}. Начислено:{' '}
                {adminReferralDashboard?.summary.rewarded ?? 0}.
              </Text>
              <Text style={styles.sectionTextMuted}>
                Бонусных операций: {adminReferralDashboard?.summary.walletEntries ?? 0}. Сумма:{' '}
                {adminReferralDashboard?.summary.walletTotal ?? 0} ₽.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={refreshAdminReferralDashboard}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Обновить рефералы</Text>
              </Pressable>
              {adminReferralDashboard?.referrals.length ? (
                adminReferralDashboard.referrals.slice(0, 8).map((referral) => (
                  <View key={referral.id} style={styles.orderRow}>
                    <Text style={styles.orderTitle}>
                      {referral.inviterName} → {referral.inviteeName}
                    </Text>
                    <Text style={styles.orderText}>
                      {referral.inviteeRole === 'driver' ? 'Водитель' : 'Клиент'} · {referral.status} ·{' '}
                      {referral.rewardAmount} ₽
                    </Text>
                    <Text style={styles.orderText}>
                      Прогресс: {referral.progress?.completedOrders ?? 0}/
                      {referral.progress?.requiredOrders ?? 0} поездок · код {referral.code}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.sectionTextMuted}>Реферальных приглашений пока нет.</Text>
              )}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <ShieldCheck color="#146C5D" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Водители</Text>
              </View>
              {drivers.map((driver) => (
                <View key={driver.id} style={styles.orderRow}>
                  <Text style={styles.orderTitle}>
                    {driver.name} · {driver.vehicle || 'авто не указано'}
                  </Text>
                  <Text style={styles.orderText}>
                    {driver.phone || 'телефон не указан'} · {driver.plate || 'номер не указан'} · статус:{' '}
                    {driver.status}
                  </Text>
                  <Text style={styles.orderText}>
                    Допуск к заказам: {driver.canReceiveOrders ? 'открыт' : 'закрыт'}.
                  </Text>
                  <View style={styles.complianceGrid}>
                    <CompliancePill label="Документы" value={driver.documentsStatus} readyValue="approved" />
                    <CompliancePill label="Договор" value={driver.contractStatus} readyValue="signed" />
                    <CompliancePill label="Разрешение авто" value={driver.vehiclePermitStatus} readyValue="approved" />
                    <CompliancePill label="Реестр" value={driver.registryStatus} readyValue="active" />
                    <CompliancePill label="Налоги" value={driver.taxProfileStatus} readyValue="approved" />
                  </View>
                  <View style={styles.rowActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => updateDriverReviewStatus(driver.id, 'approved')}
                      style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.smallButtonText}>Одобрить</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => updateDriverReviewStatus(driver.id, 'blocked')}
                      style={({ pressed }) => [
                        styles.smallButton,
                        styles.dangerButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.dangerButtonText}>Блок</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        updateDriverComplianceStatus(driver.id, {
                          contractStatus: 'signed',
                          documentsStatus: 'approved',
                          registryStatus: 'active',
                          taxProfileStatus: 'approved',
                          vehiclePermitStatus: 'approved',
                        })
                      }
                      style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.smallButtonText}>Открыть допуск</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        updateDriverComplianceStatus(driver.id, {
                          documentsStatus: 'rejected',
                        })
                      }
                      style={({ pressed }) => [
                        styles.smallButton,
                        styles.dangerButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.dangerButtonText}>Отклонить документы</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <MapPinned color="#146C5D" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Адресный слой</Text>
              </View>
              <Text style={styles.sectionText}>
                Подсказок адресов и POI: {salavatAddressSuggestions.length}. Улиц/дорог:{' '}
                {salavatDistrictStreetSourceSummary.streets}. Домов:{' '}
                {salavatDistrictHouses.length}.
              </Text>
              <Text style={styles.sectionTextMuted}>{salavatDistrictHouseSourceSummary.note}</Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <ReceiptText color="#146C5D" size={20} strokeWidth={2.4} />
                <Text style={styles.sectionTitle}>Последние заказы</Text>
              </View>
              {orders.length > 0 ? (
                orders.slice(0, 5).map((order) => (
                  <View key={order.id} style={styles.orderRow}>
                    <Text style={styles.orderTitle}>
                      {order.id} · {order.total} ₽ · {order.status}
                    </Text>
                    <Text style={styles.orderText}>
                      {order.pickup} → {order.destination}
                    </Text>
                    <Text style={styles.orderText}>
                      Водитель: {order.driver ? `${order.driver.name}, ${order.driver.vehicle}` : 'не назначен'}
                    </Text>
                    {!order.driver && approvedDrivers.length > 0 ? (
                      <View style={styles.rowActions}>
                        {approvedDrivers.slice(0, 2).map((driver) => (
                          <Pressable
                            accessibilityRole="button"
                            key={driver.id}
                            onPress={() => assignOrderToDriver(order.id, driver.id)}
                            style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                          >
                            <Text style={styles.smallButtonText}>Назначить {driver.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.sectionTextMuted}>Заказов в текущей сессии пока нет.</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type PlanRowProps = {
  title: string;
  value: string;
};

function PlanRow({ title, value }: PlanRowProps) {
  return (
    <View style={styles.planRow}>
      <Text style={styles.planTitle}>{title}</Text>
      <Text style={styles.planValue}>{value}</Text>
    </View>
  );
}

function CompliancePill({
  label,
  readyValue,
  value,
}: {
  label: string;
  readyValue: string;
  value?: string;
}) {
  const isReady = value === readyValue;

  return (
    <View style={[styles.compliancePill, isReady && styles.compliancePillReady]}>
      <Text style={[styles.complianceLabel, isReady && styles.complianceLabelReady]}>{label}</Text>
      <Text style={[styles.complianceValue, isReady && styles.complianceValueReady]}>
        {isReady ? 'ок' : value || 'pending'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  adminLayout: {
    gap: 14,
  },
  complianceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  complianceLabel: {
    color: '#59616C',
    fontSize: 11,
    fontWeight: '800',
  },
  complianceLabelReady: {
    color: '#146C5D',
  },
  compliancePill: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
    minWidth: 104,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  compliancePillReady: {
    backgroundColor: '#E9F4F1',
    borderColor: '#146C5D',
  },
  complianceValue: {
    color: '#20242A',
    fontSize: 11,
    fontWeight: '900',
  },
  complianceValueReady: {
    color: '#146C5D',
  },
  dangerButton: {
    backgroundColor: '#FFF1F0',
    borderColor: '#D92D20',
  },
  dangerButtonText: {
    color: '#B42318',
    fontSize: 12,
    fontWeight: '900',
  },
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
  errorText: {
    color: '#B42318',
    fontSize: 13,
    fontWeight: '800',
  },
  field: {
    gap: 8,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  helperText: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 18,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
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
    fontWeight: '900',
  },
  loginCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 18,
  },
  orderRow: {
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  orderText: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 18,
  },
  orderTitle: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#F4F7F5',
    gap: 16,
    minHeight: '100%',
    padding: 16,
  },
  planRow: {
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  planTitle: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  planValue: {
    color: '#146C5D',
    fontSize: 13,
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
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  safeArea: {
    backgroundColor: '#F4F7F5',
    flex: 1,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionText: {
    color: '#20242A',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTextMuted: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    color: '#20242A',
    fontSize: 17,
    fontWeight: '900',
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
    minHeight: 42,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
  smallButton: {
    alignItems: 'center',
    backgroundColor: '#E9F4F1',
    borderColor: '#146C5D',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 10,
  },
  smallButtonText: {
    color: '#146C5D',
    fontSize: 12,
    fontWeight: '900',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 150,
    padding: 14,
  },
  statHelper: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  statLabel: {
    color: '#59616C',
    fontSize: 12,
    fontWeight: '800',
  },
  statValue: {
    color: '#20242A',
    fontSize: 26,
    fontWeight: '900',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    alignItems: 'flex-start',
  },
});
