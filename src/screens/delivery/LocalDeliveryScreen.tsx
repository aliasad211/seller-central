import { Bike, PackageCheck } from 'lucide-react-native';
import { ChevronForward } from '../../components/Chevrons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { listOrders } from '../../api';
import {
  AppText,
  Card,
  Header,
  IconCircle,
  Screen,
  SectionHeader,
  StateView,
} from '../../components';
import { useLoad } from '../../hooks/useLoad';
import { RootScreenProps } from '../../navigation/types';
import { colors, spacing, themedStyles } from '../../theme';
import { Order } from '../../types/models';
import { timeAgo } from '../../utils/format';
import { t } from '../../i18n';
import { useAuth } from '../../state/AuthContext';

/**
 * The shop's delivery orders once they're ready: waiting to go out, and on
 * their way. The seller delivers them themselves for now (the order's "Deliver
 * it myself"); Fazl riders come once riders are on Fazl.
 */
export function LocalDeliveryScreen({ navigation }: RootScreenProps<'LocalDelivery'>) {
  const shopId = useAuth().seller?.shop?.id;
  const { data, error, reload, refresh, refreshing } = useLoad(async () => {
    const orders = shopId ? await listOrders(shopId) : [];
    return orders.filter(o => o.fulfilment === 'delivery');
  }, [shopId]);

  if (!data) {
    return (
      <Screen header={<Header title={t('Local Delivery')} />} scroll={false}>
        <StateView error={error} onRetry={reload} />
      </Screen>
    );
  }

  const ready = data.filter(o => o.status === 'ready');
  // Out with the seller, or shipped the older way (courier parcels are in
  // Shipping & Tracking).
  const onTheWay = data.filter(
    o => o.delivery.type === 'local' && (o.status === 'out_for_delivery' || o.status === 'shipped'),
  );
  const open = (o: Order) => navigation.navigate('OrderDetail', { orderId: o.id });

  return (
    <Screen header={<Header title={t('Local Delivery')} />} onRefresh={refresh} refreshing={refreshing}>
      <Card style={styles.intro}>
        <AppText variant="subheading">{t('No rider of your own? No problem.')}</AppText>
        <AppText color={colors.textMuted}>
          {t('Mark an order ready, then deliver it yourself: the customer sees "Out for delivery" on Fazl, and "Delivered" once you hand it over.')}
        </AppText>
      </Card>

      <Card style={styles.riders}>
        <IconCircle icon={Bike} />
        <View style={styles.flex}>
          <AppText variant="bodyBold">{t('Fazl riders are coming soon')}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {t("You'll be able to send an order with a nearby Fazl rider from here.")}
          </AppText>
        </View>
      </Card>

      <SectionHeader title={t('Ready to send ({count})', { count: ready.length })} />
      {ready.length ? (
        <View style={styles.list}>
          {ready.map(o => (
            <DeliveryRow key={o.id} order={o} onPress={() => open(o)} />
          ))}
        </View>
      ) : (
        <AppText color={colors.textMuted}>{t('No local orders are waiting to be sent.')}</AppText>
      )}

      <SectionHeader title={t('On the way ({count})', { count: onTheWay.length })} />
      {onTheWay.length ? (
        <View style={styles.list}>
          {onTheWay.map(o => (
            <DeliveryRow key={o.id} order={o} onPress={() => open(o)} />
          ))}
        </View>
      ) : (
        <AppText color={colors.textMuted}>{t('Nothing on the way right now.')}</AppText>
      )}
    </Screen>
  );
}

function DeliveryRow({ order, onPress }: { order: Order; onPress: () => void }) {
  const last = order.history[order.history.length - 1].at;
  const line =
    order.status === 'ready'
      ? [order.customer.address, t('ready {time}', { time: timeAgo(last) })].filter(Boolean).join(' · ')
      : order.delivery.method === 'self' && order.delivery.riderName
      ? t('{name} is delivering', { name: order.delivery.riderName })
      : order.delivery.method === 'self'
      ? t('You are delivering')
      : t('Shipped');
  return (
    <Card onPress={onPress} style={styles.row}>
      <IconCircle
        icon={order.status === 'ready' ? PackageCheck : Bike}
        tone={order.status === 'ready' ? 'primary' : 'info'}
        size={38}
      />
      <View style={styles.flex}>
        <AppText variant="bodyBold">
          {order.number} · {order.customer.name}
        </AppText>
        <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
          {line}
        </AppText>
      </View>
      <ChevronForward size={20} color={colors.textSubtle} />
    </Card>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  intro: { gap: spacing.sm },
  riders: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
}));
