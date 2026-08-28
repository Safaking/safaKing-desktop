import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { pushProductSync, pushProductListing } from '@/lib/sync';

/** Replace-all: whatever the form last submitted is the full, current set of alternate photos. */
async function saveAlternateImages(productId: string, alternateImages: unknown) {
  if (!Array.isArray(alternateImages)) return;
  const urls = alternateImages.filter((u): u is string => typeof u === 'string' && u.length > 0);

  await prisma.productImage.deleteMany({ where: { productId } });
  if (urls.length > 0) {
    await prisma.productImage.createMany({
      data: urls.map((url, i) => ({ productId, url, sortOrder: i })),
    });
  }
}

/**
 * The catalog, priced for whoever is asking.
 *
 * ?storeId=… returns each product at that branch's own price where it has set
 * one, falling back to the shop-wide rate. The same safa does not fetch the
 * same rate in Partapur as in Chitri, and the till has to ring up the local
 * one without staff remembering to adjust it.
 *
 * rentPrice and salePrice carry the resolved figure, so every screen that
 * already reads them prices correctly with no change. baseRentPrice and
 * baseSalePrice carry the shop-wide rate alongside, for the admin screens that
 * need to show what was overridden.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const storeId = url.searchParams.get('storeId');
    // Alternate photos are data URIs too. Only the admin edit dialog needs
    // them, so the till and the booking screen do not carry them at all —
    // otherwise this response grows back the moment more photos are added.
    const withImages = url.searchParams.get('withImages') === 'true';

    // Availability is aggregated in SQL. Previously every product was loaded
    // with all of its sale and rental rows so they could be summed in JS, which
    // made this endpoint slower with every order the shop took.
    //
    // Stock is per branch, with one exception: barati safas travel out to the
    // wedding, so every branch draws them from one shop-wide pool. Those keep
    // counting against Product.totalQuantity and against what the whole shop
    // has committed; everything else counts a branch's own shelf against that
    // branch's own orders, so Chitri selling a safa cannot empty Partapur.
    //
    // Orders taken before branches were recorded have a null storeId. They are
    // counted against the branch being asked about, because a shared pool that
    // silently ignores them would over-promise stock that is already out.
    //
    // A product nobody has divided between branches yet keeps behaving exactly
    // as it did: one shop-wide quantity against every order. Without that, the
    // day this ships every non-barati product reads as zero at every branch and
    // no booking can be taken until somebody has typed in the whole inventory.
    // Splitting a product is therefore something admin opts into, per product,
    // by giving it a quantity at any branch.
    // Kicked off together, not one after the other: the branch's price
    // overrides do not depend on the availability figures, and each round trip
    // to the database is the expensive part here.
    const overridesPromise = storeId
      ? prisma.storePrice.findMany({ where: { storeId } })
      : Promise.resolve([] as any[]);
    const altImagesPromise = withImages
      ? prisma.productImage.findMany({ orderBy: { sortOrder: 'asc' } })
      : Promise.resolve([] as any[]);

    const productsWithAvailability = storeId
      ? await prisma.$queryRaw`
        WITH sold AS (
          SELECT si."productId",
                 SUM(si."quantity") FILTER (
                   WHERE sa."storeId" = ${storeId} OR sa."storeId" IS NULL
                 ) AS branch_qty,
                 SUM(si."quantity") AS all_qty
          FROM "SaleItem" si
          JOIN "Sale" sa ON sa."id" = si."saleId"
          GROUP BY si."productId"
        ),
        out_on_rent AS (
          SELECT ri."productId",
                 SUM(GREATEST(0, ri."quantity" - ri."returnedQuantity")) FILTER (
                   WHERE r."storeId" = ${storeId} OR r."storeId" IS NULL
                 ) AS branch_qty,
                 SUM(GREATEST(0, ri."quantity" - ri."returnedQuantity")) AS all_qty
          FROM "RentalItem" ri
          JOIN "Rental" r ON r."id" = ri."rentalId"
          WHERE r."status" IN ('BOOKED', 'ACTIVE', 'OVERDUE')
            AND r."startDate" <= NOW()
            AND r."endDate" >= NOW()
          GROUP BY ri."productId"
        ),
        shelf AS (
          SELECT "productId", "quantity"
          FROM "StoreStock"
          WHERE "storeId" = ${storeId}
        ),
        split AS (
          SELECT DISTINCT "productId" FROM "StoreStock"
        )
        SELECT p.*,
               (p."productType" = ANY(${['Barati safa']}::text[])) AS "sharedStock",
               COALESCE(shelf."quantity", 0)::int AS "branchQuantity",
               (split."productId" IS NOT NULL) AS "stockSplit",
               CASE
                 WHEN p."productType" = ANY(${['Barati safa']}::text[])
                   OR split."productId" IS NULL THEN
                   GREATEST(0, p."totalQuantity"
                     - COALESCE(sold.all_qty, 0) - COALESCE(out_on_rent.all_qty, 0)
                     - COALESCE(web."webCommitted", 0))
                 ELSE
                   GREATEST(0, COALESCE(shelf."quantity", 0)
                     - COALESCE(sold.branch_qty, 0) - COALESCE(out_on_rent.branch_qty, 0)
                     - COALESCE(web."webCommitted", 0))
               END::int AS "availableQuantity"
        FROM "Product" p
        LEFT JOIN sold ON sold."productId" = p."id"
        LEFT JOIN out_on_rent ON out_on_rent."productId" = p."id"
        LEFT JOIN shelf ON shelf."productId" = p."id"
        LEFT JOIN split ON split."productId" = p."id"
        LEFT JOIN "WebCommitted" web ON web."sku" = p."sku"
      `
      : await prisma.$queryRaw`
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
            AND r."startDate" <= NOW()
            AND r."endDate" >= NOW()
          GROUP BY ri."productId"
        )
        SELECT p.*,
               (p."productType" = ANY(${['Barati safa']}::text[])) AS "sharedStock",
               NULL::int AS "branchQuantity",
               FALSE AS "stockSplit",
               GREATEST(0,
                 p."totalQuantity" - COALESCE(s.qty, 0) - COALESCE(o.qty, 0)
                   - COALESCE(web."webCommitted", 0)
               )::int AS "availableQuantity"
        FROM "Product" p
        LEFT JOIN sold s ON s."productId" = p."id"
        LEFT JOIN out_on_rent o ON o."productId" = p."id"
        LEFT JOIN "WebCommitted" web ON web."sku" = p."sku"
      `;

    // The photos come out of the listing entirely. They are data URIs on the
    // row, and shipping them inline made this response 6.8 MB — of which 6.5 MB
    // was base64 — and 25 seconds slow, before a single safa appeared. Screens
    // fetch each photo from /api/products/[id]/image, so the browser loads only
    // what is on screen and caches it.
    const products = (productsWithAvailability as any[]).map(p => {
      const { image, ...rest } = p;
      return { ...rest, hasImage: !!image };
    });

    // One extra query, not one per product — grouped in JS below. The admin
    // list only needs this to prefill the edit dialog's alternate-photos strip.
    const imagesByProduct = new Map<string, string[]>();
    for (const img of await altImagesPromise) {
      const list = imagesByProduct.get(img.productId) ?? [];
      list.push(img.url);
      imagesByProduct.set(img.productId, list);
    }

    // The base rate is always reported, so an admin screen can show what a
    // branch changed and what it left alone.
    const withBase = products.map(p => ({
      ...p,
      alternateImages: imagesByProduct.get(p.id) ?? [],
      baseRentPrice: p.rentPrice,
      baseSalePrice: p.salePrice,
      rentPriceOverridden: false,
      salePriceOverridden: false,
    }));

    if (!storeId) return NextResponse.json(withBase);

    const overrides = await overridesPromise;
    const byProduct = new Map(overrides.map(o => [o.productId, o]));

    // A null override means "use the shop rate", not "free" — so only a real
    // number replaces the base price.
    const priced = withBase.map(p => {
      const o = byProduct.get(p.id);
      const rent = typeof o?.rentPrice === 'number' ? o.rentPrice : null;
      const sale = typeof o?.salePrice === 'number' ? o.salePrice : null;
      return {
        ...p,
        rentPrice: rent ?? p.baseRentPrice,
        salePrice: sale ?? p.baseSalePrice,
        rentPriceOverridden: rent !== null,
        salePriceOverridden: sale !== null,
      };
    });

    return NextResponse.json(priced);
  } catch (error: any) {
    console.error('GET /api/products error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Basic validation
    if (!body.name || !body.sku) {
      return NextResponse.json({ error: 'Name and SKU are required' }, { status: 400 });
    }

    const rentPrice = parseFloat(body.rentPrice || '0');
    const salePrice = parseFloat(body.salePrice || '0');
    const discount = parseFloat(body.discount || '0');
    const totalQuantity = parseInt(body.totalQuantity || '0');

    if (isNaN(rentPrice) || isNaN(salePrice) || isNaN(discount) || isNaN(totalQuantity)) {
      return NextResponse.json({ error: 'Invalid numeric values' }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name: body.name,
        sku: body.sku,
        description: body.description || null,
        category: body.category || null,
        productType: body.productType || null,
        rentPrice,
        salePrice,
        discount,
        totalQuantity,
        isRentable: !!body.isRentable,
        isSellable: !!body.isSellable,
        image: body.image || null,
      } as any,
    });

    await saveAlternateImages(product.id, body.alternateImages);
    await pushProductListing(product.id);

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('POST /api/products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Convert numeric strings to actual numbers and filter data
    const updateData: any = {};
    const allowedFields = [
      'name', 'sku', 'description', 'category', 'productType',
      'rentPrice', 'salePrice', 'discount', 'totalQuantity', 
      'isRentable', 'isSellable', 'image'
    ];

    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = data[key];
      }
    });
    
    if (updateData.rentPrice !== undefined) {
      updateData.rentPrice = parseFloat(updateData.rentPrice?.toString() || '0') || 0;
    }
    
    if (updateData.salePrice !== undefined) {
      updateData.salePrice = parseFloat(updateData.salePrice?.toString() || '0') || 0;
    }

    if (updateData.discount !== undefined) {
      updateData.discount = parseFloat(updateData.discount?.toString() || '0') || 0;
    }
    
    if (updateData.totalQuantity !== undefined) {
      updateData.totalQuantity = parseInt(updateData.totalQuantity?.toString() || '0') || 0;
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    if (data.alternateImages !== undefined) {
      await saveAlternateImages(product.id, data.alternateImages);
    }

    // Baseline stock changed — SafaKing's own copy of it needs the update too.
    await pushProductSync([product.id]);
    // Catalogue fields (name/price/image/etc) may also have changed.
    await pushProductListing(product.id);

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('PUT /api/products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
