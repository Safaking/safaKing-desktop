/**
 * Barati safa tying — the only kind that needs artists sent out.
 *
 * Rounded and Jodhpuri are tied at the counter when the customer collects, so
 * they cost nobody a trip. A barati order means artists travel to the wedding
 * at a fixed hour, and there are only so many of them: two barati orders at
 * 6 pm on the same date need twice the people, not twice the time. Everything
 * that has to count artists keys off this.
 */

/** Match on the word, not the exact label — the styles are editable in admin. */
export const isBaratiStyle = (name?: string | null) =>
  !!name && /barati/i.test(name);

/**
 * Does this order need artists sent out?
 *
 * safaTyingStyles is the JSON array written at booking; safaShape is the
 * comma-joined fallback older orders were saved with.
 */
export function needsArtist(order: any): boolean {
  if (!order?.tieSafa) return false;

  const raw = order.safaTyingStyles;
  if (raw) {
    try {
      const styles = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(styles)) {
        return styles.some((s: any) => isBaratiStyle(s?.name));
      }
    } catch {
      // Fall through to safaShape below rather than losing the order.
    }
  }

  return isBaratiStyle(order.safaShape);
}

/** How many of the safas on this order are the barati kind. */
export function baratiCount(order: any): number {
  const raw = order?.safaTyingStyles;
  if (raw) {
    try {
      const styles = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(styles)) {
        const n = styles
          .filter((s: any) => isBaratiStyle(s?.name))
          .reduce((sum: number, s: any) => sum + (Number(s?.quantity) || 0), 0);
        if (n > 0) return n;
      }
    } catch {
      // Fall through.
    }
  }
  return needsArtist(order) ? Number(order?.safaTyingCount) || 0 : 0;
}

export type Slot = 'AM' | 'PM';

/**
 * Morning or evening, from an "HH:mm" tying time.
 *
 * Baraats are overwhelmingly evening jobs, so an order with no time recorded
 * is counted as PM rather than dropped — an uncounted order is the failure
 * that matters here.
 */
export function slotOf(time?: string | null): Slot {
  const m = /^(\d{1,2}):/.exec((time || '').trim());
  if (!m) return 'PM';
  const hour = Number(m[1]);
  return hour < 12 ? 'AM' : 'PM';
}

export const slotLabel = (s: Slot) => (s === 'AM' ? 'Morning (before 12)' : 'Evening (12 onwards)');
