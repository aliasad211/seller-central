import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeftRight,
  BadgePercent,
  Bell,
  Bike,
  Boxes,
  Clapperboard,
  LogOut,
  LucideIcon,
  MapPin,
  Megaphone,
  Plus,
  RotateCcw,
  Settings,
  Store,
  Truck,
  Users,
  Wallet,
} from 'lucide-react-native';
import { ChevronForward } from '../../components/Chevrons';
import React from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { AppText, Card, Header, IconCircle, ListRow, Screen } from '../../components';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../state/AuthContext';
import { colors, spacing, Tone } from '../../theme';
import { confirmLogout } from '../../utils/confirmLogout';
import { t } from '../../i18n';
import { FEATURES } from '../../config';

type Target = Exclude<
  keyof RootStackParamList,
  'Login' | 'NoShop' | 'Tabs' | 'OrderDetail' | 'AssignRider' | 'CourierForm' | 'CampaignDetail' | 'VideoPlayer' | 'TeamMemberForm' | 'SelfDelivery'
>;

const GROUPS: { title: string; items: { label: string; hint: string; icon: LucideIcon; tone: Tone; to: Target }[] }[] = [
  {
    title: t('Selling'),
    items: [
      { label: t('Inventory'), hint: t('Stock for every product'), icon: Boxes, tone: 'primary', to: 'Inventory' },
      { label: t('Pricing & Promotions'), hint: t('Sale prices and dates'), icon: BadgePercent, tone: 'danger', to: 'Pricing' },
      { label: t('Posts'), hint: t('Your videos on Fazl'), icon: Clapperboard, tone: 'info', to: 'Posts' },
      { label: t('Advertisement'), hint: t('Campaigns and results'), icon: Megaphone, tone: 'purple', to: 'Ads' },
    ],
  },
  {
    title: t('Money'),
    items: [
      { label: t('Earnings'), hint: t('Sales, charges and net'), icon: Wallet, tone: 'success', to: 'Earnings' },
      { label: t('Returns & Refunds'), hint: t('Returned and cancelled orders'), icon: RotateCcw, tone: 'warning', to: 'Returns' },
    ],
  },
  ...(FEATURES.delivery
    ? [
        {
          title: t('Delivery'),
          items: [
            { label: t('Local Delivery'), hint: t('Self delivery or Fazl riders'), icon: Bike, tone: 'info' as Tone, to: 'LocalDelivery' as Target },
            { label: t('Shipping & Tracking'), hint: t('Couriers and tracking IDs'), icon: Truck, tone: 'secondary' as Tone, to: 'Shipping' as Target },
          ],
        },
      ]
    : []),
  {
    title: t('Account'),
    items: [
      { label: t('Business Profile'), hint: t('Your shop page on Fazl'), icon: Store, tone: 'primary', to: 'BusinessProfile' },
      { label: t('Team'), hint: t('People who help run your shops'), icon: Users, tone: 'info', to: 'Team' },
      { label: t('Notifications'), hint: t('Orders, stock and riders'), icon: Bell, tone: 'secondary', to: 'Notifications' },
      { label: t('Settings'), hint: t('Alerts, stock level, account'), icon: Settings, tone: 'neutral', to: 'Settings' },
    ],
  },
];

export function MoreScreen() {
  const navigation = useNavigation();
  const { seller, signOut } = useAuth();
  const shop = seller?.shop;
  const member = seller?.member;
  const perms = member?.permissions ?? ['orders', 'products', 'marketing'];

  const filteredGroups = GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (item.to === 'Earnings' || item.to === 'BusinessProfile' || item.to === 'Team') {
        return !member; // Owner only
      }
      if (item.to === 'Inventory' || item.to === 'Pricing') {
        return !member || perms.includes('products');
      }
      if (item.to === 'Posts' || item.to === 'Ads') {
        return !member || perms.includes('marketing');
      }
      if (item.to === 'Returns' || item.to === 'LocalDelivery' || item.to === 'Shipping') {
        return !member || perms.includes('orders');
      }
      return true;
    }),
  })).filter(g => g.items.length > 0);

  const onShopPress = () => {
    if (member) {
      Alert.alert(t('Business profile'), t('Only the shop owner can edit the business profile.'));
      return;
    }
    navigation.navigate('BusinessProfile');
  };

  return (
    <Screen header={<Header title={t('More')} back={false} />} bottomInset={false}>
      <Card onPress={onShopPress} style={styles.shop}>
        {shop?.logo ? <Image source={{ uri: shop.logo }} style={styles.logo} /> : <IconCircle icon={Store} size={56} />}
        <View style={styles.flex}>
          <AppText variant="subheading" numberOfLines={1}>
            {shop?.name}
          </AppText>
          <View style={styles.location}>
            <MapPin size={13} color={colors.textMuted} />
            <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
              {shop?.area}, {shop?.city}
            </AppText>
          </View>
          {member ? (
            <AppText variant="caption" color={colors.primary}>
              {t('Team Member')} ({perms.join(', ')})
            </AppText>
          ) : (
            <AppText variant="caption" color={colors.primary}>
              {t('View business profile')}
            </AppText>
          )}
        </View>
        <ChevronForward size={20} color={colors.textSubtle} />
      </Card>

      {(seller?.shops.length ?? 0) > 1 ? (
        // The shop list also has "Create a new shop".
        <Card padded={false} style={[styles.group, styles.switchCard]}>
          <ListRow
            icon={ArrowLeftRight}
            tone="primary"
            title={t('Switch shop')}
            subtitle={t('You have {count} shops', { count: seller?.shops.length ?? 0 })}
            onPress={() => navigation.navigate('ChooseShop')}
          />
        </Card>
      ) : !member ? (
        <Card padded={false} style={[styles.group, styles.switchCard]}>
          <ListRow
            icon={Plus}
            tone="primary"
            title={t('Create a new shop')}
            subtitle={t('Add another shop to your account')}
            onPress={() => navigation.navigate('CreateShop')}
          />
        </Card>
      ) : null}

      {filteredGroups.map(group => (
        <View key={group.title}>
          <AppText variant="label" color={colors.textMuted} style={styles.groupTitle}>
            {group.title.toUpperCase()}
          </AppText>
          <Card padded={false} style={styles.group}>
            {group.items.map((item, i) => (
              <ListRow
                key={item.to}
                icon={item.icon}
                tone={item.tone}
                title={item.label}
                subtitle={item.hint}
                divider={i < group.items.length - 1}
                onPress={() => navigation.navigate(item.to)}
              />
            ))}
          </Card>
        </View>
      ))}

      <Card padded={false} style={[styles.group, styles.logout]}>
        <ListRow
          icon={LogOut}
          tone="danger"
          title={t('Log out')}
          onPress={() => confirmLogout(signOut)}
        />
      </Card>
      <AppText variant="caption" color={colors.textSubtle} align="center" style={styles.version}>
        {t('Fazl Seller Central · v0.1 (preview with sample data)')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 56, height: 56, borderRadius: 28 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 2 },
  groupTitle: { marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.xs },
  group: { paddingHorizontal: spacing.md },
  switchCard: { marginTop: spacing.md },
  logout: { marginTop: spacing.xl },
  version: { marginTop: spacing.lg },
});
