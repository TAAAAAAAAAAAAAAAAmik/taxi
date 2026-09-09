import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, MapPin, Phone, Route as RouteIcon, User } from 'lucide-react-native';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { RootStackParamList } from '../navigation/types';
import { ApiAddressSuggestion, ApiGeoPoint, searchAddressSuggestions } from '../services/apiClient';
import { useAppState } from '../state/AppState';
import { kinetixColors } from '../theme/kinetixTokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Dispatcher'>;
type Field = 'destination' | 'pickup';

type AddressValue = {
  point?: ApiGeoPoint;
  text: string;
};

const EMPTY: AddressValue = { text: '' };

// Показываем телефон как +7 999 123-45-67, а на сервер уходят только цифры.
function formatPhone(digits: string) {
  const rest = digits.slice(1);
  const parts = [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 8), rest.slice(8, 10)].filter(Boolean);

  if (!parts.length) {
    return '+7';
  }

  return `+7 ${parts[0]}${parts[1] ? ` ${parts[1]}` : ''}${parts[2] ? `-${parts[2]}` : ''}${
    parts[3] ? `-${parts[3]}` : ''
  }`;
}

function readDigits(value: string) {
  const digits = value.replace(/\D/g, '');
  const withoutCountry = digits.startsWith('8') ? `7${digits.slice(1)}` : digits;

  return `7${withoutCountry.replace(/^7/, '').slice(0, 10)}`;
}

export function DispatcherScreen({ navigation }: Props) {
  const { addOrder, orders } = useAppState();
  const [digits, setDigits] = useState('7');
  const [name, setName] = useState('');
  const [pickup, setPickup] = useState<AddressValue>(EMPTY);
  const [destination, setDestination] = useState<AddressValue>(EMPTY);
  const [activeField, setActiveField] = useState<Field | null>(null);
  const [suggestions, setSuggestions] = useState<ApiAddressSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const phoneReady = digits.length === 11;
  const ready = phoneReady && pickup.text.trim().length > 2 && destination.text.trim().length > 2;
  const query = activeField === 'pickup' ? pickup.text : activeField === 'destination' ? destination.text : '';

  // Подсказки те же, что видит клиент в приложении, — диспетчер не должен
  // угадывать написание адреса на слух.
  useEffect(() => {
    if (!activeField || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const id = requestId.current + 1;
    requestId.current = id;
    const timer = setTimeout(async () => {
      try {
        const found = await searchAddressSuggestions(query.trim());

        if (requestId.current === id) {
          setSuggestions(found.slice(0, 6));
        }
      } catch {
        if (requestId.current === id) {
          setSuggestions([]);
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [activeField, query]);

  const applySuggestion = useCallback(
    (suggestion: ApiAddressSuggestion) => {
      const value: AddressValue = {
        point: suggestion.coordinates,
        text: suggestion.displayAddress || suggestion.title,
      };

      if (activeField === 'pickup') {
        setPickup(value);
      } else if (activeField === 'destination') {
        setDestination(value);
      }

      setSuggestions([]);
      setActiveField(null);
      Keyboard.dismiss();
    },
    [activeField],
  );

  const todayPhoneOrders = useMemo(
    () => orders.filter((order) => order.orderSource === 'dispatcher').slice(0, 5),
    [orders],
  );

  const submit = async () => {
    if (busy || !ready) {
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    const outcome = await addOrder(
      {
        clientPhone: `+${digits}`,
        clientRequestId: `call-${Date.now().toString(36)}`,
        destination: destination.text.trim(),
        // Цену считает сервер по своему тарифу — диспетчер её не назначает.
        id: '',
        options: [],
        orderSource: 'dispatcher',
        paymentMethod: 'Наличные',
        pickup: pickup.text.trim(),
        pickupPoint: pickup.point,
        tariff: 'Эконом',
        tariffId: 'economy',
        total: 0,
      },
      'client',
      name.trim() || 'Заказ по телефону',
    );

    setBusy(false);

    if (outcome.outcome === 'rejected') {
      setError(outcome.message);
      return;
    }

    setResult(
      `Заказ ${outcome.order.id} принят — ${outcome.order.total} ₽. Водители его видят.`,
    );
    setDigits('7');
    setName('');
    setPickup(EMPTY);
    setDestination(EMPTY);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Назад"
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <ArrowLeft color={kinetixColors.textPrimary} size={22} strokeWidth={2.4} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Заказ по телефону</Text>
            <Text style={styles.subtitle}>Клиент позвонил — впишите адрес, заказ уйдёт водителям</Text>
          </View>
        </View>

        <View style={styles.card}>
          <FieldLabel Icon={Phone} label="Номер клиента" />
          <TextInput
            accessibilityLabel="Номер клиента"
            keyboardType="phone-pad"
            onChangeText={(value) => setDigits(readDigits(value))}
            onFocus={() => setActiveField(null)}
            style={styles.input}
            value={formatPhone(digits)}
          />
          <Text style={styles.hint}>Водитель позвонит по этому номеру, когда подъедет</Text>

          <FieldLabel Icon={User} label="Имя (необязательно)" />
          <TextInput
            accessibilityLabel="Имя клиента"
            onChangeText={setName}
            onFocus={() => setActiveField(null)}
            placeholder="Как зовут"
            placeholderTextColor={kinetixColors.textMuted}
            style={styles.input}
            value={name}
          />

          <FieldLabel Icon={MapPin} label="Откуда" />
          <TextInput
            accessibilityLabel="Адрес подачи"
            onChangeText={(text) => setPickup({ text })}
            onFocus={() => setActiveField('pickup')}
            placeholder="Малояз, Советская 12"
            placeholderTextColor={kinetixColors.textMuted}
            style={styles.input}
            value={pickup.text}
          />

          <FieldLabel Icon={RouteIcon} label="Куда" />
          <TextInput
            accessibilityLabel="Адрес назначения"
            onChangeText={(text) => setDestination({ text })}
            onFocus={() => setActiveField('destination')}
            placeholder="Малояз, автовокзал"
            placeholderTextColor={kinetixColors.textMuted}
            style={styles.input}
            value={destination.text}
          />

          {suggestions.length ? (
            <View style={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <Pressable
                  accessibilityRole="button"
                  key={suggestion.id}
                  onPress={() => applySuggestion(suggestion)}
                  style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                >
                  <MapPin color={kinetixColors.amber} size={16} strokeWidth={2.4} />
                  <View style={styles.suggestionCopy}>
                    <Text numberOfLines={1} style={styles.suggestionTitle}>{suggestion.title}</Text>
                    <Text numberOfLines={1} style={styles.suggestionSub}>{suggestion.subtitle}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {result ? (
            <View style={styles.result}>
              <Check color={kinetixColors.amber} size={17} strokeWidth={2.6} />
              <Text style={styles.resultText}>{result}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={!ready || busy}
            onPress={submit}
            style={({ pressed }) => [
              styles.primary,
              (!ready || busy) && styles.primaryDisabled,
              pressed && styles.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>Отправить водителям</Text>
            )}
          </Pressable>
        </View>

        {todayPhoneOrders.length ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Последние заказы по телефону</Text>
            {todayPhoneOrders.map((order) => (
              <View key={order.id} style={styles.historyRow}>
                <View style={styles.historyCopy}>
                  <Text numberOfLines={1} style={styles.historyTitle}>
                    {order.pickup} → {order.destination}
                  </Text>
                  <Text numberOfLines={1} style={styles.historySub}>
                    {order.clientPhone} · {order.total} ₽
                  </Text>
                </View>
                <Text style={styles.historyStatus}>
                  {order.driver ? 'Принят' : 'Ищем машину'}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function FieldLabel({ Icon, label }: { Icon: typeof MapPin; label: string }) {
  return (
    <View style={styles.fieldLabel}>
      <Icon color={kinetixColors.textSecondary} size={15} strokeWidth={2.4} />
      <Text style={styles.fieldLabelText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: kinetixColors.graphite,
    flex: 1,
  },
  page: {
    gap: 14,
    padding: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  back: {
    alignItems: 'center',
    backgroundColor: kinetixColors.surface,
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: kinetixColors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: kinetixColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: kinetixColors.surface,
    borderColor: kinetixColors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  fieldLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    marginTop: 8,
  },
  fieldLabelText: {
    color: kinetixColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: kinetixColors.surfaceLight,
    borderColor: kinetixColors.line,
    borderRadius: 12,
    borderWidth: 1,
    color: kinetixColors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
    height: 52,
    paddingHorizontal: 14,
  },
  hint: {
    color: kinetixColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  suggestions: {
    backgroundColor: kinetixColors.surfaceRaised,
    borderRadius: 12,
    gap: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  suggestion: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  suggestionCopy: {
    flex: 1,
  },
  suggestionTitle: {
    color: kinetixColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  suggestionSub: {
    color: kinetixColors.textSecondary,
    fontSize: 12,
  },
  error: {
    color: kinetixColors.danger,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 6,
  },
  result: {
    alignItems: 'flex-start',
    backgroundColor: kinetixColors.amberSoft,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    padding: 12,
  },
  resultText: {
    color: kinetixColors.textPrimary,
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  primary: {
    alignItems: 'center',
    backgroundColor: kinetixColors.amber,
    borderRadius: 13,
    height: 54,
    justifyContent: 'center',
    marginTop: 12,
  },
  primaryDisabled: {
    backgroundColor: kinetixColors.disabled,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    color: kinetixColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  historyRow: {
    alignItems: 'center',
    borderTopColor: kinetixColors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 11,
  },
  historyCopy: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    color: kinetixColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  historySub: {
    color: kinetixColors.textSecondary,
    fontSize: 12,
  },
  historyStatus: {
    color: kinetixColors.amber,
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});
