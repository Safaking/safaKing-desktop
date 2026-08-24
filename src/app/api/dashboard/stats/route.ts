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
      stockRows,
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
      // Stock totals are aggregated in SQL. Loading every product with all of
      // its sale and rental rows just to sum them grew linearly with the
      // dataset and dominated this endpoint's latency.
      prisma.$queryRaw<{ product_count: bigint; total_stock: bigint; available_stock: bigint }[]>`
        WITH sold AS (
          SELECT "productId", SUM("quantity") AS qty
          FROM "SaleItem"
          GROUP BY "productId"
        ),
        out_on_rent AS (
          SELECT ri."productId",
                 SUM(GREATEST(0, ri."quantity" - ri."returnedQuantity")) AS qty
          FROM "RentalItem" ri
          JOIN "Rental" r ON r."id" = ri."rentalId"
          WHERE r."status" IN ('BOOKED', 'ACTIVE', 'OVERDUE')
          GROUP BY ri."productId"
        )
        SELECT
          COUNT(*)::bigint AS product_count,
          COALESCE(SUM(p."totalQuantity"), 0)::bigint AS total_stock,
          COALESCE(SUM(GREATEST(0,
            p."totalQuantity" - COALESCE(s.qty, 0) - COALESCE(o.qty, 0) - COALESCE(web."webCommitted", 0)
          )), 0)::bigint AS available_stock
        FROM "Product" p
        LEFT JOIN sold s ON s."productId" = p."id"
        LEFT JOIN out_on_rent o ON o."productId" = p."id"
        LEFT JOIN "WebCommitted" web ON web."sku" = p."sku"
      `,
      prisma.sale.count(),
      prisma.rental.aggregate({
        _sum: { totalAmount: true }
      }),
      prisma.sale.aggregate({
        _sum: { totalAmount: true }
      })
    ]);

    const stock = stockRows[0];
    const productCount = Number(stock?.product_count ?? 0);
    const totalStock = Number(stock?.total_stock ?? 0);
    const availableStock = Number(stock?.available_stock ?? 0);

    const revenue = (rentalsTotal._sum.totalAmount || 0) + (salesTotal._sum.totalAmount || 0);
    const totalRentals = bookedRentalsCount + activeRentalsCount + overdueRentalsCount + returnedRentalsCount;

    return NextResponse.json({
      bookedRentals: bookedRentalsCount,
      activeRentals: activeRentalsCount,
      overdueRentals: overdueRentalsCount,
      returnedRentals: returnedRentalsCount,
      totalRentals,
      productCount,
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
