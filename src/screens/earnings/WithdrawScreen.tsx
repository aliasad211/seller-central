import { Check, Landmark, Smartphone } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getPayoutSummary,
  listPayoutAccounts,
  PayoutAccount,
  PayoutSummary,
  requestWithdrawal,
} from '../../api/payouts';
import {
  AppText,
  Button,
  Card,
  Header,
  IconCircle,
  Screen,
  SectionHeader,
  StateView,
  TextField,
} from '../../components';
import { RootScreenProps } from '../../navigation/types';
import { colors, spacing, themedStyles } from '../../theme';
import { formatRs } from '../../utils/format';
import { t } from '../../i18n';
import { accountLine } from './PayoutsScreen';

/**
 * Asking for a withdrawal: how much (within what's available and Fazl's
 * limits) and which of the owner's accounts it's sent to.
 */
export function WithdrawScreen({ navigation }: RootScreenProps<'Withdraw'>) {
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    setError(null);
    Promise.all([getPayoutSummary(), listPayoutAccounts()])
      .then(([s, list]) => {
        setSummary(s);
        setAccounts(list);
        // Keep the choice while it still exists; else the default account.
        setAccountId(current =>
          current && list.some(a => a.id === current)
            ? current
            : list.find(a => a.isDefault)?.id ?? list[0]?.id ?? null,
        );
      })
      .catch(e => setError(e instanceof Error ? e.message : t('Something went wrong')));
  }, []);

  // Again on coming back from adding an account.
  useFocusEffect(load);

  if (!summary) {
    return (
      <Screen header={<Header title={t('Withdraw')} />} scroll={false}>
        <StateView error={error} onRetry={load} />
      </Screen>
    );
  }

  const max = Math.min(summary.withdrawable, summary.maxWithdrawal);

  const submit = async () => {
    const value = Number(amount);
    if (!value || value < summary.minWithdrawal) {
      setAmountError(t('The smallest withdrawal is {amount}.', { amount: formatRs(summary.minWithdrawal) }));
      return;
    }
    if (value > max) {
      setAmountError(t('You can withdraw up to {amount}.', { amount: formatRs(max) }));
      return;
    }
    if (!accountId) return;
    setSending(true);
    try {
      await requestWithdrawal(value, accountId);
      Alert.alert(
        t('Withdrawal requested'),
        t("Fazl's team will send {amount} to your account. You can follow it under Withdrawals.", {
          amount: formatRs(value),
        }),
        [{ text: t('OK'), onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert(t('Could not request'), e instanceof Error ? e.message : '');
      setSending(false);
    }
  };

  return (
    <Screen
      header={<Header title={t('Withdraw')} />}
      footer={
        <Button
          title={t('Request withdrawal')}
          flex
          loading={sending}
          loadingText={t('Sending')}
          disabled={sending || !amount || !accountId}
          onPress={submit}
        />
      }
    >
      <TextField
        label={t('Amount')}
        prefix={t('Rs')}
        value={amount}
        onChangeText={v => {
          setAmount(v.replace(/[^0-9]/g, ''));
          setAmountError(undefined);
        }}
        keyboardType="number-pad"
        placeholder={String(summary.minWithdrawal)}
        hint={t('Available to withdraw: {amount}', { amount: formatRs(summary.withdrawable) })}
        error={amountError}
      />
      <Pressable onPress={() => setAmount(String(max))} hitSlop={8} style={styles.all}>
        <AppText variant="label" color={colors.primary}>
          {t('Withdraw all ({amount})', { amount: formatRs(max) })}
        </AppText>
      </Pressable>

      <SectionHeader
        title={t('Send to')}
        actionLabel={t('Add account')}
        onAction={() => navigation.navigate('PayoutAccountForm')}
      />
      <Card padded={false}>
        {accounts.map((a, i) => {
          const chosen = a.id === accountId;
          return (
            <Pressable
              key={a.id}
              onPress={() => setAccountId(a.id)}
              style={({ pressed }) => [styles.row, i > 0 && styles.border, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen }}
            >
              <IconCircle icon={a.method === 'bank_transfer' ? Landmark : Smartphone} tone="primary" size={36} />
              <View style={styles.flex}>
                <AppText variant="bodyBold">{accountLine(a)}</AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  {a.accountTitle}
                </AppText>
              </View>
              <View style={[styles.radio, chosen && styles.radioOn]}>
                {chosen ? <Check size={14} color={colors.white} /> : null}
              </View>
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    all: { alignSelf: 'flex-start', marginTop: -spacing.sm, marginBottom: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
    border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    pressed: { opacity: 0.7 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  }),
);
