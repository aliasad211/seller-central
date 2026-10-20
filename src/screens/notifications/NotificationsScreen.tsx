import {
  Bell,
  Bike,
  ClipboardList,
  Heart,
  LucideIcon,
  Megaphone,
  PackageX,
  Sparkles,
  Tag,
  Truck,
} from 'lucide-react-native';
import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../../api';
import { AppText, EmptyState, Header, IconCircle, Screen, StateView } from '../../components';
import { useLoad } from '../../hooks/useLoad';
import { RootScreenProps } from '../../navigation/types';
import { colors, spacing, themedStyles, Tone } from '../../theme';
import { AppNotification, NotificationType } from '../../types/models';
import { timeAgo } from '../../utils/format';
import { t } from '../../i18n';
import { useAuth } from '../../state/AuthContext';

const LOOK: Record<NotificationType, { icon: LucideIcon; tone: Tone }> = {
  order: { icon: ClipboardList, tone: 'secondary' },
  like: { icon: Heart, tone: 'danger' },
  offer: { icon: Tag, tone: 'success' },
  stock: { icon: PackageX, tone: 'danger' },
  ad: { icon: Megaphone, tone: 'purple' },
  rider: { icon: Bike, tone: 'info' },
  shipping: { icon: Truck, tone: 'success' },
  system: { icon: Sparkles, tone: 'primary' },
};

export function NotificationsScreen({ navigation }: RootScreenProps<'Notifications'>) {
  const { seller } = useAuth();
  const userId = seller?.id;
  const shopId = seller?.shop?.id;
  const { data, setData, error, reload, refresh, refreshing } = useLoad(
    () => (userId && shopId ? listNotifications(userId, shopId) : Promise.resolve([])),
    [userId, shopId],
  );
  const unread = (data ?? []).filter(n => !n.read).length;

  const open = (n: AppNotification) => {
    if (!n.read) {
      setData(d => d?.map(x => (x.id === n.id ? { ...x, read: true } : x)));
      markNotificationRead(n.id).catch(() => undefined);
    }
    // An order opens itself; a like or an offer, the shop's products (the
    // listing may be a private one, not in this shop).
    if (n.orderId) navigation.navigate('OrderDetail', { orderId: n.orderId });
    else if (n.productId) navigation.navigate('Tabs', { screen: 'Products' });
    else if (n.type === 'ad') navigation.navigate('Ads');
    // An approved shop is now in the list to switch to; a rejected one's fee is back.
    else if (n.shopRequest) navigation.navigate('ChooseShop');
  };

  return (
    <Screen
      header={
        <Header
          title={t('Notifications')}
          subtitle={unread ? t('{count} unread', { count: unread }) : undefined}
          right={
            unread ? (
              <Pressable
                onPress={() => {
                  setData(d => d?.map(x => ({ ...x, read: true })));
                  if (userId) markAllNotificationsRead(userId).catch(() => undefined);
                }}
                hitSlop={8}
              >
                <AppText variant="label" color={colors.primary}>
                  {t('Mark all read')}
                </AppText>
              </Pressable>
            ) : undefined
          }
        />
      }
      scroll={false}
      padded={false}
    >
      {!data ? (
        <StateView error={error} onRetry={reload} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={n => n.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon={Bell} title={t("You're all caught up")} message={t('New orders, and likes and offers on your listings, show up here.')} />}
          renderItem={({ item }) => {
            const look = LOOK[item.type];
            return (
              <Pressable
                onPress={() => open(item)}
                style={({ pressed }) => [styles.row, !item.read && styles.unread, pressed && styles.pressed]}
              >
                <IconCircle icon={look.icon} tone={look.tone} size={40} />
                <View style={styles.flex}>
                  <View style={styles.titleRow}>
                    <AppText variant="bodyBold" style={styles.flex} numberOfLines={1}>
                      {item.title}
                    </AppText>
                    <AppText variant="caption" color={colors.textMuted}>
                      {timeAgo(item.createdAt)}
                    </AppText>
                  </View>
                  <AppText variant="caption" color={colors.textMuted}>
                    {item.body}
                  </AppText>
                </View>
                {!item.read ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  unread: { backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
}));
