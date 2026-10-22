import React, { useRef, useState } from 'react';
import { I18nManager, StyleSheet, TextInput, TextInputInstance, View } from 'react-native';
import { colors, fonts, themedStyles } from '../theme';
import { AppText } from './AppText';

/**
 * A one-time code typed into a row of boxes, a digit in each. One field over
 * the boxes, unseen, takes the typing — and the code the phone offers from the
 * SMS or email — and the boxes show it. Always left to right, Urdu included:
 * a code is read in the order it was sent. `onComplete` once every box is full.
 */
export function CodeBoxes({
  value,
  onChange,
  onComplete,
  length = 6,
  label,
  autoFocus,
  editable = true,
  error = false,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  label: string;
  autoFocus?: boolean;
  editable?: boolean;
  error?: boolean;
}) {
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.split('');

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, I18nManager.isRTL && styles.leftToRight]}>
        {Array.from({ length }, (_, i) => {
          // The box the next digit goes in (the last one once all are in).
          const current = focused && i === Math.min(digits.length, length - 1);
          return (
            <View
              key={i}
              style={[
                styles.box,
                digits[i] ? styles.filled : null,
                current ? styles.current : null,
                error ? styles.error : null,
              ]}
            >
              <AppText style={styles.digit} allowFontScaling={false}>
                {digits[i] ?? ''}
              </AppText>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={text => {
          const code = text.replace(/\D/g, '').slice(0, length);
          onChange(code);
          if (code.length === length) onComplete?.(code);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus={autoFocus}
        editable={editable}
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        style={styles.input}
      />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    wrap: { marginBottom: 20 },
    row: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
    // Under right-to-left, a row runs right to left; a code doesn't.
    leftToRight: { flexDirection: 'row-reverse' },
    box: {
      flex: 1,
      maxWidth: 52,
      height: 58,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filled: { borderColor: colors.primary, backgroundColor: colors.surface },
    current: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
    error: { borderColor: colors.danger },
    digit: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
    // Over the boxes, so a tap anywhere on them brings up the keyboard.
    input: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: 'transparent' },
  }),
);
