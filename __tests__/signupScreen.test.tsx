import React from 'react';
import { TextInput } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { SignupScreen } from '../src/screens/auth/SignupScreen';
import { createFazlAccount, sendSignupCode, verifySignupCode, sendPhoneSignupCode, verifyPhoneSignupCode } from '../src/api/account';
import { useAuth } from '../src/state/AuthContext';

jest.mock('../src/i18n', () => ({ t: (text: string) => text, isUrdu: false, language: 'en', setLanguage: jest.fn() }));
// Icons draw nothing here (the package ships ES modules Jest doesn't load).
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../src/api/http', () => ({ api: jest.fn() }));
jest.mock('../src/api/account', () => ({ ...jest.requireActual('../src/api/account'), createFazlAccount: jest.fn(), sendSignupCode: jest.fn(), verifySignupCode: jest.fn(), sendPhoneSignupCode: jest.fn(), verifyPhoneSignupCode: jest.fn() }));
jest.mock('../src/state/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../src/components', () => {
  const React = require('react');
  const { Text, View, TextInput, Pressable } = require('react-native');
  return {
    Screen: ({ children }: any) => React.createElement(View, null, children),
    Header: () => null,
    IconCircle: () => null,
    AppText: ({ children }: any) => React.createElement(Text, null, children),
    // The code boxes' one field, by its label; completing it is left to "Verify".
    CodeBoxes: ({ label, onChange, value }: any) => React.createElement(TextInput, { accessibilityLabel: label, value, onChangeText: onChange }),
    OutlinedField: ({ label, ...props }: any) => React.createElement(TextInput, { accessibilityLabel: label, ...props }),
    DoodleButton: ({ title, onPress, disabled }: any) => React.createElement(Pressable, { testID: title, onPress, disabled }, React.createElement(Text, null, title)),
  };
});
jest.mock('../src/screens/auth/AccountDetailsForm', () => {
  const React = require('react');
  const { View, Pressable } = require('react-native');
  return { AccountDetailsForm: ({ children, onSubmit }: any) => React.createElement(View, null, children,
    React.createElement(Pressable, { testID: 'submit-details', onPress: () => onSubmit({ name: 'Ali', phone: '03001234567', city: 'Lahore', area: 'Gulberg', at: { lat: 31.5, lng: 74.3 }, roles: ['user'] }) })) };
});

let tree: Renderer.ReactTestRenderer;
const signIn = jest.fn();
const signInWithGoogle = jest.fn();
beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (useAuth as jest.Mock).mockReturnValue({ signIn, signInWithGoogle });
  (sendSignupCode as jest.Mock).mockResolvedValue(undefined);
  (verifySignupCode as jest.Mock).mockResolvedValue(undefined);
  (sendPhoneSignupCode as jest.Mock).mockResolvedValue(undefined);
  (verifyPhoneSignupCode as jest.Mock).mockResolvedValue(undefined);
  (createFazlAccount as jest.Mock).mockResolvedValue(undefined);
  signIn.mockResolvedValue(undefined);
  await act(async () => { tree = Renderer.create(<SignupScreen navigation={{ goBack: jest.fn() } as any} route={{} as any} />); });
});
afterEach(async () => { await act(async () => tree.unmount()); jest.useRealTimers(); });
const input = async (label: string, value: string) => { await act(async () => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === label)!.props.onChangeText(value)); };
const press = async (id: string) => { await act(async () => tree.root.findByProps({ testID: id }).props.onPress()); };

async function verifiedDetails() {
  await input('Email Address', 'ali@example.com');
  await press('Continue with email');
  await input('Verification code', '123456');
  await press('Verify email');
  await input('Choose a password', 'secret12!');
  await input('Confirm password', 'secret12!');
  await press('Continue');
}

test('signs in the shared account only after email verification and successful account creation', async () => {
  expect(tree.root.findAllByProps({ testID: 'submit-details' })).toHaveLength(0);
  await verifiedDetails();
  expect(verifySignupCode).toHaveBeenCalledWith('ali@example.com', '123456');
  expect(createFazlAccount).not.toHaveBeenCalled();
  await press('submit-details');
  expect(createFazlAccount).toHaveBeenCalledWith('ali@example.com', 'secret12!', expect.objectContaining({ roles: ['business_owner'] }));
  expect(signIn).toHaveBeenCalledWith('ali@example.com', 'secret12!');
});

test('a rejected verification code cannot advance into account creation', async () => {
  (verifySignupCode as jest.Mock).mockRejectedValueOnce(new Error('Invalid code'));
  await input('Email Address', 'ali@example.com'); await press('Continue with email');
  await input('Verification code', '123456'); await press('Verify email');
  expect(tree.root.findAllByProps({ testID: 'submit-details' })).toHaveLength(0);
  expect(createFazlAccount).not.toHaveBeenCalled();
  expect(signIn).not.toHaveBeenCalled();
});

test('password is a separate step and rejects weak or mismatched passwords', async () => {
  await input('Email Address', 'ali@example.com'); await press('Continue with email');
  await input('Verification code', '123456'); await press('Verify email');
  expect(tree.root.findAllByProps({ testID: 'submit-details' })).toHaveLength(0);
  await input('Choose a password', 'secret12'); await input('Confirm password', 'secret12'); await press('Continue');
  expect(tree.root.findAllByProps({ testID: 'submit-details' })).toHaveLength(0);
  await input('Choose a password', 'secret12!'); await press('Continue');
  expect(tree.root.findAllByProps({ testID: 'submit-details' })).toHaveLength(0);
  await input('Confirm password', 'secret12!'); await press('Continue');
  expect(tree.root.findAllByProps({ testID: 'submit-details' }).length).toBeGreaterThan(0);
});

async function phoneCode() {
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Continue with phone' }).props.onPress());
  await input('Mobile number (Pakistan)', '03001234567'); await press('Continue with phone');
  await input('Verification code', '123456'); await press('Verify phone');
}

test('phone signup verifies the phone and creates only a business owner', async () => {
  await phoneCode();
  expect(sendPhoneSignupCode).toHaveBeenCalledWith('03001234567');
  expect(verifyPhoneSignupCode).toHaveBeenCalledWith('03001234567', '123456');
  await input('Choose a password', 'secret12!'); await input('Confirm password', 'secret12!'); await press('Continue');
  await input('Email Address', 'ali@example.com'); await press('submit-details');
  expect(createFazlAccount).toHaveBeenCalledWith('ali@example.com', 'secret12!', expect.objectContaining({ roles: ['business_owner'], phone: '+923001234567' }));
});

test('failed phone verification cannot advance to password or account creation', async () => {
  (verifyPhoneSignupCode as jest.Mock).mockRejectedValueOnce(new Error('Invalid code'));
  await phoneCode();
  expect(tree.root.findAllByProps({ testID: 'Continue' })).toHaveLength(0);
  expect(createFazlAccount).not.toHaveBeenCalled();
});

test('Google on signup continues through the shared social account flow', async () => {
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Continue with Google' }).props.onPress());
  expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  expect(sendSignupCode).not.toHaveBeenCalled();
  expect(createFazlAccount).not.toHaveBeenCalled();
});

test('retries login after account creation without ever creating the account twice', async () => {
  signIn.mockRejectedValueOnce(new Error('Connection interrupted'));
  await verifiedDetails(); await press('submit-details');
  expect(createFazlAccount).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByProps({ testID: 'submit-details' })).toHaveLength(0);
  await press('Log in');
  expect(signIn).toHaveBeenCalledTimes(2);
  expect(createFazlAccount).toHaveBeenCalledTimes(1);
});
