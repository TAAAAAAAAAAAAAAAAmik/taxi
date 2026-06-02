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
  LogOut,
  LucideProps,
  MapPinned,
  ReceiptText,
  Route,
  ShieldCheck,
  Star,
  UsersRound,
  Wallet,
} from 'lucide-react-native';

import {
  AccountRole,
  isDriverLikeRole,
  isSelfEmployedDriverRole,
  roleCopy,
} from '../data/registration';
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
  driverStats?: DriverStatsSummary;
  realtimeMessage?: string;
  realtimeStatus?: 'connecting' | 'live' | 'offline' | 'polling';
  realtimeUpdatedAt?: string;
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
  onOpenDriverDocuments: () => void;
  onOpenOrderHistory: () => void;
  onOpenReferral: () => void;
  onOpenSavedPlace: () => void;
  onOpenSubscription: () => void;
  onOpenSupportChat: () => void;
};

export type DriverStatsSummary = {
  todayOrders: number;
  weekOrders: number;
  monthOrders: number;
  gross: number;
  commissionFreeUntil?: string;
  driverNet: number;
  serviceShare: number;
  serviceShareRate: number;
  serviceShareToday: number;
  subscriptionCost: number;
  billingMode: 'monthly' | 'commission';
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
  driverStats,
  driverLine,
  firstName,
  realtimeMessage,
  realtimeStatus = 'connecting',
  realtimeUpdatedAt,
  simpleMode = false,
  onBackToRegistration,
  onDeleteAccount,
  onLogout,
  onToggleDriverLine,
  onToggleSimpleMode,
  onOpenOrderHistory,
  onOpenDriverDocuments,
  onOpenOrderFlow,
  onOpenReferral,
  onOpenSavedPlace,
  onOpenSubscription,
  onOpenSupportChat,
  role,
}: PostRegistrationMenuProps) {
  const { width } = useWindowDimensions();
  const config = roleMenuConfig[role] ?? roleMenuConfig.client;
  const pages = sectionPages[role] ?? sectionPages.client;
  const isWide = width >= 820;
  const isDriverRole = isDriverLikeRole(role);
  const isSelfEmployedDriver = isSelfEmployedDriverRole(role);
  const [activeItemId, setActiveItemId] = useState(config.menuItems[0].id);

  const activeItem = useMemo(
    () => config.menuItems.find((item) => item.id === activeItemId) ?? config.menuItems[0],
    [activeItemId, config.menuItems],
  );
  const activePage = useMemo(
    () => pages[activeItem.id] ?? pages[config.menuItems[0].id],
    [activeItem.id, config.menuItems, pages],
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

    if (target === 'documents') {
      onOpenDriverDocuments();
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
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Car color="#F5F0E8" size={24} strokeWidth={2.4} />
          </View>
        <View style={styles.brandCopy}>
          <Text style={styles.appName}>Такси Салават</Text>
          <Text style={styles.appMeta}>{roleCopy[role]?.title ?? roleCopy.client.title}</Text>
          <Text style={styles.liveText}>
            {formatRealtimeStatus(realtimeStatus)}
            {realtimeUpdatedAt ? ` · ${new Date(realtimeUpdatedAt).toLocaleTimeString('ru-RU')}` : ''}
          </Text>
        </View>
      </View>

        <View style={styles.topActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenOrderFlow}
            style={({ pressed }) => [styles.orderButton, pressed && styles.pressed]}
          >
            <Route color="#1E1C1A" size={18} strokeWidth={2.4} />
            <Text style={styles.orderButtonText}>{isDriverRole ? 'Заказы' : 'Вызвать'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenOrderHistory}
            style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
          >
            <ReceiptText color="#D4A853" size={17} strokeWidth={2.4} />
            <Text style={styles.outlineButtonText}>История</Text>
          </Pressable>
          {isSelfEmployedDriver ? (
            <Pressable
              accessibilityRole="button"
              onPress={onOpenSubscription}
              style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
            >
              <Wallet color="#D4A853" size={17} strokeWidth={2.4} />
              <Text style={styles.outlineButtonText}>Расчеты</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onBackToRegistration}
            style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
          >
            <Text style={styles.outlineButtonText}>К анкете</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onLogout}
            style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
          >
            <LogOut color="#D4A853" size={17} strokeWidth={2.4} />
            <Text style={styles.outlineButtonText}>Выйти</Text>
          </Pressable>
        </View>
      </View>

      {realtimeMessage ? (
        <View style={styles.livePanel}>
          <View style={[styles.liveDot, realtimeStatus === 'live' && styles.liveDotActive]} />
          <Text style={styles.livePanelText}>{realtimeMessage}</Text>
        </View>
      ) : null}

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
            <>
              <Pressable
                accessibilityLabel={`Доступно машин: ${availableCarsCount}`}
                accessibilityRole="button"
                onPress={onOpenOrderFlow}
                style={({ pressed }) => [styles.availableCarsButton, pressed && styles.pressed]}
              >
                <View style={styles.availableCarsIcon}>
                  <Car color="#F5F0E8" size={28} strokeWidth={2.5} />
                </View>
                <View style={styles.availableCarsCopy}>
                  <Text style={styles.availableCarsLabel}>Машин доступно сейчас</Text>
                  <Text style={styles.availableCarsValue}>{availableCarsCount}</Text>
                  <Text style={styles.availableCarsHint}>Малояз, Эконом 120 ₽</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: simpleMode }}
                onPress={onToggleSimpleMode}
                style={({ pressed }) => [styles.simpleModeButton, pressed && styles.pressed]}
              >
                <View style={[styles.simpleModeSwitch, simpleMode && styles.simpleModeSwitchActive]}>
                  <View style={[styles.simpleModeKnob, simpleMode && styles.simpleModeKnobActive]} />
                </View>
                <View style={styles.simpleModeCopy}>
                  <Text style={styles.simpleModeTitle}>Простой режим</Text>
                  <Text style={styles.simpleModeText}>Крупнее шрифты, больше кнопки, только заказ.</Text>
                </View>
              </Pressable>
            </>
          ) : null}

          {isSelfEmployedDriver ? (
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
                  color={driverLine?.isOnline ? '#D4A853' : '#F5F0E8'}
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
                  {driverLine?.isOnline ? 'Работаю' : 'Не работаю'}
                </Text>
                <Text
                  style={[
                    styles.driverLineHint,
                    driverLine?.isOnline && styles.driverLineTextOnline,
                  ]}
                >
                  {driverLine?.canToggle
                    ? driverLine.isOnline
                      ? 'Нажмите, чтобы завершить смену'
                      : 'Нажмите, чтобы начать смену'
                    : `Доступ: ${driverLine?.status ?? 'нужен допуск'}`}
                </Text>
              </View>
            </Pressable>
          ) : null}

          {isDriverRole && driverLine ? (
            <View style={styles.accessPanel}>
              <Text style={styles.accessTitle}>Документы и допуск</Text>
              <Text style={styles.accessText}>
                {driverLine.canToggle
                  ? 'Проверка завершена, можно выходить на линию.'
                  : `Не закрыто: ${formatDriverBlockers(driverLine.accessBlockers ?? [])}`}
              </Text>
            </View>
          ) : null}

          {isDriverRole && driverStats ? <DriverStatsCard stats={driverStats} /> : null}

          {isWide ? (
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
          ) : (
            <ScrollView
              contentContainerStyle={styles.menuRail}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {config.menuItems.map((item) => (
                <MenuButton
                  active={item.id === activeItem.id}
                  compact
                  item={item}
                  key={item.id}
                  onPress={() => setActiveItemId(item.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.main}>
          <SectionPageView
            appTitle={config.title}
            driverStats={activeItem.id === 'payouts' ? driverStats : undefined}
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
        <Icon color={active ? '#1E1C1A' : '#D4A853'} size={19} strokeWidth={2.3} />
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
        <Icon color="#D4A853" size={21} strokeWidth={2.3} />
      </View>
      <Text numberOfLines={2} style={styles.quickTitle}>{action.title}</Text>
      <Text numberOfLines={2} style={styles.quickSubtitle}>{action.subtitle}</Text>
    </Pressable>
  );
}

type SectionPageViewProps = {
  appTitle: string;
  driverStats?: DriverStatsSummary;
  onActionTarget: (target?: MenuActionTarget) => void;
  page: SectionPage;
};

function SectionPageView({ appTitle, driverStats, onActionTarget, page }: SectionPageViewProps) {
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
          <Icon color="#D4A853" size={28} strokeWidth={2.4} />
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
        <ShieldCheck color="#D4A853" size={18} strokeWidth={2.4} />
        <Text style={styles.noteText}>{page.note}</Text>
      </View>
    </>
  );
}

function DriverStatsCard({ stats }: { stats: DriverStatsSummary }) {
  return (
    <View style={styles.driverStatsCard}>
      <Text style={styles.driverStatsTitle}>Статистика месяца</Text>
      <View style={styles.driverStatsRows}>
        <MiniStat label="Заказы" value={String(stats.monthOrders)} />
        <MiniStat label="Собрано" value={`${stats.gross} ₽`} />
        <MiniStat label="Доля сервиса" value={`${stats.serviceShare} ₽`} />
      </View>
      <Text style={styles.driverStatsHint}>Сегодня к переводу: {stats.serviceShareToday} ₽</Text>
    </View>
  );
}

function DriverStatsPanel({ stats }: { stats: DriverStatsSummary }) {
  return (
    <View style={styles.financePanel}>
      <Text style={styles.panelTitle}>Выручка и доля сервиса</Text>
      <Text style={styles.panelSubtitle}>
        Клиент платит водителю напрямую. Приложение считает долю сервиса, которую водитель переводит в конце рабочего дня.
      </Text>
      <View style={styles.metricsGrid}>
        <MiniMetric label="Сегодня" value={`${stats.todayOrders} заказов`} />
        <MiniMetric label="Неделя" value={`${stats.weekOrders} заказов`} />
        <MiniMetric label="Месяц" value={`${stats.monthOrders} заказов`} />
        <MiniMetric label="Собрано водителем" value={`${stats.gross} ₽`} />
        <MiniMetric label="К переводу сегодня" value={`${stats.serviceShareToday} ₽`} />
        <MiniMetric label={`Доля сервиса ${stats.serviceShareRate}%`} value={`${stats.serviceShare} ₽`} />
        <MiniMetric label="Остается водителю" value={`${stats.driverNet} ₽`} />
      </View>
    </View>
  );
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

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  accessPanel: {
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  accessText: {
    color: '#A89F91',
    fontSize: 12,
    lineHeight: 17,
  },
  accessTitle: {
    color: '#F5F0E8',
    fontSize: 13,
    fontWeight: '900',
  },
  appMeta: {
    color: '#A89F91',
    fontSize: 13,
    marginTop: 2,
  },
  liveText: {
    color: '#D4A853',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  appName: {
    color: '#F5F0E8',
    fontSize: 18,
    fontWeight: '900',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#D4A853',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  avatarText: {
    color: '#F5F0E8',
    fontSize: 18,
    fontWeight: '900',
  },
  availableCarsButton: {
    alignItems: 'center',
    backgroundColor: '#D4A853',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 88,
    padding: 12,
  },
  availableCarsCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  availableCarsHint: {
    color: '#F5F0E8',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  availableCarsIcon: {
    alignItems: 'center',
    backgroundColor: '#D4A853',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  availableCarsLabel: {
    color: '#F5F0E8',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  availableCarsValue: {
    color: '#F5F0E8',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  badge: {
    backgroundColor: '#37322E',
    borderRadius: 6,
    color: '#C17A70',
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
    backgroundColor: '#D4A853',
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
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  driverLineButton: {
    alignItems: 'center',
    backgroundColor: '#D4A853',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 88,
    padding: 12,
  },
  driverLineButtonDisabled: {
    backgroundColor: '#5A544E',
    borderColor: '#5A544E',
  },
  driverLineButtonOnline: {
    backgroundColor: '#37322E',
    borderColor: '#D4A853',
  },
  driverLineCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  driverLineHint: {
    color: '#37322E',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  driverLineIcon: {
    alignItems: 'center',
    backgroundColor: '#D4A853',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  driverLineIconOnline: {
    backgroundColor: '#2C2926',
  },
  driverLineLabel: {
    color: '#37322E',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  driverLineTextOnline: {
    color: '#D4A853',
  },
  driverLineValue: {
    color: '#1E1C1A',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  driverStatsCard: {
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  driverStatsHint: {
    color: '#D4A853',
    fontSize: 13,
    fontWeight: '900',
  },
  driverStatsRows: {
    gap: 8,
  },
  driverStatsTitle: {
    color: '#F5F0E8',
    fontSize: 16,
    fontWeight: '900',
  },
  financePanel: {
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#37322E',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  heroPanel: {
    alignItems: 'flex-start',
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  heroText: {
    color: '#A89F91',
    fontSize: 13,
    lineHeight: 18,
  },
  heroTitle: {
    color: '#F5F0E8',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  hello: {
    color: '#F5F0E8',
    fontSize: 16,
    fontWeight: '900',
  },
  layout: {
    gap: 12,
  },
  liveDot: {
    backgroundColor: '#5C8D89',
    borderRadius: 5,
    height: 10,
    marginTop: 4,
    width: 10,
  },
  liveDotActive: {
    backgroundColor: '#7A9A7E',
  },
  livePanel: {
    alignItems: 'flex-start',
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  livePanelText: {
    color: '#F5F0E8',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  layoutWide: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  main: {
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  menuButton: {
    alignItems: 'flex-start',
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 10,
  },
  menuButtonCompact: {
    alignItems: 'center',
    minHeight: 76,
    width: 152,
  },
  menuButtonActive: {
    backgroundColor: '#37322E',
    borderColor: '#D4A853',
  },
  menuCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  menuIconWrap: {
    alignItems: 'center',
    backgroundColor: '#37322E',
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  menuIconWrapCompact: {
    height: 34,
    width: 34,
  },
  menuIconWrapActive: {
    backgroundColor: '#D4A853',
  },
  menuList: {
    gap: 8,
  },
  menuRail: {
    gap: 8,
    paddingRight: 4,
  },
  menuSubtitle: {
    color: '#A89F91',
    fontSize: 12,
    lineHeight: 17,
  },
  menuTitle: {
    color: '#F5F0E8',
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  menuTitleActive: {
    color: '#D4A853',
  },
  menuTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metricCard: {
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 132,
    padding: 12,
  },
  metricHelper: {
    color: '#A89F91',
    fontSize: 12,
    lineHeight: 16,
  },
  metricLabel: {
    color: '#A89F91',
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
    color: '#F5F0E8',
    fontSize: 20,
    fontWeight: '900',
  },
  miniStat: {
    alignItems: 'center',
    backgroundColor: '#37322E',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    padding: 10,
  },
  miniStatLabel: {
    color: '#A89F91',
    fontSize: 12,
    fontWeight: '800',
  },
  miniStatValue: {
    color: '#F5F0E8',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  notePanel: {
    alignItems: 'flex-start',
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  noteText: {
    color: '#F5F0E8',
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  outlineButtonText: {
    color: '#D4A853',
    fontSize: 14,
    fontWeight: '900',
  },
  orderButton: {
    alignItems: 'center',
    backgroundColor: '#D4A853',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  orderButtonText: {
    color: '#1E1C1A',
    fontSize: 14,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#1E1C1A',
    gap: 12,
    minHeight: '100%',
    padding: 14,
  },
  panelSubtitle: {
    color: '#A89F91',
    fontSize: 14,
    lineHeight: 20,
  },
  panelTitle: {
    color: '#F5F0E8',
    fontSize: 18,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.95 }],
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#D4A853',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#1E1C1A',
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
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  profileStatus: {
    color: '#A89F91',
    fontSize: 13,
    lineHeight: 18,
  },
  quickCard: {
    backgroundColor: '#37322E',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 104,
    minWidth: 150,
    padding: 12,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickIconWrap: {
    alignItems: 'center',
    backgroundColor: '#37322E',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  quickSubtitle: {
    color: '#A89F91',
    fontSize: 12,
    lineHeight: 17,
  },
  quickTitle: {
    color: '#F5F0E8',
    fontSize: 15,
    fontWeight: '900',
  },
  routeDivider: {
    color: '#A89F91',
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
    color: '#A89F91',
    fontSize: 13,
    fontWeight: '800',
  },
  routeTextActive: {
    color: '#D4A853',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: '#F5F0E8',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionRow: {
    alignItems: 'flex-start',
    backgroundColor: '#37322E',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    padding: 10,
  },
  sectionRowCopy: {
    flex: 1,
    gap: 4,
    minWidth: 150,
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
    backgroundColor: '#37322E',
    borderRadius: 6,
    color: '#D4A853',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  sectionRowSubtitle: {
    color: '#A89F91',
    fontSize: 12,
    lineHeight: 17,
  },
  sectionRowTitle: {
    color: '#F5F0E8',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionRowValue: {
    color: '#F5F0E8',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  simpleModeButton: {
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderColor: '#F6C600',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 74,
    padding: 12,
  },
  simpleModeCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  simpleModeKnob: {
    backgroundColor: '#B0B0B0',
    borderRadius: 10,
    height: 20,
    width: 20,
  },
  simpleModeKnobActive: {
    alignSelf: 'flex-end',
    backgroundColor: '#0C0C0C',
  },
  simpleModeSwitch: {
    backgroundColor: '#242426',
    borderColor: '#B0B0B0',
    borderRadius: 99,
    borderWidth: 1,
    justifyContent: 'center',
    padding: 3,
    width: 50,
  },
  simpleModeSwitchActive: {
    backgroundColor: '#F6C600',
    borderColor: '#F6C600',
  },
  simpleModeText: {
    color: '#B0B0B0',
    fontSize: 12,
    lineHeight: 17,
  },
  simpleModeTitle: {
    color: '#F5F5F5',
    fontSize: 14,
    fontWeight: '900',
  },
  sidebar: {
    gap: 10,
    width: '100%',
  },
  sidebarWide: {
    flexShrink: 0,
    width: 340,
  },
  statusPanel: {
    backgroundColor: '#37322E',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  statusText: {
    color: '#A89F91',
    fontSize: 14,
    lineHeight: 20,
  },
  statusTitle: {
    color: '#D4A853',
    fontSize: 18,
    fontWeight: '900',
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    padding: 12,
  },
  topActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
