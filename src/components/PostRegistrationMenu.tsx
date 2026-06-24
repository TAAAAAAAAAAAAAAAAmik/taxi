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
  Clock,
  CreditCard,
  FileText,
  Headphones,
  Home,
  LucideProps,
  MapPinned,
  Menu as MenuIcon,
  Package,
  Phone,
  RefreshCw,
  Route,
  Settings,
  ShieldCheck,
  Star,
  User,
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
import { kinetixColors, kinetixEasing, kinetixIconography, kinetixMotion } from '../theme/kinetixTokens';
import { styles } from './PostRegistrationMenu.styles';
import { TripCard, type TripCardServiceType } from './TripCard';

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
  onOpenDelivery: () => void;
  onOpenOrderFlow: () => void;
  onOpenDriverDocuments: () => void;
  onOpenFleetDriverRegistration?: () => void;
  onOpenOrderHistory: () => void;
  onOpenReferral: () => void;
  onOpenSavedPlace: () => void;
  onOpenSubscription: () => void;
  onOpenSupportChat: () => void;
  onAcceptDriverOrder?: (orderId: string) => void | Promise<void>;
};

export type ClientOrderSummaryTrip = {
  createdAt?: string;
  destination: string;
  driverLabel: string;
  id: string;
  pickup: string;
  priceLabel?: string;
  routeLabel: string;
  routeTitle?: string;
  serviceType?: TripCardServiceType;
  statusLabel: string;
};

export type ClientOrderSummary = {
  activeCount: number;
  completedCount: number;
  lastOrderLabel: string;
  lastOrderStatus: string;
  totalCount: number;
  totalSpent: number;
  activeOrder?: ClientOrderSummaryTrip;
  lastOrder?: ClientOrderSummaryTrip;
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
  driverNet: number;
  serviceShare: number;
  serviceShareRate: number;
  serviceShareToday: number;
  settlementStatus: 'confirmed' | 'not_applicable' | 'pending_transfer' | 'reported_transferred';
  subscriptionExpiresAt?: string;
  subscriptionCost: number;
  billingMode: 'monthly' | 'daily';
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
  onOpenDelivery,
  onOpenOrderFlow,
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
  const activeItem = useMemo(() => {
    const menuItem =
      config.menuItems.find((item) => item.id === activeItemId) ??
      drawerItems.find((item) => item.id === activeItemId);

    if (menuItem) {
      return menuItem;
    }

    const page = pages[activeItemId];

    if (page) {
      return {
        id: activeItemId,
        icon: page.icon,
        subtitle: page.subtitle,
        title: page.title,
      };
    }

    return config.menuItems[0];
  }, [activeItemId, config.menuItems, drawerItems, pages]);
  const activePage = useMemo(
    () => pages[activeItem.id] ?? pages[config.menuItems[0].id],
    [activeItem.id, config.menuItems, pages],
  );
  const bottomMenuItems = useMemo(
    () =>
      isClientRole
        ? config.menuItems.filter((item) => ['home', 'rides', 'profile'].includes(item.id))
        : config.menuItems,
    [config.menuItems, isClientRole],
  );
  const displayName = firstName?.trim() || 'Пользователь';

  useEffect(() => {
    pageTransition.setValue(0);
    const animation = Animated.timing(pageTransition, {
      toValue: 1,
      duration: reducedMotion ? 0 : kinetixMotion.duration.list,
      easing: kinetixEasing.easeOut,
      useNativeDriver: false,
    });

    animation.start();

    return () => animation.stop();
  }, [activeItem.id, pageTransition, reducedMotion]);

  const pageAnimatedStyle = {
    opacity: pageTransition,
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

    setActiveItemId(item.id);
    setDrawerOpen(false);
  };
  const handleClientSettingsPress = () => {
    setActiveItemId('settings');
    setDrawerOpen(false);
  };

  return (
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.page} style={styles.scroll}>
        {isClientRole ? (
          <ClientTopBar
            displayName={displayName}
            onOpenMenu={() => setDrawerOpen(true)}
            onOpenSettings={handleClientSettingsPress}
          />
        ) : (
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
        )}

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
                onOpenDelivery={onOpenDelivery}
                onOpenOrderFlow={onOpenOrderFlow}
                onOpenOrderHistory={onOpenOrderHistory}
                onOpenSavedPlace={onOpenSavedPlace}
                onOpenSupportChat={onOpenSupportChat}
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
                displayName={displayName}
                driverFeedBusyId={driverFeedBusyId}
                driverFeedLockedReason={driverFeedLockedReason}
                driverFeedOrders={driverFeedOrders}
                driverStats={activeItem.id === 'payouts' || activeItem.id === 'profile' ? driverStats : undefined}
                onAcceptDriverOrder={onAcceptDriverOrder}
                onActionTarget={handleActionTarget}
                page={activePage}
              />
            )}
          </Animated.View>
        </View>
      </ScrollView>

      <View style={[styles.bottomTabs, isClientRole && styles.clientBottomTabs]}>
        {bottomMenuItems.map((item) => {
          const active =
            item.id === activeItem.id ||
            (isClientRole && activeItem.id === 'settings' && item.id === 'profile');

          return (
            <BottomTabButton
              active={active}
              clientMode={isClientRole}
              item={item}
              key={item.id}
              onPress={() => handleMenuItemPress(item)}
            />
          );
        })}
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

function ClientTopBar({
  displayName,
  onOpenMenu,
  onOpenSettings,
}: {
  displayName: string;
  onOpenMenu: () => void;
  onOpenSettings: () => void;
}) {
  const initials = getInitials(displayName);

  return (
    <View style={styles.clientTopBar}>
      <View style={styles.clientHeaderLeft}>
        <Pressable
          accessibilityLabel="Открыть меню"
          accessibilityRole="button"
          onPress={onOpenMenu}
          style={({ pressed }) => [styles.clientHeaderMenuButton, pressed && styles.pressed]}
        >
          <MenuIcon color="#008D49" size={24} strokeWidth={2.6} />
        </Pressable>
        <View style={styles.clientHeaderAvatar}>
          <Text style={styles.clientHeaderAvatarText}>{initials}</Text>
        </View>
        <View style={styles.clientHeaderCopy}>
          <Text style={styles.clientHeaderGreeting}>Здравствуйте,</Text>
          <View style={styles.clientHeaderStatusPill}>
            <Clock color={kinetixColors.amber} size={13} strokeWidth={2.4} />
            <Text style={styles.clientHeaderStatusText}>Онлайн</Text>
          </View>
        </View>
      </View>

      <View style={styles.clientHeaderActions}>
        <Pressable
          accessibilityLabel="Уведомления"
          accessibilityRole="button"
          onPress={() => undefined}
          style={({ pressed }) => [styles.clientHeaderIconButton, pressed && styles.pressed]}
        >
          <Bell color={kinetixColors.textSecondary} size={22} strokeWidth={2.25} />
        </Pressable>
        <Pressable
          accessibilityLabel="Открыть настройки"
          accessibilityRole="button"
          onPress={onOpenSettings}
          style={({ pressed }) => [styles.clientHeaderIconButton, pressed && styles.pressed]}
        >
          <Settings color={kinetixColors.textSecondary} size={22} strokeWidth={2.25} />
        </Pressable>
      </View>
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
  onOpenDelivery: () => void;
  onOpenOrderFlow: () => void;
  onOpenOrderHistory: () => void;
  onOpenSavedPlace: () => void;
  onOpenSupportChat: () => void;
};

function ClientPageView({
  activeItemId,
  availableCarsCount,
  displayName,
  onDeleteAccount,
  onOpenDelivery,
  onOpenOrderFlow,
  onOpenOrderHistory,
  onOpenSavedPlace,
  onOpenSupportChat,
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
      onOpenDelivery={onOpenDelivery}
      onOpenOrderFlow={onOpenOrderFlow}
      orderSummary={orderSummary}
    />
  );
}

function ClientHomePage({
  availableCarsCount,
  displayName,
  onOpenDelivery,
  onOpenOrderFlow,
  orderSummary,
}: {
  availableCarsCount: number;
  displayName: string;
  orderSummary?: ClientOrderSummary;
  onOpenDelivery: () => void;
  onOpenOrderFlow: () => void;
}) {
  return (
    <View style={styles.clientFocusPage}>
      <View style={styles.clientWelcomePanel}>
        <Text style={styles.clientWelcomeTitle}>Здравствуйте, {displayName}!</Text>
        <Text numberOfLines={2} style={styles.clientWelcomeText}>
          Нужна поездка или доставка в Салавате?
        </Text>
      </View>

      <View style={styles.clientServiceRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Заказать такси"
          onPress={onOpenOrderFlow}
          style={({ pressed }) => [styles.clientServiceTile, pressed && styles.pressed]}
        >
          <View style={styles.clientMainOrderIcon}>
            <MapPinned color="#F4FAF6" size={26} strokeWidth={2.6} />
          </View>
          <Text style={styles.clientServiceTitle}>Такси</Text>
          <Text numberOfLines={1} style={styles.clientServiceText}>Поездка по адресу</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Заказать доставку"
          onPress={onOpenDelivery}
          style={({ pressed }) => [styles.clientServiceTile, pressed && styles.pressed]}
        >
          <View style={styles.clientMainOrderIcon}>
            <Package color="#F4FAF6" size={26} strokeWidth={2.6} />
          </View>
          <Text style={styles.clientServiceTitle}>Доставка</Text>
          <Text numberOfLines={1} style={styles.clientServiceText}>Привезём и передадим</Text>
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
  const [statsOpen, setStatsOpen] = useState(false);
  const summary = orderSummary ?? {
    activeCount: 0,
    completedCount: 0,
    lastOrderLabel: 'Пока нет поездок',
    lastOrderStatus: 'Пусто',
    totalCount: 0,
    totalSpent: 0,
  };
  const tripItems: Array<{
    dateTimeLabel: string;
    destination: string;
    driverLabel: string;
    id: string;
    pickup: string;
    price?: string;
    serviceType: TripCardServiceType;
    status: string;
    title: string;
    tone: 'active' | 'done';
  }> = [];

  if (summary.activeOrder) {
    tripItems.push({
      dateTimeLabel: formatTripDateTime(summary.activeOrder.createdAt),
      destination: summary.activeOrder.destination,
      driverLabel: formatTripDriverLine(summary.activeOrder.driverLabel),
      id: summary.activeOrder.id,
      pickup: summary.activeOrder.pickup,
      price: summary.activeOrder.priceLabel,
      serviceType: summary.activeOrder.serviceType ?? 'taxi',
      status: summary.activeOrder.statusLabel,
      title: summary.activeOrder.routeTitle ?? summary.activeOrder.routeLabel,
      tone: 'active',
    });
  }

  if (summary.lastOrder && summary.lastOrder.id !== summary.activeOrder?.id) {
    tripItems.push({
      dateTimeLabel: formatTripDateTime(summary.lastOrder.createdAt),
      destination: summary.lastOrder.destination,
      driverLabel: formatTripDriverLine(summary.lastOrder.driverLabel),
      id: summary.lastOrder.id,
      pickup: summary.lastOrder.pickup,
      price: summary.lastOrder.priceLabel,
      serviceType: summary.lastOrder.serviceType ?? 'taxi',
      status: summary.lastOrder.statusLabel,
      title: summary.lastOrder.routeTitle ?? summary.lastOrder.routeLabel,
      tone: 'done',
    });
  }

  return (
    <View style={styles.clientFocusPage}>
      <View style={styles.clientSectionHeader}>
        <Text style={styles.clientSectionTitle}>Мои поездки</Text>
        <Text numberOfLines={1} style={styles.clientSectionText}>Активные и завершённые маршруты.</Text>
      </View>

      {tripItems.length ? (
        <View style={styles.clientTripsList}>
          {tripItems.map((item) => (
            <TripCard
              dateTimeLabel={item.dateTimeLabel}
              destination={item.destination}
              driverLabel={item.driverLabel}
              key={item.id}
              pickup={item.pickup}
              priceLabel={item.price}
              serviceType={item.serviceType}
              statusLabel={item.status}
              title={item.title}
              tone={item.tone}
            />
          ))}
        </View>
      ) : (
        <KinetixEmptyState
          description="После первого заказа здесь появится маршрут."
          icon={<MapPinned color="#008D49" size={20} strokeWidth={2.4} />}
          title="Поездок пока нет"
        />
      )}

      <View style={styles.clientHistoryActions}>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenOrderHistory}
          style={({ pressed }) => [styles.clientHistoryMiniButton, pressed && styles.pressed]}
        >
          <Route color="#008D49" size={15} strokeWidth={2.5} />
          <Text style={styles.clientHistoryMiniButtonText}>История</Text>
        </Pressable>
        <ClientHistoryActionChip title="Отзыв" />
        <ClientHistoryActionChip title="Жалоба" />
        <ClientHistoryActionChip title="Повтор" />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: statsOpen }}
        onPress={() => setStatsOpen((current) => !current)}
        style={({ pressed }) => [styles.clientStatsToggle, statsOpen && styles.clientStatsToggleActive, pressed && styles.pressed]}
      >
        <FileText color={statsOpen ? '#F4FAF6' : '#008D49'} size={17} strokeWidth={2.4} />
        <Text style={[styles.clientStatsToggleText, statsOpen && styles.clientStatsToggleTextActive]}>
          Статистика
        </Text>
        <Text style={[styles.clientStatsToggleValue, statsOpen && styles.clientStatsToggleTextActive]}>
          {summary.totalCount}
        </Text>
      </Pressable>

      {statsOpen ? (
        <View style={styles.clientStatsGrid}>
          <ClientStatPill label="Всего" value={String(summary.totalCount)} />
          <ClientStatPill label="Активные" value={String(summary.activeCount)} />
          <ClientStatPill label="Завершено" value={String(summary.completedCount)} />
          <ClientStatPill label="Сумма" value={`${summary.totalSpent} ₽`} />
        </View>
      ) : null}
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

  const initials = getInitials(displayName);

  return (
    <View style={styles.clientFocusPage}>
      <View style={styles.accountHeroCard}>
        <View style={styles.accountHeroAvatar}>
          <Text style={styles.accountHeroAvatarText}>{initials}</Text>
        </View>
        <View style={styles.accountHeroCopy}>
          <Text numberOfLines={1} style={styles.accountHeroName}>{displayName}</Text>
          <Text numberOfLines={1} style={styles.accountHeroMeta}>Клиент Kinetix</Text>
          <Text numberOfLines={1} style={styles.accountHeroBadge}>
            {savedHomeAddressLabel ?? 'Дом не указан'}
          </Text>
        </View>
      </View>

      <View style={styles.accountRoundRow}>
        <ClientAccountRoundButton icon="support" title="Поддержка" onPress={onOpenSupportChat} />
        <ClientAccountRoundButton
          active={activePanel === 'settings'}
          icon="settings"
          title="Настройки"
          onPress={() => setActivePanel('settings')}
        />
        <ClientAccountRoundButton
          active={activePanel === 'profile'}
          icon="profile"
          title="Профиль"
          onPress={() => setActivePanel('profile')}
        />
      </View>

      {activePanel === 'settings' ? (
        <View style={styles.accountPanel}>
          <Text style={styles.accountPanelTitle}>Настройки</Text>
          <ClientSettingToggle
            enabled={doNotCall}
            onPress={() => setDoNotCall((current) => !current)}
            text="Звонок только по важному."
            title="Не звонить"
          />
          <ClientSettingToggle
            enabled={shareLocation}
            onPress={() => setShareLocation((current) => !current)}
            text="Пока водитель едет к вам."
            title="Геопозиция"
          />
        </View>
      ) : (
        <View style={styles.accountPanel}>
          <Text style={styles.accountPanelTitle}>Профиль</Text>
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
  active = false,
  icon,
  onPress,
  title,
}: {
  active?: boolean;
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
      <View style={[styles.accountRoundIcon, active && styles.accountRoundIconActive]}>
        <Icon color={active ? '#F4FAF6' : '#008D49'} size={24} strokeWidth={2.5} />
      </View>
      <Text numberOfLines={1} style={[styles.accountRoundText, active && styles.accountRoundTextActive]}>
        {title}
      </Text>
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
      Icon: CreditCard,
      title: 'Цена заранее',
      text: activeOrder?.priceLabel ?? 'До оформления',
    },
    {
      Icon: RefreshCw,
      title: 'Статус и PIN',
      text: activeOrder?.statusLabel ?? 'Включим в заказ',
    },
    {
      Icon: Phone,
      title: 'Номер скрыт',
      text: 'Связь в приложении',
    },
    {
      Icon: Car,
      title: 'Машины рядом',
      text: String(availableCarsCount),
      live: true,
    },
  ];

  return (
    <View style={styles.clientTrustRail}>
      {items.map(({ Icon, ...item }) => (
        <View key={item.title} style={styles.clientTrustChip}>
          <View style={styles.clientTrustIcon}>
            <Icon color={kinetixColors.amber} size={18} strokeWidth={2.35} />
          </View>
          <View style={styles.clientTrustCopy}>
            <Text numberOfLines={1} style={styles.clientTrustTitle}>{item.title}</Text>
            <View style={styles.clientTrustValueRow}>
              <Text numberOfLines={1} style={styles.clientTrustText}>{item.text}</Text>
              {item.live ? <View style={styles.clientTrustDotLive} /> : null}
            </View>
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
  const driverCaption = activeOrder?.driverLabel
    ? `Водитель: ${activeOrder.driverLabel}`
    : 'Водитель: Максимов А.Н. (Skoda Octavia, A123ВС)';
  const mapAccessibilityLabel = `${availableCarsCount} ${formatCarsWord(availableCarsCount)} рядом`;

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
        useNativeDriver: false,
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
    <View accessibilityLabel={mapAccessibilityLabel} style={styles.clientMapPanel}>
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
          <Text style={styles.clientMapStatusText}>Live</Text>
        </View>
      </View>
      <View style={styles.clientMapCopy}>
        <Text style={styles.clientMapTitle}>Водитель на карте</Text>
        <Text numberOfLines={2} style={styles.clientMapText}>{driverCaption}</Text>
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
      ? 'Смена активна'
      : 'Готов к заказам'
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
          <Text style={styles.commandEyebrow}>{isSelfEmployedDriver ? 'Смена' : 'Линия'}</Text>
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

      <View style={styles.commandMetaStrip}>
        <View style={styles.commandMetaItem}>
          <Text style={styles.commandMetaValue}>{driverStats?.todayOrders ?? 0}</Text>
          <Text numberOfLines={1} style={styles.commandMetaLabel}>заказы</Text>
        </View>
        <View style={styles.commandMetaDivider} />
        <View style={styles.commandMetaItem}>
          <Text style={styles.commandMetaValue}>{driverStats?.grossToday ?? 0} ₽</Text>
          <Text numberOfLines={1} style={styles.commandMetaLabel}>сегодня</Text>
        </View>
        <View style={styles.commandMetaDivider} />
        <View style={styles.commandMetaItem}>
          <Text style={styles.commandMetaValue}>{formatDriverAccessLabel(driverStats)}</Text>
          <Text numberOfLines={1} style={styles.commandMetaLabel}>{formatDriverAccessUntil(driverStats)}</Text>
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
              ? 'Можно принимать заказы.'
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
          <BriefcaseBusiness color="#008D49" size={16} strokeWidth={2.4} />
          <Text style={styles.commandSecondaryButtonText}>Заказы</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenSubscription}
          style={({ pressed }) => [styles.commandSecondaryButton, pressed && styles.pressed]}
        >
          <Wallet color="#008D49" size={17} strokeWidth={2.4} />
          <Text style={styles.commandSecondaryButtonText}>Оплата</Text>
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
          <Text style={styles.driverLineMiniValue}>{formatDriverAccessLabel(stats)}</Text>
          <Text style={styles.driverLineMiniLabel}>доступ</Text>
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
  clientMode?: boolean;
  onPress: () => void;
};

function BottomTabButton({ active, clientMode = false, item, onPress }: BottomTabButtonProps) {
  const clientPresentation = getClientBottomTabPresentation(item);
  const Icon = clientMode ? clientPresentation.Icon : iconMap[item.icon];
  const title = clientMode ? clientPresentation.title : item.title;
  const iconColor = active
    ? kinetixColors.amber
    : clientMode
      ? kinetixColors.textSecondary
      : kinetixColors.amber;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bottomTab,
        clientMode && styles.clientBottomTab,
        active && (clientMode ? styles.clientBottomTabActive : styles.bottomTabActive),
        pressed && styles.pressed,
      ]}
    >
      {clientMode ? null : <View style={[styles.bottomTabIndicator, active && styles.bottomTabIndicatorActive]} />}
      <View
        style={[
          styles.bottomTabIcon,
          clientMode && styles.clientBottomTabIcon,
          active && !clientMode && styles.bottomTabIconActive,
        ]}
      >
        <Icon
          color={active && !clientMode ? kinetixColors.graphite : iconColor}
          size={clientMode ? kinetixIconography.sizes.regular : 20}
          strokeWidth={clientMode ? 2.25 : 2.4}
        />
      </View>
      <Text numberOfLines={1} style={[styles.bottomTabText, active && styles.bottomTabTextActive]}>
        {title}
      </Text>
    </Pressable>
  );
}

function getClientBottomTabPresentation(item: MenuItem): {
  Icon: ComponentType<LucideProps>;
  title: string;
} {
  if (item.id === 'rides') {
    return { Icon: Clock, title: 'Поездки' };
  }

  if (item.id === 'profile') {
    return { Icon: User, title: 'Профиль' };
  }

  return { Icon: Home, title: 'Главная' };
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
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
    }

    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reducedMotion ? 0 : kinetixMotion.duration.drawer,
      easing: kinetixEasing.easeOut,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished && !open) {
        setMounted(false);
      }
    });

    return () => animation.stop();
  }, [open, progress, reducedMotion]);

  const panelAnimatedStyle = {
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-340, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  };
  const scrimAnimatedStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
  };

  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible={mounted}>
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

function DriverPayoutsPage({
  onActionTarget,
  stats,
}: {
  onActionTarget: (target?: MenuActionTarget) => void;
  stats?: DriverStatsSummary;
}) {
  const [statsOpen, setStatsOpen] = useState(false);
  const activePlan = stats?.billingMode ?? 'daily';
  const todayGross = stats?.grossToday ?? 0;
  const todayOrders = stats?.todayOrders ?? 0;
  const accessUntil = formatDriverAccessUntil(stats);

  return (
    <View style={styles.payoutPage}>
      <View style={styles.payoutHeroCard}>
        <View style={styles.payoutHeroTop}>
          <View style={styles.payoutHeroIcon}>
            <Wallet color="#F4FAF6" size={24} strokeWidth={2.5} />
          </View>
          <View style={styles.payoutHeroCopy}>
            <Text style={styles.payoutHeroTitle}>{todayGross} ₽</Text>
            <Text numberOfLines={1} style={styles.payoutHeroText}>Собрано сегодня</Text>
          </View>
          <Text style={styles.payoutHeroBadge}>Без комиссии</Text>
        </View>

        <View style={styles.payoutKeyGrid}>
          <View style={styles.payoutKeyCard}>
            <Text style={styles.payoutKeyValue}>{todayOrders}</Text>
            <Text style={styles.payoutKeyLabel}>заказы</Text>
          </View>
          <View style={styles.payoutKeyCard}>
            <Text style={styles.payoutKeyValue}>{formatDriverAccessLabel(stats)}</Text>
            <Text numberOfLines={1} style={styles.payoutKeyLabel}>{accessUntil}</Text>
          </View>
        </View>
      </View>

      <View style={styles.payoutTariffRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onActionTarget('subscription')}
          style={({ pressed }) => [
            styles.payoutTariffChip,
            activePlan === 'daily' && styles.payoutTariffChipActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.payoutTariffTitle, activePlan === 'daily' && styles.payoutTariffTitleActive]}>
            День
          </Text>
          <Text style={[styles.payoutTariffText, activePlan === 'daily' && styles.payoutTariffTextActive]}>
            100 ₽
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onActionTarget('subscription')}
          style={({ pressed }) => [
            styles.payoutTariffChip,
            activePlan === 'monthly' && styles.payoutTariffChipActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.payoutTariffTitle, activePlan === 'monthly' && styles.payoutTariffTitleActive]}>
            PRO
          </Text>
          <Text style={[styles.payoutTariffText, activePlan === 'monthly' && styles.payoutTariffTextActive]}>
            2 490 ₽
          </Text>
        </Pressable>
      </View>

      <View style={styles.payoutActionsRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onActionTarget('subscription')}
          style={({ pressed }) => [styles.payoutPayButton, pressed && styles.pressed]}
        >
          <CreditCard color="#F4FAF6" size={18} strokeWidth={2.4} />
          <Text style={styles.payoutPayButtonText}>
            {activePlan === 'monthly' ? 'Оплатить PRO' : 'Оплатить смену 100 ₽'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: statsOpen }}
          onPress={() => setStatsOpen((current) => !current)}
          style={({ pressed }) => [styles.payoutStatsButton, statsOpen && styles.payoutStatsButtonActive, pressed && styles.pressed]}
        >
          <Text style={[styles.payoutStatsButtonText, statsOpen && styles.payoutStatsButtonTextActive]}>
            Статистика
          </Text>
        </Pressable>
      </View>

      {statsOpen && stats ? <DriverStatsPanel stats={stats} /> : null}
    </View>
  );
}

function DriverProfilePage({
  displayName,
  driverStats,
  onActionTarget,
}: {
  displayName: string;
  driverStats?: DriverStatsSummary;
  onActionTarget: (target?: MenuActionTarget) => void;
}) {
  const [activePanel, setActivePanel] = useState<'settings' | 'profile'>('profile');
  const initials = getInitials(displayName);

  return (
    <View style={styles.clientFocusPage}>
      <View style={styles.accountHeroCard}>
        <View style={styles.accountHeroAvatar}>
          <Text style={styles.accountHeroAvatarText}>{initials}</Text>
        </View>
        <View style={styles.accountHeroCopy}>
          <Text numberOfLines={1} style={styles.accountHeroName}>{displayName}</Text>
          <Text numberOfLines={1} style={styles.accountHeroMeta}>Водитель-партнёр</Text>
          <Text numberOfLines={1} style={styles.accountHeroBadge}>
            {formatDriverAccessLabel(driverStats)} · {formatDriverAccessUntil(driverStats)}
          </Text>
        </View>
      </View>

      <View style={styles.accountRoundRow}>
        <ClientAccountRoundButton
          icon="support"
          title="Поддержка"
          onPress={() => onActionTarget('supportChat')}
        />
        <ClientAccountRoundButton
          active={activePanel === 'settings'}
          icon="settings"
          title="Настройки"
          onPress={() => setActivePanel('settings')}
        />
        <ClientAccountRoundButton
          active={activePanel === 'profile'}
          icon="profile"
          title="Профиль"
          onPress={() => setActivePanel('profile')}
        />
      </View>

      {activePanel === 'settings' ? (
        <View style={styles.accountPanel}>
          <Text style={styles.accountPanelTitle}>Настройки</Text>
          <View style={styles.accountProfileActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onActionTarget('documents')}
              style={({ pressed }) => [styles.accountSecondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.accountSecondaryButtonText}>Документы</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onActionTarget('subscription')}
              style={({ pressed }) => [styles.accountSecondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.accountSecondaryButtonText}>Тариф</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onActionTarget('deleteAccount')}
              style={({ pressed }) => [styles.accountDangerButton, pressed && styles.pressed]}
            >
              <Text style={styles.accountDangerButtonText}>Удалить</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.accountPanel}>
          <Text style={styles.accountPanelTitle}>Профиль</Text>
          <View style={styles.accountProfileRow}>
            <Text style={styles.accountProfileLabel}>Имя</Text>
            <Text style={styles.accountProfileValue}>{displayName}</Text>
          </View>
          <View style={styles.accountProfileRow}>
            <Text style={styles.accountProfileLabel}>Доступ</Text>
            <Text style={styles.accountProfileValue}>
              {formatDriverAccessLabel(driverStats)} · {formatDriverAccessUntil(driverStats)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

type SectionPageViewProps = {
  activeItemId: string;
  appTitle: string;
  displayName: string;
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
  displayName,
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

  if (activeItemId === 'payouts') {
    return (
      <>
        <View style={styles.routeRow}>
          <Text style={styles.routeText}>{appTitle}</Text>
          <Text style={styles.routeDivider}>/</Text>
          <Text style={styles.routeTextActive}>Доход</Text>
        </View>

        <DriverPayoutsPage onActionTarget={onActionTarget} stats={driverStats} />
      </>
    );
  }

  if (activeItemId === 'profile') {
    return (
      <>
        <View style={styles.routeRow}>
          <Text style={styles.routeText}>{appTitle}</Text>
          <Text style={styles.routeDivider}>/</Text>
          <Text style={styles.routeTextActive}>Профиль</Text>
        </View>

        <DriverProfilePage
          displayName={displayName}
          driverStats={driverStats}
          onActionTarget={onActionTarget}
        />
      </>
    );
  }

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
                <View style={styles.driverFeedCardTop}>
                  <View style={styles.driverFeedCardTags}>
                    <Text numberOfLines={1} style={styles.driverFeedService}>{order.serviceLabel ?? 'Такси'}</Text>
                    <Text numberOfLines={1} style={styles.driverFeedDistance}>{order.distanceLabel}</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.driverFeedPrice}>{order.priceLabel}</Text>
                </View>
                <View style={styles.driverFeedRouteRow}>
                  <View style={styles.driverFeedRouteDot} />
                  <Text numberOfLines={1} style={styles.driverFeedAddress}>{order.address}</Text>
                </View>
                <View style={styles.driverFeedActions}>
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
                      styles.driverFeedAcceptButtonWide,
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
        <MiniStat label="Доступ" value={formatDriverAccessLabel(stats)} />
      </View>
      <Text style={styles.driverStatsHint}>
        {formatDriverAccessDescription(stats)}
      </Text>
    </View>
  );
}

function DriverStatsPanel({ stats }: { stats: DriverStatsSummary }) {
  return (
    <View style={styles.financePanel}>
      <Text style={styles.panelTitle}>Статистика</Text>
      <Text style={styles.panelSubtitle}>
        День, неделя и месяц в одном коротком блоке. Процентов с заказов нет.
      </Text>
      <View style={styles.metricsGrid}>
        <MiniMetric label="День" value={`${stats.grossToday} ₽`} />
        <MiniMetric label="Заказы сегодня" value={String(stats.todayOrders)} />
        <MiniMetric label="Доступ" value={formatDriverAccessLabel(stats)} />
        <MiniMetric label="Неделя" value={`${stats.weekOrders} заказов`} />
        <MiniMetric label="Месяц" value={`${stats.monthOrders} заказов`} />
        <MiniMetric label="До" value={stats.subscriptionExpiresAt ? formatDate(stats.subscriptionExpiresAt) : '—'} />
      </View>
      <Text style={styles.panelSubtitle}>
        Дневной доступ открывает линию на 24 часа, PRO — на 30 дней.
      </Text>
    </View>
  );
}

function formatDriverAccessLabel(stats?: DriverStatsSummary) {
  if (!stats) {
    return '—';
  }

  return stats.billingMode === 'monthly' ? 'PRO' : 'День';
}

function formatDriverAccessUntil(stats?: DriverStatsSummary) {
  if (!stats?.subscriptionExpiresAt) {
    return 'доступ';
  }

  return `до ${formatDate(stats.subscriptionExpiresAt)}`;
}

function formatDriverAccessDescription(stats: DriverStatsSummary) {
  const plan = stats.billingMode === 'monthly' ? 'Партнёр PRO' : 'Дневной доступ';

  if (!stats.subscriptionExpiresAt) {
    return `${plan} активен. С заказов ничего не удерживается.`;
  }

  return `${plan} активен до ${formatDate(stats.subscriptionExpiresAt)}. С заказов ничего не удерживается.`;
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return 'K';
  }

  return parts.map((part) => part.slice(0, 1).toUpperCase()).join('');
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

function formatTripDateTime(value?: string) {
  if (!value) {
    return 'Дата не указана';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

function formatTripDriverLine(value: string) {
  return value.trim().toLowerCase().startsWith('водитель')
    ? value
    : `Водитель: ${value}`;
}
