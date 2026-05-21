import { ComponentType, useMemo, useState } from 'react';
import {
  Pressable,
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
  ReceiptText,
  Route,
  ShieldCheck,
  Star,
  UsersRound,
  Wallet,
} from 'lucide-react-native';

import { AccountRole, roleCopy } from '../data/registration';
import {
  MenuActionTarget,
  MenuIconName,
  MenuItem,
  QuickAction,
  roleMenuConfig,
} from '../data/menu';
import { SectionPage, SectionRow, sectionPages } from '../data/sectionPages';

type PostRegistrationMenuProps = {
  role: AccountRole;
  firstName?: string;
  availableCarsCount?: number;
  driverLine?: {
    canToggle: boolean;
    isOnline: boolean;
    status: string;
  };
  onBackToRegistration: () => void;
  onToggleDriverLine?: () => void;
  onOpenOrderFlow: () => void;
  onOpenOrderHistory: () => void;
  onOpenSavedPlace: () => void;
  onOpenSubscription: () => void;
  onOpenSupportChat: () => void;
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
  driverLine,
  firstName,
  onBackToRegistration,
  onToggleDriverLine,
  onOpenOrderHistory,
  onOpenOrderFlow,
  onOpenSavedPlace,
  onOpenSubscription,
  onOpenSupportChat,
  role,
}: PostRegistrationMenuProps) {
  const { width } = useWindowDimensions();
  const config = roleMenuConfig[role];
  const isWide = width >= 820;
  const [activeItemId, setActiveItemId] = useState(config.menuItems[0].id);

  const activeItem = useMemo(
    () => config.menuItems.find((item) => item.id === activeItemId) ?? config.menuItems[0],
    [activeItemId, config.menuItems],
  );
  const activePage = useMemo(
    () => sectionPages[role][activeItem.id] ?? sectionPages[role][config.menuItems[0].id],
    [activeItem.id, config.menuItems, role],
  );
  const displayName = firstName?.trim() || 'Пользователь';

  const handleActionTarget = (target?: MenuActionTarget) => {
    if (target === 'order') {
      onOpenOrderFlow();
      return;
    }

    if (target === 'history') {
      onOpenOrderHistory();
      return;
    }

    if (target === 'subscription') {
      onOpenSubscription();
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

    if (target === 'registration') {
      onBackToRegistration();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Car color="#FFFFFF" size={24} strokeWidth={2.4} />
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.appName}>Такси Партнер</Text>
            <Text style={styles.appMeta}>{roleCopy[role].title}</Text>
          </View>
        </View>

        <View style={styles.topActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenOrderFlow}
            style={({ pressed }) => [styles.orderButton, pressed && styles.pressed]}
          >
            <Route color="#FFFFFF" size={18} strokeWidth={2.4} />
            <Text style={styles.orderButtonText}>{role === 'driver' ? 'Заказы' : 'Оформить заказ'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenOrderHistory}
            style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
          >
            <ReceiptText color="#146C5D" size={17} strokeWidth={2.4} />
            <Text style={styles.outlineButtonText}>История</Text>
          </Pressable>
          {role === 'driver' ? (
            <Pressable
              accessibilityRole="button"
              onPress={onOpenSubscription}
              style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
            >
              <Wallet color="#146C5D" size={17} strokeWidth={2.4} />
              <Text style={styles.outlineButtonText}>Подписка</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onBackToRegistration}
            style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
          >
            <Text style={styles.outlineButtonText}>К анкете</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.layout, isWide && styles.layoutWide]}>
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

          {role === 'client' ? (
            <Pressable
              accessibilityLabel={`Доступно машин: ${availableCarsCount}`}
              accessibilityRole="button"
              onPress={onOpenOrderFlow}
              style={({ pressed }) => [styles.availableCarsButton, pressed && styles.pressed]}
            >
              <View style={styles.availableCarsIcon}>
                <Car color="#FFFFFF" size={28} strokeWidth={2.5} />
              </View>
              <View style={styles.availableCarsCopy}>
                <Text style={styles.availableCarsLabel}>Доступно машин</Text>
                <Text style={styles.availableCarsValue}>{availableCarsCount}</Text>
                <Text style={styles.availableCarsHint}>Нажмите, чтобы заказать поездку</Text>
              </View>
            </Pressable>
          ) : null}

          {role === 'driver' ? (
            <Pressable
              accessibilityRole="button"
              disabled={!driverLine?.canToggle}
              onPress={onToggleDriverLine}
              style={({ pressed }) => [
                styles.driverLineButton,
                driverLine?.isOnline && styles.driverLineButtonOnline,
                !driverLine?.canToggle && styles.driverLineButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.driverLineIcon,
                  driverLine?.isOnline && styles.driverLineIconOnline,
                ]}
              >
                <Car
                  color={driverLine?.isOnline ? '#146C5D' : '#FFFFFF'}
                  size={26}
                  strokeWidth={2.5}
                />
              </View>
              <View style={styles.driverLineCopy}>
                <Text
                  style={[
                    styles.driverLineLabel,
                    driverLine?.isOnline && styles.driverLineTextOnline,
                  ]}
                >
                  Статус линии
                </Text>
                <Text
                  style={[
                    styles.driverLineValue,
                    driverLine?.isOnline && styles.driverLineTextOnline,
                  ]}
                >
                  {driverLine?.isOnline ? 'На линии' : 'Не на линии'}
                </Text>
                <Text
                  style={[
                    styles.driverLineHint,
                    driverLine?.isOnline && styles.driverLineTextOnline,
                  ]}
                >
                  {driverLine?.canToggle
                    ? driverLine.isOnline
                      ? 'Нажмите, чтобы уйти с линии'
                      : 'Нажмите, чтобы выйти на линию'
                    : `Доступ: ${driverLine?.status ?? 'нужен допуск'}`}
                </Text>
              </View>
            </Pressable>
          ) : null}

          <View style={styles.menuList}>
            {config.menuItems.map((item) => (
              <MenuButton
                active={item.id === activeItem.id}
                item={item}
                key={item.id}
                onPress={() => setActiveItemId(item.id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.main}>
          <SectionPageView
            appTitle={config.title}
            onActionTarget={handleActionTarget}
            page={activePage}
          />
        </View>
      </View>
    </ScrollView>
  );
}

type MenuButtonProps = {
  item: MenuItem;
  active: boolean;
  onPress: () => void;
};

function MenuButton({ active, item, onPress }: MenuButtonProps) {
  const Icon = iconMap[item.icon];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuButton,
        active && styles.menuButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.menuIconWrap, active && styles.menuIconWrapActive]}>
        <Icon color={active ? '#FFFFFF' : '#146C5D'} size={19} strokeWidth={2.3} />
      </View>
      <View style={styles.menuCopy}>
        <View style={styles.menuTitleRow}>
          <Text style={[styles.menuTitle, active && styles.menuTitleActive]}>{item.title}</Text>
          {item.badge ? <Text style={styles.badge}>{item.badge}</Text> : null}
        </View>
        <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
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
        <Icon color="#146C5D" size={21} strokeWidth={2.3} />
      </View>
      <Text style={styles.quickTitle}>{action.title}</Text>
      <Text style={styles.quickSubtitle}>{action.subtitle}</Text>
    </Pressable>
  );
}

type SectionPageViewProps = {
  appTitle: string;
  onActionTarget: (target?: MenuActionTarget) => void;
  page: SectionPage;
};

function SectionPageView({ appTitle, onActionTarget, page }: SectionPageViewProps) {
  const Icon = iconMap[page.icon];

  return (
    <>
      <View style={styles.routeRow}>
        <Text style={styles.routeText}>{appTitle}</Text>
        <Text style={styles.routeDivider}>/</Text>
        <Text style={styles.routeTextActive}>{page.title}</Text>
      </View>

      <View style={styles.heroPanel}>
        <View style={styles.heroIcon}>
          <Icon color="#146C5D" size={28} strokeWidth={2.4} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>{page.title}</Text>
          <Text style={styles.heroText}>{page.subtitle}</Text>
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

      <View style={styles.statusPanel}>
        <Text style={styles.statusTitle}>{page.statusTitle}</Text>
        <Text style={styles.statusText}>{page.statusText}</Text>
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
        <Text style={styles.panelSubtitle}>Основные операции этого раздела.</Text>
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
        <ShieldCheck color="#146C5D" size={18} strokeWidth={2.4} />
        <Text style={styles.noteText}>{page.note}</Text>
      </View>
    </>
  );
}

type SectionDataRowProps = {
  row: SectionRow;
};

function SectionDataRow({ row }: SectionDataRowProps) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionRowCopy}>
        <Text style={styles.sectionRowTitle}>{row.title}</Text>
        <Text style={styles.sectionRowSubtitle}>{row.subtitle}</Text>
      </View>
      <View style={styles.sectionRowMeta}>
        <Text style={styles.sectionRowValue}>{row.value}</Text>
        <Text style={styles.sectionRowStatus}>{row.status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  appMeta: {
    color: '#59616C',
    fontSize: 13,
    marginTop: 2,
  },
  appName: {
    color: '#20242A',
    fontSize: 18,
    fontWeight: '900',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#146C5D',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  availableCarsButton: {
    alignItems: 'center',
    backgroundColor: '#146C5D',
    borderColor: '#0B4C42',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 112,
    padding: 16,
  },
  availableCarsCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  availableCarsHint: {
    color: '#DCEFEB',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  availableCarsIcon: {
    alignItems: 'center',
    backgroundColor: '#0B4C42',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  availableCarsLabel: {
    color: '#DCEFEB',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  availableCarsValue: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 46,
  },
  badge: {
    backgroundColor: '#FFF3E5',
    borderRadius: 6,
    color: '#C75319',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  brandCopy: {
    minWidth: 0,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#146C5D',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 12,
    minWidth: 0,
  },
  contentPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  driverLineButton: {
    alignItems: 'center',
    backgroundColor: '#20242A',
    borderColor: '#20242A',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 104,
    padding: 16,
  },
  driverLineButtonDisabled: {
    backgroundColor: '#7A828C',
    borderColor: '#7A828C',
  },
  driverLineButtonOnline: {
    backgroundColor: '#E9F4F1',
    borderColor: '#146C5D',
  },
  driverLineCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  driverLineHint: {
    color: '#DDE5E2',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  driverLineIcon: {
    alignItems: 'center',
    backgroundColor: '#146C5D',
    borderRadius: 8,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  driverLineIconOnline: {
    backgroundColor: '#FFFFFF',
  },
  driverLineLabel: {
    color: '#DDE5E2',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  driverLineTextOnline: {
    color: '#0B4C42',
  },
  driverLineValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  heroPanel: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  heroText: {
    color: '#59616C',
    fontSize: 14,
    lineHeight: 20,
  },
  heroTitle: {
    color: '#20242A',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  hello: {
    color: '#20242A',
    fontSize: 16,
    fontWeight: '900',
  },
  layout: {
    gap: 18,
  },
  layoutWide: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  main: {
    flex: 1,
    gap: 14,
    minWidth: 0,
  },
  menuButton: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    padding: 12,
  },
  menuButtonActive: {
    backgroundColor: '#E9F4F1',
    borderColor: '#146C5D',
  },
  menuCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  menuIconWrap: {
    alignItems: 'center',
    backgroundColor: '#EAF1EF',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  menuIconWrapActive: {
    backgroundColor: '#146C5D',
  },
  menuList: {
    gap: 9,
  },
  menuSubtitle: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  menuTitle: {
    color: '#20242A',
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  menuTitleActive: {
    color: '#0B4C42',
  },
  menuTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 150,
    padding: 14,
  },
  metricHelper: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 16,
  },
  metricLabel: {
    color: '#59616C',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricValue: {
    color: '#20242A',
    fontSize: 22,
    fontWeight: '900',
  },
  notePanel: {
    alignItems: 'flex-start',
    backgroundColor: '#EEF5F3',
    borderColor: '#C5DDD7',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  noteText: {
    color: '#20242A',
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: '#146C5D',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  outlineButtonText: {
    color: '#146C5D',
    fontSize: 14,
    fontWeight: '900',
  },
  orderButton: {
    alignItems: 'center',
    backgroundColor: '#146C5D',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  orderButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#F4F7F5',
    gap: 18,
    minHeight: '100%',
    padding: 16,
  },
  panelSubtitle: {
    color: '#59616C',
    fontSize: 14,
    lineHeight: 20,
  },
  panelTitle: {
    color: '#20242A',
    fontSize: 20,
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
    minHeight: 46,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  profilePanel: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  profileStatus: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 18,
  },
  quickCard: {
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 132,
    minWidth: 180,
    padding: 14,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickIconWrap: {
    alignItems: 'center',
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  quickSubtitle: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  quickTitle: {
    color: '#20242A',
    fontSize: 15,
    fontWeight: '900',
  },
  routeDivider: {
    color: '#8A8F98',
    fontSize: 13,
    fontWeight: '800',
  },
  routeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  routeText: {
    color: '#59616C',
    fontSize: 13,
    fontWeight: '800',
  },
  routeTextActive: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionRow: {
    alignItems: 'flex-start',
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    padding: 13,
  },
  sectionRowCopy: {
    flex: 1,
    gap: 4,
    minWidth: 190,
  },
  sectionRowMeta: {
    alignItems: 'flex-end',
    gap: 4,
    minWidth: 92,
  },
  sectionRows: {
    gap: 9,
  },
  sectionRowStatus: {
    backgroundColor: '#E9F4F1',
    borderRadius: 6,
    color: '#146C5D',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  sectionRowSubtitle: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  sectionRowTitle: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionRowValue: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  sidebar: {
    gap: 12,
    width: '100%',
  },
  sidebarWide: {
    flexShrink: 0,
    width: 340,
  },
  statusPanel: {
    backgroundColor: '#E9F4F1',
    borderColor: '#C5DDD7',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  statusText: {
    color: '#59616C',
    fontSize: 14,
    lineHeight: 20,
  },
  statusTitle: {
    color: '#0B4C42',
    fontSize: 18,
    fontWeight: '900',
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    padding: 14,
  },
  topActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
