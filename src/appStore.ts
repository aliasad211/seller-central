// Another shop's fee on iPhone: Apple requires its own in-app purchase there,
// so the App Store sells it (EXTRA_SHOP_SKU, a consumable) and Fazl checks
// Apple's signature before the fee goes into the owner's Fazl wallet — the
// same wallet a JazzCash or Easypaisa top-up reaches on Android. A transaction
// is finished only once Fazl has credited it; until then iOS hands it back, and
// the next attempt sends it to Fazl before buying anything new.
import { Platform } from 'react-native';
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from 'react-native-iap';
import { buyWithAppStore, CoinPurchase } from './api/coins';
import { t } from './i18n';

export const EXTRA_SHOP_SKU = 'com.fazlapp.sellercenter.extra_shop';

/** Whether another shop's fee is bought through the App Store here. */
export const PAYS_WITH_APP_STORE = Platform.OS === 'ios';

let connected: Promise<boolean> | null = null;
const connect = () => {
  connected ??= initConnection().catch(e => {
    connected = null;
    throw e;
  });
  return connected;
};

/** The App Store's price for it, as the owner will be charged (e.g. "Rs 500"). */
export async function extraShopPrice(): Promise<string | null> {
  await connect();
  const products = await fetchProducts({ skus: [EXTRA_SHOP_SKU], type: 'in-app' });
  return products?.find(p => p.id === EXTRA_SHOP_SKU)?.displayPrice ?? null;
}

/** Sends a purchase to Fazl, and finishes it with Apple once Fazl has credited it. */
async function settle(purchase: Purchase): Promise<CoinPurchase> {
  if (!purchase.purchaseToken) throw new Error(t('Something went wrong'));
  const credited = await buyWithAppStore(purchase.purchaseToken);
  if (credited.status === 'completed') await finishTransaction({ purchase, isConsumable: true });
  return credited;
}

/**
 * Buys another shop's fee. Resolves with Fazl's purchase once it's in the
 * wallet, or null when the owner cancels. A purchase left unfinished before
 * (the app closed, or Fazl couldn't be reached) is credited first instead of
 * charging again.
 */
export async function buyExtraShop(): Promise<CoinPurchase | null> {
  await connect();

  const waiting = (await getAvailablePurchases().catch(() => [])).filter(p => p.productId === EXTRA_SHOP_SKU);
  for (const purchase of waiting) {
    const credited = await settle(purchase);
    if (credited.status === 'completed') return credited;
  }

  return new Promise<CoinPurchase | null>((resolve, reject) => {
    const done = (outcome: () => void) => {
      updated.remove();
      failed.remove();
      outcome();
    };
    const updated = purchaseUpdatedListener(purchase => {
      if (purchase.productId !== EXTRA_SHOP_SKU) return;
      settle(purchase).then(
        credited => done(() => resolve(credited)),
        e => done(() => reject(e)),
      );
    });
    const failed = purchaseErrorListener(error => {
      done(() => (error.code === ErrorCode.UserCancelled ? resolve(null) : reject(new Error(error.message))));
    });
    requestPurchase({ request: { apple: { sku: EXTRA_SHOP_SKU } }, type: 'in-app' }).catch(e =>
      done(() => reject(e instanceof Error ? e : new Error(String(e)))),
    );
  });
}
