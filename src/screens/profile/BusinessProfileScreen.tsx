import { Camera, Info, Store } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { ShopCategory, UploadFile } from '../../api/shopContent';
import { shopTypeCategories, updateShopProfile } from '../../api/shopSetup';
import { AppText, Button, Header, Screen, StateView, TextField } from '../../components';
import { RootScreenProps } from '../../navigation/types';
import { useAuth } from '../../state/AuthContext';
import { colors, radius, spacing, themedStyles } from '../../theme';
import { Shop } from '../../types/models';
import { t } from '../../i18n';
import { CategoryPickerModal } from '../products/CategoryPickerModal';
import { asUpload, PickerField } from '../shop/CreateShopScreen';

type Field = keyof Pick<
  Shop,
  'name' | 'description' | 'address' | 'area' | 'city' | 'contact' | 'openingHours'
>;

const REQUIRED: Field[] = ['name', 'address', 'area', 'city', 'contact'];

/**
 * The shop as customers see it on Fazl — one profile for both apps. Saving
 * changes it on Fazl (the Fazl app and website show it straight away); its
 * place on the map stays as it is.
 */
export function BusinessProfileScreen({ navigation }: RootScreenProps<'BusinessProfile'>) {
  const { seller, reloadShops } = useAuth();
  // The logged-in seller's shop, as loaded from Fazl at login.
  const [shop, setShop] = useState<Shop | null>(seller?.shop ?? null);
  // Photos and a category the seller picked here, sent only when changed.
  const [logo, setLogo] = useState<UploadFile | null>(null);
  const [banner, setBanner] = useState<UploadFile | null>(null);
  const [category, setCategory] = useState<ShopCategory | null>(null);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [missing, setMissing] = useState<Field[]>([]);
  const [saving, setSaving] = useState(false);
  // Delivery charge: what the owner charges customers for door-to-door delivery.
  const [deliveryCharge, setDeliveryCharge] = useState<string>(
    String(seller?.shop?.deliveryCharge ?? 0),
  );

  useEffect(() => {
    shopTypeCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  if (!shop) {
    return (
      <Screen header={<Header title={t('Business Profile')} />} scroll={false}>
        <StateView error={t('No shop on this account.')} />
      </Screen>
    );
  }

  const set = (field: Field) => (value: string) => {
    setShop({ ...shop, [field]: value });
    setMissing(m => m.filter(f => f !== field));
  };

  const pickPhoto = async (which: 'logo' | 'banner') => {
    // The Fazl app's sizes: a square-ish logo, a wide banner.
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.8,
      maxWidth: which === 'logo' ? 1024 : 1600,
      maxHeight: which === 'logo' ? 1024 : 900,
    });
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    (which === 'logo' ? setLogo : setBanner)(asUpload(asset));
  };

  const save = async () => {
    const empty = REQUIRED.filter(f => !shop[f].trim());
    setMissing(empty);
    if (empty.length) return;
    setSaving(true);
    try {
      await updateShopProfile(shop.id, {
        title: shop.name.trim(),
        description: shop.description.trim(),
        address: shop.address.trim(),
        area: shop.area.trim(),
        city: shop.city.trim(),
        contact: shop.contact.trim(),
        openingHours: shop.openingHours.trim(),
        categoryId: category?.id,
        logo: logo ?? undefined,
        banner: banner ?? undefined,
        deliveryCharge: Math.round(Number(deliveryCharge) || 0),
      });
      // The shop as Fazl now has it (new photo links, category name), so the
      // headers and this screen show the saved profile.
      await reloadShops();
      Alert.alert(t('Saved'), t('Your shop page on Fazl now shows these details.'));
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('Could not save'), e instanceof Error ? e.message : '');
      setSaving(false);
    }
  };

  const err = (f: Field) => (missing.includes(f) ? t('Required') : undefined);
  const bannerUri = banner?.uri ?? shop.banner;
  const logoUri = logo?.uri ?? shop.logo;

  return (
    <Screen
      header={<Header title={t('Business Profile')} />}
      footer={<Button title={t('Save profile')} flex loading={saving} loadingText={t('Saving')} onPress={save} />}
    >
      <Pressable onPress={() => pickPhoto('banner')} style={styles.banner} accessibilityLabel={t('Change banner')}>
        {bannerUri ? (
          <Image source={{ uri: bannerUri }} style={StyleSheet.absoluteFill} />
        ) : (
          <AppText variant="label" color={colors.primary}>
            {t('Add a banner')}
          </AppText>
        )}
        <View style={styles.cameraBadge}>
          <Camera size={14} color={colors.white} />
        </View>
      </Pressable>
      <Pressable onPress={() => pickPhoto('logo')} style={styles.logo} accessibilityLabel={t('Change logo')}>
        {logoUri ? (
          <Image source={{ uri: logoUri }} style={styles.logoImage} />
        ) : (
          <Store size={34} color={colors.primary} />
        )}
        <View style={[styles.cameraBadge, styles.logoCamera]}>
          <Camera size={12} color={colors.white} />
        </View>
      </Pressable>

      <TextField label={t('Shop name')} value={shop.name} onChangeText={set('name')} error={err('name')} maxLength={80} />
      <PickerField
        label={t('Category')}
        value={category?.name ?? shop.category}
        placeholder={t('Choose category')}
        onPress={categories.length ? () => setPickingCategory(true) : undefined}
      />
      <TextField
        label={t('Description')}
        value={shop.description}
        onChangeText={set('description')}
        multiline
        maxLength={1000}
        placeholder={t('What you sell and what makes your shop special')}
      />
      <TextField label={t('Address')} value={shop.address} onChangeText={set('address')} error={err('address')} />
      <View style={styles.row}>
        <TextField label={t('Area')} value={shop.area} onChangeText={set('area')} error={err('area')} style={styles.flex} />
        <TextField label={t('City')} value={shop.city} onChangeText={set('city')} error={err('city')} style={styles.flex} />
      </View>
      <TextField
        label={t('Contact number')}
        value={shop.contact}
        onChangeText={set('contact')}
        keyboardType="phone-pad"
        error={err('contact')}
      />
      <TextField
        label={t('Opening hours')}
        value={shop.openingHours}
        onChangeText={set('openingHours')}
        placeholder={t('e.g. 10:00 AM – 10:00 PM')}
      />
      <TextField
        label={t('Delivery charges (PKR)')}
        value={deliveryCharge}
        onChangeText={v => setDeliveryCharge(v.replace(/[^0-9]/g, ''))}
        keyboardType="numeric"
        placeholder={t('0 for free delivery')}
      />

      <View style={styles.note}>
        <Info size={16} color={colors.textMuted} />
        <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
          {t('This is the same shop profile customers see on Fazl. Changing it here changes it there.')}
        </AppText>
      </View>

      <CategoryPickerModal
        visible={pickingCategory}
        categories={categories}
        selectedId={category?.id ?? shop.subcategoryId ?? shop.categoryId ?? ''}
        onClose={() => setPickingCategory(false)}
        onSelect={c => setCategory(c)}
      />
    </Screen>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  banner: {
    height: 140,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -42,
    marginLeft: spacing.lg,
    marginBottom: spacing.lg,
  },
  logoImage: { width: 78, height: 78, borderRadius: 39 },
  logoCamera: { right: -2, bottom: -2, width: 24, height: 24 },
  row: { flexDirection: 'row', gap: spacing.md },
  note: { flexDirection: 'row', gap: spacing.sm },
}));
