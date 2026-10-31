import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, loadTokens, saveTokens } from '../src/api/http';
import { accountForm, createFazlAccount, deleteAccount, sendSignupCode, verifySignupCode, sendPhoneSignupCode, verifyPhoneSignupCode } from '../src/api/account';
import { completeOwnerProfile, loginAsMember, loginWithCode, loginWithGoogle, logout, requestLoginCode, restoreSession } from '../src/api/session';
import { AccountDetails, accountDetailsErrors, pakistanPhone } from '../src/utils/accountProfile';

jest.mock('../src/i18n', () => ({ language: 'en', isUrdu: false, t: (key: string) => key }));
jest.mock('../src/api/http', () => {
  class ApiError extends Error { status = 0; }
  return { api: jest.fn(), loadTokens: jest.fn(), saveTokens: jest.fn(), currentTokens: jest.fn(), ApiError };
});
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), getMany: jest.fn(async () => ({})), setItem: jest.fn(), setMany: jest.fn(), removeItem: jest.fn() },
}));

const request = api as jest.Mock;
const completeUser = { id: 'u1', name: 'Ali Khan', email: 'ali@example.com', phone: '+923001234567', address: 'Gulberg, Lahore', roles: ['user'], location: { type: 'Point' as const, coordinates: [74.3, 31.5] as [number, number] } };
const details: AccountDetails = { name: 'Ali Khan', phone: '03001234567', city: 'Lahore', area: 'Gulberg', at: { lng: 74.3, lat: 31.5 }, roles: ['business_owner'] };
const sessionReply = { accessToken: 'access', refreshToken: 'refresh', user: { ...completeUser, refreshToken: 'refresh' } };

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getMany as jest.Mock).mockResolvedValue({});
  request.mockImplementation(async (url: string) => {
    if (url === '/seller/session/verify' || url === '/seller/session/google') return sessionReply;
    if (url === '/users/detail/u1') return completeUser;
    if (url === '/shops/userShops') return [];
    return undefined;
  });
});

test('deleting closes the Seller Central account only, not the Fazl app’s', async () => {
  await deleteAccount();
  expect(request).toHaveBeenCalledWith('/seller/session/account', { method: 'DELETE' });
  expect(request.mock.calls.some(([url]) => url.includes('/deactivate'))).toBe(false);
});

test('the password only gets a code emailed; the code logs in, in a session of its own', async () => {
  request.mockResolvedValueOnce({ email: 'ali@example.com', expiresInSeconds: 600 });
  await expect(requestLoginCode(' ali@example.com ', 'secret12')).resolves.toBe('ali@example.com');
  expect(request).toHaveBeenLastCalledWith('/seller/session/login', { method: 'POST', body: { email: 'ali@example.com', password: 'secret12' }, auth: false });
  expect(saveTokens).not.toHaveBeenCalled();

  const seller = await loginWithCode('ali@example.com', ' 123456 ');
  expect(request).toHaveBeenCalledWith('/seller/session/verify', { method: 'POST', body: { email: 'ali@example.com', code: '123456' }, auth: false });
  expect(saveTokens).toHaveBeenCalledWith({ accessToken: 'access', refreshToken: 'refresh', seller: true });
  expect(seller.id).toBe('u1');
  // Never the Fazl app's login or session.
  expect(request.mock.calls.some(([url]) => url.startsWith('/auth/'))).toBe(false);
});

test('logging out ends the Seller Central session, never the Fazl app’s', async () => {
  const { currentTokens } = jest.requireMock('../src/api/http');
  currentTokens.mockReturnValue({ accessToken: 'access', refreshToken: 'refresh', seller: true });
  await logout();
  expect(request).toHaveBeenCalledWith('/seller/session/logout', { method: 'POST', body: { token: 'refresh' } });
  expect(request.mock.calls.some(([url]) => url === '/auth/logout')).toBe(false);
});

test('a saved owner login from before Seller Central had its own is dropped, without asking Fazl', async () => {
  (loadTokens as jest.Mock).mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ ...completeUser, shop: null, shops: [] }));
  await expect(restoreSession()).resolves.toBeNull();
  expect(saveTokens).toHaveBeenCalledWith(null);
  expect(request).not.toHaveBeenCalled();
});

test('email signup uses the same public Fazl verification and account endpoints', async () => {
  await sendSignupCode(' Ali@Example.com ');
  await verifySignupCode(' Ali@Example.com ', '123456');
  await createFazlAccount(' Ali@Example.com ', 'secret12', details);
  expect(request).toHaveBeenNthCalledWith(1, '/auth/send-email-verification', { method: 'POST', body: { email: 'ali@example.com' }, auth: false });
  expect(request).toHaveBeenNthCalledWith(2, '/auth/verify-email?token=123456&email=ali%40example.com', { auth: false });
  const [url, options] = request.mock.calls[2];
  expect(url).toBe('/users/createUser');
  expect(options.auth).toBe(false);
  const fields = Object.fromEntries(options.form.entries());
  expect(fields).toMatchObject({ email: 'ali@example.com', password: 'secret12', phone: '+923001234567', roles: 'business_owner', location: '{"type":"Point","coordinates":[74.3,31.5]}' });
});

test('a new Google account waits for profile completion without loading or opening shops', async () => {
  request.mockImplementation(async (url: string) => url === '/seller/session/google' ? sessionReply : { id: 'u1', name: 'Ali', email: 'ali@example.com', roles: [], phone: null, location: { coordinates: [0, 0] } });
  const seller = await loginWithGoogle('google-id-token');
  expect(request).toHaveBeenCalledWith('/seller/session/google', expect.objectContaining({ body: { idToken: 'google-id-token' }, auth: false }));
  expect(saveTokens).toHaveBeenCalledWith({ accessToken: 'access', refreshToken: 'refresh', seller: true });
  expect(seller).toMatchObject({ id: 'u1', needsProfileCompletion: true, shop: null, shops: [] });
  expect(request.mock.calls.some(([url]) => url === '/shops/userShops')).toBe(false);
});

test('account payload always uses business owner even if a caller supplies a personal role', () => {
  expect(accountForm({ ...details, roles: ['user', 'service_provider'] }).getAll('roles')).toEqual(['business_owner']);
});

test('phone signup uses real OTP endpoints and refuses unsuccessful verification responses', async () => {
  await sendPhoneSignupCode('03001234567');
  expect(request).toHaveBeenLastCalledWith('/auth/send-otp', expect.objectContaining({ body: { phoneNumber: '+923001234567' }, auth: false }));
  request.mockResolvedValueOnce({ isValid: false });
  await expect(verifyPhoneSignupCode('03001234567', '123456')).rejects.toThrow('Invalid or expired');
  request.mockResolvedValueOnce({ isValid: true });
  await expect(verifyPhoneSignupCode('03001234567', '123456')).resolves.toBeUndefined();
});

test('existing complete accounts use fresh profile data and open their shop', async () => {
  request.mockImplementation(async (url: string) => url === '/seller/session/verify' ? sessionReply : url === '/users/detail/u1' ? completeUser : [{ id: 's1', title: 'Ali Store' }]);
  const seller = await loginWithCode('ali@example.com', '123456');
  expect(seller.needsProfileCompletion).toBe(false);
  expect(seller.shop?.id).toBe('s1');
});

test('saving the profile updates the same user, then loads shops only after authoritative completion', async () => {
  const pending = { ...completeUser, location: undefined, roles: [], needsProfileCompletion: true, shop: null, shops: [] };
  const next = await completeOwnerProfile(pending, details);
  expect(request).toHaveBeenCalledWith('/users/u1', expect.objectContaining({ method: 'PUT', form: expect.any(FormData) }));
  expect(request.mock.calls[0][1].form.getAll('roles')).toEqual(['business_owner']);
  expect(next.needsProfileCompletion).toBe(false);
  expect(request.mock.calls.map(([url]) => url)).toEqual(['/users/u1', '/users/detail/u1', '/shops/userShops']);
});

test('a failed profile save leaves the completion gate in place and does not open shops', async () => {
  request.mockRejectedValueOnce(new Error('Phone already registered'));
  await expect(completeOwnerProfile({ ...completeUser, needsProfileCompletion: true, shop: null, shops: [] }, details)).rejects.toThrow('Phone already registered');
  expect(request).toHaveBeenCalledTimes(1);
});

test('restarting rechecks an incomplete shared account before showing shop tools', async () => {
  (loadTokens as jest.Mock).mockResolvedValue({ accessToken: 'access', seller: true });
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ ...completeUser, shop: null, shops: [], needsProfileCompletion: true }));
  request.mockResolvedValueOnce({ ...completeUser, phone: null });
  const seller = await restoreSession();
  expect(seller?.needsProfileCompletion).toBe(true);
  expect(request.mock.calls.map(([url]) => url)).toEqual(['/users/detail/u1']);
});

test('team members continue through their own session endpoint without owner-profile signup', async () => {
  request.mockImplementation(async (url: string) => url === '/seller/members/session/login' ? { accessToken: 'member-access', refreshToken: 'member-refresh', member: { id: 'm1', ownerId: 'u1', name: 'Team Member', email: 'member@example.com', permissions: ['orders'] } } : []);
  const seller = await loginAsMember('member@example.com', 'secret12');
  expect(seller.member?.id).toBe('m1');
  expect(seller.needsProfileCompletion).toBeUndefined();
  expect(request.mock.calls.some(([url]) => url.startsWith('/users/'))).toBe(false);
});

test.each(['03001234567', '+923001234567', '00923001234567', '3001234567'])('normalizes Pakistani mobile format %s consistently', phone => expect(pakistanPhone(phone)).toBe('+923001234567'));
test('rejects foreign/invalid phones and a missing city point before creating any account', async () => {
  expect(accountDetailsErrors({ ...details, phone: '+14155552671', at: { lat: 0, lng: 0 } })).toMatchObject({ phone: expect.any(String), city: expect.any(String) });
  await expect(createFazlAccount('ali@example.com', 'secret12', { ...details, phone: '123' })).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
