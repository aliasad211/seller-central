import { Info, Plus, Users } from 'lucide-react-native';
import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { listTeam } from '../../api/team';
import { AppText, Badge, Card, EmptyState, Header, Screen, StateView } from '../../components';
import { ChevronForward } from '../../components/Chevrons';
import { useLoad } from '../../hooks/useLoad';
import { RootScreenProps } from '../../navigation/types';
import { colors, spacing, themedStyles, Tone } from '../../theme';
import { SellerMemberPermission, TeamMemberRole, TeamMemberStatus } from '../../types/models';
import { t } from '../../i18n';

export const ROLE_LABELS: Record<TeamMemberRole, string> = {
  manager: t('Manager'),
  rider: t('Rider'),
};

export const PERMISSION_LABELS: Record<SellerMemberPermission, string> = {
  orders: t('Orders'),
  products: t('Products'),
  marketing: t('Posts & ads'),
};

export const STATUS_BADGES: Record<TeamMemberStatus, { label: string; tone: Tone }> = {
  active: { label: t('Active'), tone: 'success' },
  invited: { label: t('Invite sent'), tone: 'warning' },
  expired: { label: t('Invite expired'), tone: 'danger' },
  disabled: { label: t('Paused'), tone: 'neutral' },
};

/**
 * The owner's team: people who log in to Seller Central as Team Members and
 * work on the owner's shops with the permissions the owner gave them.
 */
export function TeamScreen({ navigation }: RootScreenProps<'Team'>) {
  const { data, error, reload, refresh, refreshing } = useLoad(listTeam);
  const invite = () => navigation.navigate('TeamMemberForm');

  return (
    <Screen
      header={
        <Header
          title={t('Team')}
          right={
            <Pressable onPress={invite} style={styles.add} accessibilityLabel={t('Invite someone')}>
              <Plus size={22} color={colors.white} />
            </Pressable>
          }
        />
      }
      scroll={false}
      padded={false}
    >
      {!data ? (
        <StateView error={error} onRetry={reload} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />
          }
          ListHeaderComponent={
            <View style={styles.note}>
              <Info size={16} color={colors.textMuted} />
              <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
                {t(
                  'Team members log in on the Team Member tab with their own email. They work on all your shops, only with what you allow. Earnings, the business profile and the team stay with you.',
                )}
              </AppText>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon={Users}
              title={t('No one on your team yet')}
              message={t('Invite people to help with orders, products or ads. We email them a code to join.')}
              actionLabel={t('Invite someone')}
              onAction={invite}
            />
          }
          renderItem={({ item }) => {
            const badge = STATUS_BADGES[item.status];
            return (
              <Card onPress={() => navigation.navigate('TeamMemberForm', { member: item })} style={styles.card}>
                <View style={styles.flex}>
                  <AppText variant="subheading" numberOfLines={1}>
                    {item.name}
                  </AppText>
                  <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
                    {item.email}
                  </AppText>
                  <AppText variant="caption" color={colors.primary} numberOfLines={1}>
                    {item.role === 'rider'
                      ? [ROLE_LABELS.rider, item.phone].filter(Boolean).join(' · ')
                      : [ROLE_LABELS.manager, ...item.permissions.map(p => PERMISSION_LABELS[p])].join(' · ')}
                  </AppText>
                </View>
                <Badge label={badge.label} tone={badge.tone} />
                <ChevronForward size={20} color={colors.textSubtle} />
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    add: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: { padding: spacing.lg, gap: spacing.md },
    note: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
    card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  }),
);
