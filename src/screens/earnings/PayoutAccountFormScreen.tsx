import { Info } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { addPayoutAccount, PayoutMethod } from '../../api/payouts';
import {
  AppText,
  Button,
  Card,
  Header,
  Screen,
  Segmented,
  TextField,
  ToggleRow,
} from '../../components';
import { RootScreenProps } from '../../navigation/types';
import { colors, spacing, themedStyles } from '../../theme';
import { t } from '../../i18n';
import { METHOD_LABELS } from './PayoutsScreen';

/**
 * Adding an account withdrawals are sent to: a bank account (title, bank,
 * account number, IBAN if they have it), or a JazzCash / Easypaisa account
 * (title and its mobile number).
 */
export function PayoutAccountFormScreen({ navigation }: RootScreenProps<'PayoutAccountForm'>) {
  const [method, setMethod] = useState<PayoutMethod>('bank_transfer');
  const [accountTitle, setAccountTitle] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [iban, setIban] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const isBank = method === 'bank_transfer';

  const clear = (field: string) => setErrors(e => ({ ...e, [field]: undefined }));

  const save = async () => {
    const next: Record<string, string> = {};
    if (!accountTitle.trim()) next.accountTitle = t('Required');
    if (isBank && !bankName.trim()) next.bankName = t('Required');
    if (isBank && accountNumber.replace(/\s/g, '').length < 6) next.accountNumber = t('Enter the account number');
    if (!isBank && !/^0?3\d{9}$/.test(accountNumber.replace(/\D/g, ''))) {
      next.accountNumber = t('Enter the 11-digit mobile number, e.g. 03001234567');
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await addPayoutAccount({
        method,
        accountTitle: accountTitle.trim(),
        accountNumber: accountNumber.trim(),
        ...(isBank ? { bankName: bankName.trim(), ...(iban.trim() ? { iban: iban.trim() } : {}) } : {}),
        isDefault,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('Could not save'), e instanceof Error ? e.message : '');
      setSaving(false);
    }
  };

  return (
    <Screen
      header={<Header title={t('Add account')} />}
      footer={
        <Button
          title={t('Save account')}
          flex
          loading={saving}
          loadingText={t('Saving')}
          disabled={saving}
          onPress={save}
        />
      }
    >
      <View style={styles.method}>
        <Segmented
          options={[
            { key: 'bank_transfer', label: t('Bank') },
            { key: 'jazzcash', label: METHOD_LABELS.jazzcash },
            { key: 'easypaisa', label: METHOD_LABELS.easypaisa },
          ]}
          value={method}
          onChange={next => {
            setMethod(next);
            setAccountNumber('');
            setErrors({});
          }}
        />
      </View>

      <TextField
        label={t('Account title')}
        value={accountTitle}
        onChangeText={v => {
          setAccountTitle(v);
          clear('accountTitle');
        }}
        autoCapitalize="words"
        maxLength={80}
        placeholder={t('e.g. Ali Khan')}
        hint={t('The name the account is in')}
        error={errors.accountTitle}
      />

      {isBank ? (
        <>
          <TextField
            label={t('Bank name')}
            value={bankName}
            onChangeText={v => {
              setBankName(v);
              clear('bankName');
            }}
            maxLength={80}
            placeholder={t('e.g. Meezan Bank')}
            error={errors.bankName}
          />
          <TextField
            label={t('Account number')}
            value={accountNumber}
            onChangeText={v => {
              setAccountNumber(v);
              clear('accountNumber');
            }}
            autoCapitalize="none"
            maxLength={34}
            error={errors.accountNumber}
          />
          <TextField
            label={t('IBAN (optional)')}
            value={iban}
            onChangeText={setIban}
            autoCapitalize="characters"
            maxLength={34}
            placeholder="PK36MEZN0001230123456789"
          />
        </>
      ) : (
        <TextField
          label={t('{name} mobile number', { name: METHOD_LABELS[method] })}
          value={accountNumber}
          onChangeText={v => {
            setAccountNumber(v.replace(/[^0-9]/g, ''));
            clear('accountNumber');
          }}
          keyboardType="phone-pad"
          maxLength={11}
          placeholder="03001234567"
          error={errors.accountNumber}
        />
      )}

      <Card padded={false} style={styles.group}>
        <ToggleRow
          label={t('Make this my default')}
          description={t('Offered first when you withdraw')}
          value={isDefault}
          onChange={setIsDefault}
        />
      </Card>

      <View style={styles.note}>
        <Info size={16} color={colors.textMuted} />
        <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
          {t('Check the details: Fazl sends your money to exactly this account. The account should be in your own name.')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    method: { marginBottom: spacing.lg },
    group: { paddingHorizontal: spacing.md },
    note: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  }),
);
