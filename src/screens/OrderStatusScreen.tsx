import { ReactNode, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Check,
  CircleDot,
  Clock3,
  CreditCard,
  Heart,
  MapPinned,
  MessageCircle,
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
  ScrollView,
  StyleSheet,
  Linking,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { orderStatusConfig } from '../data/orderStatus';
import { roleCopy } from '../data/registration';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderStatus'>;

const reviewMoods = ['Спокойно', 'Быстро', 'Аккуратно', 'По-доброму'];
const reviewFacetOptions = ['Подача', 'Чистота', 'Маршрут', 'Общение', 'Безопасность'];

export function OrderStatusScreen({ navigation, route }: Props) {
  const { firstName, order, role } = route.params;
  const config = orderStatusConfig[role];
  const { addFavoriteDriver, addOrderReview, orders, updateOrderStatus } = useAppState();
  const { width } = useWindowDimensions();
  const isWide = width >= 840;
  const initialStepIndex = Math.max(
    config.steps.findIndex((step) => step.id === (order as { status?: string }).status),
    0,
  );
  const [activeStepIndex, setActiveStepIndex] = useState(initialStepIndex);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactResult, setContactResult] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewMood, setReviewMood] = useState(reviewMoods[0]);
  const [reviewFacets, setReviewFacets] = useState<string[]>(['Подача']);
  const [reviewComment, setReviewComment] = useState('');
  const [favoriteAdded, setFavoriteAdded] = useState(false);

  const activeStep = config.steps[activeStepIndex];
  const isCompleted = activeStepIndex === config.steps.length - 1;
  const currentOrder = orders.find((item) => item.id === order.id);
  const driver = currentOrder?.driver ?? {
    id: 'driver-alexey-solaris',
    name: config.participantName,
    vehicle: config.participantMeta,
  };
  const existingReview = currentOrder?.review;
  const progress = useMemo(
    () => Math.round(((activeStepIndex + 1) / config.steps.length) * 100),
    [activeStepIndex, config.steps.length],
  );

  const advance = () => {
    setActiveStepIndex((current) => {
      const nextIndex = Math.min(current + 1, config.steps.length - 1);
      updateOrderStatus(order.id, config.steps[nextIndex].id);
      return nextIndex;
    });
  };

  const chooseContact = async (mode: 'call' | 'chat') => {
    if (mode === 'call') {
      await Linking.openURL(`tel:${config.contactPhone.replace(/\s/g, '')}`);
    }

    setContactResult(
      mode === 'chat'
        ? 'Открыт черновик чата внутри приложения. Сервер сообщений подключим следующим этапом.'
        : `Звонок будет отправлен на номер ${config.contactPhone}.`,
    );
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
            <ArrowLeft color="#146C5D" size={20} strokeWidth={2.4} />
            <Text style={styles.backButtonText}>К заказу</Text>
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
            <Text style={styles.metaLine}>
              {firstName?.trim() || 'Пользователь'} · заказ {order.id}
            </Text>
          </View>
        </View>

        <View style={[styles.layout, isWide && styles.layoutWide]}>
          <View style={styles.mainColumn}>
            <View style={styles.statusPanel}>
              <View style={styles.statusHeader}>
                <View style={styles.statusIcon}>
                  {isCompleted ? (
                    <Check color="#FFFFFF" size={24} strokeWidth={3} />
                  ) : (
                    <CircleDot color="#FFFFFF" size={24} strokeWidth={2.6} />
                  )}
                </View>
                <View style={styles.statusCopy}>
                  <Text style={styles.statusTitle}>
                    {isCompleted ? config.completedTitle : activeStep.title}
                  </Text>
                  <Text style={styles.statusText}>
                    {isCompleted ? config.completedText : activeStep.description}
                  </Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>Прогресс заказа: {progress}%</Text>

              <View style={styles.actionRow}>
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
                    {isCompleted ? 'Статус завершен' : config.primaryAction}
                  </Text>
                </Pressable>
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
              </View>
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
                        {isDone ? <Check color="#FFFFFF" size={14} strokeWidth={3} /> : null}
                      </View>
                      <View style={styles.stepCopy}>
                        <Text style={[styles.stepTitle, isActive && styles.stepTitleActive]}>
                          {step.title}
                        </Text>
                        <Text style={styles.stepDescription}>{step.description}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {isCompleted && role === 'client' ? (
              <View style={styles.reviewPanel}>
                <SectionHeader title="Слепок поездки" />
                <Text style={styles.reviewIntro}>
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
                            color={rating <= reviewRating ? '#F5A524' : '#AEB8C4'}
                            fill={rating <= reviewRating ? '#F5A524' : 'transparent'}
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
                      placeholderTextColor="#8A8F98"
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
                        <Heart color="#146C5D" size={17} strokeWidth={2.4} />
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
              <SectionHeader title="Маршрут" />
              <InfoRow icon={<MapPinned color="#146C5D" size={18} />} label="Подача" value={order.pickup} />
              <InfoRow
                icon={<Route color="#146C5D" size={18} />}
                label="Назначение"
                value={order.destination}
              />
              <InfoRow icon={<Clock3 color="#146C5D" size={18} />} label="Тариф" value={order.tariff} />
            </View>

            <View style={styles.panel}>
              <SectionHeader title={config.participantTitle} />
              <View style={styles.participant}>
                <View style={styles.participantIcon}>
                  <UserRound color="#146C5D" size={22} strokeWidth={2.4} />
                </View>
                <View style={styles.participantCopy}>
                  <Text style={styles.participantName}>{config.participantName}</Text>
                  <Text style={styles.participantMeta}>{config.participantMeta}</Text>
                </View>
              </View>
              <View style={styles.miniActions}>
                <MiniAction
                  icon={<Phone color="#146C5D" size={16} />}
                  label="Связь"
                  onPress={() => {
                    setContactOpen((current) => !current);
                    setContactResult(null);
                  }}
                />
                <MiniAction icon={<ShieldCheck color="#146C5D" size={16} />} label="Безопасность" />
              </View>
              {contactOpen ? (
                <View style={styles.contactPanel}>
                  <Text style={styles.contactTitle}>{config.contactTitle}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => chooseContact('chat')}
                    style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}
                  >
                    <MessageCircle color="#146C5D" size={17} strokeWidth={2.4} />
                    <Text style={styles.contactButtonText}>{config.chatActionLabel}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => chooseContact('call')}
                    style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}
                  >
                    <Phone color="#146C5D" size={17} strokeWidth={2.4} />
                    <Text style={styles.contactButtonText}>{config.callActionLabel}</Text>
                  </Pressable>
                  <Text style={styles.contactPhone}>Мобильный номер: {config.contactPhone}</Text>
                  {contactResult ? <Text style={styles.contactResult}>{contactResult}</Text> : null}
                </View>
              ) : null}
            </View>

            <View style={styles.panel}>
              <SectionHeader title="Оплата и детали" />
              <InfoRow
                icon={<CreditCard color="#146C5D" size={18} />}
                label="Способ"
                value={order.paymentMethod}
              />
              <InfoRow icon={<ReceiptText color="#146C5D" size={18} />} label="Сумма" value={`${order.total} ₽`} />
              <InfoRow
                icon={<ShieldCheck color="#146C5D" size={18} />}
                label="Опции"
                value={order.options.length > 0 ? order.options.join(', ') : 'Без дополнительных опций'}
              />
              <View style={styles.detailList}>
                {config.details.map((detail) => (
                  <View key={detail} style={styles.detailItem}>
                    <Check color="#146C5D" size={15} strokeWidth={3} />
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

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  contactButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#C5DDD7',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  contactButtonText: {
    color: '#146C5D',
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  contactPanel: {
    backgroundColor: '#EEF5F3',
    borderColor: '#C5DDD7',
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    padding: 12,
  },
  contactPhone: {
    color: '#59616C',
    fontSize: 12,
    fontWeight: '800',
  },
  contactResult: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    color: '#20242A',
    fontSize: 12,
    lineHeight: 17,
    padding: 10,
  },
  contactTitle: {
    color: '#0B4C42',
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
    color: '#20242A',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
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
  infoCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  infoIcon: {
    alignItems: 'center',
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  infoLabel: {
    color: '#59616C',
    fontSize: 12,
    fontWeight: '800',
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  infoValue: {
    color: '#20242A',
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
  mainColumn: {
    flex: 1,
    gap: 16,
    minWidth: 0,
  },
  metaLine: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
  miniAction: {
    alignItems: 'center',
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
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
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
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
    gap: 14,
    padding: 16,
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
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  participantMeta: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  participantName: {
    color: '#20242A',
    fontSize: 15,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.76,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#146C5D',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryButtonMuted: {
    backgroundColor: '#89958F',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  progressFill: {
    backgroundColor: '#146C5D',
    borderRadius: 99,
    height: '100%',
  },
  progressText: {
    color: '#59616C',
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    backgroundColor: '#DDE5E2',
    borderRadius: 99,
    height: 9,
    overflow: 'hidden',
  },
  ratingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  reviewChip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  reviewChipActive: {
    backgroundColor: '#146C5D',
    borderColor: '#146C5D',
  },
  reviewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewChipText: {
    color: '#20242A',
    fontSize: 13,
    fontWeight: '900',
  },
  reviewChipTextActive: {
    color: '#FFFFFF',
  },
  reviewInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    color: '#20242A',
    fontSize: 14,
    minHeight: 82,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  reviewIntro: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 19,
  },
  reviewPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C5DDD7',
    borderRadius: 8,
    borderWidth: 1,
    gap: 13,
    padding: 16,
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
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionTitle: {
    color: '#20242A',
    fontSize: 18,
    fontWeight: '900',
  },
  savedReviewBox: {
    backgroundColor: '#EAF6EA',
    borderColor: '#B9DDBB',
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  savedReviewText: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 19,
  },
  savedReviewTitle: {
    color: '#26733E',
    fontSize: 15,
    fontWeight: '900',
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
    backgroundColor: '#146C5D',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  statusPanel: {
    backgroundColor: '#E9F4F1',
    borderColor: '#C5DDD7',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  statusText: {
    color: '#59616C',
    fontSize: 14,
    lineHeight: 20,
  },
  statusTitle: {
    color: '#0B4C42',
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
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  stepDot: {
    backgroundColor: '#DDE5E2',
    borderRadius: 8,
    height: 24,
    marginTop: 1,
    width: 24,
  },
  stepDotActive: {
    backgroundColor: '#146C5D',
  },
  stepDotDone: {
    alignItems: 'center',
    backgroundColor: '#26733E',
    justifyContent: 'center',
  },
  stepRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  steps: {
    gap: 13,
  },
  stepTitle: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  stepTitleActive: {
    color: '#146C5D',
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
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
});
