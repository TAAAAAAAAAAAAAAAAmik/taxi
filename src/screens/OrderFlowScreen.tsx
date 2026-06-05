import { ReactNode, useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Banknote,
  Car,
  Check,
  Clock3,
  LocateFixed,
  MapPinned,
  Navigation,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Wallet,
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
import {
  AccountRole,
  isDriverLikeRole,
  isSelfEmployedDriverRole,
  roleCopy,
} from '../data/registration';
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
import {
  ApiAddressSuggestion,
  estimateRoutePrice,
  searchAddressSuggestions,
} from '../services/apiClient';
import { requestUserLocation, reverseGeocodePoint } from '../services/locationService';
import { useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderFlow'>;

type RouteEstimate = {
  confidence: 'draft' | 'estimated' | 'preset';
  distanceKm: number;
  distancePrice: number;
  durationMin: number;
  note: string;
  surgeCoefficient?: number;
  total: number;
};

const selectedTariffBenefits = ['Фиксированная цена', 'Быстрая подача', '4 места'];

export function OrderFlowScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const { width } = useWindowDimensions();
  const config = orderFlowConfig[role];
  const isWide = width >= 840;
  const {
    addOrder,
    assignOrderToDriver,
    currentUser,
    driverSubscription,
    drivers,
    notifications,
    orders,
    refreshServerData,
    realtimeMessage,
    realtimeStatus,
    realtimeUpdatedAt,
    savedHomeAddress,
    serverMessage,
    serverStatus,
    setSimpleMode,
    simpleMode,
  } = useAppState();

  const [values, setValues] = useState<Record<string, string>>(() =>
    createInitialOrderValues(role),
  );
  const [selectedTariffId, setSelectedTariffId] = useState(config.tariffs[0].id);
  const [paymentMethod, setPaymentMethod] = useState(config.paymentMethods[0]);
  const [safetyPinRequired, setSafetyPinRequired] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [activeAddressFieldId, setActiveAddressFieldId] = useState<string | null>(null);
  const [locationPoint, setLocationPoint] = useState<GeoPoint | undefined>();
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFeedOrderId, setSelectedFeedOrderId] = useState<string | null>(null);
  const [serverAddressSuggestions, setServerAddressSuggestions] = useState<SalavatAddressSuggestion[]>([]);
  const [serverRouteEstimate, setServerRouteEstimate] = useState<RouteEstimate | null>(null);
  const [routeEstimateStatus, setRouteEstimateStatus] = useState<'local' | 'loading' | 'server'>('local');
  const isDriverRole = isDriverLikeRole(role);
  const isSelfEmployedDriver = isSelfEmployedDriverRole(role);

  const selectedTariff = useMemo(
    () => config.tariffs.find((tariff) => tariff.id === selectedTariffId) ?? config.tariffs[0],
    [config.tariffs, selectedTariffId],
  );
  const selectedOptionItems = useMemo(
    () => config.options.filter((option) => selectedOptions.includes(option.id)),
    [config.options, selectedOptions],
  );
  const selectedOptionLabels = useMemo(
    () => selectedOptionItems.map((option) => option.label),
    [selectedOptionItems],
  );
  const optionsTotal = selectedOptionItems.reduce((sum, option) => sum + option.price, 0);
  const canConfirm = Boolean(values.pickup?.trim()) && Boolean(values.destination?.trim());
  const usesRegionalAddressBook = !isDriverRole;
  const availableCarsCount = drivers.filter(
    (driver) =>
      driver.status === 'approved' &&
      driver.isOnline &&
      driver.subscriptionStatus === 'active' &&
      driver.canReceiveOrders,
  ).length;
  const availableCarsState =
    availableCarsCount === 0 ? 'none' : availableCarsCount <= 2 ? 'low' : 'ready';
  const currentDriver = useMemo(
    () =>
      isDriverRole && currentUser
        ? drivers.find((driver) => driver.userId === currentUser.id)
        : undefined,
    [currentUser, drivers, isDriverRole],
  );
  const driverNeedsApproval =
    isDriverRole && currentUser && currentDriver?.status !== 'approved';
  const driverCannotReceiveOrders =
    isDriverRole && currentUser && !currentDriver?.canReceiveOrders;
  const availableDriverOrders = useMemo(
    () =>
      isDriverRole && !driverCannotReceiveOrders
        ? orders.filter(
            (order) =>
              order.role === 'client' &&
              !order.driver &&
              ['created', 'searching'].includes(order.status),
          )
        : [],
    [driverCannotReceiveOrders, isDriverRole, orders],
  );
  const selectedFeedOrder =
    availableDriverOrders.find((order) => order.id === selectedFeedOrderId) ?? availableDriverOrders[0];
  const localRouteEstimate = useMemo(
    () =>
      buildRouteEstimate({
        destination: values.destination ?? '',
        optionsTotal,
        pickup: values.pickup ?? '',
        role,
        tariff: selectedTariff,
      }),
    [optionsTotal, role, selectedTariff, values.destination, values.pickup],
  );
  const routeEstimate = serverRouteEstimate ?? localRouteEstimate;
  const total = isDriverRole && selectedFeedOrder ? selectedFeedOrder.total : routeEstimate.total;

  useEffect(() => {
    if (
      !usesRegionalAddressBook ||
      !activeAddressFieldId ||
      !['pickup', 'destination'].includes(activeAddressFieldId)
    ) {
      setServerAddressSuggestions([]);
      return;
    }

    const query = values[activeAddressFieldId]?.trim() ?? '';

    if (query.length < 2) {
      setServerAddressSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      searchAddressSuggestions(query, locationPoint)
        .then((suggestions) => {
          if (!cancelled) {
            setServerAddressSuggestions(suggestions.map(mapApiAddressSuggestion));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setServerAddressSuggestions([]);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeAddressFieldId, locationPoint, usesRegionalAddressBook, values]);

  useEffect(() => {
    const pickup = values.pickup?.trim() ?? '';
    const destination = values.destination?.trim() ?? '';

    if (!usesRegionalAddressBook || !pickup || !destination) {
      setServerRouteEstimate(null);
      setRouteEstimateStatus('local');
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setRouteEstimateStatus('loading');
      estimateRoutePrice({
        destination,
        minimumPrice: selectedTariff.price + optionsTotal,
        options: selectedOptionLabels,
        optionsTotal,
        pickup,
        role,
        tariff: selectedTariff.title,
        tariffId: selectedTariff.id,
      })
        .then((estimate) => {
          if (!cancelled) {
            setServerRouteEstimate(estimate);
            setRouteEstimateStatus('server');
          }
        })
        .catch(() => {
          if (!cancelled) {
            setServerRouteEstimate(null);
            setRouteEstimateStatus('local');
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    optionsTotal,
    role,
    selectedOptionLabels,
    selectedTariff.id,
    selectedTariff.price,
    selectedTariff.title,
    usesRegionalAddressBook,
    values.destination,
    values.pickup,
  ]);

  useEffect(() => {
    if (!isDriverRole || !selectedFeedOrder) {
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
  }, [config.tariffs, isDriverRole, selectedFeedOrder, selectedFeedOrderId]);

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

    if (
      isSelfEmployedDriver &&
      driverSubscription.status !== 'active' &&
      currentDriver?.subscriptionStatus !== 'active'
    ) {
      navigation.navigate('Subscription', { firstName, role });
      return;
    }

    if (!canConfirm) {
      setConfirmed(true);
      return;
    }

    if (driverCannotReceiveOrders) {
      setConfirmed(true);
      return;
    }

    if (isDriverRole && selectedFeedOrder) {
      setIsSubmitting(true);

      try {
        const assignedOrder = currentDriver
          ? await assignOrderToDriver(selectedFeedOrder.id, currentDriver.id, 'accepted')
          : null;
        if (!assignedOrder) {
          setConfirmed(true);
          return;
        }
        setConfirmed(true);
        navigation.navigate('OrderStatus', {
          firstName,
          order: assignedOrder,
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
      options: selectedOptionLabels,
      optionsTotal,
      paymentMethod,
      pickup: values.pickup.trim(),
      routeEstimate,
      safetyPinRequired,
      tariff: selectedTariff.title,
      tariffId: selectedTariff.id,
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

  if (!isDriverRole) {
    const favoriteRoutes = [
      {
        id: 'home',
        title: 'Домой',
        address: savedHomeAddress?.address || 'Малояз, центр',
      },
      {
        id: 'work',
        title: 'На работу',
        address: 'Малояз, администрация',
      },
    ];
    const clientAddressSuggestions =
      activeAddressFieldId === 'destination'
        ? mergeAddressSuggestions([
            ...findSalavatAddressSuggestions(values.destination ?? '', 6),
            ...serverAddressSuggestions,
          ]).slice(0, 4)
        : [];
    const clientRealtimeLabel = formatClientRealtimeLabel(realtimeMessage, realtimeStatus);

    return (
      <SafeAreaView style={styles.clientSafeArea}>
        <View style={[styles.clientPage, simpleMode && styles.clientPageSimple]}>
          <View style={styles.clientTopRow}>
            <View style={styles.clientBrandRow}>
              <View style={styles.clientBrandMark}>
                <Car color="#F4FAF6" size={22} strokeWidth={2.5} />
              </View>
              <View style={styles.clientBrandCopy}>
                <Text style={styles.clientBrand}>Такси Салават</Text>
                <Text numberOfLines={1} style={styles.clientMeta}>Малояз · быстрые поездки по району</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: simpleMode }}
              onPress={() => setSimpleMode(!simpleMode)}
              style={({ pressed }) => [styles.clientModeButton, pressed && styles.pressed]}
            >
              <SlidersHorizontal color="#008D49" size={18} strokeWidth={2.4} />
              <Text style={styles.clientModeText}>Простой</Text>
            </Pressable>
          </View>

          <View style={styles.clientDestinationBlock}>
            <TextInput
              autoCorrect={false}
              autoFocus
              onChangeText={(value) => updateValue('destination', value)}
              onFocus={() => setActiveAddressFieldId('destination')}
              placeholder="Куда едем?"
              placeholderTextColor="#557669"
              returnKeyType="done"
              style={[styles.clientDestinationInput, simpleMode && styles.clientDestinationInputSimple]}
              value={values.destination ?? ''}
            />
            {clientAddressSuggestions.length > 0 ? (
              <View style={styles.clientSuggestions}>
                {clientAddressSuggestions.map((suggestion) => (
                  <Pressable
                    accessibilityRole="button"
                    key={suggestion.id}
                    onPress={() => selectAddressSuggestion('destination', suggestion)}
                    style={({ pressed }) => [styles.clientSuggestion, pressed && styles.pressed]}
                  >
                    <Text numberOfLines={1} style={styles.clientSuggestionTitle}>
                      {suggestion.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.clientSuggestionText}>
                      {suggestion.subtitle}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.clientShortcutRow}>
            {favoriteRoutes.map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.id}
                onPress={() => updateValue('destination', item.address)}
                style={({ pressed }) => [
                  styles.clientShortcutButton,
                  simpleMode && styles.clientShortcutButtonSimple,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.clientShortcutText, simpleMode && styles.clientShortcutTextSimple]}>
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={styles.clientShortcutHint}>{item.address}</Text>
              </Pressable>
            ))}
          </View>

          {!simpleMode ? (
            <>
              <View style={styles.clientTariffList}>
                {config.tariffs.map((tariff) => {
                  const active = tariff.id === selectedTariffId;
                  const tariffPrice = active ? routeEstimate.total : tariff.price;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      key={tariff.id}
                      onPress={() => {
                        setConfirmed(false);
                        setSelectedTariffId(tariff.id);
                      }}
                      style={({ pressed }) => [
                        styles.clientTariffCard,
                        active && styles.clientTariffCardActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      {active ? (
                        <>
                          <View style={styles.clientTariffHeader}>
                            <View style={styles.clientTariffBadge}>
                              <Text style={styles.clientTariffBadgeText}>✓ Выбрано</Text>
                            </View>
                            <View style={styles.clientTariffVisual}>
                              <View style={styles.clientTariffRouteDot} />
                              <View style={styles.clientTariffRouteLine} />
                              <Car color="#12382C" size={18} strokeWidth={2.1} />
                            </View>
                          </View>
                          <View style={styles.clientTariffMainRow}>
                            <View style={styles.clientTariffCopy}>
                              <Text style={styles.clientTariffTitle}>{tariff.title}</Text>
                              <View style={styles.clientTariffBenefits}>
                                {selectedTariffBenefits.map((benefit) => (
                                  <View key={benefit} style={styles.clientTariffBenefit}>
                                    <View style={styles.clientTariffBenefitDot} />
                                    <Text numberOfLines={1} style={styles.clientTariffBenefitText}>
                                      {benefit}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                            <Text style={styles.clientTariffPrice}>{tariffPrice} ₽</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <Text style={styles.clientTariffTitle}>{tariff.title}</Text>
                          <Text style={styles.clientTariffSubtitle}>{tariff.subtitle}</Text>
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.clientCompactDetails}>
                <View style={styles.clientDetailItem}>
                  <Text style={styles.clientDetailLabel}>Маршрут</Text>
                  <Text numberOfLines={1} style={styles.clientDetailValue}>
                    {formatDistance(routeEstimate.distanceKm)} · {routeEstimate.durationMin} мин
                  </Text>
                </View>
                <View style={styles.clientDetailItem}>
                  <Text style={styles.clientDetailLabel}>Подача</Text>
                  <Text numberOfLines={1} style={styles.clientDetailValue}>{selectedTariff.eta}</Text>
                </View>
                <View style={[styles.clientDetailItem, styles.clientDetailStatus]}>
                  <View style={[styles.clientRealtimeDot, realtimeStatus === 'live' && styles.clientRealtimeDotLive]} />
                  <Text numberOfLines={1} style={styles.clientDetailStatusText}>
                    {clientRealtimeLabel}
                  </Text>
                </View>
              </View>
            </>
          ) : null}

          {confirmed && !canConfirm ? (
            <Text style={styles.clientError}>Укажите, куда едем.</Text>
          ) : null}

          <View style={styles.clientBottom}>
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={handlePrimaryAction}
              style={({ pressed }) => [
                styles.clientCallButton,
                simpleMode && styles.clientCallButtonSimple,
                isSubmitting && styles.clientCallButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Navigation color="#F4FAF6" size={21} strokeWidth={2.6} />
              <Text style={[styles.clientCallButtonText, simpleMode && styles.clientCallButtonTextSimple]}>
                {isSubmitting ? 'Ищем машину' : 'Вызвать'}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color="#008D49" size={20} strokeWidth={2.4} />
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>

          <View style={styles.rolePill}>
            <UserRound color="#008D49" size={17} strokeWidth={2.4} />
            <Text style={styles.rolePillText}>{roleCopy[role].title}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Route color="#008D49" size={30} strokeWidth={2.4} />
          </View>
          <View style={styles.heroCopy}>
            <Text numberOfLines={2} style={styles.title}>{config.title}</Text>
            <Text numberOfLines={3} style={styles.subtitle}>{config.subtitle}</Text>
            <Text style={styles.userLine}>Профиль: {firstName?.trim() || 'пользователь'}</Text>
            {usesRegionalAddressBook ? (
              <Text style={styles.regionLine}>
                Зона MVP: {salavatDistrictInfo.region}. Центр - {salavatDistrictInfo.center}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.statusBox}>
          <ShieldCheck
            color={realtimeStatus === 'live' ? '#008D49' : '#5C8D89'}
            size={20}
            strokeWidth={2.4}
          />
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>
              {realtimeStatus === 'live'
                ? 'Лента заказов online'
                : realtimeStatus === 'polling'
                  ? 'Лента обновляется по таймеру'
                  : 'Подключаем ленту заказов'}
            </Text>
            <Text numberOfLines={2} style={styles.statusText}>
              {realtimeMessage}
              {realtimeUpdatedAt ? ` · ${new Date(realtimeUpdatedAt).toLocaleTimeString('ru-RU')}` : ''}
              {notifications[0] ? ` · последнее: ${notifications[0].title}` : ''}
            </Text>
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
                icon={<MapPinned color="#008D49" size={20} strokeWidth={2.4} />}
                title={config.routeTitle}
              />
              {usesRegionalAddressBook ? (
                <View style={styles.regionBox}>
                  <Text style={styles.regionTitle}>{getCoverageTitle(locationPoint)}</Text>
                  <Text numberOfLines={2} style={styles.regionText}>{getCoverageText(locationPoint)}</Text>
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
                    <LocateFixed color="#008D49" size={17} strokeWidth={2.4} />
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
                <View
                  style={[
                    styles.searchCarsBox,
                    availableCarsState === 'none' && styles.searchCarsBoxEmpty,
                    availableCarsState === 'ready' && styles.searchCarsBoxReady,
                  ]}
                >
                  <View style={styles.searchCarsTop}>
                    <Car color="#008D49" size={20} strokeWidth={2.4} />
                    <Text style={styles.searchCarsTitle}>Поиск машины</Text>
                  </View>
                  <Text style={styles.searchCarsValue}>
                    {availableCarsCount} {formatCarsWord(availableCarsCount)} доступно
                  </Text>
                  <Text numberOfLines={3} style={styles.searchCarsText}>
                    {availableCarsState === 'none'
                      ? 'Сейчас в зоне нет активных водителей. Заказ можно создать, админ и водители увидят его после выхода на смену.'
                      : availableCarsState === 'low'
                      ? 'Машин мало, поэтому время принятия может быть выше. Показываем доступных водителей в зоне Салаватского района.'
                      : 'Есть активные водители в зоне Салаватского района. Точное “рядом” включим после координат водителей.'}
                  </Text>
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
                    <Text numberOfLines={3} style={styles.regionText}>
                      {driverNeedsApproval
                        ? 'Заявка водителя создана. Администратор должен проверить автомобиль и открыть доступ.'
                        : driverCannotReceiveOrders
                        ? 'Доступ к заказам закрыт. Нужны документы, договор, разрешение авто, реестр и налоговый профиль.'
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
                      <Route color="#008D49" size={17} strokeWidth={2.4} />
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
                        ? mergeAddressSuggestions([
                            ...findSalavatAddressSuggestions(values[field.id] ?? ''),
                            ...serverAddressSuggestions,
                          ])
                        : []
                    }
                    value={values[field.id] ?? ''}
                  />
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              <SectionHeader
                icon={<Car color="#008D49" size={20} strokeWidth={2.4} />}
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
                icon={<SlidersHorizontal color="#008D49" size={20} strokeWidth={2.4} />}
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
                icon={<ShieldCheck color="#008D49" size={20} strokeWidth={2.4} />}
                title={config.summaryTitle}
              />
              <RouteEstimatePreview
                destination={values.destination}
                estimate={routeEstimate}
                pickup={values.pickup}
                status={routeEstimateStatus}
              />
              <View style={styles.summaryRows}>
                <SummaryRow
                  label="Маршрут"
                  value={`${formatDistance(routeEstimate.distanceKm)} · ${routeEstimate.durationMin} мин`}
                />
                <SummaryRow label="Тариф" value={selectedTariff.title} />
                <SummaryRow label="Подача" value={selectedTariff.eta} />
                <SummaryRow label="Опции" value={`${optionsTotal} ₽`} />
                <SummaryRow label={isDriverRole ? 'Доход' : 'Итого'} value={`${total} ₽`} />
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
                        color={method === paymentMethod ? '#F4FAF6' : '#008D49'}
                        size={18}
                        strokeWidth={2.4}
                      />
                    ) : (
                        <Wallet
                        color={method === paymentMethod ? '#F4FAF6' : '#008D49'}
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

              {!isDriverRole ? (
                <View style={styles.paymentGroup}>
                  <Text style={styles.groupLabel}>Безопасность</Text>
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityState={{ checked: safetyPinRequired }}
                    onPress={() => setSafetyPinRequired((current) => !current)}
                    style={({ pressed }) => [
                      styles.paymentButton,
                      safetyPinRequired && styles.paymentButtonActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ShieldCheck
                      color={safetyPinRequired ? '#F4FAF6' : '#008D49'}
                      size={18}
                      strokeWidth={2.4}
                    />
                    <Text
                      style={[
                        styles.paymentText,
                        safetyPinRequired && styles.paymentTextActive,
                      ]}
                    >
                      PIN начала поездки
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.statusBox}>
                <Clock3 color="#008D49" size={18} strokeWidth={2.4} />
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
                      : 'Заполните точку подачи и назначение, чтобы вызвать автомобиль.'}
                  </Text>
                </View>
              ) : null}

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={handlePrimaryAction}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                  <Navigation color="#12382C" size={18} strokeWidth={2.4} />
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
  if (isDriverLikeRole(role)) {
    return {
      clientComment: 'Ждать у центрального входа, нужна связь перед подачей',
      destination: 'Санаторий Янгантау, с. Янгантау',
      pickup: 'Центр Малояза, с. Малояз',
      pickupDistance: '8.2 км, 12 минут',
    };
  }

  return {
    pickup: 'Малояз, центр',
  };
}

function formatCarsWord(count: number) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return 'машина';
  }

  if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwoDigits)) {
    return 'машины';
  }

  return 'машин';
}

function formatClientRealtimeLabel(message: string, status: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network request failed') ||
    normalized.includes('load failed')
  ) {
    return 'Связь восстановится автоматически';
  }

  if (status === 'live') {
    return 'Сервис на связи';
  }

  if (status === 'polling') {
    return 'Обновляем доступность';
  }

  return message || 'Готово к заказу';
}

function mapApiAddressSuggestion(suggestion: ApiAddressSuggestion): SalavatAddressSuggestion {
  return {
    aliases: suggestion.aliases ?? [],
    category: mapApiAddressCategory(suggestion.category),
    coordinates: suggestion.coordinates,
    id: `server-${suggestion.id}`,
    settlement: suggestion.settlement || 'РФ',
    source: 'manual',
    subtitle: suggestion.subtitle || suggestion.displayAddress || 'Серверный адрес',
    title: suggestion.title || suggestion.displayAddress,
  };
}

function mapApiAddressCategory(category: string): SalavatAddressSuggestion['category'] {
  if (
    ['address', 'admin', 'education', 'health', 'landmark', 'market', 'settlement', 'street', 'transport'].includes(
      category,
    )
  ) {
    return category as SalavatAddressSuggestion['category'];
  }

  return 'address';
}

function mergeAddressSuggestions(suggestions: SalavatAddressSuggestion[]) {
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    const key = `${suggestion.title}|${suggestion.subtitle}|${suggestion.settlement}`.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildRouteEstimate({
  destination,
  optionsTotal,
  pickup,
  role,
  tariff,
}: {
  destination: string;
  optionsTotal: number;
  pickup: string;
  role: AccountRole;
  tariff: OrderTariff;
}): RouteEstimate {
  const hasRoute = Boolean(pickup.trim()) && Boolean(destination.trim());

  if (!hasRoute) {
    return {
      confidence: 'draft',
      distanceKm: 0,
      distancePrice: 0,
      durationMin: 0,
      note: 'укажите маршрут',
      total: tariff.price + optionsTotal,
    };
  }

  const preset = findMatchingRoutePreset(pickup, destination);
  const distanceKm = preset?.estimatedDistanceKm ?? estimateDistanceKm(pickup, destination);
  const durationMin =
    preset?.estimatedTime ? parseRouteTime(preset.estimatedTime) : estimateDurationMin(distanceKm);

  if (!isDriverLikeRole(role) && tariff.id === 'economy') {
    return {
      confidence: preset ? 'preset' : 'estimated',
      distanceKm,
      distancePrice: 120,
      durationMin,
      note: 'Фиксированная цена',
      total: 120 + optionsTotal,
    };
  }

  const rate = getFareRate(tariff.id, role);
  const distancePrice = roundToTen(distanceKm * rate.perKm + durationMin * rate.perMin);
  const calculatedTotal = rate.base + distancePrice + optionsTotal;
  const total = roundToTen(Math.max(tariff.price + optionsTotal, calculatedTotal));

  return {
    confidence: preset ? 'preset' : 'estimated',
    distanceKm,
    distancePrice,
    durationMin,
    note: preset ? 'популярный маршрут' : 'предварительная оценка',
    total,
  };
}

function findMatchingRoutePreset(pickup: string, destination: string) {
  const normalizedPickup = normalizeRouteText(pickup);
  const normalizedDestination = normalizeRouteText(destination);

  return salavatPopularRoutes.find(
    (route) =>
      addressLooksSame(normalizedPickup, normalizeRouteText(route.pickup)) &&
      addressLooksSame(normalizedDestination, normalizeRouteText(route.destination)),
  );
}

function normalizeRouteText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addressLooksSame(left: string, right: string) {
  return left === right || left.includes(right) || right.includes(left);
}

function estimateDistanceKm(pickup: string, destination: string) {
  const pickupPoint = getRouteAnchor(pickup);
  const destinationPoint = getRouteAnchor(destination);

  if (!pickupPoint || !destinationPoint) {
    return pickupPoint || destinationPoint ? 14 : 9;
  }

  const distance = Math.abs(pickupPoint.kmFromMaloyaz - destinationPoint.kmFromMaloyaz);
  return Math.max(distance, 3.2);
}

function getRouteAnchor(address: string) {
  const normalizedAddress = normalizeRouteText(address);
  const anchors = [
    { keys: ['малояз', 'црб', 'центральная районная больница'], kmFromMaloyaz: 0 },
    { keys: ['янгантау', 'санаторий'], kmFromMaloyaz: 17.5 },
    { keys: ['кургазак', 'комсомол'], kmFromMaloyaz: 19.5 },
    { keys: ['мурсалимкино'], kmFromMaloyaz: 31 },
    { keys: ['аркаулово'], kmFromMaloyaz: 22 },
    { keys: ['лаклы'], kmFromMaloyaz: 34 },
    { keys: ['идрисово'], kmFromMaloyaz: 24 },
  ];

  return anchors.find((anchor) => anchor.keys.some((key) => normalizedAddress.includes(key)));
}

function parseRouteTime(value: string) {
  const numbers = value.match(/\d+/g)?.map(Number) ?? [];

  if (numbers.length >= 2) {
    return Math.round((numbers[0] + numbers[1]) / 2);
  }

  return numbers[0] ?? 12;
}

function estimateDurationMin(distanceKm: number) {
  return Math.max(8, Math.round(distanceKm * 1.35 + 6));
}

function getFareRate(tariffId: string, role: AccountRole) {
  if (isDriverLikeRole(role)) {
    return { base: 0, perKm: 22, perMin: 4 };
  }

  if (['business', 'airport'].includes(tariffId)) {
    return { base: 260, perKm: 42, perMin: 8 };
  }

  if (['comfort', 'current'].includes(tariffId)) {
    return { base: 160, perKm: 30, perMin: 5 };
  }

  return { base: 120, perKm: 24, perMin: 4 };
}

function roundToTen(value: number) {
  return Math.round(value / 10) * 10;
}

function formatDistance(distanceKm: number) {
  if (!distanceKm) {
    return '0 км';
  }

  return `${distanceKm.toLocaleString('ru-RU', {
    maximumFractionDigits: 1,
    minimumFractionDigits: distanceKm % 1 === 0 ? 0 : 1,
  })} км`;
}

function formatSurge(estimate: RouteEstimate) {
  const maybeEstimate = estimate as RouteEstimate & { surgeCoefficient?: number };
  return `${(maybeEstimate.surgeCoefficient ?? 1).toLocaleString('ru-RU', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })}x`;
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

type RouteEstimatePreviewProps = {
  destination?: string;
  estimate: RouteEstimate;
  pickup?: string;
  status: 'local' | 'loading' | 'server';
};

function RouteEstimatePreview({ destination, estimate, pickup, status }: RouteEstimatePreviewProps) {
  const confidenceText =
    status === 'loading'
      ? 'Считаем на сервере'
      : status === 'server'
      ? 'Серверный расчет'
      : estimate.confidence === 'preset'
      ? 'Популярный маршрут'
      : estimate.confidence === 'estimated'
      ? 'MVP-оценка'
      : 'Черновик';

  return (
    <View style={styles.routeEstimateBox}>
      <View style={styles.routeEstimateHeader}>
        <Route color="#008D49" size={18} strokeWidth={2.4} />
        <Text style={styles.routeEstimateTitle}>{confidenceText}</Text>
      </View>
      <View style={styles.routeEstimateBody}>
        <View style={styles.routeTrack}>
          <View style={styles.routeTrackDot} />
          <View style={styles.routeTrackLine} />
          <View style={[styles.routeTrackDot, styles.routeTrackDotFinish]} />
        </View>
        <View style={styles.routePoints}>
          <Text numberOfLines={1} style={styles.routePointTitle}>
            {pickup?.trim() || 'Точка подачи'}
          </Text>
          <Text numberOfLines={1} style={styles.routePointText}>
            {destination?.trim() || 'Куда едем?'}
          </Text>
        </View>
      </View>
      <View style={styles.routeMetrics}>
        <View style={styles.routeMetric}>
          <Text style={styles.routeMetricValue}>{formatDistance(estimate.distanceKm)}</Text>
          <Text style={styles.routeMetricLabel}>Расстояние</Text>
        </View>
        <View style={styles.routeMetric}>
          <Text style={styles.routeMetricValue}>{estimate.durationMin} мин</Text>
          <Text style={styles.routeMetricLabel}>В пути</Text>
        </View>
        <View style={styles.routeMetric}>
          <Text style={styles.routeMetricValue}>{estimate.distancePrice} ₽</Text>
          <Text style={styles.routeMetricLabel}>{estimate.note}</Text>
        </View>
      </View>
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
        placeholderTextColor="#557669"
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
        <Route color="#008D49" size={18} strokeWidth={2.4} />
      <Text style={styles.routePresetTitle}>{route.title}</Text>
    </View>
    <Text style={styles.routePresetSubtitle}>{route.subtitle}</Text>
    <Text style={styles.routePresetMeta}>
      {formatDistance(route.estimatedDistanceKm)} · {route.estimatedTime}
    </Text>
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
        {active ? <Check color="#12382C" size={18} strokeWidth={2.8} /> : null}
      </View>
      <Text style={[styles.tariffSubtitle, active && styles.tariffSubtitleActive]}>
        {tariff.subtitle}
      </Text>
      <View style={styles.tariffMeta}>
        <Text style={[styles.tariffPrice, active && styles.tariffPriceActive]}>
          {tariff.price} ₽
        </Text>
        <Text style={[styles.tariffEta, active && styles.tariffEtaActive]}>{tariff.eta}</Text>
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
        {active ? <Check color="#12382C" size={14} strokeWidth={3} /> : null}
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
  clientBottom: {
    marginTop: 'auto',
    paddingTop: 18,
  },
  clientBrand: {
    color: '#12382C',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
  },
  clientBrandCopy: {
    flex: 1,
    minWidth: 0,
  },
  clientBrandMark: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  clientBrandRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  clientCallButton: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    elevation: 3,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 18,
    shadowColor: '#006F3A',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  clientCallButtonDisabled: {
    opacity: 0.58,
  },
  clientCallButtonSimple: {
    minHeight: 82,
  },
  clientCallButtonText: {
    color: '#F4FAF6',
    fontSize: 19,
    fontWeight: '900',
  },
  clientCallButtonTextSimple: {
    fontSize: 25,
  },
  clientDestinationBlock: {
    gap: 8,
    marginTop: 16,
  },
  clientDestinationInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    color: '#12382C',
    fontSize: 22,
    fontWeight: '800',
    minHeight: 62,
    paddingHorizontal: 16,
  },
  clientDestinationInputSimple: {
    fontSize: 32,
    minHeight: 92,
  },
  clientError: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '800',
  },
  clientCompactDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  clientDetailItem: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E8DF',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 112,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  clientDetailLabel: {
    color: '#557669',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  clientDetailStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    minWidth: 156,
  },
  clientDetailStatusText: {
    color: '#557669',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  clientDetailValue: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '800',
  },
  clientMeta: {
    color: '#557669',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  clientModeButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  clientModeText: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  clientPage: {
    backgroundColor: '#F4FAF6',
    flex: 1,
    gap: 12,
    padding: 14,
  },
  clientPageSimple: {
    gap: 16,
    padding: 16,
  },
  clientRealtime: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E8DF',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 38,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  clientRealtimeDot: {
    backgroundColor: '#557669',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  clientRealtimeDotLive: {
    backgroundColor: '#008D49',
  },
  clientRealtimeText: {
    color: '#557669',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  clientSafeArea: {
    backgroundColor: '#F4FAF6',
    flex: 1,
  },
  clientShortcutButton: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E8DF',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  clientShortcutButtonSimple: {
    minHeight: 70,
  },
  clientShortcutRow: {
    flexDirection: 'row',
    gap: 10,
  },
  clientShortcutHint: {
    color: '#557669',
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  clientShortcutText: {
    color: '#12382C',
    fontSize: 16,
    fontWeight: '900',
  },
  clientShortcutTextSimple: {
    fontSize: 21,
  },
  clientSuggestion: {
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    gap: 3,
    padding: 10,
  },
  clientSuggestionText: {
    color: '#557669',
    fontSize: 12,
  },
  clientSuggestionTitle: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  clientSuggestions: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E8DF',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 8,
  },
  clientTariffCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C7DED3',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    minHeight: 154,
    padding: 15,
    shadowColor: '#12382C',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  clientTariffCardActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderWidth: 1.5,
    elevation: 3,
  },
  clientTariffList: {
    gap: 8,
    paddingVertical: 2,
  },
  clientTariffBadge: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderColor: '#BFDACE',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 28,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  clientTariffBadgeText: {
    color: '#008D49',
    fontSize: 12,
    fontWeight: '900',
  },
  clientTariffBenefit: {
    alignItems: 'center',
    backgroundColor: '#F4FAF6',
    borderColor: '#D6E8DF',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 28,
    paddingHorizontal: 9,
  },
  clientTariffBenefitDot: {
    backgroundColor: '#008D49',
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  clientTariffBenefitText: {
    color: '#31584A',
    fontSize: 12,
    fontWeight: '800',
  },
  clientTariffBenefits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  clientTariffCopy: {
    flex: 1,
    minWidth: 0,
  },
  clientTariffHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  clientTariffMainRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  clientTariffPrice: {
    color: '#12382C',
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 31,
    textAlign: 'right',
  },
  clientTariffPriceActive: {
    color: '#12382C',
  },
  clientTariffRouteDot: {
    backgroundColor: '#008D49',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  clientTariffRouteLine: {
    backgroundColor: '#BFDACE',
    height: 2,
    width: 34,
  },
  clientTariffSubtitle: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  clientTariffSubtitleActive: {
    color: '#557669',
  },
  clientTariffTitle: {
    color: '#12382C',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 27,
  },
  clientTariffTitleActive: {
    color: '#12382C',
  },
  clientTariffVisual: {
    alignItems: 'center',
    backgroundColor: '#F4FAF6',
    borderColor: '#D6E8DF',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 30,
    paddingHorizontal: 10,
  },
  clientTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  addressSuggestion: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
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
    backgroundColor: '#008D49',
    borderRadius: 6,
    height: 10,
    width: 10,
  },
  addressSuggestionSettlement: {
    color: '#008D49',
    fontSize: 11,
    fontWeight: '900',
  },
  addressSuggestions: {
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 8,
  },
  addressSuggestionSubtitle: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  addressSuggestionTitle: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#008D49',
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
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  helper: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  hero: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  homeAddressButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    padding: 10,
  },
  homeAddressText: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  homeAddressTitle: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#557669',
    borderRadius: 8,
    borderWidth: 1,
    color: '#12382C',
    fontSize: 16,
    minHeight: 56,
    paddingHorizontal: 14,
  },
  label: {
    color: '#12382C',
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
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  locationButtonText: {
    color: '#008D49',
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
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
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
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
  },
  optionCheck: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 6,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  optionCheckActive: {
    backgroundColor: '#008D49',
    borderColor: '#008D49',
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
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  optionPrice: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 16,
  },
  page: {
    backgroundColor: '#F4FAF6',
    gap: 12,
    minHeight: '100%',
    padding: 14,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  paymentButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  paymentButtonActive: {
    backgroundColor: '#008D49',
    borderColor: '#008D49',
  },
  paymentGroup: {
    gap: 9,
  },
  paymentText: {
    color: '#12382C',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  paymentTextActive: {
    color: '#F4FAF6',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.95 }],
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#F4FAF6',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  resultBox: {
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  resultBoxSuccess: {
    backgroundColor: '#E8F3EF',
    borderColor: '#7A9A7E',
  },
  resultText: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  resultTitle: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  searchCarsBox: {
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  searchCarsBoxEmpty: {
    backgroundColor: '#E8F3EF',
    borderColor: '#C17A70',
  },
  searchCarsBoxReady: {
    backgroundColor: '#E8F3EF',
    borderColor: '#7A9A7E',
  },
  searchCarsText: {
    color: '#557669',
    fontSize: 13,
    lineHeight: 19,
  },
  searchCarsTitle: {
    color: '#12382C',
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  searchCarsTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  searchCarsValue: {
    color: '#008D49',
    fontSize: 22,
    fontWeight: '900',
  },
  regionBox: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  regionLine: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  regionMeta: {
    color: '#008D49',
    fontSize: 12,
    fontWeight: '900',
  },
  regionText: {
    color: '#557669',
    fontSize: 13,
    lineHeight: 19,
  },
  regionTitle: {
    color: '#008D49',
    fontSize: 14,
    fontWeight: '900',
  },
  rolePill: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  rolePillText: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  routeEstimateBody: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 10,
  },
  routeEstimateBox: {
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    gap: 12,
    padding: 12,
  },
  routeEstimateHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  routeEstimateTitle: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  routeMetric: {
    flex: 1,
    gap: 3,
    minWidth: 80,
  },
  routeMetricLabel: {
    color: '#557669',
    fontSize: 11,
    lineHeight: 15,
  },
  routeMetricValue: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  routeMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  routePointText: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  routePointTitle: {
    color: '#12382C',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  routePoints: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  routePresetCard: {
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
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
    color: '#008D49',
    fontSize: 12,
    fontWeight: '900',
  },
  routePresetSubtitle: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  routePresetTitle: {
    color: '#12382C',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  routePresetTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  routeTrack: {
    alignItems: 'center',
    width: 16,
  },
  routeTrackDot: {
    backgroundColor: '#008D49',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  routeTrackDotFinish: {
    backgroundColor: '#5C8D89',
  },
  routeTrackLine: {
    backgroundColor: '#008D49',
    flex: 1,
    marginVertical: 3,
    width: 2,
  },
  safeArea: {
    backgroundColor: '#F4FAF6',
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    color: '#12382C',
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
  },
  statusBox: {
    alignItems: 'flex-start',
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
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
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  statusTitle: {
    color: '#008D49',
    fontSize: 14,
    fontWeight: '900',
  },
  subtitle: {
    color: '#557669',
    fontSize: 14,
    lineHeight: 20,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  suggestionText: {
    color: '#008D49',
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
    color: '#557669',
    fontSize: 13,
    fontWeight: '800',
  },
  summaryPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  summaryRow: {
    alignItems: 'center',
    borderBottomColor: '#E8F3EF',
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
    color: '#12382C',
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  tariffCard: {
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minWidth: 190,
    padding: 14,
  },
  tariffCardActive: {
    backgroundColor: '#008D49',
    borderColor: '#008D49',
  },
  tariffEta: {
    color: '#557669',
    fontSize: 12,
    fontWeight: '800',
  },
  tariffEtaActive: {
    color: '#F4FAF6',
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
    color: '#12382C',
    fontSize: 18,
    fontWeight: '900',
  },
  tariffPriceActive: {
    color: '#F4FAF6',
  },
  tariffSubtitle: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  tariffSubtitleActive: {
    color: '#F4FAF6',
  },
  tariffTitle: {
    color: '#12382C',
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  tariffTitleActive: {
    color: '#F4FAF6',
  },
  tariffTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  timeline: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 10,
  },
  timelineDot: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  timelineDotActive: {
    backgroundColor: '#008D49',
  },
  timelineIndex: {
    color: '#557669',
    fontSize: 12,
    fontWeight: '900',
  },
  timelineIndexActive: {
    color: '#12382C',
  },
  timelineStep: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  timelineText: {
    color: '#12382C',
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: '#12382C',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  userLine: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
});
