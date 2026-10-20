import { NativeModules, Platform } from 'react-native';
import { colors } from '../theme';

// Android's app window starts out Fazl teal (styles.xml), so launch never
// flashes white. Once the splash covers the screen, the window takes the
// screens' own background instead: wherever the app's view briefly doesn't
// reach — as while Google's account chooser closes after an account is
// picked — the window shows through, and half the page went teal there.
// See WindowBackgroundPackage.kt.

let following = false;

const apply = () => {
  if (Platform.OS !== 'android') return;
  NativeModules.WindowBackground?.setColor?.(colors.surface);
};

/**
 * From the splash, once it is on screen: from now on the window has the
 * theme's background. A moment later, so the window is never white before
 * the splash has drawn over it.
 */
export function followThemeWithWindow() {
  following = true;
  setTimeout(apply, 300);
}

/** After a change of theme (light / dark), once the splash has handed over. */
export function syncWindowBackground() {
  if (following) apply();
}
