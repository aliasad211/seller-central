import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AppText, Header, Screen } from '../../components';
import { useAuth } from '../../state/AuthContext';
import { colors, spacing, themedStyles } from '../../theme';
import { t } from '../../i18n';
import { AccountDetails } from '../../utils/accountProfile';
import { AccountDetailsForm } from './AccountDetailsForm';

export function CompleteProfileScreen() {
  const { seller, completeProfile, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!seller) return null;
  const save = async (details: AccountDetails) => {
    setSaving(true); setError('');
    try { await completeProfile(details); }
    catch (e) { setError(e instanceof Error ? e.message : t('Please try again')); }
    finally { setSaving(false); }
  };
  return <Screen background={colors.surface} header={<Header title={t('Complete your profile')} back={false} />}>
    <AppText color={colors.textMuted} style={styles.intro}>{t('Add your missing details to finish your Fazl account and continue to your shop.')}</AppText>
    <AppText variant="label" style={styles.intro}>{seller.email}</AppText>
    {error ? <AppText accessibilityRole="alert" color={colors.danger} style={styles.intro}>{error}</AppText> : null}
    <AccountDetailsForm initial={seller} loading={saving} title={t('Save and continue')} onSubmit={save} />
    <Pressable disabled={saving} onPress={async () => { setSaving(true); try { await signOut(); } catch (e) { setError(e instanceof Error ? e.message : t('Please try again')); } finally { setSaving(false); } }} style={styles.link}><AppText color={colors.primary}>{t('Use another account')}</AppText></Pressable>
  </Screen>;
}

const styles = themedStyles(() => StyleSheet.create({ intro: { marginBottom: spacing.lg }, link: { alignItems: 'center', paddingVertical: spacing.lg } }));
