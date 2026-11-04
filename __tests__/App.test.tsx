/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// The app's own shell renders; the screens and the native sign-in and push
// libraries underneath it are left out, as Jest has none of them.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null, DateTimePickerAndroid: { open: jest.fn() } }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../src/push', () => ({ stopPush: jest.fn() }));
jest.mock('../src/api/apple', () => ({ isAppleSignInAvailable: false, pickAppleIdentity: jest.fn() }));
jest.mock('../src/api/google', () => ({ forgetGoogleAccount: jest.fn(), pickGoogleAccount: jest.fn() }));
jest.mock('../src/components/PushHandler', () => ({ PushHandler: () => null }));
jest.mock('../src/navigation/RootNavigator', () => ({ RootNavigator: () => null }));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
