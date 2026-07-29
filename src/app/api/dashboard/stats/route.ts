import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      bookedRentalsCount,
      activeRentalsCount, 
      overdueRentalsCount, 
      returnedRentalsCount,
      products,
      salesCount,
      rentalsTotal, 
      salesTotal
    ] = await Promise.all([
      prisma.rental.count({ where: { status: 'BOOKED' } }),
      prisma.rental.count({ 
        where: { 
          status: 'ACTIVE',
          endDate: { gte: startOfToday }
        } 
      }),
      prisma.rental.count({ 
        where: { 
          status: 'ACTIVE',
          endDate: { lt: startOfToday }
        } 
      }),
      prisma.rental.count({ where: { status: 'RETURNED' } }),
      prisma.product.findMany({
        include: {
          sales: true,
          rentals: {
            where: {
              rental: {
                status: { in: ['BOOKED', 'ACTIVE', 'OVERDUE'] },
              },
            },
          },
        },
      }),
      prisma.sale.count(),
      prisma.rental.aggregate({
        _sum: { totalAmount: true }
      }),
      prisma.sale.aggregate({
        _sum: { totalAmount: true }
      })
    ]);

    const totalStock = products.reduce((sum, p) => sum + (p.totalQuantity || 0), 0);
    const availableStock = products.reduce((sum, p) => {
      const soldQty = p.sales.reduce((s, item) => s + item.quantity, 0);
      const unreturnedQty = p.rentals.reduce((s, item) => {
        const outstanding = item.quantity - item.returnedQuantity;
        return s + Math.max(0, outstanding);
      }, 0);
      return sum + Math.max(0, p.totalQuantity - soldQty - unreturnedQty);
    }, 0);

    const revenue = (rentalsTotal._sum.totalAmount || 0) + (salesTotal._sum.totalAmount || 0);
    const totalRentals = bookedRentalsCount + activeRentalsCount + overdueRentalsCount + returnedRentalsCount;

    return NextResponse.json({
      bookedRentals: bookedRentalsCount,
      activeRentals: activeRentalsCount,
      overdueRentals: overdueRentalsCount,
      returnedRentals: returnedRentalsCount,
      totalRentals,
      productCount: products.length,
      totalStockQty: totalStock,
      availableStockQty: availableStock,
      salesCount,
      totalOrdersCount: totalRentals + salesCount,
      revenue
    });
  } catch (error: any) {
    console.error('GET /api/dashboard/stats error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
