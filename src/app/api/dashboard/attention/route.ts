import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { needsArtist } from '@/lib/barati';
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
        items: { select: { quantity: true } },
      },
    };

    const [overdue, dueToday, upcoming, unallocated] = await Promise.all([
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
      // Barati is the only tying that sends artists out, and it cannot be
      // filtered in SQL (the styles live in a JSON column), so this reads wider
      // and narrows below rather than capping at 8 before the filter runs.
      prisma.rental.findMany({
        where: {
          tieSafa: true,
          artistId: null,
          status: { in: ['BOOKED', 'ACTIVE'] },
          startDate: { gte: today },
        },
        orderBy: { startDate: 'asc' },
        take: 60,
        ...shape,
      }),
    ]);

    const format = (r: any) => ({
      ...r,
      itemCount: r.items.reduce((s: number, i: any) => s + (i.quantity || 0), 0),
      items: undefined,
    });

    return NextResponse.json({
      overdue: overdue.map(format),
      dueToday: dueToday.map(format),
      upcoming: upcoming.map(format),
      unallocated: unallocated.filter(needsArtist).slice(0, 8).map(format),
      counts: {
        overdue: overdue.length,
        dueToday: dueToday.length,
        upcoming: upcoming.length,
        unallocated: unallocated.filter(needsArtist).length,
      },
    });
  } catch (error: any) {
    console.error('GET /api/dashboard/attention error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
