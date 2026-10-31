import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Lock, MailCheck } from 'lucide-react-native';
import { AppText, CodeBoxes, DoodleButton, IconCircle, Screen } from '../../components';
import { ChevronBack } from '../../components/Chevrons';
import { useAuth } from '../../state/AuthContext';
import { colors, fonts, spacing, themedStyles } from '../../theme';
import { t } from '../../i18n';

/** Seconds before another code can be sent. */
const RESEND_AFTER = 60;

/**
 * A password login's last step, on Login or right after Signup: the 6-digit
 * code Fazl emailed to the account. Seller Central asks for one on every
 * password login, and after its account was closed this opens it again.
 */
export function LoginCodeStep() {
  const { pendingLogin, verifyLoginCode, resendLoginCode, cancelLogin } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendAfter, setResendAfter] = useState(RESEND_AFTER);
  useEffect(() => {
    if (resendAfter <= 0) return;
    const timer = setTimeout(() => setResendAfter(n => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendAfter]);

  // `value`: the code just completed in the boxes, before its state has landed.
  const verify = async (value: string = code) => {
    if (loading) return;
    if (!/^\d{6}$/.test(value)) { setError(t('Enter the 6-digit verification code')); return; }
    setLoading(true); setError('');
    try {
      await verifyLoginCode(value);
      // Logged in: this screen is gone.
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Please try again'));
      setCode('');
      setLoading(false);
    }
  };
  const resend = async () => {
    if (loading || resendAfter > 0) return;
    setLoading(true); setError('');
    try {
      await resendLoginCode();
      setCode(''); setResendAfter(RESEND_AFTER);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Please try again'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen background={colors.surface} contentStyle={styles.content}>
      <View style={styles.topRow}>
        <Pressable onPress={cancelLogin} disabled={loading} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Back')} style={styles.backButton}>
          <ChevronBack size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.brand}>
        <IconCircle icon={MailCheck} size={72} />
        <AppText variant="title" align="center">{t('Check your email')}</AppText>
        <AppText color={colors.textMuted} align="center">
          {t('Enter the 6-digit code we sent to {email} to open Seller Central.', { email: pendingLogin?.email ?? '' })}
        </AppText>
      </View>

      {error ? (
        <View style={styles.formError} accessibilityRole="alert">
          <Lock size={16} color={colors.danger} />
          <AppText color={colors.danger} style={styles.flex}>{error}</AppText>
        </View>
      ) : null}

      <CodeBoxes
        value={code}
        onChange={v => { setCode(v); setError(''); }}
        onComplete={verify}
        label={t('Verification code')}
        autoFocus
        editable={!loading}
        error={Boolean(error)}
      />
      <DoodleButton
        title={t('Verify and log in')}
        onPress={() => verify()}
        loading={loading}
        loadingText={t('Logging in')}
        disabled={loading || !/^\d{6}$/.test(code)}
      />
      <View style={styles.resendRow}>
        <AppText color={colors.textMuted}>{t("Didn't get the code?")}</AppText>
        <Pressable disabled={loading || resendAfter > 0} onPress={resend} hitSlop={8} accessibilityRole="button">
          <AppText style={resendAfter ? styles.resendWait : styles.linkText}>
            {resendAfter ? t('Resend code in {seconds}s', { seconds: resendAfter }) : t('Resend code')}
          </AppText>
        </Pressable>
      </View>
      <Pressable disabled={loading} onPress={cancelLogin} style={styles.linkRow} hitSlop={8} accessibilityRole="button">
        <AppText style={styles.linkText}>{t('Change email')}</AppText>
      </Pressable>

      <AppText variant="caption" color={colors.textMuted} align="center" style={styles.note}>
        {t('We ask for a code every time you log in with your password, to keep your shop safe.')}
      </AppText>
    </Screen>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingHorizontal: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  // Lower on the screen than a plain form, as Login's own heading sits.
  brand: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.xxl },
  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: 10,
    marginBottom: spacing.lg,
  },
  flex: { flex: 1 },
  linkText: { fontFamily: fonts.regular, fontSize: 14, color: colors.primary, textDecorationLine: 'underline' },
  linkRow: { alignSelf: 'center', marginTop: spacing.lg },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.lg, flexWrap: 'wrap' },
  resendWait: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  note: { marginTop: spacing.xl },
}));
