import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { needsArtist, baratiCount } from '@/lib/barati';
import { startOfDay, endOfDay, addDays } from 'date-fns';

/**
 * The dashboard's "needs attention" feed.
 *
 * A list of recent orders told staff what had happened; this answers what
 * still has to be done. Four groups, most urgent first:
 *
 *   overdue        — past their return date and still out
 *   dueToday       — going out today and not yet packed
 *   upcoming       — going out in the next week and not yet packed
 *   unallocated    — tying booked with no artist assigned yet
 *
 * Sales join the two handover groups. A safa bought for a wedding is wanted on
 * a date just as a hired one is, and until now nothing warned anybody about
 * it — only rentals were ever checked.
 */
export async function GET() {
  try {
    const now = new Date();
    const today = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekAhead = endOfDay(addDays(now, 7));

    const shape = {
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        startDate: true,
        endDate: true,
        status: true,
        totalAmount: true,
        remainingAmount: true,
        readyAt: true,
        tieSafa: true,
        safaShape: true,
        safaTyingStyles: true,
        safaTyingCount: true,
        safaTyingTime: true,
        artistId: true,
        artist: { select: { name: true } },
        tyingAssignments: { include: { artist: { select: { name: true } } } },
        items: { select: { quantity: true } },
      },
    };

    const [overdue, dueToday, upcoming, unallocated, sales] = await Promise.all([
      prisma.rental.findMany({
        where: { status: { in: ['ACTIVE', 'BOOKED'] }, endDate: { lt: today } },
        orderBy: { endDate: 'asc' },
        take: 8,
        ...shape,
      }),
      prisma.rental.findMany({
        where: {
          status: { in: ['BOOKED', 'ACTIVE'] },
          startDate: { gte: today, lte: todayEnd },
          readyAt: null,
        },
        orderBy: { startDate: 'asc' },
        take: 8,
        ...shape,
      }),
      prisma.rental.findMany({
        where: {
          status: 'BOOKED',
          startDate: { gt: todayEnd, lte: weekAhead },
          readyAt: null,
        },
        orderBy: { startDate: 'asc' },
        take: 8,
        ...shape,
      }),
      // Barati is the only tying that sends artists out, and neither that nor
      // "not fully staffed" can be filtered in SQL — the styles live in a JSON
      // column and the shortfall is a sum across a second table — so this reads
      // wider and narrows below rather than capping at 8 before the filter.
      prisma.rental.findMany({
        where: {
          tieSafa: true,
          status: { in: ['BOOKED', 'ACTIVE'] },
          startDate: { gte: today },
        },
        orderBy: { startDate: 'asc' },
        take: 60,
        ...shape,
      }),
      // A sale's handover date is a plain string, written yyyy-mm-dd by the
      // till and as a full timestamp by the collect dialog. Rather than trust
      // one format in SQL, read the unpacked ones and sort the dates out in
      // JavaScript below.
      prisma.sale.findMany({
        where: { readyAt: null, NOT: { pickupDate: null } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerPhone: true,
          pickupDate: true,
          pickupName: true,
          totalAmount: true,
          remainingAmount: true,
          readyAt: true,
          items: { select: { quantity: true } },
        },
      }),
    ]);

    /** A sale dressed as a card the feed already knows how to render. */
    const asCard = (sale: any) => ({
      ...sale,
      kind: 'sale' as const,
      // The groups read startDate; for a sale that is the day it is wanted.
      startDate: sale.pickupDate,
      endDate: null,
      status: 'BOOKED',
      tieSafa: false,
      tyingAssignments: [],
    });

    const saleDay = (sale: any) => {
      const d = new Date(sale.pickupDate);
      return Number.isNaN(d.getTime()) ? null : startOfDay(d);
    };

    const salesDueToday = sales.filter(sale => {
      const d = saleDay(sale);
      return d !== null && d.getTime() === today.getTime();
    });

    const salesUpcoming = sales.filter(sale => {
      const d = saleDay(sale);
      return d !== null && d > today && d <= weekAhead;
    });

    // An order half staffed still needs somebody found, so it belongs here
    // just as much as one with nobody on it.
    const notFullyStaffed = (r: any) =>
      baratiCount(r) >
      (r.tyingAssignments ?? []).reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);

    const stillToStaff = unallocated.filter(needsArtist).filter(notFullyStaffed);

    const format = (r: any) => ({
      ...r,
      itemCount: r.items.reduce((s: number, i: any) => s + (i.quantity || 0), 0),
      items: undefined,
      // How many safas still have nobody, so the card can say "40 of 100 left".
      safasUnassigned: Math.max(
        0,
        baratiCount(r) -
          (r.tyingAssignments ?? []).reduce((sum: number, a: any) => sum + (a.quantity || 0), 0)
      ),
      artistNames: (r.tyingAssignments ?? []).map((a: any) => a.artist?.name).filter(Boolean),
    });

    // Hires and sales sit in one list per group, soonest first: the counter
    // packs by the day something is wanted, not by which book it came from.
    const bySoonest = (a: any, b: any) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime();

    const dueTodayAll = [
      ...dueToday.map(format),
      ...salesDueToday.map(s => format(asCard(s))),
    ].sort(bySoonest);

    const upcomingAll = [
      ...upcoming.map(format),
      ...salesUpcoming.map(s => format(asCard(s))),
    ].sort(bySoonest);

    return NextResponse.json({
      overdue: overdue.map(format),
      dueToday: dueTodayAll.slice(0, 8),
      upcoming: upcomingAll.slice(0, 8),
      unallocated: stillToStaff.slice(0, 8).map(format),
      counts: {
        overdue: overdue.length,
        dueToday: dueTodayAll.length,
        upcoming: upcomingAll.length,
        unallocated: stillToStaff.length,
      },
    });
  } catch (error: any) {
    console.error('GET /api/dashboard/attention error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
