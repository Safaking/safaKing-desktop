import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth } from 'date-fns';

export async function GET() {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startM = startOfMonth(now);
    const endM = endOfMonth(now);

    const [activeRentals, overdueRentalsCount, productCount, rentalsMonth, salesMonth] = await Promise.all([
      prisma.rental.count({ where: { status: { in: ['ACTIVE', 'BOOKED'] } } }),
      prisma.rental.count({ 
        where: { 
          status: { in: ['ACTIVE', 'BOOKED'] },
          endDate: { lt: startOfToday }
        } 
      }),
      prisma.product.count(),
      prisma.rental.aggregate({
        where: { createdAt: { gte: startM, lte: endM } },
        _sum: { totalAmount: true }
      }),
      prisma.sale.aggregate({
        where: { createdAt: { gte: startM, lte: endM } },
        _sum: { totalAmount: true }
      })
    ]);

    const revenue = (rentalsMonth._sum.totalAmount || 0) + (salesMonth._sum.totalAmount || 0);

    return NextResponse.json({
      activeRentals,
      overdueRentals: overdueRentalsCount,
      productCount,
      revenue
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
