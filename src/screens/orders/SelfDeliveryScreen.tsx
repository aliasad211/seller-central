import { Bike, Info, User } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { startSelfDelivery } from '../../api';
import { listTeamRiders } from '../../api/team';
import { AppText, Button, Card, Header, ListRow, Screen, StateView } from '../../components';
import { useLoad } from '../../hooks/useLoad';
import { RootScreenProps } from '../../navigation/types';
import { useAuth } from '../../state/AuthContext';
import { colors, spacing, themedStyles } from '../../theme';
import { t } from '../../i18n';

/**
 * A ready order going out with the shop delivering it itself: who takes it —
 * whoever is using the app, or one of the team's riders (the owner adds them
 * in More > Team). The customer sees "Out for delivery" either way.
 */
export function SelfDeliveryScreen({ route, navigation }: RootScreenProps<'SelfDelivery'>) {
  const { orderId } = route.params;
  const { seller } = useAuth();
  const shopId = seller?.shop?.id ?? '';
  const isOwner = !seller?.member;
  const { data: riders, error, reload } = useLoad(listTeamRiders);
  // The row being sent: 'me', or a rider's id.
  const [busy, setBusy] = useState<string | null>(null);

  const send = async (riderId?: string) => {
    setBusy(riderId ?? 'me');
    try {
      await startSelfDelivery(shopId, orderId, riderId);
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('Could not update the order'), e instanceof Error ? e.message : '');
      setBusy(null);
    }
  };

  const spinner = (key: string) =>
    busy === key ? <ActivityIndicator color={colors.primary} /> : undefined;

  return (
    <Screen header={<Header title={t('Who is delivering?')} />}>
      <Card padded={false} style={styles.group}>
        <ListRow
          icon={User}
          tone="primary"
          title={t("I'm delivering it myself")}
          subtitle={t('The order shows as "Out for delivery" to the customer.')}
          right={spinner('me')}
          onPress={busy ? undefined : () => send()}
        />
      </Card>

      <AppText variant="label" color={colors.textMuted} style={styles.groupTitle}>
        {t('Your riders').toUpperCase()}
      </AppText>
      {!riders ? (
        <StateView error={error} onRetry={reload} />
      ) : riders.length ? (
        <Card padded={false} style={styles.group}>
          {riders.map((rider, i) => (
            <ListRow
              key={rider.id}
              icon={Bike}
              tone="info"
              title={rider.name}
              subtitle={rider.phone ?? undefined}
              right={spinner(rider.id)}
              divider={i < riders.length - 1}
              onPress={busy ? undefined : () => send(rider.id)}
            />
          ))}
        </Card>
      ) : (
        <View style={styles.empty}>
          <View style={styles.note}>
            <Info size={16} color={colors.textMuted} />
            <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
              {isOwner
                ? t('No riders on your team yet. Add one in More > Team, as a Rider.')
                : t('No riders on the team yet. The shop owner adds them.')}
            </AppText>
          </View>
          {isOwner ? (
            <Button
              title={t('Add a rider')}
              variant="secondary"
              onPress={() => navigation.navigate('TeamMemberForm', { role: 'rider' })}
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    group: { paddingHorizontal: spacing.md },
    groupTitle: { marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.xs },
    empty: { gap: spacing.md },
    note: { flexDirection: 'row', gap: spacing.sm },
  }),
);
