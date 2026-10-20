// The seller's real notifications on Fazl: a new order for their shop, a like
// or an offer on one of their listings, and Fazl's answer to a request for
// another shop (the backend's "selling" ones — their own buying and chats stay
// in the Fazl app). The same ones arrive as push
// notifications (src/push.ts).
import { AppNotification } from '../types/models';
import { api } from './http';
import { t } from '../i18n';

interface BackendNotification {
  id: string;
  type: 'ORDER' | 'LIKE' | 'PRODUCT_OFFER' | 'ANNOUNCEMENT' | string;
  message: string;
  read: boolean;
  createdAt: string;
  payload?: {
    orderId?: string;
    orderCode?: string;
    shopId?: string;
    productId?: string;
    itemId?: string;
    /** "shop_request": Fazl approved or rejected it (`status`). */
    kind?: string;
    status?: string;
  } | null;
}

function toNotification(n: BackendNotification): AppNotification {
  const p = n.payload ?? {};
  if (n.type === 'ORDER') {
    return {
      id: n.id,
      type: 'order',
      title: p.orderCode ? t('New order {code}', { code: p.orderCode }) : t('New order'),
      body: n.message,
      createdAt: n.createdAt,
      read: n.read,
      ...(p.orderId ? { orderId: p.orderId } : {}),
    };
  }
  if (n.type === 'ANNOUNCEMENT' && p.kind === 'shop_request') {
    return {
      id: n.id,
      type: 'system',
      title: p.status === 'approved' ? t('Your shop is approved') : t("Your shop request wasn't approved"),
      body: n.message,
      createdAt: n.createdAt,
      read: n.read,
      shopRequest: true,
    };
  }
  const productId = p.productId ?? p.itemId;
  return {
    id: n.id,
    type: n.type === 'LIKE' ? 'like' : 'offer',
    title: n.type === 'LIKE' ? t('Someone liked your listing') : t('New offer on your listing'),
    body: n.message,
    createdAt: n.createdAt,
    read: n.read,
    ...(productId ? { productId } : {}),
  };
}

/**
 * The seller's notifications, newest first. An order for another of their
 * shops is left out; likes and offers are on any of their listings.
 */
export async function listSellerNotifications(
  userId: string,
  shopId: string,
): Promise<AppNotification[]> {
  const page = await api<{ notifications: BackendNotification[] }>(
    `/notifications/${userId}/seller?page=1&limit=50`,
  );
  return (page?.notifications ?? [])
    .filter(n => n.type !== 'ORDER' || !n.payload?.shopId || n.payload.shopId === shopId)
    .map(toNotification);
}

export async function sellerUnreadCount(userId: string): Promise<number> {
  const res = await api<{ count: number }>(`/notifications/${userId}/seller/unread-count`);
  return res?.count ?? 0;
}

export async function markSellerNotificationRead(id: string): Promise<void> {
  await api(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllSellerNotificationsRead(userId: string): Promise<void> {
  await api(`/notifications/${userId}/seller/read-all`, { method: 'PATCH' });
}

/**
 * Settings' notification switches, kept by Fazl for the account: one that's
 * off isn't pushed to any of the seller's phones (it still shows in the
 * Notifications list).
 */
export interface NotificationSwitches {
  newOrders: boolean;
  lowStock: boolean;
  riders: boolean;
  ads: boolean;
}

export function getNotificationSwitches(userId: string): Promise<NotificationSwitches> {
  return api<NotificationSwitches>(`/notifications/${userId}/seller/settings`);
}

/** Turns the given switches on or off; returns all of them as saved. */
export function setNotificationSwitches(
  userId: string,
  changes: Partial<NotificationSwitches>,
): Promise<NotificationSwitches> {
  return api<NotificationSwitches>(`/notifications/${userId}/seller/settings`, {
    method: 'PATCH',
    body: changes,
  });
}
