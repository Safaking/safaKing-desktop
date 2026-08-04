import 'server-only';
import { prisma } from '@/lib/prisma';

/**
 * Cash book helpers.
 *
 * One book per store per day. Opening balance is carried from the previous
 * day's closing, so nobody re-enters it; the very first day for a store starts
 * at zero. Collections count every payment taken that day (cash and online),
 * and entries are money leaving the till.
 */

export const dayStart = (iso: string) => new Date(`${iso}T00:00:00`);
export const dayEnd = (iso: string) => new Date(`${iso}T23:59:59.999`);

/** yyyy-mm-dd for a Date, in local time rather than UTC. */
export const toISODay = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export const prevISODay = (iso: string) => {
  const d = dayStart(iso);
  d.setDate(d.getDate() - 1);
  return toISODay(d);
};

/** Everything collected for a store on a day, across rentals and sales. */
export async function collectionsFor(storeId: string, iso: string) {
  const createdAt = { gte: dayStart(iso), lte: dayEnd(iso) };
  const [rentals, sales] = await Promise.all([
    prisma.rental.findMany({
      where: { storeId, createdAt },
      select: { paidAmount: true },
    }),
    prisma.sale.findMany({
      where: { storeId, createdAt },
      select: { paidAmount: true },
    }),
  ]);

  const rentalCollected = rentals.reduce((s, r) => s + (r.paidAmount || 0), 0);
  const saleCollected = sales.reduce((s, x) => s + (x.paidAmount || 0), 0);

  return {
    rentalCollected,
    saleCollected,
    collected: rentalCollected + saleCollected,
    rentalCount: rentals.length,
    saleCount: sales.length,
  };
}

/**
 * Closing balance for a day: opening + collected − everything paid out.
 * Used both for display and to seed the next day's opening.
 */
export function closingOf(openingBalance: number, collected: number, entries: { amount: number }[]) {
  const paidOut = entries.reduce((s, e) => s + (e.amount || 0), 0);
  return { paidOut, closing: openingBalance + collected - paidOut };
}

/**
 * The book for a store/day, created on demand with its opening carried from
 * the previous day. Creation is idempotent — a concurrent request that loses
 * the unique-constraint race re-reads the winner's row rather than failing.
 */
export async function getOrCreateBook(storeId: string, iso: string) {
  const date = dayStart(iso);

  const existing = await prisma.cashBook.findFirst({
    where: { storeId, date },
    include: { entries: { orderBy: { createdAt: 'asc' } } },
  });
  if (existing) return existing;

  // Carry forward from the most recent earlier day, whatever its date.
  const previous = await prisma.cashBook.findFirst({
    where: { storeId, date: { lt: date } },
    orderBy: { date: 'desc' },
    include: { entries: true },
  });

  let openingBalance = 0;
  if (previous) {
    const prevCollections = await collectionsFor(storeId, toISODay(previous.date));
    openingBalance = closingOf(previous.openingBalance, prevCollections.collected, previous.entries).closing;
  }

  try {
    return await prisma.cashBook.create({
      data: { storeId, date, openingBalance },
      include: { entries: true },
    });
  } catch {
    const raced = await prisma.cashBook.findFirst({
      where: { storeId, date },
      include: { entries: { orderBy: { createdAt: 'asc' } } },
    });
    if (raced) return raced;
    throw new Error('Could not open the cash book for this day');
  }
}
