import { BottomTabBarButtonProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  ClipboardList,
  House,
  LucideIcon,
  Menu,
  Package,
  Plus,
} from 'lucide-react-native';
import React from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components';
import { useAuth } from '../state/AuthContext';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { MoreScreen } from '../screens/more/MoreScreen';
import { OrdersScreen } from '../screens/orders/OrdersScreen';
import { ProductsScreen } from '../screens/products/ProductsScreen';
import { colors, fonts, themedStyles } from '../theme';
import { TabParamList } from './types';
import { t } from '../i18n';

const Tab = createBottomTabNavigator<TabParamList>();

const TABS: Record<Exclude<keyof TabParamList, 'AddPostTab'>, { icon: LucideIcon; label: string }> = {
  Home: { icon: House, label: t('Home') },
  Orders: { icon: ClipboardList, label: t('Orders') },
  Products: { icon: Package, label: t('Products') },
  More: { icon: Menu, label: t('More') },
};

/** Never shown: the middle tab opens Add Post on top instead. */
function NoScreen() {
  return null;
}

function TabIcon({ name, focused }: { name: keyof TabParamList; focused: boolean }) {
  if (name === 'AddPostTab') {
    return (
      <View style={styles.plusWrap}>
        <View style={styles.plus}>
          <Plus size={28} color={colors.white} strokeWidth={2.5} />
        </View>
        <AppText variant="small" color={colors.primary} style={styles.plusLabel}>
          {t('Add Post')}
        </AppText>
      </View>
    );
  }
  const { icon: Icon, label } = TABS[name];
  return (
    <View style={styles.tab}>
      <View style={[styles.iconPill, focused && styles.iconPillActive]}>
        <Icon size={22} color={focused ? colors.primary : colors.textMuted} strokeWidth={focused ? 2.4 : 2} />
      </View>
      <AppText
        variant="small"
        color={focused ? colors.primary : colors.textMuted}
        style={focused ? styles.labelActive : styles.label}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </View>
  );
}

/**
 * A tab button with no press feedback: the default one flashes a grey
 * background (ripple) over the tab on every tap.
 */
function TabButton({
  ref: _ref,
  pressColor: _pressColor,
  pressOpacity: _pressOpacity,
  hoverEffect: _hoverEffect,
  android_ripple: _ripple,
  href: _href,
  ...rest
}: BottomTabBarButtonProps) {
  return <Pressable {...rest} />;
}

const tabIconFor =
  (name: keyof TabParamList) =>
  ({ focused }: { focused: boolean }) =>
    <TabIcon name={name} focused={focused} />;

export function MainTabs() {
  const { bottom } = useSafeAreaInsets();
  const { seller } = useAuth();
  const member = seller?.member;
  const perms = member?.permissions ?? ['orders', 'products', 'marketing'];
  const hasOrders = !member || perms.includes('orders');
  const hasProducts = !member || perms.includes('products');
  const hasMarketing = !member || perms.includes('marketing');

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [styles.bar, { height: 68 + bottom, paddingBottom: bottom }],
        tabBarItemStyle: styles.item,
        tabBarIcon: tabIconFor(route.name),
        tabBarButton: TabButton,
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        listeners={{
          tabPress: e => {
            if (!hasOrders) {
              e.preventDefault();
              Alert.alert(
                t('Access restricted'),
                t("You don't have permission to manage orders. Ask the shop owner to grant permission.")
              );
            }
          },
        }}
      />
      <Tab.Screen
        name="AddPostTab"
        component={NoScreen}
        options={{ tabBarAccessibilityLabel: t('Add post') }}
        listeners={({ navigation }) => ({
          tabPress: e => {
            e.preventDefault();
            if (!hasMarketing) {
              Alert.alert(
                t('Access restricted'),
                t("You don't have permission to create posts or ads. Ask the shop owner to grant permission.")
              );
              return;
            }
            navigation.getParent()?.navigate('AddPost');
          },
        })}
      />
      <Tab.Screen
        name="Products"
        component={ProductsScreen}
        listeners={{
          tabPress: e => {
            if (!hasProducts) {
              e.preventDefault();
              Alert.alert(
                t('Access restricted'),
                t("You don't have permission to manage products. Ask the shop owner to grant permission.")
              );
            }
          },
        }}
      />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    elevation: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  item: { height: '100%', justifyContent: 'flex-start' },
  tab: { alignItems: 'center', gap: 2, width: 72 },
  iconPill: { width: 48, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconPillActive: { backgroundColor: colors.primarySoft },
  label: { fontFamily: fonts.regular },
  labelActive: { fontFamily: fonts.bold },
  plusWrap: { alignItems: 'center', width: 72 },
  plus: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    // Stands higher than the other tabs. A transform moves only the circle,
    // so the "Add Post" label stays level with the other labels.
    transform: [{ translateY: -7 }],
    borderWidth: 4,
    borderColor: colors.surface,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  plusLabel: { marginTop: 2 },
}));
