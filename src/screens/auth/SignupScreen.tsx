import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CircleCheck, KeyRound, Languages, Lock, ShieldCheck, UserPlus, UserRound } from 'lucide-react-native';
import GoogleIcon from '../../assets/icons/google.png';
import { createFazlAccount, sendSignupCode, verifySignupCode, sendPhoneSignupCode, verifyPhoneSignupCode, validSignupPassword } from '../../api/account';
import { AppText, CodeBoxes, DoodleButton, IconCircle, OutlinedField, Screen } from '../../components';
import { ChevronBack } from '../../components/Chevrons';
import { RootScreenProps } from '../../navigation/types';
import { useAuth } from '../../state/AuthContext';
import { colors, fonts, spacing, themedStyles } from '../../theme';
import { isUrdu, setLanguage, t } from '../../i18n';
import { LANGUAGE_NAMES } from '../../utils/chooseLanguage';
import { AccountDetails, pakistanPhone } from '../../utils/accountProfile';
import { AccountDetailsForm } from './AccountDetailsForm';
import { LoginCodeStep } from './LoginCodeStep';

type Stage = 'contact' | 'code' | 'password' | 'details';

/**
 * A new Fazl account, laid out as the Login screen is: the email or phone, then
 * the code sent to it (in boxes, with a resend), a password, and the owner's
 * details — or Google instead of all of it.
 */
export function SignupScreen({ navigation }: RootScreenProps<'Signup'>) {
  const { pendingLogin, signIn, signInWithGoogle } = useAuth();
  const [stage, setStage] = useState<Stage>('contact');
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [usingGoogle, setUsingGoogle] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState('');
  const [resendAfter, setResendAfter] = useState(0);
  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const contactValid = method === 'email' ? emailValid : /^\+923\d{9}$/.test(pakistanPhone(phone));
  const contact = method === 'email' ? email.trim().toLowerCase() : pakistanPhone(phone);
  useEffect(() => {
    if (resendAfter <= 0) return;
    const timer = setTimeout(() => setResendAfter(n => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendAfter]);

  const send = async () => {
    if (loading || (stage === 'code' && resendAfter > 0)) return;
    if (!contactValid) { setError(t(method === 'email' ? 'Enter a valid email' : 'Enter a valid Pakistani mobile number')); return; }
    setLoading(true); setError('');
    try {
      if (method === 'email') await sendSignupCode(email); else await sendPhoneSignupCode(phone);
      setCode(''); setStage('code'); setResendAfter(60);
    } catch (e) { setError(e instanceof Error ? e.message : t('Please try again')); }
    finally { setLoading(false); }
  };
  // `value`: the code just completed in the boxes, before its state has landed.
  const verify = async (value: string = code) => {
    if (loading) return;
    if (!/^\d{6}$/.test(value)) { setError(t('Enter the 6-digit verification code')); return; }
    setLoading(true); setError('');
    try {
      if (method === 'email') await verifySignupCode(email, value); else await verifyPhoneSignupCode(phone, value);
      setStage('password'); setCode('');
    } catch (e) { setError(e instanceof Error ? e.message : t('Please try again')); }
    finally { setLoading(false); }
  };
  const continuePassword = () => {
    if (!validSignupPassword(password)) { setError(t('Use at least 8 characters, a special character, and no spaces')); return; }
    if (password !== confirm) { setError(t("Passwords don't match")); return; }
    setError(''); setStage('details');
  };
  const login = async () => {
    if (loading) return;
    setLoading(true); setError('');
    try { await signIn(email.trim().toLowerCase(), password); }
    catch (e) { setError(e instanceof Error ? e.message : t('Could not log in')); }
    finally { setLoading(false); }
  };
  const create = async (details: AccountDetails) => {
    if (loading) return;
    if (!emailValid) { setError(t('Enter a valid email')); return; }
    if (!validSignupPassword(password) || password !== confirm) return;
    setLoading(true); setError('');
    try {
      await createFazlAccount(email, password, { ...details, roles: ['business_owner'], ...(method === 'phone' ? { phone: pakistanPhone(phone) } : {}) });
      setCreated(true);
      await signIn(email.trim().toLowerCase(), password);
    } catch (e) { setError(e instanceof Error ? e.message : t('Please try again')); }
    finally { setLoading(false); }
  };
  const google = async () => {
    if (loading) return;
    setLoading(true); setUsingGoogle(true); setError('');
    try { await signInWithGoogle(); }
    catch (e) { setError(e instanceof Error ? e.message : t('Google sign-in failed')); }
    finally { setLoading(false); setUsingGoogle(false); }
  };
  const back = () => {
    setError('');
    if (stage === 'details') setStage('password');
    else if (stage === 'code') { setStage('contact'); setCode(''); }
    else navigation.goBack();
  };

  // What the top of the screen says, step by step.
  const heading = created
    ? { icon: CircleCheck, title: t('Your account is ready'), text: t('Your account is created. Log in to continue.') }
    : stage === 'code'
      ? { icon: ShieldCheck, title: method === 'email' ? t('Verify your email') : t('Verify your phone'), text: t('Enter the code sent to {email}', { email: contact }) }
      : stage === 'password'
        ? { icon: KeyRound, title: t('Create a password'), text: t('Use at least 8 characters, a special character, and no spaces') }
        : stage === 'details'
          ? { icon: UserRound, title: t('Your details'), text: contact }
          : { icon: UserPlus, title: t('Create your Fazl account'), text: t('Create a business owner account for Fazl App and Seller Central.') };

  // Created and logging in: Seller Central's emailed login code, as on Login.
  if (pendingLogin) return <LoginCodeStep />;

  return (
    <Screen background={colors.surface} contentStyle={styles.content}>
      <View style={styles.topRow}>
        <Pressable onPress={back} disabled={loading} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Back')} style={styles.backButton}>
          <ChevronBack size={24} color={colors.text} />
        </Pressable>
        {/* The other language, in its own words, as on Login. */}
        <Pressable style={styles.language} hitSlop={8} onPress={() => setLanguage(isUrdu ? 'en' : 'ur')} accessibilityRole="button">
          <Languages size={16} color={colors.primary} />
          <AppText variant="label" color={colors.primary}>{LANGUAGE_NAMES[isUrdu ? 'en' : 'ur']}</AppText>
        </Pressable>
      </View>

      <View style={styles.brand}>
        <IconCircle icon={heading.icon} size={72} />
        <AppText variant="title" align="center">{heading.title}</AppText>
        <AppText color={colors.textMuted} align="center">{heading.text}</AppText>
      </View>

      {error ? (
        <View style={styles.formError} accessibilityRole="alert">
          <Lock size={16} color={colors.danger} />
          <AppText color={colors.danger} style={styles.flex}>{error}</AppText>
        </View>
      ) : null}

      {created ? (
        <DoodleButton title={t('Log in')} onPress={login} loading={loading} disabled={loading} />
      ) : stage === 'details' ? (
        <AccountDetailsForm loading={loading} title={t('Create account')} onSubmit={create} referral verifiedPhone={method === 'phone' ? pakistanPhone(phone) : undefined}>
          {method === 'phone' ? <OutlinedField label={t('Email Address')} value={email} keyboardType="email-address" autoComplete="email" onChangeText={setEmail} editable={!loading} /> : null}
        </AccountDetailsForm>
      ) : stage === 'password' ? (
        <>
          <OutlinedField label={t('Choose a password')} password value={password} placeholder="•••••••••" autoComplete="new-password" onChangeText={v => { setPassword(v); setError(''); }} editable={!loading} />
          <OutlinedField label={t('Confirm password')} password value={confirm} placeholder="•••••••••" autoComplete="new-password" onChangeText={v => { setConfirm(v); setError(''); }} editable={!loading} />
          <DoodleButton title={t('Continue')} onPress={continuePassword} disabled={loading || !validSignupPassword(password) || password !== confirm} />
        </>
      ) : stage === 'code' ? (
        <>
          <CodeBoxes
            value={code}
            onChange={v => { setCode(v); setError(''); }}
            onComplete={verify}
            label={t('Verification code')}
            autoFocus
            editable={!loading}
            error={Boolean(error)}
          />
          <DoodleButton title={method === 'email' ? t('Verify email') : t('Verify phone')} onPress={() => verify()} loading={loading} disabled={loading || !/^\d{6}$/.test(code)} />
          <View style={styles.resendRow}>
            <AppText color={colors.textMuted}>{t("Didn't get the code?")}</AppText>
            <Pressable disabled={loading || resendAfter > 0} onPress={send} hitSlop={8} accessibilityRole="button">
              <AppText style={resendAfter ? styles.resendWait : styles.linkText}>
                {resendAfter ? t('Resend code in {seconds}s', { seconds: resendAfter }) : t('Resend code')}
              </AppText>
            </Pressable>
          </View>
          <Pressable disabled={loading} onPress={back} style={styles.linkRow} hitSlop={8}>
            <AppText style={styles.linkText}>{method === 'email' ? t('Change email') : t('Change phone')}</AppText>
          </Pressable>
        </>
      ) : (
        <>
          {method === 'email' ? (
            <OutlinedField label={t('Email Address')} value={email} placeholder={t('you@example.com')} keyboardType="email-address" autoComplete="email" returnKeyType="next" onSubmitEditing={send} onChangeText={v => { setEmail(v); setError(''); }} editable={!loading} />
          ) : (
            <OutlinedField label={t('Mobile number (Pakistan)')} value={phone} placeholder="+923001234567" keyboardType="phone-pad" autoComplete="tel" maxLength={18} onChangeText={v => { setPhone(v); setError(''); }} editable={!loading} />
          )}
          <DoodleButton title={method === 'email' ? t('Continue with email') : t('Continue with phone')} onPress={send} loading={loading && !usingGoogle} disabled={loading || !contactValid} />
          <Pressable accessibilityRole="button" accessibilityLabel={method === 'email' ? t('Continue with phone') : t('Continue with email')} disabled={loading} onPress={() => { setMethod(method === 'email' ? 'phone' : 'email'); setError(''); }} style={styles.linkRow} hitSlop={8}>
            <AppText style={styles.linkText}>{method === 'email' ? t('Continue with phone') : t('Continue with email')}</AppText>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.line} />
            <AppText color={colors.textMuted}>{t('or')}</AppText>
            <View style={styles.line} />
          </View>

          <TouchableOpacity style={styles.google} onPress={google} disabled={loading} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('Continue with Google')}>
            {usingGoogle ? <ActivityIndicator color={colors.primary} /> : (
              <>
                <Image source={GoogleIcon} style={styles.googleIcon} />
                <AppText style={styles.googleText}>{t('Continue with Google')}</AppText>
              </>
            )}
          </TouchableOpacity>
        </>
      )}

      <Pressable disabled={loading} onPress={() => navigation.goBack()} style={styles.loginRow} hitSlop={8}>
        <AppText style={styles.linkText}>{t('Already have an account? Log in')}</AppText>
      </Pressable>
    </Screen>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingHorizontal: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  language: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
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
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: spacing.xl },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  // Login's "Continue with Google" button.
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 56,
    gap: 12,
  },
  googleIcon: { width: 22, height: 22 },
  googleText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  loginRow: { alignSelf: 'center', marginTop: spacing.xl, marginBottom: spacing.lg },
}));
