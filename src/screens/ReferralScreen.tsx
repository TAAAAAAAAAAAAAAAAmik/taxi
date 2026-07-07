import { ReactNode, useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Car,
  Check,
  Copy,
  Gift,
  Link2,
  Send,
  Share2,
  UserRound,
  UsersRound,
  Wallet,
} from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { ScreenHero } from '../components/ScreenHero';
import { AccountRole, isDriverLikeRole } from '../data/registration';
import { RootStackParamList } from '../navigation/types';
import { ReferralDashboard, ReferralRecord } from '../services/apiClient';
import { useAppState } from '../state/AppState';
import { getPublicEnv, normalizePublicOrigin } from '../utils/runtimeFlags';

type Props = NativeStackScreenProps<RootStackParamList, 'Referral'>;
type InviteRole = 'client' | 'self_employed_driver';

const LINE = 'rgba(11, 47, 37, 0.10)';
const LIME = '#B7F46A';

const referralStatusLabels = {
  blocked: 'Отклонён',
  qualified: 'Готов к начислению',
  registered: 'Ожидает условия',
  rewarded: 'Начислено',
};

export function ReferralScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const {
    currentUser,
    referralDashboard,
    refreshReferralDashboard,
  } = useAppState();
  const [activeInviteRole, setActiveInviteRole] = useState<InviteRole>(() => getDefaultInviteRole(role));
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    refreshReferralDashboard();
  }, [refreshReferralDashboard]);

  useEffect(() => {
    setActiveInviteRole(getDefaultInviteRole(role));
  }, [role]);

  const inviteCode = referralDashboard?.referralCode ?? currentUser?.referralCode;
  const inviteCodeLabel = inviteCode ?? 'После входа';
  const inviteUrl = inviteCode
    ? createInviteUrl(referralDashboard, inviteCode, activeInviteRole)
    : 'Войдите, чтобы получить ссылку';
  const rewards = referralDashboard?.rewards;
  const visibleReferrals = useMemo(
    () =>
      (referralDashboard?.referrals ?? []).filter(
        (referral) =>
          activeInviteRole === 'self_employed_driver'
            ? isDriverLikeRole(referral.inviteeRole)
            : referral.inviteeRole === activeInviteRole,
      ),
    [activeInviteRole, referralDashboard?.referrals],
  );
  const activeRule =
    activeInviteRole === 'self_employed_driver'
      ? {
          icon: <Car color="#008D49" size={19} strokeWidth={2.4} />,
          reward: rewards?.driverReward ?? 200,
          title: 'Пригласить водителя',
          text: `Вы получите ${rewards?.driverReward ?? 200} ₽ после ${
            rewards?.driverQualificationOrders ?? 10
          } реальных завершённых поездок водителя. Бонус начисляет администратор после проверки.`,
        }
      : {
          icon: <UserRound color="#008D49" size={19} strokeWidth={2.4} />,
          reward: rewards?.clientReward ?? 60,
          title: 'Пригласить клиента',
          text: `Вы получите ${rewards?.clientReward ?? 60} ₽ после первых ${
            rewards?.clientQualificationOrders ?? 5
          } завершённых поездок клиента.`,
        };

  const handleCopy = async (label: string, text: string) => {
    const copied = await copyToClipboard(text);
    setCopyStatus(copied ? `${label} скопирован` : `${label}: ${text}`);
  };

  const handleShare = async () => {
    if (!inviteCode) {
      setCopyStatus('Код появится после входа');
      return;
    }

    await Share.share({
      message: `Такси Салават: ${inviteUrl}\nКод приглашения: ${inviteCode}`,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <ScreenHero
          Icon={Share2}
          onBack={() => navigation.goBack()}
          onMenu={() => navigation.navigate('Dashboard', { firstName, role })}
          subtitle="Одна ссылка для клиентов и водителей. Бонус — после завершённых поездок."
          title="Пригласить друзей"
        />

        <View style={styles.codeCard}>
          <View style={styles.codeGlow} />
          <View style={styles.codeHead}>
            <View style={styles.codeChip}>
              <Gift color={LIME} size={14} strokeWidth={2.6} />
              <Text style={styles.codeChipText}>Личный код</Text>
            </View>
            <Text style={styles.codeReward}>+{activeRule.reward} ₽ за друга</Text>
          </View>
          <Text style={styles.codeValue}>{inviteCodeLabel}</Text>
          <View style={styles.linkBox}>
            <Link2 color={LIME} size={15} strokeWidth={2.4} />
            <Text numberOfLines={1} style={styles.linkText}>
              {inviteUrl}
            </Text>
          </View>
          <View style={styles.codeActions}>
            <ActionButton
              icon={<Copy color={LIME} size={15} strokeWidth={2.4} />}
              label="Код"
              onPress={() => handleCopy('Код', inviteCode ?? 'Код появится после входа')}
            />
            <ActionButton
              icon={<Link2 color={LIME} size={15} strokeWidth={2.4} />}
              label="Ссылка"
              onPress={() => handleCopy('Ссылка', inviteUrl)}
            />
            <ActionButton
              filled
              icon={<Send color="#0A1411" size={15} strokeWidth={2.4} />}
              label="Поделиться"
              onPress={handleShare}
            />
          </View>
          {copyStatus ? (
            <View style={styles.copyStatus}>
              <Check color={LIME} size={13} strokeWidth={3} />
              <Text style={styles.copyStatusText}>{copyStatus}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            icon={<Wallet color="#008D49" size={18} strokeWidth={2.4} />}
            label="Бонусный баланс"
            value={`${referralDashboard?.bonusBalance ?? currentUser?.bonusBalance ?? 0} ₽`}
          />
          <StatCard
            icon={<UsersRound color="#008D49" size={18} strokeWidth={2.4} />}
            label="Приглашения"
            value={String(referralDashboard?.referrals.length ?? 0)}
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
              active={activeInviteRole === 'self_employed_driver'}
              label="Водитель"
              onPress={() => setActiveInviteRole('self_employed_driver')}
            />
          </View>
          <View style={styles.ruleRow}>
            <View style={styles.ruleIcon}>{activeRule.icon}</View>
            <View style={styles.ruleCopy}>
              <Text style={styles.ruleTitle}>{activeRule.title}</Text>
              <Text style={styles.ruleText}>{activeRule.text}</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Прогресс приглашений</Text>
          {visibleReferrals.length ? (
            visibleReferrals.map((referral) => (
              <ReferralProgressRow key={referral.id} referral={referral} />
            ))
          ) : (
            <View style={styles.emptyBox}>
              <UsersRound color="#71877D" size={20} strokeWidth={2.2} />
              <Text style={styles.emptyText}>
                По этому типу приглашений пока пусто. Отправьте код или ссылку — прогресс появится
                после регистрации друга.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>История бонусов</Text>
          {referralDashboard?.walletLedger.length ? (
            referralDashboard.walletLedger.map((entry) => (
              <View key={entry.id} style={styles.ledgerRow}>
                <View style={styles.ledgerIcon}>
                  <Gift color="#008D49" size={16} strokeWidth={2.4} />
                </View>
                <Text style={styles.ledgerReason}>{entry.reason}</Text>
                <Text style={styles.ledgerAmount}>+{entry.amount} ₽</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyBox}>
              <Gift color="#71877D" size={20} strokeWidth={2.2} />
              <Text style={styles.emptyText}>
                Начисления появятся после квалифицированных приглашений.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getDefaultInviteRole(role: AccountRole): InviteRole {
  return role === 'client' ? 'client' : 'self_employed_driver';
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

  if (inviteRole === 'self_employed_driver' && dashboard?.inviteUrls?.driver) {
    return dashboard.inviteUrls.driver;
  }

  const baseUrl = dashboard?.inviteUrl ?? createFallbackInviteUrl(inviteCode);
  const separator = baseUrl.includes('?') ? '&' : '?';

  return `${baseUrl}${separator}role=${inviteRole}`;
}

function createFallbackInviteUrl(inviteCode: string) {
  const linksOrigin = normalizePublicOrigin(getPublicEnv('EXPO_PUBLIC_LINKS_DOMAIN'));
  const encodedCode = encodeURIComponent(inviteCode);

  return linksOrigin ? `${linksOrigin}/invite/${encodedCode}` : `taxipartner://invite/${encodedCode}`;
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  filled,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  filled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        filled && styles.actionButtonFilled,
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text style={[styles.actionButtonText, filled && styles.actionButtonTextFilled]}>{label}</Text>
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
  const isDriverReferral = isDriverLikeRole(referral.inviteeRole);
  const required = progress?.requiredOrders ?? (isDriverReferral ? 10 : 5);
  const percent = progress?.percent ?? 0;
  const relation = referral.viewerRelation === 'invitee' ? 'Вас пригласили' : 'Вы пригласили';
  const isRewarded = referral.status === 'rewarded';

  return (
    <View style={styles.referralRow}>
      <View style={styles.referralTop}>
        <View style={styles.referralCopy}>
          <Text style={styles.referralTitle}>
            {relation}: {referral.inviteeName ?? (isDriverReferral ? 'водитель' : 'клиент')}
          </Text>
          <Text style={styles.referralText}>
            {isDriverReferral ? 'Водитель' : 'Клиент'} · {referral.code}
          </Text>
        </View>
        <View style={styles.referralMeta}>
          <Text style={styles.referralAmount}>{referral.rewardAmount} ₽</Text>
          <Text style={[styles.referralStatus, isRewarded && styles.referralStatusDone]}>
            {referralStatusLabels[referral.status]}
          </Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {isRewarded
          ? `Готово: ${required} из ${required} поездок`
          : `Прогресс: ${completed} из ${required} поездок`}
      </Text>
      {referral.note ? <Text style={styles.referralNote}>{referral.note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(183, 244, 106, 0.24)',
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
  },
  actionButtonFilled: {
    backgroundColor: LIME,
    borderColor: LIME,
  },
  actionButtonText: {
    color: '#F2FBF6',
    fontSize: 13,
    fontWeight: '800',
  },
  actionButtonTextFilled: {
    color: '#0A1411',
  },
  codeActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  codeCard: {
    backgroundColor: '#0A1411',
    borderRadius: 22,
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
  },
  codeChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(183, 244, 106, 0.12)',
    borderColor: 'rgba(183, 244, 106, 0.22)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  codeChipText: {
    color: LIME,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  codeGlow: {
    backgroundColor: 'rgba(92, 230, 160, 0.10)',
    borderRadius: 90,
    height: 180,
    position: 'absolute',
    right: -50,
    top: -40,
    width: 180,
  },
  codeHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 1,
  },
  codeReward: {
    color: '#93BAA8',
    fontSize: 13,
    fontWeight: '800',
  },
  codeValue: {
    color: '#F2FBF6',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 2,
    lineHeight: 44,
    marginTop: 14,
  },
  linkBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  linkText: {
    color: '#B5D6C7',
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  copyStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  copyStatusText: {
    color: '#B5D6C7',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    backgroundColor: '#F7FBF8',
    borderRadius: 16,
    gap: 8,
    padding: 18,
  },
  emptyText: {
    color: '#71877D',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  ledgerAmount: {
    color: '#008D49',
    fontSize: 15,
    fontWeight: '800',
  },
  ledgerIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 141, 73, 0.10)',
    borderRadius: 11,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  ledgerReason: {
    color: '#12382C',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  ledgerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 6,
  },
  page: {
    backgroundColor: '#F4FAF6',
    gap: 14,
    minHeight: '100%',
    padding: 16,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: LINE,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 18,
    shadowColor: '#0B2F25',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  progressFill: {
    backgroundColor: '#008D49',
    borderRadius: 999,
    height: '100%',
  },
  progressText: {
    color: '#12382C',
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    backgroundColor: 'rgba(0, 141, 73, 0.12)',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  referralAmount: {
    color: '#12382C',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
  referralCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  referralMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  referralNote: {
    color: '#71877D',
    fontSize: 12,
    lineHeight: 17,
  },
  referralRow: {
    backgroundColor: '#F7FBF8',
    borderColor: LINE,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  referralStatus: {
    backgroundColor: 'rgba(0, 141, 73, 0.10)',
    borderRadius: 8,
    color: '#008D49',
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  referralStatusDone: {
    backgroundColor: 'rgba(0, 141, 73, 0.16)',
  },
  referralText: {
    color: '#71877D',
    fontSize: 12,
    lineHeight: 17,
  },
  referralTitle: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '800',
  },
  referralTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  ruleCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  ruleIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 141, 73, 0.10)',
    borderRadius: 13,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  ruleRow: {
    alignItems: 'center',
    backgroundColor: '#F7FBF8',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  ruleText: {
    color: '#71877D',
    fontSize: 13,
    lineHeight: 19,
  },
  ruleTitle: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: '#F4FAF6',
    flex: 1,
  },
  sectionTitle: {
    color: '#12382C',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  segment: {
    backgroundColor: '#EEF5F0',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 10,
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0B2F25',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  segmentButtonText: {
    color: '#71877D',
    fontSize: 14,
    fontWeight: '800',
  },
  segmentButtonTextActive: {
    color: '#12382C',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderColor: LINE,
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minWidth: 150,
    padding: 16,
    shadowColor: '#0B2F25',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  statIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 141, 73, 0.10)',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  statLabel: {
    color: '#71877D',
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    color: '#12382C',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
});
