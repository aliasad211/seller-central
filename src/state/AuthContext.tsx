import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { preloadDashboard, preloadSavedDashboard, whenDashboardPreloaded } from '../api';
import { pickAppleIdentity } from '../api/apple';
import { forgetGoogleAccount, pickGoogleAccount } from '../api/google';
import { setSessionExpiredHandler } from '../api/http';
import {
  chooseShop,
  completeOwnerProfile,
  joinTeamWithInvite,
  loginAsMember,
  loginWithApple,
  loginWithCode,
  loginWithGoogle,
  logout,
  OnLastShop,
  refreshShops,
  requestLoginCode,
  restoreSession,
} from '../api/session';
import { Seller, Shop } from '../types/models';
import { stopPush } from '../push';
import { AccountDetails } from '../utils/accountProfile';

/**
 * The splash over the app: at start and on logging out (not after logging
 * in). `until` settles once what it covers is ready — Home's data loaded
 * (start), or the logout done — and `id` tells one splash from the next.
 */
export interface Splash {
  id: number;
  reason: 'start' | 'logout';
  until: Promise<void>;
}

interface AuthState {
  seller: Seller | null;
  /** False until the saved login has been checked at startup. */
  ready: boolean;
  splash: Splash | null;
  /** The splash `id` has faded away. */
  splashDone: (id: number) => void;
  /** A password login waiting for the code emailed to `email`. */
  pendingLogin: { email: string } | null;
  /** Checks the email and password and emails a code; signs in at verifyLoginCode. */
  signIn: (email: string, password: string) => Promise<void>;
  /** The emailed code: finishes the pending login. */
  verifyLoginCode: (code: string) => Promise<void>;
  /** Emails the pending login a new code. */
  resendLoginCode: () => Promise<void>;
  /** Gives up the pending login (back to the email and password). */
  cancelLogin: () => void;
  /** Team member sign in with their own email + password. */
  signInAsMember: (email: string, password: string) => Promise<void>;
  /** Joins a team with the emailed invite code, choosing a password, and signs in. */
  joinTeam: (email: string, code: string, password: string) => Promise<void>;
  /** Resolves without signing in if the user backs out of Google's chooser. */
  signInWithGoogle: () => Promise<void>;
  /** iPhone only. Resolves without signing in if the user closes Apple's sheet. */
  signInWithApple: () => Promise<void>;
  completeProfile: (details: AccountDetails) => Promise<void>;
  signOut: () => Promise<void>;
  /** Makes this one of the account's shops the one being managed. */
  selectShop: (shopId: string) => Promise<void>;
  /** Reloads the account's shops from Fazl (e.g. one was added in the Fazl app). */
  reloadShops: () => Promise<void>;
  /** A shop was just created here: reloads the shops and opens the new one. False if it isn't listed yet. */
  shopCreated: (shopId: string) => Promise<boolean>;
  /** After the business profile is saved, so headers show the new name. */
  setShop: (shop: Shop) => void;
}

const AuthContext = createContext<AuthState | null>(null);

/** The longest logging in (or opening a shop) waits for Home's data. */
const HOME_WAIT_MS = 3000;

/**
 * Loads Home's data for this shop — while the login button, the shop card or
 * the splash still shows it's busy — so Home then opens with data, not a
 * spinner. With last time's data on the phone there's no wait at all: Home
 * opens with that and the fresh data replaces it when in. Without it, a slow
 * network holds things up HOME_WAIT_MS at most; Home then takes the same
 * request over.
 */
async function loadHome(shopId: string | undefined, userId: string) {
  if (!shopId) return;
  preloadDashboard(shopId, userId);
  if (await preloadSavedDashboard(shopId, userId)) return;
  await Promise.race([
    whenDashboardPreloaded(),
    new Promise<void>(resolve => setTimeout(resolve, HOME_WAIT_MS)),
  ]);
}

/** Home's data for the shop shown last time, started as soon as the account
 *  is known — alongside the shop list rather than after it. */
const startHome: OnLastShop = (shopId, userId) => {
  preloadDashboard(shopId, userId);
};

/** A promise and the function that settles it. */
function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [ready, setReady] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<{ email: string } | null>(null);
  // Kept in memory only, to send a new code without asking for it again.
  const pendingPassword = useRef('');
  // The start splash covers checking the saved login and loading Home.
  const [startup] = useState(deferred);
  const [splash, setSplash] = useState<Splash | null>(() => ({
    id: 0,
    reason: 'start',
    until: startup.promise,
  }));

  useEffect(() => {
    const showSplash = (reason: Splash['reason'], until: Promise<void>) =>
      setSplash(s => ({ id: (s?.id ?? 0) + 1, reason, until }));
    setSessionExpiredHandler(() => {
      setSeller(null);
      showSplash('logout', Promise.resolve());
    });
    restoreSession(startHome)
      .then(async restored => {
        // Home's data (or last time's) behind the splash, so Home opens with it.
        if (restored) await loadHome(restored.shop?.id, restored.id);
        setSeller(restored);
      })
      .finally(() => {
        setReady(true);
        startup.resolve();
      });
  }, [startup]);

  const value = useMemo<AuthState>(() => {
    const showSplash = (reason: Splash['reason'], until: Promise<void>) =>
      setSplash(s => ({ id: (s?.id ?? 0) + 1, reason, until }));

    // Logged in: Home's data first (the login button still spinning, no
    // splash), then Home, which opens with it.
    const signedIn = async (next: Seller) => {
      await loadHome(next.shop?.id, next.id);
      setSeller(next);
    };

    const endPendingLogin = () => {
      pendingPassword.current = '';
      setPendingLogin(null);
    };

    return {
      seller,
      ready,
      splash,
      splashDone: id => setSplash(s => (s?.id === id ? null : s)),
      pendingLogin,
      signIn: async (email, password) => {
        const sentTo = await requestLoginCode(email, password);
        pendingPassword.current = password;
        setPendingLogin({ email: sentTo });
      },
      verifyLoginCode: async code => {
        if (!pendingLogin) throw new Error('Log in first');
        await signedIn(await loginWithCode(pendingLogin.email, code, startHome));
        endPendingLogin();
      },
      resendLoginCode: async () => {
        if (!pendingLogin) return;
        await requestLoginCode(pendingLogin.email, pendingPassword.current);
      },
      cancelLogin: endPendingLogin,
      signInAsMember: async (email, password) => {
        await signedIn(await loginAsMember(email, password, startHome));
      },
      joinTeam: async (email, code, password) => {
        await signedIn(await joinTeamWithInvite(email, code, password, startHome));
      },
      signInWithGoogle: async () => {
        const idToken = await pickGoogleAccount();
        if (!idToken) return;
        let next: Seller;
        try {
          next = await loginWithGoogle(idToken, startHome);
        } catch (e) {
          // Let the user pick a different account next time.
          await forgetGoogleAccount();
          throw e;
        }
        await signedIn(next);
      },
      signInWithApple: async () => {
        const identity = await pickAppleIdentity();
        if (!identity) return;
        await signedIn(await loginWithApple(identity.identityToken, identity.fullName, startHome));
      },
      completeProfile: async details => {
        if (!seller) throw new Error('Log in first');
        await signedIn(await completeOwnerProfile(seller, details, startHome));
      },
      signOut: async () => {
        // The splash first, over the logging out; the login screen when it fades.
        const leaving = (async () => {
          // While still logged in: the backend needs the session to drop this
          // phone from the seller's notifications.
          await stopPush();
          await logout();
          await forgetGoogleAccount();
          setSeller(null);
        })();
        showSplash('logout', leaving.catch(() => undefined));
        await leaving;
      },
      selectShop: async shopId => {
        if (!seller) return;
        const next = await chooseShop(seller, shopId);
        // Home's data while the shop's card shows it's opening.
        await loadHome(shopId, seller.id);
        setSeller(next);
      },
      reloadShops: async () => {
        if (seller) setSeller(await refreshShops(seller));
      },
      shopCreated: async shopId => {
        if (!seller) return false;
        const withNewShop = await refreshShops(seller);
        const listed = withNewShop.shops.some(s => s.id === shopId);
        if (!listed) {
          setSeller(withNewShop);
          return false;
        }
        const next = await chooseShop(withNewShop, shopId);
        await loadHome(shopId, seller.id);
        setSeller(next);
        return true;
      },
      setShop: shop =>
        setSeller(s =>
          s ? { ...s, shop, shops: s.shops.map(x => (x.id === shop.id ? shop : x)) } : s,
        ),
    };
  }, [seller, ready, splash, pendingLogin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
