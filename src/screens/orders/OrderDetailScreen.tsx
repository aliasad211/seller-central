import { Bike, Info, MapPin, Pencil, Phone, Store, Truck, User } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { getOrder, updateOrderStatus, updateTracking } from '../../api';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  Header,
  IconCircle,
  InfoRow,
  Screen,
  StateView,
  StepLine,
  Thumb,
} from '../../components';
import { useLoad } from '../../hooks/useLoad';
import { RootScreenProps } from '../../navigation/types';
import { colors, spacing, themedStyles } from '../../theme';
import { Order, OrderStatus } from '../../types/models';
import { formatDateTime, formatRs } from '../../utils/format';
import {
  OrderAction,
  orderActions,
  orderNet,
  orderSteps,
  RIDER_STEPS,
  statusLabel,
  STATUS_TONES,
  TRACKING_STEPS,
} from '../../utils/orders';
import { t } from '../../i18n';
import { useAuth } from '../../state/AuthContext';
import { ReturnRefundSheet } from './ReturnRefundSheet';

export function OrderDetailScreen({ route, navigation }: RootScreenProps<'OrderDetail'>) {
  const { orderId } = route.params;
  const shopId = useAuth().seller?.shop?.id ?? '';
  const { data: order, setData, error, reload } = useLoad(() => getOrder(shopId, orderId), [shopId]);
  const [busy, setBusy] = useState<string | null>(null);
  // Marking it returned asks why; refunding asks how much (ReturnRefundSheet).
  const [sheet, setSheet] = useState<'return' | 'refund' | null>(null);

  if (!order) {
    return (
      <Screen header={<Header title={t('Order')} />} scroll={false}>
        <StateView error={error} onRetry={reload} />
      </Screen>
    );
  }

  const run = async (key: string, work: () => Promise<Order>) => {
    setBusy(key);
    try {
      setData(await work());
    } catch (e) {
      Alert.alert(t('Could not update the order'), e instanceof Error ? e.message : '');
    } finally {
      setBusy(null);
    }
  };

  const changeStatus = (next: OrderStatus) =>
    run(next, () => updateOrderStatus(shopId, order.id, next));

  const onAction = (a: OrderAction) => {
    switch (a.kind) {
      case 'status':
        if (a.next === 'cancelled') {
          Alert.alert(
            order.status === 'new' ? t('Reject this order?') : t('Cancel this order?'),
            t('The customer will be told on Fazl.'),
            [
              { text: t('Keep order'), style: 'cancel' },
              {
                text: order.status === 'new' ? t('Reject') : t('Cancel order'),
                style: 'destructive',
                onPress: () => changeStatus('cancelled'),
              },
            ],
          );
        } else if (a.next === 'returned') {
          setSheet('return');
        } else if (a.next === 'refunded') {
          setSheet('refund');
        } else {
          changeStatus(a.next);
        }
        break;
      case 'selfDelivery':
        // Who takes it: the seller, or one of the team's riders.
        navigation.navigate('SelfDelivery', { orderId: order.id });
        break;
      case 'assignRider':
        navigation.navigate('AssignRider', { orderId: order.id });
        break;
      case 'addTracking':
        navigation.navigate('CourierForm', { orderId: order.id });
        break;
      case 'tracking':
        run(a.next, () => updateTracking(shopId, order.id, a.next));
        break;
    }
  };

  const actions = orderActions(order);
  const reached = new Map(order.history.map(h => [h.status, h.at]));
  const steps = orderSteps(order);
  const currentIndex = steps.indexOf(order.status);
  const ended = ['cancelled', 'returned', 'refunded'].includes(order.status);
  const local = order.delivery.type === 'local';
  const address = [order.customer.address, order.customer.area, order.customer.city]
    .filter(Boolean)
    .join(', ');

  return (
    <Screen
      header={
        <Header
          title={order.number}
          subtitle={t('Placed {date}', { date: formatDateTime(order.createdAt) })}
          right={<Badge label={statusLabel(order)} tone={STATUS_TONES[order.status]} />}
        />
      }
      footer={
        actions.length ? (
          <>
            {actions
              .slice()
              .reverse()
              .map((a, i, all) => {
                const main = i === all.length - 1;
                const variant =
                  a.kind === 'status' && a.tone === 'danger'
                    ? 'danger'
                    : a.kind === 'status' && a.tone === 'outline'
                    ? 'outline'
                    : main
                    ? 'primary'
                    : 'outline';
                return (
                  <Button
                    key={a.label}
                    title={a.label}
                    variant={variant}
                    flex
                    loading={busy !== null && busy === ('next' in a ? a.next : '')}
                    disabled={busy !== null}
                    onPress={() => onAction(a)}
                  />
                );
              })}
          </>
        ) : undefined
      }
    >
      {ended ? (
        <Card style={styles.endedCard}>
          <AppText variant="subheading">
            {order.status === 'cancelled' ? t('Order cancelled') : order.status === 'returned' ? t('Order returned') : t('Customer refunded')}
          </AppText>
          {order.cancelReason || order.returnReason ? (
            <AppText color={colors.textMuted}>
              {t('Reason: {reason}', { reason: t(order.cancelReason ?? order.returnReason ?? '') })}
            </AppText>
          ) : null}
          {order.refund ? <AppText color={colors.textMuted}>{t('Refunded {amount}', { amount: formatRs(order.refund) })}</AppText> : null}
        </Card>
      ) : (
        <Card>
          <AppText variant="subheading" style={styles.cardTitle}>
            {t('Order progress')}
          </AppText>
          <StepLine
            steps={steps.map((s, i) => ({
              label: statusLabel(order, s),
              done: i <= currentIndex,
              current: i === currentIndex,
              at: reached.has(s) ? formatDateTime(reached.get(s) as string) : undefined,
            }))}
          />
          <View style={styles.syncNote}>
            <Info size={14} color={colors.textMuted} />
            <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
              {t('The customer sees every update on Fazl straight away.')}
            </AppText>
          </View>
        </Card>
      )}

      {/* Delivery */}
      {order.fulfilment ? (
        <Card style={styles.gap}>
          <View style={styles.cardHead}>
            <IconCircle icon={order.fulfilment === 'pickup' ? Store : Truck} tone="info" size={36} />
            <View style={styles.flex}>
              <AppText variant="subheading">
                {order.fulfilment === 'pickup'
                  ? t('Pickup from your shop')
                  : local
                  ? t('Delivery to the customer')
                  : t('Nationwide shipping')}
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {order.fulfilment === 'pickup'
                  ? t('The customer collects it from your shop.')
                  : !local
                  ? `${order.delivery.courier ?? ''} · ${order.delivery.trackingId ?? ''}`
                  : order.delivery.method === 'self' && order.delivery.riderName
                  ? t('Your team rider is delivering this order')
                  : order.delivery.method === 'self'
                  ? t('You are delivering this order')
                  : t("Send it to the customer's address below.")}
              </AppText>
            </View>
            {/* The courier or tracking ID can be corrected while it's on its way. */}
            {!local && order.delivery.trackingId && ['shipped', 'out_for_delivery'].includes(order.status) ? (
              <Pressable
                onPress={() => navigation.navigate('CourierForm', { orderId: order.id })}
                hitSlop={10}
                accessibilityLabel={t('Edit tracking')}
              >
                <Pencil size={18} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
          {local && order.delivery.method === 'self' && order.delivery.riderName ? (
            <>
              <Divider />
              <View style={styles.riderRow}>
                <IconCircle icon={Bike} tone="primary" size={36} />
                <View style={styles.flex}>
                  <AppText variant="bodyBold">{order.delivery.riderName}</AppText>
                  {order.delivery.riderPhone ? (
                    <AppText variant="caption" color={colors.textMuted}>
                      {order.delivery.riderPhone}
                    </AppText>
                  ) : null}
                </View>
                {order.delivery.riderPhone ? (
                  <Button
                    title={t('Call')}
                    icon={Phone}
                    size="sm"
                    variant="secondary"
                    onPress={() => Linking.openURL(`tel:${order.delivery.riderPhone?.replace(/\s/g, '')}`)}
                  />
                ) : null}
              </View>
            </>
          ) : null}
          {!local && order.delivery.trackingStatus ? (
            <>
              <Divider />
              <StepLine
                steps={TRACKING_STEPS.map((s, i) => {
                  const at = TRACKING_STEPS.findIndex(x => x.status === order.delivery.trackingStatus);
                  return { label: s.label, done: i <= at, current: i === at };
                })}
              />
            </>
          ) : null}
        </Card>
      ) : (
      <Card style={styles.gap}>
        <View style={styles.cardHead}>
          <IconCircle icon={local ? Bike : Truck} tone="info" size={36} />
          <View style={styles.flex}>
            <AppText variant="subheading">{local ? t('Local delivery') : t('Nationwide shipping')}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {local
                ? order.delivery.method === 'self'
                  ? t('You are delivering this order')
                  : order.delivery.method === 'rider'
                  ? t('Delivered by a Fazl rider')
                  : t('Deliver it yourself or hand it to a Fazl rider once it is ready')
                : order.delivery.courier
                ? `${order.delivery.courier} · ${order.delivery.trackingId}`
                : t('Add the courier and tracking ID once it is packed')}
            </AppText>
          </View>
          {!local && order.delivery.trackingId && order.status === 'shipped' ? (
            <Pressable
              onPress={() => navigation.navigate('CourierForm', { orderId: order.id })}
              hitSlop={10}
              accessibilityLabel={t('Edit tracking')}
            >
              <Pencil size={18} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>

        {local && order.delivery.method === 'rider' ? (
          <>
            <Divider />
            <View style={styles.personRow}>
              <IconCircle icon={User} tone="primary" size={36} />
              <View style={styles.flex}>
                <AppText variant="bodyBold">{order.delivery.riderName}</AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  {order.delivery.riderPhone}
                </AppText>
              </View>
              <Button
                title={t('Call')}
                icon={Phone}
                size="sm"
                variant="secondary"
                onPress={() => Linking.openURL(`tel:${order.delivery.riderPhone?.replace(/\s/g, '')}`)}
              />
            </View>
            <StepLine
              steps={RIDER_STEPS.map((s, i) => {
                const at = RIDER_STEPS.findIndex(x => x.status === order.delivery.riderStatus);
                return { label: s.label, done: i <= at, current: i === at };
              })}
            />
          </>
        ) : null}

        {!local && order.delivery.trackingStatus ? (
          <>
            <Divider />
            <StepLine
              steps={TRACKING_STEPS.map((s, i) => {
                const at = TRACKING_STEPS.findIndex(x => x.status === order.delivery.trackingStatus);
                return { label: s.label, done: i <= at, current: i === at };
              })}
            />
          </>
        ) : null}
      </Card>
      )}

      {/* Customer */}
      <Card style={styles.gap}>
        <View style={styles.cardHead}>
          <IconCircle icon={User} tone="primary" size={36} />
          <View style={styles.flex}>
            <AppText variant="subheading">{order.customer.name}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {order.customer.phone}
            </AppText>
          </View>
          {order.customer.phone ? (
            <Button
              title={t('Call')}
              icon={Phone}
              size="sm"
              variant="secondary"
              onPress={() => Linking.openURL(`tel:${order.customer.phone.replace(/\s/g, '')}`)}
            />
          ) : null}
        </View>
        {address ? (
          <View style={styles.address}>
            <MapPin size={16} color={colors.textMuted} />
            <AppText color={colors.textMuted} style={styles.flex}>
              {address}
            </AppText>
          </View>
        ) : order.fulfilment === 'delivery' ? (
          <AppText variant="caption" color={colors.textMuted} style={styles.address}>
            {t('No address on their Fazl profile. Call them to ask.')}
          </AppText>
        ) : null}
        {order.note ? (
          <View style={styles.note}>
            <AppText variant="caption" color={colors.warning}>
              {t('Customer note')}
            </AppText>
            <AppText>{order.note}</AppText>
          </View>
        ) : null}
      </Card>

      {/* Items */}
      <Card style={styles.gap}>
        <AppText variant="subheading" style={styles.cardTitle}>
          {t('Items')}
        </AppText>
        {order.items.map((item, i) => (
          <View key={`${item.productId}-${i}`} style={[styles.itemRow, i > 0 && styles.itemBorder]}>
            <Thumb uri={item.image} size={52} />
            <View style={styles.flex}>
              <AppText numberOfLines={2}>{item.title}</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {[item.variant, `${item.qty} × ${formatRs(item.unitPrice)}`].filter(Boolean).join(' · ')}
              </AppText>
            </View>
            <AppText variant="bodyBold">{formatRs(item.qty * item.unitPrice)}</AppText>
          </View>
        ))}
      </Card>

      {/* Money */}
      <Card style={styles.gap}>
        <View style={styles.payHead}>
          <AppText variant="subheading">{t('Payment')}</AppText>
          <Badge
            label={order.payment === 'cod' ? t('Cash on delivery') : t('Easypaisa')}
            tone={order.payment === 'cod' ? 'warning' : 'success'}
          />
        </View>
        {/* A real order has one amount — what the customer pays; Fazl
            doesn't split out delivery fees or its charges yet. */}
        <InfoRow
          label={order.fulfilment ? t('Order total') : t('Items')}
          value={formatRs(order.subtotal)}
        />
        {order.fulfilment && !order.deliveryCharge ? null : (
          <InfoRow label={t('Delivery charge')} value={formatRs(order.deliveryCharge)} />
        )}
        {order.discount ? <InfoRow label={t('Discount')} value={`- ${formatRs(order.discount)}`} /> : null}
        {order.fulfilment && !order.fazlCharge ? null : (
          <InfoRow label={t('Fazl charge')} value={`- ${formatRs(order.fazlCharge)}`} />
        )}
        {order.refund ? <InfoRow label={t('Refund')} value={`- ${formatRs(order.refund)}`} color={colors.danger} /> : null}
        <Divider />
        <InfoRow label={t('Your earning')} value={formatRs(orderNet(order))} strong color={colors.success} />
      </Card>

      <ReturnRefundSheet
        mode={sheet}
        order={order}
        shopId={shopId}
        onClose={() => setSheet(null)}
        onDone={updated => {
          setData(updated);
          setSheet(null);
        }}
      />
    </Screen>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  gap: { marginTop: spacing.md },
  cardTitle: { marginBottom: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  endedCard: { gap: spacing.xs, backgroundColor: colors.dangerSoft },
  syncNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  // The team rider taking it: the last thing in the delivery card.
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  address: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  note: {
    marginTop: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: 10,
    padding: spacing.md,
    gap: 2,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  itemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  payHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
}));
