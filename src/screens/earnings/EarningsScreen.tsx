import { Receipt, Wallet } from 'lucide-react-native';
import { ChevronForward } from '../../components/Chevrons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { getEarnings } from '../../api';
import { getPayoutSummary } from '../../api/payouts';
import {
  AppText,
  BarChart,
  Card,
  Divider,
  EmptyState,
  Header,
  IconCircle,
  InfoRow,
  Screen,
  SectionHeader,
  Segmented,
  StateView,
} from '../../components';
import { useLoad } from '../../hooks/useLoad';
import { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing, themedStyles } from '../../theme';
import { EarningsPeriod } from '../../types/models';
import { formatDayMonth, formatRs } from '../../utils/format';
import { orderNet } from '../../utils/orders';
import { t } from '../../i18n';
import { useAuth } from '../../state/AuthContext';

const RANGE: Record<EarningsPeriod, string> = {
  daily: t('Last 7 days'),
  weekly: t('Last 7 weeks'),
  monthly: t('Last 7 months'),
};

export function EarningsScreen({ navigation }: RootScreenProps<'Earnings'>) {
  const [period, setPeriod] = useState<EarningsPeriod>('daily');
  const shopId = useAuth().seller?.shop?.id;
  const { data, error, reload, refresh, refreshing } = useLoad(
    () => (shopId ? getEarnings(shopId, period) : Promise.reject(new Error(t('No shop on this account.')))),
    [shopId, period],
  );
  // What's in the owner's Fazl wallet to withdraw; the card opens Withdraw.
  const payouts = useLoad(getPayoutSummary);

  return (
    <Screen
      header={<Header title={t('Earnings')} />}
      onRefresh={() => {
        refresh();
        payouts.refresh();
      }}
      refreshing={refreshing}
    >
      <Card onPress={() => navigation.navigate('Payouts')} style={styles.wallet}>
        <IconCircle icon={Wallet} tone="primary" size={40} />
        <View style={styles.flex}>
          <AppText variant="caption" color={colors.textMuted}>
            {t('Available to withdraw')}
          </AppText>
          <AppText variant="subheading">
            {payouts.data ? formatRs(payouts.data.withdrawable) : '—'}
          </AppText>
        </View>
        <AppText variant="label" color={colors.primary}>
          {t('Withdraw')}
        </AppText>
        <ChevronForward size={18} color={colors.primary} />
      </Card>

      <Segmented
        options={[
          { key: 'daily', label: t('Daily') },
          { key: 'weekly', label: t('Weekly') },
          { key: 'monthly', label: t('Monthly') },
        ]}
        value={period}
        onChange={setPeriod}
      />

      {!data ? (
        <StateView error={error} onRetry={reload} />
      ) : (
        <>
          <View style={styles.hero}>
            <AppText variant="label" color={colors.primaryTint}>
              Net earnings · {RANGE[period]}
            </AppText>
            <AppText variant="title" color={colors.white} style={styles.heroValue}>
              {formatRs(data.totals.net)}
            </AppText>
            <AppText color={colors.white}>
              {formatRs(data.totals.sales)} sales from {data.totals.orders} order{data.totals.orders === 1 ? '' : 's'}
            </AppText>
          </View>

          <SectionHeader title={t('Sales')} />
          <Card>
            <BarChart data={data.series} />
          </Card>

          <SectionHeader title={t('Breakdown')} />
          <Card>
            <InfoRow label={t('Total orders')} value={String(data.totals.orders)} />
            <InfoRow label={t('Total sales')} value={formatRs(data.totals.sales)} />
            <InfoRow label={t('Delivery charges')} value={`+ ${formatRs(data.totals.deliveryCharges)}`} />
            <InfoRow label={t('Fazl charges')} value={`- ${formatRs(data.totals.fazlCharges)}`} />
            <InfoRow label={t('Discounts')} value={`- ${formatRs(data.totals.discounts)}`} />
            <InfoRow label={t('Refunds')} value={`- ${formatRs(data.totals.refunds)}`} color={data.totals.refunds ? colors.danger : undefined} />
            <Divider />
            <InfoRow label={t('Net earnings')} value={formatRs(data.totals.net)} strong color={colors.success} />
          </Card>

          <SectionHeader title={t('Order records')} />
          {data.records.length === 0 ? (
            <EmptyState icon={Receipt} title={t('No sales in this period')} message={t('Delivered orders show up here.')} />
          ) : (
            <Card padded={false}>
              {data.records.map((o, i) => (
                <Pressable
                  key={o.id}
                  onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}
                  style={({ pressed }) => [styles.record, i > 0 && styles.border, pressed && styles.pressed]}
                >
                  <View style={styles.flex}>
                    <AppText variant="bodyBold">{o.number}</AppText>
                    <AppText variant="caption" color={colors.textMuted}>
                      {formatDayMonth(o.createdAt)} · {t('Sale {amount}', { amount: formatRs(o.subtotal) })}
                      {o.fazlCharge ? ` · ${t('Fazl {amount}', { amount: formatRs(o.fazlCharge) })}` : ''}
                      {o.refund ? ` · ${t('Refund {amount}', { amount: formatRs(o.refund) })}` : ''}
                    </AppText>
                  </View>
                  <AppText variant="bodyBold" color={orderNet(o) >= 0 ? colors.success : colors.danger}>
                    {formatRs(orderNet(o))}
                  </AppText>
                  <ChevronForward size={18} color={colors.textSubtle} />
                </Pressable>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  heroValue: { fontSize: 30, lineHeight: 36 },
  record: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { opacity: 0.7 },
}));
