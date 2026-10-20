// Creating a shop on Fazl from Seller Central, with the same fields, lists and
// endpoints as the Fazl app's "Create a shop" form (Native-fazl-app
// CreateShopScreen), so a shop looks the same whichever app created it.
import { api } from './http';
import { prefetchCategoryIcons, ShopCategory, UploadFile } from './shopContent';

/** A point as the location endpoints give it. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** One choice in the City or Area list. */
export interface PlaceOption {
  /** A city's id in Fazl's location dataset; absent for a place found another way. */
  id?: string;
  name: string;
  /** "Punjab, Pakistan" / "Gulberg, Lahore, Pakistan": shown under the name. */
  subtitle?: string;
  coordinates: LatLng | null;
}

const point = (c: unknown): LatLng | null => {
  const lat = Number((c as LatLng | null)?.lat);
  const lng = Number((c as LatLng | null)?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

/**
 * The categories a shop is filed under: shop-type categories, each grouping
 * the product categories its products may be listed in (e.g. "Vehicles":
 * Cars, Bikes).
 */
export async function shopTypeCategories(): Promise<ShopCategory[]> {
  const rows = await api<{ id: string; name: string; icon?: string | null }[]>(
    '/categories?type=shop&fields=basic',
  );
  const categories = (rows ?? []).map(c => ({ id: c.id, name: c.name, icon: c.icon ?? undefined }));
  prefetchCategoryIcons(categories);
  return categories;
}

let citiesCache: Promise<PlaceOption[]> | null = null;

/** Every city in the country (a few hundred), the Fazl app's City list. Once per app session. */
export function listCities(): Promise<PlaceOption[]> {
  if (!citiesCache) {
    citiesCache = api<{ id?: string; name: string; subtitle?: string; coordinates?: unknown }[]>('/locations/cities')
      .then(rows =>
        (rows ?? [])
          .filter(r => r.name)
          .map(r => ({ id: r.id, name: r.name, subtitle: r.subtitle, coordinates: point(r.coordinates) })),
      )
      .catch(e => {
        citiesCache = null;
        throw e;
      });
  }
  return citiesCache;
}

const near = (at: LatLng | null) => (at ? `&lat=${at.lat}&lng=${at.lng}` : '');

type AreaRow = { name?: string; mainText?: string; description?: string; coordinates?: unknown };

const toAreas = (rows: AreaRow[] | null | undefined): PlaceOption[] =>
  (rows ?? [])
    .map(r => ({
      name: r.name ?? r.mainText ?? r.description ?? '',
      subtitle: r.description,
      coordinates: point(r.coordinates),
    }))
    .filter(o => o.name);

/**
 * A city's known areas, offered before anything is typed. By the city's id,
 * as the website asks: `/search/city-areas` finds the city by name, and a
 * name can land on another city (it also matches any city whose name merely
 * contains it, the biggest first), whose list is then empty. By name only for
 * a city without an id (one the map pin found), where that endpoint's Google
 * lookup still finds areas.
 */
export async function listCityAreas(city: PlaceOption): Promise<PlaceOption[]> {
  if (city.id) {
    try {
      const known = await api<{ areas?: AreaRow[] }>(`/locations/cities/${encodeURIComponent(city.id)}/areas`);
      const areas = toAreas(known?.areas);
      if (areas.length) return areas;
    } catch {
      // Asked by name below instead.
    }
  }
  return toAreas(
    await api<AreaRow[]>(`/search/city-areas?city=${encodeURIComponent(city.name)}${near(city.coordinates)}`),
  );
}

/** Areas of one city matching what was typed, as the Fazl app's Area search does. */
export async function searchAreas(query: string, city: string, at: LatLng | null): Promise<PlaceOption[]> {
  const rows = await api<{ mainText?: string; description?: string }[]>(
    `/search/autocomplete-locations?q=${encodeURIComponent(query)}&types=${encodeURIComponent('(regions)')}` +
      `&city=${encodeURIComponent(city)}&withCoordinates=false${near(at)}`,
  );
  return (rows ?? [])
    .map(r => ({ name: r.mainText ?? r.description ?? '', subtitle: r.description, coordinates: null }))
    .filter(o => o.name);
}

/** Places matching what was typed, anywhere, with their points: the map's search box. */
export async function searchPlaces(query: string): Promise<PlaceOption[]> {
  const rows = await api<{ mainText?: string; description?: string; coordinates?: unknown }[]>(
    `/search/autocomplete-locations?q=${encodeURIComponent(query)}`,
  );
  return (rows ?? [])
    .map(r => ({
      name: r.mainText ?? r.description ?? '',
      subtitle: r.description,
      coordinates: point(r.coordinates),
    }))
    .filter(o => o.name && o.coordinates);
}

/** What is at a point: its address, and the city and area it is in. */
export async function reverseGeocode(at: LatLng): Promise<{ address: string; city: string; area: string }> {
  const data = await api<{ description?: string; city?: string | null; area?: string | null }>(
    `/search/reverse-geocode?lat=${at.lat}&lng=${at.lng}`,
  );
  return { address: data?.description ?? '', city: data?.city ?? '', area: data?.area ?? '' };
}

/** A city's point when the city list has none for it. */
export async function locateCity(city: string): Promise<LatLng | null> {
  const rows = await api<{ coordinates?: unknown }[]>(
    `/search/autocomplete-locations?q=${encodeURIComponent(city)}&types=${encodeURIComponent('(cities)')}`,
  );
  return point(rows?.[0]?.coordinates);
}

export interface ShopDraft {
  title: string;
  description: string;
  categoryId: string;
  marketName: string;
  contact: string;
  city: string;
  area: string;
  /** Where the shop is shown on the map. */
  at: LatLng;
  /** The pinned place's address; "Area, City" without a pin. */
  address?: string;
  logo?: UploadFile;
  banner?: UploadFile;
}

/** What Business Profile changes: the shop's details, and a new category or
 *  photo only when the seller picked one. */
export interface ShopProfileDraft {
  title: string;
  description: string;
  address: string;
  area: string;
  city: string;
  contact: string;
  openingHours: string;
  categoryId?: string;
  logo?: UploadFile;
  banner?: UploadFile;
  /** Delivery charge in PKR (whole rupees); 0 means free delivery. */
  deliveryCharge?: number;
}

/**
 * Saves the shop's profile on Fazl: the same shop customers see there, so
 * the change shows in the Fazl app and website at once. Only these fields
 * change; its place on the map stays as it is.
 */
export async function updateShopProfile(shopId: string, d: ShopProfileDraft): Promise<void> {
  const form = new FormData();
  form.append('title', d.title);
  form.append('description', d.description);
  form.append('address', d.address);
  form.append('area', d.area);
  form.append('city', d.city);
  form.append('contact', d.contact);
  form.append('openingHours', d.openingHours);
  if (d.deliveryCharge !== undefined)
    form.append('deliveryCharge', String(Math.round(Number(d.deliveryCharge) || 0)));
  if (d.categoryId) {
    // As the Fazl app sends it: the subcategory mirrors the category.
    form.append('category', d.categoryId);
    form.append('subcategory', d.categoryId);
  }
  // React Native's FormData takes { uri, name, type } as a file.
  if (d.logo) form.append('image', d.logo as unknown as Blob);
  if (d.banner) form.append('banner', d.banner as unknown as Blob);
  await api(`/shops/${shopId}`, { method: 'PUT', form });
}

/**
 * Creates the shop on Fazl for the logged-in account. The account's first
 * shop opens straight away; a further one is paid for from the Fazl wallet
 * (`extraShopFeeMinor`, the fee the owner agreed to — see getNewShopTerms) and
 * waits for Fazl's approval (`awaitingApproval`).
 */
export async function createShop(
  d: ShopDraft,
  extraShopFeeMinor?: number,
): Promise<{ id: string; awaitingApproval: boolean }> {
  const form = new FormData();
  form.append('title', d.title);
  form.append('description', d.description);
  // As the Fazl app sends it: the subcategory mirrors the category.
  form.append('category', d.categoryId);
  form.append('subcategory', d.categoryId);
  form.append('marketName', d.marketName);
  form.append('contact', d.contact);
  form.append('city', d.city);
  form.append('area', d.area);
  form.append('address', d.address || [d.area, d.city].filter(Boolean).join(', '));
  form.append('location', JSON.stringify({ type: 'Point', coordinates: [d.at.lng, d.at.lat] }));
  // React Native's FormData takes { uri, name, type } as a file.
  if (d.logo) form.append('image', d.logo as unknown as Blob);
  if (d.banner) form.append('banner', d.banner as unknown as Blob);
  if (extraShopFeeMinor !== undefined) form.append('extraShopFeeMinor', String(extraShopFeeMinor));
  const shop = await api<{ id: string; awaitingApproval?: boolean }>('/shops/create', { method: 'POST', form });
  return { id: shop.id, awaitingApproval: !!shop.awaitingApproval };
}
