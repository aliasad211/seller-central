// What Seller Central works with. Shaped for the screens first; the backend
// chunks will follow these (the mock API in src/api returns exactly these).

export interface Shop {
  id: string;
  name: string;
  ownerName: string;
  category: string;
  description: string;
  address: string;
  city: string;
  area: string;
  contact: string;
  openingHours: string;
  logo?: string;
  banner?: string;
  /** Disabled by Fazl: hidden from customers. */
  disabled?: boolean;
  /** Fazl category ids; they decide which categories its products may use. */
  categoryId?: string;
  subcategoryId?: string;
  /** Delivery charge in PKR the owner has set; 0 means free delivery. */
  deliveryCharge?: number;
}

export interface Seller {
  id: string;
  name: string;
  email: string;
  /** The account's phone number on Fazl, when it has one. */
  phone?: string;
  address?: string;
  location?: { type: 'Point'; coordinates: [number, number] };
  roles?: string[];
  /** An owner finishes their shared Fazl account before opening shop tools. */
  needsProfileCompletion?: boolean;
  /** Every shop this account owns on Fazl. */
  shops: Shop[];
  /** The one Seller Central is managing; null until one is chosen (or none exist). */
  shop: Shop | null;
  /** Present only when this session belongs to a team member (not the owner). */
  member?: SellerMember;
}

export type SellerMemberPermission = 'orders' | 'products' | 'marketing';

/** A shop-owner's team member, logged in through the team login screen. */
export interface SellerMember {
  id: string;
  name: string;
  email: string;
  /** What this member is allowed to do in Seller Central. */
  permissions: SellerMemberPermission[];
  /** The user id of the shop owner whose account this member operates under. */
  ownerId: string;
}

/** "invited" until they join with the emailed code; "expired" once it runs out. */
export type TeamMemberStatus = 'invited' | 'expired' | 'active' | 'disabled';

/** A manager works on orders, products or ads; a rider delivers the shop's own deliveries. */
export type TeamMemberRole = 'manager' | 'rider';

/** Someone on the owner's team, as the owner manages them (More > Team). */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamMemberRole;
  /** A rider's number, to call them about a delivery. */
  phone?: string | null;
  /** A rider's are always just orders. */
  permissions: SellerMemberPermission[];
  status: TeamMemberStatus;
  joinedAt?: string | null;
  inviteExpiresAt?: string | null;
  lastSeenAt?: string | null;
}

/** A team rider, as offered when an order goes out for self delivery. */
export interface TeamRider {
  id: string;
  name: string;
  phone?: string | null;
}

/** One kind of choice a product comes in, e.g. Size: S, M, L. */
export interface VariationOption {
  name: string;
  values: string[];
}

/** One combination of option values, e.g. "Red / M", with its own stock. */
export interface Variant {
  /** The option values joined by " / ", in option order. */
  label: string;
  stock: number;
  /** Only when this combination costs more or less than the product. */
  price?: number;
}

export type ListingType = 'retail' | 'classified';

export interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  categoryId?: string;
  images: string[];
  video?: string;
  price: number;
  salePrice?: number;
  /** ISO dates; a sale without a start runs from now, without an end runs on. */
  saleStart?: string;
  saleEnd?: string;
  options: VariationOption[];
  variants: Variant[];
  /** Used when the product has no variants; otherwise the variants' sum. */
  stock: number;
  /** Retail: customers buy it on Fazl (Buy now / Add to cart). Classified:
   *  they contact the shop about it instead. Real products always have one. */
  listingType?: ListingType;
  /** Shown to customers on Fazl; the seller's own "Available on Fazl" switch. */
  available: boolean;
  /** Disabled by the Fazl admin: hidden, and the seller can't change it. */
  disabledByFazl?: boolean;
  sold: number;
  views: number;
  createdAt: string;
}

export type OrderStatus =
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

export type DeliveryType = 'local' | 'nationwide';
export type LocalMethod = 'self' | 'rider';
export type RiderStatus =
  | 'requested'
  | 'accepted'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered';
export type TrackingStatus =
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered';
export type PaymentMethod = 'cod' | 'easypaisa';

export interface OrderItem {
  productId: string;
  title: string;
  image?: string;
  variant?: string;
  qty: number;
  unitPrice: number;
}

export interface Customer {
  name: string;
  phone: string;
  address: string;
  area: string;
  city: string;
}

export interface Delivery {
  type: DeliveryType;
  /** Local orders only: chosen once the order is ready. */
  method?: LocalMethod;
  riderId?: string;
  riderName?: string;
  riderPhone?: string;
  riderStatus?: RiderStatus;
  /** Nationwide orders only. */
  courier?: string;
  trackingId?: string;
  trackingStatus?: TrackingStatus;
}

export interface Order {
  id: string;
  number: string;
  createdAt: string;
  status: OrderStatus;
  customer: Customer;
  items: OrderItem[];
  payment: PaymentMethod;
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  fazlCharge: number;
  refund: number;
  delivery: Delivery;
  history: { status: OrderStatus; at: string }[];
  /** How the customer gets it, as chosen on Fazl: sent to them, or collected
   *  from the shop. Set on real Fazl orders (src/api/orders.ts). */
  fulfilment?: 'delivery' | 'pickup';
  note?: string;
  cancelReason?: string;
  returnReason?: string;
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  distanceKm: number;
  rating: number;
  deliveries: number;
  online: boolean;
  available: boolean;
}

/** A shop's feed post. Products are listed through the product form instead. */
export type PostType = 'video';

export interface Post {
  id: string;
  type: PostType;
  caption: string;
  media: string[];
  /** The product tagged in the video, if any. */
  productId?: string;
  productTitle?: string;
  /** A product listing's own video rather than a video post: deleting it
   *  only removes the video, the product stays listed. */
  isListing?: boolean;
  createdAt: string;
  views?: number;
  likes?: number;
}

export type CampaignStatus = 'active' | 'paused' | 'completed';

export interface Campaign {
  id: string;
  shopId: string;
  name: string;
  targetType: 'product' | 'shop';
  productId: string | null;
  productTitle: string;
  productImage?: string | null;
  isScheduled: boolean;
  deliveryEnabled: boolean;
  budget: number;
  spent: number;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  impressions: number;
  clicks: number;
  orders: number;
  sales: number;
}

export type NotificationType =
  | 'order'
  | 'like'
  | 'offer'
  | 'stock'
  | 'ad'
  | 'rider'
  | 'shipping'
  | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  orderId?: string;
  productId?: string;
  /** Fazl's answer to a request for another shop: opens the shop list. */
  shopRequest?: boolean;
}

export interface SellerSettings {
  lowStockThreshold: number;
  defaultLocalDelivery: LocalMethod;
  notifyNewOrders: boolean;
  notifyLowStock: boolean;
  notifyAds: boolean;
  notifyRiders: boolean;
}

export type EarningsPeriod = 'daily' | 'weekly' | 'monthly';

export interface EarningsTotals {
  orders: number;
  sales: number;
  deliveryCharges: number;
  fazlCharges: number;
  discounts: number;
  refunds: number;
  net: number;
}

export interface Earnings {
  totals: EarningsTotals;
  series: { label: string; value: number }[];
  records: Order[];
}

export interface Dashboard {
  todayOrders: number;
  /** What today's orders earned, counted as on the Earnings page. */
  todayEarnings: number;
  /** Waiting to be accepted. */
  newOrders: number;
  pendingOrders: number;
  completedOrders: number;
  pendingDeliveries: number;
  totalEarnings: number;
  lowStock: Product[];
  activeAds: Campaign[];
  adTotals: { impressions: number; clicks: number; orders: number; spent: number; sales: number };
  recentOrders: Order[];
  /** Set on the copy saved on the phone (when it was loaded), shown while
   *  the fresh data loads; absent on fresh data. */
  savedAt?: string;
  unreadNotifications: number;
}
