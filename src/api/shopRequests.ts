// An owner's shops beyond their first: Fazl's fee for one (paid from the
// owner's Fazl wallet), and the requests waiting for Fazl's approval. The
// first shop opens straight away and needs none of this.
import { api } from './http';

/** What creating one more shop takes. Money in rupees. */
export interface NewShopTerms {
  /** The account has a shop already: the next one waits for Fazl's approval. */
  needsApproval: boolean;
  /** Its fee: 0 for a first shop, or when Fazl charges none. */
  fee: number;
  /** What's in the owner's Fazl wallet. */
  balance: number;
  walletFrozen: boolean;
  walletEnabled: boolean;
  /** Open shops plus those waiting for approval, against `maxShops`. */
  shopCount: number;
  maxShops: number;
  canCreate: boolean;
  /** As the backend gave it, sent back when creating the shop. */
  feeMinor: number;
}

export type ShopRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ShopRequest {
  id: string;
  code: string;
  shopId: string | null;
  shopTitle: string;
  /** Rupees. */
  fee: number;
  status: ShopRequestStatus;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface BackendTerms {
  needsApproval: boolean;
  feeMinor: number;
  balanceMinor: number;
  walletFrozen: boolean;
  walletEnabled: boolean;
  shopCount: number;
  maxShops: number;
  canCreate: boolean;
}

interface BackendRequest {
  id: string;
  requestCode: string | null;
  shopId: string | null;
  shopTitle: string;
  feeMinor: number;
  status: ShopRequestStatus;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export async function getNewShopTerms(): Promise<NewShopTerms> {
  const t = await api<BackendTerms>('/shops/new-shop-terms');
  return {
    needsApproval: t.needsApproval,
    fee: t.feeMinor / 100,
    balance: t.balanceMinor / 100,
    walletFrozen: t.walletFrozen,
    walletEnabled: t.walletEnabled,
    shopCount: t.shopCount,
    maxShops: t.maxShops,
    canCreate: t.canCreate,
    feeMinor: t.feeMinor,
  };
}

const toRequest = (r: BackendRequest): ShopRequest => ({
  id: r.id,
  code: r.requestCode ?? r.id,
  shopId: r.shopId,
  shopTitle: r.shopTitle,
  fee: r.feeMinor / 100,
  status: r.status,
  rejectionReason: r.rejectionReason,
  createdAt: r.createdAt,
  reviewedAt: r.reviewedAt,
});

/** The owner's requests for extra shops, newest first. */
export async function listShopRequests(): Promise<ShopRequest[]> {
  return ((await api<BackendRequest[]>('/shops/requests')) ?? []).map(toRequest);
}

/** Takes back a request Fazl hasn't decided on; the fee goes back to the wallet. */
export async function cancelShopRequest(id: string): Promise<ShopRequest> {
  return toRequest(await api<BackendRequest>(`/shops/requests/${id}/cancel`, { method: 'POST' }));
}
