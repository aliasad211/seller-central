// Orders, notifications and advertising use the shop's backend records.
// The older helpers below still use sample data until their backend chunk.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppNotification,
  Dashboard,
  Earnings,
  EarningsPeriod,
  Order,
  OrderStatus,
  Post,
  Product,
  Rider,
  SellerSettings,
  TrackingStatus,
} from '../types/models';
import { isSameDay } from '../utils/format';
import {
  EARNING_STATUSES,
  IN_DELIVERY_STATUSES,
  PENDING_STATUSES,
  orderNet,
} from '../utils/orders';
import { stockState } from '../utils/products';
import * as db from './mockData';
import {
  getOrderSummary,
  getShopOrder,
  listShopOrders,
  moveShopShipment,
  setShopOrderStatus,
  setShopOrderTracking,
  shipShopOrder,
  StatusDetails,
  StatusTotals,
  TotalsByStatus,
} from './orders';
export type { StatusDetails } from './orders';
import { listCampaigns } from './campaigns';
export { listCampaigns, getCampaign, saveCampaign, setCampaignStatus } from './campaigns';
export type { CampaignInput } from './campaigns';
import {
  getNotificationSwitches,
  listSellerNotifications,
  markAllSellerNotificationsRead,
  markSellerNotificationRead,
  NotificationSwitches,
  sellerUnreadCount,
  setNotificationSwitches,
} from './notifications';
import { ApiError } from './http';
import { t } from '../i18n';

const LATENCY_MS = 250;

function respond<T>(value: T): Promise<T> {
  return new Promise(resolve =>
    setTimeout(() => resolve(JSON.parse(JSON.stringify(value))), LATENCY_MS),
  );
}

function fail(message: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), LATENCY_MS),
  );
}

let nextId = 100;
const newId = (prefix: string) => `${prefix}${nextId++}`;

function findOrder(id: string): Order {
  const order = db.orders.find(o => o.id === id);
  if (!order) throw new Error('Order not found');
  return order;
}

function pushStatus(order: Order, status: OrderStatus) {
  order.status = status;
  order.history.push({ status, at: new Date().toISOString() });
}

// ---------- Dashboard ----------

/** Adds up `field` over the orders at `statuses` (every status when left out). */
function sumOf(
  totals: TotalsByStatus,
  field: keyof StatusTotals,
  statuses = Object.keys(totals) as OrderStatus[],
): number {
  return statuses.reduce((s, status) => s + (totals[status]?.[field] ?? 0), 0);
}

export async function getDashboard(shopId: string, userId: string): Promise<Dashboard> {
  // Today as the seller's phone counts it.
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const [orders, unreadNotifications, campaigns] = await Promise.all([
    getOrderSummary(shopId, from, to),
    sellerUnreadCount(userId).catch(() => 0),
    listCampaigns(shopId),
  ]);
  const activeAds = campaigns.filter(c => c.status === 'active' && !c.isScheduled);
  const lowStock = db.products.filter(
    p => stockState(p, db.settings.lowStockThreshold) !== 'in_stock',
  );
  // Straight back: respond()'s pretend network delay is for the sample data only.
  const dashboard: Dashboard = {
    todayOrders: sumOf(orders.today, 'count'),
    // The same count as the Earnings page: today's delivered orders, net.
    todayEarnings: sumOf(orders.today, 'net', EARNING_STATUSES),
    newOrders: sumOf(orders.all, 'count', ['new']),
    pendingOrders: sumOf(orders.all, 'count', PENDING_STATUSES),
    completedOrders: sumOf(orders.all, 'count', ['delivered']),
    pendingDeliveries: sumOf(orders.all, 'count', IN_DELIVERY_STATUSES),
    totalEarnings: sumOf(orders.all, 'net', EARNING_STATUSES),
    lowStock,
    activeAds,
    adTotals: campaigns.reduce(
      (sum, c) => ({
        impressions: sum.impressions + c.impressions,
        clicks: sum.clicks + c.clicks,
        orders: sum.orders + c.orders,
        spent: sum.spent + c.spent,
        sales: sum.sales + c.sales,
      }),
      { impressions: 0, clicks: 0, orders: 0, spent: 0, sales: 0 },
    ),
    recentOrders: orders.recent,
    unreadNotifications,
  };
  saveDashboard(shopId, userId, dashboard);
  return dashboard;
}

// Home's data as last loaded, kept on the phone per account and shop, so Home
// can open with it at once next time — on a slow network too — while the
// fresh data loads. The version goes up whenever Dashboard's shape changes.
const savedDashboardKey = (shopId: string, userId: string) =>
  `sellerCentral.home.v1.${userId}.${shopId}`;

function saveDashboard(shopId: string, userId: string, data: Dashboard) {
  AsyncStorage.setItem(
    savedDashboardKey(shopId, userId),
    JSON.stringify({ at: new Date().toISOString(), data }),
  ).catch(() => undefined);
}

async function readSavedDashboard(shopId: string, userId: string): Promise<Dashboard | undefined> {
  try {
    const raw = await AsyncStorage.getItem(savedDashboardKey(shopId, userId));
    if (!raw) return undefined;
    const saved = JSON.parse(raw) as { at: string; data: Dashboard };
    // Saved on another day: its "today" isn't today, so that waits for the fresh data.
    const sameDay = isSameDay(new Date(saved.at), new Date());
    return {
      ...saved.data,
      ...(sameDay ? {} : { todayOrders: 0, todayEarnings: 0 }),
      savedAt: saved.at,
    };
  } catch {
    return undefined;
  }
}

// Home's data, loaded ahead — behind the splash at start, while logging in or
// opening a shop — so Home opens with it. Home takes this request over
// instead of sending its own.
const PRELOAD_FRESH_MS = 30_000;
let preloadedDashboard: {
  key: string;
  at: number;
  promise: Promise<Dashboard>;
  /** The data, once it's in. */
  value?: Dashboard;
  /** Last time's, from the phone, until then. */
  saved?: Dashboard;
} | null = null;

/**
 * Starts loading Home's data for this shop, ahead of Home opening. One already
 * on its way for the same shop (started early, while logging in) is used
 * rather than sent again.
 */
export function preloadDashboard(shopId: string, userId: string): Promise<Dashboard> {
  const key = `${shopId}:${userId}`;
  const current = preloadedDashboard;
  if (current?.key === key && Date.now() - current.at <= PRELOAD_FRESH_MS) return current.promise;
  const promise = getDashboard(shopId, userId);
  const entry: NonNullable<typeof preloadedDashboard> = { key, at: Date.now(), promise };
  preloadedDashboard = entry;
  promise.then(
    value => {
      entry.value = value;
    },
    // A failed preload isn't handed on: Home then loads for itself.
    () => {
      if (preloadedDashboard === entry) preloadedDashboard = null;
    },
  );
  return promise;
}

/**
 * Puts last time's Home data from the phone with the load in flight for this
 * shop, so Home can open with it straight away. True if there was any.
 */
export async function preloadSavedDashboard(shopId: string, userId: string): Promise<boolean> {
  const saved = await readSavedDashboard(shopId, userId);
  const hit = preloadedDashboard;
  if (!saved || hit?.key !== `${shopId}:${userId}`) return false;
  hit.saved = saved;
  return true;
}

/**
 * What Home can show at once: the preloaded data if it's in, else last time's
 * from the phone (marked with `savedAt`), else nothing.
 */
export function peekPreloadedDashboard(shopId: string, userId: string): Dashboard | undefined {
  const hit = preloadedDashboard;
  if (!hit || hit.key !== `${shopId}:${userId}` || Date.now() - hit.at > PRELOAD_FRESH_MS) return undefined;
  return hit.value ?? hit.saved;
}

/** Home's data loaded ahead, once (a later visit fetches afresh); null if none. */
export function takePreloadedDashboard(shopId: string, userId: string): Promise<Dashboard> | null {
  const hit = preloadedDashboard;
  if (!hit || hit.key !== `${shopId}:${userId}` || Date.now() - hit.at > PRELOAD_FRESH_MS) return null;
  preloadedDashboard = null;
  return hit.promise;
}

/** Settles once Home's preloaded data is in (or failed); at once if none is loading. */
export function whenDashboardPreloaded(): Promise<void> {
  return preloadedDashboard ? preloadedDashboard.promise.then(() => undefined, () => undefined) : Promise.resolve();
}

// ---------- Orders ----------

/** The shop's orders on Fazl, newest first. */
export function listOrders(shopId: string): Promise<Order[]> {
  return listShopOrders(shopId);
}

export function getOrder(shopId: string, id: string): Promise<Order> {
  return getShopOrder(shopId, id);
}

/** Moves a real order on one step (see orderActions); the customer is told on
 *  Fazl. A return carries its reason, a refund the amount paid back. */
export function updateOrderStatus(
  shopId: string,
  id: string,
  status: OrderStatus,
  details?: StatusDetails,
): Promise<Order> {
  return setShopOrderStatus(shopId, id, status, details);
}

/** A ready delivery order leaves the shop with the seller delivering it
 *  themselves — or one of their team's riders, `riderId`: "Out for
 *  delivery" on Fazl, and the customer is told. */
export function startSelfDelivery(shopId: string, id: string, riderId?: string): Promise<Order> {
  return setShopOrderStatus(shopId, id, 'out_for_delivery', {
    deliveryMethod: 'self',
    ...(riderId ? { deliveryMemberId: riderId } : {}),
  });
}

// Fazl riders aren't on Fazl yet: these still work on the sample orders only,
// and no real order offers them (see orderActions).

export async function listNearbyRiders(): Promise<Rider[]> {
  return respond(
    db.riders
      .filter(r => r.online)
      .sort((a, b) => Number(b.available) - Number(a.available) || a.distanceKm - b.distanceKm),
  );
}

export async function assignRider(orderId: string, riderId: string): Promise<Order> {
  const order = findOrder(orderId);
  const rider = db.riders.find(r => r.id === riderId);
  if (!rider) return fail('Rider not found');
  order.delivery = {
    ...order.delivery,
    method: 'rider',
    riderId: rider.id,
    riderName: rider.name,
    riderPhone: rider.phone,
    riderStatus: 'requested',
  };
  pushStatus(order, 'shipped');
  return respond(order);
}

/**
 * The courier and tracking ID of a ready order: it ships with them ("Shipped"
 * on Fazl). An order already sent (`editing`) just has them corrected. Either
 * way the customer sees them on Fazl.
 */
export function setTracking(
  shopId: string,
  orderId: string,
  courier: string,
  trackingId: string,
  editing: boolean,
): Promise<Order> {
  return editing
    ? setShopOrderTracking(shopId, orderId, courier, trackingId)
    : shipShopOrder(shopId, orderId, courier, trackingId);
}

/** An order sent by courier moves on as its tracking shows. */
export function updateTracking(
  shopId: string,
  orderId: string,
  trackingStatus: TrackingStatus,
): Promise<Order> {
  if (trackingStatus === 'shipped') return getShopOrder(shopId, orderId);
  return moveShopShipment(shopId, orderId, trackingStatus);
}

// ---------- Products & inventory ----------

export async function listProducts(): Promise<Product[]> {
  return respond(
    [...db.products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export async function getProduct(id: string): Promise<Product> {
  const product = db.products.find(p => p.id === id);
  return product ? respond(product) : fail('Product not found');
}

export type ProductInput = Omit<Product, 'id' | 'sold' | 'views' | 'createdAt'>;

export async function saveProduct(input: ProductInput, id?: string): Promise<Product> {
  if (id) {
    const product = db.products.find(p => p.id === id);
    if (!product) return fail('Product not found');
    Object.assign(product, input);
    if (input.salePrice == null) {
      delete product.salePrice;
      delete product.saleStart;
      delete product.saleEnd;
    }
    return respond(product);
  }
  const product: Product = {
    ...input,
    id: newId('p'),
    sold: 0,
    views: 0,
    createdAt: new Date().toISOString(),
  };
  db.products.unshift(product);
  return respond(product);
}

export async function deleteProduct(id: string): Promise<void> {
  const index = db.products.findIndex(p => p.id === id);
  if (index >= 0) db.products.splice(index, 1);
  return respond(undefined);
}

export async function setProductAvailable(id: string, available: boolean): Promise<Product> {
  const product = db.products.find(p => p.id === id);
  if (!product) return fail('Product not found');
  product.available = available;
  return respond(product);
}

/** Sets the stock of the product, or of one of its variants. */
export async function setStock(
  productId: string,
  stock: number,
  variantLabel?: string,
): Promise<Product> {
  const product = db.products.find(p => p.id === productId);
  if (!product) return fail('Product not found');
  const value = Math.max(0, Math.floor(stock));
  if (variantLabel) {
    const variant = product.variants.find(v => v.label === variantLabel);
    if (variant) variant.stock = value;
  } else {
    product.stock = value;
  }
  return respond(product);
}

// ---------- Posts ----------

export async function listPosts(): Promise<Post[]> {
  return respond(db.posts);
}

export type PostInput = Omit<Post, 'id' | 'createdAt' | 'views' | 'likes'>;

export async function createPost(input: PostInput): Promise<Post> {
  const post: Post = {
    ...input,
    id: newId('po'),
    createdAt: new Date().toISOString(),
    views: 0,
    likes: 0,
  };
  db.posts.unshift(post);
  return respond(post);
}

export async function deletePost(id: string): Promise<void> {
  const index = db.posts.findIndex(p => p.id === id);
  if (index >= 0) db.posts.splice(index, 1);
  return respond(undefined);
}

// ---------- Earnings ----------

const DAY_NAMES = [t('Sun'), t('Mon'), t('Tue'), t('Wed'), t('Thu'), t('Fri'), t('Sat')];
const MONTH_NAMES = [t('Jan'), t('Feb'), t('Mar'), t('Apr'), t('May'), t('Jun'), t('Jul'), t('Aug'), t('Sep'), t('Oct'), t('Nov'), t('Dec')];

export async function getEarnings(shopId: string, period: EarningsPeriod): Promise<Earnings> {
  // Orders that count as sales: delivered, and later returned/refunded.
  const counted = (await listShopOrders(shopId)).filter(o =>
    EARNING_STATUSES.includes(o.status),
  );
  const now = new Date();
  const buckets: { label: string; from: Date; to: Date }[] = [];
  for (let i = 6; i >= 0; i--) {
    if (period === 'daily') {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const to = new Date(from.getTime() + 86_400_000);
      buckets.push({ label: DAY_NAMES[from.getDay()], from, to });
    } else if (period === 'weekly') {
      const to = new Date(now.getTime() - i * 7 * 86_400_000 + 86_400_000);
      const from = new Date(to.getTime() - 7 * 86_400_000);
      buckets.push({ label: i === 0 ? t('This wk') : t('{count}w ago', { count: i }), from, to });
    } else {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      buckets.push({ label: MONTH_NAMES[from.getMonth()], from, to });
    }
  }
  const inRange = (o: Order) => {
    const at = new Date(o.createdAt);
    return at >= buckets[0].from && at < buckets[buckets.length - 1].to;
  };
  const records = counted
    .filter(inRange)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sum = (f: (o: Order) => number) => records.reduce((s, o) => s + f(o), 0);
  return {
    totals: {
      orders: records.length,
      sales: sum(o => o.subtotal),
      deliveryCharges: sum(o => o.deliveryCharge),
      fazlCharges: sum(o => o.fazlCharge),
      discounts: sum(o => o.discount),
      refunds: sum(o => o.refund),
      net: sum(orderNet),
    },
    series: buckets.map(b => ({
      label: b.label,
      value: records
        .filter(o => {
          const at = new Date(o.createdAt);
          return at >= b.from && at < b.to;
        })
        .reduce((s, o) => s + o.subtotal, 0),
    })),
    records,
  };
}

// ---------- Profile, notifications, settings ----------

/** The seller's notifications on Fazl (./notifications.ts). */
export function listNotifications(userId: string, shopId: string): Promise<AppNotification[]> {
  return listSellerNotifications(userId, shopId);
}

export function markAllNotificationsRead(userId: string): Promise<void> {
  return markAllSellerNotificationsRead(userId);
}

export function markNotificationRead(id: string): Promise<void> {
  return markSellerNotificationRead(id);
}

/** Each notification switch on Fazl, and the setting it shows as. */
const SWITCH_SETTINGS: [keyof NotificationSwitches, keyof SellerSettings][] = [
  ['newOrders', 'notifyNewOrders'],
  ['lowStock', 'notifyLowStock'],
  ['riders', 'notifyRiders'],
  ['ads', 'notifyAds'],
];

function applySwitches(switches: NotificationSwitches) {
  for (const [key, setting] of SWITCH_SETTINGS) {
    Object.assign(db.settings, { [setting]: switches[key] });
  }
}

/**
 * The seller's settings. Given the account, the notification switches are
 * Fazl's for it; the rest are the app's own for now (sample defaults). A
 * backend from before the switches gives the app's own for those too.
 */
export async function getSettings(userId?: string): Promise<SellerSettings> {
  if (userId) {
    try {
      applySwitches(await getNotificationSwitches(userId));
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) throw e;
    }
  }
  return { ...db.settings };
}

/**
 * Saves the settings. A notification switch that changed is saved on Fazl
 * for the account (so it holds on every phone, and the push stops or starts);
 * if that fails, this throws and the switch hasn't changed.
 */
export async function saveSettings(next: SellerSettings, userId?: string): Promise<SellerSettings> {
  const changes: Partial<NotificationSwitches> = {};
  for (const [key, setting] of SWITCH_SETTINGS) {
    if (next[setting] !== db.settings[setting]) changes[key] = next[setting] as boolean;
  }
  const rest = { ...next };
  for (const [, setting] of SWITCH_SETTINGS) delete rest[setting];
  Object.assign(db.settings, rest);
  if (userId && Object.keys(changes).length) {
    applySwitches(await setNotificationSwitches(userId, changes));
  }
  return { ...db.settings };
}
