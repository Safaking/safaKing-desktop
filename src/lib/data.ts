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
  stores: '/api/stores',
  users: '/api/users',
  safaOptions: '/api/safa-options',
  sales: '/api/sales',
  dashboardStats: '/api/dashboard/stats',
  dashboardActivity: '/api/dashboard/activity',
  rentals: (status?: string) => `/api/rentals${status ? `?status=${status}` : ''}`,
};

export function useProducts() {
  return useSWR(KEYS.products, defaultConfig);
}

export function useStores() {
  return useSWR(KEYS.stores, defaultConfig);
}

export function useUsers() {
  return useSWR(KEYS.users, defaultConfig);
}

export function useSafaOptions() {
  return useSWR(KEYS.safaOptions, defaultConfig);
}

export function useSales() {
  return useSWR(KEYS.sales, defaultConfig);
}

export function useRentals(status?: string) {
  return useSWR(KEYS.rentals(status), defaultConfig);
}

export function useDashboard() {
  const stats = useSWR(KEYS.dashboardStats, defaultConfig);
  const activity = useSWR(KEYS.dashboardActivity, defaultConfig);
  return {
    stats: stats.data,
    activity: activity.data,
    isLoading: stats.isLoading || activity.isLoading,
    error: stats.error || activity.error,
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
  invalidate(KEYS.sales, KEYS.dashboardStats, KEYS.dashboardActivity, KEYS.products);

export const invalidateAfterProductChange = () =>
  invalidate(KEYS.products, KEYS.dashboardStats);
