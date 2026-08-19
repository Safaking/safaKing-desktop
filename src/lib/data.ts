'use client';

import useSWR, { mutate as globalMutate, SWRConfiguration } from 'swr';

/**
 * Shared client-side data layer.
 *
 * Every page used to fetch inside `useEffect(..., [])`, so navigating away and
 * back — including browser back/forward — remounted the component and refetched
 * from scratch behind a spinner. SWR keeps the last response per key, so a
 * revisit paints instantly from cache and revalidates in the background.
 *
 * Freshness is preserved two ways: revalidation on focus/reconnect, and
 * explicit invalidation after every write (see `invalidate`).
 */

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return res.json();
};

const defaultConfig: SWRConfiguration = {
  fetcher,
  // Collapse duplicate requests for the same key fired within this window —
  // covers remounts and multiple components asking for the same resource.
  dedupingInterval: 30_000,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  // Cached data renders immediately; the refetch happens underneath it.
  keepPreviousData: true,
};

/** Cache keys, centralised so invalidation can't drift from the fetches. */
export const KEYS = {
  products: '/api/products',
  storePrices: '/api/store-prices',
  storeSafaPrices: '/api/store-safa-prices',
  storeStock: '/api/store-stock',
  stores: '/api/stores',
  users: '/api/users',
  safaOptions: '/api/safa-options',
  artists: '/api/artists',
  vendors: '/api/vendors',
  sales: '/api/sales',
  dashboardStats: '/api/dashboard/stats',
  dashboardActivity: '/api/dashboard/activity',
  rentals: (status?: string) => `/api/rentals${status ? `?status=${status}` : ''}`,
};

/**
 * The catalog, priced for one branch.
 *
 * Pass the signed-in user's storeId and the till rings up that branch's own
 * rate. Without one — admin, who belongs to no branch — it is the shop-wide
 * price. Invalidation matches on prefix, so one branch's key clearing clears
 * them all.
 */
export function useProducts(storeId?: string | null) {
  return useSWR(storeId ? `${KEYS.products}?storeId=${storeId}` : KEYS.products, defaultConfig);
}

/** One branch's price overrides, for the admin screen that edits them. */
export function useStorePrices(storeId?: string | null) {
  return useSWR(storeId ? `${KEYS.storePrices}?storeId=${storeId}` : null, defaultConfig);
}

export function useStores() {
  return useSWR(KEYS.stores, defaultConfig);
}

export function useUsers() {
  return useSWR(KEYS.users, defaultConfig);
}

/** Tying styles, priced for one branch. Same rule as useProducts. */
export function useSafaOptions(storeId?: string | null) {
  return useSWR(
    storeId ? `${KEYS.safaOptions}?storeId=${storeId}` : KEYS.safaOptions,
    defaultConfig
  );
}

/** One branch's own shelf, for the admin screen that sets it. */
export function useStoreStock(storeId?: string | null) {
  return useSWR(storeId ? `${KEYS.storeStock}?storeId=${storeId}` : null, defaultConfig);
}

/** One branch's tying-rate overrides, for the admin screen. */
export function useStoreSafaPrices(storeId?: string | null) {
  return useSWR(storeId ? `${KEYS.storeSafaPrices}?storeId=${storeId}` : null, defaultConfig);
}

export function useArtists(withWork = false) {
  return useSWR(withWork ? `${KEYS.artists}?withWork=true` : KEYS.artists, defaultConfig);
}

export function useVendors(withOrders = false) {
  return useSWR(withOrders ? `${KEYS.vendors}?withOrders=true` : KEYS.vendors, defaultConfig);
}

export function useSales() {
  return useSWR(KEYS.sales, defaultConfig);
}

export function useRentals(status?: string) {
  return useSWR(KEYS.rentals(status), defaultConfig);
}

/**
 * Dashboard headline figures. The activity list it used to fetch alongside
 * these was replaced by the attention feed, which loads its own data.
 */
export function useDashboard() {
  const stats = useSWR(KEYS.dashboardStats, defaultConfig);
  return {
    stats: stats.data,
    isLoading: stats.isLoading,
    error: stats.error,
  };
}

/**
 * Drop cached entries after a write so the next read is authoritative.
 * Rentals are keyed by status, so match on prefix rather than exact key.
 */
export function invalidate(...keys: string[]) {
  return Promise.all(
    keys.map((key) =>
      globalMutate(
        (cacheKey) => typeof cacheKey === 'string' && cacheKey.startsWith(key),
        undefined,
        { revalidate: true }
      )
    )
  );
}

/** Anything that changes stock, money, or rental state moves the dashboard. */
export const invalidateAfterRentalChange = () =>
  invalidate('/api/rentals', KEYS.dashboardStats, KEYS.dashboardActivity, KEYS.products);

export const invalidateAfterSale = () =>
  invalidate(KEYS.sales, KEYS.dashboardStats, KEYS.dashboardActivity, KEYS.products, KEYS.vendors);

export const invalidateAfterVendorChange = () => invalidate(KEYS.vendors);

/** Allocating an artist changes the order and the artist's workload. */
export const invalidateAfterArtistChange = () =>
  invalidate(KEYS.artists, '/api/rentals');

export const invalidateAfterProductChange = () =>
  invalidate(KEYS.products, KEYS.dashboardStats);

/** A branch price change moves every catalog, since each is keyed by branch. */
export const invalidateAfterStorePriceChange = () =>
  invalidate(
    KEYS.products,
    KEYS.storePrices,
    KEYS.safaOptions,
    KEYS.storeSafaPrices,
    KEYS.storeStock
  );
