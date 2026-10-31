import { Languages, Lock, Store, Users } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  TextInputInstance,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppleButton } from '@invertase/react-native-apple-authentication';
import { isAppleSignInAvailable } from '../../api/apple';
import GoogleIcon from '../../assets/icons/google.png';
import { AppText, DoodleButton, IconCircle, OutlinedField, Screen } from '../../components';
import { useAuth } from '../../state/AuthContext';
import { colors, fonts, spacing, themedStyles } from '../../theme';
import { LANGUAGE_NAMES } from '../../utils/chooseLanguage';
import { isUrdu, setLanguage, t } from '../../i18n';
import { RootScreenProps } from '../../navigation/types';
import { LoginCodeStep } from './LoginCodeStep';

export function LoginScreen({ navigation }: RootScreenProps<'Login'>) {
  const { pendingLogin, signIn, signInAsMember, joinTeam, signInWithGoogle, signInWithApple } = useAuth();
  const [mode, setMode] = useState<'owner' | 'member'>('owner');
  // A team member joining with the code from their invite email, choosing a password.
  const [joining, setJoining] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    code?: string;
    password?: string;
    confirm?: string;
    form?: string;
  }>({});
  const [loading, setLoading] = useState<'email' | 'google' | 'apple' | null>(null);
  const codeRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);
  const isJoining = mode === 'member' && joining;

  const submit = async () => {
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t('Enter a valid email');
    if (isJoining) {
      if (!/^\d{6}$/.test(code.trim())) next.code = t('Enter the 6-digit code from the invite email');
      if (password.length < 6) next.password = t('Use at least 6 characters');
      else if (confirm !== password) next.confirm = t("Passwords don't match");
    } else if (!password) {
      next.password = t('Enter your password');
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setLoading('email');
    try {
      if (isJoining) {
        await joinTeam(email.trim(), code.trim(), password);
      } else if (mode === 'member') {
        await signInAsMember(email.trim(), password);
      } else {
        // A code is emailed; the code step takes over from here.
        await signIn(email.trim(), password);
        setLoading(null);
      }
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : t('Could not log in') });
      setLoading(null);
    }
  };

  const google = async () => {
    setErrors({});
    setLoading('google');
    try {
      // Continue with the shared Fazl account, creating it when necessary.
      await signInWithGoogle();
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : t('Google sign-in failed') });
    }
    // Still here after a cancel or an error; after a login this screen is gone.
    setLoading(null);
  };

  // Apple sign-in keeps its existing-account policy; Google also supports signup.
  const apple = async () => {
    if (loading) return;
    setErrors({});
    setLoading('apple');
    try {
      await signInWithApple();
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : t('Apple sign-in failed') });
    }
    setLoading(null);
  };

  // The owner's email and password were right: the emailed code finishes it.
  if (pendingLogin) return <LoginCodeStep />;

  return (
    <Screen background={colors.surface} contentStyle={styles.content}>
      {/* The other language, in its own words; nothing to lose here, so no question. */}
      <Pressable
        style={styles.language}
        hitSlop={8}
        onPress={() => setLanguage(isUrdu ? 'en' : 'ur')}
        accessibilityRole="button"
      >
        <Languages size={16} color={colors.primary} />
        <AppText variant="label" color={colors.primary}>
          {LANGUAGE_NAMES[isUrdu ? 'en' : 'ur']}
        </AppText>
      </Pressable>

      <View style={styles.segmentWrap}>
        <TouchableOpacity
          style={[styles.segmentBtn, mode === 'owner' && styles.segmentBtnActive]}
          onPress={() => {
            setMode('owner');
            setJoining(false);
            setErrors({});
          }}
          activeOpacity={0.8}
        >
          <Store size={16} color={mode === 'owner' ? colors.primary : colors.textMuted} />
          <AppText
            variant="label"
            color={mode === 'owner' ? colors.primary : colors.textMuted}
            style={mode === 'owner' ? styles.segmentTextActive : styles.segmentText}
          >
            {t('Shop Owner')}
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, mode === 'member' && styles.segmentBtnActive]}
          onPress={() => {
            setMode('member');
            setErrors({});
          }}
          activeOpacity={0.8}
        >
          <Users size={16} color={mode === 'member' ? colors.primary : colors.textMuted} />
          <AppText
            variant="label"
            color={mode === 'member' ? colors.primary : colors.textMuted}
            style={mode === 'member' ? styles.segmentTextActive : styles.segmentText}
          >
            {t('Team Member')}
          </AppText>
        </TouchableOpacity>
      </View>

      <View style={styles.brand}>
        <IconCircle icon={mode === 'member' ? Users : Store} size={72} />
        <AppText variant="title" align="center">
          {isJoining
            ? t('Join your team')
            : mode === 'member'
              ? t('Team Member Login')
              : t('Fazl Seller Central')}
        </AppText>
        <AppText color={colors.textMuted} align="center">
          {isJoining
            ? t('Enter your email, the 6-digit code from your invite email, and choose a password.')
            : mode === 'member'
              ? t('Sign in with your team credentials to manage assigned shop orders, products, and ads.')
              : t("Manage your shop's products, orders and deliveries. Log in with your Fazl account.")}
        </AppText>
      </View>

      <OutlinedField
        label={t('Email Address')}
        value={email}
        onChangeText={text => {
          setEmail(text);
          setErrors(e => ({ ...e, email: undefined, form: undefined }));
        }}
        placeholder={t('you@example.com')}
        keyboardType="email-address"
        autoComplete="email"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => (isJoining ? codeRef : passwordRef).current?.focus()}
        error={errors.email}
      />
      {isJoining ? (
        <OutlinedField
          ref={codeRef}
          label={t('Invite code')}
          value={code}
          onChangeText={text => {
            setCode(text.replace(/[^0-9]/g, ''));
            setErrors(e => ({ ...e, code: undefined, form: undefined }));
          }}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={errors.code}
        />
      ) : null}
      <OutlinedField
        ref={passwordRef}
        label={isJoining ? t('Choose a password') : t('Password')}
        password
        value={password}
        onChangeText={text => {
          setPassword(text);
          setErrors(e => ({ ...e, password: undefined, form: undefined }));
        }}
        placeholder="•••••••••"
        returnKeyType={isJoining ? 'next' : 'done'}
        submitBehavior={isJoining ? 'submit' : undefined}
        onSubmitEditing={isJoining ? () => confirmRef.current?.focus() : submit}
        error={errors.password}
      />
      {isJoining ? (
        <OutlinedField
          ref={confirmRef}
          label={t('Confirm password')}
          password
          value={confirm}
          onChangeText={text => {
            setConfirm(text);
            setErrors(e => ({ ...e, confirm: undefined, form: undefined }));
          }}
          placeholder="•••••••••"
          returnKeyType="done"
          onSubmitEditing={submit}
          error={errors.confirm}
        />
      ) : (
        <Pressable
          style={styles.forgot}
          hitSlop={8}
          onPress={() =>
            Alert.alert(
              t('Forgot password'),
              mode === 'member'
                ? t('Ask your shop owner to update or reset your team credentials.')
                : t('Reset your password from the Fazl app, then log in here with the new one.')
            )
          }
        >
          <AppText style={styles.forgotText}>{t('Forgot Password?')}</AppText>
        </Pressable>
      )}

      {errors.form ? (
        <View style={styles.formError}>
          <Lock size={16} color={colors.danger} />
          <AppText color={colors.danger} style={styles.flex}>
            {errors.form}
          </AppText>
        </View>
      ) : null}

      <DoodleButton
        title={isJoining ? t('Join team') : mode === 'member' ? t('Log in as Team Member') : t('Log in')}
        onPress={submit}
        loading={loading === 'email'}
        loadingText={isJoining ? t('Joining') : t('Logging in')}
        disabled={loading !== null || !email.trim() || !password || (isJoining && (!code || !confirm))}
      />

      {mode === 'member' ? (
        <Pressable
          style={styles.joinSwitch}
          hitSlop={8}
          onPress={() => {
            setJoining(j => !j);
            setPassword('');
            setConfirm('');
            setErrors({});
          }}
        >
          <AppText style={styles.forgotText}>
            {joining ? t('Already joined? Log in') : t('Got an invite code? Join your team')}
          </AppText>
        </Pressable>
      ) : null}

      {mode === 'owner' ? (
        <>
          <Pressable accessibilityRole="button" disabled={loading !== null} style={styles.joinSwitch} onPress={() => navigation.navigate('Signup')}>
            <AppText style={styles.forgotText}>{t('New to Fazl? Create an account')}</AppText>
          </Pressable>
          <View style={styles.divider}>
            <View style={styles.line} />
            <AppText color={colors.textMuted}>{t('or')}</AppText>
            <View style={styles.line} />
          </View>

          <TouchableOpacity
            style={styles.google}
            onPress={google}
            disabled={loading !== null}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            {loading === 'google' ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Image source={GoogleIcon} style={styles.googleIcon} />
                <AppText style={styles.googleText}>{t('Continue with Google')}</AppText>
              </>
            )}
          </TouchableOpacity>

          {/* Apple's own button, iPhone only (as in the Fazl app). */}
          {isAppleSignInAvailable ? (
            <AppleButton
              buttonStyle={AppleButton.Style.BLACK}
              buttonType={AppleButton.Type.CONTINUE}
              cornerRadius={12}
              style={[styles.apple, loading !== null && styles.dimmed]}
              onPress={apple}
            />
          ) : null}
        </>
      ) : null}

      <AppText variant="caption" color={colors.textMuted} align="center" style={styles.note}>
        {mode === 'member'
          ? t('Team members only have access to Seller Central and the specific permissions granted by the shop owner.')
          : t("Log in with your Fazl account. Don't have a shop yet? You can create one here after logging in.")}
      </AppText>
    </Screen>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingHorizontal: 20 },
  language: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.lg,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    padding: 4,
    borderRadius: 12,
    marginBottom: spacing.lg,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  segmentTextActive: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  brand: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.xxl },
  forgot: { alignSelf: 'flex-end', marginTop: -4, marginBottom: spacing.xl },
  joinSwitch: { alignSelf: 'center', marginTop: spacing.lg },
  forgotText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
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
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: spacing.xl },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  // Fazl's "Continue with Google" button.
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
  apple: { width: '100%', height: 56, marginTop: spacing.md },
  dimmed: { opacity: 0.6 },
  googleText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  note: { marginTop: spacing.xl },
}));
