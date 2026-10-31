// Talks to the Fazl backend: adds the access token, unwraps the backend's
// { success, message, data } envelope, and renews an expired access token
// with the refresh token once before giving up.
import { language, t } from '../i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const TOKENS_KEY = 'sellerCentral.tokens';
const TIMEOUT_MS = 30_000;
/** Uploads have to cover pushing every photo/video byte, not just a reply. */
const UPLOAD_TIMEOUT_MS = 5 * 60_000;

export interface Tokens {
  accessToken: string;
  refreshToken?: string;
  isMember?: boolean;
  /**
   * The owner's own Seller Central session (/seller/session), apart from the
   * Fazl app's. A saved owner login without it is from before, made through
   * the Fazl app's login; it isn't used (see restoreSession).
   */
  seller?: boolean;
}

export class ApiError extends Error {
  /** HTTP status; 0 when the server couldn't be reached at all. */
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let tokens: Tokens | null = null;
let onSessionExpired: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export async function loadTokens(): Promise<Tokens | null> {
  try {
    const raw = await AsyncStorage.getItem(TOKENS_KEY);
    tokens = raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    tokens = null;
  }
  return tokens;
}

export async function saveTokens(next: Tokens | null): Promise<void> {
  tokens = next;
  if (next) await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify(next));
  else await AsyncStorage.removeItem(TOKENS_KEY);
}

export function currentTokens(): Tokens | null {
  return tokens;
}

/** Called when the session can't be renewed, so the app goes back to login. */
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Sent as JSON. */
  body?: unknown;
  /** Sent as multipart (photos, videos) instead of `body`. */
  form?: FormData;
  /** False for login calls, which have no token yet. */
  auth?: boolean;
  /** For a call the backend answers slowly (a JazzCash payment waits for the buyer). */
  timeoutMs?: number;
}

/** Calls the backend and returns the response's `data`. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = options.auth !== false;
  let res = await send(path, options, auth);
  if (res.status === 401 && auth && tokens?.refreshToken) {
    if (await refreshOnce()) {
      res = await send(path, options, auth);
    } else {
      await saveTokens(null);
      onSessionExpired?.();
    }
  }
  return parse<T>(res);
}

async function send(path: string, { method = 'GET', body, form, timeoutMs }: RequestOptions, auth: boolean) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    // The backend answers its messages (and category names) in the app's language.
    'Accept-Language': language,
    // Tells Fazl the request is Seller Central's: what it lists is retail.
    'X-Fazl-Client': 'seller-central',
  };
  // Multipart sets its own Content-Type (with the boundary).
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
  if (auth && tokens?.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? (form ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS));
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(t("Can't reach Fazl. Check your internet connection and try again."), 0);
  } finally {
    clearTimeout(timer);
  }
}

async function parse<T>(res: Response): Promise<T> {
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // An empty or non-JSON body; the status says enough.
  }
  if (!res.ok || json?.success === false) {
    const message = Array.isArray(json?.message) ? json.message.join('\n') : json?.message;
    throw new ApiError(
      typeof message === 'string' && message ? message : t('Something went wrong ({status})', { status: res.status }),
      res.status,
    );
  }
  return json?.data as T;
}

/** One renewal at a time, shared by every request that hit a 401 meanwhile. */
function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const refreshPath = tokens?.isMember
          ? '/seller/members/session/refresh'
          : '/seller/session/refresh';
        const res = await send(refreshPath, {
          method: 'POST',
          body: { token: tokens?.refreshToken },
        }, false);
        const data = await parse<Tokens>(res);
        if (!data?.accessToken) return false;
        await saveTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? tokens?.refreshToken,
          isMember: tokens?.isMember,
          seller: tokens?.seller,
        });
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}
