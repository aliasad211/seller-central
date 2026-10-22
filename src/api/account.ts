import { language, t } from '../i18n';
import { AccountDetails, accountDetailsErrors, pakistanPhone } from '../utils/accountProfile';
import { api } from './http';

export async function sendSignupCode(email: string): Promise<void> {
  await api('/auth/send-email-verification', { method: 'POST', body: { email: email.trim().toLowerCase() }, auth: false });
}

export async function verifySignupCode(email: string, code: string): Promise<void> {
  await api(`/auth/verify-email?token=${encodeURIComponent(code.trim())}&email=${encodeURIComponent(email.trim().toLowerCase())}`, { auth: false });
}

export function accountForm(details: AccountDetails): FormData {
  const errors = accountDetailsErrors(details);
  const first = Object.values(errors)[0];
  if (first) throw new Error(t(first));
  const form = new FormData();
  form.append('name', details.name.trim());
  form.append('phone', pakistanPhone(details.phone));
  form.append('address', `${details.area.trim()}, ${details.city.trim()}`);
  form.append('location', JSON.stringify({ type: 'Point', coordinates: [details.at.lng, details.at.lat] }));
  // Seller Central creates and completes business owner accounts only.
  form.append('roles', 'business_owner');
  if (details.image) form.append('image', details.image as unknown as Blob);
  form.append('language', language);
  return form;
}

export async function sendPhoneSignupCode(phone: string): Promise<void> {
  await api('/auth/send-otp', { method: 'POST', body: { phoneNumber: pakistanPhone(phone) }, auth: false });
}

export async function verifyPhoneSignupCode(phone: string, code: string): Promise<void> {
  const result = await api<{ isValid: boolean }>('/auth/verify-otp', {
    method: 'POST', body: { phoneNumber: pakistanPhone(phone), code: code.trim() }, auth: false,
  });
  if (result?.isValid !== true) throw new Error(t('Invalid or expired verification code'));
}

export function validSignupPassword(password: string): boolean {
  return password.length >= 8 && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) && !password.includes(' ');
}

/**
 * Deletes the owner's Fazl account — the one shared with the Fazl app — the
 * way the Fazl app's Settings does: the account, its shops and its listings are
 * taken off Fazl. A team member's session can't (the backend refuses it).
 */
export async function deleteAccount(userId: string): Promise<void> {
  await api(`/users/${encodeURIComponent(userId)}/deactivate`, { method: 'DELETE' });
}

/** Same account and endpoint as the Fazl app, followed by a normal app login. */
export async function createFazlAccount(email: string, password: string, details: AccountDetails): Promise<void> {
  const form = accountForm(details);
  form.append('email', email.trim().toLowerCase());
  form.append('password', password);
  form.append('provider', 'local');
  form.append('isVerified', 'true');
  if (details.referralCode?.trim()) form.append('referralCode', details.referralCode.trim());
  await api('/users/createUser', { method: 'POST', form, auth: false });
}
