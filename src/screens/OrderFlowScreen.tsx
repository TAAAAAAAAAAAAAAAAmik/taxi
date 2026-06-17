import { ReactNode, useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Banknote,
  Car,
  Check,
  Clock3,
  Info,
  LocateFixed,
  MapPinned,
  Navigation,
  Package,
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

import {
  KinetixBottomSheet,
  KinetixButton,
  KinetixEmptyState,
  KinetixSkeleton,
} from '../components/KinetixUI';
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
  salavatAddressSuggestionCount,
  salavatPopularRoutes,
} from '../data/salavatDistrict';
import { RootStackParamList } from '../navigation/types';
import {
  ApiAddressSuggestion,
  estimateRoutePrice,
  searchAddressSuggestions,
} from '../services/apiClient';
import { requestUserLocation, reverseGeocodePoint } from '../services/locationService';
import { type AppOrder, type DriverProfile, useAppState } from '../state/AppState';
import { styles } from './OrderFlowScreen.styles';
import { buildRouteEstimate, formatDistance, getGeoDistanceKm, type OrderServiceType, type RouteEstimate } from './orderFlow.routeEstimate';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderFlow'>;

type DriverFeedSort = 'near' | 'price' | 'new';
type DeliveryHandoffId = 'door_to_door' | 'leave_at_door' | 'meet_outside';
type DeliveryPackagePresetId = 'documents' | 'food' | 'fragile' | 'other' | 'parcel';

const selectedTariffBenefits = ['Фиксированная цена', 'Быстрая подача', '4 места'];
const deliveryPackagePresets: Array<{
  defaultDescription: string;
  id: DeliveryPackagePresetId;
  text: string;
  title: string;
}> = [
  {
    defaultDescription: 'Документы',
    id: 'documents',
    text: 'Папка, договор, справки',
    title: 'Документы',
  },
  {
    defaultDescription: 'Пакет',
    id: 'parcel',
    text: 'Небольшая посылка',
    title: 'Пакет',
  },
  {
    defaultDescription: 'Еда или цветы',
    id: 'food',
    text: 'Аккуратно, без тряски',
    title: 'Еда / цветы',
  },
  {
    defaultDescription: 'Хрупкая посылка',
    id: 'fragile',
    text: 'Нужно бережно',
    title: 'Хрупкое',
  },
  {
    defaultDescription: '',
    id: 'other',
    text: 'Опишу вручную',
    title: 'Другое',
  },
];
const deliveryHandoffOptions: Array<{
  id: DeliveryHandoffId;
  text: string;
  title: string;
}> = [
  { id: 'door_to_door', text: 'Водитель заберет и передаст лично', title: 'От двери до двери' },
  { id: 'meet_outside', text: 'Получатель выйдет к машине или подъезду', title: 'Встретят у входа' },
  { id: 'leave_at_door', text: 'Оставить у двери после согласования', title: 'Оставить у двери' },
];

export function OrderFlowScreen({ navigation, route }: Props) {
  const { firstName, presetDestination, presetPickup, role, serviceType: initialServiceType } = route.params;
  const { width } = useWindowDimensions();
  const config = orderFlowConfig[role];
  const isWide = width >= 840;
  const {
    addOrder,
    assignOrderToDriver,
    currentUser,
    declineOrderOffer,
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

  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...createInitialOrderValues(role),
    ...(presetPickup ? { pickup: presetPickup } : {}),
    ...(presetDestination ? { destination: presetDestination } : {}),
  }));
  const [selectedTariffId, setSelectedTariffId] = useState(config.tariffs[0].id);
  const [paymentMethod, setPaymentMethod] = useState(config.paymentMethods[0]);
  const [safetyPinRequired, setSafetyPinRequired] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [serviceType, setServiceType] = useState<OrderServiceType>(role === 'client' ? 'taxi' : initialServiceType ?? 'taxi');
  const [deliveryDetailsOpen, setDeliveryDetailsOpen] = useState(false);
  const [extraStops, setExtraStops] = useState<string[]>([]);
  const [routeDetailsOpen, setRouteDetailsOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [clientStep, setClientStep] = useState(0);
  const [activeAddressFieldId, setActiveAddressFieldId] = useState<string | null>(null);
  const [locationPoint, setLocationPoint] = useState<GeoPoint | undefined>();
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [autoLocationRequested, setAutoLocationRequested] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFeedOrderId, setSelectedFeedOrderId] = useState<string | null>(null);
  const [driverFeedSort, setDriverFeedSort] = useState<DriverFeedSort>('near');
  const [detailsOrder, setDetailsOrder] = useState<AppOrder | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverAddressSuggestions, setServerAddressSuggestions] = useState<SalavatAddressSuggestion[]>([]);
  const [serverRouteEstimate, setServerRouteEstimate] = useState<RouteEstimate | null>(null);
  const [routeEstimateStatus, setRouteEstimateStatus] = useState<'local' | 'loading' | 'server'>('local');
  const isDriverRole = isDriverLikeRole(role);
  const isSelfEmployedDriver = isSelfEmployedDriverRole(role);

  const selectedTariff = useMemo(
    () => config.tariffs.find((tariff) => tariff.id === selectedTariffId) ?? config.tariffs[0],
    [config.tariffs, selectedTariffId],
  );
  const serviceCopy = getServiceCopy(serviceType);
  const isDeliveryOrder = serviceType === 'delivery';
  const selectedOptionItems = useMemo(
    () => config.options.filter((option) => selectedOptions.includes(option.id)),
    [config.options, selectedOptions],
  );
  const selectedOptionLabels = useMemo(
    () => selectedOptionItems.map((option) => option.label),
    [selectedOptionItems],
  );
  const cleanExtraStops = useMemo(
    () => extraStops.map((stop) => stop.trim()).filter(Boolean),
    [extraStops],
  );
  const optionsTotal = useMemo(
    () => selectedOptionItems.reduce((sum, option) => sum + option.price, 0),
    [selectedOptionItems],
  );
  const canConfirm = Boolean(values.pickup?.trim()) && Boolean(values.destination?.trim());
  const usesRegionalAddressBook = !isDriverRole;
  const availableCarsCount = useMemo(
    () =>
      drivers.reduce(
        (count, driver) =>
          count +
          (driver.status === 'approved' &&
          driver.isOnline &&
          driver.subscriptionStatus === 'active' &&
          driver.canReceiveOrders
            ? 1
            : 0),
        0,
      ),
    [drivers],
  );
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
              ['created', 'searching'].includes(order.status) &&
              isOrderVisibleToDriver(order, currentDriver?.id, nowMs),
          )
          .sort((left, right) => {
            const leftExclusive = isOrderExclusiveForDriver(left, currentDriver?.id, nowMs);
            const rightExclusive = isOrderExclusiveForDriver(right, currentDriver?.id, nowMs);

            if (leftExclusive !== rightExclusive) {
              return rightExclusive ? 1 : -1;
            }

            if (driverFeedSort === 'near') {
              return getDriverOrderDistanceKm(left, currentDriver) - getDriverOrderDistanceKm(right, currentDriver);
            }

            if (driverFeedSort === 'price') {
              return Number(right.total || 0) - Number(left.total || 0);
            }

            return Date.parse(right.createdAt || '') - Date.parse(left.createdAt || '');
          })
        : [],
    [currentDriver, driverCannotReceiveOrders, driverFeedSort, isDriverRole, nowMs, orders],
  );
  const primaryDriverFeedOrders = useMemo(
    () => availableDriverOrders.slice(0, 12),
    [availableDriverOrders],
  );
  const compactDriverFeedOrders = useMemo(
    () => availableDriverOrders.slice(0, 4),
    [availableDriverOrders],
  );
  const selectedFeedOrder = useMemo(
    () =>
      availableDriverOrders.find((order) => order.id === selectedFeedOrderId) ?? availableDriverOrders[0],
    [availableDriverOrders, selectedFeedOrderId],
  );
  const selectedFeedOrderExclusiveSeconds = selectedFeedOrder
    ? getExclusiveOfferRemainingSeconds(selectedFeedOrder, currentDriver?.id, nowMs)
    : 0;
  const selectedFeedOrderIsExclusive = selectedFeedOrderExclusiveSeconds > 0;
  const exclusiveDriverOrdersCount = useMemo(
    () =>
      availableDriverOrders.reduce(
        (count, order) => count + (isOrderExclusiveForDriver(order, currentDriver?.id, nowMs) ? 1 : 0),
        0,
      ),
    [availableDriverOrders, currentDriver?.id, nowMs],
  );
  const localRouteEstimate = useMemo(
    () =>
      buildRouteEstimate({
        destination: values.destination ?? '',
        optionsTotal,
        pickup: values.pickup ?? '',
        role,
        serviceType,
        stopsCount: cleanExtraStops.length,
        tariff: selectedTariff,
      }),
    [cleanExtraStops.length, optionsTotal, role, selectedTariff, serviceType, values.destination, values.pickup],
  );
  const routeEstimate = serverRouteEstimate ?? localRouteEstimate;
  const total = isDriverRole && selectedFeedOrder ? selectedFeedOrder.total : routeEstimate.total;

  useEffect(() => {
    if (!isDriverRole) {
      return;
    }

    const timer = setInterval(() => setNowMs(Date.now()), 1000);

    return () => clearInterval(timer);
  }, [isDriverRole]);

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
        serviceType,
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
    serviceType,
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
      pickupDistance: 'Открытый заказ из ленты',
    }));
    setServiceType(selectedFeedOrder.serviceType === 'delivery' ? 'delivery' : 'taxi');
    setSelectedTariffId(config.tariffs[0].id);
    setPaymentMethod(selectedFeedOrder.paymentMethod);
  }, [config.tariffs, isDriverRole, selectedFeedOrder, selectedFeedOrderId]);

  const updateValue = (id: string, nextValue: string) => {
    setConfirmed(false);
    setValues((current) => ({ ...current, [id]: nextValue }));
  };

  const selectServiceType = (nextServiceType: OrderServiceType) => {
    setConfirmed(false);
    setServiceType(nextServiceType);
    setClientStep(0);
    setDeliveryDetailsOpen(false);
    setRouteDetailsOpen(false);

    if (nextServiceType === 'delivery') {
      setValues((current) => ({ ...current, deliveryHandoff: current.deliveryHandoff || 'door_to_door' }));
    }
  };

  const selectDeliveryPackage = (presetId: DeliveryPackagePresetId) => {
    const preset = deliveryPackagePresets.find((item) => item.id === presetId);

    setConfirmed(false);
    setValues((current) => {
      const currentDescription = current.packageDescription?.trim() ?? '';
      const presetDescriptionIsCurrent = deliveryPackagePresets.some(
        (item) => item.defaultDescription && item.defaultDescription === currentDescription,
      );
      const shouldApplyPresetDescription = !currentDescription || presetDescriptionIsCurrent;

      return {
        ...current,
        deliveryPackageType: presetId,
        packageDescription: shouldApplyPresetDescription ? preset?.defaultDescription ?? '' : current.packageDescription ?? '',
      };
    });
  };

  const selectDeliveryHandoff = (handoffId: DeliveryHandoffId) => {
    setConfirmed(false);
    setValues((current) => ({ ...current, deliveryHandoff: handoffId }));
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

  const addExtraStop = () => {
    setExtraStops((current) => (current.length >= 2 ? current : [...current, '']));
  };

  const updateExtraStop = (index: number, value: string) => {
    setExtraStops((current) => current.map((stop, itemIndex) => (itemIndex === index ? value : stop)));
  };

  const removeExtraStop = (index: number) => {
    setExtraStops((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const selectDriverFeedOrder = (orderId: string) => {
    setSelectedFeedOrderId(orderId);
  };

  const handleDeclineExclusiveOffer = async () => {
    if (!currentDriver || !selectedFeedOrder || !selectedFeedOrderIsExclusive) {
      return;
    }

    setIsSubmitting(true);

    try {
      await declineOrderOffer(selectedFeedOrder.id, currentDriver.id);
      setSelectedFeedOrderId(null);
    } finally {
      setIsSubmitting(false);
    }
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

  useEffect(() => {
    if (
      autoLocationRequested ||
      isDriverRole ||
      presetPickup ||
      values.pickup?.trim()
    ) {
      return;
    }

    setAutoLocationRequested(true);
    void requestLocationRoutes();
  }, [autoLocationRequested, isDriverRole, presetPickup, values.pickup]);

  const acceptDriverFeedOrder = async (order: AppOrder) => {
    if (!currentDriver) {
      setConfirmed(true);
      return;
    }

    setSelectedFeedOrderId(order.id);
    setDetailsOrder(null);
    setIsSubmitting(true);

    try {
      const assignedOrder = await assignOrderToDriver(order.id, currentDriver.id, 'accepted');

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
      navigation.navigate('Subscription', { context: 'trial-ended', firstName, role });
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
      await acceptDriverFeedOrder(selectedFeedOrder);
      return;
    }

    const order = {
      destination: values.destination.trim(),
      id: `CLIENT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      options: selectedOptionLabels,
      optionsTotal,
      paymentMethod,
      pickup: values.pickup.trim(),
      serviceType,
      deliveryHandoff: isDeliveryOrder ? values.deliveryHandoff || 'door_to_door' : undefined,
      deliveryPackageType: isDeliveryOrder ? values.deliveryPackageType || undefined : undefined,
      packageDescription: isDeliveryOrder ? values.packageDescription?.trim() || undefined : undefined,
      recipientName: isDeliveryOrder ? values.recipientName?.trim() || undefined : undefined,
      recipientPhone: isDeliveryOrder ? values.recipientPhone?.trim() || undefined : undefined,
      deliveryComment: isDeliveryOrder ? values.deliveryComment?.trim() || undefined : undefined,
      routeEstimate,
      safetyPinRequired,
      scheduledAt: scheduledAt.trim() || undefined,
      stops: cleanExtraStops,
      tariff: selectedTariff.title,
      tariffId: selectedTariff.id,
      total,
      ...(locationPoint ? { pickupPoint: locationPoint } : {}),
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
    const clientAddressFieldId =
      activeAddressFieldId === 'pickup' || activeAddressFieldId === 'destination'
        ? activeAddressFieldId
        : null;
    const clientAddressSuggestions = clientAddressFieldId
      ? mergeAddressSuggestions([
          ...findSalavatAddressSuggestions(values[clientAddressFieldId] ?? '', 6),
          ...serverAddressSuggestions,
        ]).slice(0, 4)
      : [];
    const clientRealtimeLabel = formatClientRealtimeLabel(realtimeMessage, realtimeStatus);
    const deliveryPackageReady = !isDeliveryOrder || Boolean(values.deliveryPackageType || values.packageDescription?.trim());
    const routeDetailsHasContent = extraStops.some((stop) => stop.trim()) || Boolean(scheduledAt.trim());
    const routeDetailsVisible = routeDetailsOpen || routeDetailsHasContent;
    const deliveryOptionalDetailsFilled = Boolean(
      values.packageDescription?.trim() ||
      values.recipientName?.trim() ||
      values.recipientPhone?.trim() ||
      values.deliveryComment?.trim(),
    );
    const deliveryDetailsVisible = deliveryDetailsOpen || deliveryOptionalDetailsFilled;
    const scenePickup = values.pickup?.trim() || (isDeliveryOrder ? 'Где забрать' : 'Подача');
    const sceneDestination = values.destination?.trim() || (isDeliveryOrder ? 'Куда доставить' : 'Куда едем');
    const visibleClientTariffs = config.tariffs.filter((tariff) => tariff.id === 'economy');
    const economyTariffs = visibleClientTariffs.length > 0 ? visibleClientTariffs : [config.tariffs[0]];
    const clientStepMeta = isDeliveryOrder
      ? [
          {
            label: 'Маршрут',
            title: 'Откуда и куда?',
            text: 'Укажите адрес забора и адрес получателя.',
          },
          {
            label: 'Посылка',
            title: 'Что доставляем?',
            text: 'Выберите тип и добавьте список, получателя или пожелания.',
          },
          {
            label: 'Передача',
            title: 'Как передать?',
            text: 'Выберите способ передачи, проверьте цену и оформите доставку.',
          },
        ]
      : [
          {
            label: 'Маршрут',
            title: serviceCopy.routeStepTitle,
            text: serviceCopy.routeStepText,
          },
          {
            label: 'Тариф',
            title: serviceCopy.priceStepTitle,
            text: serviceCopy.priceStepText,
          },
          {
            label: 'Проверка',
            title: serviceCopy.confirmStepTitle,
            text: serviceCopy.confirmStepText,
          },
        ];
    const currentClientStep = clientStepMeta[0];
    const clientPrimaryLabel = isSubmitting
      ? 'Ищем машину'
      : canConfirm
      ? 'Вызвать Эконом'
      : 'Укажите маршрут';
    const handleClientStepAction = async () => {
      if (!canConfirm) {
        setConfirmed(true);
        return;
      }

      await handlePrimaryAction();
    };
    const resetClientRoute = () => {
      setConfirmed(false);
      setActiveAddressFieldId(null);
      setRouteDetailsOpen(false);
      setScheduledAt('');
      setExtraStops([]);
      setValues((current) => ({
        ...current,
        destination: '',
        pickup: '',
      }));
    };

    return (
      <SafeAreaView style={styles.clientSafeArea}>
        <ScrollView
          contentContainerStyle={[styles.clientPage, simpleMode && styles.clientPageSimple]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          style={styles.clientScroll}
        >
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

          <View style={styles.clientFlowPanel}>
            <View style={styles.clientFlowHeader}>
              <View style={styles.clientFlowIcon}>
                <Route color="#008D49" size={22} strokeWidth={2.4} />
              </View>
              <View style={styles.clientFlowCopy}>
                <Text style={styles.clientFlowTitle}>{currentClientStep.title}</Text>
                <Text numberOfLines={2} style={styles.clientFlowText}>
                  {currentClientStep.text}
                </Text>
              </View>
            </View>
            <View style={styles.clientFlowMap}>
              <View style={styles.clientMapRoadWide} />
              <View style={styles.clientMapRoadThin} />
              <View style={styles.clientMapRoute}>
                <View style={styles.clientMapPointStart} />
                <View style={styles.clientMapRouteLine} />
                <View style={styles.clientMapCar}>
                  <Car color="#0B2F25" size={14} strokeWidth={2.8} />
                </View>
              </View>
            </View>
            <View style={styles.clientSceneSummary}>
              <Text numberOfLines={1} style={styles.clientScenePoint}>{scenePickup}</Text>
              <Navigation color="#008D49" size={15} strokeWidth={2.7} />
              <Text numberOfLines={1} style={styles.clientScenePoint}>{sceneDestination}</Text>
            </View>
          </View>

          <View style={styles.clientDestinationBlock}>
            <View style={styles.clientTripHeader}>
              <Text style={styles.clientTripTitle}>Детали поездки</Text>
              <Text style={styles.clientTripEta}>{canConfirm ? `Подача ${selectedTariff.eta}` : '2 адреса'}</Text>
            </View>
            <View style={styles.clientInputShell}>
              <View style={styles.clientInputLabelRow}>
                <View style={styles.clientInputDot} />
                <Text style={styles.clientInputLabel}>{serviceCopy.pickupLabel}</Text>
              </View>
              <TextInput
                autoCorrect={false}
                onChangeText={(value) => updateValue('pickup', value)}
                onFocus={() => setActiveAddressFieldId('pickup')}
                placeholder={serviceCopy.pickupPlaceholder}
                placeholderTextColor="#557669"
                returnKeyType="next"
                style={[styles.clientDestinationInput, simpleMode && styles.clientDestinationInputSimple]}
                value={values.pickup ?? ''}
              />
            </View>
            <View style={styles.clientInputShell}>
              <View style={styles.clientInputLabelRow}>
                <View style={[styles.clientInputDot, styles.clientInputDotEnd]} />
                <Text style={styles.clientInputLabel}>{serviceCopy.destinationLabel}</Text>
              </View>
              <TextInput
                autoCorrect={false}
                onChangeText={(value) => updateValue('destination', value)}
                onFocus={() => setActiveAddressFieldId('destination')}
                placeholder={serviceCopy.destinationPlaceholder}
                placeholderTextColor="#557669"
                returnKeyType="done"
                style={[styles.clientDestinationInput, simpleMode && styles.clientDestinationInputSimple]}
                value={values.destination ?? ''}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: routeDetailsVisible }}
              onPress={() => setRouteDetailsOpen((current) => !current)}
              style={({ pressed }) => [styles.clientOptionalToggle, pressed && styles.pressed]}
            >
              <Text style={styles.clientOptionalToggleText}>
                {routeDetailsVisible ? 'Скрыть время и остановки' : 'Время подачи и остановки'}
              </Text>
              <Text style={styles.clientOptionalToggleMeta}>
                {routeDetailsHasContent ? 'Заполнено' : 'Необязательно'}
              </Text>
            </Pressable>
            {routeDetailsVisible ? (
              <>
                {extraStops.map((stop, index) => (
                  <View key={`stop-${index}`} style={styles.clientStopRow}>
                    <TextInput
                      autoCorrect={false}
                      onChangeText={(value) => updateExtraStop(index, value)}
                      placeholder={`Остановка ${index + 1}`}
                      placeholderTextColor="#557669"
                      returnKeyType="next"
                      style={[
                        styles.clientDestinationInput,
                        styles.clientStopInput,
                        simpleMode && styles.clientDestinationInputSimple,
                      ]}
                      value={stop}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => removeExtraStop(index)}
                      style={({ pressed }) => [styles.clientRemoveStopButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.clientRemoveStopText}>×</Text>
                    </Pressable>
                  </View>
                ))}
                <View style={styles.clientInlineActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={extraStops.length >= 2}
                    onPress={addExtraStop}
                    style={({ pressed }) => [
                      styles.clientSmallOptionButton,
                      extraStops.length >= 2 && styles.clientSmallOptionButtonMuted,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.clientSmallOptionText}>+ Остановка</Text>
                  </Pressable>
                  <TextInput
                    autoCorrect={false}
                    onChangeText={setScheduledAt}
                    placeholder="Когда подать? Сейчас или 18:30"
                    placeholderTextColor="#557669"
                    style={[styles.clientScheduleInput, simpleMode && styles.clientDestinationInputSimple]}
                    value={scheduledAt}
                  />
                </View>
              </>
            ) : null}
            {false ? (
              <View style={styles.deliveryDetailsBlock}>
                <View style={styles.deliveryPresetGrid}>
                  {deliveryPackagePresets.map((preset) => {
                    const active = values.deliveryPackageType === preset.id;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        key={preset.id}
                        onPress={() => selectDeliveryPackage(preset.id)}
                        style={({ pressed }) => [
                          styles.deliveryPresetButton,
                          active && styles.deliveryPresetButtonActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.deliveryPresetTitle, active && styles.deliveryPresetTitleActive]}>
                          {preset.title}
                        </Text>
                        <Text numberOfLines={1} style={[styles.deliveryPresetText, active && styles.deliveryPresetTextActive]}>
                          {preset.text}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  autoCorrect={false}
                  onChangeText={(value) => updateValue('packageDescription', value)}
                  placeholder="Что доставить? Например: документы, пакет, цветы"
                  placeholderTextColor="#557669"
                  returnKeyType="next"
                  style={[styles.clientDestinationInput, simpleMode && styles.clientDestinationInputSimple]}
                  value={values.packageDescription ?? ''}
                />
                <View style={styles.deliveryHandoffRow}>
                  {deliveryHandoffOptions.map((handoff) => {
                    const active = (values.deliveryHandoff || 'door_to_door') === handoff.id;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        key={handoff.id}
                        onPress={() => selectDeliveryHandoff(handoff.id)}
                        style={({ pressed }) => [
                          styles.deliveryHandoffButton,
                          active && styles.deliveryHandoffButtonActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.deliveryHandoffText, active && styles.deliveryHandoffTextActive]}>
                          {handoff.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.deliveryDetailsRow}>
                  <TextInput
                    autoCorrect={false}
                    onChangeText={(value) => updateValue('recipientName', value)}
                    placeholder="Получатель"
                    placeholderTextColor="#557669"
                    returnKeyType="next"
                    style={[
                      styles.clientDestinationInput,
                      styles.deliveryHalfInput,
                      simpleMode && styles.clientDestinationInputSimple,
                    ]}
                    value={values.recipientName ?? ''}
                  />
                  <TextInput
                    autoCorrect={false}
                    keyboardType="phone-pad"
                    onChangeText={(value) => updateValue('recipientPhone', value)}
                    placeholder="Телефон"
                    placeholderTextColor="#557669"
                    returnKeyType="done"
                    style={[
                      styles.clientDestinationInput,
                      styles.deliveryHalfInput,
                      simpleMode && styles.clientDestinationInputSimple,
                    ]}
                    value={values.recipientPhone ?? ''}
                  />
                </View>
                <TextInput
                  autoCorrect={false}
                  onChangeText={(value) => updateValue('deliveryComment', value)}
                  placeholder="Комментарий курьеру"
                  placeholderTextColor="#557669"
                  style={[styles.clientScheduleInput, simpleMode && styles.clientDestinationInputSimple]}
                  value={values.deliveryComment ?? ''}
                />
              </View>
            ) : null}
            {clientAddressSuggestions.length > 0 ? (
              <View style={styles.clientSuggestions}>
                {clientAddressSuggestions.map((suggestion) => (
                  <Pressable
                    accessibilityRole="button"
                    key={suggestion.id}
                    onPress={() =>
                      selectAddressSuggestion(clientAddressFieldId ?? 'destination', suggestion)
                    }
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

          {!canConfirm ? (
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
          ) : null}

          {clientStep === 1 && isDeliveryOrder ? (
            <View style={styles.deliveryStepPanel}>
              <View style={styles.deliveryPresetGrid}>
                {deliveryPackagePresets.map((preset) => {
                  const active = values.deliveryPackageType === preset.id;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      key={preset.id}
                      onPress={() => selectDeliveryPackage(preset.id)}
                      style={({ pressed }) => [
                        styles.deliveryPresetButton,
                        active && styles.deliveryPresetButtonActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.deliveryPresetTitle, active && styles.deliveryPresetTitleActive]}>
                        {preset.title}
                      </Text>
                      <Text numberOfLines={2} style={[styles.deliveryPresetText, active && styles.deliveryPresetTextActive]}>
                        {preset.text}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {deliveryDetailsVisible ? (
                <View style={styles.deliveryDetailsMenu}>
                  <View style={styles.deliveryDetailsMenuHeader}>
                    <Text style={styles.deliveryDetailsMenuTitle}>Подробности и пожелания</Text>
                    <Text numberOfLines={2} style={styles.deliveryDetailsMenuText}>
                      Можно написать список, получателя и что важно водителю.
                    </Text>
                  </View>
                  <TextInput
                    autoCorrect={false}
                    multiline
                    onChangeText={(value) => updateValue('packageDescription', value)}
                    placeholder="Например: документы, ключи, маленький пакет"
                    placeholderTextColor="#557669"
                    style={[styles.clientDestinationInput, styles.deliveryListInput, simpleMode && styles.clientDestinationInputSimple]}
                    value={values.packageDescription ?? ''}
                  />
                  <View style={styles.deliveryDetailsRow}>
                    <TextInput
                      autoCorrect={false}
                      onChangeText={(value) => updateValue('recipientName', value)}
                      placeholder="Получатель"
                      placeholderTextColor="#557669"
                      returnKeyType="next"
                      style={[
                        styles.clientDestinationInput,
                        styles.deliveryHalfInput,
                        simpleMode && styles.clientDestinationInputSimple,
                      ]}
                      value={values.recipientName ?? ''}
                    />
                    <TextInput
                      autoCorrect={false}
                      keyboardType="phone-pad"
                      onChangeText={(value) => updateValue('recipientPhone', value)}
                      placeholder="Телефон"
                      placeholderTextColor="#557669"
                      returnKeyType="done"
                      style={[
                        styles.clientDestinationInput,
                        styles.deliveryHalfInput,
                        simpleMode && styles.clientDestinationInputSimple,
                      ]}
                      value={values.recipientPhone ?? ''}
                    />
                  </View>
                  <TextInput
                    autoCorrect={false}
                    multiline
                    onChangeText={(value) => updateValue('deliveryComment', value)}
                    placeholder="Пожелания: позвонить, бережно, не мять, оставить у охраны"
                    placeholderTextColor="#557669"
                    style={[styles.clientScheduleInput, styles.deliveryCommentInput, simpleMode && styles.clientDestinationInputSimple]}
                    value={values.deliveryComment ?? ''}
                  />
                </View>
              ) : (
                <View style={styles.deliveryDetailsHint}>
                  <Package color="#008D49" size={19} strokeWidth={2.4} />
                  <Text style={styles.deliveryDetailsHintText}>
                    Детали не обязательны. Тип посылки уже достаточно для следующего шага.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDeliveryDetailsOpen(true)}
                    style={({ pressed }) => [styles.deliveryDetailsHintButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.deliveryDetailsHintButtonText}>Добавить</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : null}

          {!isDeliveryOrder ? (
            <>
              <View style={styles.clientSheetHeader}>
                <Text style={styles.clientSheetTitle}>Выберите поездку</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={resetClientRoute}
                  style={({ pressed }) => [styles.clientResetButton, pressed && styles.pressed]}
                >
                  <Text style={styles.clientResetButtonText}>Сбросить</Text>
                </Pressable>
              </View>
              <View style={styles.clientTariffList}>
                {economyTariffs.map((tariff) => {
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
                                {serviceCopy.benefits.map((benefit) => (
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
                          <View style={styles.clientTariffConfidence}>
                            <Text style={styles.clientTariffConfidenceText}>Цена до заказа</Text>
                            <Text style={styles.clientTariffConfidenceText}>PIN доступен</Text>
                            <Text style={styles.clientTariffConfidenceText}>{formatDistance(routeEstimate.distanceKm)}</Text>
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

          {clientStep === 2 && isDeliveryOrder ? (
            <>
              <View style={styles.deliveryHandoffPanel}>
                <Text style={styles.deliveryHandoffPanelTitle}>Способ передачи</Text>
                <View style={styles.deliveryHandoffGrid}>
                  {deliveryHandoffOptions.map((handoff) => {
                    const active = (values.deliveryHandoff || 'door_to_door') === handoff.id;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        key={handoff.id}
                        onPress={() => selectDeliveryHandoff(handoff.id)}
                        style={({ pressed }) => [
                          styles.deliveryHandoffCard,
                          active && styles.deliveryHandoffCardActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={[styles.deliveryHandoffCardDot, active && styles.deliveryHandoffCardDotActive]} />
                        <View style={styles.deliveryHandoffCardCopy}>
                          <Text style={[styles.deliveryHandoffCardTitle, active && styles.deliveryHandoffCardTitleActive]}>
                            {handoff.title}
                          </Text>
                          <Text numberOfLines={2} style={[styles.deliveryHandoffCardText, active && styles.deliveryHandoffCardTextActive]}>
                            {handoff.text}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <ClientTariffSelector
                benefits={serviceCopy.benefits}
                onSelect={(tariffId) => {
                  setConfirmed(false);
                  setSelectedTariffId(tariffId);
                }}
                routeTotal={routeEstimate.total}
                selectedTariffId={selectedTariffId}
                tariffs={config.tariffs}
              />

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

          {false ? (
            <View style={styles.clientSummaryCard}>
              <Text style={styles.clientSummaryTitle}>{serviceCopy.confirmTitle}</Text>
              <View style={styles.clientSummaryRow}>
                <Text style={styles.clientSummaryLabel}>{serviceCopy.pickupLabel}</Text>
                <Text numberOfLines={2} style={styles.clientSummaryValue}>
                  {values.pickup || 'Не указано'}
                </Text>
              </View>
              <View style={styles.clientSummaryRow}>
                <Text style={styles.clientSummaryLabel}>{serviceCopy.destinationLabel}</Text>
                <Text numberOfLines={2} style={styles.clientSummaryValue}>
                  {values.destination || 'Не указано'}
                </Text>
              </View>
              {isDeliveryOrder ? (
                <>
                  <View style={styles.clientSummaryRow}>
                    <Text style={styles.clientSummaryLabel}>Тип</Text>
                    <Text numberOfLines={1} style={styles.clientSummaryValue}>
                      {getDeliveryPackageLabel(values.deliveryPackageType)}
                    </Text>
                  </View>
                  <View style={styles.clientSummaryRow}>
                    <Text style={styles.clientSummaryLabel}>Посылка</Text>
                    <Text numberOfLines={2} style={styles.clientSummaryValue}>
                      {values.packageDescription?.trim() || 'Не указано'}
                    </Text>
                  </View>
                  <View style={styles.clientSummaryRow}>
                    <Text style={styles.clientSummaryLabel}>Передача</Text>
                    <Text numberOfLines={1} style={styles.clientSummaryValue}>
                      {getDeliveryHandoffLabel(values.deliveryHandoff)}
                    </Text>
                  </View>
                  <View style={styles.clientSummaryRow}>
                    <Text style={styles.clientSummaryLabel}>Получатель</Text>
                    <Text numberOfLines={2} style={styles.clientSummaryValue}>
                      {[values.recipientName, values.recipientPhone].filter(Boolean).join(' · ') || 'Не указан'}
                    </Text>
                  </View>
                </>
              ) : null}
              {cleanExtraStops.length ? (
                <View style={styles.clientSummaryRow}>
                  <Text style={styles.clientSummaryLabel}>Остановки</Text>
                  <Text numberOfLines={2} style={styles.clientSummaryValue}>
                    {cleanExtraStops.join(' · ')}
                  </Text>
                </View>
              ) : null}
              {scheduledAt.trim() ? (
                <View style={styles.clientSummaryRow}>
                  <Text style={styles.clientSummaryLabel}>Подача</Text>
                  <Text numberOfLines={1} style={styles.clientSummaryValue}>{scheduledAt.trim()}</Text>
                </View>
              ) : null}
              <View style={styles.clientSummaryRow}>
                <Text style={styles.clientSummaryLabel}>Тариф</Text>
                <Text numberOfLines={1} style={styles.clientSummaryValue}>
                  {selectedTariff.title}
                </Text>
              </View>
              <View style={styles.clientSummaryRow}>
                <Text style={styles.clientSummaryLabel}>Маршрут</Text>
                <Text numberOfLines={1} style={styles.clientSummaryValue}>
                  {formatDistance(routeEstimate.distanceKm)} · {routeEstimate.durationMin} мин
                </Text>
              </View>
              <View style={[styles.clientSummaryRow, styles.clientSummaryTotalRow]}>
                <Text style={styles.clientSummaryTotalLabel}>Итого</Text>
                <Text style={styles.clientSummaryTotalValue}>{total} ₽</Text>
              </View>
            </View>
          ) : null}

          {confirmed && !canConfirm ? (
            <Text style={styles.clientError}>{serviceCopy.missingRouteText}</Text>
          ) : null}
          {confirmed && isDeliveryOrder && clientStep === 1 && !deliveryPackageReady ? (
            <Text style={styles.clientError}>Выберите тип посылки или опишите, что нужно доставить.</Text>
          ) : null}

          <View style={styles.clientBottom}>
            {clientStep > 0 ? (
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={() => {
                  setConfirmed(false);
                  setClientStep((current) => Math.max(current - 1, 0));
                }}
                style={({ pressed }) => [
                  styles.clientBackStepButton,
                  isSubmitting && styles.clientCallButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <ArrowLeft color="#008D49" size={20} strokeWidth={2.4} />
                <Text style={styles.clientBackStepText}>Назад</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={handleClientStepAction}
              style={({ pressed }) => [
                styles.clientCallButton,
                simpleMode && styles.clientCallButtonSimple,
                isSubmitting && styles.clientCallButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Navigation color="#F4FAF6" size={21} strokeWidth={2.6} />
              <Text style={[styles.clientCallButtonText, simpleMode && styles.clientCallButtonTextSimple]}>
                {clientPrimaryLabel}
              </Text>
              <Text style={styles.hiddenClientButtonLabel}>
                {isSubmitting ? 'Ищем машину' : 'Вызвать'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isDriverRole) {
    const driverFeedStatusText = driverNeedsApproval
      ? 'Нужно одобрение администратора.'
      : driverCannotReceiveOrders
      ? 'Доступ к заказам закрыт.'
      : exclusiveDriverOrdersCount > 0
      ? `Эксклюзив: ${selectedFeedOrderExclusiveSeconds} сек.`
      : availableDriverOrders.length > 0
      ? `${availableDriverOrders.length} заказов рядом.`
      : 'Заказов рядом нет.';

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.driverFeedPage} keyboardShouldPersistTaps="handled">
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
              <Text style={styles.rolePillText}>Водитель</Text>
            </View>
          </View>

          <View style={styles.driverFeedHeaderPanel}>
            <View style={styles.driverFeedHeaderIcon}>
              <Route color="#008D49" size={24} strokeWidth={2.4} />
            </View>
            <View style={styles.driverFeedHeaderCopy}>
              <Text style={styles.driverFeedScreenTitle}>Лента заказов</Text>
              <Text numberOfLines={2} style={styles.driverFeedScreenText}>
                Расстояние, адрес и цена. Детали открываются через i.
              </Text>
            </View>
          </View>

          <View style={styles.driverFeedListPanel}>
            <View style={styles.driverFeedListTop}>
              <View style={styles.driverFeedListCopy}>
                <Text style={styles.regionTitle}>{driverFeedStatusText}</Text>
                <Text numberOfLines={1} style={styles.regionText}>{realtimeMessage}</Text>
              </View>
              <Pressable
                accessibilityLabel="Обновить ленту заказов"
                accessibilityRole="button"
                onPress={refreshServerData}
                style={({ pressed }) => [styles.feedRefreshButton, pressed && styles.pressed]}
              >
                <Route color="#008D49" size={17} strokeWidth={2.4} />
              </Pressable>
            </View>

            <View style={styles.feedToolbar}>
              {(['near', 'price', 'new'] as DriverFeedSort[]).map((sort) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: driverFeedSort === sort }}
                  key={sort}
                  onPress={() => setDriverFeedSort(sort)}
                  style={({ pressed }) => [
                    styles.feedSortButton,
                    driverFeedSort === sort && styles.feedSortButtonActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.feedSortButtonText,
                      driverFeedSort === sort && styles.feedSortButtonTextActive,
                    ]}
                  >
                    {sort === 'near' ? 'Ближе' : sort === 'price' ? 'Дороже' : 'Новые'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {availableDriverOrders.length > 0 ? (
              primaryDriverFeedOrders.map((order) => (
                <CompactOrderCard
                  active={order.id === selectedFeedOrder?.id}
                  disabled={isSubmitting}
                  distanceLabel={getDriverOrderDistanceLabel(order, currentDriver)}
                  fromLabel={getDriverFeedAddressLabel(order)}
                  key={order.id}
                  onAccept={() => acceptDriverFeedOrder(order)}
                  onInfoPress={() => {
                    selectDriverFeedOrder(order.id);
                    setDetailsOrder(order);
                  }}
                  paymentLabel={order.paymentMethod}
                  priceLabel={`${order.total} ₽`}
                  serviceLabel={getServiceCopy(order.serviceType === 'delivery' ? 'delivery' : 'taxi').shortTitle}
                  toLabel={order.destination}
                />
              ))
            ) : realtimeStatus === 'connecting' && !driverCannotReceiveOrders ? (
              <KinetixSkeleton rows={3} />
            ) : (
              <KinetixEmptyState
                description={
                  driverCannotReceiveOrders
                    ? driverNeedsApproval
                      ? 'После одобрения администратора лента откроется автоматически.'
                      : 'Проверьте документы, договор, разрешение авто, реестр и налоговый профиль.'
                    : 'Лента обновляется автоматически. Можно обновить вручную кнопкой сверху.'
                }
                icon={<Route color="#008D49" size={21} strokeWidth={2.4} />}
                title={driverCannotReceiveOrders ? 'Доступ закрыт' : 'Заказов рядом нет'}
              />
            )}

            {selectedFeedOrderIsExclusive ? (
              <View style={styles.offerNotice}>
                <Text style={styles.offerNoticeTitle}>Заказ закреплен за вами</Text>
                <Text style={styles.offerNoticeText}>
                  Осталось {selectedFeedOrderExclusiveSeconds} сек. Если не можете принять, пропустите -
                  заказ уйдет в общую ленту.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  onPress={handleDeclineExclusiveOffer}
                  style={({ pressed }) => [
                    styles.skipOfferButton,
                    isSubmitting && styles.disabledButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.skipOfferButtonText}>Пропустить</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </ScrollView>
        <OrderDetailsSheet
          distanceLabel={detailsOrder ? getDriverOrderDistanceLabel(detailsOrder, currentDriver) : ''}
          onAccept={detailsOrder ? () => acceptDriverFeedOrder(detailsOrder) : undefined}
          onClose={() => setDetailsOrder(null)}
          order={detailsOrder}
          visible={Boolean(detailsOrder)}
        />
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
                    {salavatAddressSuggestionCount} адресных подсказок и{' '}
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
                    <Text style={styles.regionTitle}>Лента заказов</Text>
                    <Text numberOfLines={2} style={styles.regionText}>
                      {driverNeedsApproval
                        ? 'Заявка водителя создана. Администратор должен проверить автомобиль и открыть доступ.'
                        : driverCannotReceiveOrders
                        ? 'Доступ к заказам закрыт. Нужны документы, договор, разрешение авто, реестр и налоговый профиль.'
                        : exclusiveDriverOrdersCount > 0
                        ? `Эксклюзив: ${selectedFeedOrderExclusiveSeconds} сек.`
                        : availableDriverOrders.length > 0
                        ? `${availableDriverOrders.length} заказов. Решение за 2 секунды.`
                        : 'Заказов рядом нет.'}
                    </Text>
                    <View style={styles.feedToolbar}>
                      {(['near', 'price', 'new'] as DriverFeedSort[]).map((sort) => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: driverFeedSort === sort }}
                          key={sort}
                          onPress={() => setDriverFeedSort(sort)}
                          style={({ pressed }) => [
                            styles.feedSortButton,
                            driverFeedSort === sort && styles.feedSortButtonActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.feedSortButtonText,
                              driverFeedSort === sort && styles.feedSortButtonTextActive,
                            ]}
                          >
                            {sort === 'near' ? 'Ближе' : sort === 'price' ? 'Дороже' : 'Новые'}
                          </Text>
                        </Pressable>
                      ))}
                      <Pressable
                        accessibilityRole="button"
                        onPress={refreshServerData}
                        style={({ pressed }) => [styles.feedRefreshButton, pressed && styles.pressed]}
                      >
                        <Route color="#008D49" size={17} strokeWidth={2.4} />
                      </Pressable>
                    </View>
                    {compactDriverFeedOrders.map((order) => (
                      <CompactOrderCard
                        active={order.id === selectedFeedOrder?.id}
                        disabled={isSubmitting}
                        distanceLabel={getDriverOrderDistanceLabel(order, currentDriver)}
                        fromLabel={getDriverFeedAddressLabel(order)}
                        key={order.id}
                        onAccept={() => acceptDriverFeedOrder(order)}
                        onInfoPress={() => {
                          selectDriverFeedOrder(order.id);
                          setDetailsOrder(order);
                        }}
                        paymentLabel={order.paymentMethod}
                        priceLabel={`${order.total} ₽`}
                        serviceLabel={getServiceCopy(order.serviceType === 'delivery' ? 'delivery' : 'taxi').shortTitle}
                        toLabel={order.destination}
                      />
                    ))}
                    {selectedFeedOrderIsExclusive ? (
                      <View style={styles.offerNotice}>
                        <Text style={styles.offerNoticeTitle}>Заказ закреплен за вами</Text>
                        <Text style={styles.offerNoticeText}>
                          Осталось {selectedFeedOrderExclusiveSeconds} сек. Если не можете принять, пропустите -
                          заказ уйдет в общую ленту.
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          disabled={isSubmitting}
                          onPress={handleDeclineExclusiveOffer}
                          style={({ pressed }) => [
                            styles.skipOfferButton,
                            isSubmitting && styles.disabledButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.skipOfferButtonText}>Пропустить</Text>
                        </Pressable>
                      </View>
                    ) : null}
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
                  {serverStatus === 'connected' ? 'Сервер подключен' : 'Нет связи с сервером'}
                </Text>
                <Text style={styles.resultText}>{serverMessage}</Text>
              </View>

              {confirmed ? (
                <View style={[styles.resultBox, canConfirm && styles.resultBoxSuccess]}>
                  <Text style={styles.resultTitle}>
                    {driverNeedsApproval ? 'Нужен допуск' : canConfirm ? 'Заказ создан' : 'Нужен маршрут'}
                  </Text>
                  <Text style={styles.resultText}>
                    {driverNeedsApproval
                      ? 'Реальные заказы откроются после ручного одобрения администратора.'
                      : canConfirm
                      ? 'Проверьте маршрут и статус заказа.'
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
      <OrderDetailsSheet
        distanceLabel={detailsOrder ? getDriverOrderDistanceLabel(detailsOrder, currentDriver) : ''}
        onAccept={detailsOrder ? () => acceptDriverFeedOrder(detailsOrder) : undefined}
        onClose={() => setDetailsOrder(null)}
        order={detailsOrder}
        visible={Boolean(detailsOrder)}
      />
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
    deliveryHandoff: 'door_to_door',
    pickup: 'Малояз, центр',
  };
}

function getServiceCopy(serviceType: OrderServiceType) {
  if (serviceType === 'delivery') {
    return {
      benefits: ['Забор у двери', 'Передача получателю', 'Статус в приложении'],
      confirmStepText: 'Проверьте адреса, посылку и получателя перед отправкой заказа водителям.',
      confirmStepTitle: 'Проверьте доставку',
      confirmTitle: 'Подтверждение доставки',
      deliveryMapTitle: 'Доставка',
      destinationLabel: 'Доставить',
      destinationPlaceholder: 'Куда доставить?',
      detailsTitle: 'Детали доставки',
      missingRouteText: 'Укажите, где забрать и куда доставить.',
      pickupLabel: 'Забрать',
      pickupPlaceholder: 'Откуда забрать?',
      priceStepText: 'Проверьте цену, время подачи и доступность машины.',
      priceStepTitle: 'Цена доставки',
      primaryAction: 'Оформить доставку',
      routeStepText: 'Укажите адрес забора и адрес получателя. Детали посылки можно добавить ниже.',
      routeStepTitle: 'Куда доставить?',
      shortTitle: 'Доставка',
    };
  }

  return {
    benefits: selectedTariffBenefits,
    confirmStepText: 'Последняя проверка маршрута перед отправкой заказа водителям.',
    confirmStepTitle: 'Проверьте заказ',
    confirmTitle: 'Подтверждение заказа',
    deliveryMapTitle: 'Поездка',
    destinationLabel: 'Куда',
    destinationPlaceholder: 'Куда едем?',
    detailsTitle: 'Детали заказа',
    missingRouteText: 'Укажите, куда едем.',
    pickupLabel: 'Откуда',
    pickupPlaceholder: 'Откуда',
    priceStepText: 'Проверьте цену, время подачи и доступность машины.',
    priceStepTitle: 'Выберите тариф',
    primaryAction: 'Вызвать',
    routeStepText: 'Укажите адрес подачи и точку назначения. Потом выберем тариф.',
    routeStepTitle: 'Куда едем?',
    shortTitle: 'Такси',
  };
}

function getDeliveryPackageLabel(value?: string) {
  return deliveryPackagePresets.find((preset) => preset.id === value)?.title || 'Не выбран';
}

function getDeliveryHandoffLabel(value?: string) {
  return deliveryHandoffOptions.find((handoff) => handoff.id === value)?.title || deliveryHandoffOptions[0].title;
}

function getDriverFeedAddressLabel(order: AppOrder) {
  return order.serviceType === 'delivery' ? `Забрать: ${order.pickup}` : order.pickup;
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

function getExclusiveOfferRemainingSeconds(order: AppOrder, driverId?: string, nowMs = Date.now()) {
  if (!driverId || order.exclusiveOfferStatus !== 'pending' || order.exclusiveDriverId !== driverId) {
    return 0;
  }

  const expiresAt = Date.parse(order.exclusiveOfferExpiresAt || '');

  if (!Number.isFinite(expiresAt)) {
    return 0;
  }

  return Math.max(0, Math.ceil((expiresAt - nowMs) / 1000));
}

function isOrderExclusiveForDriver(order: AppOrder, driverId?: string, nowMs = Date.now()) {
  return getExclusiveOfferRemainingSeconds(order, driverId, nowMs) > 0;
}

function isOrderVisibleToDriver(order: AppOrder, driverId?: string, nowMs = Date.now()) {
  if (!order.exclusiveDriverId || order.exclusiveOfferStatus !== 'pending') {
    return true;
  }

  const expiresAt = Date.parse(order.exclusiveOfferExpiresAt || '');

  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
    return true;
  }

  return order.exclusiveDriverId === driverId;
}

function getDriverOrderDistanceKm(order: AppOrder, driver?: DriverProfile) {
  if (order.pickupPoint && driver?.lastLocation) {
    return getGeoDistanceKm(driver.lastLocation, order.pickupPoint);
  }

  if (typeof order.exclusiveDistanceKm === 'number') {
    return order.exclusiveDistanceKm;
  }

  return Number.POSITIVE_INFINITY;
}

function getDriverOrderDistanceLabel(order: AppOrder, driver?: DriverProfile) {
  const distance = getDriverOrderDistanceKm(order, driver);

  return Number.isFinite(distance) ? `${formatDistance(distance)} от вас` : 'расстояние уточняется';
}

function getDriverOrderMetaLabel(order: AppOrder) {
  const duration = order.routeEstimate?.durationMin ? ` · ${order.routeEstimate.durationMin} мин` : '';
  const serviceLabel = getServiceCopy(order.serviceType === 'delivery' ? 'delivery' : 'taxi').shortTitle;

  return `${serviceLabel} · ${order.tariff} · ${order.paymentMethod}${duration}`;
}

function getDriverOrderBadges(order: AppOrder, driver: DriverProfile | undefined, nowMs: number) {
  const badges: string[] = [];
  const distance = getDriverOrderDistanceKm(order, driver);

  if (order.serviceType === 'delivery') {
    badges.push('доставка');
    const packageLabel = getDeliveryPackageLabel(order.deliveryPackageType);

    if (packageLabel !== 'Не выбран') {
      badges.push(packageLabel.toLowerCase());
    }
  }

  if (isOrderExclusiveForDriver(order, driver?.id, nowMs)) {
    badges.push('эксклюзив');
  }

  if (Number.isFinite(distance) && distance <= 2) {
    badges.push('рядом');
  }

  if (order.total >= 500) {
    badges.push('выгодно');
  }

  if (/нал/i.test(order.paymentMethod)) {
    badges.push('наличные');
  } else if (/карт|card/i.test(order.paymentMethod)) {
    badges.push('карта');
  }

  for (const option of order.options) {
    if (/багаж/i.test(option)) {
      badges.push('багаж');
    }

    if (/дет/i.test(option)) {
      badges.push('детское');
    }
  }

  return Array.from(new Set(badges));
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

type ClientTariffSelectorProps = {
  benefits: string[];
  onSelect: (tariffId: string) => void;
  routeTotal: number;
  selectedTariffId: string;
  tariffs: OrderTariff[];
};

function ClientTariffSelector({
  benefits,
  onSelect,
  routeTotal,
  selectedTariffId,
  tariffs,
}: ClientTariffSelectorProps) {
  return (
    <View style={styles.clientTariffList}>
      {tariffs.map((tariff) => {
        const active = tariff.id === selectedTariffId;
        const tariffPrice = active ? routeTotal : tariff.price;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={tariff.id}
            onPress={() => onSelect(tariff.id)}
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
                    <Text style={styles.clientTariffBadgeText}>Выбрано</Text>
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
                      {benefits.map((benefit) => (
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
                <View style={styles.clientTariffConfidence}>
                  <Text style={styles.clientTariffConfidenceText}>Цена до заказа</Text>
                  <Text style={styles.clientTariffConfidenceText}>PIN доступен</Text>
                  <Text style={styles.clientTariffConfidenceText}>Маршрут виден</Text>
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
  );
}

type CompactOrderCardProps = {
  active: boolean;
  disabled: boolean;
  distanceLabel: string;
  fromLabel: string;
  onAccept: () => void;
  onInfoPress: () => void;
  paymentLabel: string;
  priceLabel: string;
  serviceLabel: string;
  toLabel: string;
};

function CompactOrderCard({
  active,
  disabled,
  distanceLabel,
  fromLabel,
  onAccept,
  onInfoPress,
  paymentLabel,
  priceLabel,
  serviceLabel,
  toLabel,
}: CompactOrderCardProps) {
  return (
    <View
      accessibilityState={{ selected: active }}
      style={[
        styles.compactOrderCard,
        active && styles.compactOrderCardActive,
      ]}
    >
      <View style={styles.compactOrderTop}>
        <View style={styles.compactOrderTags}>
          <Text numberOfLines={1} style={styles.compactOrderService}>{serviceLabel}</Text>
          {paymentLabel ? (
            <Text numberOfLines={1} style={styles.compactOrderPayment}>{paymentLabel}</Text>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.compactOrderPrice}>{priceLabel}</Text>
      </View>

      <View style={styles.compactOrderRouteRow}>
        <View style={styles.compactOrderRouteMark}>
          <View style={styles.compactOrderRouteDot} />
          <View style={styles.compactOrderRouteLine} />
          <View style={styles.compactOrderRouteDotEnd} />
        </View>
        <View style={styles.compactOrderCopy}>
          <Text numberOfLines={1} style={styles.compactOrderRoute}>{fromLabel}</Text>
          <Text numberOfLines={1} style={styles.compactOrderRouteTo}>{toLabel}</Text>
        </View>
      </View>

      {distanceLabel ? (
        <Text numberOfLines={1} style={styles.compactOrderMeta}>{distanceLabel}</Text>
      ) : null}

      <View style={styles.compactOrderActions}>
        <Pressable
          accessibilityLabel="Подробнее о заказе"
          accessibilityRole="button"
          onPress={onInfoPress}
          style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}
        >
          <Info color="#008D49" size={20} strokeWidth={2.4} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onAccept}
          style={({ pressed }) => [
            styles.acceptOrderButton,
            styles.compactAcceptOrderButton,
            disabled && styles.disabledButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.acceptOrderButtonText}>Принять заказ</Text>
        </Pressable>
      </View>
    </View>
  );
}

type OrderDetailsSheetProps = {
  distanceLabel: string;
  onAccept?: () => void;
  onClose: () => void;
  order: AppOrder | null;
  visible: boolean;
};

function OrderDetailsSheet({ distanceLabel, onAccept, onClose, order, visible }: OrderDetailsSheetProps) {
  if (!order) {
    return null;
  }

  const serviceCopy = getServiceCopy(order.serviceType === 'delivery' ? 'delivery' : 'taxi');
  const details = [
    ['Тип', serviceCopy.shortTitle],
    [serviceCopy.pickupLabel, order.pickup],
    [serviceCopy.destinationLabel, order.destination],
    ...(order.serviceType === 'delivery'
      ? [
          ['Тип посылки', getDeliveryPackageLabel(order.deliveryPackageType)],
          ['Передача', getDeliveryHandoffLabel(order.deliveryHandoff)],
          ['Посылка', order.packageDescription || 'Не указано'],
          ['Получатель', [order.recipientName, order.recipientPhone].filter(Boolean).join(' · ') || 'Не указан'],
          ['Комментарий', order.deliveryComment || 'Нет'],
        ]
      : []),
    ['Расстояние', distanceLabel],
    ['Тариф', order.tariff],
    ['Оплата', order.paymentMethod],
    ['Опции', order.options.length ? order.options.join(', ') : 'Нет'],
    ['Статус', order.status],
  ];

  return (
    <KinetixBottomSheet
      onClose={onClose}
      subtitle={`${order.total} ₽ · ${getDriverOrderMetaLabel(order)}`}
      title={serviceCopy.detailsTitle}
      visible={visible}
    >
      <View style={styles.detailsList}>
        {details.map(([label, value]) => (
          <View key={label} style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>{label}</Text>
            <Text numberOfLines={2} style={styles.detailsValue}>{value}</Text>
          </View>
        ))}
      </View>
      <KinetixButton disabled={!onAccept} label="Принять заказ" onPress={onAccept} />
    </KinetixBottomSheet>
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
      <View style={styles.priceConfidenceRail}>
        <View style={styles.priceConfidenceChip}>
          <ShieldCheck color="#008D49" size={15} strokeWidth={2.4} />
          <Text style={styles.priceConfidenceText}>Цена до заказа</Text>
        </View>
        <View style={styles.priceConfidenceChip}>
          <Clock3 color="#008D49" size={15} strokeWidth={2.4} />
          <Text style={styles.priceConfidenceText}>
            {status === 'loading' ? 'Уточняем' : status === 'server' ? 'Расчет сервера' : 'MVP-оценка'}
          </Text>
        </View>
        <View style={styles.priceConfidenceChip}>
          <Route color="#008D49" size={15} strokeWidth={2.4} />
          <Text style={styles.priceConfidenceText}>Маршрут виден</Text>
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
