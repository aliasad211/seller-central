import type { LatLng } from '../api/shopSetup';

export const ACCOUNT_ROLES = ['user', 'service_provider', 'business_owner'] as const;
export type AccountRole = typeof ACCOUNT_ROLES[number];
export interface AccountDetails {
  name: string;
  phone: string;
  city: string;
  area: string;
  at: LatLng;
  roles: AccountRole[];
  referralCode?: string;
  image?: { uri: string; type: string; name: string };
}

export function pakistanPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0092')) digits = digits.slice(4);
  else if (digits.startsWith('92')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return `+92${digits}`;
}

export function hasAccountLocation(location?: { coordinates?: unknown } | null): boolean {
  const c = location?.coordinates;
  return Array.isArray(c) && c.length === 2 && c.every(n => typeof n === 'number' && Number.isFinite(n)) &&
    Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90 && (c[0] !== 0 || c[1] !== 0);
}

export function needsAccountDetails(user: { name?: string | null; phone?: string | null; roles?: string[] | null; location?: { coordinates?: unknown } | null }): boolean {
  return !user.name?.trim() || !user.phone?.trim() || !hasAccountLocation(user.location) ||
    !user.roles?.some(role => (ACCOUNT_ROLES as readonly string[]).includes(role));
}

export function accountDetailsErrors(draft: AccountDetails): Partial<Record<'name' | 'phone' | 'city' | 'area' | 'roles', string>> {
  const errors: ReturnType<typeof accountDetailsErrors> = {};
  if (draft.name.trim().length < 2) errors.name = 'Enter your full name';
  if (!/^\+923\d{9}$/.test(pakistanPhone(draft.phone))) errors.phone = 'Enter a valid Pakistani mobile number';
  if (!draft.city.trim() || !hasAccountLocation({ coordinates: [draft.at.lng, draft.at.lat] })) errors.city = 'Choose a city with a location';
  if (!draft.area.trim()) errors.area = 'Choose your area';
  if (!draft.roles.length || draft.roles.some(role => !ACCOUNT_ROLES.includes(role))) errors.roles = 'Choose your account type';
  return errors;
}
