import { ReactNode, useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Banknote,
  Car,
  Check,
  Clock3,
  CreditCard,
  LocateFixed,
  MapPinned,
  Navigation,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react-native';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { orderFlowConfig, OrderField, OrderOption, OrderTariff } from '../data/orderFlow';
import { AccountRole, roleCopy } from '../data/registration';
import {
  findSalavatAddressSuggestions,
  formatSalavatAddress,
  GeoPoint,
  getCoverageText,
  getCoverageTitle,
  salavatDistrictInfo,
  SalavatAddressSuggestion,
  SalavatRoutePreset,
  salavatAddressSuggestions,
  salavatPopularRoutes,
} from '../data/salavatDistrict';
import { RootStackParamList } from '../navigation/types';
import { requestUserLocation, reverseGeocodePoint } from '../services/locationService';
import { useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderFlow'>;

export function OrderFlowScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const { width } = useWindowDimensions();
  const config = orderFlowConfig[role];
  const isWide = width >= 840;
  const {
    addOrder,
    currentUser,
    driverSubscription,
    drivers,
    orders,
    refreshServerData,
    savedHomeAddress,
    serverMessage,
    serverStatus,
    updateOrderStatus,
  } = useAppState();

  const [values, setValues] = useState<Record<string, string>>(() =>
    createInitialOrderValues(role),
  );
  const [selectedTariffId, setSelectedTariffId] = useState(config.tariffs[0].id);
  const [paymentMethod, setPaymentMethod] = useState(config.paymentMethods[0]);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [activeAddressFieldId, setActiveAddressFieldId] = useState<string | null>(null);
  const [locationPoint, setLocationPoint] = useState<GeoPoint | undefined>();
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFeedOrderId, setSelectedFeedOrderId] = useState<string | null>(null);

  const selectedTariff = useMemo(
    () => config.tariffs.find((tariff) => tariff.id === selectedTariffId) ?? config.tariffs[0],
    [config.tariffs, selectedTariffId],
  );
  const selectedOptionItems = useMemo(
    () => config.options.filter((option) => selectedOptions.includes(option.id)),
    [config.options, selectedOptions],
  );
  const optionsTotal = selectedOptionItems.reduce((sum, option) => sum + option.price, 0);
  const total = selectedTariff.price + optionsTotal;
  const canConfirm = Boolean(values.pickup?.trim()) && Boolean(values.destination?.trim());
  const usesRegionalAddressBook = role !== 'driver';
  const currentDriver = useMemo(
    () =>
      role === 'driver' && currentUser
        ? drivers.find((driver) => driver.userId === currentUser.id)
        : undefined,
    [currentUser, drivers, role],
  );
  const driverNeedsApproval =
    role === 'driver' && currentUser && currentDriver?.status !== 'approved';
  const availableDriverOrders = useMemo(
    () =>
      role === 'driver' && !driverNeedsApproval
        ? orders.filter(
            (order) =>
              order.role === 'client' &&
              !order.driver &&
              ['created', 'searching'].includes(order.status),
          )
        : [],
    [driverNeedsApproval, orders, role],
  );
  const selectedFeedOrder =
    availableDriverOrders.find((order) => order.id === selectedFeedOrderId) ?? availableDriverOrders[0];

  useEffect(() => {
    if (role !== 'driver' || !selectedFeedOrder) {
      return;
    }

    setValues((current) => ({
      ...current,
      clientComment: selectedFeedOrder.options.join(', ') || 'Комментарий не указан',
      destination: selectedFeedOrder.destination,
      pickup: selectedFeedOrder.pickup,
      pickupDistance: 'Открытый заказ из backend',
    }));
    setSelectedTariffId(config.tariffs[0].id);
    setPaymentMethod(selectedFeedOrder.paymentMethod);
  }, [config.tariffs, role, selectedFeedOrder, selectedFeedOrderId]);

  const updateValue = (id: string, nextValue: string) => {
    setConfirmed(false);
    setValues((current) => ({ ...current, [id]: nextValue }));
  };

  const toggleOption = (option: OrderOption) => {
    setConfirmed(false);
    setSelectedOptions((current) =>
      current.includes(option.id)
        ? current.filter((item) => item !== option.id)
        : [...current, option.id],
    );
  };

  const applySuggestion = (suggestion: string) => {
    const target = values.pickup?.trim() ? 'destination' : 'pickup';
    updateValue(target, suggestion);
  };

  const applyRoutePreset = (preset: SalavatRoutePreset) => {
    setConfirmed(false);
    setValues((current) => ({
      ...current,
      destination: preset.destination,
      pickup: preset.pickup,
    }));
  };

  const selectAddressSuggestion = (fieldId: string, address: SalavatAddressSuggestion) => {
    updateValue(fieldId, formatSalavatAddress(address));
    setActiveAddressFieldId(null);
  };

  const selectDriverFeedOrder = (orderId: string) => {
    setSelectedFeedOrderId(orderId);
  };

  const requestLocationRoutes = async () => {
    setLocationMessage('Запрашиваем геолокацию...');
    const result = await requestUserLocation();

    if (result.status === 'granted') {
      setLocationPoint(result.point);
      setLocationMessage('Геолокация получена, определяем адрес...');

      const geocoded = await reverseGeocodePoint(result.point);

      if (geocoded.status === 'resolved') {
        setLocationMessage(`Адрес определен: ${geocoded.address.displayAddress}`);

        if (!values.pickup?.trim()) {
          updateValue('pickup', geocoded.address.displayAddress);
        }

        return;
      }

      setLocationMessage(geocoded.message);
      return;
    }

    setLocationMessage(result.message);
  };

  const handlePrimaryAction = async () => {
    if (driverNeedsApproval) {
      setConfirmed(true);
      return;
    }

    if (role === 'driver' && driverSubscription.status !== 'active') {
      navigation.navigate('Subscription', { firstName, role });
      return;
    }

    if (!canConfirm) {
      setConfirmed(true);
      return;
    }

    if (role === 'driver' && selectedFeedOrder) {
      setIsSubmitting(true);

      try {
        await updateOrderStatus(selectedFeedOrder.id, 'accepted');
        const acceptedOrder = {
          ...selectedFeedOrder,
          status: 'accepted',
        };
        setConfirmed(true);
        navigation.navigate('OrderStatus', {
          firstName,
          order: acceptedOrder,
          role,
        });
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    const order = {
      destination: values.destination.trim(),
      id: `TX-${Date.now().toString().slice(-6)}`,
      options: selectedOptionItems.map((option) => option.label),
      paymentMethod,
      pickup: values.pickup.trim(),
      tariff: selectedTariff.title,
      total,
    };

    setIsSubmitting(true);

    try {
      const createdOrder = await addOrder(order, role, firstName);
      setConfirmed(true);
      navigation.navigate('OrderStatus', {
        firstName,
        order: createdOrder,
        role,
      });
    } finally {
      setIsSubmitting(false);
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

          <View style={styles.rolePill}>
            <UserRound color="#146C5D" size={17} strokeWidth={2.4} />
            <Text style={styles.rolePillText}>{roleCopy[role].title}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Route color="#146C5D" size={30} strokeWidth={2.4} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>{config.title}</Text>
            <Text style={styles.subtitle}>{config.subtitle}</Text>
            <Text style={styles.userLine}>Профиль: {firstName?.trim() || 'пользователь'}</Text>
            {usesRegionalAddressBook ? (
              <Text style={styles.regionLine}>
                Зона MVP: {salavatDistrictInfo.region}. Центр - {salavatDistrictInfo.center}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.timeline}>
          {config.timeline.map((step, index) => (
            <View key={step} style={styles.timelineStep}>
              <View style={[styles.timelineDot, index === 0 && styles.timelineDotActive]}>
                <Text style={[styles.timelineIndex, index === 0 && styles.timelineIndexActive]}>
                  {index + 1}
                </Text>
              </View>
              <Text style={styles.timelineText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.layout, isWide && styles.layoutWide]}>
          <View style={styles.mainColumn}>
            <View style={styles.panel}>
              <SectionHeader
                icon={<MapPinned color="#146C5D" size={20} strokeWidth={2.4} />}
                title={config.routeTitle}
              />
              {usesRegionalAddressBook ? (
                <View style={styles.regionBox}>
                  <Text style={styles.regionTitle}>{getCoverageTitle(locationPoint)}</Text>
                  <Text style={styles.regionText}>{getCoverageText(locationPoint)}</Text>
                  <Text style={styles.regionMeta}>
                    Зона MVP: {salavatDistrictInfo.region}. Загружено:{' '}
                    {salavatAddressSuggestions.length} адресных подсказок и{' '}
                    {salavatPopularRoutes.length} базовых маршрутов.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={requestLocationRoutes}
                    style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}
                  >
                    <LocateFixed color="#146C5D" size={17} strokeWidth={2.4} />
                    <Text style={styles.locationButtonText}>Определить мое место</Text>
                  </Pressable>
                  {locationMessage ? <Text style={styles.regionText}>{locationMessage}</Text> : null}
                  {savedHomeAddress ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => updateValue('pickup', savedHomeAddress.address)}
                      style={({ pressed }) => [styles.homeAddressButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.homeAddressTitle}>Дом</Text>
                      <Text style={styles.homeAddressText}>{savedHomeAddress.address}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              {usesRegionalAddressBook ? (
                <View style={styles.routePresetGrid}>
                  {salavatPopularRoutes.map((route) => (
                    <RoutePresetCard key={route.id} onPress={() => applyRoutePreset(route)} route={route} />
                  ))}
                </View>
              ) : (
                <>
                  <View style={styles.regionBox}>
                    <Text style={styles.regionTitle}>Открытые заказы</Text>
                    <Text style={styles.regionText}>
                      {driverNeedsApproval
                        ? 'Заявка водителя создана. Администратор должен проверить автомобиль и открыть доступ.'
                        : availableDriverOrders.length > 0
                        ? `Доступно заявок: ${availableDriverOrders.length}. Выберите заказ и нажмите принятие.`
                        : 'Открытых заявок нет. Обновите backend или примите заказ вручную для демо.'}
                    </Text>
                    {currentDriver ? (
                      <Text style={styles.regionMeta}>Статус допуска: {currentDriver.status}</Text>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      onPress={refreshServerData}
                      style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}
                    >
                      <Route color="#146C5D" size={17} strokeWidth={2.4} />
                      <Text style={styles.locationButtonText}>Обновить ленту</Text>
                    </Pressable>
                    {availableDriverOrders.slice(0, 4).map((order) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: order.id === selectedFeedOrder?.id }}
                        key={order.id}
                        onPress={() => selectDriverFeedOrder(order.id)}
                        style={({ pressed }) => [
                          styles.homeAddressButton,
                          order.id === selectedFeedOrder?.id && styles.tariffCardActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.homeAddressTitle}>
                          {order.id} · {order.total} ₽ · {order.tariff}
                        </Text>
                        <Text style={styles.homeAddressText}>
                          {order.pickup} → {order.destination}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.suggestions}>
                    {config.suggestions.map((suggestion) => (
                      <Pressable
                        accessibilityRole="button"
                        key={suggestion}
                        onPress={() => applySuggestion(suggestion)}
                        style={({ pressed }) => [styles.suggestionChip, pressed && styles.pressed]}
                      >
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              <View style={styles.fields}>
                {config.fields.map((field) => (
                  <OrderInput
                    active={activeAddressFieldId === field.id}
                    field={field}
                    key={field.id}
                    onChangeText={(nextValue) => updateValue(field.id, nextValue)}
                    onFocus={() => setActiveAddressFieldId(field.id)}
                    onSelectSuggestion={(address) => selectAddressSuggestion(field.id, address)}
                    suggestions={
                      usesRegionalAddressBook &&
                      ['pickup', 'destination'].includes(field.id) &&
                      activeAddressFieldId === field.id
                        ? findSalavatAddressSuggestions(values[field.id] ?? '')
                        : []
                    }
                    value={values[field.id] ?? ''}
                  />
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              <SectionHeader
                icon={<Car color="#146C5D" size={20} strokeWidth={2.4} />}
                title={config.tariffTitle}
              />
              <View style={styles.tariffGrid}>
                {config.tariffs.map((tariff) => (
                  <TariffCard
                    active={tariff.id === selectedTariffId}
                    key={tariff.id}
                    onPress={() => {
                      setConfirmed(false);
                      setSelectedTariffId(tariff.id);
                    }}
                    tariff={tariff}
                  />
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              <SectionHeader
                icon={<SlidersHorizontal color="#146C5D" size={20} strokeWidth={2.4} />}
                title={config.detailsTitle}
              />
              <View style={styles.fields}>
                {config.detailFields.map((field) => (
                  <OrderInput
                    active={false}
                    field={field}
                    key={field.id}
                    onChangeText={(nextValue) => updateValue(field.id, nextValue)}
                    onFocus={() => setActiveAddressFieldId(null)}
                    onSelectSuggestion={() => undefined}
                    suggestions={[]}
                    value={values[field.id] ?? ''}
                  />
                ))}
              </View>
              <View style={styles.optionGrid}>
                {config.options.map((option) => (
                  <OptionToggle
                    active={selectedOptions.includes(option.id)}
                    key={option.id}
                    onPress={() => toggleOption(option)}
                    option={option}
                  />
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.summaryColumn, isWide && styles.summaryColumnWide]}>
            <View style={styles.summaryPanel}>
              <SectionHeader
                icon={<ShieldCheck color="#146C5D" size={20} strokeWidth={2.4} />}
                title={config.summaryTitle}
              />
              <View style={styles.summaryRows}>
                <SummaryRow label="Тариф" value={selectedTariff.title} />
                <SummaryRow label="Подача" value={selectedTariff.eta} />
                <SummaryRow label="Опции" value={`${optionsTotal} ₽`} />
                <SummaryRow label={role === 'driver' ? 'Доход' : 'Итого'} value={`${total} ₽`} />
              </View>

              <View style={styles.paymentGroup}>
                <Text style={styles.groupLabel}>Оплата</Text>
                {config.paymentMethods.map((method) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: method === paymentMethod }}
                    key={method}
                    onPress={() => {
                      setConfirmed(false);
                      setPaymentMethod(method);
                    }}
                    style={({ pressed }) => [
                      styles.paymentButton,
                      method === paymentMethod && styles.paymentButtonActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    {method.includes('Налич') ? (
                      <Banknote
                        color={method === paymentMethod ? '#FFFFFF' : '#146C5D'}
                        size={18}
                        strokeWidth={2.4}
                      />
                    ) : (
                      <CreditCard
                        color={method === paymentMethod ? '#FFFFFF' : '#146C5D'}
                        size={18}
                        strokeWidth={2.4}
                      />
                    )}
                    <Text
                      style={[
                        styles.paymentText,
                        method === paymentMethod && styles.paymentTextActive,
                      ]}
                    >
                      {method}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.statusBox}>
                <Clock3 color="#146C5D" size={18} strokeWidth={2.4} />
                <View style={styles.statusCopy}>
                  <Text style={styles.statusTitle}>{config.statusTitle}</Text>
                  <Text style={styles.statusText}>{config.statusText}</Text>
                </View>
              </View>

              <View
                style={[
                  styles.resultBox,
                  serverStatus === 'connected' && styles.resultBoxSuccess,
                ]}
              >
                <Text style={styles.resultTitle}>
                  {serverStatus === 'connected' ? 'Backend подключен' : 'Локальный режим'}
                </Text>
                <Text style={styles.resultText}>{serverMessage}</Text>
              </View>

              {confirmed ? (
                <View style={[styles.resultBox, canConfirm && styles.resultBoxSuccess]}>
                  <Text style={styles.resultTitle}>
                    {driverNeedsApproval ? 'Нужен допуск' : canConfirm ? 'Готово к отправке' : 'Нужен маршрут'}
                  </Text>
                  <Text style={styles.resultText}>
                    {driverNeedsApproval
                      ? 'Реальные заказы откроются после ручного одобрения администратора.'
                      : canConfirm
                      ? 'Следующий шаг - отправка на сервер и создание заказа.'
                      : 'Заполните точку подачи и назначение, чтобы оформить заказ.'}
                  </Text>
                </View>
              ) : null}

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={handlePrimaryAction}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                  <Navigation color="#FFFFFF" size={18} strokeWidth={2.4} />
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? 'Отправляем...' : config.primaryAction}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>{config.secondaryAction}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createInitialOrderValues(role: AccountRole): Record<string, string> {
  if (role === 'driver') {
    return {
      clientComment: 'Ждать у центрального входа, нужна связь перед подачей',
      destination: 'Санаторий Янгантау, с. Янгантау',
      pickup: 'Центр Малояза, с. Малояз',
      pickupDistance: '8.2 км, 12 минут',
    };
  }

  return {};
}

type SectionHeaderProps = {
  icon: ReactNode;
  title: string;
};

function SectionHeader({ icon, title }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      {icon}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

type OrderInputProps = {
  field: OrderField;
  value: string;
  active: boolean;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  onSelectSuggestion: (address: SalavatAddressSuggestion) => void;
  suggestions: SalavatAddressSuggestion[];
};

function OrderInput({
  active,
  field,
  onChangeText,
  onFocus,
  onSelectSuggestion,
  suggestions,
  value,
}: OrderInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{field.label}</Text>
      <TextInput
        autoCorrect={false}
        keyboardType={field.keyboardType ?? 'default'}
        onChangeText={onChangeText}
        onFocus={onFocus}
        placeholder={field.placeholder}
        placeholderTextColor="#8A8F98"
        style={styles.input}
        value={value}
      />
      {field.helper ? <Text style={styles.helper}>{field.helper}</Text> : null}
      {active && suggestions.length > 0 ? (
        <View style={styles.addressSuggestions}>
          {suggestions.map((suggestion) => (
            <Pressable
              accessibilityRole="button"
              key={suggestion.id}
              onPress={() => onSelectSuggestion(suggestion)}
              style={({ pressed }) => [styles.addressSuggestion, pressed && styles.pressed]}
            >
              <View style={styles.addressSuggestionDot} />
              <View style={styles.addressSuggestionCopy}>
                <Text style={styles.addressSuggestionTitle}>{suggestion.title}</Text>
                <Text style={styles.addressSuggestionSubtitle}>{suggestion.subtitle}</Text>
              </View>
              <Text style={styles.addressSuggestionSettlement}>{suggestion.settlement}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

type RoutePresetCardProps = {
  route: SalavatRoutePreset;
  onPress: () => void;
};

function RoutePresetCard({ onPress, route }: RoutePresetCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.routePresetCard, pressed && styles.pressed]}
    >
      <View style={styles.routePresetTop}>
        <Route color="#146C5D" size={18} strokeWidth={2.4} />
        <Text style={styles.routePresetTitle}>{route.title}</Text>
      </View>
      <Text style={styles.routePresetSubtitle}>{route.subtitle}</Text>
      <Text style={styles.routePresetMeta}>{route.estimatedTime}</Text>
    </Pressable>
  );
}

type TariffCardProps = {
  tariff: OrderTariff;
  active: boolean;
  onPress: () => void;
};

function TariffCard({ active, onPress, tariff }: TariffCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tariffCard,
        active && styles.tariffCardActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.tariffTop}>
        <Text style={[styles.tariffTitle, active && styles.tariffTitleActive]}>{tariff.title}</Text>
        {active ? <Check color="#146C5D" size={18} strokeWidth={2.8} /> : null}
      </View>
      <Text style={styles.tariffSubtitle}>{tariff.subtitle}</Text>
      <View style={styles.tariffMeta}>
        <Text style={styles.tariffPrice}>{tariff.price} ₽</Text>
        <Text style={styles.tariffEta}>{tariff.eta}</Text>
      </View>
    </Pressable>
  );
}

type OptionToggleProps = {
  option: OrderOption;
  active: boolean;
  onPress: () => void;
};

function OptionToggle({ active, onPress, option }: OptionToggleProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionButton,
        active && styles.optionButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.optionCheck, active && styles.optionCheckActive]}>
        {active ? <Check color="#FFFFFF" size={14} strokeWidth={3} /> : null}
      </View>
      <View style={styles.optionCopy}>
        <Text style={styles.optionLabel}>{option.label}</Text>
        <Text style={styles.optionPrice}>{option.price > 0 ? `+${option.price} ₽` : 'без доплаты'}</Text>
      </View>
    </Pressable>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  addressSuggestion: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 11,
  },
  addressSuggestionCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  addressSuggestionDot: {
    backgroundColor: '#146C5D',
    borderRadius: 6,
    height: 10,
    width: 10,
  },
  addressSuggestionSettlement: {
    color: '#146C5D',
    fontSize: 11,
    fontWeight: '900',
  },
  addressSuggestions: {
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 8,
  },
  addressSuggestionSubtitle: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  addressSuggestionTitle: {
    color: '#20242A',
    fontSize: 14,
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
  field: {
    gap: 8,
  },
  fields: {
    gap: 14,
  },
  groupLabel: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  helper: {
    color: '#68717D',
    fontSize: 12,
    lineHeight: 17,
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
  homeAddressButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C5DDD7',
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    padding: 10,
  },
  homeAddressText: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  homeAddressTitle: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
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
  layout: {
    gap: 16,
  },
  layoutWide: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  locationButton: {
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
  locationButtonText: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
  mainColumn: {
    flex: 1,
    gap: 16,
    minWidth: 0,
  },
  optionButton: {
    alignItems: 'center',
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    minWidth: 180,
    padding: 12,
  },
  optionButtonActive: {
    backgroundColor: '#E9F4F1',
    borderColor: '#146C5D',
  },
  optionCheck: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#AEB8C4',
    borderRadius: 6,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  optionCheckActive: {
    backgroundColor: '#146C5D',
    borderColor: '#146C5D',
  },
  optionCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionLabel: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  optionPrice: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 16,
  },
  page: {
    backgroundColor: '#F4F7F5',
    gap: 16,
    minHeight: '100%',
    padding: 16,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  paymentButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  paymentButtonActive: {
    backgroundColor: '#146C5D',
    borderColor: '#146C5D',
  },
  paymentGroup: {
    gap: 9,
  },
  paymentText: {
    color: '#20242A',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  paymentTextActive: {
    color: '#FFFFFF',
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
    textAlign: 'center',
  },
  resultBox: {
    backgroundColor: '#FFF3E5',
    borderColor: '#F3C38A',
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  resultBoxSuccess: {
    backgroundColor: '#EAF6EA',
    borderColor: '#B9DDBB',
  },
  resultText: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  resultTitle: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  regionBox: {
    backgroundColor: '#EEF5F3',
    borderColor: '#C5DDD7',
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  regionLine: {
    color: '#0B4C42',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  regionMeta: {
    color: '#146C5D',
    fontSize: 12,
    fontWeight: '900',
  },
  regionText: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 19,
  },
  regionTitle: {
    color: '#0B4C42',
    fontSize: 14,
    fontWeight: '900',
  },
  rolePill: {
    alignItems: 'center',
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  rolePillText: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
  routePresetCard: {
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 7,
    minWidth: 185,
    padding: 12,
  },
  routePresetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  routePresetMeta: {
    color: '#146C5D',
    fontSize: 12,
    fontWeight: '900',
  },
  routePresetSubtitle: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  routePresetTitle: {
    color: '#20242A',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  routePresetTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  safeArea: {
    backgroundColor: '#F4F7F5',
    flex: 1,
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
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    color: '#20242A',
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
  },
  statusBox: {
    alignItems: 'flex-start',
    backgroundColor: '#E9F4F1',
    borderColor: '#C5DDD7',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  statusCopy: {
    flex: 1,
    gap: 4,
  },
  statusText: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  statusTitle: {
    color: '#0B4C42',
    fontSize: 14,
    fontWeight: '900',
  },
  subtitle: {
    color: '#59616C',
    fontSize: 15,
    lineHeight: 22,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  suggestionText: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
  summaryColumn: {
    flexShrink: 0,
    width: '100%',
  },
  summaryColumnWide: {
    width: 350,
  },
  summaryLabel: {
    color: '#59616C',
    fontSize: 13,
    fontWeight: '800',
  },
  summaryPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  summaryRow: {
    alignItems: 'center',
    borderBottomColor: '#E7EBEF',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 10,
  },
  summaryRows: {
    gap: 10,
  },
  summaryValue: {
    color: '#20242A',
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  tariffCard: {
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minWidth: 190,
    padding: 14,
  },
  tariffCardActive: {
    backgroundColor: '#E9F4F1',
    borderColor: '#146C5D',
  },
  tariffEta: {
    color: '#59616C',
    fontSize: 12,
    fontWeight: '800',
  },
  tariffGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tariffMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  tariffPrice: {
    color: '#20242A',
    fontSize: 18,
    fontWeight: '900',
  },
  tariffSubtitle: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  tariffTitle: {
    color: '#20242A',
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  tariffTitleActive: {
    color: '#0B4C42',
  },
  tariffTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  timeline: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 12,
  },
  timelineDot: {
    alignItems: 'center',
    backgroundColor: '#EEF2F1',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  timelineDotActive: {
    backgroundColor: '#146C5D',
  },
  timelineIndex: {
    color: '#59616C',
    fontSize: 12,
    fontWeight: '900',
  },
  timelineIndexActive: {
    color: '#FFFFFF',
  },
  timelineStep: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  timelineText: {
    color: '#20242A',
    fontSize: 13,
    fontWeight: '800',
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
  userLine: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
});
