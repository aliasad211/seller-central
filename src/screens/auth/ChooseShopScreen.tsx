import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Hourglass, LogOut, MapPin, Plus, Store } from 'lucide-react-native';
import { ChevronForward } from '../../components/Chevrons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ButtonBackground from '../../assets/images/button-background.png';
import { cancelShopRequest, listShopRequests, ShopRequest } from '../../api/shopRequests';
import { AppText, Badge, Button, Header, IconCircle, Screen } from '../../components';
import { formatRs, timeAgo } from '../../utils/format';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../state/AuthContext';
import { colors, radius, shadow, spacing, themedStyles } from '../../theme';
import { confirmLogout } from '../../utils/confirmLogout';
import { Shop } from '../../types/models';
import { t } from '../../i18n';

/** The backend's limit (MAX_SHOPS_PER_OWNER), counting shops waiting for approval. */
const MAX_SHOPS = 3;
/** A turned-down request stays listed this long, so its reason can be read. */
const REJECTED_SHOWN_MS = 14 * 24 * 60 * 60 * 1000;

/** Right after login, when the account has several shops and none is chosen. */
export function SelectShopScreen() {
  return <ShopPicker switching={false} />;
}

/** Switching to another of the account's shops, from Home or More. */
export function ChooseShopScreen() {
  return <ShopPicker switching />;
}

function ShopPicker({ switching }: { switching: boolean }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { seller, selectShop, reloadShops, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [choosing, setChoosing] = useState<string | null>(null);
  // The owner's requests for further shops: waiting ones, and recent refusals.
  const [requests, setRequests] = useState<ShopRequest[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const isOwner = !seller?.member;

  const loadRequests = useCallback(() => {
    if (!isOwner) return Promise.resolve();
    return listShopRequests()
      .then(setRequests)
      .catch(() => undefined);
  }, [isOwner]);

  // Again on coming back from Create shop.
  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([reloadShops(), loadRequests()]);
    } catch {
      // Keep the list already shown; pulling again retries.
    } finally {
      setRefreshing(false);
    }
  };

  const cancelRequest = (r: ShopRequest) => {
    Alert.alert(
      t('Cancel this request?'),
      r.fee > 0
        ? t('{name} is removed and {amount} goes back to your Fazl wallet.', { name: r.shopTitle, amount: formatRs(r.fee) })
        : t('{name} is removed.', { name: r.shopTitle }),
      [
        { text: t('Keep it'), style: 'cancel' },
        {
          text: t('Cancel request'),
          style: 'destructive',
          onPress: async () => {
            setCancelling(r.id);
            try {
              await cancelShopRequest(r.id);
              await loadRequests();
            } catch (e) {
              Alert.alert(t('Could not cancel'), e instanceof Error ? e.message : '');
            } finally {
              setCancelling(null);
            }
          },
        },
      ],
    );
  };

  // Switching: show the account's shops as they are now on Fazl.
  useEffect(() => {
    if (switching) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = async (shop: Shop) => {
    if (choosing) return;
    if (switching && shop.id === seller?.shop?.id) {
      navigation.goBack();
      return;
    }
    setChoosing(shop.id);
    try {
      await selectShop(shop.id);
      // After login the app moves on to Home by itself; when switching, go back there.
      if (switching) navigation.navigate('Tabs', { screen: 'Home' });
    } catch (e) {
      Alert.alert(t("Couldn't open this shop"), e instanceof Error ? e.message : '');
      setChoosing(null);
    }
  };

  // Suspended shops, and ones waiting for approval, aren't in the list (see api/session.ts).
  const shops = seller?.shops ?? [];
  const firstName = (seller?.name ?? '').split(' ')[0];
  const waiting = requests.filter(r => r.status === 'pending');
  const refused = requests.filter(
    r => r.status === 'rejected' && Date.now() - new Date(r.reviewedAt ?? r.createdAt).getTime() < REJECTED_SHOWN_MS,
  );
  // Fazl allows an account 3 shops that aren't suspended, counting ones
  // waiting for approval. Team members cannot create shops.
  const canCreate = isOwner && shops.length + waiting.length < MAX_SHOPS;

  return (
    <Screen
      header={
        switching ? (
          <Header title={t('Switch shop')} subtitle={t('{count} shops on your account', { count: shops.length })} />
        ) : undefined
      }
      scroll={false}
      padded={false}
    >
      <FlatList
        data={shops}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}
        ListHeaderComponent={
          switching ? undefined : (
            <ImageBackground
              source={ButtonBackground}
              resizeMode="cover"
              style={styles.hero}
              imageStyle={styles.heroImage}
            >
              <AppText variant="label" color={colors.primaryTint}>
                {t('Assalam o Alaikum')}{firstName ? `, ${firstName}` : ''}
              </AppText>
              <AppText variant="title" color={colors.white} style={styles.heroTitle}>
                {t('Choose your shop')}
              </AppText>
              <AppText color={colors.white} style={styles.heroText}>
                You have {shops.length} shops on Fazl. Pick the one to manage — you can switch any time from Home or More.
              </AppText>
            </ImageBackground>
          )
        }
        renderItem={({ item }) => (
          <ShopCard
            shop={item}
            current={switching && item.id === seller?.shop?.id}
            opening={choosing === item.id}
            dimmed={!!choosing && choosing !== item.id}
            onPress={() => choose(item)}
          />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            {[...waiting, ...refused].map(r => (
              <RequestCard
                key={r.id}
                request={r}
                cancelling={cancelling === r.id}
                onCancel={r.status === 'pending' ? () => cancelRequest(r) : undefined}
              />
            ))}
            {canCreate ? (
              <Button
                title={t('Create a new shop')}
                icon={Plus}
                variant="outline"
                disabled={!!choosing}
                onPress={() => navigation.navigate('CreateShop')}
                style={styles.create}
              />
            ) : null}
            {switching ? null : (
              <>
                <AppText variant="caption" color={colors.textMuted} align="center">
                  Signed in as {seller?.email}
                </AppText>
                <Pressable onPress={() => confirmLogout(signOut)} style={styles.logout} hitSlop={8} disabled={!!choosing}>
                  <LogOut size={18} color={colors.danger} />
                  <AppText variant="bodyBold" color={colors.danger}>
                    {t('Log out')}
                  </AppText>
                </Pressable>
              </>
            )}
          </View>
        }
      />
    </Screen>
  );
}

function ShopCard({
  shop,
  current,
  opening,
  dimmed,
  onPress,
}: {
  shop: Shop;
  current: boolean;
  opening: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const place = [shop.area, shop.city].filter(Boolean).join(', ');
  return (
    <Pressable
      onPress={onPress}
      disabled={opening || dimmed}
      style={({ pressed }) => [
        styles.card,
        (current || opening) && styles.cardActive,
        dimmed && styles.dimmed,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('Open {name}', { name: shop.name })}
    >
      {shop.logo ? (
        <Image source={{ uri: shop.logo }} style={styles.logo} />
      ) : (
        <IconCircle icon={Store} size={60} />
      )}
      <View style={styles.body}>
        <AppText variant="subheading" numberOfLines={1}>
          {shop.name}
        </AppText>
        {shop.category ? (
          <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
            {shop.category}
          </AppText>
        ) : null}
        {place ? (
          <View style={styles.place}>
            <MapPin size={12} color={colors.textMuted} />
            <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
              {place}
            </AppText>
          </View>
        ) : null}
        {current ? (
          <View style={styles.badges}>
            <Badge label={t('Current')} tone="primary" />
          </View>
        ) : null}
      </View>
      <View style={styles.side}>
        {opening ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <ChevronForward size={22} color={current ? colors.primary : colors.textSubtle} />
        )}
      </View>
    </Pressable>
  );
}

/** A further shop the owner asked for: waiting for Fazl, or turned down. */
function RequestCard({
  request,
  cancelling,
  onCancel,
}: {
  request: ShopRequest;
  cancelling: boolean;
  onCancel?: () => void;
}) {
  const pending = request.status === 'pending';
  return (
    <View style={[styles.card, styles.request]}>
      <IconCircle icon={Hourglass} size={60} />
      <View style={styles.body}>
        <AppText variant="subheading" numberOfLines={1}>
          {request.shopTitle}
        </AppText>
        <View style={styles.badges}>
          <Badge label={pending ? t('Waiting for approval') : t('Not approved')} tone={pending ? 'warning' : 'danger'} />
        </View>
        <AppText variant="caption" color={colors.textMuted}>
          {pending
            ? request.fee > 0
              ? t('Sent {time} · {amount} paid', { time: timeAgo(request.createdAt), amount: formatRs(request.fee) })
              : t('Sent {time}', { time: timeAgo(request.createdAt) })
            : [request.rejectionReason, request.fee > 0 ? t('{amount} is back in your wallet', { amount: formatRs(request.fee) }) : '']
                .filter(Boolean)
                .join(' · ')}
        </AppText>
        {onCancel ? (
          <Pressable onPress={onCancel} disabled={cancelling} hitSlop={8} style={styles.cancel}>
            {cancelling ? (
              <ActivityIndicator color={colors.danger} size="small" />
            ) : (
              <AppText variant="label" color={colors.danger}>
                {t('Cancel request')}
              </AppText>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  request: { alignSelf: 'stretch', alignItems: 'flex-start' },
  cancel: { alignSelf: 'flex-start', marginTop: spacing.xs },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  heroImage: { borderRadius: radius.lg },
  heroTitle: { fontSize: 26, lineHeight: 32 },
  heroText: { opacity: 0.9 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...shadow,
  },
  cardActive: { borderColor: colors.primary },
  dimmed: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  logo: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.divider },
  body: { flex: 1, gap: 3 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 2 },
  side: { width: 28, alignItems: 'center' },
  footer: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  create: { alignSelf: 'stretch' },
  logout: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
}));
