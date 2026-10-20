import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FazlLogo from '../../assets/images/fazl-logo.jpg';
import { AppText } from '../../components';
import { useAuth } from '../../state/AuthContext';
import { colors, radius, spacing, themedStyles } from '../../theme';
import { t } from '../../i18n';
import { followThemeWithWindow } from '../../utils/windowBackground';

// Same rhythm as the Fazl app's splash dots.
const DOT_COUNT = 3;
const DOT_CYCLE_MS = 450;
const DOT_ACTIVE_SCALE = 1.9;

/** How long the splash stays at least, so it never just blinks. */
const MIN_SHOW_MS = 1600;
/** The longest it waits for what it covers: a slow network can't keep it up. */
const MAX_WAIT_MS = 8000;
const FADE_MS = 300;

function AnimatedDots() {
  const scales = useRef(Array.from({ length: DOT_COUNT }, () => new Animated.Value(1))).current;

  useEffect(() => {
    const loops = scales.map((scale, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * DOT_CYCLE_MS),
          Animated.timing(scale, { toValue: DOT_ACTIVE_SCALE, duration: DOT_CYCLE_MS / 2, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: DOT_CYCLE_MS / 2, useNativeDriver: true }),
          Animated.delay((DOT_COUNT - 1 - index) * DOT_CYCLE_MS),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [scales]);

  return (
    <View style={styles.dots}>
      {scales.map((scale, i) => (
        <Animated.View key={i} style={[styles.dot, { transform: [{ scale }] }]} />
      ))}
    </View>
  );
}

/**
 * Covers the app while it starts and while logging out, then fades away once
 * it has shown for `minShowMs` and `until` has settled — the saved login
 * checked and Home's data loaded, or the logout done. So Home opens with its
 * data in, and nothing flashes in between. It never waits for `until` longer
 * than MAX_WAIT_MS. `plain` (logging out) shows only the logo and the dots.
 */
export function SplashScreen({
  until,
  minShowMs = MIN_SHOW_MS,
  plain = false,
  onDone,
}: {
  until?: Promise<void>;
  minShowMs?: number;
  plain?: boolean;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { ready } = useAuth();
  const [shownLongEnough, setShownLongEnough] = useState(false);
  const [covered, setCovered] = useState(!until);
  const opacity = useRef(new Animated.Value(1)).current;
  const rise = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.timing(rise, { toValue: 0, duration: 500, useNativeDriver: true }).start();
    // The splash covers the screen now, so the window behind the app can
    // leave launch's teal for the theme's background.
    followThemeWithWindow();
    const timer = setTimeout(() => setShownLongEnough(true), minShowMs);
    return () => clearTimeout(timer);
  }, [rise, minShowMs]);

  useEffect(() => {
    if (!until) return;
    let alive = true;
    const settle = () => {
      if (alive) setCovered(true);
    };
    const cap = setTimeout(settle, MAX_WAIT_MS);
    until.then(settle, settle);
    return () => {
      alive = false;
      clearTimeout(cap);
    };
  }, [until]);

  useEffect(() => {
    if (!shownLongEnough || !ready || !covered) return;
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [shownLongEnough, ready, covered, opacity, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.screen, { opacity }]}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.center, { transform: [{ translateY: rise }] }]}>
        <View style={styles.logoCard}>
          <Image source={FazlLogo} style={styles.logo} resizeMode="contain" />
        </View>
        {!plain && (
          <>
            {/* Fixed sizes: the phone's font-size setting doesn't enlarge them. */}
            <AppText variant="title" color={colors.white} style={styles.title} allowFontScaling={false}>
              {t('Seller Central')}
            </AppText>
            <AppText color={colors.primaryTint} align="center" style={styles.tagline} allowFontScaling={false}>
              {t('Your products, orders and deliveries in one place')}
            </AppText>
          </>
        )}
        <AnimatedDots />
      </Animated.View>
      {!plain && (
        <AppText
          variant="caption"
          color={colors.primaryTint}
          style={[styles.footer, { bottom: insets.bottom + spacing.xl }]}
          allowFontScaling={false}
        >
          {t('by Fazl')}
        </AppText>
      )}
    </Animated.View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', paddingHorizontal: spacing.xxl },
  logoCard: {
    width: 150,
    height: 150,
    borderRadius: radius.lg + 8,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  // The logo file has a wide white margin and sits left of centre; scaling
  // it up crops the margin away and the nudge centres the mark in the card.
  logo: { width: 300, height: 300, transform: [{ translateX: 26 }] },
  title: { fontSize: 22, lineHeight: 28, marginBottom: spacing.xs },
  tagline: { fontSize: 13, lineHeight: 18 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: spacing.xl },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.white },
  footer: { position: 'absolute' },
}));
