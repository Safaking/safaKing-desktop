import { prisma } from './prisma';

/**
 * Pushes "how many of this product this shop has committed" to SafaKing's
 * web storefront, so its own availability figure accounts for shop-floor
 * sales/rentals too. SERVER ONLY.
 *
 * Best-effort: a sale or rental must never fail because the web project is
 * briefly unreachable. Failures are logged, not thrown — the web side's
 * cached number just goes stale until the next successful push.
 */
export async function pushProductSync(productIds: string[]) {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const webSyncUrl = process.env.WEB_SYNC_URL;
  const secret = process.env.SYNC_SHARED_SECRET;
  if (!webSyncUrl || !secret) {
    console.warn('[sync] WEB_SYNC_URL or SYNC_SHARED_SECRET not set — skipping push.');
    return;
  }

  await Promise.all(
    uniqueIds.map(async (productId) => {
      try {
        const product = await prisma.product.findUnique({
          where: { id: productId },
          select: { sku: true, totalQuantity: true },
        });
        if (!product?.sku) return;

        const desktopCommitted = await getDesktopCommittedForProduct(productId);

        const res = await fetch(webSyncUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-sync-secret': secret },
          body: JSON.stringify({
            sku: product.sku,
            totalQuantity: product.totalQuantity,
            desktopCommitted,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          console.warn(`[sync] push for ${product.sku} responded ${res.status}`);
        }
      } catch (err) {
        console.warn(`[sync] push for product ${productId} failed:`, err instanceof Error ? err.message : err);
      }
    })
  );
}

/**
 * Pushes a product's LISTING (name, price, image, etc — not just stock) to
 * SafaKing, so it can show up in the web catalogue. A brand new SKU lands
 * there inactive/pending an admin's review; an already-known SKU gets its
 * catalogue fields refreshed but never its price or active state — see
 * safa-king's POST /api/sync/desktop-product. SERVER ONLY, best-effort.
 */
export async function pushProductListing(productId: string) {
  const webProductSyncUrl = process.env.WEB_PRODUCT_SYNC_URL;
  const secret = process.env.SYNC_SHARED_SECRET;
  if (!webProductSyncUrl || !secret) {
    console.warn('[sync] WEB_PRODUCT_SYNC_URL or SYNC_SHARED_SECRET not set — skipping push.');
    return;
  }

  try {
    const [product, images] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        select: {
          sku: true, name: true, description: true, category: true, image: true,
          salePrice: true, isRentable: true, rentPrice: true,
        },
      }),
      prisma.productImage.findMany({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
        select: { url: true },
      }),
    ]);
    if (!product?.sku) return;

    const res = await fetch(webProductSyncUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sync-secret': secret },
      body: JSON.stringify({
        sku: product.sku,
        name: product.name,
        description: product.description,
        category: product.category,
        image: product.image,
        alternateImages: images.map((i) => i.url),
        desktopPrice: product.salePrice,
        isRentable: product.isRentable,
        rentPricePerDay: product.rentPrice,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[sync] product-listing push for ${product.sku} responded ${res.status}`);
    }
  } catch (err) {
    console.warn(`[sync] product-listing push for ${productId} failed:`, err instanceof Error ? err.message : err);
  }
}

/** Every safa sold (ever) plus currently out on rent (unreturned), for one product. */
async function getDesktopCommittedForProduct(productId: string): Promise<number> {
  const [soldAgg, rentalItems] = await Promise.all([
    prisma.saleItem.aggregate({ where: { productId }, _sum: { quantity: true } }),
    prisma.rentalItem.findMany({
      where: { productId, rental: { status: { in: ['BOOKED', 'ACTIVE', 'OVERDUE'] } } },
      select: { quantity: true, returnedQuantity: true },
    }),
  ]);

  const sold = soldAgg._sum.quantity ?? 0;
  const outOnRent = rentalItems.reduce(
    (sum, item) => sum + Math.max(0, item.quantity - item.returnedQuantity),
    0
  );

  return sold + outOnRent;
}
