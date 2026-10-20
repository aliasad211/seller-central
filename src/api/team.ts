// The shop owner's team (More > Team): managers and riders invited by email
// with a 6-digit code, who then log in as Team Members with the permissions
// the owner gave (a rider: orders only). Only the owner's own login can manage
// it; the riders list is also for a manager with orders, to pick who delivers.
import { SellerMemberPermission, TeamMember, TeamMemberRole, TeamRider } from '../types/models';
import { api } from './http';

/** The invited member, and the code they join with (also emailed to them). */
export interface Invite {
  member: TeamMember;
  inviteCode: string;
}

export function listTeam(): Promise<TeamMember[]> {
  return api<TeamMember[]>('/seller/members');
}

/** The team's riders who aren't paused, for an order going out for self delivery. */
export function listTeamRiders(): Promise<TeamRider[]> {
  return api<TeamRider[]>('/seller/members/riders');
}

export function inviteTeamMember(draft: {
  name: string;
  email: string;
  role: TeamMemberRole;
  /** A rider's (required for one). */
  phone?: string;
  /** A manager's; a rider's are always orders. */
  permissions?: SellerMemberPermission[];
}): Promise<Invite> {
  return api<Invite>('/seller/members', { method: 'POST', body: draft });
}

export function resendTeamInvite(memberId: string): Promise<Invite> {
  return api<Invite>(`/seller/members/${memberId}/resend-invite`, { method: 'POST' });
}

export function updateTeamMember(
  memberId: string,
  changes: {
    name?: string;
    role?: TeamMemberRole;
    phone?: string;
    permissions?: SellerMemberPermission[];
    isDisabled?: boolean;
  },
): Promise<TeamMember> {
  return api<TeamMember>(`/seller/members/${memberId}`, { method: 'PATCH', body: changes });
}

export function removeTeamMember(memberId: string): Promise<void> {
  return api<void>(`/seller/members/${memberId}`, { method: 'DELETE' });
}
