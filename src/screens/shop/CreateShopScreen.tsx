import { BadgeCheck, Camera, Info, MapPin, Store } from 'lucide-react-native';
import { ChevronForward } from '../../components/Chevrons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Asset, launchImageLibrary } from 'react-native-image-picker';
import { ApiError } from '../../api/http';
import { ShopCategory, UploadFile } from '../../api/shopContent';
import { getNewShopTerms, NewShopTerms } from '../../api/shopRequests';
import {
  createShop,
  LatLng,
  listCities,
  listCityAreas,
  locateCity,
  PlaceOption,
  searchAreas,
  shopTypeCategories,
} from '../../api/shopSetup';
import { AppText, Button, Card, Header, IconCircle, Screen, TextField } from '../../components';
import { formatRs } from '../../utils/format';
import { RootScreenProps } from '../../navigation/types';
import { useAuth } from '../../state/AuthContext';
import { colors, fonts, radius, spacing, themedStyles } from '../../theme';
import { CategoryPickerModal } from '../products/CategoryPickerModal';
import { MapPickerModal, PinnedPlace } from './MapPickerModal';
import { PlacePickerModal } from './PlacePickerModal';
import { t } from '../../i18n';

type Field = 'name' | 'description' | 'category' | 'marketName' | 'contact' | 'city' | 'area' | 'location';
type Errors = Partial<Record<Field, string>>;

/** The Fazl app's shop-name rule (Native-fazl-app utils/validation validateName). */
const validShopName = (name: string) =>
  name.trim().length >= 2 && /^[a-zA-Z0-9\s!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/.test(name.trim());

/** A picked photo, as Fazl's upload takes it (Business Profile uses it too). */
export const asUpload = (a: Asset): UploadFile => ({
  uri: a.uri as string,
  name: a.fileName ?? `photo-${Date.now()}.jpg`,
  type: a.type ?? 'image/jpeg',
});

/**
 * Creates a shop on Fazl for the logged-in account — the same shop the Fazl
 * app would create, with its fields, lists, texts and rules (Native-fazl-app
 * CreateShopScreen) in Seller Central's look. Once created it is the shop
 * being managed, and products can be listed in it straight away.
 *
 * Its place on the map is the Store Pin location when one is dropped (which
 * also fills City and Area), else its area's point when the area list knows
 * it, else its city's — where the Fazl app puts a shop without a pin.
 *
 * The account's first shop is free and opens at once. Any further one costs
 * the fee Fazl sets and waits for Fazl's approval; the shop list shows it
 * meanwhile. Its "Pay & send for approval" opens the payment page (AddCoins
 * with `shopFee`): the Fazl wallet, JazzCash, Easypaisa or a card. Once it's
 * paid, that page comes back here (`fromWalletAt` / `paidFor`) and the shop
 * is sent for approval, the fee taken from the wallet.
 */
export function CreateShopScreen({ navigation, route }: RootScreenProps<'CreateShop'>) {
  const { seller, shopCreated } = useAuth();
  const [banner, setBanner] = useState<UploadFile | null>(null);
  const [logo, setLogo] = useState<UploadFile | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ShopCategory | null>(null);
  const [marketName, setMarketName] = useState('');
  const [contact, setContact] = useState(seller?.phone ?? '');
  const [city, setCity] = useState<PlaceOption | null>(null);
  const [area, setArea] = useState<PlaceOption | null>(null);
  const [pinned, setPinned] = useState<PinnedPlace | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  // The shop just created, once it is the one being managed.
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [cities, setCities] = useState<PlaceOption[]>([]);
  const [areas, setAreas] = useState<PlaceOption[]>([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [picking, setPicking] = useState<'category' | 'city' | 'area' | 'map' | null>(null);
  // What another shop takes (fee, wallet, limit). Read again on coming back
  // from Add coins. Without it the backend still decides.
  const [terms, setTerms] = useState<NewShopTerms | null>(null);

  const loadTerms = useCallback(() => {
    getNewShopTerms().then(setTerms).catch(() => undefined);
  }, []);
  useFocusEffect(loadTerms);

  const extra = !!terms?.needsApproval;
  const fee = terms?.fee ?? 0;

  // Back from the payment page, paid: the shop goes for approval, its fee
  // taken from the wallet (a gateway payment went into it). Once per payment.
  const paidFor = route.params?.paidFor;
  const fromWalletAt = route.params?.fromWalletAt;
  const handledPayment = useRef<string | null>(null);

  // On to Home once the new shop is open. This screen is part of every stage
  // of the app (no shop yet, choosing one, managing one), so it doesn't go
  // away by itself when the shop appears; and Home only exists once the shop
  // is open, which is why this waits for that rather than navigating as
  // soon as the shop is created.
  useEffect(() => {
    if (createdId && seller?.shop?.id === createdId) {
      navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Home' } }] });
    }
  }, [createdId, seller?.shop?.id, navigation]);

  useEffect(() => {
    shopTypeCategories().then(setCategories).catch(() => setCategories([]));
    listCities()
      .then(setCities)
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, []);

  // The chosen city's areas, offered before anything is typed.
  useEffect(() => {
    if (!city) {
      setAreas([]);
      return;
    }
    let cancelled = false;
    setLoadingAreas(true);
    listCityAreas(city)
      .then(rows => !cancelled && setAreas(rows))
      .catch(() => !cancelled && setAreas([]))
      .finally(() => !cancelled && setLoadingAreas(false));
    return () => {
      cancelled = true;
    };
  }, [city]);

  const findAreas = useCallback(
    (query: string) => (city ? searchAreas(query, city.name, city.coordinates) : Promise.resolve([])),
    [city],
  );

  const clearError = (...fields: Field[]) =>
    setErrors(e => (fields.some(f => e[f]) ? { ...e, ...Object.fromEntries(fields.map(f => [f, undefined])) } : e));

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

  // A pin fills City and Area from where it is, as in the Fazl app.
  const applyPin = (place: PinnedPlace) => {
    setPinned(place);
    if (place.city) {
      const known = cities.find(c => c.name.toLowerCase() === place.city.toLowerCase());
      setCity(known ?? { name: place.city, coordinates: null });
      setArea(place.area ? { name: place.area, coordinates: null } : null);
    } else if (place.area && city) {
      setArea({ name: place.area, coordinates: null });
    }
    clearError('city', 'area', 'location');
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!name.trim()) next.name = t('Please enter shop name');
    else if (!validShopName(name)) next.name = t('Please enter a valid shop name');
    if (!description.trim()) next.description = t('Please enter shop description');
    if (!marketName.trim()) next.marketName = t('Please enter market name');
    if (!contact.trim()) next.contact = t('Please enter contact number');
    if (!city) next.city = t('Please enter city');
    if (!area) next.area = t('Please enter area');
    if (!category) next.category = t('Please select a category');
    return next;
  };

  const save = () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    if (terms && !terms.canCreate) {
      Alert.alert(t('Shop limit reached'), t('You can have up to {count} shops on Fazl, counting ones waiting for approval.', { count: terms.maxShops }));
      return;
    }
    // Another shop's fee: the payment page (wallet, JazzCash, Easypaisa or
    // card). It comes back here once paid, and the shop is sent then.
    if (extra && fee > 0) {
      navigation.navigate('AddCoins', { shopFee: fee });
      return;
    }
    submit();
  };

  const submit = async () => {
    if (!city || !area || !category) return;
    setSaving(true);
    let shopId: string;
    try {
      // Where the shop is on the map: its pin, else its area, else its city.
      const at: LatLng | null =
        pinned?.at ??
        area.coordinates ??
        city.coordinates ??
        (await locateCity(city.name).catch(() => null));
      if (!at) {
        setErrors({ location: t("We couldn't find this city on the map. Please choose a nearby city.") });
        setSaving(false);
        return;
      }
      const created = await createShop(
        {
          title: name.trim(),
          description: description.trim(),
          categoryId: category.id,
          marketName: marketName.trim(),
          contact: contact.trim(),
          city: city.name,
          area: area.name,
          at,
          address: pinned?.address,
          logo: logo ?? undefined,
          banner: banner ?? undefined,
        },
        extra ? terms?.feeMinor : undefined,
      );
      if (created.awaitingApproval) {
        // Not a shop to manage yet: it shows in the shop list as waiting.
        Alert.alert(
          t('Sent for approval'),
          t("Fazl will check {name} and let you know. Once it's approved it opens on Fazl and shows in your shops.", {
            name: name.trim(),
          }),
          [{ text: t('OK'), onPress: () => navigation.goBack() }],
          { cancelable: false },
        );
        return;
      }
      shopId = created.id;
    } catch (e) {
      // The fee changed meanwhile (409): show the new one before trying again.
      if (e instanceof ApiError && e.status === 409) loadTerms();
      Alert.alert(t('Failed to create shop'), e instanceof Error ? e.message : '');
      setSaving(false);
      return;
    }

    let opened = false;
    try {
      // Makes it the shop being managed; the effect above then goes to Home.
      opened = await shopCreated(shopId);
    } catch {
      // Opened stays false: the shop exists on Fazl either way.
    }
    if (!opened) {
      Alert.alert(t('Shop created'), t("Your shop is on Fazl, but it couldn't be opened here just now. Pull down on your shops to load it."));
      setSaving(false);
      navigation.goBack();
      return;
    }
    setCreatedId(shopId);
    Alert.alert(t('Success'), t('Shop created successfully. It is on Fazl now, and you can list your products in it.'));
  };

  useEffect(() => {
    const payment = paidFor ?? (fromWalletAt ? `wallet-${fromWalletAt}` : null);
    if (!payment || handledPayment.current === payment) return;
    handledPayment.current = payment;
    submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidFor, fromWalletAt]);

  return (
    <Screen
      header={<Header title={t('Create a shop')} />}
      footer={
        <Button
          title={
            !extra
              ? t('Create shop')
              : fee > 0
                ? t('Pay {amount} & send for approval', { amount: formatRs(fee) })
                : t('Send for approval')
          }
          flex
          loading={saving}
          loadingText={extra ? t('Sending') : t('Creating')}
          disabled={saving || terms?.canCreate === false}
          onPress={save}
        />
      }
    >
      {extra && terms ? (
        <Card style={styles.terms}>
          <View style={styles.termsHead}>
            <IconCircle icon={BadgeCheck} tone="primary" size={40} />
            <View style={styles.flex}>
              <AppText variant="bodyBold">{t('Another shop needs Fazl\'s approval')}</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {fee > 0
                  ? t("Your first shop is free. This one costs {fee}: pay from your Fazl wallet, or with JazzCash, Easypaisa or a card. If Fazl doesn't approve it, the money comes back to your Fazl wallet.", {
                      fee: formatRs(fee),
                    })
                  : t('Your first shop is free. Fazl checks each further shop before it opens.')}
              </AppText>
            </View>
          </View>
          {!terms.canCreate ? (
            <AppText variant="label" color={colors.danger}>
              {t('You can have up to {count} shops on Fazl, counting ones waiting for approval.', { count: terms.maxShops })}
            </AppText>
          ) : fee > 0 ? (
            <View style={styles.feeRow}>
              <View style={styles.flex}>
                <AppText variant="label" color={colors.textMuted}>
                  {t('Fee for this shop')}
                </AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  {t('Fill in the details, then choose how to pay.')}
                </AppText>
              </View>
              <AppText variant="subheading">{formatRs(fee)}</AppText>
            </View>
          ) : null}
        </Card>
      ) : null}

      <AppText variant="subheading">{t('Add your shop details')}</AppText>
      <AppText color={colors.textMuted} style={styles.intro}>
        {t('Please fill the details to create a shop.')}
      </AppText>

      <AppText variant="label" style={styles.label}>
        {t('Shop banner')}
      </AppText>
      <Pressable onPress={() => pickPhoto('banner')} style={styles.banner} accessibilityLabel={t('Add banner')}>
        {banner ? (
          <Image source={{ uri: banner.uri }} style={StyleSheet.absoluteFill} />
        ) : (
          <AppText variant="label" color={colors.primary}>
            {t('Add banner')}
          </AppText>
        )}
        <View style={styles.cameraBadge}>
          <Camera size={14} color={colors.white} />
        </View>
      </Pressable>
      <View style={styles.logoRow}>
        <Pressable onPress={() => pickPhoto('logo')} style={styles.logo} accessibilityLabel={t('Add shop logo')}>
          {logo ? <Image source={{ uri: logo.uri }} style={styles.logoImage} /> : <Store size={34} color={colors.primary} />}
          <View style={[styles.cameraBadge, styles.logoCamera]}>
            <Camera size={12} color={colors.white} />
          </View>
        </Pressable>
        <AppText variant="label" color={colors.primary}>
          {t('Add shop logo')}
        </AppText>
      </View>

      <TextField
        label={t('Shop name')}
        value={name}
        onChangeText={text => {
          setName(text);
          clearError('name');
        }}
        placeholder={t('e.g. alexcloth')}
        maxLength={80}
        error={errors.name}
      />
      <TextField
        label={t('Describe your shop')}
        value={description}
        onChangeText={text => {
          setDescription(text);
          clearError('description');
        }}
        placeholder={t('e.g. High quality products, free cancellation...')}
        multiline
        maxLength={1000}
        error={errors.description}
      />
      <PickerField
        label={t('Category')}
        value={category?.name}
        placeholder={t('Choose category')}
        error={errors.category}
        onPress={() => setPicking('category')}
      />
      <TextField
        label={t('Market name')}
        value={marketName}
        onChangeText={text => {
          setMarketName(text);
          clearError('marketName');
        }}
        placeholder={t('e.g. Singapore Plaza')}
        maxLength={80}
        error={errors.marketName}
      />
      <TextField
        label={t('Contact number')}
        value={contact}
        onChangeText={text => {
          setContact(text);
          clearError('contact');
        }}
        placeholder="e.g. +923001234567"
        keyboardType="phone-pad"
        maxLength={20}
        error={errors.contact}
      />
      <PickerField
        label={t('City')}
        value={city?.name}
        placeholder={t('Search city...')}
        error={errors.city}
        onPress={() => setPicking('city')}
      />
      <PickerField
        label={t('Area')}
        value={area?.name}
        placeholder={city ? t('Search area...') : t('Choose a city first')}
        error={errors.area ?? errors.location}
        onPress={city ? () => setPicking('area') : undefined}
      />

      {/* Store Pin location: the exact spot on the map (optional — without it
          the shop is placed at its area or city). Picking it also fills City
          and Area. */}
      <Pressable onPress={() => setPicking('map')} style={styles.pinLink} accessibilityRole="button">
        <MapPin size={16} color={colors.primary} />
        <AppText variant="bodyBold" color={colors.primary}>
          {t('Store Pin location')}
        </AppText>
      </Pressable>
      {pinned?.address ? (
        <AppText variant="caption" color={colors.textMuted} numberOfLines={2} style={styles.pinned}>
          {pinned.address}
        </AppText>
      ) : null}

      <View style={styles.note}>
        <Info size={16} color={colors.textMuted} />
        <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
          {extra
            ? t('Once Fazl approves it, customers see it on Fazl and you can list products in it from here.')
            : t('Your shop is created on Fazl, so customers see it there too. You can then list products in it from here.')}
        </AppText>
      </View>

      <CategoryPickerModal
        visible={picking === 'category'}
        categories={categories}
        selectedId={category?.id ?? ''}
        onClose={() => setPicking(null)}
        onSelect={c => {
          setCategory(c);
          clearError('category');
        }}
      />
      <MapPickerModal
        visible={picking === 'map'}
        initial={pinned}
        onClose={() => setPicking(null)}
        onConfirm={applyPin}
      />
      <PlacePickerModal
        visible={picking === 'city'}
        title={t('City')}
        placeholder={t('Search city...')}
        options={cities}
        loading={loadingCities}
        onClose={() => setPicking(null)}
        onSelect={c => {
          if (c.name !== city?.name) setArea(null);
          setCity(c);
          clearError('city', 'area', 'location');
        }}
      />
      <PlacePickerModal
        visible={picking === 'area'}
        title={t('Area')}
        placeholder={t('Search area...')}
        options={areas}
        loading={loadingAreas}
        search={findAreas}
        allowCustom
        onClose={() => setPicking(null)}
        onSelect={a => {
          setArea(a);
          clearError('area', 'location');
        }}
      />
    </Screen>
  );
}

/** A field that opens a list, drawn like a TextField (Business Profile uses it too). */
export function PickerField({
  label,
  value,
  placeholder,
  error,
  onPress,
}: {
  label: string;
  value?: string;
  placeholder: string;
  error?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={[styles.box, !!error && styles.errored, !onPress && styles.disabled]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <AppText style={styles.value} color={value ? colors.text : colors.textSubtle} numberOfLines={1}>
          {value || placeholder}
        </AppText>
        <ChevronForward size={18} color={colors.textSubtle} />
      </Pressable>
      {error ? (
        <AppText variant="caption" color={colors.danger} style={styles.below}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  intro: { marginTop: spacing.xs, marginBottom: spacing.lg },
  terms: { gap: spacing.md, marginBottom: spacing.lg },
  termsHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { marginBottom: spacing.sm },
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginTop: -42,
    marginLeft: spacing.lg,
    marginBottom: spacing.lg,
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
  },
  logoImage: { width: 78, height: 78, borderRadius: 39 },
  logoCamera: { right: -2, bottom: -2, width: 24, height: 24 },
  field: { marginBottom: spacing.lg },
  box: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  errored: { borderColor: colors.danger },
  disabled: { opacity: 0.6 },
  value: { flex: 1, fontFamily: fonts.regular, fontSize: 15 },
  below: { marginTop: spacing.xs },
  note: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  pinLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    marginTop: -spacing.sm,
  },
  pinned: { marginTop: spacing.xs },
}));
