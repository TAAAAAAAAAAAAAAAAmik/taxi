import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Car,
  Check,
  CircleDot,
  Clock3,
  CreditCard,
  Heart,
  MapPinned,
  MessageCircle,
  Package,
  Phone,
  ReceiptText,
  Route,
  ShieldCheck,
  Star,
  UserRound,
} from 'lucide-react-native';
import {
  Pressable,
  SafeAreaView,
  Share,
  ScrollView,
  StyleSheet,
  Animated,
  AppState as NativeAppState,
  Easing,
  Linking,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { orderStatusConfig } from '../data/orderStatus';
import { isDriverLikeRole, roleCopy } from '../data/registration';
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';
import type { AppOrder, OrderParticipant, PaymentStatus } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderStatus'>;

const reviewMoods = ['Спокойно', 'Быстро', 'Аккуратно', 'По-доброму'];
const reviewFacetOptions = ['Подача', 'Чистота', 'Маршрут', 'Общение', 'Безопасность'];
const paymentStatusLabels: Record<PaymentStatus, string> = {
  authorized: 'Оплата авторизована',
  failed: 'Оплата не прошла',
  paid: 'Оплачено',
  pending: 'Ожидает оплаты',
  refunded: 'Возврат',
};

export function OrderStatusScreen({ navigation, route }: Props) {
  const { firstName, order, role } = route.params;
  const config = orderStatusConfig[role];
  const {
    addFavoriteDriver,
    addOrderReview,
    notifications,
    orders,
    refreshServerData,
    realtimeMessage,
    realtimeStatus,
    realtimeUpdatedAt,
    updateOrderPaymentStatus,
    updateOrderStatus,
  } = useAppState();
  const { width } = useWindowDimensions();
  const isWide = width >= 840;
  const initialStepIndex = getStepIndex(config.steps, (order as { status?: string }).status);
  const [activeStepIndex, setActiveStepIndex] = useState(initialStepIndex);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactResult, setContactResult] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewMood, setReviewMood] = useState(reviewMoods[0]);
  const [reviewFacets, setReviewFacets] = useState<string[]>(['Подача']);
  const [reviewComment, setReviewComment] = useState('');
  const [favoriteAdded, setFavoriteAdded] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [pinError, setPinError] = useState('');
  const [shareResult, setShareResult] = useState('');
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyResult, setSafetyResult] = useState('');
  const [tripChatOpen, setTripChatOpen] = useState(false);
  const [tripChatDraft, setTripChatDraft] = useState('');
  const [tripChatMessages, setTripChatMessages] = useState<
    Array<{ author: 'client' | 'driver' | 'system'; id: string; text: string }>
  >(() => [
    {
      id: 'system',
      author: 'system' as const,
      text: 'Чат открыт внутри приложения. Телефон не показываем.',
    },
  ]);

  const activeStep = config.steps[activeStepIndex];
  const isCompleted = activeStepIndex === config.steps.length - 1;
  const currentOrder = orders.find((item) => item.id === order.id);
  const displayedOrder = (currentOrder ?? order) as AppOrder;
  const serviceCopy = getStatusServiceCopy(displayedOrder);
  const routeDriver = (order as typeof order & { driver?: OrderParticipant }).driver;
  const driver = currentOrder?.driver ?? routeDriver ?? {
    id: 'driver-alexey-solaris',
    name: config.participantName,
    vehicle: config.participantMeta,
  };
  const contactPhone =
    role === 'client'
      ? driver.phone ?? config.contactPhone
      : currentOrder?.clientPhone ?? config.contactPhone;
  const participantName =
    role === 'client'
      ? driver.vehicle
        ? `${driver.name}, ${driver.vehicle}`
        : driver.name
      : currentOrder?.clientName || config.participantName;
  const participantMeta =
    role === 'client'
      ? [driver.rating ? `Рейтинг ${driver.rating}` : null, driver.plate ? `госномер ${driver.plate}` : null]
          .filter(Boolean)
          .join(' · ') || config.participantMeta
      : config.participantMeta;
  const existingReview = currentOrder?.review;
  const liveStatus = currentOrder?.status ?? (order as { status?: string }).status;
  const paymentStatus = displayedOrder.paymentStatus ?? 'pending';
  const isPaid = paymentStatus === 'paid';
  const paymentEvent = displayedOrder.paymentEvents?.[0];
  const requiresTripPin = Boolean(displayedOrder.safetyPinRequired && displayedOrder.tripPin);
  const progress = useMemo(
    () => Math.round(((activeStepIndex + 1) / config.steps.length) * 100),
    [activeStepIndex, config.steps.length],
  );
  const primaryActionLabel = getPrimaryActionLabel(role, activeStep.id, config.primaryAction);
  const isDriverRole = isDriverLikeRole(role);
  const reducedMotion = useReducedMotionPreference();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const etaFlickerAnim = useRef(new Animated.Value(1)).current;
  const [etaUpdatedAt, setEtaUpdatedAt] = useState(() => new Date());
  const etaMinutes = useMemo(
    () =>
      calculateEtaMinutes(
        displayedOrder.routeEstimate?.durationMin,
        liveStatus,
        etaUpdatedAt,
      ),
    [displayedOrder.routeEstimate?.durationMin, etaUpdatedAt, liveStatus],
  );

  useEffect(() => {
    setActiveStepIndex(getStepIndex(config.steps, liveStatus));
  }, [config.steps, liveStatus]);

  useEffect(() => {
    const subscription = NativeAppState.addEventListener('change', (state) => {
      if (state === 'active') {
        console.info(`[realtime] app foreground: force status refresh for ${order.id}`);
        void refreshServerData();
      }
    });

    return () => subscription.remove();
  }, [order.id, refreshServerData]);

  useEffect(() => {
    if (reducedMotion) {
      pulseAnim.setValue(0);
      return;
    }

    Animated.loop(
      Animated.timing(pulseAnim, {
        duration: 1600,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ).start();
  }, [pulseAnim, reducedMotion]);

  useEffect(() => {
    const timer = setInterval(() => {
      setEtaUpdatedAt(new Date());

      if (reducedMotion) {
        etaFlickerAnim.setValue(1);
        return;
      }

      Animated.sequence([
        Animated.timing(etaFlickerAnim, {
          duration: 120,
          toValue: 0.45,
          useNativeDriver: true,
        }),
        Animated.timing(etaFlickerAnim, {
          duration: 220,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }, 30000);

    return () => clearInterval(timer);
  }, [etaFlickerAnim, reducedMotion]);

  const advance = async () => {
    if (role === 'client') {
      return;
    }

    const nextIndex = Math.min(activeStepIndex + 1, config.steps.length - 1);
    const nextStatus = config.steps[nextIndex].id;

    if (nextStatus === 'started' && requiresTripPin && pinCode.trim().length !== 4) {
      setPinError('Введите 4-значный PIN клиента.');
      return;
    }

    setPinError('');
    setActiveStepIndex((current) => {
      const calculatedNextIndex = Math.min(current + 1, config.steps.length - 1);
      const calculatedNextStatus = config.steps[calculatedNextIndex].id;
      updateOrderStatus(
        order.id,
        calculatedNextStatus,
        calculatedNextStatus === 'started' ? pinCode.trim() : undefined,
      );
      return calculatedNextIndex;
    });
  };

  const confirmPayment = async () => {
    await updateOrderPaymentStatus(
      order.id,
      'paid',
      isDriverRole ? 'Водитель подтвердил оплату' : 'Клиент подтвердил оплату',
    );
  };

  const shareTrip = async () => {
    const message = [
      `Kinetix: ${serviceCopy.shortTitle.toLowerCase()} ${displayedOrder.id}`,
      `${displayedOrder.pickup} → ${displayedOrder.destination}`,
      displayedOrder.stops?.length ? `Остановки: ${displayedOrder.stops.join(', ')}` : '',
      displayedOrder.scheduledAt ? `Подача: ${displayedOrder.scheduledAt}` : `Подача примерно ${etaMinutes} мин`,
      role === 'client' ? `Водитель: ${participantName}` : `Клиент: ${participantName}`,
      `Сумма: ${displayedOrder.total} ₽`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Share.share({ message });
      setShareResult('Поездкой можно поделиться в любом мессенджере.');
    } catch {
      setShareResult(message);
    }
  };

  const openEmergencyCall = async () => {
    setSafetyResult('Открываем экстренный вызов 112. Если связи нет, оставайтесь на месте и сообщите оператору.');

    try {
      await Linking.openURL('tel:112');
    } catch {
      setSafetyResult('Не удалось открыть звонок автоматически. Наберите 112 вручную.');
    }
  };

  const sendSafetySignal = () => {
    setSafetyResult('Сигнал безопасности сохранен в поездке. Следующий шаг — подключить серверную эскалацию оператору.');
  };

  const chooseContact = async (mode: 'call' | 'chat') => {
    if (mode === 'chat') {
      setTripChatOpen(true);
      setContactResult('Чат открыт. Номер телефона не раскрывается.');
      return;
    }

    await Linking.openURL(`tel:${contactPhone.replace(/\s/g, '')}`);
    setContactResult('Звонок открыт через системный набор. Номер не показываем в интерфейсе.');
  };

  const sendTripChatMessage = () => {
    const text = tripChatDraft.trim();

    if (!text) {
      return;
    }

    setTripChatMessages((current) => [
      ...current,
      {
        id: `${Date.now()}`,
        author: role === 'client' ? 'client' : 'driver',
        text,
      },
    ]);
    setTripChatDraft('');
  };

  const toggleReviewFacet = (facet: string) => {
    setReviewFacets((current) =>
      current.includes(facet) ? current.filter((item) => item !== facet) : [...current, facet],
    );
  };

  const submitReview = () => {
    addOrderReview(order.id, {
      comment: reviewComment.trim() || 'Поездка прошла без проблем.',
      driverId: driver.id,
      driverName: driver.name,
      facets: reviewFacets.length > 0 ? reviewFacets : ['Общее впечатление'],
      mood: reviewMood,
      orderId: order.id,
      rating: reviewRating,
    });
  };

  const addDriverToFavorites = () => {
    addFavoriteDriver({
      ...driver,
      addedAt: new Date().toISOString(),
      lastOrderId: order.id,
      reason: existingReview?.facets.join(', ') || reviewFacets.join(', ') || 'Хорошая поездка',
    });
    setFavoriteAdded(true);
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
            <ArrowLeft color="#008D49" size={20} strokeWidth={2.4} />
            <Text style={styles.backButtonText}>К заказу</Text>
          </Pressable>

          <View style={styles.rolePill}>
            <UserRound color="#008D49" size={17} strokeWidth={2.4} />
            <Text style={styles.rolePillText}>{roleCopy[role].title}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            {displayedOrder.serviceType === 'delivery' ? (
              <Package color="#008D49" size={30} strokeWidth={2.4} />
            ) : (
              <Route color="#008D49" size={30} strokeWidth={2.4} />
            )}
          </View>
          <View style={styles.heroCopy}>
            <Text numberOfLines={2} style={styles.title}>{serviceCopy.statusTitle}</Text>
            <Text numberOfLines={2} style={styles.subtitle}>{config.subtitle}</Text>
            <Text style={styles.metaLine}>
              {firstName?.trim() || 'Пользователь'} · заказ {order.id}
            </Text>
          </View>
        </View>

        <View style={styles.livePanel}>
          <View style={[styles.liveDot, realtimeStatus === 'live' && styles.liveDotActive]} />
          <View style={styles.liveCopy}>
            <Text style={styles.liveTitle}>
              {realtimeStatus === 'live'
                ? 'Статус приходит с сервера'
                : realtimeStatus === 'polling'
                  ? 'Статус сверяется каждые 5 секунд'
                  : 'Подключаем серверный статус'}
            </Text>
            <Text numberOfLines={2} style={styles.liveText}>
              {notifications.find((item) => item.orderId === order.id)?.title || realtimeMessage}
              {realtimeUpdatedAt ? ` · ${new Date(realtimeUpdatedAt).toLocaleTimeString('ru-RU')}` : ''}
            </Text>
          </View>
        </View>

        {role === 'client' || isDriverRole ? (
          <>
            <TripPulseMap
              destination={displayedOrder.destination}
              driver={driver}
              etaFlickerAnim={etaFlickerAnim}
              etaMinutes={etaMinutes}
              isCompleted={isCompleted}
              pickup={displayedOrder.pickup}
              pulseAnim={pulseAnim}
              serviceCompletedTitle={serviceCopy.completedTitle}
              serviceType={displayedOrder.serviceType === 'delivery' ? 'delivery' : 'taxi'}
              status={liveStatus}
              viewerRole={isDriverRole ? 'driver' : 'client'}
            />
            <TripSafetyBar
              hiddenPhoneLabel="Номер скрыт"
              onChat={() => {
                setTripChatOpen(true);
                setContactResult('Чат открыт. Номер телефона не раскрывается.');
              }}
              onSafety={() => setSafetyOpen(true)}
              onShare={shareTrip}
              pinEnabled={requiresTripPin}
              viewerRole={isDriverRole ? 'driver' : 'client'}
            />
          </>
        ) : null}

        <View style={[styles.layout, isWide && styles.layoutWide]}>
          <View style={styles.mainColumn}>
            <View style={styles.statusPanel}>
              <View style={styles.statusHeader}>
                <View style={styles.statusIcon}>
                  {isCompleted ? (
                    <Check color="#12382C" size={24} strokeWidth={3} />
                  ) : (
                    <CircleDot color="#12382C" size={24} strokeWidth={2.6} />
                  )}
                </View>
                <View style={styles.statusCopy}>
                  <Text style={styles.statusTitle}>
                    {isCompleted ? config.completedTitle : activeStep.title}
                  </Text>
                  <Text numberOfLines={3} style={styles.statusText}>
                    {isCompleted ? config.completedText : activeStep.description}
                  </Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>Прогресс заказа: {progress}%</Text>

              <View style={styles.actionRow}>
                {isDriverRole ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isCompleted}
                    onPress={advance}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      isCompleted && styles.primaryButtonMuted,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isCompleted ? 'Статус завершен' : primaryActionLabel}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('Dashboard', { firstName, role })}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>В кабинет</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('OrderHistory', { firstName, role })}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>История</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={shareTrip}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>Поделиться</Text>
                </Pressable>
              </View>
              {shareResult ? <Text style={styles.inlineNotice}>{shareResult}</Text> : null}
            </View>

            <View style={styles.panel}>
              <SectionHeader title="Этапы заказа" />
              <View style={styles.steps}>
                {config.steps.map((step, index) => {
                  const isDone = index < activeStepIndex;
                  const isActive = index === activeStepIndex;

                  return (
                    <View key={step.id} style={styles.stepRow}>
                      <View
                        style={[
                          styles.stepDot,
                          isDone && styles.stepDotDone,
                          isActive && styles.stepDotActive,
                        ]}
                      >
                        {isDone ? <Check color="#12382C" size={14} strokeWidth={3} /> : null}
                      </View>
                      <View style={styles.stepCopy}>
                        <Text style={[styles.stepTitle, isActive && styles.stepTitleActive]}>
                          {step.title}
                        </Text>
                        <Text numberOfLines={2} style={styles.stepDescription}>{step.description}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {isCompleted && role === 'client' ? (
              <View style={styles.goodRoadPanel}>
                <View style={styles.goodRoadCar}>
                  <Car color="#F4FAF6" size={28} strokeWidth={2.6} />
                </View>
                <View style={styles.goodRoadCopy}>
                  <Text style={styles.goodRoadTitle}>Спасибо, что вы с Такси Салават</Text>
                  <Text numberOfLines={2} style={styles.goodRoadText}>Добрая дорога завершена. Поездку можно повторить или сохранить водителя.</Text>
                </View>
                <View style={styles.sparkRow}>
                  <View style={styles.spark} />
                  <View style={[styles.spark, styles.sparkSmall]} />
                  <View style={styles.spark} />
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('OrderFlow', { firstName, role })}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.primaryButtonText}>Повторить поездку</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={addDriverToFavorites}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {favoriteAdded ? 'В избранном' : 'В избранное'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {isCompleted && role === 'client' ? (
              <View style={styles.reviewPanel}>
                <SectionHeader title="Слепок поездки" />
                <Text numberOfLines={3} style={styles.reviewIntro}>
                  Не просто звезды: сохраните, чем именно водитель был хорош. Потом в истории можно
                  добавить его в приоритет.
                </Text>

                {existingReview ? (
                  <View style={styles.savedReviewBox}>
                    <Text style={styles.savedReviewTitle}>Отзыв сохранен</Text>
                    <Text style={styles.savedReviewText}>
                      {existingReview.rating}/5 · {existingReview.mood} ·{' '}
                      {existingReview.facets.join(', ')}
                    </Text>
                    <Text style={styles.savedReviewText}>{existingReview.comment}</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.ratingRow}>
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: rating <= reviewRating }}
                          key={rating}
                          onPress={() => setReviewRating(rating)}
                          style={({ pressed }) => [styles.starButton, pressed && styles.pressed]}
                        >
                          <Star
                            color={rating <= reviewRating ? '#008D49' : '#008D49'}
                            fill={rating <= reviewRating ? '#008D49' : 'transparent'}
                            size={26}
                            strokeWidth={2.4}
                          />
                        </Pressable>
                      ))}
                    </View>

                    <View style={styles.reviewChips}>
                      {reviewMoods.map((mood) => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: mood === reviewMood }}
                          key={mood}
                          onPress={() => setReviewMood(mood)}
                          style={({ pressed }) => [
                            styles.reviewChip,
                            mood === reviewMood && styles.reviewChipActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.reviewChipText,
                              mood === reviewMood && styles.reviewChipTextActive,
                            ]}
                          >
                            {mood}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <View style={styles.reviewChips}>
                      {reviewFacetOptions.map((facet) => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: reviewFacets.includes(facet) }}
                          key={facet}
                          onPress={() => toggleReviewFacet(facet)}
                          style={({ pressed }) => [
                            styles.reviewChip,
                            reviewFacets.includes(facet) && styles.reviewChipActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.reviewChipText,
                              reviewFacets.includes(facet) && styles.reviewChipTextActive,
                            ]}
                          >
                            {facet}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <TextInput
                      multiline
                      onChangeText={setReviewComment}
                      placeholder="Что запомнилось? Например: аккуратно ехал, помог с багажом"
                      placeholderTextColor="#557669"
                      style={styles.reviewInput}
                      value={reviewComment}
                    />

                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={submitReview}
                        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.primaryButtonText}>Сохранить отзыв</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={addDriverToFavorites}
                        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                      >
                        <Heart color="#008D49" size={17} strokeWidth={2.4} />
                        <Text style={styles.secondaryButtonText}>
                          {favoriteAdded ? 'В избранном' : 'В избранные'}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ) : null}
          </View>

          <View style={[styles.sideColumn, isWide && styles.sideColumnWide]}>
            <View style={styles.panel}>
              <SectionHeader title={serviceCopy.routePanelTitle} />
              <InfoRow icon={<MapPinned color="#008D49" size={18} />} label={serviceCopy.pickupLabel} value={displayedOrder.pickup} />
              <InfoRow
                icon={<Route color="#008D49" size={18} />}
                label={serviceCopy.destinationLabel}
                value={displayedOrder.destination}
              />
              {displayedOrder.serviceType === 'delivery' ? (
                <>
                  <InfoRow
                    icon={<Package color="#008D49" size={18} />}
                    label="Тип"
                    value={formatDeliveryPackageType(displayedOrder.deliveryPackageType)}
                  />
                  <InfoRow
                    icon={<ShieldCheck color="#008D49" size={18} />}
                    label="Передача"
                    value={formatDeliveryHandoff(displayedOrder.deliveryHandoff)}
                  />
                  <InfoRow
                    icon={<Package color="#008D49" size={18} />}
                    label="Посылка"
                    value={displayedOrder.packageDescription || 'Не указано'}
                  />
                  <InfoRow
                    icon={<UserRound color="#008D49" size={18} />}
                    label="Получатель"
                    value={[displayedOrder.recipientName, displayedOrder.recipientPhone].filter(Boolean).join(' · ') || 'Не указан'}
                  />
                </>
              ) : null}
              {displayedOrder.stops?.length ? (
                <InfoRow
                  icon={<MapPinned color="#008D49" size={18} />}
                  label="Остановки"
                  value={displayedOrder.stops.join(' · ')}
                />
              ) : null}
              {displayedOrder.scheduledAt ? (
                <InfoRow
                  icon={<Clock3 color="#008D49" size={18} />}
                  label="Подача"
                  value={displayedOrder.scheduledAt}
                />
              ) : null}
              <InfoRow icon={<Clock3 color="#008D49" size={18} />} label="Тариф" value={displayedOrder.tariff} />
            </View>

            <View style={styles.panel}>
              <SectionHeader title={config.participantTitle} />
              <View style={styles.participant}>
                <View style={styles.participantIcon}>
                  <UserRound color="#008D49" size={22} strokeWidth={2.4} />
                </View>
                <View style={styles.participantCopy}>
                  <Text style={styles.participantName}>{participantName}</Text>
                  <Text style={styles.participantMeta}>{participantMeta}</Text>
                </View>
              </View>
              <View style={styles.miniActions}>
                <MiniAction
                  icon={<Phone color="#008D49" size={16} />}
                  label="Связь"
                  onPress={() => {
                    setContactOpen((current) => !current);
                    setContactResult(null);
                  }}
                />
                <MiniAction
                  icon={<ShieldCheck color="#008D49" size={16} />}
                  label="Безопасность"
                  onPress={() => setSafetyOpen((current) => !current)}
                />
              </View>
              {contactOpen ? (
                <View style={styles.contactPanel}>
                  <Text style={styles.contactTitle}>{config.contactTitle}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => chooseContact('chat')}
                    style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}
                  >
                    <MessageCircle color="#008D49" size={17} strokeWidth={2.4} />
                    <Text style={styles.contactButtonText}>{config.chatActionLabel}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => chooseContact('call')}
                    style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}
                  >
                    <Phone color="#008D49" size={17} strokeWidth={2.4} />
                    <Text style={styles.contactButtonText}>{config.callActionLabel}</Text>
                  </Pressable>
                  <Text style={styles.contactPhone}>Номер скрыт. Для связи используйте чат или кнопку звонка.</Text>
                  {contactResult ? <Text style={styles.contactResult}>{contactResult}</Text> : null}
                </View>
              ) : null}
              {safetyOpen ? (
                <View style={styles.safetyPanel}>
                  <Text style={styles.contactTitle}>Безопасность поездки</Text>
                  <View style={styles.safetyGrid}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={shareTrip}
                      style={({ pressed }) => [styles.safetyMiniCard, pressed && styles.pressed]}
                    >
                      <Text style={styles.safetyMiniTitle}>Share Trip</Text>
                      <Text numberOfLines={2} style={styles.safetyMiniText}>Маршрут и статус можно отправить близким.</Text>
                    </Pressable>
                    <View style={styles.safetyMiniCard}>
                      <Text style={styles.safetyMiniTitle}>PIN</Text>
                      <Text numberOfLines={2} style={styles.safetyMiniText}>
                        {requiresTripPin ? 'Поездка начнется только после кода.' : 'Можно включить при заказе.'}
                      </Text>
                    </View>
                    <View style={styles.safetyMiniCard}>
                      <Text style={styles.safetyMiniTitle}>Скрытый номер</Text>
                      <Text numberOfLines={2} style={styles.safetyMiniText}>Связь идет через чат или системный звонок.</Text>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={openEmergencyCall}
                    style={({ pressed }) => [styles.safetyPrimaryButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.safetyPrimaryText}>SOS 112</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={sendSafetySignal}
                    style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}
                  >
                    <ShieldCheck color="#008D49" size={17} strokeWidth={2.4} />
                    <Text style={styles.contactButtonText}>Сообщить поддержке</Text>
                  </Pressable>
                  {safetyResult ? <Text style={styles.contactResult}>{safetyResult}</Text> : null}
                </View>
              ) : null}
              {tripChatOpen ? (
                <View style={styles.tripChatPanel}>
                  <View style={styles.tripChatHeader}>
                    <Text style={styles.contactTitle}>Чат поездки</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setTripChatOpen(false)}
                      style={({ pressed }) => [styles.tripChatClose, pressed && styles.pressed]}
                    >
                      <Text style={styles.tripChatCloseText}>×</Text>
                    </Pressable>
                  </View>
                  <View style={styles.tripChatMessages}>
                    {tripChatMessages.map((message) => (
                      <View
                        key={message.id}
                        style={[
                          styles.tripChatBubble,
                          message.author === 'system' && styles.tripChatBubbleSystem,
                          message.author === (isDriverRole ? 'driver' : 'client') && styles.tripChatBubbleOwn,
                        ]}
                      >
                        <Text style={styles.tripChatText}>{message.text}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.tripChatInputRow}>
                    <TextInput
                      onChangeText={setTripChatDraft}
                      placeholder="Написать без номера телефона"
                      placeholderTextColor="#557669"
                      style={styles.tripChatInput}
                      value={tripChatDraft}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={sendTripChatMessage}
                      style={({ pressed }) => [styles.tripChatSend, pressed && styles.pressed]}
                    >
                      <Text style={styles.tripChatSendText}>OK</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.panel}>
              <SectionHeader title="Оплата и детали" />
              <View style={[styles.paymentStatusBox, isPaid && styles.paymentStatusBoxPaid]}>
                <View style={styles.paymentStatusTop}>
                  <CreditCard color={isPaid ? '#008D49' : '#5C8D89'} size={18} strokeWidth={2.4} />
                  <Text style={styles.paymentStatusTitle}>{paymentStatusLabels[paymentStatus]}</Text>
                </View>
                <Text style={styles.paymentStatusText}>
                  {isPaid
                    ? `Оплата закрыта${
                        displayedOrder.paidAt ? `: ${new Date(displayedOrder.paidAt).toLocaleString('ru-RU')}` : ''
                      }.`
                    : paymentStatus === 'authorized'
                    ? 'Средства авторизованы. После завершения поездки оплата закроется автоматически.'
                    : 'Оплата ожидает подтверждения.'}
                </Text>
                {paymentEvent?.note ? <Text style={styles.paymentStatusText}>{paymentEvent.note}</Text> : null}
                {!isPaid ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={confirmPayment}
                    style={({ pressed }) => [styles.paymentActionButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.paymentActionButtonText}>Подтвердить оплату</Text>
                  </Pressable>
                ) : null}
              </View>
              <InfoRow
                icon={<CreditCard color="#008D49" size={18} />}
                label="Способ"
                value={displayedOrder.paymentMethod}
              />
              <InfoRow icon={<ReceiptText color="#008D49" size={18} />} label="Сумма" value={`${displayedOrder.total} ₽`} />
              <InfoRow
                icon={<ShieldCheck color="#008D49" size={18} />}
                label="Опции"
                value={displayedOrder.options.length > 0 ? displayedOrder.options.join(', ') : 'Без дополнительных опций'}
              />
              {displayedOrder.receipt ? (
                <View style={styles.receiptBox}>
                  <Text style={styles.receiptTitle}>Чек {displayedOrder.receipt.id}</Text>
                  <Text style={styles.receiptText}>
                    {displayedOrder.receipt.fiscalNumber || 'Пилотный номер чека'} ·{' '}
                    {new Date(displayedOrder.receipt.issuedAt).toLocaleString('ru-RU')}
                  </Text>
                  {(displayedOrder.receipt.items ?? []).map((item) => (
                    <View key={`${item.label}-${item.amount}`} style={styles.receiptLine}>
                      <Text style={styles.receiptText}>{item.label}</Text>
                      <Text style={styles.receiptValue}>{item.amount} ₽</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.detailList}>
                {config.details.map((detail) => (
                  <View key={detail} style={styles.detailItem}>
                    <Check color="#008D49" size={15} strokeWidth={3} />
                    <Text style={styles.detailText}>{detail}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type SectionHeaderProps = {
  title: string;
};

type TripPulseMapProps = {
  destination: string;
  driver: OrderParticipant;
  etaFlickerAnim: Animated.Value;
  etaMinutes: number;
  isCompleted: boolean;
  pickup: string;
  pulseAnim: Animated.Value;
  serviceCompletedTitle: string;
  serviceType: 'delivery' | 'taxi';
  status?: string;
  viewerRole: 'client' | 'driver';
};

function TripSafetyBar({
  hiddenPhoneLabel,
  onChat,
  onSafety,
  onShare,
  pinEnabled,
  viewerRole,
}: {
  hiddenPhoneLabel: string;
  onChat: () => void;
  onSafety: () => void;
  onShare: () => void;
  pinEnabled: boolean;
  viewerRole: 'client' | 'driver';
}) {
  return (
    <View style={styles.safetyBar}>
      <Pressable
        accessibilityRole="button"
        onPress={onShare}
        style={({ pressed }) => [styles.safetyBarAction, pressed && styles.pressed]}
      >
        <Route color="#008D49" size={17} strokeWidth={2.4} />
        <View style={styles.safetyBarCopy}>
          <Text numberOfLines={1} style={styles.safetyBarTitle}>Поделиться</Text>
          <Text numberOfLines={1} style={styles.safetyBarText}>Статус поездки</Text>
        </View>
      </Pressable>
      <View style={styles.safetyBarAction}>
        <ShieldCheck color="#008D49" size={17} strokeWidth={2.4} />
        <View style={styles.safetyBarCopy}>
          <Text numberOfLines={1} style={styles.safetyBarTitle}>PIN</Text>
          <Text numberOfLines={1} style={styles.safetyBarText}>{pinEnabled ? 'Включен' : 'Не нужен'}</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onChat}
        style={({ pressed }) => [styles.safetyBarAction, pressed && styles.pressed]}
      >
        <Phone color="#008D49" size={17} strokeWidth={2.4} />
        <View style={styles.safetyBarCopy}>
          <Text numberOfLines={1} style={styles.safetyBarTitle}>{hiddenPhoneLabel}</Text>
          <Text numberOfLines={1} style={styles.safetyBarText}>Чат внутри</Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onSafety}
        style={({ pressed }) => [styles.safetyBarAction, styles.safetyBarActionStrong, pressed && styles.pressed]}
      >
        <ShieldCheck color="#B7F46A" size={17} strokeWidth={2.4} />
        <View style={styles.safetyBarCopy}>
          <Text numberOfLines={1} style={[styles.safetyBarTitle, styles.safetyBarTitleStrong]}>
            {viewerRole === 'driver' ? 'Защита' : 'Safety'}
          </Text>
          <Text numberOfLines={1} style={[styles.safetyBarText, styles.safetyBarTextStrong]}>112 и поддержка</Text>
        </View>
      </Pressable>
    </View>
  );
}

function TripPulseMap({
  destination,
  driver,
  etaFlickerAnim,
  etaMinutes,
  isCompleted,
  pickup,
  pulseAnim,
  serviceCompletedTitle,
  serviceType,
  status,
  viewerRole,
}: TripPulseMapProps) {
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 1.9],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [0.55, 0.18, 0],
  });
  const showDriver = viewerRole === 'client' && Boolean(driver?.id && status && !['searching', 'created'].includes(status));
  const isDelivery = serviceType === 'delivery';
  const mapTitle =
    viewerRole === 'driver'
      ? isDelivery
        ? 'Получатель ждёт доставку'
        : 'Пассажир ждёт вас'
      : showDriver
      ? isDelivery
        ? 'Водитель везёт доставку'
        : 'Водитель едет к вам'
      : isDelivery
        ? 'Ищем водителя для доставки'
        : 'Ищем водителя';

  return (
    <View style={styles.mapPanel}>
      <View pointerEvents="none" style={styles.tripMapBackdrop}>
        <View style={styles.tripMapGlow} />
        <View style={styles.tripMapDistrictOne} />
        <View style={styles.tripMapDistrictTwo} />
        <View style={[styles.tripMapRoad, styles.tripMapRoadOne]} />
        <View style={[styles.tripMapRoad, styles.tripMapRoadTwo]} />
        <View style={[styles.tripMapRoad, styles.tripMapRoadThree]} />
      </View>
      <View style={styles.tripMapHeader}>
        <Text style={styles.tripMapTitle}>{isCompleted ? serviceCompletedTitle : mapTitle}</Text>
        <Text numberOfLines={1} style={styles.tripMapMeta}>
          {viewerRole === 'client'
            ? [driver.vehicle, driver.plate ? `номер ${driver.plate}` : null, `${etaMinutes} мин`]
                .filter(Boolean)
                .join(' · ')
            : isDelivery
              ? 'Получатель показан мигающей зеленой точкой'
              : 'Пассажир показан мигающей зеленой точкой'}
        </Text>
      </View>
      <View style={styles.mapRoute}>
        <View style={styles.mapPoint} />
        <View style={styles.mapLine} />
        <View style={styles.mapPointFinish} />
      </View>
      <View style={styles.mapContent}>
        <View style={styles.pulseStage}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />
          <View style={styles.pulseRay} />
          <View style={styles.pulseDot} />
        </View>
        <View style={styles.routeCopy}>
          <Text numberOfLines={1} style={styles.routeTitle}>
            {pickup}
          </Text>
          <Text numberOfLines={1} style={styles.routeTextMain}>
            {destination}
          </Text>
          <Animated.Text style={[styles.etaText, { opacity: etaFlickerAnim }]}>
            {isCompleted
              ? serviceCompletedTitle
              : viewerRole === 'driver'
                ? isDelivery
                  ? 'Получатель отмечен зеленой точкой'
                  : 'Пассажир отмечен зеленой точкой'
                : isDelivery
                  ? `Доставка примерно ${etaMinutes} мин`
                  : `Подача примерно ${etaMinutes} мин`}
          </Animated.Text>
        </View>
      </View>
      <View style={styles.mapCarMarker}>
        <Car color="#F4FAF6" size={20} strokeWidth={2.6} />
      </View>
      {showDriver ? (
        <View style={styles.driverSheet}>
          <View style={styles.driverAvatar}>
            <Car color="#F4FAF6" size={22} strokeWidth={2.6} />
          </View>
          <View style={styles.driverSheetCopy}>
            <Text style={styles.driverSheetTitle}>{driver.name}</Text>
            <Text style={styles.driverSheetText}>
              {[driver.rating ? `рейтинг ${driver.rating}` : null, driver.vehicle, driver.plate]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SectionHeader({ title }: SectionHeaderProps) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

type InfoRowProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

type MiniActionProps = {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
};

function MiniAction({ icon, label, onPress }: MiniActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.miniAction, pressed && styles.pressed]}
    >
      {icon}
      <Text style={styles.miniActionText}>{label}</Text>
    </Pressable>
  );
}

function getStepIndex(steps: Array<{ id: string }>, status?: string) {
  const normalizedStatus = normalizeOrderStatus(status);
  return Math.max(
    steps.findIndex((step) => step.id === normalizedStatus),
    0,
  );
}

function normalizeOrderStatus(status?: string) {
  if (status === 'assigned') {
    return 'accepted';
  }

  if (status === 'arriving' || status === 'to_pickup') {
    return 'accepted';
  }

  if (status === 'in_progress') {
    return 'started';
  }

  return status;
}

function getPrimaryActionLabel(role: string, status: string, fallback: string) {
  if (role === 'client') {
    return fallback;
  }

  if (status === 'accepted') {
    return 'Я на месте';
  }

  if (status === 'arrived') {
    return 'Начать поездку';
  }

  if (status === 'started') {
    return 'Завершить поездку';
  }

  return fallback;
}

function formatDeliveryPackageType(value?: string) {
  if (value === 'documents') {
    return 'Документы';
  }

  if (value === 'food') {
    return 'Еда / цветы';
  }

  if (value === 'fragile') {
    return 'Хрупкое';
  }

  if (value === 'parcel') {
    return 'Пакет';
  }

  if (value === 'other') {
    return 'Другое';
  }

  return 'Не выбран';
}

function formatDeliveryHandoff(value?: string) {
  if (value === 'leave_at_door') {
    return 'Оставить у двери';
  }

  if (value === 'meet_outside') {
    return 'Встретят у входа';
  }

  return 'От двери до двери';
}

function getStatusServiceCopy(order: AppOrder) {
  if (order.serviceType === 'delivery') {
    return {
      completedTitle: 'Доставка завершена',
      destinationLabel: 'Доставить',
      pickupLabel: 'Забрать',
      routePanelTitle: 'Доставка',
      shortTitle: 'Доставка',
      statusTitle: 'Статус доставки',
    };
  }

  return {
    completedTitle: 'Поездка завершена',
    destinationLabel: 'Назначение',
    pickupLabel: 'Подача',
    routePanelTitle: 'Маршрут',
    shortTitle: 'Такси',
    statusTitle: 'Статус заказа',
  };
}

function calculateEtaMinutes(durationMin = 8, status?: string, updatedAt = new Date()) {
  if (['completed', 'closed'].includes(status || '')) {
    return 0;
  }

  if (status === 'started') {
    return Math.max(2, Math.round(durationMin / 2));
  }

  if (status === 'arrived') {
    return 1;
  }

  const drift = Math.floor(updatedAt.getSeconds() / 30);
  return Math.max(2, Math.round(Math.min(18, durationMin || 8) - drift));
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  contactButton: {
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
  contactButtonText: {
    color: '#008D49',
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  contactPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(18, 56, 44, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    padding: 12,
  },
  contactPhone: {
    color: '#557669',
    fontSize: 12,
    fontWeight: '800',
  },
  contactResult: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    color: '#12382C',
    fontSize: 12,
    lineHeight: 17,
    padding: 10,
  },
  contactTitle: {
    color: '#008D49',
    fontSize: 15,
    fontWeight: '900',
  },
  inlineNotice: {
    color: '#008D49',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  safetyPanel: {
    backgroundColor: '#F7FBF8',
    borderColor: 'rgba(18, 56, 44, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    padding: 12,
  },
  safetyBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  safetyBarAction: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 141, 73, 0.16)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 54,
    minWidth: 148,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  safetyBarActionStrong: {
    backgroundColor: '#0B2F25',
    borderColor: '#0B2F25',
  },
  safetyBarCopy: {
    flex: 1,
    minWidth: 0,
  },
  safetyBarText: {
    color: '#49665A',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  safetyBarTextStrong: {
    color: 'rgba(247, 251, 248, 0.78)',
  },
  safetyBarTitle: {
    color: '#12382C',
    fontSize: 12,
    fontWeight: '900',
  },
  safetyBarTitleStrong: {
    color: '#B7F46A',
  },
  safetyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  safetyMiniCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 141, 73, 0.16)',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minHeight: 74,
    minWidth: 120,
    padding: 10,
  },
  safetyMiniText: {
    color: '#49665A',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  safetyMiniTitle: {
    color: '#12382C',
    fontSize: 13,
    fontWeight: '900',
  },
  safetyPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#C17A70',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  safetyPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  detailItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  detailList: {
    gap: 9,
  },
  detailText: {
    color: '#12382C',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  driverAvatar: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  driverSheet: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    padding: 12,
  },
  driverSheetCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  driverSheetText: {
    color: '#557669',
    fontSize: 13,
    lineHeight: 18,
  },
  driverSheetTitle: {
    color: '#12382C',
    fontSize: 16,
    fontWeight: '900',
  },
  etaText: {
    color: '#008D49',
    fontSize: 16,
    fontWeight: '900',
  },
  goodRoadCar: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  goodRoadCopy: {
    gap: 5,
  },
  goodRoadPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  goodRoadText: {
    color: '#557669',
    fontSize: 14,
    lineHeight: 20,
  },
  goodRoadTitle: {
    color: '#12382C',
    fontSize: 20,
    fontWeight: '900',
  },
  hero: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(18, 56, 44, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    shadowColor: 'rgba(18, 56, 44, 0.14)',
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
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
  infoCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  infoIcon: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  infoLabel: {
    color: '#557669',
    fontSize: 12,
    fontWeight: '800',
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  infoValue: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
  },
  layout: {
    gap: 16,
  },
  layoutWide: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  liveCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  liveDot: {
    backgroundColor: '#5C8D89',
    borderRadius: 5,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  liveDotActive: {
    backgroundColor: '#7A9A7E',
  },
  livePanel: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  liveText: {
    color: '#557669',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  liveTitle: {
    color: '#008D49',
    fontSize: 14,
    fontWeight: '900',
  },
  mapContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  mapCarMarker: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    right: 26,
    top: 30,
    width: 42,
  },
  mapLine: {
    backgroundColor: '#00A855',
    borderRadius: 99,
    flex: 1,
    height: 3,
  },
  mapPanel: {
    backgroundColor: '#DDECE3',
    borderColor: 'rgba(0, 141, 73, 0.22)',
    borderRadius: 8,
    borderWidth: 1,
    elevation: 2,
    overflow: 'hidden',
    padding: 12,
    position: 'relative',
    shadowColor: 'rgba(18, 56, 44, 0.18)',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  tripMapBackdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  tripMapDistrictOne: {
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderColor: 'rgba(0, 141, 73, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    height: 72,
    left: 20,
    position: 'absolute',
    top: 18,
    width: 118,
  },
  tripMapDistrictTwo: {
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderColor: 'rgba(0, 141, 73, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    bottom: 20,
    height: 68,
    position: 'absolute',
    right: 22,
    width: 132,
  },
  tripMapGlow: {
    backgroundColor: 'rgba(183, 244, 106, 0.32)',
    borderRadius: 999,
    height: 172,
    position: 'absolute',
    right: -44,
    top: -52,
    width: 172,
  },
  tripMapRoad: {
    backgroundColor: 'rgba(255,255,255,0.68)',
    height: 20,
    left: -18,
    position: 'absolute',
    right: -18,
  },
  tripMapRoadOne: {
    top: 72,
    transform: [{ rotate: '-14deg' }],
  },
  tripMapRoadTwo: {
    top: 136,
    transform: [{ rotate: '22deg' }],
  },
  tripMapRoadThree: {
    top: 34,
    transform: [{ rotate: '42deg' }],
  },
  tripMapHeader: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: 'rgba(0, 141, 73, 0.22)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    marginBottom: 12,
    padding: 10,
    paddingRight: 68,
  },
  tripMapMeta: {
    color: '#557669',
    fontSize: 12,
    fontWeight: '800',
  },
  tripMapTitle: {
    color: '#12382C',
    fontSize: 18,
    fontWeight: '900',
  },
  mapPoint: {
    backgroundColor: '#008D49',
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  mapPointFinish: {
    backgroundColor: '#12382C',
    borderColor: '#008D49',
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    width: 14,
  },
  mapRoute: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  mainColumn: {
    flex: 1,
    gap: 16,
    minWidth: 0,
  },
  metaLine: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  miniAction: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 120,
    paddingHorizontal: 10,
  },
  miniActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniActionText: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  tripChatBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(18, 56, 44, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: '92%',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tripChatBubbleOwn: {
    alignSelf: 'flex-end',
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
  },
  tripChatBubbleSystem: {
    backgroundColor: '#F7FBF8',
    borderColor: 'rgba(18, 56, 44, 0.08)',
  },
  tripChatClose: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 141, 73, 0.28)',
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  tripChatCloseText: {
    color: '#008D49',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  tripChatHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tripChatInput: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(18, 56, 44, 0.16)',
    borderRadius: 8,
    borderWidth: 1,
    color: '#12382C',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    minHeight: 42,
    paddingHorizontal: 10,
  },
  tripChatInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tripChatMessages: {
    gap: 7,
  },
  tripChatPanel: {
    backgroundColor: '#F7FBF8',
    borderColor: 'rgba(18, 56, 44, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  tripChatSend: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 42,
    width: 48,
  },
  tripChatSendText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  tripChatText: {
    color: '#12382C',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  page: {
    backgroundColor: '#F6F8F5',
    gap: 14,
    minHeight: '100%',
    padding: 14,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(18, 56, 44, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    gap: 10,
    padding: 12,
    shadowColor: 'rgba(18, 56, 44, 0.14)',
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  paymentActionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 141, 73, 0.28)',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  paymentActionButtonText: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  paymentStatusBox: {
    backgroundColor: '#F1F8F3',
    borderColor: 'rgba(0, 141, 73, 0.28)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  paymentStatusBoxPaid: {
    backgroundColor: '#E8F3EF',
    borderColor: '#7A9A7E',
  },
  paymentStatusText: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  paymentStatusTitle: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  paymentStatusTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  participant: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  participantCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  participantIcon: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  participantMeta: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  participantName: {
    color: '#12382C',
    fontSize: 15,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.95 }],
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    elevation: 2,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    shadowColor: 'rgba(0, 111, 58, 0.22)',
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
  },
  primaryButtonMuted: {
    backgroundColor: '#008D49',
    opacity: 0.64,
  },
  primaryButtonText: {
    color: '#F4FAF6',
    fontSize: 14,
    fontWeight: '900',
  },
  progressFill: {
    backgroundColor: '#008D49',
    borderRadius: 99,
    height: '100%',
  },
  progressText: {
    color: '#557669',
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    backgroundColor: '#E8F3EF',
    borderRadius: 99,
    height: 9,
    overflow: 'hidden',
  },
  pulseDot: {
    backgroundColor: '#008D49',
    borderRadius: 10,
    height: 20,
    position: 'absolute',
    width: 20,
  },
  pulseRay: {
    backgroundColor: '#008D49',
    borderRadius: 99,
    height: 4,
    position: 'absolute',
    right: 2,
    top: 39,
    transform: [{ rotate: '-18deg' }],
    width: 42,
  },
  pulseRing: {
    borderColor: '#008D49',
    borderRadius: 42,
    borderWidth: 2,
    height: 84,
    position: 'absolute',
    width: 84,
  },
  pulseStage: {
    alignItems: 'center',
    height: 90,
    justifyContent: 'center',
    width: 96,
  },
  receiptBox: {
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 12,
  },
  receiptLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  receiptText: {
    color: '#557669',
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  receiptTitle: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  receiptValue: {
    color: '#12382C',
    fontSize: 12,
    fontWeight: '900',
  },
  ratingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  reviewChip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  reviewChipActive: {
    backgroundColor: '#008D49',
    borderColor: '#008D49',
  },
  reviewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewChipText: {
    color: '#12382C',
    fontSize: 13,
    fontWeight: '900',
  },
  reviewChipTextActive: {
    color: '#12382C',
  },
  reviewInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#557669',
    borderRadius: 8,
    borderWidth: 1,
    color: '#12382C',
    fontSize: 14,
    minHeight: 82,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  reviewIntro: {
    color: '#557669',
    fontSize: 13,
    lineHeight: 19,
  },
  reviewPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  routeCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  routeTextMain: {
    color: '#557669',
    fontSize: 14,
    lineHeight: 19,
  },
  routeTitle: {
    color: '#12382C',
    fontSize: 18,
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
  safeArea: {
    backgroundColor: '#F6F8F5',
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 141, 73, 0.28)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionTitle: {
    color: '#12382C',
    fontSize: 18,
    fontWeight: '900',
  },
  savedReviewBox: {
    backgroundColor: '#E8F3EF',
    borderColor: '#7A9A7E',
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  savedReviewText: {
    color: '#557669',
    fontSize: 13,
    lineHeight: 19,
  },
  savedReviewTitle: {
    color: '#7A9A7E',
    fontSize: 15,
    fontWeight: '900',
  },
  spark: {
    backgroundColor: '#008D49',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  sparkRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sparkSmall: {
    height: 5,
    marginTop: 2,
    width: 5,
  },
  sideColumn: {
    flexShrink: 0,
    gap: 16,
    width: '100%',
  },
  sideColumnWide: {
    width: 360,
  },
  statusCopy: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  statusHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  statusIcon: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  statusPanel: {
    backgroundColor: '#F1F8F3',
    borderColor: 'rgba(0, 141, 73, 0.28)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  statusText: {
    color: '#557669',
    fontSize: 14,
    lineHeight: 20,
  },
  statusTitle: {
    color: '#008D49',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 27,
  },
  starButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  stepCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  stepDescription: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  stepDot: {
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    height: 24,
    marginTop: 1,
    width: 24,
  },
  stepDotActive: {
    backgroundColor: '#008D49',
  },
  stepDotDone: {
    alignItems: 'center',
    backgroundColor: '#7A9A7E',
    justifyContent: 'center',
  },
  stepRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  steps: {
    gap: 10,
  },
  stepTitle: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  stepTitleActive: {
    color: '#008D49',
  },
  subtitle: {
    color: '#557669',
    fontSize: 14,
    lineHeight: 20,
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
});
