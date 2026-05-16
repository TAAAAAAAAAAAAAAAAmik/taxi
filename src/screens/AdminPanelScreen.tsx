import { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, LockKeyhole, ShieldCheck, MapPinned, ReceiptText, Wallet } from 'lucide-react-native';
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

export function AdminPanelScreen({ navigation }: Props) {
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const { driverSubscription, orders, supportThreads } = useAppState();
  const adminPassword = getPublicEnv('EXPO_PUBLIC_ADMIN_PASSWORD') || 'admin-demo-5000';

  const stats = useMemo(
    () => [
      {
        label: 'Заказы в демо',
        value: String(orders.length),
        helper: 'Локальные заказы в текущей сессии приложения',
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
    ],
    [orders.length, supportThreads.length],
  );

  const handleSubmit = () => {
    setSubmitted(true);

    if (password === adminPassword) {
      setUnlocked(true);
    }
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
                onSubmitEditing={handleSubmit}
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
              onPress={handleSubmit}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <ShieldCheck color="#FFFFFF" size={18} strokeWidth={2.4} />
              <Text style={styles.primaryButtonText}>Войти в админ-панель</Text>
            </Pressable>

            <Text style={styles.helperText}>
              Для демо используется пароль по умолчанию. Перед реальным запуском задайте
              EXPO_PUBLIC_ADMIN_PASSWORD и перенесите проверку на сервер.
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
                    <Text style={styles.orderTitle}>{order.id} · {order.total} ₽</Text>
                    <Text style={styles.orderText}>{order.pickup} → {order.destination}</Text>
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

function getPublicEnv(key: string) {
  const env = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return env.process?.env?.[key];
}

const styles = StyleSheet.create({
  adminLayout: {
    gap: 14,
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
