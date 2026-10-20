import { Landmark, Plus, Smartphone, Wallet } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  cancelWithdrawal,
  getPayoutSummary,
  listPayoutAccounts,
  listWithdrawals,
  maskedNumber,
  PayoutAccount,
  PayoutMethod,
  removePayoutAccount,
  setDefaultPayoutAccount,
  WithdrawalStatus,
} from '../../api/payouts';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  Header,
  IconCircle,
  Screen,
  SectionHeader,
  StateView,
} from '../../components';
import { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing, themedStyles, Tone } from '../../theme';
import { formatDayMonth, formatRs } from '../../utils/format';
import { t } from '../../i18n';

export const METHOD_LABELS: Record<PayoutMethod | 'other', string> = {
  bank_transfer: t('Bank account'),
  jazzcash: 'JazzCash',
  easypaisa: 'Easypaisa',
  other: t('Other'),
};

const STATUS: Record<WithdrawalStatus, { label: string; tone: Tone }> = {
  pending: { label: t('Requested'), tone: 'warning' },
  approved: { label: t('Approved'), tone: 'info' },
  processing: { label: t('Being sent'), tone: 'info' },
  completed: { label: t('Paid'), tone: 'success' },
  rejected: { label: t('Rejected'), tone: 'danger' },
  cancelled: { label: t('Cancelled'), tone: 'neutral' },
};

/** One saved account, as listed: "Meezan Bank •••• 4321", or "JazzCash •••• 4567". */
export function accountLine(a: Pick<PayoutAccount, 'method' | 'bankName' | 'accountNumber'>) {
  const name = a.method === 'bank_transfer' ? a.bankName || METHOD_LABELS.bank_transfer : METHOD_LABELS[a.method];
  return `${name} ${maskedNumber(a.accountNumber)}`;
}

/**
 * Earnings > Withdraw: what's in the shop owner's Fazl wallet and can be
 * withdrawn, the accounts they're paid into, and their requests — which Fazl's
 * team approves and pays into the chosen account.
 */
export function PayoutsScreen({ navigation }: RootScreenProps<'Payouts'>) {
  const [data, setData] = useState<{
    summary: Awaited<ReturnType<typeof getPayoutSummary>>;
    accounts: PayoutAccount[];
    withdrawals: Awaited<ReturnType<typeof listWithdrawals>>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (pulled = false) => {
    if (pulled) setRefreshing(true);
    try {
      const [summary, accounts, withdrawals] = await Promise.all([
        getPayoutSummary(),
        listPayoutAccounts(),
        listWithdrawals(),
      ]);
      setData({ summary, accounts, withdrawals });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Something went wrong'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Fresh each time it's shown: after adding an account or a request.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onAccountPress = (account: PayoutAccount) => {
    Alert.alert(accountLine(account), account.accountTitle, [
      ...(account.isDefault
        ? []
        : [
            {
              text: t('Make default'),
              onPress: () =>
                setDefaultPayoutAccount(account.id)
                  .then(() => load())
                  .catch(e => Alert.alert(t('Could not save'), e instanceof Error ? e.message : '')),
            },
          ]),
      {
        text: t('Remove'),
        style: 'destructive' as const,
        onPress: () =>
          removePayoutAccount(account.id)
            .then(() => load())
            .catch(e => Alert.alert(t('Could not remove'), e instanceof Error ? e.message : '')),
      },
      { text: t('Cancel'), style: 'cancel' as const },
    ]);
  };

  const onCancelRequest = (id: string) => {
    Alert.alert(t('Cancel this request?'), t('The amount stays in your wallet.'), [
      { text: t('Keep it'), style: 'cancel' },
      {
        text: t('Cancel request'),
        style: 'destructive',
        onPress: () =>
          cancelWithdrawal(id)
            .then(() => load())
            .catch(e => Alert.alert(t('Could not cancel'), e instanceof Error ? e.message : '')),
      },
    ]);
  };

  if (!data) {
    return (
      <Screen header={<Header title={t('Withdraw earnings')} />} scroll={false}>
        <StateView error={error} onRetry={() => load()} />
      </Screen>
    );
  }

  const { summary, accounts, withdrawals } = data;
  const canWithdraw = summary.withdrawalsOpen && !summary.isFrozen && summary.withdrawable >= summary.minWithdrawal;

  return (
    <Screen
      header={<Header title={t('Withdraw earnings')} />}
      onRefresh={() => load(true)}
      refreshing={refreshing}
    >
      <View style={styles.hero}>
        <AppText variant="label" color={colors.primaryTint}>
          {t('Available to withdraw')}
        </AppText>
        <AppText variant="title" color={colors.white} style={styles.heroValue}>
          {formatRs(summary.withdrawable)}
        </AppText>
        {summary.inRequests > 0 ? (
          <AppText variant="caption" color={colors.primaryTint}>
            {t('{amount} already requested', { amount: formatRs(summary.inRequests) })}
          </AppText>
        ) : null}
        <AppText variant="caption" color={colors.primaryTint}>
          {t('Withdrawn so far: {amount}', { amount: formatRs(summary.totalWithdrawn) })}
        </AppText>
      </View>

      {summary.isFrozen ? (
        <AppText color={colors.danger} style={styles.notice}>
          {t('Fazl has paused your wallet. Contact Fazl support for help.')}
        </AppText>
      ) : !summary.withdrawalsOpen ? (
        <AppText color={colors.textMuted} style={styles.notice}>
          {t('Withdrawals are paused for now. Please try again later.')}
        </AppText>
      ) : summary.withdrawable < summary.minWithdrawal ? (
        <AppText color={colors.textMuted} style={styles.notice}>
          {t('You can withdraw once you have at least {amount}.', { amount: formatRs(summary.minWithdrawal) })}
        </AppText>
      ) : null}

      <Button
        title={t('Withdraw')}
        icon={Wallet}
        disabled={!canWithdraw}
        onPress={() =>
          accounts.length
            ? navigation.navigate('Withdraw')
            : Alert.alert(t('Add an account first'), t('Add the bank, JazzCash or Easypaisa account to send the money to.'), [
                { text: t('Cancel'), style: 'cancel' },
                { text: t('Add account'), onPress: () => navigation.navigate('PayoutAccountForm') },
              ])
        }
        style={styles.withdraw}
      />

      <SectionHeader
        title={t('Your accounts')}
        actionLabel={t('Add account')}
        onAction={() => navigation.navigate('PayoutAccountForm')}
      />
      {accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={t('No accounts yet')}
          message={t('Add the bank, JazzCash or Easypaisa account your money is sent to.')}
          actionLabel={t('Add account')}
          onAction={() => navigation.navigate('PayoutAccountForm')}
        />
      ) : (
        <Card padded={false}>
          {accounts.map((a, i) => (
            <Pressable
              key={a.id}
              onPress={() => onAccountPress(a)}
              style={({ pressed }) => [styles.row, i > 0 && styles.border, pressed && styles.pressed]}
            >
              <IconCircle icon={a.method === 'bank_transfer' ? Landmark : Smartphone} tone="primary" size={36} />
              <View style={styles.flex}>
                <AppText variant="bodyBold">{accountLine(a)}</AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  {a.accountTitle}
                </AppText>
              </View>
              {a.isDefault ? <Badge label={t('Default')} tone="primary" /> : null}
            </Pressable>
          ))}
          <Pressable
            onPress={() => navigation.navigate('PayoutAccountForm')}
            style={({ pressed }) => [styles.row, styles.border, pressed && styles.pressed]}
          >
            <IconCircle icon={Plus} tone="neutral" size={36} />
            <AppText color={colors.primary}>{t('Add account')}</AppText>
          </Pressable>
        </Card>
      )}

      <SectionHeader title={t('Withdrawals')} />
      {withdrawals.length === 0 ? (
        <AppText color={colors.textMuted}>{t('Your requests show up here.')}</AppText>
      ) : (
        <Card padded={false}>
          {withdrawals.map((w, i) => (
            <View key={w.id} style={[styles.row, i > 0 && styles.border]}>
              <View style={styles.flex}>
                <AppText variant="bodyBold">{formatRs(w.amount)}</AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  {formatDayMonth(w.createdAt)} · {accountLine({ method: w.method === 'other' ? 'bank_transfer' : w.method, bankName: w.bankName, accountNumber: w.accountNumber })}
                </AppText>
                {w.status === 'rejected' && w.rejectionReason ? (
                  <AppText variant="caption" color={colors.danger}>
                    {w.rejectionReason}
                  </AppText>
                ) : null}
              </View>
              <View style={styles.statusCol}>
                <Badge label={STATUS[w.status].label} tone={STATUS[w.status].tone} />
                {w.status === 'pending' ? (
                  <Pressable onPress={() => onCancelRequest(w.id)} hitSlop={8}>
                    <AppText variant="caption" color={colors.danger}>
                      {t('Cancel')}
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </Card>
      )}
      <AppText variant="caption" color={colors.textSubtle} style={styles.footnote}>
        {t("Fazl's team checks each request and sends the money to the account you chose. Cash on delivery money is already with you, so it isn't part of this balance.")}
      </AppText>
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    hero: {
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    heroValue: { fontSize: 30, lineHeight: 36 },
    notice: { marginTop: spacing.md },
    withdraw: { marginTop: spacing.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
    border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    pressed: { opacity: 0.7 },
    statusCol: { alignItems: 'flex-end', gap: spacing.xs },
    footnote: { marginTop: spacing.lg },
  }),
);
