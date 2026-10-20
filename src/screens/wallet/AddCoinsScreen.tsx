import { Check, CreditCard, Smartphone, Wallet, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { buyCoins, CoinMethod, CoinOptions, CoinPurchase, getCoinOptions, getCoinPurchase } from '../../api/coins';
import { getNewShopTerms, NewShopTerms } from '../../api/shopRequests';
import {
  AppText,
  Button,
  Card,
  Header,
  IconCircle,
  Screen,
  SectionHeader,
  StateView,
  TextField,
} from '../../components';
import { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing, themedStyles } from '../../theme';
import { formatRs } from '../../utils/format';
import { t } from '../../i18n';

/** A pending purchase is checked this often, for this long. */
const POLL_MS = 5000;
const POLL_FOR_MS = 3 * 60 * 1000;

/** 03XXXXXXXXX, +92 3XX XXXXXXX and the like. */
const MOBILE_RE = /^(?:\+?92|0092|0)?3\d{9}$/;

/** The ways to pay Fazl through a gateway. */
export const TOP_UP_METHODS: { method: CoinMethod; label: string; hint: string }[] = [
  { method: 'jazzcash', label: 'JazzCash', hint: t('Pay from your JazzCash account') },
  { method: 'easypaisa', label: 'Easypaisa', hint: t('Pay from your Easypaisa account') },
  { method: 'card', label: t('Debit or credit card'), hint: t("Enter your card's details on JazzCash's secure page") },
];

/** A gateway, or — for another shop's fee only — the Fazl wallet. */
type PayMethod = CoinMethod | 'wallet';

/** form → phone (approving on the phone) | card (paying on the card page) | pending (waiting for the gateway) */
type Stage = 'form' | 'phone' | 'card' | 'pending';

/**
 * Paying Fazl. Two uses:
 *
 * - Adding money to the owner's Fazl wallet with JazzCash, Easypaisa or a
 *   card (a top-up — money, not coins), as in the Fazl app; `needed` is what
 *   another shop's fee is short of.
 * - Paying another shop's fee (`shopFee`, rupees), opened by Create shop's
 *   "Pay & send for approval": from the Fazl wallet, or with JazzCash,
 *   Easypaisa or a card. Once it's paid, Create shop sends the shop for
 *   approval (`fromWalletAt` / `paidFor`). A gateway payment goes into the
 *   wallet and the fee is taken from it there, so the books stay one ledger.
 *
 * A mobile account is charged straight away and approved on the owner's
 * phone while this screen waits; a card opens JazzCash's card page inside the
 * app, where the card's details are entered, and the purchase is checked as
 * that page moves on.
 */
export function AddCoinsScreen({ navigation, route }: RootScreenProps<'AddCoins'>) {
  const insets = useSafeAreaInsets();
  const needed = route.params?.needed;
  const shopFee = route.params?.shopFee;
  const [options, setOptions] = useState<CoinOptions | null>(null);
  // Paying a shop's fee: the owner's wallet, to offer it.
  const [terms, setTerms] = useState<NewShopTerms | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amount, setAmount] = useState(() => {
    const start = shopFee ?? needed;
    return start ? String(Math.ceil(start)) : '';
  });
  const [method, setMethod] = useState<PayMethod | null>(route.params?.method ?? null);
  const [mobile, setMobile] = useState('');
  const [cnic, setCnic] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('form');
  const [tracked, setTracked] = useState<{ id: string; since: number } | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const checkoutUrl = useRef<string | null>(null);
  const mounted = useRef(true);
  // The purchase still open. Cleared the moment it settles, so the poll and
  // the come-back check can't both report it.
  const activeId = useRef<string | null>(null);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const loadOptions = useCallback(() => {
    setLoadError(null);
    Promise.all([getCoinOptions(), shopFee ? getNewShopTerms().catch(() => null) : Promise.resolve(null)])
      .then(([o, shopTerms]) => {
        setOptions(o);
        setTerms(shopTerms);
        const walletCovers =
          !!shopFee && !!shopTerms && shopTerms.walletEnabled && !shopTerms.walletFrozen && shopTerms.balance >= shopFee;
        setMethod(m => {
          if (m === 'wallet' ? walletCovers : m && o.available[m]) return m;
          if (walletCovers) return 'wallet';
          return TOP_UP_METHODS.find(x => o.available[x.method])?.method ?? null;
        });
        // What the shop needs, raised to the smallest amount Fazl takes.
        setAmount(a => (a && Number(a) < o.min ? String(o.min) : a));
      })
      .catch(e => setLoadError(e instanceof Error ? e.message : t('Something went wrong')));
  }, [shopFee]);

  useEffect(loadOptions, [loadOptions]);

  /** Acts on a purchase that has settled; false while it's still pending. */
  const finish = useCallback(
    (p: CoinPurchase) => {
      if (!mounted.current || p.id !== activeId.current) return true;
      if (p.status === 'pending') return false;
      activeId.current = null;
      setTracked(null);
      setCardOpen(false);
      if (p.status === 'completed') {
        if (shopFee) {
          // Back to the shop, which now goes for approval paid from this.
          navigation.popTo('CreateShop', { paidFor: p.id }, { merge: true });
          return true;
        }
        Alert.alert(
          t('Money added'),
          t('{amount} is now in your Fazl wallet.', { amount: formatRs(p.amount) }),
          [{ text: t('OK'), onPress: () => navigation.goBack() }],
          { cancelable: false },
        );
      } else {
        setStage('form');
        setError(
          `${t('The payment did not go through')}${p.failureMessage ? `: ${p.failureMessage}` : ''}. ${t(
            'You were not charged.',
          )}`,
        );
      }
      return true;
    },
    [navigation, shopFee],
  );

  const check = useCallback(() => {
    if (!tracked) return;
    getCoinPurchase(tracked.id)
      .then(finish)
      .catch(() => undefined);
  }, [tracked, finish]);

  // While a purchase is open: check it every few seconds for a few minutes,
  // and whenever the app comes back to the front.
  useEffect(() => {
    if (!tracked) return undefined;
    const timer = setInterval(() => {
      if (Date.now() - tracked.since < POLL_FOR_MS) check();
    }, POLL_MS);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [tracked, check]);

  const title = shopFee ? t('Pay for your shop') : t('Add money');

  if (!options) {
    return (
      <Screen header={<Header title={title} />} scroll={false}>
        <StateView error={loadError} onRetry={loadOptions} />
      </Screen>
    );
  }

  const value = Number(amount);
  const isMobile = method === 'jazzcash' || method === 'easypaisa';
  const walletReady = !!terms && terms.walletEnabled && !terms.walletFrozen;
  const walletShort = shopFee && terms ? Math.max(0, shopFee - terms.balance) : 0;
  const walletCovers = !!shopFee && walletReady && walletShort === 0;
  // What this payment takes: the fee from the wallet; through a gateway, the
  // fee raised to the smallest amount Fazl takes.
  const charge = method === 'wallet' && shopFee ? shopFee : value;

  const pay = async () => {
    if (method === 'wallet') {
      if (!walletCovers) return;
      // The fee comes out of the wallet as Create shop sends the shop.
      navigation.popTo('CreateShop', { fromWalletAt: Date.now() }, { merge: true });
      return;
    }
    if (!Number.isInteger(value) || value < options.min || value > options.max) {
      setError(t('Enter an amount from {min} to {max}.', { min: formatRs(options.min), max: formatRs(options.max) }));
      return;
    }
    if (!method) return;
    if (isMobile && !MOBILE_RE.test(mobile.replace(/[\s-]/g, ''))) {
      setError(t('Enter the 11-digit mobile number, e.g. 03001234567'));
      return;
    }
    if (method === 'jazzcash' && !/^\d{6}$/.test(cnic)) {
      setError(t('Enter the last 6 digits of the CNIC on the JazzCash account.'));
      return;
    }
    setError(null);
    if (isMobile) setStage('phone');
    try {
      const res = await buyCoins({ amount: value, method, mobileNumber: mobile.trim(), cnicLast6: cnic });
      activeId.current = res.purchase.id;
      if (res.checkoutUrl) {
        checkoutUrl.current = res.checkoutUrl;
        setTracked({ id: res.purchase.id, since: Date.now() });
        setStage('card');
        setCardOpen(true);
        return;
      }
      if (finish(res.purchase)) return;
      setTracked({ id: res.purchase.id, since: Date.now() });
      setStage('pending');
    } catch (e) {
      if (!mounted.current) return;
      setStage('form');
      setError(e instanceof Error ? e.message : t('Something went wrong'));
    }
  };

  if (stage !== 'form') {
    return (
      <Screen header={<Header title={title} />}>
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.primary} size="large" />
          <AppText variant="subheading" align="center">
            {stage === 'phone'
              ? t('Approve the payment on your phone')
              : stage === 'card'
                ? t('Finish paying on the card page')
                : t('Waiting for the payment to be confirmed')}
          </AppText>
          <AppText color={colors.textMuted} align="center">
            {stage === 'phone'
              ? t('{name} has sent a request to {number}. Enter your MPIN there to pay {amount}.', {
                  name: method === 'jazzcash' ? 'JazzCash' : 'Easypaisa',
                  number: mobile.trim(),
                  amount: formatRs(value),
                })
              : stage === 'card'
                ? t("Enter your card's details on the card page to pay {amount}. This moves on once JazzCash confirms it.", {
                    amount: formatRs(value),
                  })
                : t('This can take a minute. You can leave this screen; the money is added either way.')}
          </AppText>
          {stage === 'card' ? (
            <>
              <Button
                title={t('Open the card page again')}
                variant="outline"
                onPress={() => setCardOpen(true)}
                style={styles.stretch}
              />
              <Button title={t("I've paid, check now")} variant="ghost" onPress={check} style={styles.stretch} />
            </>
          ) : null}
        </View>

        {/* JazzCash's card page, inside the app: the card's details are entered
            there, never in Fazl. Each step it takes is a cue to check the
            purchase, and it closes once the payment has settled. */}
        <Modal
          visible={cardOpen && !!checkoutUrl.current}
          animationType="slide"
          onRequestClose={() => {
            setCardOpen(false);
            check();
          }}
        >
          <View style={[styles.cardSheet, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.cardHead}>
              <IconCircle icon={CreditCard} size={32} />
              <View style={styles.flex}>
                <AppText variant="bodyBold">{t('Card payment')}</AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  {formatRs(value)} · JazzCash
                </AppText>
              </View>
              <Pressable
                onPress={() => {
                  setCardOpen(false);
                  check();
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('Close')}
              >
                <X size={22} color={colors.text} />
              </Pressable>
            </View>
            {checkoutUrl.current ? (
              <WebView
                source={{ uri: checkoutUrl.current }}
                style={styles.flex}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.webLoading}>
                    <ActivityIndicator color={colors.primary} size="large" />
                  </View>
                )}
                onNavigationStateChange={() => check()}
              />
            ) : null}
          </View>
        </Modal>
      </Screen>
    );
  }

  const rows: { key: PayMethod; label: string; hint: string; icon: typeof Wallet; available: boolean; warn?: boolean }[] = [
    ...(shopFee
      ? [
          {
            key: 'wallet' as const,
            label: t('Fazl wallet'),
            icon: Wallet,
            available: walletCovers,
            warn: walletReady && walletShort > 0,
            hint: !terms
              ? t('Not available right now')
              : !walletReady
                ? t('Not available right now')
                : walletShort > 0
                  ? `${t('Balance {amount}', { amount: formatRs(terms.balance) })} · ${t('{amount} short', {
                      amount: formatRs(walletShort),
                    })}`
                  : t('Balance {amount}', { amount: formatRs(terms.balance) }),
          },
        ]
      : []),
    ...TOP_UP_METHODS.map(m => ({
      key: m.method,
      label: m.label,
      icon: m.method === 'card' ? CreditCard : Smartphone,
      available: options.enabled && options.available[m.method],
      hint: options.enabled && options.available[m.method] ? m.hint : t('Not available yet'),
    })),
  ];

  return (
    <Screen
      header={<Header title={title} />}
      footer={
        <Button
          title={
            method === 'wallet'
              ? t('Pay {amount} from wallet', { amount: formatRs(charge) })
              : charge > 0
                ? t('Pay {amount}', { amount: formatRs(charge) })
                : t('Pay')
          }
          flex
          disabled={!method || (method === 'wallet' ? !walletCovers : !options.enabled || !value)}
          onPress={pay}
        />
      }
    >
      {shopFee ? (
        // What's being paid, and what happens then.
        <Card style={styles.summary}>
          <AppText color={colors.textMuted}>{t('Amount to pay')}</AppText>
          <AppText variant="title">{formatRs(charge || shopFee)}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {t(
              "Your new shop's fee. Once it's paid, your shop is sent to Fazl for approval. If Fazl doesn't approve it, the money comes back to your Fazl wallet.",
            )}
          </AppText>
          {method !== 'wallet' && value > shopFee ? (
            <AppText variant="caption" color={colors.textMuted}>
              {t('The smallest payment is {min}. What is left after the fee stays in your Fazl wallet.', {
                min: formatRs(options.min),
              })}
            </AppText>
          ) : null}
        </Card>
      ) : (
        <>
          <AppText color={colors.textMuted} style={styles.intro}>
            {t('The money goes into your Fazl wallet, and Fazl takes the fee for another shop from it.')}
          </AppText>
          {!options.enabled ? (
            <AppText variant="label" color={colors.danger} style={styles.intro}>
              {t('Adding money is paused for now. Please try again later.')}
            </AppText>
          ) : null}

          {options.presets.length ? (
            <View style={styles.chips}>
              {options.presets.map(p => {
                const on = value === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => {
                      setAmount(String(p));
                      setError(null);
                    }}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <AppText variant="label" color={on ? colors.white : colors.text}>
                      {formatRs(p)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <TextField
            label={t('Amount')}
            prefix={t('Rs')}
            value={amount}
            onChangeText={v => {
              setAmount(v.replace(/[^0-9]/g, ''));
              setError(null);
            }}
            keyboardType="number-pad"
            placeholder={String(options.min)}
            hint={
              needed
                ? t('You need {amount} more for your new shop.', { amount: formatRs(needed) })
                : t('From {min} to {max}', { min: formatRs(options.min), max: formatRs(options.max) })
            }
          />
        </>
      )}

      <SectionHeader title={t('Pay with')} />
      <Card padded={false}>
        {rows.map((row, i) => {
          const chosen = row.key === method;
          return (
            <Pressable
              key={row.key}
              disabled={!row.available}
              onPress={() => {
                setMethod(row.key);
                setError(null);
              }}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.border,
                !row.available && styles.off,
                pressed && styles.pressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen, disabled: !row.available }}
            >
              <IconCircle icon={row.icon} tone="primary" size={36} />
              <View style={styles.flex}>
                <AppText variant="bodyBold">{row.label}</AppText>
                <AppText variant="caption" color={row.warn ? colors.danger : colors.textMuted}>
                  {row.hint}
                </AppText>
              </View>
              <View style={[styles.radio, chosen && styles.radioOn]}>
                {chosen ? <Check size={14} color={colors.white} /> : null}
              </View>
            </Pressable>
          );
        })}
      </Card>

      {isMobile ? (
        <View style={styles.fields}>
          <TextField
            label={t('{name} mobile number', { name: method === 'jazzcash' ? 'JazzCash' : 'Easypaisa' })}
            value={mobile}
            onChangeText={v => {
              setMobile(v.replace(/[^0-9+]/g, ''));
              setError(null);
            }}
            keyboardType="phone-pad"
            maxLength={13}
            placeholder="03001234567"
          />
          {method === 'jazzcash' ? (
            <TextField
              label={t('Last 6 digits of CNIC')}
              value={cnic}
              onChangeText={v => {
                setCnic(v.replace(/\D/g, ''));
                setError(null);
              }}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              hint={t('Of the CNIC the JazzCash account is registered on')}
            />
          ) : null}
        </View>
      ) : null}

      {error ? (
        <AppText variant="label" color={colors.danger} style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    intro: { marginBottom: spacing.lg },
    summary: { gap: spacing.xs, marginBottom: spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
    border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    off: { opacity: 0.5 },
    pressed: { opacity: 0.7 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    fields: { marginTop: spacing.lg },
    error: { marginTop: spacing.md },
    waiting: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl },
    stretch: { alignSelf: 'stretch' },
    cardSheet: { flex: 1, backgroundColor: colors.surface },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    webLoading: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
  }),
);
