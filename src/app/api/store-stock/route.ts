import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSharedStock } from '@/lib/product-types';

/**
 * How many of each product a branch holds.
 *
 * GET ?storeId=…  → that branch's shelf
 * PUT { storeId, stock: [{ productId, quantity }, ...] }
 *
 * A blank quantity removes the row, which puts that product back on the
 * undivided shop-wide count everywhere. Barati safas are refused: they travel
 * out to weddings from one shop pool, so dividing them between branches would
 * describe something the shop does not do.
 */
export async function GET(request: Request) {
  try {
    const storeId = new URL(request.url).searchParams.get('storeId');
    if (!storeId) {
      return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
    }
    return NextResponse.json(await prisma.storeStock.findMany({ where: { storeId } }));
  } catch (error: any) {
    console.error('GET /api/store-stock error:', error);
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
    if (!store) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    const rows: any[] = Array.isArray(body?.stock) ? body.stock : [];
    if (!rows.length) return NextResponse.json({ saved: 0, cleared: 0 });

    const products = await prisma.product.findMany({
      where: { id: { in: rows.map(r => r?.productId).filter(Boolean) } },
      select: { id: true, productType: true },
    });
    const byId = new Map(products.map(p => [p.id, p]));

    const ops: any[] = [];
    let saved = 0;
    let cleared = 0;
    let refused = 0;

    for (const row of rows) {
      const product = byId.get(row?.productId);
      if (!product) continue;
      if (isSharedStock(product)) {
        refused += 1;
        continue;
      }

      const raw = row.quantity;
      if (raw === null || raw === undefined || raw === '') {
        ops.push(prisma.storeStock.deleteMany({ where: { storeId, productId: product.id } }));
        cleared += 1;
        continue;
      }

      const quantity = Math.trunc(Number(raw));
      // A typo must not silently become a zero that stops the branch selling.
      if (!Number.isFinite(quantity) || quantity < 0) continue;

      ops.push(
        prisma.storeStock.upsert({
          where: { storeId_productId: { storeId, productId: product.id } },
          create: { storeId, productId: product.id, quantity },
          update: { quantity },
        })
      );
      saved += 1;
    }

    if (ops.length) await prisma.$transaction(ops);
    return NextResponse.json({ saved, cleared, refused });
  } catch (error: any) {
    console.error('PUT /api/store-stock error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save stock' }, { status: 500 });
  }
}
