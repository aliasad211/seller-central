// Adding money to the owner's Fazl wallet (a top-up) with JazzCash, Easypaisa
// or a card — the same top-up the Fazl app makes. Seller Central uses it to
// pay for another shop. It's money, not coins: coins only come from rewards
// and referrals. The backend still names these routes "coins" (wallet/me/coins).
import { api } from './http';

export type CoinMethod = 'jazzcash' | 'easypaisa' | 'card';

/** What can be bought. Money in rupees. */
export interface CoinOptions {
  /** Off while Fazl has the wallet paused. */
  enabled: boolean;
  min: number;
  max: number;
  presets: number[];
  /** Which methods are set up on Fazl's side. */
  available: Record<CoinMethod, boolean>;
}

export interface CoinPurchase {
  id: string;
  /** Rupees. */
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  failureMessage?: string | null;
}

interface BackendPurchase {
  id: string;
  amountMinor: number;
  status: CoinPurchase['status'];
  failureMessage?: string | null;
}

const toPurchase = (p: BackendPurchase): CoinPurchase => ({
  id: p.id,
  amount: p.amountMinor / 100,
  status: p.status,
  failureMessage: p.failureMessage,
});

export async function getCoinOptions(): Promise<CoinOptions> {
  const o = await api<{
    enabled: boolean;
    minAmountMinor: number;
    maxAmountMinor: number;
    presetsMinor: number[];
    methods: { method: CoinMethod; available: boolean }[];
  }>('/wallet/me/coins/options');
  const available = { jazzcash: false, easypaisa: false, card: false };
  for (const m of o.methods ?? []) available[m.method] = m.available;
  return {
    enabled: o.enabled,
    min: o.minAmountMinor / 100,
    max: o.maxAmountMinor / 100,
    presets: (o.presetsMinor ?? []).map(p => p / 100),
    available,
  };
}

/**
 * Starts a purchase of `amount` rupees. A JazzCash or Easypaisa account is
 * charged now — the answer comes once the owner approves it on their phone
 * (up to about 90 seconds). A card answers with `checkoutUrl`, JazzCash's
 * card page to open in the browser.
 */
export async function buyCoins(input: {
  amount: number;
  method: CoinMethod;
  mobileNumber?: string;
  cnicLast6?: string;
}): Promise<{ purchase: CoinPurchase; checkoutUrl?: string }> {
  const res = await api<{ purchase: BackendPurchase; checkoutUrl?: string }>('/wallet/me/coins/purchase', {
    method: 'POST',
    body: {
      amountMinor: Math.round(input.amount) * 100,
      method: input.method,
      client: 'app',
      ...(input.method !== 'card' ? { mobileNumber: input.mobileNumber } : {}),
      ...(input.method === 'jazzcash' ? { cnicLast6: input.cnicLast6 } : {}),
    },
    timeoutMs: 2 * 60_000,
  });
  return { purchase: toPurchase(res.purchase), checkoutUrl: res.checkoutUrl };
}

/** A purchase again; a pending one is re-checked with the gateway. */
export async function getCoinPurchase(id: string): Promise<CoinPurchase> {
  return toPurchase(await api<BackendPurchase>(`/wallet/me/coins/purchases/${id}`));
}
