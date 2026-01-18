import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

export async function GET() {
  try {
    const now = new Date();
    const startOfToday = startOfDay(now);
    const endOfToday = endOfDay(now);

    // 1. Overdue Orders (Active/Booked and end date passed)
    const overdueRaw = await prisma.rental.findMany({
      where: {
        status: { in: ['ACTIVE', 'BOOKED'] },
        endDate: { lt: startOfToday },
      },
      include: { items: true },
      orderBy: { endDate: 'asc' },
      take: 5,
    });

    // 2. Today's Bookings (Starting today)
    const todaysRaw = await prisma.rental.findMany({
      where: {
        startDate: { gte: startOfToday, lte: endOfToday },
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // 3. Last Bookings (Most recent creations)
    const recentRaw = await prisma.rental.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const formatRental = (r: any) => ({
      ...r,
      itemCount: r.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
    });

    return NextResponse.json({
      overdue: overdueRaw.map(formatRental),
      todays: todaysRaw.map(formatRental),
      recent: recentRaw.map(formatRental),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
