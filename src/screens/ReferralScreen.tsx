import { ReactNode, useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Car,
  Copy,
  Gift,
  Send,
  Share2,
  UserRound,
  UsersRound,
  Wallet,
} from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { roleCopy } from '../data/registration';
import { RootStackParamList } from '../navigation/types';
import { ReferralDashboard, ReferralRecord } from '../services/apiClient';
import { useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'Referral'>;
type InviteRole = 'client' | 'driver';

const referralStatusLabels = {
  blocked: 'Заблокировано',
  qualified: 'В процессе',
  registered: 'Регистрация',
  rewarded: 'Начислено',
};

export function ReferralScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const { currentUser, referralDashboard, refreshReferralDashboard } = useAppState();
  const [activeInviteRole, setActiveInviteRole] = useState<InviteRole>('client');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    refreshReferralDashboard();
  }, [refreshReferralDashboard]);

  const inviteCode = referralDashboard?.referralCode ?? currentUser?.referralCode ?? 'После входа';
  const inviteUrl = createInviteUrl(referralDashboard, inviteCode, activeInviteRole);
  const rewards = referralDashboard?.rewards;
  const visibleReferrals = useMemo(
    () =>
      (referralDashboard?.referrals ?? []).filter(
        (referral) => referral.inviteeRole === activeInviteRole,
      ),
    [activeInviteRole, referralDashboard?.referrals],
  );
  const activeRule =
    activeInviteRole === 'driver'
      ? {
          icon: <Car color="#146C5D" size={20} strokeWidth={2.4} />,
          reward: rewards?.driverReward ?? 300,
          title: 'Пригласить водителя',
          text: `Вы получите ${rewards?.driverReward ?? 300} ₽ после первых ${
            rewards?.driverQualificationOrders ?? 10
          } завершенных заказов водителя. Водитель получает ${
            rewards?.driverTrialDays ?? 7
          } дней доступа после одобрения.`,
        }
      : {
          icon: <UserRound color="#146C5D" size={20} strokeWidth={2.4} />,
          reward: rewards?.clientReward ?? 60,
          title: 'Пригласить клиента',
          text: `Вы получите ${rewards?.clientReward ?? 60} ₽ после первых ${
            rewards?.clientQualificationOrders ?? 5
          } завершенных поездок клиента. Приглашенный получает ${
            rewards?.invitedClientBonus ?? 300
          } ₽ на первую поездку.`,
        };

  const handleCopy = async (label: string, text: string) => {
    const copied = await copyToClipboard(text);
    setCopyStatus(copied ? `${label} скопирован` : `${label}: ${text}`);
  };

  const handleShare = async () => {
    await Share.share({
      message: `Такси Партнер: ${inviteUrl}\nКод приглашения: ${inviteCode}`,
    });
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
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
          <Text style={styles.roleText}>{roleCopy[role].title}</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Share2 color="#146C5D" size={30} strokeWidth={2.4} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Пригласить в Такси Партнер</Text>
            <Text style={styles.subtitle}>
              Одна ссылка подходит для клиентов и водителей. Бонус становится доступен только
              после нужного количества завершенных поездок.
            </Text>
            <Text style={styles.metaLine}>{firstName?.trim() || currentUser?.firstName || 'Пользователь'}</Text>
          </View>
        </View>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Ваш личный код</Text>
          <Text style={styles.codeValue}>{inviteCode}</Text>
          <Text style={styles.linkText}>{inviteUrl}</Text>
          <View style={styles.codeActions}>
            <ActionButton
              icon={<Copy color="#FFFFFF" size={16} strokeWidth={2.4} />}
              label="Код"
              onPress={() => handleCopy('Код', inviteCode)}
            />
            <ActionButton
              icon={<Copy color="#FFFFFF" size={16} strokeWidth={2.4} />}
              label="Ссылка"
              onPress={() => handleCopy('Ссылка', inviteUrl)}
            />
            <ActionButton
              icon={<Send color="#FFFFFF" size={16} strokeWidth={2.4} />}
              label="Поделиться"
              onPress={handleShare}
            />
          </View>
          {copyStatus ? <Text style={styles.copyStatus}>{copyStatus}</Text> : null}
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            icon={<Wallet color="#146C5D" size={20} strokeWidth={2.4} />}
            label="Бонусный баланс"
            value={`${referralDashboard?.bonusBalance ?? currentUser?.bonusBalance ?? 0} ₽`}
          />
          <StatCard
            icon={<UsersRound color="#146C5D" size={20} strokeWidth={2.4} />}
            label="Приглашения"
            value={String(referralDashboard?.referrals.length ?? 0)}
          />
          <StatCard
            icon={<Gift color="#146C5D" size={20} strokeWidth={2.4} />}
            label="Выбрано"
            value={`${activeRule.reward} ₽`}
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Кого приглашаете</Text>
          <View style={styles.segment}>
            <SegmentButton
              active={activeInviteRole === 'client'}
              label="Клиент"
              onPress={() => setActiveInviteRole('client')}
            />
            <SegmentButton
              active={activeInviteRole === 'driver'}
              label="Водитель"
              onPress={() => setActiveInviteRole('driver')}
            />
          </View>
          <View style={styles.ruleRow}>
            <View style={styles.ruleHeader}>
              {activeRule.icon}
              <Text style={styles.ruleTitle}>{activeRule.title}</Text>
            </View>
            <Text style={styles.ruleText}>{activeRule.text}</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Прогресс приглашений</Text>
          {visibleReferrals.length ? (
            visibleReferrals.map((referral) => (
              <ReferralProgressRow key={referral.id} referral={referral} />
            ))
          ) : (
            <Text style={styles.emptyText}>
              По этому типу приглашений пока нет. Отправьте код или ссылку, а прогресс появится
              после регистрации приглашенного пользователя.
            </Text>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>История бонусов</Text>
          {referralDashboard?.walletLedger.length ? (
            referralDashboard.walletLedger.map((entry) => (
              <View key={entry.id} style={styles.ledgerRow}>
                <Text style={styles.ledgerReason}>{entry.reason}</Text>
                <Text style={styles.ledgerAmount}>+{entry.amount} ₽</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Начисления появятся после квалифицированных приглашений.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function copyToClipboard(text: string) {
  const host = globalThis as typeof globalThis & {
    navigator?: {
      clipboard?: {
        writeText: (value: string) => Promise<void>;
      };
    };
  };

  if (!host.navigator?.clipboard?.writeText) {
    return false;
  }

  await host.navigator.clipboard.writeText(text);
  return true;
}

function createInviteUrl(
  dashboard: ReferralDashboard | undefined,
  inviteCode: string,
  inviteRole: InviteRole,
) {
  if (dashboard?.inviteUrls?.[inviteRole]) {
    return dashboard.inviteUrls[inviteRole];
  }

  const baseUrl = dashboard?.inviteUrl ?? `https://links.example.com/invite/${inviteCode}`;
  const separator = baseUrl.includes('?') ? '&' : '?';

  return `${baseUrl}${separator}role=${inviteRole}`;
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      {icon}
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ActionButton({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
    >
      {icon}
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function SegmentButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.segmentButton,
        active && styles.segmentButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ReferralProgressRow({ referral }: { referral: ReferralRecord }) {
  const progress = referral.progress;
  const completed = progress?.completedOrders ?? 0;
  const required = progress?.requiredOrders ?? (referral.inviteeRole === 'driver' ? 10 : 5);
  const percent = progress?.percent ?? 0;
  const relation = referral.viewerRelation === 'invitee' ? 'Вас пригласили' : 'Вы пригласили';

  return (
    <View style={styles.referralRow}>
      <View style={styles.referralTop}>
        <View style={styles.referralCopy}>
          <Text style={styles.referralTitle}>
            {relation}: {referral.inviteeName ?? (referral.inviteeRole === 'driver' ? 'водитель' : 'клиент')}
          </Text>
          <Text style={styles.referralText}>
            {referral.inviteeRole === 'driver' ? 'Водитель' : 'Клиент'} · {referral.code}
          </Text>
        </View>
        <View style={styles.referralMeta}>
          <Text style={styles.referralAmount}>{referral.rewardAmount} ₽</Text>
          <Text style={styles.referralStatus}>{referralStatusLabels[referral.status]}</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {referral.status === 'rewarded'
          ? `Готово: ${required} из ${required} поездок`
          : `Прогресс: ${completed} из ${required} поездок`}
      </Text>
      <Text style={styles.referralText}>{referral.note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderColor: '#DCEFEB',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
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
  codeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  codeCard: {
    backgroundColor: '#146C5D',
    borderRadius: 8,
    gap: 6,
    padding: 18,
  },
  codeLabel: {
    color: '#DCEFEB',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  codeValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
  },
  copyStatus: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  emptyText: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 19,
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
  ledgerAmount: {
    color: '#146C5D',
    fontSize: 14,
    fontWeight: '900',
  },
  ledgerReason: {
    color: '#20242A',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  ledgerRow: {
    alignItems: 'center',
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  linkText: {
    color: '#DCEFEB',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  metaLine: {
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
    gap: 12,
    padding: 16,
  },
  pressed: {
    opacity: 0.76,
  },
  progressFill: {
    backgroundColor: '#146C5D',
    borderRadius: 999,
    height: '100%',
  },
  progressText: {
    color: '#20242A',
    fontSize: 12,
    fontWeight: '900',
  },
  progressTrack: {
    backgroundColor: '#E6EBEA',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  referralAmount: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  referralCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  referralMeta: {
    alignItems: 'flex-end',
    gap: 5,
  },
  referralRow: {
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  referralStatus: {
    backgroundColor: '#E9F4F1',
    borderRadius: 6,
    color: '#146C5D',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  referralText: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  referralTitle: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  referralTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  roleText: {
    color: '#146C5D',
    fontSize: 14,
    fontWeight: '900',
  },
  ruleHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ruleRow: {
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 12,
  },
  ruleText: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 19,
  },
  ruleTitle: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#F4F7F5',
    flex: 1,
  },
  sectionTitle: {
    color: '#20242A',
    fontSize: 18,
    fontWeight: '900',
  },
  segment: {
    backgroundColor: '#EEF5F3',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 10,
  },
  segmentButtonActive: {
    backgroundColor: '#146C5D',
  },
  segmentButtonText: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minWidth: 150,
    padding: 14,
  },
  statLabel: {
    color: '#59616C',
    fontSize: 12,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statValue: {
    color: '#20242A',
    fontSize: 22,
    fontWeight: '900',
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
