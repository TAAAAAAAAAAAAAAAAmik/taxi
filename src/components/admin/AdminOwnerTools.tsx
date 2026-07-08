import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  BarChart3,
  Headphones,
  RefreshCw,
  Send,
  ShieldBan,
  Trash2,
  Wallet,
} from 'lucide-react-native';

import {
  AdminBlacklistEntry,
  AdminPricing,
  AdminStats,
  addToAdminBlacklist,
  fetchAdminBlacklist,
  fetchAdminPricing,
  fetchAdminStats,
  fetchSupportThreads,
  removeFromAdminBlacklist,
  sendSupportMessageToServer,
  updateAdminPricing,
} from '../../services/apiClient';
import type { SupportThread } from '../../state/AppState';

const GREEN = '#008D49';
const INK = '#12382C';
const MUTED = '#71877D';
const LINE = 'rgba(11, 47, 37, 0.10)';

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

// ——— Примитивы графиков (без зависимостей: View-бары работают на web и native) ———

function Tile({ helper, label, value }: { helper?: string; label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text numberOfLines={1} style={styles.tileLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.tileValue}>{value}</Text>
      {helper ? <Text numberOfLines={1} style={styles.tileHelper}>{helper}</Text> : null}
    </View>
  );
}

function BarsChart({
  bars,
  title,
  valueSuffix = '',
}: {
  bars: Array<{ label: string; value: number }>;
  title: string;
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const peak = bars.reduce((best, bar) => (bar.value > best.value ? bar : best), bars[0]);

  return (
    <View style={styles.chartBlock}>
      <View style={styles.chartHead}>
        <Text style={styles.chartTitle}>{title}</Text>
        {peak && peak.value > 0 ? (
          <Text style={styles.chartPeak}>
            пик: {peak.value.toLocaleString('ru-RU')}{valueSuffix} · {peak.label}
          </Text>
        ) : null}
      </View>
      <View style={styles.barsRow}>
        {bars.map((bar, index) => (
          <View key={`${bar.label}-${index}`} style={styles.barSlot}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { height: `${Math.max(bar.value > 0 ? 6 : 2, Math.round((bar.value / max) * 100))}%` },
                ]}
              />
            </View>
            <Text numberOfLines={1} style={styles.barLabel}>{bar.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function HBarList({
  items,
  title,
  valueSuffix = '',
}: {
  items: Array<{ name: string; count: number }>;
  title: string;
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));

  return (
    <View style={styles.chartBlock}>
      <Text style={styles.chartTitle}>{title}</Text>
      {items.length === 0 ? <Text style={styles.mutedText}>Пока нет данных.</Text> : null}
      {items.map((item) => (
        <View key={item.name} style={styles.hbarRow}>
          <Text numberOfLines={1} style={styles.hbarName}>{item.name}</Text>
          <View style={styles.hbarTrack}>
            <View style={[styles.hbarFill, { width: `${Math.max(4, Math.round((item.count / max) * 100))}%` }]} />
          </View>
          <Text style={styles.hbarValue}>{item.count.toLocaleString('ru-RU')}{valueSuffix}</Text>
        </View>
      ))}
    </View>
  );
}

// ——— Подробная статистика владельца ———

export function AdminStatsBoard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    fetchAdminStats()
      .then((next) => {
        setStats(next);
        setNotice('');
      })
      .catch(() => setNotice('Статистика доступна при подключенном backend.'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!stats) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <BarChart3 color={GREEN} size={20} strokeWidth={2.4} />
          <Text style={styles.cardTitle}>Подробная статистика</Text>
        </View>
        <Text style={styles.mutedText}>{notice || 'Загружаем данные…'}</Text>
        <Pressable accessibilityRole="button" onPress={load} style={({ pressed }) => [styles.quietButton, pressed && styles.pressed]}>
          <RefreshCw color={GREEN} size={16} strokeWidth={2.4} />
          <Text style={styles.quietButtonText}>Обновить</Text>
        </Pressable>
      </View>
    );
  }

  const { drivers, money, orders, users } = stats;

  return (
    <View style={styles.stack}>
      {/* Люди */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <BarChart3 color={GREEN} size={20} strokeWidth={2.4} />
          <Text style={styles.cardTitle}>Новые пользователи</Text>
          <Pressable accessibilityLabel="Обновить статистику" accessibilityRole="button" onPress={load} style={({ pressed }) => [styles.refreshChip, pressed && styles.pressed]}>
            <RefreshCw color={GREEN} size={15} strokeWidth={2.4} />
          </Pressable>
        </View>
        <View style={styles.tilesRow}>
          <Tile label="За час" value={String(users.newBy.hour)} />
          <Tile label="За день" value={String(users.newBy.day)} />
          <Tile label="За неделю" value={String(users.newBy.week)} />
          <Tile label="За месяц" value={String(users.newBy.month)} />
          <Tile label="За год" value={String(users.newBy.year)} />
          <Tile helper={`${users.clients} клиентов · ${users.drivers} водителей`} label="Всего" value={String(users.total)} />
        </View>
        <BarsChart
          bars={users.monthly.map((month) => ({ label: month.label, value: month.total }))}
          title="Динамика регистраций по месяцам"
        />
      </View>

      {/* Деньги */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Wallet color={GREEN} size={20} strokeWidth={2.4} />
          <Text style={styles.cardTitle}>Деньги</Text>
        </View>
        <View style={styles.tilesRow}>
          <Tile helper="оплата доступа" label="Мой доход · всё время" value={formatMoney(money.myRevenueTotal)} />
          <Tile label="Мой доход · месяц" value={formatMoney(money.myRevenueBy.month)} />
          <Tile label="Мой доход · неделя" value={formatMoney(money.myRevenueBy.week)} />
          <Tile label="Мой доход · день" value={formatMoney(money.myRevenueBy.day)} />
        </View>
        <View style={styles.tilesRow}>
          <Tile helper="платят напрямую водителям" label="Траты клиентов · всё время" value={formatMoney(money.clientSpendTotal)} />
          <Tile label="Траты · месяц" value={formatMoney(money.clientSpendBy.month)} />
          <Tile helper="вся сумма поездок — им" label="Доход водителей" value={formatMoney(money.driverEarningsTotal)} />
          <Tile label="Средний чек" value={formatMoney(money.avgCheck)} />
        </View>
        <BarsChart
          bars={money.revenueMonthly.map((month) => ({ label: month.label, value: month.access }))}
          title="Мой доход по месяцам (доступ водителей)"
          valueSuffix=" ₽"
        />
        <BarsChart
          bars={money.revenueMonthly.map((month) => ({ label: month.label, value: month.trips }))}
          title="Оборот поездок по месяцам"
          valueSuffix=" ₽"
        />
      </View>

      {/* Заказы */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <BarChart3 color={GREEN} size={20} strokeWidth={2.4} />
          <Text style={styles.cardTitle}>Заказы</Text>
        </View>
        <View style={styles.tilesRow}>
          <Tile label="Всего" value={String(orders.total)} />
          <Tile label="Активные" value={String(orders.active)} />
          <Tile label="Завершены" value={String(orders.completed)} />
          <Tile label="Отменены" value={String(orders.cancelled)} />
        </View>
        <BarsChart bars={orders.byDay.map((day) => ({ label: day.label.slice(0, 5), value: day.count }))} title="Заказы за 14 дней" />
        <HBarList items={orders.byVillage} title="География: из какого села заказывают" />
      </View>

      {/* Водители */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <BarChart3 color={GREEN} size={20} strokeWidth={2.4} />
          <Text style={styles.cardTitle}>Водители</Text>
        </View>
        <View style={styles.tilesRow}>
          <Tile label="Всего" value={String(drivers.total)} />
          <Tile label="На линии" value={String(drivers.online)} />
          <Tile label="Допущены" value={String(drivers.canReceiveOrders)} />
          <Tile label="В чёрном списке" value={String(drivers.blacklisted)} />
          <Tile label="Средний рейтинг" value={drivers.ratingAvg ? String(drivers.ratingAvg) : '—'} />
        </View>
        <HBarList
          items={[
            { name: 'Дневной доступ', count: drivers.byBilling.daily },
            { name: 'Партнёр PRO', count: drivers.byBilling.monthly },
            { name: 'Одобрены', count: drivers.byStatus.approved },
            { name: 'На проверке', count: drivers.byStatus.pending },
          ]}
          title="Тарифы и статусы"
        />
        <HBarList items={drivers.topVehicles} title="Марки автомобилей" />
      </View>
    </View>
  );
}

// ——— Цены доступа (смена / месяц) ———

export function AdminPricingCard() {
  const [pricing, setPricing] = useState<AdminPricing | null>(null);
  const [daily, setDaily] = useState('');
  const [monthly, setMonthly] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAdminPricing()
      .then((next) => {
        setPricing(next);
        setDaily(String(next.dailyPrice));
        setMonthly(String(next.monthlyPrice));
      })
      .catch(() => setNotice('Цены доступны при подключенном backend.'));
  }, []);

  const save = async () => {
    setBusy(true);
    setNotice('');

    try {
      const next = await updateAdminPricing({
        dailyPrice: Number(daily.replace(/\D/g, '')),
        monthlyPrice: Number(monthly.replace(/\D/g, '')),
      });
      setPricing(next);
      setDaily(String(next.dailyPrice));
      setMonthly(String(next.monthlyPrice));
      setNotice('Цены обновлены. Водители увидят новые тарифы сразу.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось сохранить цены.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Wallet color={GREEN} size={20} strokeWidth={2.4} />
        <Text style={styles.cardTitle}>Цены доступа для водителей</Text>
      </View>
      <View style={styles.priceRow}>
        <View style={styles.priceField}>
          <Text style={styles.fieldLabel}>Смена (день), ₽</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setDaily}
            placeholder="120"
            placeholderTextColor={MUTED}
            style={styles.input}
            value={daily}
          />
        </View>
        <View style={styles.priceField}>
          <Text style={styles.fieldLabel}>Партнёр PRO (месяц), ₽</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setMonthly}
            placeholder="3290"
            placeholderTextColor={MUTED}
            style={styles.input}
            value={monthly}
          />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={busy || !pricing}
        onPress={save}
        style={({ pressed }) => [styles.primaryButton, (busy || !pricing) && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>{busy ? 'Сохраняем…' : 'Сохранить цены'}</Text>
      </Pressable>
      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
    </View>
  );
}

// ——— Чёрный список ———

export function AdminBlacklistCard() {
  const [items, setItems] = useState<AdminBlacklistEntry[]>([]);
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [type, setType] = useState<'client' | 'driver'>('driver');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAdminBlacklist()
      .then(setItems)
      .catch(() => setNotice('Чёрный список доступен при подключенном backend.'));
  }, []);

  const add = async () => {
    if (!targetId.trim()) {
      setNotice('Укажите ID водителя или клиента.');
      return;
    }

    setBusy(true);
    setNotice('');

    try {
      const next = await addToAdminBlacklist({ id: targetId.trim(), reason: reason.trim(), type });
      setItems(next);
      setTargetId('');
      setReason('');
      setNotice(type === 'driver' ? 'Водитель заблокирован: снят с линии, лента закрыта.' : 'Клиент заблокирован: новые заказы недоступны.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось добавить в чёрный список.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entryId: string) => {
    try {
      setItems(await removeFromAdminBlacklist(entryId));
      setNotice('Запись убрана из чёрного списка.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось убрать запись.');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <ShieldBan color="#B23B32" size={20} strokeWidth={2.4} />
        <Text style={styles.cardTitle}>Чёрный список</Text>
      </View>
      <View style={styles.typeRow}>
        {(['driver', 'client'] as const).map((option) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: type === option }}
            key={option}
            onPress={() => setType(option)}
            style={({ pressed }) => [styles.typeChip, type === option && styles.typeChipActive, pressed && styles.pressed]}
          >
            <Text style={[styles.typeChipText, type === option && styles.typeChipTextActive]}>
              {option === 'driver' ? 'Водитель' : 'Клиент'}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        autoCapitalize="none"
        onChangeText={setTargetId}
        placeholder={type === 'driver' ? 'ID водителя (driver-… или user-…)' : 'ID клиента, телефон или почта'}
        placeholderTextColor={MUTED}
        style={styles.input}
        value={targetId}
      />
      <TextInput
        onChangeText={setReason}
        placeholder="Причина (видна только вам)"
        placeholderTextColor={MUTED}
        style={styles.input}
        value={reason}
      />
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={add}
        style={({ pressed }) => [styles.dangerButton, busy && styles.disabled, pressed && styles.pressed]}
      >
        <ShieldBan color="#FDF3F2" size={17} strokeWidth={2.4} />
        <Text style={styles.dangerButtonText}>{busy ? 'Блокируем…' : 'Заблокировать'}</Text>
      </Pressable>
      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

      {items.map((entry) => (
        <View key={`${entry.type}-${entry.id}`} style={styles.blacklistRow}>
          <View style={styles.blacklistCopy}>
            <Text numberOfLines={1} style={styles.blacklistTitle}>
              {entry.type === 'driver' ? 'Водитель' : 'Клиент'} · {entry.name || entry.id}
            </Text>
            <Text numberOfLines={1} style={styles.blacklistMeta}>
              {entry.id}
              {entry.reason ? ` · ${entry.reason}` : ''} · {new Date(entry.addedAt).toLocaleDateString('ru-RU')}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={`Убрать ${entry.id} из чёрного списка`}
            accessibilityRole="button"
            onPress={() => remove(entry.id)}
            style={({ pressed }) => [styles.removeChip, pressed && styles.pressed]}
          >
            <Trash2 color={GREEN} size={16} strokeWidth={2.4} />
          </Pressable>
        </View>
      ))}
      {items.length === 0 ? <Text style={styles.mutedText}>Список пуст.</Text> : null}
    </View>
  );
}

// ——— Чат поддержки (ответы от лица поддержки) ———

export function AdminSupportChat() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchSupportThreads()
      .then((next) => {
        setThreads(next);
        setNotice('');
      })
      .catch(() => setNotice('Чат доступен при подключенном backend.'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || null,
    [activeThreadId, threads],
  );

  const send = async () => {
    const text = draft.trim();

    if (!activeThread || !text) {
      return;
    }

    setBusy(true);

    try {
      const updated = await sendSupportMessageToServer({
        asSupport: true,
        category: activeThread.category,
        role: activeThread.role,
        text,
        threadId: activeThread.id,
        userId: activeThread.userId,
      });
      setThreads((current) => [updated, ...current.filter((thread) => thread.id !== updated.id)]);
      setDraft('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось отправить ответ.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Headphones color={GREEN} size={20} strokeWidth={2.4} />
        <Text style={styles.cardTitle}>Чат поддержки</Text>
        <Pressable accessibilityLabel="Обновить обращения" accessibilityRole="button" onPress={load} style={({ pressed }) => [styles.refreshChip, pressed && styles.pressed]}>
          <RefreshCw color={GREEN} size={15} strokeWidth={2.4} />
        </Pressable>
      </View>
      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

      {!activeThread ? (
        <>
          {threads.length === 0 ? <Text style={styles.mutedText}>Обращений пока нет.</Text> : null}
          {threads.map((thread) => (
            <Pressable
              accessibilityRole="button"
              key={thread.id}
              onPress={() => setActiveThreadId(thread.id)}
              style={({ pressed }) => [styles.threadRow, pressed && styles.pressed]}
            >
              <View style={styles.blacklistCopy}>
                <Text numberOfLines={1} style={styles.blacklistTitle}>{thread.title}</Text>
                <Text numberOfLines={1} style={styles.blacklistMeta}>
                  {thread.role === 'client' ? 'Клиент' : 'Водитель'} · {thread.category} ·{' '}
                  {new Date(thread.updatedAt).toLocaleString('ru-RU', { day: '2-digit', hour: '2-digit', minute: '2-digit', month: '2-digit' })}
                </Text>
              </View>
              <View style={[styles.statusPill, thread.status === 'waiting' && styles.statusPillWaiting]}>
                <Text style={[styles.statusPillText, thread.status === 'waiting' && styles.statusPillTextWaiting]}>
                  {thread.status === 'waiting' ? 'Ждёт' : thread.status === 'answered' ? 'Отвечен' : thread.status === 'closed' ? 'Закрыт' : 'Открыт'}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      ) : (
        <>
          <Pressable accessibilityRole="button" onPress={() => setActiveThreadId(null)} style={({ pressed }) => [styles.quietButton, pressed && styles.pressed]}>
            <Text style={styles.quietButtonText}>← Все обращения</Text>
          </Pressable>
          <Text numberOfLines={1} style={styles.threadHeader}>
            {activeThread.title} · {activeThread.role === 'client' ? 'клиент' : 'водитель'}
          </Text>

          <View style={styles.messages}>
            {activeThread.messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.bubble,
                  message.author === 'support' && styles.bubbleSupport,
                  message.author === 'system' && styles.bubbleSystem,
                ]}
              >
                <Text style={[styles.bubbleAuthor, message.author === 'support' && styles.bubbleAuthorSupport]}>
                  {message.author === 'support' ? 'Поддержка' : message.author === 'system' ? 'Система' : 'Пользователь'}
                </Text>
                <Text style={[styles.bubbleText, message.author === 'support' && styles.bubbleTextSupport]}>
                  {message.text}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.composer}>
            <TextInput
              multiline
              onChangeText={setDraft}
              placeholder="Ответ от лица поддержки…"
              placeholderTextColor={MUTED}
              style={[styles.input, styles.composerInput]}
              value={draft}
            />
            <Pressable
              accessibilityLabel="Отправить ответ"
              accessibilityRole="button"
              disabled={busy || !draft.trim()}
              onPress={send}
              style={({ pressed }) => [styles.sendButton, (busy || !draft.trim()) && styles.disabled, pressed && styles.pressed]}
            >
              <Send color="#F4FAF6" size={18} strokeWidth={2.4} />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  barFill: {
    backgroundColor: GREEN,
    borderRadius: 4,
    width: '100%',
  },
  barLabel: { color: MUTED, fontSize: 9, fontWeight: '700', textAlign: 'center' },
  barSlot: { alignItems: 'center', flex: 1, gap: 4, minWidth: 0 },
  barTrack: {
    backgroundColor: '#EEF5F0',
    borderRadius: 4,
    height: 96,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '72%',
  },
  barsRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 3 },
  blacklistCopy: { flex: 1, gap: 2, minWidth: 0 },
  blacklistMeta: { color: MUTED, fontSize: 12 },
  blacklistRow: {
    alignItems: 'center',
    backgroundColor: '#F7FBF8',
    borderColor: LINE,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 11,
  },
  blacklistTitle: { color: INK, fontSize: 14, fontWeight: '800' },
  bubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F4F8F5',
    borderRadius: 14,
    borderTopLeftRadius: 4,
    gap: 3,
    maxWidth: '88%',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubbleAuthor: { color: MUTED, fontSize: 11, fontWeight: '800' },
  bubbleAuthorSupport: { color: 'rgba(244, 250, 246, 0.75)' },
  bubbleSupport: {
    alignSelf: 'flex-end',
    backgroundColor: GREEN,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 4,
  },
  bubbleSystem: { backgroundColor: '#FFFCF3' },
  bubbleText: { color: INK, fontSize: 14, lineHeight: 20 },
  bubbleTextSupport: { color: '#F4FAF6' },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: LINE,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 15,
    shadowColor: '#0B2F25',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
  },
  cardHead: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  cardTitle: { color: INK, flex: 1, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  chartBlock: { gap: 8 },
  chartHead: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  chartPeak: { color: MUTED, fontSize: 11, fontWeight: '700' },
  chartTitle: { color: INK, fontSize: 14, fontWeight: '800' },
  composer: { alignItems: 'flex-end', flexDirection: 'row', gap: 8 },
  composerInput: { flex: 1, maxHeight: 120, minHeight: 48 },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: '#B23B32',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  dangerButtonText: { color: '#FDF3F2', fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  fieldLabel: { color: INK, fontSize: 12, fontWeight: '800' },
  hbarFill: { backgroundColor: GREEN, borderRadius: 999, height: 8 },
  hbarName: { color: INK, fontSize: 13, fontWeight: '700', width: 118 },
  hbarRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  hbarTrack: { backgroundColor: '#EEF5F0', borderRadius: 999, flex: 1, height: 8, overflow: 'hidden' },
  hbarValue: { color: MUTED, fontSize: 12, fontWeight: '800', minWidth: 42, textAlign: 'right' },
  input: {
    backgroundColor: '#F7FBF8',
    borderColor: LINE,
    borderRadius: 12,
    borderWidth: 1,
    color: INK,
    fontSize: 15,
    fontWeight: '600',
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  messages: { gap: 8 },
  mutedText: { color: MUTED, fontSize: 13, lineHeight: 19 },
  noticeText: { color: GREEN, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  priceField: { flex: 1, gap: 6, minWidth: 150 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: GREEN,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: '#F4FAF6', fontSize: 14, fontWeight: '900' },
  quietButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
  },
  quietButtonText: { color: GREEN, fontSize: 13, fontWeight: '800' },
  refreshChip: {
    alignItems: 'center',
    backgroundColor: '#F7FBF8',
    borderColor: 'rgba(0, 141, 73, 0.18)',
    borderRadius: 10,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 38,
  },
  removeChip: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 141, 73, 0.2)',
    borderRadius: 10,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 38,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: GREEN,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    width: 52,
  },
  stack: { gap: 12 },
  statusPill: {
    backgroundColor: '#F4F8F5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: { color: MUTED, fontSize: 11, fontWeight: '800' },
  statusPillTextWaiting: { color: '#8A6D1D' },
  statusPillWaiting: { backgroundColor: '#FFF7DE' },
  threadHeader: { color: INK, fontSize: 15, fontWeight: '900' },
  threadRow: {
    alignItems: 'center',
    backgroundColor: '#F7FBF8',
    borderColor: LINE,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 11,
  },
  tile: {
    backgroundColor: '#F7FBF8',
    borderColor: LINE,
    borderRadius: 12,
    borderWidth: 1,
    flexGrow: 1,
    gap: 2,
    minWidth: 104,
    padding: 11,
  },
  tileHelper: { color: MUTED, fontSize: 10, fontWeight: '600' },
  tileLabel: { color: MUTED, fontSize: 11, fontWeight: '700' },
  tileValue: { color: INK, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  tilesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    backgroundColor: '#FFFFFF',
    borderColor: LINE,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  typeChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  typeChipText: { color: INK, fontSize: 13, fontWeight: '800' },
  typeChipTextActive: { color: '#F4FAF6' },
  typeRow: { flexDirection: 'row', gap: 8 },
});
