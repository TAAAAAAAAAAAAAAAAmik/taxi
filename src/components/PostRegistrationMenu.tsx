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
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Car,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Gift,
  Headphones,
  Home,
  LucideProps,
  MapPinned,
  Menu as MenuIcon,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Route,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
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
import { KinetixEmptyState, KinetixStatus, PressableScale, StaggerView } from './KinetixUI';
import { NearbyCarsMap } from './NearbyCarsMap';
import { useAppState } from '../state/AppState';
import {
  MenuActionTarget,
  MenuIconName,
  MenuItem,
  QuickAction,
  roleMenuConfig,
} from '../data/menu';
import { SectionPage, SectionRow, sectionPages } from '../data/sectionPages';
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference';
import { kinetixColors, kinetixEasing, kinetixIconography } from '../theme/kinetixTokens';
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
    requiresPayment?: boolean;
    status: string;
  };
  onBackToRegistration: () => void;
  onDeleteAccount: () => void;
  onLogout: () => void;
  onToggleDriverLine?: () => void;
  onToggleSimpleMode?: () => void;
  onOpenDelivery: () => void;
  onOpenOrderFlow: () => void;
  onOrderHome: () => void;
  onOpenDriverDocuments: () => void;
  onOpenFleetDriverRegistration?: () => void;
  onOpenActiveOrder?: () => void;
  onOpenOrderHistory: () => void;
  onOpenReferral: () => void;
  onOpenSavedPlace: () => void;
  onOpenSubscription: () => void;
  onOpenSupportChat: (category?: string) => void;
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
  onOpenActiveOrder,
  onOpenOrderHistory,
  onOpenDriverDocuments,
  onOpenFleetDriverRegistration,
  onOpenDelivery,
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
  // На мобильном у водителя тёмный hero должен быть у самого верха, как у
  // клиента: прячем верхнюю панель и профиль-сайдбар, а меню (☰) переносим
  // внутрь hero. На широком экране сайдбар остаётся.
  const driverMobileTopless = isDriverRole && !isWide;
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
      duration: reducedMotion ? 0 : 300,
      easing: kinetixEasing.easeOut,
      useNativeDriver: false,
    });

    animation.start();

    return () => animation.stop();
  }, [activeItem.id, pageTransition, reducedMotion]);

  const pageAnimatedStyle = {
    opacity: pageTransition,
    transform: [
      {
        translateY: pageTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [22, 0],
        }),
      },
      {
        scale: pageTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [0.97, 1],
        }),
      },
    ],
  };

  const handleActionTarget = (target?: MenuActionTarget, supportCategory?: string) => {
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
      onOpenSupportChat(supportCategory);
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
        {isClientRole || driverMobileTopless ? null : (
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

        {realtimeMessage && !isClientRole && !driverMobileTopless ? (
          <View style={styles.livePanel}>
            <View style={[styles.liveDot, realtimeStatus === 'live' && styles.liveDotActive]} />
            <Text style={styles.livePanelText}>{realtimeMessage}</Text>
          </View>
        ) : null}

        <View style={[styles.layout, !isClientRole && isWide && styles.layoutWide]}>
          {!isClientRole && !driverMobileTopless ? (
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
                onOpenActiveOrder={onOpenActiveOrder}
                onOpenDelivery={onOpenDelivery}
                onOpenMenu={() => setDrawerOpen(true)}
                onOpenOrderFlow={onOpenOrderFlow}
                onOpenOrderHistory={onOpenOrderHistory}
                onOpenReferral={onOpenReferral}
                onOpenSavedPlace={onOpenSavedPlace}
                onOpenSupportChat={onOpenSupportChat}
                onOrderHome={onOrderHome}
                orderSummary={clientOrderSummary}
                savedHomeAddressLabel={savedHomeAddressLabel}
              />
            ) : isDriverRole && activeItem.id === 'home' && driverLine ? (
              <DriverHomePage
                appTitle={config.title}
                driverLine={driverLine}
                driverStats={driverStats}
                isSelfEmployedDriver={isSelfEmployedDriver}
                menuButton={driverMobileTopless}
                onOpenMenu={() => setDrawerOpen(true)}
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
                menuButton={driverMobileTopless}
                onAcceptDriverOrder={onAcceptDriverOrder}
                onActionTarget={handleActionTarget}
                onOpenMenu={() => setDrawerOpen(true)}
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
  onOpenActiveOrder?: () => void;
  onOpenDelivery: () => void;
  onOpenMenu: () => void;
  onOpenOrderFlow: () => void;
  onOpenOrderHistory: () => void;
  onOpenReferral: () => void;
  onOpenSavedPlace: () => void;
  onOpenSupportChat: () => void;
  onOrderHome: () => void;
};

function ClientPageView({
  activeItemId,
  availableCarsCount,
  displayName,
  onDeleteAccount,
  onOpenActiveOrder,
  onOpenDelivery,
  onOpenMenu,
  onOpenOrderFlow,
  onOpenOrderHistory,
  onOpenReferral,
  onOpenSavedPlace,
  onOpenSupportChat,
  onOrderHome,
  orderSummary,
  savedHomeAddressLabel,
}: ClientPageViewProps) {
  if (activeItemId === 'rides') {
    return (
      <ClientOrdersPage
        onOpenActiveOrder={onOpenActiveOrder}
        onOpenMenu={onOpenMenu}
        onOpenOrderHistory={onOpenOrderHistory}
        onOpenSavedPlace={onOpenSavedPlace}
        onOrderHome={onOrderHome}
        orderSummary={orderSummary}
        savedHomeAddressLabel={savedHomeAddressLabel}
      />
    );
  }

  if (activeItemId === 'about') {
    return <ClientAboutPage onOpenMenu={onOpenMenu} onOpenSupportChat={onOpenSupportChat} />;
  }

  if (activeItemId === 'profile' || activeItemId === 'settings') {
    return (
      <ClientAccountPage
        displayName={displayName}
        onDeleteAccount={onDeleteAccount}
        onOpenMenu={onOpenMenu}
        onOpenReferral={onOpenReferral}
        onOpenSavedPlace={onOpenSavedPlace}
        onOpenSupportChat={onOpenSupportChat}
        orderSummary={orderSummary}
        savedHomeAddressLabel={savedHomeAddressLabel}
      />
    );
  }

  return (
    <ClientHomePage
      availableCarsCount={availableCarsCount}
      displayName={displayName}
      onOpenActiveOrder={onOpenActiveOrder}
      onOpenDelivery={onOpenDelivery}
      onOpenMenu={onOpenMenu}
      onOpenOrderFlow={onOpenOrderFlow}
      orderSummary={orderSummary}
    />
  );
}

function ClientHomePage({
  availableCarsCount,
  displayName,
  onOpenActiveOrder,
  onOpenDelivery,
  onOpenMenu,
  onOpenOrderFlow,
  orderSummary,
}: {
  availableCarsCount: number;
  displayName: string;
  orderSummary?: ClientOrderSummary;
  onOpenActiveOrder?: () => void;
  onOpenDelivery: () => void;
  onOpenMenu: () => void;
  onOpenOrderFlow: () => void;
}) {
  const { drivers } = useAppState();
  const carPoints = drivers
    .filter((driver) => driver.isOnline && driver.lastLocation)
    .map((driver) => ({
      latitude: driver.lastLocation!.latitude,
      longitude: driver.lastLocation!.longitude,
    }))
    .slice(0, 12);

  return (
    <View style={styles.clientHome}>
      <StaggerView index={0} style={styles.clientHero}>
        <View style={styles.clientHeroGlow} />
        <View style={styles.clientHeroRow}>
          <View style={styles.clientHeroCopy}>
            <Text numberOfLines={1} style={styles.clientHeroGreeting}>Здравствуйте, {displayName}</Text>
            <Text numberOfLines={1} style={styles.clientHeroSub}>Куда поедем сегодня?</Text>
          </View>
          <PressableScale
            accessibilityLabel="Открыть меню"
            accessibilityRole="button"
            onPress={onOpenMenu}
            style={styles.clientHeroMenu}
          >
            <MenuIcon color={kinetixColors.lime} size={24} strokeWidth={2.4} />
          </PressableScale>
        </View>
      </StaggerView>

      <View style={styles.clientHomeBody}>
        {onOpenActiveOrder && orderSummary?.activeOrder ? (
          <StaggerView index={1}>
            <PressableScale
              accessibilityLabel="Открыть текущий заказ"
              accessibilityRole="button"
              onPress={onOpenActiveOrder}
              style={styles.activeOrderCard}
            >
              <View style={styles.activeOrderIcon}>
                <Route color="#06140D" size={20} strokeWidth={2.6} />
              </View>
              <View style={styles.activeOrderCopy}>
                <Text numberOfLines={1} style={styles.activeOrderLabel}>
                  Текущий заказ · {orderSummary.activeOrder.statusLabel}
                </Text>
                <Text numberOfLines={1} style={styles.activeOrderRoute}>
                  {orderSummary.activeOrder.routeTitle ?? orderSummary.activeOrder.routeLabel}
                </Text>
              </View>
              <Text style={styles.activeOrderArrow}>→</Text>
            </PressableScale>
          </StaggerView>
        ) : null}

        <StaggerView index={2}>
          <PressableScale
            accessibilityLabel="Вызвать такси"
            accessibilityRole="button"
            onPress={onOpenOrderFlow}
            style={styles.clientActionPrimary}
          >
            <View style={styles.clientActionIconPrimary}>
              <Car color="#F4FAF6" size={26} strokeWidth={2.4} />
            </View>
            <View style={styles.clientActionCopy}>
              <Text numberOfLines={1} style={styles.clientActionTitle}>Вызвать такси</Text>
              <Text numberOfLines={1} style={styles.clientActionSub}>По адресу или домой</Text>
            </View>
            <ChevronRight color="#B7C8BF" size={22} strokeWidth={2.4} />
          </PressableScale>
        </StaggerView>

        <StaggerView index={3}>
          <PressableScale
            accessibilityLabel="Доставка"
            accessibilityRole="button"
            onPress={onOpenDelivery}
            style={styles.clientActionSecondary}
          >
            <View style={styles.clientActionIconSecondary}>
              <Package color={kinetixColors.amber} size={23} strokeWidth={2.4} />
            </View>
            <View style={styles.clientActionCopy}>
              <Text numberOfLines={1} style={styles.clientActionTitleSm}>Доставка</Text>
              <Text numberOfLines={1} style={styles.clientActionSub}>Привезём и передадим</Text>
            </View>
            <ChevronRight color="#B7C8BF" size={22} strokeWidth={2.4} />
          </PressableScale>
        </StaggerView>

        <StaggerView index={4} style={styles.clientMapGrow}>
          {/* Карта — живое превью «машины рядом», а не второй вход в заказ:
              явные входы выше (карточки услуг), дубль-строку убрали. */}
          <View style={styles.clientMapCard}>
            <NearbyCarsMap cars={carPoints} height="100%" />
            <View style={styles.clientMapChip}>
              <View style={styles.clientMapChipDot} />
              <Text numberOfLines={1} style={styles.clientMapChipText}>
                {availableCarsCount > 0 ? `${availableCarsCount} ${formatCarsWord(availableCarsCount)} рядом` : 'Ищем машины рядом'}
              </Text>
            </View>
          </View>
        </StaggerView>
      </View>
    </View>
  );
}

function ClientPageHeader({
  title,
  subtitle,
  onOpenMenu,
  Icon,
}: {
  title: string;
  subtitle?: string;
  onOpenMenu: () => void;
  Icon?: ComponentType<LucideProps>;
}) {
  return (
    <View style={styles.clientPageHero}>
      <View style={styles.clientHeroGlow} />
      <View style={styles.clientPageHeroRow}>
        {Icon ? (
          <View style={styles.clientPageHeroIcon}>
            <Icon color={kinetixColors.lime} size={22} strokeWidth={2.3} />
          </View>
        ) : null}
        <View style={styles.clientPageHeroCopy}>
          <Text style={styles.clientPageHeroTitle}>{title}</Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.clientPageHeroSub}>{subtitle}</Text>
          ) : null}
        </View>
        <PressableScale
          accessibilityLabel="Открыть меню"
          accessibilityRole="button"
          onPress={onOpenMenu}
          style={styles.clientHeroMenu}
        >
          <MenuIcon color={kinetixColors.lime} size={22} strokeWidth={2.4} />
        </PressableScale>
      </View>
    </View>
  );
}

// Единый тёмный заголовок для водительских вложенных вкладок (Лента, Доход,
// Профиль) — тот же язык, что и на клиентских экранах, только без меню:
// водитель переключается нижними табами.
function DriverPageHero({
  Icon,
  menuButton,
  onOpenMenu,
  subtitle,
  title,
}: {
  Icon: ComponentType<LucideProps>;
  menuButton?: boolean;
  onOpenMenu?: () => void;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.clientPageHero}>
      <View style={styles.clientHeroGlow} />
      <View style={styles.clientPageHeroRow}>
        <View style={styles.clientPageHeroIcon}>
          <Icon color={kinetixColors.lime} size={22} strokeWidth={2.3} />
        </View>
        <View style={styles.clientPageHeroCopy}>
          <Text style={styles.clientPageHeroTitle}>{title}</Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.clientPageHeroSub}>{subtitle}</Text>
          ) : null}
        </View>
        {menuButton && onOpenMenu ? (
          <PressableScale
            accessibilityLabel="Открыть меню"
            accessibilityRole="button"
            onPress={onOpenMenu}
            style={styles.clientHeroMenu}
          >
            <MenuIcon color={kinetixColors.lime} size={22} strokeWidth={2.4} />
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

function ClientOrdersPage({
  onOpenActiveOrder,
  onOpenMenu,
  onOpenOrderHistory,
  onOpenSavedPlace,
  onOrderHome,
  orderSummary,
  savedHomeAddressLabel,
}: {
  orderSummary?: ClientOrderSummary;
  savedHomeAddressLabel?: string;
  onOpenActiveOrder?: () => void;
  onOpenMenu: () => void;
  onOpenOrderHistory: () => void;
  onOpenSavedPlace: () => void;
  onOrderHome: () => void;
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
      <ClientPageHeader
        Icon={Route}
        onOpenMenu={onOpenMenu}
        subtitle="Адреса, активные и завершённые"
        title="Заказы"
      />

      <View style={styles.clientFavSection}>
        <Text style={styles.clientFavTitle}>Частые адреса</Text>
        {savedHomeAddressLabel ? (
          <PressableScale
            accessibilityLabel="Поездка домой"
            accessibilityRole="button"
            onPress={onOrderHome}
            style={styles.clientFavRow}
          >
            <View style={styles.clientFavIcon}>
              <Home color={kinetixColors.amber} size={20} strokeWidth={2.3} />
            </View>
            <View style={styles.clientActionCopy}>
              <Text numberOfLines={1} style={styles.clientFavName}>Домой</Text>
              <Text numberOfLines={1} style={styles.clientFavAddr}>{savedHomeAddressLabel}</Text>
            </View>
            <ChevronRight color="#C2D2C9" size={20} strokeWidth={2.4} />
          </PressableScale>
        ) : null}
        <PressableScale
          accessibilityLabel={savedHomeAddressLabel ? 'Изменить адрес' : 'Добавить адрес'}
          accessibilityRole="button"
          onPress={onOpenSavedPlace}
          style={styles.clientFavAdd}
        >
          <Plus color={kinetixColors.amber} size={18} strokeWidth={2.6} />
          <Text style={styles.clientFavAddText}>
            {savedHomeAddressLabel ? 'Изменить адрес' : 'Добавить адрес'}
          </Text>
        </PressableScale>
      </View>

      {onOpenActiveOrder && summary.activeOrder ? (
        <PressableScale
          accessibilityLabel="Открыть текущий заказ"
          accessibilityRole="button"
          onPress={onOpenActiveOrder}
          style={styles.activeOrderCard}
        >
          <View style={styles.activeOrderIcon}>
            <Route color="#06140D" size={20} strokeWidth={2.6} />
          </View>
          <View style={styles.activeOrderCopy}>
            <Text numberOfLines={1} style={styles.activeOrderLabel}>
              Текущий заказ · {summary.activeOrder.statusLabel}
            </Text>
            <Text numberOfLines={1} style={styles.activeOrderRoute}>
              {summary.activeOrder.routeTitle ?? summary.activeOrder.routeLabel}
            </Text>
          </View>
          <Text style={styles.activeOrderArrow}>→</Text>
        </PressableScale>
      ) : null}

      <Text style={styles.clientFavTitle}>Мои поездки</Text>

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

function ProfileListRow({
  Icon,
  badge,
  badgeTone = 'ok',
  first = false,
  onPress,
  subtitle,
  title,
}: {
  Icon: ComponentType<LucideProps>;
  badge?: string;
  badgeTone?: 'ok' | 'warn';
  first?: boolean;
  onPress: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <PressableScale
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.profileListRow, !first && styles.profileListRowDivider]}
    >
      <View style={styles.clientFavIcon}>
        <Icon color={kinetixColors.amber} size={19} strokeWidth={2.3} />
      </View>
      <View style={styles.clientActionCopy}>
        <Text numberOfLines={1} style={styles.clientFavName}>{title}</Text>
        <Text numberOfLines={1} style={styles.clientFavAddr}>{subtitle}</Text>
      </View>
      {badge ? (
        <Text style={[styles.profileRowBadge, badgeTone === 'warn' && styles.profileRowBadgeWarn]}>
          {badge}
        </Text>
      ) : null}
      <ChevronRight color="#C2D2C9" size={20} strokeWidth={2.4} />
    </PressableScale>
  );
}

function ClientAccountPage({
  displayName,
  onDeleteAccount,
  onOpenMenu,
  onOpenReferral,
  onOpenSavedPlace,
  onOpenSupportChat,
  orderSummary,
  savedHomeAddressLabel,
}: {
  displayName: string;
  orderSummary?: ClientOrderSummary;
  savedHomeAddressLabel?: string;
  onDeleteAccount: () => void;
  onOpenMenu: () => void;
  onOpenReferral: () => void;
  onOpenSavedPlace: () => void;
  onOpenSupportChat: () => void;
}) {
  const { currentUser, referralDashboard } = useAppState();
  const [doNotCall, setDoNotCall] = useState(false);
  const [shareLocation, setShareLocation] = useState(true);
  const initials = getInitials(displayName);
  const contactLine = [currentUser?.phone || currentUser?.email, 'Салаватский район']
    .filter(Boolean)
    .join(' · ');
  const isVerified =
    currentUser?.verificationStatus === 'approved' ||
    Boolean(currentUser?.phoneVerifiedAt || currentUser?.emailVerifiedAt);
  const bonusBalance = referralDashboard?.bonusBalance ?? currentUser?.bonusBalance ?? 0;
  const referralReward = referralDashboard?.rewards?.clientReward ?? 60;

  return (
    <View style={styles.clientFocusPage}>
      <ClientPageHeader Icon={User} onOpenMenu={onOpenMenu} subtitle="Профиль и настройки" title="Аккаунт" />

      <StaggerView index={0} style={styles.accountProfileCard}>
        <View style={styles.profileCardTop}>
          <View style={styles.accountProfileAvatar}>
            <Text style={styles.accountProfileAvatarText}>{initials}</Text>
          </View>
          <View style={styles.clientActionCopy}>
            <Text numberOfLines={1} style={styles.accountProfileName}>{displayName}</Text>
            <Text numberOfLines={1} style={styles.accountProfileMeta}>{contactLine}</Text>
          </View>
          {isVerified ? <Text style={styles.profileRowBadge}>✓ Подтверждён</Text> : null}
        </View>
        <View style={styles.profileStatsRow}>
          <View style={styles.profileStat}>
            <Text numberOfLines={1} style={styles.profileStatValue}>{orderSummary?.totalCount ?? 0}</Text>
            <Text numberOfLines={1} style={styles.profileStatLabel}>поездок</Text>
          </View>
          <View style={styles.profileStat}>
            <Text numberOfLines={1} style={styles.profileStatValue}>{orderSummary?.totalSpent ?? 0} ₽</Text>
            <Text numberOfLines={1} style={styles.profileStatLabel}>на поездки</Text>
          </View>
          <View style={styles.profileStat}>
            <Text numberOfLines={1} style={styles.profileStatValue}>{bonusBalance} ₽</Text>
            <Text numberOfLines={1} style={styles.profileStatLabel}>бонусы</Text>
          </View>
        </View>
      </StaggerView>

      <StaggerView index={1} style={styles.profileList}>
        <ProfileListRow
          Icon={Home}
          first
          onPress={onOpenSavedPlace}
          subtitle={savedHomeAddressLabel ?? 'Дом и частые точки'}
          title="Сохранённые адреса"
        />
        <ProfileListRow
          Icon={Gift}
          badge={`+${referralReward} ₽`}
          onPress={onOpenReferral}
          subtitle="Бонусы за клиентов и водителей"
          title="Пригласить друзей"
        />
        <ProfileListRow
          Icon={Headphones}
          onPress={onOpenSupportChat}
          subtitle="Вопросы по поездкам"
          title="Поддержка"
        />
      </StaggerView>

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

      <PressableScale
        accessibilityLabel="Удалить аккаунт"
        accessibilityRole="button"
        onPress={onDeleteAccount}
        style={styles.accountDangerRow}
      >
        <View style={styles.accountDangerIcon}>
          <Trash2 color="#FF3B30" size={19} strokeWidth={2.2} />
        </View>
        <View style={styles.clientActionCopy}>
          <Text numberOfLines={1} style={styles.accountDangerName}>Удалить аккаунт</Text>
          <Text numberOfLines={1} style={styles.clientFavAddr}>Стирает профиль и данные</Text>
        </View>
      </PressableScale>
    </View>
  );
}

function ClientAboutPage({
  onOpenMenu,
  onOpenSupportChat,
}: {
  onOpenMenu: () => void;
  onOpenSupportChat: () => void;
}) {
  const features = [
    { Icon: Car, title: 'Заказ такси', text: 'Машина по селу и району за пару касаний' },
    { Icon: Package, title: 'Доставка', text: 'Привезём и передадим по адресу' },
    { Icon: Wallet, title: 'Честная цена', text: 'Стоимость известна ещё до заказа' },
    { Icon: ShieldCheck, title: 'Местные водители', text: 'Знают дороги Салаватского района' },
  ];

  return (
    <View style={styles.clientFocusPage}>
      <ClientPageHeader
        Icon={Star}
        onOpenMenu={onOpenMenu}
        subtitle="Kinetix · Салаватский район"
        title="О приложении"
      />

      <View style={styles.aboutBrandCard}>
        <View style={styles.aboutBrandTile}>
          <Text style={styles.aboutBrandMark}>K</Text>
        </View>
        <View style={styles.aboutBrandCopy}>
          <Text style={styles.aboutBrandName}>Kinetix</Text>
          <Text style={styles.aboutBrandSub}>Локальное такси и доставка</Text>
        </View>
        <View style={styles.aboutVersionPill}>
          <Text style={styles.aboutVersionText}>v1.0.0</Text>
        </View>
      </View>

      <View style={styles.aboutSection}>
        <Text style={styles.aboutSectionTitle}>Что умеет приложение</Text>
        {features.map(({ Icon, text, title }) => (
          <View key={title} style={styles.aboutRow}>
            <View style={styles.aboutRowIcon}>
              <Icon color={kinetixColors.amber} size={19} strokeWidth={2.35} />
            </View>
            <View style={styles.aboutRowCopy}>
              <Text style={styles.aboutRowTitle}>{title}</Text>
              <Text style={styles.aboutRowText}>{text}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.aboutHonestCard}>
        <View style={styles.aboutHonestGlow} />
        <View style={styles.aboutHonestIcon}>
          <ShieldCheck color={kinetixColors.lime} size={18} strokeWidth={2.4} />
        </View>
        <Text style={styles.aboutHonestText}>
          Цена известна до заказа, номер телефона скрыт, а водители — из Салаватского района.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onOpenSupportChat}
        style={({ pressed }) => [styles.clientHistoryButton, pressed && styles.pressed]}
      >
        <Headphones color="#F4FAF6" size={20} strokeWidth={2.5} />
        <Text style={styles.clientHistoryButtonText}>Поддержка</Text>
      </Pressable>

      <Text style={styles.aboutMeta}>Версия 1.0.0 · Сделано для Салаватского района</Text>
    </View>
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
      title: 'Статус заказа',
      text: activeOrder?.statusLabel ?? 'Покажем в заказе',
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

      <PressableScale
        accessibilityRole="button"
        onPress={onOpenOrderFlow}
        style={styles.commandPrimaryButton}
      >
        <Text style={styles.commandPrimaryButtonText}>Заказать поездку</Text>
        <Route color="#F4FAF6" size={19} strokeWidth={2.4} />
      </PressableScale>

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
          <Text style={styles.routePreviewText}>После заказа: кто едет, сколько ждать, что дальше.</Text>
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
  driverLine,
  driverStats,
  isSelfEmployedDriver,
  menuButton,
  onOpenMenu,
  onOpenOrderFlow,
  onOpenSubscription,
  onToggleDriverLine,
}: DriverCommandCenterProps & { appTitle: string; menuButton?: boolean; onOpenMenu?: () => void }) {
  return (
    <View style={styles.driverHome}>
      <DriverCommandCenter
        driverLine={driverLine}
        driverStats={driverStats}
        isSelfEmployedDriver={isSelfEmployedDriver}
        menuButton={menuButton}
        onOpenMenu={onOpenMenu}
        onOpenOrderFlow={onOpenOrderFlow}
        onOpenSubscription={onOpenSubscription}
        onToggleDriverLine={onToggleDriverLine}
      />
    </View>
  );
}

function DriverCommandCenter({
  driverLine,
  driverStats,
  isSelfEmployedDriver,
  menuButton,
  onOpenMenu,
  onOpenOrderFlow,
  onOpenSubscription,
  onToggleDriverLine,
}: DriverCommandCenterProps & { menuButton?: boolean; onOpenMenu?: () => void }) {
  const online = driverLine.isOnline;
  const requiresPayment = !online && !driverLine.canToggle && Boolean(driverLine.requiresPayment);
  const ctaActionable = online || driverLine.canToggle || requiresPayment;
  const lineLabel = online ? 'Вы на линии' : 'Вы не на линии';
  const lineHint = driverLine.canToggle
    ? online
      ? 'Смена активна — заказы придут в ленту'
      : 'Готовы принимать заказы'
    : requiresPayment
      ? 'Смена платная — оплатите доступ, чтобы выйти на линию'
      : `Доступ: ${driverLine.status}`;
  const blockers = formatDriverBlockers(driverLine.accessBlockers ?? []);
  const [statsOpen, setStatsOpen] = useState(false);

  const handleCtaPress = () => {
    if (requiresPayment) {
      onOpenSubscription();
      return;
    }

    onToggleDriverLine?.();
  };

  const stats = [
    { Icon: BriefcaseBusiness, label: 'заказы', value: String(driverStats?.todayOrders ?? 0) },
    { Icon: Wallet, label: 'сегодня', value: `${driverStats?.grossToday ?? 0} ₽` },
    {
      Icon: ShieldCheck,
      label: formatDriverAccessUntil(driverStats),
      value: formatDriverAccessLabel(driverStats),
    },
  ];

  return (
    <>
      <StaggerView index={0} style={styles.driverHero}>
        <View style={styles.driverHeroGlow} />
        <View style={styles.driverHeroTop}>
          <Text style={styles.driverHeroEyebrow}>{isSelfEmployedDriver ? 'Смена' : 'Линия'}</Text>
          <View style={styles.driverHeroTopRight}>
            <View style={[styles.driverHeroPill, online && styles.driverHeroPillOn]}>
              <View style={[styles.driverHeroDot, online && styles.driverHeroDotOn]} />
              <Text style={[styles.driverHeroPillText, online && styles.driverHeroPillTextOn]}>
                {online ? 'В сети' : 'Не в сети'}
              </Text>
            </View>
            {menuButton && onOpenMenu ? (
              <PressableScale
                accessibilityLabel="Открыть меню"
                accessibilityRole="button"
                onPress={onOpenMenu}
                style={styles.clientHeroMenu}
              >
                <MenuIcon color={kinetixColors.lime} size={22} strokeWidth={2.4} />
              </PressableScale>
            ) : null}
          </View>
        </View>
        <Text style={styles.driverHeroTitle}>{lineLabel}</Text>
        <Text numberOfLines={2} style={styles.driverHeroSub}>{lineHint}</Text>
        <View style={styles.driverHeroSpacer} />
        <PressableScale
          accessibilityRole="button"
          disabled={!ctaActionable}
          onPress={handleCtaPress}
          style={[
            styles.driverHeroCta,
            online && styles.driverHeroCtaStop,
            !ctaActionable && styles.driverHeroCtaDisabled,
          ]}
        >
          {requiresPayment ? (
            <CreditCard color="#0A1411" size={19} strokeWidth={2.5} />
          ) : (
            <Route color={online ? '#F2FBF6' : '#0A1411'} size={19} strokeWidth={2.5} />
          )}
          <Text style={[styles.driverHeroCtaText, online && styles.driverHeroCtaTextStop]}>
            {online ? 'Завершить смену' : requiresPayment ? 'Оплатить и выйти на линию' : 'Выйти на линию'}
          </Text>
        </PressableScale>
      </StaggerView>

      <StaggerView index={1} style={styles.driverStatsRow}>
        {stats.map(({ Icon, label, value }) => (
          <View key={label} style={styles.driverStatCard}>
            <View style={styles.driverStatIcon}>
              <Icon color={kinetixColors.amber} size={17} strokeWidth={2.35} />
            </View>
            <Text numberOfLines={1} style={styles.driverStatValue}>{value}</Text>
            <Text numberOfLines={1} style={styles.driverStatLabel}>{label}</Text>
          </View>
        ))}
      </StaggerView>

      <StaggerView index={2}>
        <View style={[styles.driverAccessCard, !driverLine.canToggle && styles.driverAccessCardWarn]}>
          <View style={[styles.driverAccessCardIcon, !driverLine.canToggle && styles.driverAccessCardIconWarn]}>
            <ShieldCheck
              color={driverLine.canToggle ? kinetixColors.amber : '#C0890F'}
              size={18}
              strokeWidth={2.4}
            />
          </View>
          <View style={styles.driverAccessCardCopy}>
            <Text style={styles.driverAccessCardTitle}>
              {driverLine.canToggle ? 'Допуск готов' : 'Нужны действия'}
            </Text>
            <Text numberOfLines={2} style={styles.driverAccessCardText}>
              {driverLine.canToggle ? 'Можно принимать заказы.' : `Не закрыто: ${blockers}`}
            </Text>
          </View>
        </View>
      </StaggerView>

      <StaggerView index={3} style={styles.driverActionRow}>
        <PressableScale
          accessibilityRole="button"
          onPress={onOpenOrderFlow}
          style={styles.driverActionBtn}
        >
          <BriefcaseBusiness color={kinetixColors.amber} size={18} strokeWidth={2.4} />
          <Text style={styles.driverActionText}>Заказы</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          onPress={onOpenSubscription}
          style={styles.driverActionBtn}
        >
          <Wallet color={kinetixColors.amber} size={18} strokeWidth={2.4} />
          <Text style={styles.driverActionText}>Оплата</Text>
        </PressableScale>
        <PressableScale
          accessibilityLabel="Статистика"
          accessibilityRole="button"
          onPress={() => setStatsOpen((current) => !current)}
          style={[styles.driverActionBtn, statsOpen && styles.driverActionBtnActive]}
        >
          <BarChart3
            color={statsOpen ? '#0A1411' : kinetixColors.amber}
            size={18}
            strokeWidth={2.4}
          />
          <Text style={[styles.driverActionText, statsOpen && styles.driverActionTextActive]}>
            Статы
          </Text>
        </PressableScale>
      </StaggerView>

      {statsOpen && driverStats ? (
        <StaggerView index={4}>
          <DriverStatsPanel stats={driverStats} />
        </StaggerView>
      ) : null}
    </>
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
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.bottomTab,
        clientMode && styles.clientBottomTab,
        active && (clientMode ? styles.clientBottomTabActive : styles.bottomTabActive),
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
    </PressableScale>
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
      duration: reducedMotion ? 0 : 300,
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
            {items.map((item, index) => {
              const active = item.id === activeItemId;

              return (
                <DrawerMenuItem
                  active={active}
                  index={index}
                  item={item}
                  key={item.id}
                  onPress={() => onItemPress(item)}
                  progress={progress}
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
  index: number;
  item: MenuItem;
  onPress: () => void;
  progress: Animated.Value;
};

function DrawerMenuItem({ active, index, item, onPress, progress }: DrawerMenuItemProps) {
  const Icon = iconMap[item.icon];
  const start = Math.min(0.55, index * 0.07);
  const end = Math.min(1, start + 0.45);
  const cascadeStyle = {
    opacity: progress.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [start, end],
          outputRange: [-26, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  return (
    <Animated.View style={cascadeStyle}>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={[styles.drawerItem, active && styles.drawerItemActive]}
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
      </PressableScale>
    </Animated.View>
  );
}

type QuickActionCardProps = {
  action: QuickAction;
  actionIndex?: number;
  onActionTarget: (target?: MenuActionTarget, supportCategory?: string) => void;
};

function QuickActionCard({ action, actionIndex = 0, onActionTarget }: QuickActionCardProps) {
  const Icon = iconMap[action.icon];

  return (
    <StaggerView index={actionIndex} style={styles.quickGridItem}>
      <PressableScale
        accessibilityRole="button"
        onPress={() => onActionTarget(action.target, action.supportCategory)}
        style={styles.quickCard}
      >
        <View style={styles.quickIconWrap}>
          <Icon color="#008D49" size={21} strokeWidth={2.3} />
        </View>
        <Text numberOfLines={2} style={styles.quickTitle}>{action.title}</Text>
        <Text numberOfLines={2} style={styles.quickSubtitle}>{action.subtitle}</Text>
      </PressableScale>
    </StaggerView>
  );
}

function DriverPayoutsPage({
  onActionTarget,
  stats,
}: {
  onActionTarget: (target?: MenuActionTarget, supportCategory?: string) => void;
  stats?: DriverStatsSummary;
}) {
  const [statsOpen, setStatsOpen] = useState(false);
  const activePlan = stats?.billingMode ?? 'daily';
  const todayGross = stats?.grossToday ?? 0;
  const todayOrders = stats?.todayOrders ?? 0;
  const accessUntil = formatDriverAccessUntil(stats);

  return (
    <View style={styles.payoutPage}>
      <StaggerView index={0} style={styles.payoutHeroCard}>
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
      </StaggerView>

      <StaggerView index={1} style={styles.payoutTariffRow}>
        <PressableScale
          accessibilityLabel="Дневной доступ"
          accessibilityRole="button"
          onPress={() => onActionTarget('subscription')}
          style={[styles.payoutTariffChip, activePlan === 'daily' && styles.payoutTariffChipActive]}
        >
          <Text style={[styles.payoutTariffTitle, activePlan === 'daily' && styles.payoutTariffTitleActive]}>
            День
          </Text>
          <Text style={[styles.payoutTariffText, activePlan === 'daily' && styles.payoutTariffTextActive]}>
            120 ₽
          </Text>
        </PressableScale>
        <PressableScale
          accessibilityLabel="Партнёр PRO"
          accessibilityRole="button"
          onPress={() => onActionTarget('subscription')}
          style={[styles.payoutTariffChip, activePlan === 'monthly' && styles.payoutTariffChipActive]}
        >
          <Text style={[styles.payoutTariffTitle, activePlan === 'monthly' && styles.payoutTariffTitleActive]}>
            PRO
          </Text>
          <Text style={[styles.payoutTariffText, activePlan === 'monthly' && styles.payoutTariffTextActive]}>
            3 290 ₽
          </Text>
        </PressableScale>
      </StaggerView>

      <StaggerView index={2} style={styles.payoutActionsRow}>
        <PressableScale
          accessibilityLabel="Оплатить доступ"
          accessibilityRole="button"
          onPress={() => onActionTarget('subscription')}
          style={styles.payoutPayButton}
        >
          <CreditCard color="#F4FAF6" size={18} strokeWidth={2.4} />
          <Text style={styles.payoutPayButtonText}>
            {activePlan === 'monthly' ? 'Оплатить PRO' : 'Оплатить смену 120 ₽'}
          </Text>
        </PressableScale>
        <PressableScale
          accessibilityLabel="Статистика"
          accessibilityRole="button"
          onPress={() => setStatsOpen((current) => !current)}
          style={[styles.payoutStatsButton, statsOpen && styles.payoutStatsButtonActive]}
        >
          <Text style={[styles.payoutStatsButtonText, statsOpen && styles.payoutStatsButtonTextActive]}>
            Статистика
          </Text>
        </PressableScale>
      </StaggerView>

      {statsOpen && stats ? (
        <StaggerView index={3}>
          <DriverStatsPanel stats={stats} />
        </StaggerView>
      ) : null}
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
  const { currentUser, drivers } = useAppState();
  const currentDriver = currentUser
    ? drivers.find((driver) => driver.userId === currentUser.id)
    : undefined;
  const initials = getInitials(displayName);
  const vehicleLine = [currentDriver?.vehicle, currentDriver?.plate].filter(Boolean).join(' · ');
  const accessActive = currentDriver?.subscriptionStatus === 'active';
  const accessBadge = accessActive
    ? `${formatDriverAccessLabel(driverStats)} · ${formatDriverAccessUntil(driverStats)}`
    : 'Нет доступа';
  const documentsBadge =
    currentDriver?.documentsStatus === 'approved'
      ? { label: 'Одобрены', tone: 'ok' as const }
      : currentDriver?.documentsStatus === 'pending'
        ? { label: 'На проверке', tone: 'warn' as const }
        : currentDriver?.documentsStatus === 'rejected'
          ? { label: 'Отклонены', tone: 'warn' as const }
          : { label: 'Нет файлов', tone: 'warn' as const };
  const rating = currentDriver?.rating;

  return (
    <View style={styles.clientFocusPage}>
      <StaggerView index={0} style={styles.accountProfileCard}>
        <View style={styles.profileCardTop}>
          <View style={styles.accountProfileAvatar}>
            <Text style={styles.accountProfileAvatarText}>{initials}</Text>
          </View>
          <View style={styles.clientActionCopy}>
            <Text numberOfLines={1} style={styles.accountProfileName}>{displayName}</Text>
            <Text numberOfLines={1} style={styles.accountProfileMeta}>
              {vehicleLine || 'Водитель-партнёр'}
            </Text>
          </View>
          <Text style={[styles.profileRowBadge, !accessActive && styles.profileRowBadgeWarn]}>
            {accessBadge}
          </Text>
        </View>
        <View style={styles.profileStatsRow}>
          <View style={styles.profileStat}>
            <Text numberOfLines={1} style={styles.profileStatValue}>
              {rating ? `★ ${rating.toFixed(2)}` : '★ —'}
            </Text>
            <Text numberOfLines={1} style={styles.profileStatLabel}>рейтинг</Text>
          </View>
          <View style={styles.profileStat}>
            <Text numberOfLines={1} style={styles.profileStatValue}>{driverStats?.todayOrders ?? 0}</Text>
            <Text numberOfLines={1} style={styles.profileStatLabel}>заказы</Text>
          </View>
          <View style={styles.profileStat}>
            <Text numberOfLines={1} style={styles.profileStatValue}>{driverStats?.grossToday ?? 0} ₽</Text>
            <Text numberOfLines={1} style={styles.profileStatLabel}>сегодня</Text>
          </View>
        </View>
      </StaggerView>

      <StaggerView index={1} style={styles.profileList}>
        <ProfileListRow
          Icon={ShieldCheck}
          badge={documentsBadge.label}
          badgeTone={documentsBadge.tone}
          first
          onPress={() => onActionTarget('documents')}
          subtitle="Паспорт, ВУ, СТС, ОСАГО"
          title="Документы"
        />
        <ProfileListRow
          Icon={CreditCard}
          badge={accessActive ? formatDriverAccessUntil(driverStats) : undefined}
          badgeTone={accessActive ? 'ok' : 'warn'}
          onPress={() => onActionTarget('subscription')}
          subtitle="120 ₽ день · 3 290 ₽ PRO"
          title="Тариф и оплата"
        />
        <ProfileListRow
          Icon={Route}
          onPress={() => onActionTarget('history')}
          subtitle="Поездки и суммы"
          title="История заказов"
        />
        <ProfileListRow
          Icon={Gift}
          onPress={() => onActionTarget('referral')}
          subtitle="Бонус за водителей и клиентов"
          title="Пригласить друзей"
        />
        <ProfileListRow
          Icon={Headphones}
          onPress={() => onActionTarget('supportChat')}
          subtitle="Помощь по заказам и допуску"
          title="Поддержка"
        />
      </StaggerView>

      <StaggerView index={2}>
        <PressableScale
          accessibilityLabel="Удалить аккаунт"
          accessibilityRole="button"
          onPress={() => onActionTarget('deleteAccount')}
          style={styles.accountDangerRow}
        >
          <View style={styles.accountDangerIcon}>
            <Trash2 color="#FF3B30" size={19} strokeWidth={2.2} />
          </View>
          <View style={styles.clientActionCopy}>
            <Text numberOfLines={1} style={styles.accountDangerName}>Удалить аккаунт</Text>
            <Text numberOfLines={1} style={styles.clientFavAddr}>Стирает профиль и данные</Text>
          </View>
        </PressableScale>
      </StaggerView>
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
  menuButton?: boolean;
  onAcceptDriverOrder?: (orderId: string) => void | Promise<void>;
  onActionTarget: (target?: MenuActionTarget, supportCategory?: string) => void;
  onOpenMenu?: () => void;
  page: SectionPage;
};

function SectionPageView({
  activeItemId,
  displayName,
  driverFeedBusyId,
  driverFeedLockedReason,
  driverFeedOrders = [],
  driverStats,
  menuButton,
  onAcceptDriverOrder,
  onActionTarget,
  onOpenMenu,
  page,
}: SectionPageViewProps) {
  const Icon = iconMap[page.icon];
  const showDriverFeed = activeItemId === 'orders' && Boolean(onAcceptDriverOrder);

  if (activeItemId === 'payouts') {
    return (
      <>
        <DriverPageHero
          Icon={Wallet}
          menuButton={menuButton}
          onOpenMenu={onOpenMenu}
          subtitle="Оплата доступа и статистика — без процента с заказов"
          title="Доход"
        />

        <DriverPayoutsPage onActionTarget={onActionTarget} stats={driverStats} />
      </>
    );
  }

  if (activeItemId === 'profile') {
    return (
      <>
        <DriverPageHero
          Icon={User}
          menuButton={menuButton}
          onOpenMenu={onOpenMenu}
          subtitle="Данные, документы и настройки водителя"
          title="Профиль"
        />

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
        <DriverPageHero
          Icon={Route}
          menuButton={menuButton}
          onOpenMenu={onOpenMenu}
          subtitle="Заказы рядом — расстояние, адрес и цена"
          title="Лента заказов"
        />

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
      <DriverPageHero
        Icon={Icon}
        menuButton={menuButton}
        onOpenMenu={onOpenMenu}
        subtitle={page.subtitle}
        title={page.title}
      />

      <View style={styles.metricsGrid}>
        {page.metrics.map((metric) => (
          <View key={metric.label} style={styles.metricCard}>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text numberOfLines={2} style={styles.metricLabel}>{metric.label}</Text>
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
          {page.quickActions.map((action, actionIndex) => (
            <QuickActionCard
              action={action}
              actionIndex={actionIndex}
              key={action.id}
              onActionTarget={onActionTarget}
            />
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
          <Text style={styles.fleetInviteText}>Откройте анкету — водитель заполнит её сам.</Text>
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
          <Text style={styles.driverFeedTitle}>Заказы рядом</Text>
          <Text numberOfLines={1} style={styles.driverFeedSubtitle}>
            Обновляется в реальном времени
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
          {visibleOrders.map((order, orderIndex) => {
            const detailsOpen = detailsOrderId === order.id;

            return (
              <StaggerView key={order.id} index={orderIndex} style={styles.driverFeedCard}>
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
                  <PressableScale
                    accessibilityLabel="Информация о заказе"
                    accessibilityRole="button"
                    onPress={() => toggleDetailsOrder(order.id)}
                    style={[styles.driverFeedInfoButton, detailsOpen && styles.driverFeedInfoButtonActive]}
                  >
                    <Text style={[styles.driverFeedInfoText, detailsOpen && styles.driverFeedInfoTextActive]}>i</Text>
                  </PressableScale>
                  <PressableScale
                    accessibilityLabel="Принять заказ"
                    accessibilityRole="button"
                    disabled={disabled}
                    onPress={() => onAcceptOrder?.(order.id)}
                    style={[
                      styles.driverFeedAcceptButton,
                      styles.driverFeedAcceptButtonWide,
                      disabled && styles.disabledButton,
                    ]}
                  >
                    <Text style={styles.driverFeedAcceptText}>
                      {busyId === order.id ? '...' : 'Принять'}
                    </Text>
                  </PressableScale>
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
              </StaggerView>
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

      <PressableScale
        accessibilityLabel="Открыть полный экран"
        accessibilityRole="button"
        onPress={onOpenFullFeed}
        style={styles.driverFeedFullButton}
      >
        <Text style={styles.driverFeedFullButtonText}>Открыть полный экран</Text>
      </PressableScale>
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
      <Text style={styles.metricValue}>{value}</Text>
      <Text numberOfLines={2} style={styles.metricLabel}>{label}</Text>
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
