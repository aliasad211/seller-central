import { Info } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import {
  Invite,
  inviteTeamMember,
  removeTeamMember,
  resendTeamInvite,
  updateTeamMember,
} from '../../api/team';
import {
  AppText,
  Badge,
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
import { SellerMemberPermission, TeamMemberRole } from '../../types/models';
import { t } from '../../i18n';
import { ROLE_LABELS, STATUS_BADGES } from './TeamScreen';

const PERMISSIONS: { key: SellerMemberPermission; label: string; description: string }[] = [
  { key: 'orders', label: t('Orders'), description: t('Orders, returns and delivery') },
  { key: 'products', label: t('Products'), description: t('Products, inventory and pricing') },
  { key: 'marketing', label: t('Posts & ads'), description: t('Videos and advertisement campaigns') },
];

/**
 * Inviting someone to the owner's team (name, email, manager or rider, what
 * a manager may do, a rider's phone), or changing a member: their role and
 * permissions, pausing them, a new invite code, or taking them off the team.
 */
export function TeamMemberFormScreen({ navigation, route }: RootScreenProps<'TeamMemberForm'>) {
  const member = route.params?.member;
  const [name, setName] = useState(member?.name ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [role, setRole] = useState<TeamMemberRole>(
    member?.role ?? route.params?.role ?? 'manager',
  );
  const [phone, setPhone] = useState(member?.phone ?? '');
  const [permissions, setPermissions] = useState<SellerMemberPermission[]>(
    // A rider being made a manager starts from orders, as a rider has.
    member?.permissions?.length ? member.permissions : ['orders'],
  );
  const [paused, setPaused] = useState(member?.status === 'disabled');
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    permissions?: string;
  }>({});
  const isRider = role === 'rider';
  const [busy, setBusy] = useState<'save' | 'resend' | 'remove' | null>(null);
  const joined = member?.status === 'active' || (member?.status === 'disabled' && !!member.joinedAt);

  const toggle = (key: SellerMemberPermission) => (on: boolean) => {
    setPermissions(p => (on ? [...p, key] : p.filter(x => x !== key)));
    setErrors(e => ({ ...e, permissions: undefined }));
  };

  /** The code to pass on, by WhatsApp or however the owner likes. */
  const showCode = ({ member: invited, inviteCode }: Invite, title: string) =>
    Alert.alert(
      title,
      t('We emailed {name} a code to join: {code}. It works for 7 days. You can also send it to them yourself.', {
        name: invited.name,
        code: inviteCode,
      }),
      [
        {
          text: t('Share code'),
          onPress: () => {
            Share.share({
              message: t(
                'You are invited to my team on Fazl Seller Central. Your invite code is {code}. Open Seller Central, choose Team Member, tap "Got an invite code? Join your team" and use the email {email}.',
                { code: inviteCode, email: invited.email },
              ),
            }).finally(() => navigation.goBack());
          },
        },
        { text: t('Done'), onPress: () => navigation.goBack() },
      ],
    );

  const save = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('Required');
    if (!member && !/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t('Enter a valid email');
    if (isRider && !/^\+?[\d\s-]{7,20}$/.test(phone.trim())) next.phone = t('Enter a valid phone number');
    if (!isRider && permissions.length === 0) next.permissions = t('Choose at least one');
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    // A rider's permissions are set by Fazl (orders); a manager's phone is optional.
    const access = isRider
      ? { role, phone: phone.trim() }
      : { role, permissions, ...(phone.trim() ? { phone: phone.trim() } : {}) };

    setBusy('save');
    try {
      if (member) {
        await updateTeamMember(member.id, {
          name: name.trim(),
          ...access,
          isDisabled: paused,
        });
        navigation.goBack();
      } else {
        const invite = await inviteTeamMember({
          name: name.trim(),
          email: email.trim(),
          ...access,
        });
        showCode(invite, t('Invite sent'));
      }
    } catch (e) {
      Alert.alert(t('Could not save'), e instanceof Error ? e.message : '');
    } finally {
      setBusy(null);
    }
  };

  const resend = async () => {
    if (!member) return;
    setBusy('resend');
    try {
      showCode(await resendTeamInvite(member.id), t('New invite sent'));
    } catch (e) {
      Alert.alert(t('Could not send'), e instanceof Error ? e.message : '');
    } finally {
      setBusy(null);
    }
  };

  const remove = () => {
    if (!member) return;
    Alert.alert(
      t('Remove {name}?', { name: member.name }),
      t("They won't be able to log in to Seller Central any more."),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: async () => {
            setBusy('remove');
            try {
              await removeTeamMember(member.id);
              navigation.goBack();
            } catch (e) {
              Alert.alert(t('Could not remove'), e instanceof Error ? e.message : '');
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const badge = member ? STATUS_BADGES[member.status] : null;

  return (
    <Screen
      header={<Header title={member ? t('Team member') : t('Invite to team')} />}
      footer={
        <Button
          title={member ? t('Save changes') : t('Send invite')}
          flex
          loading={busy === 'save'}
          loadingText={member ? t('Saving') : t('Sending')}
          disabled={busy !== null}
          onPress={save}
        />
      }
    >
      {badge ? (
        <View style={styles.status}>
          <Badge label={badge.label} tone={badge.tone} />
        </View>
      ) : null}

      <AppText variant="label" color={colors.textMuted} style={styles.groupTitle}>
        {t('Role').toUpperCase()}
      </AppText>
      <View style={styles.role}>
        <Segmented
          options={[
            { key: 'manager', label: ROLE_LABELS.manager },
            { key: 'rider', label: ROLE_LABELS.rider },
          ]}
          value={role}
          onChange={next => {
            setRole(next);
            setErrors(e => ({ ...e, phone: undefined, permissions: undefined }));
          }}
        />
      </View>

      <TextField
        label={t('Name')}
        value={name}
        onChangeText={v => {
          setName(v);
          setErrors(e => ({ ...e, name: undefined }));
        }}
        maxLength={80}
        autoCapitalize="words"
        placeholder={t('e.g. Ali Khan')}
        error={errors.name}
      />
      <TextField
        label={t('Email')}
        value={email}
        onChangeText={v => {
          setEmail(v);
          setErrors(e => ({ ...e, email: undefined }));
        }}
        editable={!member}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder={t('you@example.com')}
        hint={member ? undefined : t('We email them a 6-digit code to join with.')}
        error={errors.email}
      />

      {isRider ? (
        <>
          <TextField
            label={t('Phone number')}
            value={phone}
            onChangeText={v => {
              setPhone(v);
              setErrors(e => ({ ...e, phone: undefined }));
            }}
            keyboardType="phone-pad"
            maxLength={20}
            placeholder="0300 1234567"
            hint={t('You and your managers call the rider on this number about a delivery.')}
            error={errors.phone}
          />
          <View style={styles.note}>
            <Info size={16} color={colors.textMuted} />
            <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
              {t(
                'Riders deliver the orders you deliver yourself. When an order goes out, you or a manager pick the rider. A rider can log in to see and update orders only.',
              )}
            </AppText>
          </View>
        </>
      ) : (
        <>
          <AppText variant="label" color={colors.textMuted} style={styles.groupTitle}>
            {t('What they can do').toUpperCase()}
          </AppText>
          <Card padded={false} style={styles.group}>
            {PERMISSIONS.map((p, i) => (
              <ToggleRow
                key={p.key}
                label={p.label}
                description={p.description}
                value={permissions.includes(p.key)}
                onChange={toggle(p.key)}
                divider={i < PERMISSIONS.length - 1}
              />
            ))}
          </Card>
          {errors.permissions ? (
            <AppText variant="caption" color={colors.danger} style={styles.permError}>
              {errors.permissions}
            </AppText>
          ) : null}
        </>
      )}

      {member ? (
        <>
          <Card padded={false} style={[styles.group, styles.spaced]}>
            <ToggleRow
              label={t('Pause access')}
              description={t("While paused they can't log in. Turn it off to let them back in.")}
              value={paused}
              onChange={setPaused}
            />
          </Card>

          {!joined ? (
            <Button
              title={t('Send invite again')}
              variant="secondary"
              loading={busy === 'resend'}
              loadingText={t('Sending')}
              disabled={busy !== null}
              onPress={resend}
              style={styles.spaced}
            />
          ) : null}
          <Button
            title={t('Remove from team')}
            variant="danger"
            loading={busy === 'remove'}
            loadingText={t('Removing')}
            disabled={busy !== null}
            onPress={remove}
            style={styles.spaced}
          />
        </>
      ) : (
        <View style={[styles.note, styles.spaced]}>
          <Info size={16} color={colors.textMuted} />
          <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
            {t(
              'They log in to Seller Central only, on all your shops. Earnings, the business profile and the team stay with you.',
            )}
          </AppText>
        </View>
      )}
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    status: { marginBottom: spacing.md },
    role: { marginBottom: spacing.lg },
    groupTitle: { marginBottom: spacing.sm, marginLeft: spacing.xs },
    group: { paddingHorizontal: spacing.md },
    permError: { marginTop: spacing.xs, marginLeft: spacing.xs },
    spaced: { marginTop: spacing.lg },
    note: { flexDirection: 'row', gap: spacing.sm },
  }),
);
