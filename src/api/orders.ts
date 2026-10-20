// The shop's real orders on Fazl, as Seller Central shows them. An order on
// Fazl is one product (a cart becomes one order per product) and moves
// pending → confirmed → preparing → ready; then out for delivery with the
// shop delivering it itself (local), or shipped with a courier → in transit
// → out for delivery (nationwide); → delivered. A pickup order is collected
// at the shop once ready. Cancelled before it leaves the shop; a delivered
// one the customer sends back is returned, then refunded. Orders from before
// went confirmed → shipped → delivered. The app's own wording: New →
// Accepted → Preparing → Ready → Shipped / Out for delivery → Delivered; a
// courier's in transit is the order's tracking step. Fazl riders aren't on
// Fazl yet, so a real order never reaches those steps.
import { Order, OrderStatus, TrackingStatus } from '../types/models';
import { orderNet } from '../utils/orders';
import { api, ApiError } from './http';
import { LocalizedName, nameOf } from './session';
import { t } from '../i18n';

type BackendStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

interface BackendOrder {
  id: string;
  /** The order's ID people see: ORD-000123 (older backends: none). */
  orderCode?: string | null;
  status: BackendStatus;
  createdAt: string;
  updatedAt: string;
  amount: number;
  quantity: number;
  variant?: Record<string, unknown> | null;
  deliveryOption: 'delivery' | 'self-pickup';
  /** Who is taking it to the customer, once it leaves the shop. */
  deliveryMethod?: 'self' | 'rider' | 'courier' | null;
  /** The shop's team rider taking it, when the shop delivers it itself. */
  deliveryMember?: { id: string; name: string; phone?: string | null } | null;
  /** The courier and its tracking ID (orders sent by courier). */
  courierName?: string | null;
  trackingId?: string | null;
  /** Where to deliver it, as the buyer confirmed at checkout (older orders: none). */
  deliveryAddress?: string | null;
  paymentType: 'cashonDelivery' | 'Easypaisa';
  /** Why it came back, and when (returned and refunded orders). */
  returnReason?: string | null;
  returnedAt?: string | null;
  /** What the seller paid back, and when (refunded orders). */
  refundAmount?: number | null;
  refundedAt?: string | null;
  productId: string;
  product?: { id: string; title: LocalizedName; images?: string[] | null } | null;
  buyer?: {
    id: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
}

const FROM_BACKEND: Record<BackendStatus, OrderStatus> = {
  pending: 'new',
  confirmed: 'accepted',
  preparing: 'preparing',
  ready: 'ready',
  shipped: 'shipped',
  // With the courier still: its tracking says how far (delivery.trackingStatus).
  in_transit: 'shipped',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'cancelled',
  returned: 'returned',
  refunded: 'refunded',
};

/** How far a courier has it, from the order's status on Fazl. */
const TRACKING_OF: Partial<Record<BackendStatus, TrackingStatus>> = {
  shipped: 'shipped',
  in_transit: 'in_transit',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  returned: 'delivered',
  refunded: 'delivered',
};

/** Who has it once it leaves the shop: a courier (nationwide, with its
 *  tracking), or the shop itself / a rider (local). */
function deliveryOf(o: BackendOrder): Order['delivery'] {
  if (o.deliveryMethod === 'courier') {
    return {
      type: 'nationwide',
      courier: o.courierName ?? undefined,
      trackingId: o.trackingId ?? undefined,
      trackingStatus: TRACKING_OF[o.status],
    };
  }
  return {
    type: 'local',
    ...(o.deliveryMethod === 'self' || o.deliveryMethod === 'rider'
      ? { method: o.deliveryMethod }
      : {}),
    // Delivering it themselves, through one of the team's riders.
    ...(o.deliveryMethod === 'self' && o.deliveryMember
      ? {
          riderId: o.deliveryMember.id,
          riderName: o.deliveryMember.name,
          riderPhone: o.deliveryMember.phone ?? undefined,
        }
      : {}),
  };
}

const TO_BACKEND: Partial<Record<OrderStatus, BackendStatus>> = {
  accepted: 'confirmed',
  preparing: 'preparing',
  ready: 'ready',
  shipped: 'shipped',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'cancelled',
  returned: 'returned',
  refunded: 'refunded',
};

/** When the order reached each step Fazl keeps the time of: placed, and
 *  returned / refunded; any other step is the order's last change. */
function historyOf(o: BackendOrder, status: OrderStatus): Order['history'] {
  const history: Order['history'] = [{ status: 'new', at: o.createdAt }];
  if (o.returnedAt) history.push({ status: 'returned', at: o.returnedAt });
  if (o.refundedAt) history.push({ status: 'refunded', at: o.refundedAt });
  if (status !== 'new' && !history.some(h => h.status === status)) {
    history.push({ status, at: o.updatedAt });
  }
  return history;
}

/** A listing photo's small card version, when it has one (photos since WebP). */
const cardImage = (url?: string) => url?.replace(/__full\.webp$/, '__card.webp');

function toOrder(o: BackendOrder): Order {
  const status = FROM_BACKEND[o.status] ?? 'new';
  const qty = Math.max(1, o.quantity || 1);
  const variant = Object.values(o.variant ?? {})
    .map(v => String(v ?? '').trim())
    .filter(Boolean)
    .join(' / ');
  // The backend now stores a snapshot of the shop's delivery charge on the order.
  // Older orders pre-dating this feature have deliveryCharge = 0.
  const deliveryCharge = Math.round(Number((o as any).deliveryCharge ?? 0));
  const subtotal = Math.max(0, (o.amount || 0) - deliveryCharge);
  return {
    id: o.id,
    number: o.orderCode || `#${o.id.slice(-6).toUpperCase()}`,
    createdAt: o.createdAt,
    status,
    customer: {
      name: o.buyer?.name?.trim() || o.buyer?.email || t('Customer'),
      phone: o.buyer?.phone ?? '',
      // The address the buyer gave for this order; their profile's for an older one.
      address: o.deliveryAddress?.trim() || o.buyer?.address || '',
      area: '',
      city: '',
    },
    items: [
      {
        productId: o.productId,
        title: nameOf(o.product?.title) || t('Product'),
        image: cardImage(o.product?.images?.[0] ?? undefined),
        ...(variant ? { variant } : {}),
        qty,
        unitPrice: Math.round(subtotal / qty),
      },
    ],
    payment: o.paymentType === 'Easypaisa' ? 'easypaisa' : 'cod',
    subtotal,
    deliveryCharge,
    discount: 0,
    fazlCharge: 0,
    // What was paid back; it comes off the seller's earnings.
    refund: o.refundAmount ?? 0,
    delivery: deliveryOf(o),
    fulfilment: o.deliveryOption === 'self-pickup' ? 'pickup' : 'delivery',
    ...(o.returnReason ? { returnReason: o.returnReason } : {}),
    history: historyOf(o, status),
  };
}

const PAGE = 100;
const MAX_PAGES = 10;

/** Every order of the shop, newest first (up to 1,000). */
export async function listShopOrders(shopId: string): Promise<Order[]> {
  const all: BackendOrder[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await api<BackendOrder[]>(
      `/orders/shop/${shopId}/manage?page=${page}&limit=${PAGE}`,
    );
    all.push(...(batch ?? []));
    if (!batch || batch.length < PAGE) break;
  }
  return all.map(toOrder);
}

/** How many orders are at a status, and what the seller earned from them. */
export interface StatusTotals {
  count: number;
  /** As orderNet counts it: what the orders came to, less refunds. */
  net: number;
}

export type TotalsByStatus = Partial<Record<OrderStatus, StatusTotals>>;

/** What Home shows of the shop's orders. */
export interface OrderSummary {
  all: TotalsByStatus;
  /** Those placed today. */
  today: TotalsByStatus;
  /** The newest four. */
  recent: Order[];
}

interface BackendTotals {
  count: number;
  amount: number;
  refunded: number;
}

interface BackendSummary {
  byStatus: Partial<Record<BackendStatus, BackendTotals>>;
  todayByStatus: Partial<Record<BackendStatus, BackendTotals>>;
  recent: BackendOrder[];
}

/** Fazl's totals in the app's statuses (in transit counts as shipped). */
function fromBackendTotals(totals: BackendSummary['byStatus'] | undefined): TotalsByStatus {
  const out: TotalsByStatus = {};
  for (const [status, row] of Object.entries(totals ?? {}) as [BackendStatus, BackendTotals][]) {
    const key = FROM_BACKEND[status] ?? 'new';
    const into = out[key] ?? (out[key] = { count: 0, net: 0 });
    into.count += row.count;
    into.net += row.amount - row.refunded;
  }
  return out;
}

function totalsOf(orders: Order[]): TotalsByStatus {
  const out: TotalsByStatus = {};
  for (const o of orders) {
    const into = out[o.status] ?? (out[o.status] = { count: 0, net: 0 });
    into.count += 1;
    into.net += orderNet(o);
  }
  return out;
}

/**
 * Home's view of the shop's orders, `from`–`to` being today: one small
 * request, rather than every order. A backend from before the summary gets
 * the full list instead, added up here the same way.
 */
export async function getOrderSummary(shopId: string, from: Date, to: Date): Promise<OrderSummary> {
  try {
    const day = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
    const s = await api<BackendSummary>(`/orders/shop/${shopId}/manage/summary?${day}`);
    return {
      all: fromBackendTotals(s?.byStatus),
      today: fromBackendTotals(s?.todayByStatus),
      recent: (s?.recent ?? []).map(toOrder),
    };
  } catch (e) {
    // Not on this backend yet. (An unknown shop is a 404 too; the list says so.)
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }
  const orders = await listShopOrders(shopId);
  const todays = orders.filter(o => {
    const at = new Date(o.createdAt);
    return at >= from && at < to;
  });
  return { all: totalsOf(orders), today: totalsOf(todays), recent: orders.slice(0, 4) };
}

export async function getShopOrder(shopId: string, orderId: string): Promise<Order> {
  const order = (await listShopOrders(shopId)).find(o => o.id === orderId);
  if (!order) throw new Error(t('This order is no longer in your shop.'));
  return order;
}

/** What goes with a step: who is delivering it when it leaves the shop (the
 *  shop itself, or a courier with its name and tracking ID), why it came back
 *  (returned, required), and how much was paid back (refunded; the whole
 *  order when left out). */
export interface StatusDetails {
  deliveryMethod?: 'self' | 'courier';
  /** With "self": the team rider taking it; none when the seller takes it. */
  deliveryMemberId?: string;
  courierName?: string;
  trackingId?: string;
  reason?: string;
  refundAmount?: number;
}

/** Moves the order on one step; the customer sees it on Fazl right away. */
export async function setShopOrderStatus(
  shopId: string,
  orderId: string,
  status: OrderStatus,
  details: StatusDetails = {},
): Promise<Order> {
  const next = TO_BACKEND[status];
  if (!next) throw new Error(t('Something went wrong'));
  const order = await api<BackendOrder>(`/orders/shop/${shopId}/manage/${orderId}`, {
    method: 'PATCH',
    body: { status: next, ...details },
  });
  return toOrder(order);
}

/** A ready order leaves the shop with a courier: "Shipped" on Fazl, and the
 *  customer gets the courier and the tracking ID. */
export function shipShopOrder(
  shopId: string,
  orderId: string,
  courierName: string,
  trackingId: string,
): Promise<Order> {
  return setShopOrderStatus(shopId, orderId, 'shipped', {
    deliveryMethod: 'courier',
    courierName,
    trackingId,
  });
}

/** Corrects the courier or tracking ID while the parcel is on its way; the
 *  customer is told. */
export async function setShopOrderTracking(
  shopId: string,
  orderId: string,
  courierName: string,
  trackingId: string,
): Promise<Order> {
  const order = await api<BackendOrder>(`/orders/shop/${shopId}/manage/${orderId}/tracking`, {
    method: 'PATCH',
    body: { courierName, trackingId },
  });
  return toOrder(order);
}

/** Moves an order sent by courier on, as its tracking shows: in transit, out
 *  for delivery, delivered. */
export async function moveShopShipment(
  shopId: string,
  orderId: string,
  step: Exclude<TrackingStatus, 'shipped'>,
): Promise<Order> {
  const order = await api<BackendOrder>(`/orders/shop/${shopId}/manage/${orderId}`, {
    method: 'PATCH',
    body: { status: step },
  });
  return toOrder(order);
}
