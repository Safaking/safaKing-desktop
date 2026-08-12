/**
 * Splitting one order's tying between several artists.
 *
 * A hundred safas is more than one person can tie before a baraat leaves, so
 * the job is shared out — forty to one, sixty to another. Each share carries
 * its own rate, because artists are not paid alike, and its own paid flag, so
 * one can be settled while the other waits.
 *
 * Every figure the shop reads — what an artist earned, what is still owed, how
 * many safas on an order still have nobody on them — is summed from these
 * shares. The single artistId still on Rental and Sale is a leftover kept in
 * step with the first share so anything not yet reading shares still finds an
 * artist; nothing should compute money from it.
 */

export type Share = {
  artistId: string;
  quantity: number;
  rate: number;
  paid: boolean;
};

/** What one share is worth: rate per safa times the safas in that share. */
export const shareValue = (s: { rate?: number | null; quantity?: number | null }) =>
  (Number(s?.rate) || 0) * (Number(s?.quantity) || 0);

/** Safas on this order that have been given to somebody. */
export const assignedCount = (assignments?: any[] | null) =>
  (assignments ?? []).reduce((sum, a) => sum + (Number(a?.quantity) || 0), 0);

/** Safas still waiting for an artist. Never negative. */
export const unassignedCount = (order: any) =>
  Math.max(0, (Number(order?.safaTyingCount) || 0) - assignedCount(order?.tyingAssignments));

/**
 * Is this order fully staffed?
 *
 * An order with nobody on it and an order half staffed are the same problem —
 * somebody still has to be found — so both count as needing attention.
 */
export const isFullyAssigned = (order: any) => unassignedCount(order) === 0;

/** Total owed to everyone on this order. */
export const orderOwed = (order: any) =>
  (order?.tyingAssignments ?? []).reduce((sum: number, a: any) => sum + shareValue(a), 0);

/** Every artist on this order, for a one-line summary. */
export const artistNames = (order: any): string[] =>
  (order?.tyingAssignments ?? [])
    .map((a: any) => a?.artist?.name)
    .filter((n: any): n is string => !!n);

/**
 * What the allocate button on an order row says.
 *
 * One artist reads as their first name, as it always did. Several read as a
 * count, because three names do not fit on a row and the number is what tells
 * staff at a glance that the job was shared.
 */
export const artistLabel = (order: any, emptyLabel: string) => {
  const names = artistNames(order);
  if (!names.length) return emptyLabel;
  if (names.length === 1) return names[0].split(' ')[0];
  return `${names.length} artists`;
};

/**
 * The hover text: who has what, and anything still unstaffed.
 *
 * Deliberately no rate. This sits on the order list, which is open at the
 * counter with customers on the other side of it; what an artist is paid is
 * between them and the shop, and is shown in their own ledger.
 */
export const artistTitle = (order: any) => {
  const shares = order?.tyingAssignments ?? [];
  if (!shares.length) return 'Allocate a tying artist';
  const lines = shares.map(
    (a: any) => `${a.artist?.name ?? 'Artist'} — ${a.quantity} safa${a.quantity === 1 ? '' : 's'}`
  );
  const left = unassignedCount(order);
  if (left > 0) lines.push(`${left} still to allocate`);
  return lines.join('\n');
};

/**
 * Clean a submitted split into rows worth storing.
 *
 * Drops blank rows and merges a repeated artist rather than storing them
 * twice, which would double-count them against the slot capacity check.
 */
export function normaliseShares(raw: any): Share[] {
  const rows: Share[] = (Array.isArray(raw) ? raw : [])
    .map((r: any) => ({
      artistId: String(r?.artistId || ''),
      // A real zero must survive, so parse explicitly rather than with `||`.
      quantity: Math.max(0, Math.trunc(Number(r?.quantity)) || 0),
      rate: (() => {
        const n = parseFloat(r?.rate?.toString() ?? '');
        return Number.isFinite(n) && n >= 0 ? n : 0;
      })(),
      paid: !!r?.paid,
    }))
    .filter(r => r.artistId && r.quantity > 0);

  const merged = new Map<string, Share>();
  for (const r of rows) {
    const seen = merged.get(r.artistId);
    if (!seen) {
      merged.set(r.artistId, { ...r });
      continue;
    }
    seen.quantity += r.quantity;
    // The later rate wins; a split that names one artist twice at two rates is
    // a mistake either way, and silently averaging would hide it.
    seen.rate = r.rate;
    seen.paid = seen.paid && r.paid;
  }
  return [...merged.values()];
}

/**
 * Reject a split before it is stored.
 *
 * Over-assigning is the one thing that must not get through: it would pay out
 * for more safas than the order has, and nobody would notice until the artist
 * bill came in high. Under-assigning is allowed — a job part-staffed in the
 * morning gets finished in the afternoon.
 */
export function validateShares(
  shares: Share[],
  required: number
): { ok: true } | { ok: false; error: string } {
  const total = shares.reduce((s, r) => s + r.quantity, 0);
  if (total > required) {
    return {
      ok: false,
      error: `The split adds up to ${total} safas but the order only has ${required}.`,
    };
  }
  return { ok: true };
}

/**
 * The legacy single-artist fields, derived from the split.
 *
 * Kept in step so an order with artists on it never reads as unallocated to
 * anything still looking at Rental.artistId.
 */
export function legacyMirror(shares: Share[]) {
  const first = shares[0];
  return {
    artistId: first?.artistId ?? null,
    artistRate: first?.rate ?? 0,
    // Only "paid" once every artist on the order has been paid.
    artistPaid: shares.length > 0 && shares.every(s => s.paid),
  };
}
