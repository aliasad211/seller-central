import { useNavigation } from '@react-navigation/native';
import { CircleHelp, FileText, LogOut, ShieldCheck, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { getSettings, saveSettings } from '../../api';
import { deleteAccount } from '../../api/account';
import {
  AppText,
  Card,
  Header,
  ListRow,
  Screen,
  SectionHeader,
  Segmented,
  StateView,
  Stepper,
  ToggleRow,
} from '../../components';
import { useLoad } from '../../hooks/useLoad';
import { useAppearance } from '../../state/AppearanceContext';
import { useAuth } from '../../state/AuthContext';
import { colors, spacing } from '../../theme';
import { chooseLanguage, LANGUAGE_NAMES } from '../../utils/chooseLanguage';
import { confirmLogout } from '../../utils/confirmLogout';
import { SellerSettings } from '../../types/models';
import { language, t } from '../../i18n';

export function SettingsScreen() {
  const navigation = useNavigation();
  const { seller, signOut } = useAuth();
  const appearance = useAppearance();
  const { data, setData, error, reload } = useLoad(() => getSettings(seller?.id), [seller?.id]);
  const [deleting, setDeleting] = useState(false);

  // Only the owner's own account; a team member's session can't delete it.
  const canDeleteAccount = !!seller && !seller.member;

  const confirmDeleteAccount = () => {
    if (!seller || deleting) return;
    Alert.alert(
      t('Delete your account?'),
      t(
        'This deletes your Fazl account — the same one you use in the Fazl app. Your shops and listings are taken off Fazl and you are logged out. This action cannot be undone.',
      ),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete account'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount(seller.id);
            } catch (e) {
              setDeleting(false);
              Alert.alert(t("Couldn't delete your account"), e instanceof Error ? e.message : '');
              return;
            }
            await signOut();
          },
        },
      ],
    );
  };

  if (!data) {
    return (
      <Screen header={<Header title={t('Settings')} />} scroll={false}>
        <StateView error={error} onRetry={reload} />
      </Screen>
    );
  }

  const update = <K extends keyof SellerSettings>(key: K, value: SellerSettings[K]) => {
    const was = data[key];
    const next = { ...data, [key]: value };
    setData(next);
    // A notification switch is saved on Fazl; if that fails, it flips back.
    saveSettings(next, seller?.id).catch(e => {
      setData(d => (d ? { ...d, [key]: was } : d));
      Alert.alert(t("Couldn't save"), e instanceof Error ? e.message : '');
    });
  };

  return (
    <Screen header={<Header title={t('Settings')} />}>
      <SectionHeader title={t('Notifications')} />
      <Card>
        <ToggleRow
          label={t('New orders')}
          description={t('Right away, with a sound')}
          value={data.notifyNewOrders}
          onChange={v => update('notifyNewOrders', v)}
          divider
        />
        <ToggleRow
          label={t('Low stock')}
          description={t('When a product drops to the low-stock level')}
          value={data.notifyLowStock}
          onChange={v => update('notifyLowStock', v)}
          divider
        />
        <ToggleRow
          label={t('Rider updates')}
          description={t('Accepted, picked up, delivered')}
          value={data.notifyRiders}
          onChange={v => update('notifyRiders', v)}
          divider
        />
        <ToggleRow
          label={t('Advertisement')}
          description={t('Budget used up, campaign ended')}
          value={data.notifyAds}
          onChange={v => update('notifyAds', v)}
        />
      </Card>

      <SectionHeader title={t('Selling')} />
      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppText variant="bodyBold">{t('Low-stock level')}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {t('Warn me when a product has this many or fewer left')}
            </AppText>
          </View>
          <Stepper value={data.lowStockThreshold} min={1} onChange={n => update('lowStockThreshold', n)} />
        </View>
        <AppText variant="bodyBold" style={styles.deliveryLabel}>
          {t('Local delivery — suggest first')}
        </AppText>
        <Segmented
          options={[
            { key: 'rider', label: t('Fazl rider') },
            { key: 'self', label: t('Self delivery') },
          ]}
          value={data.defaultLocalDelivery}
          onChange={v => update('defaultLocalDelivery', v)}
        />
      </Card>

      <SectionHeader title={t('Appearance')} />
      <Card>
        <AppText variant="bodyBold">{t('Theme')}</AppText>
        <AppText variant="caption" color={colors.textMuted} style={styles.themeHint}>
          {t("Dark mode keeps Fazl's teal and shows text in light grey on a dark background.")}
        </AppText>
        <Segmented
          options={[
            { key: 'system', label: t('Follow phone') },
            { key: 'light', label: t('Light') },
            { key: 'dark', label: t('Dark') },
          ]}
          value={appearance.mode}
          onChange={appearance.setMode}
        />
      </Card>

      <SectionHeader title={t('Language')} />
      <Card>
        <AppText variant="caption" color={colors.textMuted} style={styles.themeHint}>
          {t('The app restarts to change its language.')}
        </AppText>
        <Segmented
          options={[
            { key: 'en', label: LANGUAGE_NAMES.en },
            { key: 'ur', label: LANGUAGE_NAMES.ur },
          ]}
          value={language}
          onChange={chooseLanguage}
        />
      </Card>

      <SectionHeader title={t('Account')} />
      <Card>
        <ListRow title={t('Logged in as')} subtitle={seller?.email} divider />
        <ListRow
          icon={CircleHelp}
          title={t('Help & support')}
          divider
          onPress={() => Linking.openURL('https://fazlapp.com')}
        />
        <ListRow
          icon={ShieldCheck}
          title={t('Privacy policy')}
          divider
          onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}
        />
        <ListRow
          icon={FileText}
          title={t('Terms & conditions')}
          onPress={() => navigation.navigate('Legal', { doc: 'terms' })}
        />
      </Card>

      <Card style={styles.logout}>
        <ListRow
          icon={LogOut}
          tone="danger"
          title={t('Log out')}
          divider={canDeleteAccount}
          onPress={() => confirmLogout(signOut)}
        />
        {canDeleteAccount ? (
          <ListRow
            icon={Trash2}
            tone="danger"
            title={deleting ? t('Deleting…') : t('Delete account')}
            subtitle={t('Your Fazl account, shops and listings')}
            onPress={deleting ? undefined : confirmDeleteAccount}
          />
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  themeHint: { marginTop: 2, marginBottom: spacing.md },
  deliveryLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  logout: { marginTop: spacing.xl, paddingVertical: spacing.xs },
});
