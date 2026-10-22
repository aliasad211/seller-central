import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { AdsScreen } from '../screens/ads/AdsScreen';
import { CampaignDetailScreen } from '../screens/ads/CampaignDetailScreen';
import { CampaignFormScreen } from '../screens/ads/CampaignFormScreen';
import { ChooseShopScreen, SelectShopScreen } from '../screens/auth/ChooseShopScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { CompleteProfileScreen } from '../screens/auth/CompleteProfileScreen';
import { NoShopScreen } from '../screens/auth/NoShopScreen';
import { LocalDeliveryScreen } from '../screens/delivery/LocalDeliveryScreen';
import { EarningsScreen } from '../screens/earnings/EarningsScreen';
import { PayoutAccountFormScreen } from '../screens/earnings/PayoutAccountFormScreen';
import { PayoutsScreen } from '../screens/earnings/PayoutsScreen';
import { WithdrawScreen } from '../screens/earnings/WithdrawScreen';
import { InventoryScreen } from '../screens/inventory/InventoryScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { AssignRiderScreen } from '../screens/orders/AssignRiderScreen';
import { CourierFormScreen } from '../screens/orders/CourierFormScreen';
import { OrderDetailScreen } from '../screens/orders/OrderDetailScreen';
import { SelfDeliveryScreen } from '../screens/orders/SelfDeliveryScreen';
import { AddPostScreen } from '../screens/posts/AddPostScreen';
import { PostsScreen } from '../screens/posts/PostsScreen';
import { VideoPlayerScreen } from '../screens/posts/VideoPlayerScreen';
import { PricingScreen } from '../screens/pricing/PricingScreen';
import { ProductFormScreen } from '../screens/products/ProductFormScreen';
import { BusinessProfileScreen } from '../screens/profile/BusinessProfileScreen';
import { CreateShopScreen } from '../screens/shop/CreateShopScreen';
import { AddCoinsScreen } from '../screens/wallet/AddCoinsScreen';
import { ReturnsScreen } from '../screens/returns/ReturnsScreen';
import { LegalScreen } from '../screens/settings/LegalScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { ShippingScreen } from '../screens/shipping/ShippingScreen';
import { TeamMemberFormScreen } from '../screens/team/TeamMemberFormScreen';
import { TeamScreen } from '../screens/team/TeamScreen';
import { useAuth } from '../state/AuthContext';
import { colors } from '../theme';
import { MainTabs } from './MainTabs';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { seller } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {!seller ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
        </>
      ) : !seller.member && seller.needsProfileCompletion ? (
        <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
      ) : seller.shops.length === 0 ? (
        // Creating the first shop moves on to Home by itself (the shop is chosen).
        <>
          <Stack.Screen name="NoShop" component={NoShopScreen} />
          <Stack.Screen name="CreateShop" component={CreateShopScreen} />
        </>
      ) : !seller.shop ? (
        // Several shops and none chosen yet.
        <>
          <Stack.Screen name="SelectShop" component={SelectShopScreen} />
          <Stack.Screen name="CreateShop" component={CreateShopScreen} />
          <Stack.Screen name="AddCoins" component={AddCoinsScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Tabs" component={MainTabs} />
          <Stack.Screen name="ChooseShop" component={ChooseShopScreen} />
          <Stack.Screen name="CreateShop" component={CreateShopScreen} />
          <Stack.Screen name="AddCoins" component={AddCoinsScreen} />
          <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
          <Stack.Screen name="AssignRider" component={AssignRiderScreen} />
          <Stack.Screen name="SelfDelivery" component={SelfDeliveryScreen} />
          <Stack.Screen name="CourierForm" component={CourierFormScreen} />
          <Stack.Screen name="ProductForm" component={ProductFormScreen} />
          <Stack.Screen name="Inventory" component={InventoryScreen} />
          <Stack.Screen name="AddPost" component={AddPostScreen} options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="Posts" component={PostsScreen} />
          <Stack.Screen
            name="VideoPlayer"
            component={VideoPlayerScreen}
            options={{ animation: 'fade', contentStyle: { backgroundColor: '#000000' } }}
          />
          <Stack.Screen name="Ads" component={AdsScreen} />
          <Stack.Screen name="CampaignForm" component={CampaignFormScreen} />
          <Stack.Screen name="CampaignDetail" component={CampaignDetailScreen} />
          <Stack.Screen name="Pricing" component={PricingScreen} />
          <Stack.Screen name="Earnings" component={EarningsScreen} />
          <Stack.Screen name="Payouts" component={PayoutsScreen} />
          <Stack.Screen name="Withdraw" component={WithdrawScreen} />
          <Stack.Screen name="PayoutAccountForm" component={PayoutAccountFormScreen} />
          <Stack.Screen name="LocalDelivery" component={LocalDeliveryScreen} />
          <Stack.Screen name="Shipping" component={ShippingScreen} />
          <Stack.Screen name="Returns" component={ReturnsScreen} />
          <Stack.Screen name="BusinessProfile" component={BusinessProfileScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Legal" component={LegalScreen} />
          <Stack.Screen name="Team" component={TeamScreen} />
          <Stack.Screen name="TeamMemberForm" component={TeamMemberFormScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
