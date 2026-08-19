'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/data';
import { useAuth } from '@/lib/AuthContext';

/**
 * The mark the signed-in user's branch trades under.
 *
 * Partapur bills as Joshi Safa House and its customers recognise that; the
 * newer branches bill as Safa King. Staff should never have to think about
 * which — the screen and the bill follow the branch they are standing in.
 */
export const DEFAULT_LOGO = '/assets/logo.png?v=4';

export function useBranchLogo() {
  const { user } = useAuth();
  const { data } = useSWR(
    user?.storeId ? `/api/branding?storeId=${user.storeId}` : null,
    { fetcher }
  );
  // Admin belongs to no branch, so they see the shop default.
  return (data as any)?.logo || DEFAULT_LOGO;
}
