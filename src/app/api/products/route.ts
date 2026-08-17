import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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
    const storeId = new URL(request.url).searchParams.get('storeId');
    // Availability is aggregated in SQL. Previously every product was loaded
    // with all of its sale and rental rows so they could be summed in JS, which
    // made this endpoint slower with every order the shop took.
    const productsWithAvailability = await prisma.$queryRaw`
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
             GREATEST(0,
               p."totalQuantity" - COALESCE(s.qty, 0) - COALESCE(o.qty, 0)
             )::int AS "availableQuantity"
      FROM "Product" p
      LEFT JOIN sold s ON s."productId" = p."id"
      LEFT JOIN out_on_rent o ON o."productId" = p."id"
    `;

    const products = productsWithAvailability as any[];

    // The base rate is always reported, so an admin screen can show what a
    // branch changed and what it left alone.
    const withBase = products.map(p => ({
      ...p,
      baseRentPrice: p.rentPrice,
      baseSalePrice: p.salePrice,
      rentPriceOverridden: false,
      salePriceOverridden: false,
    }));

    if (!storeId) return NextResponse.json(withBase);

    const overrides = await prisma.storePrice.findMany({ where: { storeId } });
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
    return NextResponse.json(product);
  } catch (error: any) {
    console.error('PUT /api/products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
