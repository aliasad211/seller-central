import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { ChevronDown } from 'lucide-react-native';
import { listCities, listCityAreas, locateCity, PlaceOption, searchAreas } from '../../api/shopSetup';
import { AppText, DoodleButton, OutlinedField } from '../../components';
import { t } from '../../i18n';
import { Seller } from '../../types/models';
import { AccountDetails, accountDetailsErrors, AccountRole } from '../../utils/accountProfile';
import { colors, spacing, themedStyles } from '../../theme';
import { PlacePickerModal } from '../shop/PlacePickerModal';

export function AccountDetailsForm({ initial, loading, title, onSubmit, children, referral = false, verifiedPhone }: {
  initial?: Seller;
  verifiedPhone?: string;
  loading: boolean;
  title: string;
  onSubmit: (details: AccountDetails) => Promise<void>;
  children?: React.ReactNode;
  referral?: boolean;
}) {
  const address = initial?.address?.split(',').map(p => p.trim()).filter(Boolean) ?? [];
  const initialPoint = initial?.location?.coordinates;
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(verifiedPhone ?? initial?.phone ?? '');
  const [city, setCity] = useState<PlaceOption | null>(() => address.length ? {
    name: address[address.length - 1],
    coordinates: initialPoint ? { lng: initialPoint[0], lat: initialPoint[1] } : null,
  } : null);
  const [area, setArea] = useState<PlaceOption | null>(() => address.length > 1 ? { name: address.slice(0, -1).join(', '), coordinates: null } : null);
  const roles: AccountRole[] = ['business_owner'];
  const [referralCode, setReferralCode] = useState('');
  const [image, setImage] = useState<AccountDetails['image']>();
  const [cities, setCities] = useState<PlaceOption[]>([]);
  const [areas, setAreas] = useState<PlaceOption[]>([]);
  const [picking, setPicking] = useState<'city' | 'area' | null>(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof accountDetailsErrors>>({});
  const [placeError, setPlaceError] = useState('');
  const submitting = useRef(false);

  const loadCities = useCallback(async () => {
    setPlacesLoading(true);
    try { setCities(await listCities()); setPlaceError(''); }
    catch (e) { setPlaceError(e instanceof Error ? e.message : t('Could not load cities')); }
    finally { setPlacesLoading(false); }
  }, []);

  useEffect(() => { loadCities(); }, [loadCities]);
  useEffect(() => {
    let active = true;
    setAreas([]);
    if (!city) return;
    setPlacesLoading(true);
    listCityAreas(city)
      .then(rows => { if (active) setAreas(rows); })
      .catch(() => undefined) // A town without listed areas can use a typed area.
      .finally(() => { if (active) setPlacesLoading(false); });
    return () => { active = false; };
  }, [city]);

  const findAreas = useCallback((query: string) => city ? searchAreas(query, city.name, city.coordinates) : Promise.resolve([]), [city]);
  const clear = (field: keyof typeof errors) => setErrors(e => ({ ...e, [field]: undefined }));
  const pickPhoto = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8, maxWidth: 1024, maxHeight: 1024 });
      if (result.errorCode) throw new Error(result.errorMessage || t('Please try again'));
      const asset = result.assets?.[0];
      if (asset?.uri) setImage({ uri: asset.uri, type: asset.type || 'image/jpeg', name: asset.fileName || 'profile.jpg' });
    } catch (e) { setPlaceError(e instanceof Error ? e.message : t('Please try again')); }
  };
  const submit = async () => {
    if (loading || submitting.current) return;
    submitting.current = true;
    try {
      const at = area?.coordinates ?? city?.coordinates ?? (city ? await locateCity(city.name) : null);
      const details: AccountDetails = { name, phone, city: city?.name ?? '', area: area?.name ?? '', at: at ?? { lat: 0, lng: 0 }, roles, referralCode, image };
      const next = accountDetailsErrors(details);
      setErrors(next);
      if (Object.keys(next).length) return;
      await onSubmit(details);
    } catch (e) { setPlaceError(e instanceof Error ? e.message : t('Please try again')); }
    finally { submitting.current = false; }
  };

  return <View>
    <Pressable accessibilityRole="button" disabled={loading} onPress={pickPhoto} style={styles.label}>
      {image?.uri ? <Image source={{ uri: image.uri }} style={styles.photo} /> : null}
      <AppText color={colors.primary}>{t('Add photo (optional)')}</AppText>
    </Pressable>
    {children}
    <OutlinedField label={t('Full name')} value={name} autoCapitalize="words" autoComplete="name" onChangeText={v => { setName(v); clear('name'); }} error={errors.name && t(errors.name)} editable={!loading} />
    <OutlinedField label={t('Mobile number (Pakistan)')} value={phone} placeholder="+923001234567" keyboardType="phone-pad" autoComplete="tel" maxLength={18} onChangeText={v => { setPhone(v); clear('phone'); }} error={errors.phone && t(errors.phone)} editable={!loading && !verifiedPhone} />
    <AppText variant="label" style={styles.label}>{t('City')}</AppText>
    <Pressable accessibilityRole="button" disabled={loading} style={styles.picker} onPress={() => { setPicking('city'); if (!cities.length) loadCities(); }}><AppText style={styles.flex} color={city ? colors.text : colors.textMuted}>{city?.name || t('Choose city')}</AppText><ChevronDown size={18} color={colors.primary} /></Pressable>
    {errors.city ? <AppText variant="caption" color={colors.danger}>{t(errors.city)}</AppText> : null}
    <AppText variant="label" style={styles.label}>{t('Area')}</AppText>
    <Pressable accessibilityRole="button" disabled={loading || !city} style={[styles.picker, !city && styles.dimmed]} onPress={() => setPicking('area')}><AppText style={styles.flex} color={area ? colors.text : colors.textMuted}>{area?.name || t('Choose area')}</AppText><ChevronDown size={18} color={colors.primary} /></Pressable>
    {errors.area ? <AppText variant="caption" color={colors.danger}>{t(errors.area)}</AppText> : null}
    {placeError ? <AppText color={colors.danger} style={styles.label}>{placeError}</AppText> : null}
    <AppText variant="label" style={styles.label}>{t('Account type')}</AppText>
    <AppText style={styles.label}>{t('Business owner')}</AppText>
    {errors.roles ? <AppText variant="caption" color={colors.danger}>{t(errors.roles)}</AppText> : null}
    {referral ? <OutlinedField label={t('Referral code (optional)')} value={referralCode} autoCapitalize="characters" onChangeText={setReferralCode} editable={!loading} style={styles.referral} /> : null}
    <DoodleButton title={title} loading={loading} disabled={loading} onPress={submit} />
    <PlacePickerModal visible={picking === 'city'} title={t('Choose city')} placeholder={t('Search cities')} options={cities} loading={placesLoading} onClose={() => setPicking(null)} onSelect={v => { setCity(v); setArea(null); clear('city'); clear('area'); }} />
    <PlacePickerModal visible={picking === 'area'} title={t('Choose area')} placeholder={t('Search areas')} options={areas} loading={placesLoading} search={findAreas} allowCustom onClose={() => setPicking(null)} onSelect={v => { setArea(v); clear('area'); }} />
  </View>;
}

const styles = themedStyles(() => StyleSheet.create({
  flex: { flex: 1 }, label: { marginTop: spacing.md, marginBottom: spacing.sm },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, marginBottom: spacing.sm },
  photo: { width: 64, height: 64, borderRadius: 32, marginBottom: spacing.sm },
  referral: { marginTop: spacing.md }, dimmed: { opacity: .5 },
}));
