import { ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Bell,
  BriefcaseBusiness,
  Car,
  CreditCard,
  FileText,
  Headphones,
  Home,
  LucideProps,
  MapPinned,
  Menu as MenuIcon,
  Route,
  ShieldCheck,
  Star,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react-native';

import {
  AccountRole,
  isDriverLikeRole,
  isSelfEmployedDriverRole,
  roleCopy,
} from '../data/registration';
import { KinetixEmptyState, KinetixStatus } from './KinetixUI';
import {
  MenuActionTarget,
  MenuIconName,
  MenuItem,
  QuickAction,
  roleMenuConfig,
} from '../data/menu';
import { SectionPage, SectionRow, sectionPages } from '../data/sectionPages';
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference';
import { styles } from './PostRegistrationMenu.styles';

type PostRegistrationMenuProps = {
  role: AccountRole;
  firstName?: string;
  fleetInviteCode?: string;
  availableCarsCount?: number;
  clientOrderSummary?: ClientOrderSummary;
  driverFeedBusyId?: string;
  driverFeedLockedReason?: string;
  driverFeedOrders?: DriverFeedPreviewOrder[];
  driverStats?: DriverStatsSummary;
  realtimeMessage?: string;
  realtimeStatus?: 'connecting' | 'live' | 'offline' | 'polling';
  realtimeUpdatedAt?: string;
  savedHomeAddressLabel?: string;
  simpleMode?: boolean;
  driverLine?: {
    accessBlockers?: string[];
    canToggle: boolean;
    isOnline: boolean;
    status: string;
  };
  onBackToRegistration: () => void;
  onDeleteAccount: () => void;
  onLogout: () => void;
  onToggleDriverLine?: () => void;
  onToggleSimpleMode?: () => void;
  onOpenOrderFlow: () => void;
  onOrderHome?: () => void;
  onOpenDriverDocuments: () => void;
  onOpenFleetDriverRegistration?: () => void;
  onOpenOrderHistory: () => void;
  onOpenReferral: () => void;
  onOpenSavedPlace: () => void;
  onOpenSubscription: () => void;
  onOpenSupportChat: () => void;
  onAcceptDriverOrder?: (orderId: string) => void | Promise<void>;
};

export type ClientOrderSummary = {
  activeCount: number;
  completedCount: number;
  lastOrderLabel: string;
  lastOrderStatus: string;
  totalCount: number;
  totalSpent: number;
  activeOrder?: {
    id: string;
    routeLabel: string;
    statusLabel: string;
    priceLabel: string;
    driverLabel: string;
  };
};

export type DriverFeedPreviewOrder = {
  id: string;
  address: string;
  badges: string[];
  distanceLabel: string;
  metaLabel: string;
  priceLabel: string;
  serviceLabel?: string;
};

export type DriverStatsSummary = {
  todayOrders: number;
  weekOrders: number;
  monthOrders: number;
  gross: number;
  grossToday: number;
  commissionFreeUntil?: string;
  driverNet: number;
  serviceShare: number;
  serviceShareRate: number;
  serviceShareToday: number;
  settlementStatus: 'confirmed' | 'not_applicable' | 'pending_transfer' | 'reported_transferred';
  subscriptionExpiresAt?: string;
  subscriptionCost: number;
  billingMode: 'monthly' | 'commission';
  trialActive?: boolean;
  trialDaysLeft?: number;
  trialOrdersLeft?: number;
};

const iconMap: Record<MenuIconName, ComponentType<LucideProps>> = {
  bell: Bell,
  briefcase: BriefcaseBusiness,
  car: Car,
  'credit-card': CreditCard,
  file: FileText,
  headphones: Headphones,
  home: Home,
  map: MapPinned,
  route: Route,
  shield: ShieldCheck,
  star: Star,
  users: UsersRound,
  wallet: Wallet,
};

export function PostRegistrationMenu({
  availableCarsCount = 0,
  clientOrderSummary,
  driverFeedBusyId,
  driverFeedLockedReason,
  driverFeedOrders = [],
  driverStats,
  driverLine,
  firstName,
  fleetInviteCode,
  realtimeMessage,
  realtimeStatus = 'connecting',
  realtimeUpdatedAt,
  savedHomeAddressLabel,
  simpleMode = false,
  onBackToRegistration,
  onDeleteAccount,
  onLogout,
  onToggleDriverLine,
  onToggleSimpleMode,
  onOpenOrderHistory,
  onOpenDriverDocuments,
  onOpenFleetDriverRegistration,
  onOpenOrderFlow,
  onOrderHome,
  onOpenReferral,
  onOpenSavedPlace,
  onOpenSubscription,
  onOpenSupportChat,
  onAcceptDriverOrder,
  role,
}: PostRegistrationMenuProps) {
  const { width } = useWindowDimensions();
  const config = roleMenuConfig[role] ?? roleMenuConfig.client;
  const pages = sectionPages[role] ?? sectionPages.client;
  const isWide = width >= 820;
  const isClientRole = role === 'client';
  const isDriverRole = isDriverLikeRole(role);
  const isSelfEmployedDriver = isSelfEmployedDriverRole(role);
  const [activeItemId, setActiveItemId] = useState(config.menuItems[0].id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const reducedMotion = useReducedMotionPreference();
  const pageTransition = useRef(new Animated.Value(1)).current;

  const drawerItems = config.drawerItems ?? [];
  const activeItem = useMemo(
    () =>
      config.menuItems.find((item) => item.id === activeItemId) ??
      drawerItems.find((item) => item.id === activeItemId) ??
      config.menuItems[0],
    [activeItemId, config.menuItems, drawerItems],
  );
  const activePage = useMemo(
    () => pages[activeItem.id] ?? pages[config.menuItems[0].id],
    [activeItem.id, config.menuItems, pages],
  );
  const displayName = firstName?.trim() || 'Пользователь';

  useEffect(() => {
    pageTransition.setValue(0);
    Animated.timing(pageTransition, {
      toValue: 1,
      duration: reducedMotion ? 0 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeItem.id, pageTransition, reducedMotion]);

  const pageAnimatedStyle = {
    opacity: pageTransition,
    transform: [
      {
        translateY: pageTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
      {
        scale: pageTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [0.992, 1],
        }),
      },
    ],
  };

  const handleActionTarget = (target?: MenuActionTarget) => {
    if (target === 'order') {
      onOpenOrderFlow();
      return;
    }

    if (target === 'history') {
      onOpenOrderHistory();
      return;
    }

    if (target === 'documents') {
      onOpenDriverDocuments();
      return;
    }

    if (target === 'fleetDriverInvite') {
      onOpenFleetDriverRegistration?.();
      return;
    }

    if (target === 'subscription') {
      onOpenSubscription();
      return;
    }

    if (target === 'referral') {
      onOpenReferral();
      return;
    }

    if (target === 'homeAddress') {
      onOpenSavedPlace();
      return;
    }

    if (target === 'supportChat') {
      onOpenSupportChat();
      return;
    }

    if (target === 'deleteAccount') {
      onDeleteAccount();
      return;
    }

    if (target === 'registration') {
      onBackToRegistration();
      return;
    }

    if (target === 'logout') {
      onLogout();
    }
  };
  const handleMenuItemPress = (item: MenuItem) => {
    if (item.target) {
      setDrawerOpen(false);
      handleActionTarget(item.target);
      return;
    }

    if (pages[item.id]) {
      setActiveItemId(item.id);
      setDrawerOpen(false);
    }
  };

  return (
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.page} style={styles.scroll}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Открыть меню"
            accessibilityRole="button"
            onPress={() => setDrawerOpen(true)}
            style={({ pressed }) => [styles.menuToggle, pressed && styles.pressed]}
          >
            <MenuIcon color="#008D49" size={24} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.brandCopy}>
            <Text style={styles.appName}>Такси Салават</Text>
            <Text style={styles.appMeta}>
              {roleCopy[role]?.title ?? roleCopy.client.title} · {activePage.title}
            </Text>
            <Text style={styles.liveText}>
              {formatRealtimeStatus(realtimeStatus)}
              {realtimeUpdatedAt ? ` · ${new Date(realtimeUpdatedAt).toLocaleTimeString('ru-RU')}` : ''}
            </Text>
          </View>
        </View>

        {realtimeMessage && !isClientRole ? (
          <View style={styles.livePanel}>
            <View style={[styles.liveDot, realtimeStatus === 'live' && styles.liveDotActive]} />
            <Text style={styles.livePanelText}>{realtimeMessage}</Text>
          </View>
        ) : null}

        <View style={[styles.layout, !isClientRole && isWide && styles.layoutWide]}>
          {!isClientRole ? (
          <View style={[styles.sidebar, isWide && styles.sidebarWide]}>
            <View style={styles.profilePanel}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.hello}>Здравствуйте, {displayName}</Text>
                <Text style={styles.profileStatus}>{config.statusTitle}</Text>
              </View>
            </View>

            {role === 'park_admin' && onOpenFleetDriverRegistration ? (
              <FleetInvitePanel
                inviteCode={fleetInviteCode ?? 'PARK-SALAVAT'}
                onOpenFleetDriverRegistration={onOpenFleetDriverRegistration}
              />
            ) : null}

          </View>
          ) : null}

          <Animated.View style={[styles.main, isClientRole && styles.clientMain, pageAnimatedStyle]}>
            {isClientRole ? (
              <ClientPageView
                activeItemId={activeItem.id}
                availableCarsCount={availableCarsCount}
                displayName={displayName}
                onDeleteAccount={onDeleteAccount}
                onOpenOrderFlow={onOpenOrderFlow}
                onOpenOrderHistory={onOpenOrderHistory}
                onOpenSavedPlace={onOpenSavedPlace}
                onOpenSupportChat={onOpenSupportChat}
                onOrderHome={onOrderHome ?? onOpenSavedPlace}
                orderSummary={clientOrderSummary}
                savedHomeAddressLabel={savedHomeAddressLabel}
              />
            ) : isDriverRole && activeItem.id === 'home' && driverLine ? (
              <DriverHomePage
                appTitle={config.title}
                driverLine={driverLine}
                driverStats={driverStats}
                isSelfEmployedDriver={isSelfEmployedDriver}
                onOpenOrderFlow={onOpenOrderFlow}
                onOpenSubscription={onOpenSubscription}
                onToggleDriverLine={onToggleDriverLine}
              />
            ) : (
              <SectionPageView
                activeItemId={activeItem.id}
                appTitle={config.title}
                driverFeedBusyId={driverFeedBusyId}
                driverFeedLockedReason={driverFeedLockedReason}
                driverFeedOrders={driverFeedOrders}
                driverStats={activeItem.id === 'payouts' ? driverStats : undefined}
                onAcceptDriverOrder={onAcceptDriverOrder}
                onActionTarget={handleActionTarget}
                page={activePage}
              />
            )}
          </Animated.View>
        </View>
      </ScrollView>

      <View style={styles.bottomTabs}>
        {config.menuItems.map((item) => (
          <BottomTabButton
            active={item.id === activeItem.id}
            item={item}
            key={item.id}
            onPress={() => handleMenuItemPress(item)}
          />
        ))}
      </View>

      <SideDrawer
        activeItemId={activeItem.id}
        appTitle={config.title}
        items={drawerItems}
        onClose={() => setDrawerOpen(false)}
        onItemPress={handleMenuItemPress}
        open={drawerOpen}
        roleTitle={roleCopy[role]?.title ?? roleCopy.client.title}
      />
    </View>
  );
}

type ClientPageViewProps = {
  activeItemId: string;
  availableCarsCount: number;
  displayName: string;
  orderSummary?: ClientOrderSummary;
  savedHomeAddressLabel?: string;
  onDeleteAccount: () => void;
  onOpenOrderFlow: () => void;
  onOpenOrderHistory: () => void;
  onOpenSavedPlace: () => void;
  onOpenSupportChat: () => void;
  onOrderHome: () => void;
};

function ClientPageView({
  activeItemId,
  availableCarsCount,
  displayName,
  onDeleteAccount,
  onOpenOrderFlow,
  onOpenOrderHistory,
  onOpenSavedPlace,
  onOpenSupportChat,
  onOrderHome,
  orderSummary,
  savedHomeAddressLabel,
}: ClientPageViewProps) {
  if (activeItemId === 'rides') {
    return (
      <ClientOrdersPage
        onOpenOrderHistory={onOpenOrderHistory}
        orderSummary={orderSummary}
      />
    );
  }

  if (activeItemId === 'about') {
    return <ClientAboutPage onOpenSupportChat={onOpenSupportChat} />;
  }

  if (activeItemId === 'profile' || activeItemId === 'settings') {
    return (
      <ClientAccountPage
        displayName={displayName}
        initialPanel={activeItemId === 'settings' ? 'settings' : 'profile'}
        onDeleteAccount={onDeleteAccount}
        onOpenSavedPlace={onOpenSavedPlace}
        onOpenSupportChat={onOpenSupportChat}
        savedHomeAddressLabel={savedHomeAddressLabel}
      />
    );
  }

  return (
    <ClientHomePage
      availableCarsCount={availableCarsCount}
      displayName={displayName}
      onOpenOrderFlow={onOpenOrderFlow}
      onOpenOrderHistory={onOpenOrderHistory}
      onOpenSupportChat={onOpenSupportChat}
      onOrderHome={onOrderHome}
      orderSummary={orderSummary}
      savedHomeAddressLabel={savedHomeAddressLabel}
    />
  );
}

function ClientHomePage({
  availableCarsCount,
  displayName,
  onOpenOrderFlow,
  onOpenOrderHistory,
  onOpenSupportChat,
  onOrderHome,
  orderSummary,
  savedHomeAddressLabel,
}: {
  availableCarsCount: number;
  displayName: string;
  orderSummary?: ClientOrderSummary;
  savedHomeAddressLabel?: string;
  onOpenOrderFlow: () => void;
  onOpenOrderHistory: () => void;
  onOpenSupportChat: () => void;
  onOrderHome: () => void;
}) {
  return (
    <View style={styles.clientFocusPage}>
      <View style={styles.clientWelcomePanel}>
        <Text style={styles.clientWelcomeTitle}>Здравствуйте, {displayName}</Text>
        <Text numberOfLines={2} style={styles.clientWelcomeText}>
          Закажите поездку, поезжайте домой или напишите поддержке.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onOpenOrderFlow}
        style={({ pressed }) => [styles.clientMainOrderButton, pressed && styles.pressed]}
      >
        <View style={styles.clientMainOrderIcon}>
          <MapPinned color="#F4FAF6" size={28} strokeWidth={2.6} />
        </View>
        <View style={styles.clientMainOrderCopy}>
          <Text style={styles.clientMainOrderTitle}>Заказать такси</Text>
          <Text style={styles.clientMainOrderText}>По адресу</Text>
        </View>
      </Pressable>

      <View style={styles.clientHomeActionRow}>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenOrderHistory}
          style={({ pressed }) => [
            styles.clientHomeActionButton,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.clientDeliveryActionTop}>
            <Route color="#008D49" size={24} strokeWidth={2.5} />
            <Text style={styles.clientDeliveryBadge}>такси</Text>
          </View>
          <Text style={styles.clientHomeActionTitle}>История</Text>
          <Text numberOfLines={2} style={styles.clientHomeActionText}>Последние поездки</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onOrderHome}
          style={({ pressed }) => [styles.clientHomeActionButton, pressed && styles.pressed]}
        >
          <Home color="#008D49" size={24} strokeWidth={2.5} />
          <Text style={styles.clientHomeActionTitle}>Домой</Text>
          <Text numberOfLines={2} style={styles.clientHomeActionText}>
            {savedHomeAddressLabel ? savedHomeAddressLabel : 'Добавить дом'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onOpenSupportChat}
          style={({ pressed }) => [styles.clientHomeActionButton, pressed && styles.pressed]}
        >
          <Headphones color="#008D49" size={24} strokeWidth={2.5} />
          <Text style={styles.clientHomeActionTitle}>Поддержка</Text>
          <Text numberOfLines={2} style={styles.clientHomeActionText}>Чат с оператором</Text>
        </Pressable>
      </View>

      <ClientPremiumTrustRail
        activeOrder={orderSummary?.activeOrder}
        availableCarsCount={availableCarsCount}
      />

      <ClientMapPreview
        activeOrder={orderSummary?.activeOrder}
        availableCarsCount={availableCarsCount}
      />
    </View>
  );
}

function ClientOrdersPage({
  onOpenOrderHistory,
  orderSummary,
}: {
  orderSummary?: ClientOrderSummary;
  onOpenOrderHistory: () => void;
}) {
  const summary = orderSummary ?? {
    activeCount: 0,
    completedCount: 0,
    lastOrderLabel: 'Пока нет поездок',
    lastOrderStatus: 'Пусто',
    totalCount: 0,
    totalSpent: 0,
  };

  return (
    <View style={styles.clientFocusPage}>
      <View style={styles.clientSectionHeader}>
        <Text style={styles.clientSectionTitle}>Заказы</Text>
        <Text numberOfLines={2} style={styles.clientSectionText}>
          Здесь только статистика и история. Новый заказ находится на Главной.
        </Text>
      </View>

      <View style={styles.clientStatsGrid}>
        <ClientStatPill label="Всего" value={String(summary.totalCount)} />
        <ClientStatPill label="Активные" value={String(summary.activeCount)} />
        <ClientStatPill label="Завершено" value={String(summary.completedCount)} />
        <ClientStatPill label="Сумма" value={`${summary.totalSpent} ₽`} />
      </View>

      {summary.activeOrder ? (
        <View style={styles.clientActiveOrderCard}>
          <Text style={styles.clientActiveOrderLabel}>Активный заказ</Text>
          <Text numberOfLines={1} style={styles.clientActiveOrderTitle}>{summary.activeOrder.routeLabel}</Text>
          <Text style={styles.clientActiveOrderText}>
            {summary.activeOrder.statusLabel} · {summary.activeOrder.priceLabel} · {summary.activeOrder.driverLabel}
          </Text>
        </View>
      ) : (
        <KinetixEmptyState
          description="Когда поездка появится, статус будет здесь."
          icon={<MapPinned color="#008D49" size={20} strokeWidth={2.4} />}
          title="Активного заказа нет"
        />
      )}

      <Pressable
        accessibilityRole="button"
        onPress={onOpenOrderHistory}
        style={({ pressed }) => [styles.clientHistoryButton, pressed && styles.pressed]}
      >
        <Route color="#F4FAF6" size={20} strokeWidth={2.5} />
        <Text style={styles.clientHistoryButtonText}>История поездок</Text>
      </Pressable>

      <View style={styles.clientHistoryActions}>
        <ClientHistoryActionChip title="Оставить отзыв" />
        <ClientHistoryActionChip title="Жалоба" />
        <ClientHistoryActionChip title="Повтор маршрута" />
      </View>

      <View style={styles.clientLastOrderBox}>
        <Text style={styles.clientLastOrderTitle}>Последняя поездка</Text>
        <Text numberOfLines={2} style={styles.clientLastOrderText}>{summary.lastOrderLabel}</Text>
        <Text style={styles.clientLastOrderStatus}>{summary.lastOrderStatus}</Text>
      </View>
    </View>
  );
}

function ClientAccountPage({
  displayName,
  initialPanel,
  onDeleteAccount,
  onOpenSavedPlace,
  onOpenSupportChat,
  savedHomeAddressLabel,
}: {
  displayName: string;
  initialPanel: 'settings' | 'profile';
  savedHomeAddressLabel?: string;
  onDeleteAccount: () => void;
  onOpenSavedPlace: () => void;
  onOpenSupportChat: () => void;
}) {
  const [activePanel, setActivePanel] = useState<'settings' | 'profile'>(initialPanel);
  const [doNotCall, setDoNotCall] = useState(false);
  const [shareLocation, setShareLocation] = useState(true);

  useEffect(() => {
    setActivePanel(initialPanel);
  }, [initialPanel]);

  return (
    <View style={styles.clientFocusPage}>
      <View style={styles.clientSectionHeader}>
        <Text style={styles.clientSectionTitle}>Аккаунт</Text>
        <Text numberOfLines={2} style={styles.clientSectionText}>
          Три быстрых входа: поддержка, настройки и профиль.
        </Text>
      </View>

      <View style={styles.accountRoundRow}>
        <ClientAccountRoundButton icon="support" title="Поддержка" onPress={onOpenSupportChat} />
        <ClientAccountRoundButton icon="settings" title="Настройки" onPress={() => setActivePanel('settings')} />
        <ClientAccountRoundButton icon="profile" title="Профиль" onPress={() => setActivePanel('profile')} />
      </View>

      {activePanel === 'settings' ? (
        <View style={styles.accountPanel}>
          <Text style={styles.accountPanelTitle}>Настройки поездки</Text>
          <ClientSettingToggle
            enabled={doNotCall}
            onPress={() => setDoNotCall((current) => !current)}
            text="Попросим водителей не звонить вам без срочной нужды."
            title="Не звонить"
          />
          <ClientSettingToggle
            enabled={shareLocation}
            onPress={() => setShareLocation((current) => !current)}
            text="Водитель будет видеть вас на карте, пока вы не сели в машину."
            title="Показать водителю где я"
          />
        </View>
      ) : (
        <View style={styles.accountPanel}>
          <Text style={styles.accountPanelTitle}>Профиль клиента</Text>
          <View style={styles.accountProfileRow}>
            <Text style={styles.accountProfileLabel}>Имя</Text>
            <Text style={styles.accountProfileValue}>{displayName}</Text>
          </View>
          <View style={styles.accountProfileRow}>
            <Text style={styles.accountProfileLabel}>Дом</Text>
            <Text numberOfLines={1} style={styles.accountProfileValue}>
              {savedHomeAddressLabel ?? 'Не указан'}
            </Text>
          </View>
          <View style={styles.accountProfileActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenSavedPlace}
              style={({ pressed }) => [styles.accountSecondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.accountSecondaryButtonText}>Домашний адрес</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onDeleteAccount}
              style={({ pressed }) => [styles.accountDangerButton, pressed && styles.pressed]}
            >
              <Text style={styles.accountDangerButtonText}>Удалить аккаунт</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function ClientAboutPage({ onOpenSupportChat }: { onOpenSupportChat: () => void }) {
  return (
    <View style={styles.clientFocusPage}>
      <View style={styles.clientSectionHeader}>
        <Text style={styles.clientSectionTitle}>О приложении</Text>
        <Text numberOfLines={3} style={styles.clientSectionText}>
          Kinetix собирает заказ такси, статусы поездки, домашний адрес, историю и поддержку в одном спокойном интерфейсе.
        </Text>
      </View>
      <View style={styles.accountPanel}>
        <Text style={styles.accountPanelTitle}>Что осталось доступно</Text>
        <ClientHistoryActionChip title="Заказ поездки" />
        <ClientHistoryActionChip title="История поездок" />
        <ClientHistoryActionChip title="Рефералы" />
        <ClientHistoryActionChip title="Поддержка" />
        <ClientHistoryActionChip title="Смена роли и выход" />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onOpenSupportChat}
        style={({ pressed }) => [styles.clientHistoryButton, pressed && styles.pressed]}
      >
        <Headphones color="#F4FAF6" size={20} strokeWidth={2.5} />
        <Text style={styles.clientHistoryButtonText}>Поддержка</Text>
      </Pressable>
    </View>
  );
}

function ClientAccountRoundButton({
  icon,
  onPress,
  title,
}: {
  icon: 'profile' | 'settings' | 'support';
  title: string;
  onPress: () => void;
}) {
  const Icon = icon === 'support' ? Headphones : icon === 'settings' ? ShieldCheck : UsersRound;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.accountRoundButton, pressed && styles.pressed]}
    >
      <View style={styles.accountRoundIcon}>
        <Icon color="#008D49" size={24} strokeWidth={2.5} />
      </View>
      <Text numberOfLines={1} style={styles.accountRoundText}>{title}</Text>
    </Pressable>
  );
}

function ClientSettingToggle({
  enabled,
  onPress,
  text,
  title,
}: {
  enabled: boolean;
  text: string;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onPress={onPress}
      style={({ pressed }) => [styles.clientSettingRow, pressed && styles.pressed]}
    >
      <View style={[styles.clientSettingSwitch, enabled && styles.clientSettingSwitchOn]}>
        <View style={[styles.clientSettingKnob, enabled && styles.clientSettingKnobOn]} />
      </View>
      <View style={styles.clientSettingCopy}>
        <Text style={styles.clientSettingTitle}>{title}</Text>
        <Text numberOfLines={2} style={styles.clientSettingText}>{text}</Text>
      </View>
    </Pressable>
  );
}

function ClientPremiumTrustRail({
  activeOrder,
  availableCarsCount,
}: {
  activeOrder?: NonNullable<ClientOrderSummary['activeOrder']>;
  availableCarsCount: number;
}) {
  const items = [
    {
      title: 'Цена заранее',
      text: activeOrder?.priceLabel ?? 'До оформления',
    },
    {
      title: 'Статус и PIN',
      text: activeOrder?.statusLabel ?? 'Включим в заказ',
    },
    {
      title: 'Номер скрыт',
      text: 'Связь в приложении',
    },
    {
      title: 'Машины рядом',
      text: String(availableCarsCount),
      live: true,
    },
  ];

  return (
    <View style={styles.clientTrustRail}>
      {items.map((item) => (
        <View key={item.title} style={styles.clientTrustChip}>
          <View style={[styles.clientTrustDot, item.live && styles.clientTrustDotLive]} />
          <View style={styles.clientTrustCopy}>
            <Text numberOfLines={1} style={styles.clientTrustTitle}>{item.title}</Text>
            <Text numberOfLines={1} style={styles.clientTrustText}>{item.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ClientMapPreview({
  activeOrder,
  availableCarsCount,
}: {
  activeOrder?: NonNullable<ClientOrderSummary['activeOrder']>;
  availableCarsCount: number;
}) {
  const reducedMotion = useReducedMotionPreference();
  const mapMotion = useRef(new Animated.Value(0)).current;
  const routeLabel = activeOrder?.routeLabel ?? 'Маршрут появится после заказа';
  const title = activeOrder ? 'Водитель на карте' : 'Карта подачи';
  const meta = activeOrder
    ? `Машина зеленая · ${availableCarsCount} на линии`
    : `${availableCarsCount} ${formatCarsWord(availableCarsCount)} рядом · выберите адрес`;

  useEffect(() => {
    if (reducedMotion) {
      mapMotion.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(mapMotion, {
        duration: 2200,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    );

    animation.start();

    return () => animation.stop();
  }, [mapMotion, reducedMotion]);

  const pulseScale = mapMotion.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 2.25],
  });
  const pulseOpacity = mapMotion.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [0.32, 0.14, 0],
  });
  const carTranslateX = mapMotion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-8, 6, -8],
  });
  const carTranslateY = mapMotion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [3, -4, 3],
  });
  const routeOpacity = mapMotion.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.54, 1, 0.78],
  });

  return (
    <View style={styles.clientMapPanel}>
      <View style={styles.clientMapCanvas}>
        <View style={styles.clientMapGlow} />
        <View style={styles.clientMapDistrictOne} />
        <View style={styles.clientMapDistrictTwo} />
        <View style={[styles.clientMapRoad, styles.clientMapRoadOne]} />
        <View style={[styles.clientMapRoad, styles.clientMapRoadTwo]} />
        <View style={[styles.clientMapRoad, styles.clientMapRoadThree]} />
        <Animated.View style={[styles.clientMapRouteLine, { opacity: routeOpacity }]} />
        <View style={styles.clientPassengerDot}>
          <Animated.View
            style={[
              styles.clientPassengerPulseOuter,
              {
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />
          <View style={styles.clientPassengerPulse} />
        </View>
        <Animated.View
          style={[
            styles.clientCarMarker,
            { transform: [{ translateX: carTranslateX }, { translateY: carTranslateY }] },
          ]}
        >
          <Car color="#F4FAF6" size={20} strokeWidth={2.6} />
        </Animated.View>
        <View style={styles.clientMapStatusPill}>
          <Text style={styles.clientMapStatusText}>{activeOrder ? 'Live' : 'Готово'}</Text>
        </View>
      </View>
      <View style={styles.clientMapCopy}>
        <Text style={styles.clientMapTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.clientMapText}>{routeLabel}</Text>
        <Text style={styles.clientMapMeta}>{meta}</Text>
      </View>
    </View>
  );
}

function ClientStatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.clientStatPill}>
      <Text style={styles.clientStatValue}>{value}</Text>
      <Text numberOfLines={1} style={styles.clientStatLabel}>{label}</Text>
    </View>
  );
}

function ClientHistoryActionChip({ title }: { title: string }) {
  return (
    <View style={styles.clientHistoryChip}>
      <Text numberOfLines={1} style={styles.clientHistoryChipText}>{title}</Text>
    </View>
  );
}

type ClientCommandCenterProps = {
  availableCarsCount: number;
  simpleMode: boolean;
  onOpenOrderFlow: () => void;
  onToggleSimpleMode?: () => void;
};

function ClientCommandCenter({
  availableCarsCount,
  onOpenOrderFlow,
  onToggleSimpleMode,
  simpleMode,
}: ClientCommandCenterProps) {
  const carsStatus =
    availableCarsCount === 0
      ? 'водителей рядом пока нет'
      : availableCarsCount <= 2
        ? 'машин мало'
        : 'машины на линии';

  return (
    <View style={styles.commandPanel}>
      <View style={styles.commandHeader}>
        <View style={styles.commandIconPrimary}>
          <MapPinned color="#12382C" size={30} strokeWidth={2.5} />
        </View>
        <View style={styles.commandCopy}>
          <Text style={styles.commandEyebrow}>Главная</Text>
          <Text style={styles.commandTitle}>Куда едем?</Text>
          <Text style={styles.commandText}>Заказ, цена и водитель - в одном спокойном экране.</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onOpenOrderFlow}
        style={({ pressed }) => [styles.commandPrimaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.commandPrimaryButtonText}>Заказать поездку</Text>
        <Route color="#F4FAF6" size={19} strokeWidth={2.4} />
      </Pressable>

      <View style={styles.commandMetaStrip}>
        <View style={styles.commandMetaItem}>
          <Text style={styles.commandMetaValue}>{availableCarsCount}</Text>
          <Text numberOfLines={2} style={styles.commandMetaLabel}>{carsStatus}</Text>
        </View>
        <View style={styles.commandMetaDivider} />
        <View style={styles.commandMetaItem}>
          <Text style={styles.commandMetaValue}>Дом</Text>
          <Text numberOfLines={2} style={styles.commandMetaLabel}>быстрый адрес</Text>
        </View>
        <View style={styles.commandMetaDivider} />
        <View style={styles.commandMetaItem}>
          <Text style={styles.commandMetaValue}>Работа</Text>
          <Text numberOfLines={2} style={styles.commandMetaLabel}>частый маршрут</Text>
        </View>
      </View>

      <View style={styles.routePreview}>
        <View style={styles.routePreviewRail}>
          <View style={styles.routePreviewDot} />
          <View style={styles.routePreviewLine} />
          <View style={[styles.routePreviewDot, styles.routePreviewDotEnd]} />
        </View>
        <View style={styles.routePreviewCopy}>
          <Text style={styles.routePreviewTitle}>Водитель, ETA и оплата будут тут</Text>
          <Text style={styles.routePreviewText}>После заказа экран покажет только главное: кто едет, сколько ждать, что дальше.</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: simpleMode }}
        disabled={!onToggleSimpleMode}
        onPress={() => onToggleSimpleMode?.()}
        style={({ pressed }) => [styles.commandSwitchRow, pressed && styles.pressed]}
      >
        <View style={[styles.simpleModeSwitch, simpleMode && styles.simpleModeSwitchActive]}>
          <View style={[styles.simpleModeKnob, simpleMode && styles.simpleModeKnobActive]} />
        </View>
        <View style={styles.commandSwitchCopy}>
          <Text style={styles.commandSwitchTitle}>Простой режим</Text>
          <Text style={styles.commandSwitchText}>Меньше подписей. Больше контроля.</Text>
        </View>
      </Pressable>
    </View>
  );
}

type DriverCommandCenterProps = {
  driverLine: NonNullable<PostRegistrationMenuProps['driverLine']>;
  driverStats?: DriverStatsSummary;
  isSelfEmployedDriver: boolean;
  onOpenOrderFlow: () => void;
  onOpenSubscription: () => void;
  onToggleDriverLine?: () => void;
};

function DriverHomePage({
  appTitle,
  driverLine,
  driverStats,
  isSelfEmployedDriver,
  onOpenOrderFlow,
  onOpenSubscription,
  onToggleDriverLine,
}: DriverCommandCenterProps & { appTitle: string }) {
  return (
    <>
      <View style={styles.routeRow}>
        <Text style={styles.routeText}>{appTitle}</Text>
        <Text style={styles.routeDivider}>/</Text>
        <Text style={styles.routeTextActive}>Главная</Text>
      </View>
      <DriverCommandCenter
        driverLine={driverLine}
        driverStats={driverStats}
        isSelfEmployedDriver={isSelfEmployedDriver}
        onOpenOrderFlow={onOpenOrderFlow}
        onOpenSubscription={onOpenSubscription}
        onToggleDriverLine={onToggleDriverLine}
      />
    </>
  );
}

function DriverCommandCenter({
  driverLine,
  driverStats,
  isSelfEmployedDriver,
  onOpenOrderFlow,
  onOpenSubscription,
  onToggleDriverLine,
}: DriverCommandCenterProps) {
  const lineLabel = driverLine.isOnline ? 'На линии' : 'Не на линии';
  const lineHint = driverLine.canToggle
    ? driverLine.isOnline
      ? 'Нажмите, чтобы завершить смену'
      : 'Нажмите, чтобы начать смену'
    : `Доступ: ${driverLine.status}`;
  const blockers = formatDriverBlockers(driverLine.accessBlockers ?? []);
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <View style={[styles.commandPanel, driverLine.isOnline && styles.commandPanelOnline]}>
      <View style={styles.commandHeader}>
        <View style={[styles.commandIconPrimary, driverLine.isOnline && styles.commandIconOnline]}>
          <Car color={driverLine.isOnline ? '#008D49' : '#12382C'} size={30} strokeWidth={2.5} />
        </View>
        <View style={styles.commandCopy}>
          <Text style={styles.commandEyebrow}>{isSelfEmployedDriver ? 'Смена и расчеты' : 'Смена водителя'}</Text>
          <Text style={styles.commandTitle}>{lineLabel}</Text>
          <Text style={styles.commandText}>{lineHint}</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!driverLine.canToggle}
        onPress={onToggleDriverLine}
        style={({ pressed }) => [
          styles.commandPrimaryButton,
          driverLine.isOnline && styles.commandPrimaryButtonOnline,
          !driverLine.canToggle && styles.commandPrimaryButtonDisabled,
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.commandPrimaryButtonText,
            driverLine.isOnline && styles.commandPrimaryButtonTextOnline,
          ]}
        >
          {driverLine.isOnline ? 'Завершить смену' : 'Выйти на линию'}
        </Text>
        <Route
          color={driverLine.isOnline ? '#008D49' : '#F4FAF6'}
          size={19}
          strokeWidth={2.4}
        />
      </Pressable>

      <DriverLineVisual online={driverLine.isOnline} stats={driverStats} />

      <View style={styles.commandMetaStrip}>
        <View style={styles.commandMetaItem}>
          <Text style={styles.commandMetaValue}>{driverStats?.todayOrders ?? 0}</Text>
          <Text numberOfLines={2} style={styles.commandMetaLabel}>заказов сегодня</Text>
        </View>
        <View style={styles.commandMetaDivider} />
        <View style={styles.commandMetaItem}>
          <Text style={styles.commandMetaValue}>{driverStats?.grossToday ?? 0} ₽</Text>
          <Text numberOfLines={2} style={styles.commandMetaLabel}>собрано водителем</Text>
        </View>
        <View style={styles.commandMetaDivider} />
        <View style={styles.commandMetaItem}>
          <Text style={styles.commandMetaValue}>{driverStats?.serviceShareToday ?? 0} ₽</Text>
          <Text numberOfLines={2} style={styles.commandMetaLabel}>к сверке</Text>
        </View>
      </View>

      <View style={styles.driverAccessStrip}>
        <View style={styles.driverAccessIcon}>
          <ShieldCheck color="#008D49" size={18} strokeWidth={2.4} />
        </View>
        <View style={styles.driverAccessCopy}>
          <Text style={styles.driverAccessTitle}>
            {driverLine.canToggle ? 'Допуск готов' : 'Нужны действия'}
          </Text>
          <Text numberOfLines={2} style={styles.driverAccessText}>
            {driverLine.canToggle
              ? 'Проверка завершена, можно принимать заказы.'
              : `Не закрыто: ${blockers}`}
          </Text>
        </View>
      </View>

      <View style={styles.commandSecondaryRow}>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenOrderFlow}
          style={({ pressed }) => [styles.commandSecondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.commandSecondaryButtonText}>Лента заказов</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenSubscription}
          style={({ pressed }) => [styles.commandSecondaryButton, pressed && styles.pressed]}
        >
          <Wallet color="#008D49" size={17} strokeWidth={2.4} />
          <Text style={styles.commandSecondaryButtonText}>Расчитаться</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: statsOpen }}
          onPress={() => setStatsOpen((current) => !current)}
          style={({ pressed }) => [
            styles.commandSecondaryButton,
            statsOpen && styles.commandSecondaryButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.commandSecondaryButtonText, statsOpen && styles.commandSecondaryButtonTextActive]}>
            Статистика
          </Text>
        </Pressable>
      </View>

      {statsOpen && driverStats ? <DriverStatsPanel stats={driverStats} /> : null}

      {driverStats?.trialActive ? (
        <Text style={styles.commandFootnote}>
          Тестовый период: {driverStats.trialDaysLeft} дн. · {driverStats.trialOrdersLeft} бесплатных заказов
        </Text>
      ) : null}
    </View>
  );
}

function DriverLineVisual({
  online,
  stats,
}: {
  online: boolean;
  stats?: DriverStatsSummary;
}) {
  return (
    <View style={[styles.driverLineVisual, online && styles.driverLineVisualOnline]}>
      <View style={styles.driverLineMapLayer}>
        <View style={[styles.driverLineRoad, styles.driverLineRoadOne]} />
        <View style={[styles.driverLineRoad, styles.driverLineRoadTwo]} />
        <View style={styles.driverLineRoute} />
        <View style={styles.driverLineStartDot} />
        <View style={styles.driverLineFinishDot} />
        <View style={styles.driverLineCar}>
          <Car color="#F4FAF6" size={20} strokeWidth={2.6} />
        </View>
      </View>
      <View style={styles.driverLineVisualCopy}>
        <Text style={styles.driverLineVisualTitle}>{online ? 'Линия активна' : 'Готов к смене'}</Text>
        <Text numberOfLines={1} style={styles.driverLineVisualText}>
          {online ? 'Заказы рядом появятся в ленте' : 'Нажмите кнопку и принимайте поездки'}
        </Text>
      </View>
      <View style={styles.driverLineMiniStats}>
        <View style={styles.driverLineMiniStat}>
          <Text style={styles.driverLineMiniValue}>{stats?.todayOrders ?? 0}</Text>
          <Text style={styles.driverLineMiniLabel}>заказы</Text>
        </View>
        <View style={styles.driverLineMiniStat}>
          <Text style={styles.driverLineMiniValue}>{stats?.serviceShareToday ?? 0} ₽</Text>
          <Text style={styles.driverLineMiniLabel}>к оплате</Text>
        </View>
      </View>
    </View>
  );
}

type MenuButtonProps = {
  item: MenuItem;
  active: boolean;
  compact?: boolean;
  onPress: () => void;
};

function MenuButton({ active, compact = false, item, onPress }: MenuButtonProps) {
  const Icon = iconMap[item.icon];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuButton,
        compact && styles.menuButtonCompact,
        active && styles.menuButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.menuIconWrap, compact && styles.menuIconWrapCompact, active && styles.menuIconWrapActive]}>
        <Icon color={active ? '#F4FAF6' : '#008D49'} size={19} strokeWidth={2.3} />
      </View>
      <View style={styles.menuCopy}>
        <View style={styles.menuTitleRow}>
          <Text numberOfLines={compact ? 2 : 1} style={[styles.menuTitle, active && styles.menuTitleActive]}>
            {item.title}
          </Text>
          {item.badge ? <Text style={styles.badge}>{item.badge}</Text> : null}
        </View>
        {compact ? null : <Text numberOfLines={1} style={styles.menuSubtitle}>{item.subtitle}</Text>}
      </View>
    </Pressable>
  );
}

type BottomTabButtonProps = {
  item: MenuItem;
  active: boolean;
  onPress: () => void;
};

function BottomTabButton({ active, item, onPress }: BottomTabButtonProps) {
  const Icon = iconMap[item.icon];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.bottomTab, active && styles.bottomTabActive, pressed && styles.pressed]}
    >
      <View style={[styles.bottomTabIndicator, active && styles.bottomTabIndicatorActive]} />
      <View style={[styles.bottomTabIcon, active && styles.bottomTabIconActive]}>
        <Icon color={active ? '#F4FAF6' : '#008D49'} size={20} strokeWidth={2.4} />
      </View>
      <Text numberOfLines={1} style={[styles.bottomTabText, active && styles.bottomTabTextActive]}>
        {item.title}
      </Text>
    </Pressable>
  );
}

type SideDrawerProps = {
  activeItemId: string;
  appTitle: string;
  items: MenuItem[];
  onClose: () => void;
  onItemPress: (item: MenuItem) => void;
  open: boolean;
  roleTitle: string;
};

function SideDrawer({
  activeItemId,
  appTitle,
  items,
  onClose,
  onItemPress,
  open,
  roleTitle,
}: SideDrawerProps) {
  const reducedMotion = useReducedMotionPreference();
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reducedMotion ? 0 : 260,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, progress, reducedMotion]);

  const panelAnimatedStyle = {
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-330, 0],
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.72, 1],
    }),
  };
  const scrimAnimatedStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
  };

  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.drawerRoot}>
        <Animated.View style={[styles.drawerPanel, panelAnimatedStyle]}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerTitleCopy}>
              <Text style={styles.drawerTitle}>{appTitle}</Text>
              <Text style={styles.drawerSubtitle}>{roleTitle}</Text>
            </View>
            <Pressable
              accessibilityLabel="Закрыть меню"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.drawerClose, pressed && styles.pressed]}
            >
              <X color="#008D49" size={22} strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.drawerList} showsVerticalScrollIndicator={false}>
            {items.map((item) => {
              const active = item.id === activeItemId;

              return (
                <DrawerMenuItem
                  active={active}
                  item={item}
                  key={item.id}
                  onPress={() => onItemPress(item)}
                />
              );
            })}
          </ScrollView>
        </Animated.View>
        <Animated.View style={[styles.drawerScrim, scrimAnimatedStyle]}>
          <Pressable accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFillObject} />
        </Animated.View>
      </View>
    </Modal>
  );
}

type DrawerMenuItemProps = {
  active: boolean;
  item: MenuItem;
  onPress: () => void;
};

function DrawerMenuItem({ active, item, onPress }: DrawerMenuItemProps) {
  const Icon = iconMap[item.icon];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.drawerItem, active && styles.drawerItemActive, pressed && styles.pressed]}
    >
      <View style={[styles.drawerIconWrap, active && styles.drawerIconWrapActive]}>
        <Icon color={active ? '#F4FAF6' : '#008D49'} size={19} strokeWidth={2.4} />
      </View>
      <View style={styles.drawerItemCopy}>
        <Text numberOfLines={1} style={[styles.drawerItemTitle, active && styles.drawerItemTitleActive]}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={styles.drawerItemSubtitle}>{item.subtitle}</Text>
      </View>
    </Pressable>
  );
}

type QuickActionCardProps = {
  action: QuickAction;
  onActionTarget: (target?: MenuActionTarget) => void;
};

function QuickActionCard({ action, onActionTarget }: QuickActionCardProps) {
  const Icon = iconMap[action.icon];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onActionTarget(action.target)}
      style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
    >
      <View style={styles.quickIconWrap}>
        <Icon color="#008D49" size={21} strokeWidth={2.3} />
      </View>
      <Text numberOfLines={2} style={styles.quickTitle}>{action.title}</Text>
      <Text numberOfLines={2} style={styles.quickSubtitle}>{action.subtitle}</Text>
    </Pressable>
  );
}

type SectionPageViewProps = {
  activeItemId: string;
  appTitle: string;
  driverFeedBusyId?: string;
  driverFeedLockedReason?: string;
  driverFeedOrders?: DriverFeedPreviewOrder[];
  driverStats?: DriverStatsSummary;
  onAcceptDriverOrder?: (orderId: string) => void | Promise<void>;
  onActionTarget: (target?: MenuActionTarget) => void;
  page: SectionPage;
};

function SectionPageView({
  activeItemId,
  appTitle,
  driverFeedBusyId,
  driverFeedLockedReason,
  driverFeedOrders = [],
  driverStats,
  onAcceptDriverOrder,
  onActionTarget,
  page,
}: SectionPageViewProps) {
  const Icon = iconMap[page.icon];
  const showDriverFeed = activeItemId === 'orders' && Boolean(onAcceptDriverOrder);

  if (showDriverFeed) {
    return (
      <>
        <View style={styles.routeRow}>
          <Text style={styles.routeText}>{appTitle}</Text>
          <Text style={styles.routeDivider}>/</Text>
          <Text style={styles.routeTextActive}>Лента заказов</Text>
        </View>

        <DriverFeedPreview
          busyId={driverFeedBusyId}
          lockedReason={driverFeedLockedReason}
          onAcceptOrder={onAcceptDriverOrder}
          onOpenFullFeed={() => onActionTarget('order')}
          orders={driverFeedOrders}
        />
      </>
    );
  }

  return (
    <>
      <View style={styles.routeRow}>
        <Text style={styles.routeText}>{appTitle}</Text>
        <Text style={styles.routeDivider}>/</Text>
        <Text style={styles.routeTextActive}>{page.title}</Text>
      </View>

      <View style={styles.heroPanel}>
        <View style={styles.heroIcon}>
          <Icon color="#008D49" size={28} strokeWidth={2.4} />
        </View>
        <View style={styles.heroCopy}>
          <Text numberOfLines={2} style={styles.heroTitle}>{page.title}</Text>
          <Text numberOfLines={3} style={styles.heroText}>{page.subtitle}</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        {page.metrics.map((metric) => (
          <View key={metric.label} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricHelper}>{metric.helper}</Text>
          </View>
        ))}
      </View>

      {driverStats ? <DriverStatsPanel stats={driverStats} /> : null}

      <View style={styles.statusPanel}>
        <Text style={styles.statusTitle}>{page.statusTitle}</Text>
        <Text numberOfLines={3} style={styles.statusText}>{page.statusText}</Text>
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onActionTarget(page.primaryTarget)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>{page.primaryAction}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onActionTarget(page.secondaryTarget)}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>{page.secondaryAction}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.contentPanel}>
        <Text style={styles.panelTitle}>Быстрые действия</Text>
        <Text numberOfLines={1} style={styles.panelSubtitle}>Основные операции этого раздела.</Text>
        <View style={styles.quickGrid}>
          {page.quickActions.map((action) => (
            <QuickActionCard action={action} key={action.id} onActionTarget={onActionTarget} />
          ))}
        </View>
      </View>

      <View style={styles.contentPanel}>
        <Text style={styles.panelTitle}>{page.listTitle}</Text>
        <View style={styles.sectionRows}>
          {page.rows.map((row) => (
            <SectionDataRow key={row.id} row={row} />
          ))}
        </View>
      </View>

      <View style={styles.notePanel}>
        <ShieldCheck color="#008D49" size={18} strokeWidth={2.4} />
        <Text style={styles.noteText}>{page.note}</Text>
      </View>
    </>
  );
}

function FleetInvitePanel({
  inviteCode,
  onOpenFleetDriverRegistration,
}: {
  inviteCode: string;
  onOpenFleetDriverRegistration: () => void;
}) {
  return (
    <View style={styles.fleetInvitePanel}>
      <View style={styles.fleetInviteHeader}>
        <View style={styles.fleetInviteIcon}>
          <UsersRound color="#008D49" size={21} strokeWidth={2.4} />
        </View>
        <View style={styles.fleetInviteCopy}>
          <Text style={styles.fleetInviteTitle}>Подключить водителя</Text>
          <Text style={styles.fleetInviteText}>Откройте анкету, водитель заполнит ее как сотрудник вашего парка.</Text>
        </View>
      </View>
      <View style={styles.fleetInviteCodeBox}>
        <Text style={styles.fleetInviteCodeLabel}>Код парка</Text>
        <Text selectable style={styles.fleetInviteCodeValue}>{inviteCode}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onOpenFleetDriverRegistration}
        style={({ pressed }) => [styles.fleetInviteButton, pressed && styles.pressed]}
      >
        <Text style={styles.fleetInviteButtonText}>Добавить водителя таксопарка</Text>
      </Pressable>
    </View>
  );
}

function DriverFeedPreview({
  busyId,
  lockedReason,
  onAcceptOrder,
  onOpenFullFeed,
  orders,
}: {
  busyId?: string;
  lockedReason?: string;
  onAcceptOrder?: (orderId: string) => void | Promise<void>;
  onOpenFullFeed: () => void;
  orders: DriverFeedPreviewOrder[];
}) {
  const [detailsOrderId, setDetailsOrderId] = useState<string | undefined>();
  const visibleOrders = useMemo(() => orders.slice(0, 5), [orders]);
  const disabled = Boolean(lockedReason || busyId);
  const toggleDetailsOrder = useCallback((orderId: string) => {
    setDetailsOrderId((current) => (current === orderId ? undefined : orderId));
  }, []);

  return (
    <View style={styles.driverFeedPanel}>
      <View style={styles.driverFeedHeader}>
        <View>
          <Text style={styles.driverFeedTitle}>Лента заказов</Text>
          <Text numberOfLines={1} style={styles.driverFeedSubtitle}>
            Расстояние, адрес, цена
          </Text>
        </View>
        <Text style={styles.driverFeedCount}>{orders.length}</Text>
      </View>

      <View style={styles.driverFeedSignalRow}>
        <Text style={styles.driverFeedSignal}>Такси + доставка</Text>
        <Text style={styles.driverFeedSignal}>i = детали</Text>
        <Text style={styles.driverFeedSignal}>1 тап принять</Text>
      </View>

      {lockedReason ? (
        <View style={styles.driverFeedNotice}>
          <KinetixStatus label={`Доступ: ${lockedReason}`} tone="warning" />
        </View>
      ) : null}

      {visibleOrders.length ? (
        <View style={styles.driverFeedList}>
          {visibleOrders.map((order) => {
            const detailsOpen = detailsOrderId === order.id;

            return (
              <View key={order.id} style={styles.driverFeedCard}>
                <View style={styles.driverFeedCardRow}>
                  <View style={styles.driverFeedRouteMark}>
                    <View style={styles.driverFeedRouteDot} />
                    <View style={styles.driverFeedRouteLine} />
                  </View>
                  <Text numberOfLines={1} style={styles.driverFeedService}>{order.serviceLabel ?? 'Такси'}</Text>
                  <Text numberOfLines={1} style={styles.driverFeedDistance}>{order.distanceLabel}</Text>
                  <Text numberOfLines={1} style={styles.driverFeedAddress}>{order.address}</Text>
                  <Text numberOfLines={1} style={styles.driverFeedPrice}>{order.priceLabel}</Text>
                  <Pressable
                    accessibilityLabel="Информация о заказе"
                    accessibilityRole="button"
                    onPress={() => toggleDetailsOrder(order.id)}
                    style={({ pressed }) => [styles.driverFeedInfoButton, detailsOpen && styles.driverFeedInfoButtonActive, pressed && styles.pressed]}
                  >
                    <Text style={[styles.driverFeedInfoText, detailsOpen && styles.driverFeedInfoTextActive]}>i</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={disabled}
                    onPress={() => onAcceptOrder?.(order.id)}
                    style={({ pressed }) => [
                      styles.driverFeedAcceptButton,
                      disabled && styles.disabledButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.driverFeedAcceptText}>
                      {busyId === order.id ? '...' : 'Принять'}
                    </Text>
                  </Pressable>
                </View>
                {busyId === order.id ? <View style={styles.driverFeedAcceptProgress} /> : null}
                {detailsOpen ? (
                  <View style={styles.driverFeedDetails}>
                    <Text numberOfLines={1} style={styles.driverFeedMeta}>{order.metaLabel}</Text>
                    <View style={styles.driverFeedBadges}>
                      {order.badges.slice(0, 4).map((badge) => (
                        <Text key={badge} style={styles.driverFeedBadge}>{badge}</Text>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <KinetixEmptyState
          description="Как только клиент создаст поездку, здесь появится короткая карточка."
          icon={<Route color="#008D49" size={20} strokeWidth={2.4} />}
          title="Заказов рядом нет"
        />
      )}

      <Pressable
        accessibilityRole="button"
        onPress={onOpenFullFeed}
        style={({ pressed }) => [styles.driverFeedFullButton, pressed && styles.pressed]}
      >
        <Text style={styles.driverFeedFullButtonText}>Открыть полный экран</Text>
      </Pressable>
    </View>
  );
}

function DriverStatsCard({ stats }: { stats: DriverStatsSummary }) {
  return (
    <View style={styles.driverStatsCard}>
      <Text style={styles.driverStatsTitle}>Сегодня</Text>
      <View style={styles.driverStatsRows}>
        <MiniStat label="Заказы" value={String(stats.todayOrders)} />
        <MiniStat label="Заработано" value={`${stats.grossToday} ₽`} />
        <MiniStat label="К оплате" value={`${stats.serviceShareToday} ₽`} />
      </View>
      <Text style={styles.driverStatsHint}>
        Комиссия: {stats.serviceShareRate}% · {formatSettlementStatus(stats.settlementStatus)}
      </Text>
      {stats.trialActive ? (
        <Text style={styles.driverStatsHint}>
          Тестовый период: {stats.trialDaysLeft} дн. · {stats.trialOrdersLeft} бесплатных заказов
        </Text>
      ) : null}
      {stats.billingMode === 'monthly' && stats.subscriptionExpiresAt ? (
        <Text style={styles.driverStatsHint}>Партнёр PRO активен до {formatDate(stats.subscriptionExpiresAt)}</Text>
      ) : null}
    </View>
  );
}

function DriverStatsPanel({ stats }: { stats: DriverStatsSummary }) {
  return (
    <View style={styles.financePanel}>
      <Text style={styles.panelTitle}>Статистика</Text>
      <Text style={styles.panelSubtitle}>
        День, неделя и месяц в одном коротком блоке. Расчеты 7% / 5% / 3% сохранены.
      </Text>
      <View style={styles.metricsGrid}>
        <MiniMetric label="День" value={`${stats.grossToday} ₽`} />
        <MiniMetric label="Заказы сегодня" value={String(stats.todayOrders)} />
        <MiniMetric label="К оплате" value={`${stats.serviceShareToday} ₽`} />
        <MiniMetric label="Неделя" value={`${stats.weekOrders} заказов`} />
        <MiniMetric label="Месяц" value={`${stats.monthOrders} заказов`} />
        <MiniMetric label="Статус" value={formatSettlementStatus(stats.settlementStatus)} />
      </View>
      <Text style={styles.panelSubtitle}>
        Чем больше заказов за день — тем ниже комиссия: после 15 заказов 5%, после 20 заказов 3%.
      </Text>
    </View>
  );
}

function formatSettlementStatus(status: DriverStatsSummary['settlementStatus']) {
  const labels: Record<DriverStatsSummary['settlementStatus'], string> = {
    confirmed: 'оплачен',
    not_applicable: 'не начисляется',
    pending_transfer: 'не оплачен',
    reported_transferred: 'ожидает проверки',
  };

  return labels[status];
}

function formatCarsWord(count: number) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return 'машина';
  }

  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return 'машины';
  }

  return 'машин';
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
    </View>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

type SectionDataRowProps = {
  row: SectionRow;
};

function SectionDataRow({ row }: SectionDataRowProps) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionRowCopy}>
        <Text numberOfLines={1} style={styles.sectionRowTitle}>{row.title}</Text>
        <Text numberOfLines={2} style={styles.sectionRowSubtitle}>{row.subtitle}</Text>
      </View>
      <View style={styles.sectionRowMeta}>
        <Text numberOfLines={1} style={styles.sectionRowValue}>{row.value}</Text>
        <Text numberOfLines={1} style={styles.sectionRowStatus}>{row.status}</Text>
      </View>
    </View>
  );
}

function formatDriverBlockers(blockers: string[]) {
  if (!blockers.length) {
    return 'проверка допуска';
  }

  const labels: Record<string, string> = {
    contract: 'договор',
    documents: 'документы',
    driver_review: 'проверка анкеты',
    paid_access: 'доступ к заказам',
    registry: 'реестр такси',
    tax_profile: 'налоговый профиль',
    vehicle_permit: 'разрешение авто',
  };

  return blockers.map((blocker) => labels[blocker] ?? blocker).join(', ');
}

function formatRealtimeStatus(status: 'connecting' | 'live' | 'offline' | 'polling') {
  if (status === 'live') {
    return 'Заказы online';
  }

  if (status === 'polling') {
    return 'Обновление каждые 5 сек';
  }

  if (status === 'offline') {
    return 'Поток недоступен';
  }

  return 'Подключаем заказы';
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
