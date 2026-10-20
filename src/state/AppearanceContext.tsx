import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { ColorScheme, setColorScheme } from '../theme';
import { syncWindowBackground } from '../utils/windowBackground';

/** Settings > Appearance: follow the phone (the default), or always light / dark. */
export type AppearanceMode = 'system' | 'light' | 'dark';

const MODE_KEY = 'sellerCentral.appearance';

interface AppearanceState {
  mode: AppearanceMode;
  /** What the app is drawn in now. */
  scheme: ColorScheme;
  setMode: (mode: AppearanceMode) => void;
}

const AppearanceContext = createContext<AppearanceState | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const phone = useColorScheme();
  const [mode, setModeState] = useState<AppearanceMode>('system');

  // The choice is remembered on this phone. (Until it's read, which is well
  // within the splash, the app follows the phone.)
  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY)
      .then(saved => {
        if (saved === 'system' || saved === 'light' || saved === 'dark') setModeState(saved);
      })
      .catch(() => {});
  }, []);

  const scheme: ColorScheme = mode === 'system' ? (phone === 'dark' ? 'dark' : 'light') : mode;
  // Before anything below is drawn, so it all reads this scheme's colours.
  setColorScheme(scheme);
  // The window behind the app takes the new scheme's background too.
  useEffect(() => {
    syncWindowBackground();
  }, [scheme]);

  const value = useMemo<AppearanceState>(
    () => ({
      mode,
      scheme,
      setMode: next => {
        setModeState(next);
        AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
      },
    }),
    [mode, scheme],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceState {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error('useAppearance must be used inside AppearanceProvider');
  return ctx;
}
