import { prisma } from './prisma';

/**
 * Availability Algorithm (CRITICAL)
 * Available quantity = totalQuantity − soldQuantity − maxOverlappingRentals − webCommitted
 *
 * webCommitted is how many SafaKing's web storefront (a separate database)
 * has sold against this SKU — pushed here by POST /api/sync/web-committed.
 * Not date-windowed like rentals: a web sale is a permanent commitment
 * against this shop's stock, not tied to a rental period.
 */
export async function getProductAvailability(
  productId: string,
  startDate: Date,
  endDate: Date
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      sales: true,
      rentals: {
        where: {
          rental: {
            status: { in: ['BOOKED', 'ACTIVE', 'OVERDUE'] },
            OR: [
              {
                AND: [
                  { startDate: { lte: endDate } },
                  { endDate: { gte: startDate } },
                ],
              },
            ],
          },
        },
        include: { rental: true },
      },
    },
  });

  if (!product) throw new Error('Product not found');

  const soldQuantity = product.sales.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate unreturned rental quantity within the date range
  const unreturnedRentalQuantity = product.rentals.reduce((sum, item) => {
    const outstanding = item.quantity - item.returnedQuantity;
    return sum + Math.max(0, outstanding);
  }, 0);

  const webCommitted = product.sku
    ? (await prisma.webCommitted.findUnique({ where: { sku: product.sku } }))?.webCommitted ?? 0
    : 0;

  const available = product.totalQuantity - soldQuantity - unreturnedRentalQuantity - webCommitted;

  return Math.max(0, available);
}

/**
 * Gets the current physical stock in hand (Total - Sold - Currently Out)
 */
export async function getProductStockInHand(productId: string) {
  const now = new Date();
  // We check for rentals that are currently active (or booked for today)
  return getProductAvailability(productId, now, now);
}

export async function checkMultiProductAvailability(
  items: { productId: string; quantity: number }[],
  startDate: Date,
  endDate: Date
) {
  const results = await Promise.all(
    items.map(async (item) => {
      const available = await getProductAvailability(item.productId, startDate, endDate);
      return {
        productId: item.productId,
        requested: item.quantity,
        available,
        isAvailable: available >= item.quantity,
      };
    })
  );

  return {
    allAvailable: results.every((r) => r.isAvailable),
    details: results,
  };
}
