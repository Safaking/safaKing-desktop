import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Per-branch product prices, for the admin screen that sets them.
 *
 * GET  ?storeId=…  → every override that branch has set
 * PUT  { storeId, prices: [{ productId, rentPrice, salePrice }, ...] }
 *
 * A price of null (or an empty string) clears that override and puts the
 * product back on the shop-wide rate. Sending both as null removes the row
 * entirely rather than leaving an empty one behind.
 */

/** '' and null clear the override; a real number sets it. Junk is rejected. */
const parsePrice = (v: any): number | null | undefined => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v.toString());
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
};

export async function GET(request: Request) {
  try {
    const storeId = new URL(request.url).searchParams.get('storeId');
    if (!storeId) {
      return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
    }

    const prices = await prisma.storePrice.findMany({ where: { storeId } });
    return NextResponse.json(prices);
  } catch (error: any) {
    console.error('GET /api/store-prices error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const storeId = body?.storeId;
    if (!storeId) {
      return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
    }

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    const rows: any[] = Array.isArray(body?.prices) ? body.prices : [];
    if (!rows.length) return NextResponse.json({ saved: 0, cleared: 0 });

    const ids = rows.map(r => r?.productId).filter(Boolean);
    const known = new Set(
      (await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true } })).map(
        p => p.id
      )
    );

    const ops: any[] = [];
    let saved = 0;
    let cleared = 0;

    for (const row of rows) {
      const productId = row?.productId;
      if (!productId || !known.has(productId)) continue;

      const rentPrice = parsePrice(row.rentPrice);
      const salePrice = parsePrice(row.salePrice);
      // A price that is neither blank nor a valid number is a typo, not an
      // instruction — skip it rather than storing a zero the till would charge.
      if (rentPrice === undefined || salePrice === undefined) continue;

      if (rentPrice === null && salePrice === null) {
        ops.push(
          prisma.storePrice.deleteMany({ where: { storeId, productId } })
        );
        cleared += 1;
        continue;
      }

      ops.push(
        prisma.storePrice.upsert({
          where: { storeId_productId: { storeId, productId } },
          create: { storeId, productId, rentPrice, salePrice },
          update: { rentPrice, salePrice },
        })
      );
      saved += 1;
    }

    if (ops.length) await prisma.$transaction(ops);

    return NextResponse.json({ saved, cleared });
  } catch (error: any) {
    console.error('PUT /api/store-prices error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save prices' }, { status: 500 });
  }
}
