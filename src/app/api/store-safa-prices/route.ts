import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Per-branch tying rates, for the admin screen that sets them.
 *
 * GET ?storeId=…  → the overrides that branch has set
 * PUT { storeId, prices: [{ safaOptionId, price }, ...] }
 *
 * A blank price clears the override and puts the style back on the shop rate,
 * which keeps following later changes to it. A row exists only where a branch
 * deliberately charges differently.
 */
export async function GET(request: Request) {
  try {
    const storeId = new URL(request.url).searchParams.get('storeId');
    if (!storeId) {
      return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
    }
    return NextResponse.json(await prisma.storeSafaPrice.findMany({ where: { storeId } }));
  } catch (error: any) {
    console.error('GET /api/store-safa-prices error:', error);
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

    const rows: any[] = Array.isArray(body?.prices) ? body.prices : [];
    if (!rows.length) return NextResponse.json({ saved: 0, cleared: 0 });

    const known = new Set(
      (
        await prisma.safaOption.findMany({
          where: { id: { in: rows.map(r => r?.safaOptionId).filter(Boolean) } },
          select: { id: true },
        })
      ).map(o => o.id)
    );

    const ops: any[] = [];
    let saved = 0;
    let cleared = 0;

    for (const row of rows) {
      const safaOptionId = row?.safaOptionId;
      if (!safaOptionId || !known.has(safaOptionId)) continue;

      const raw = row.price;
      if (raw === null || raw === undefined || raw === '') {
        ops.push(prisma.storeSafaPrice.deleteMany({ where: { storeId, safaOptionId } }));
        cleared += 1;
        continue;
      }

      const price = parseFloat(raw.toString());
      // A typo must not become a zero the till would charge.
      if (!Number.isFinite(price) || price < 0) continue;

      ops.push(
        prisma.storeSafaPrice.upsert({
          where: { storeId_safaOptionId: { storeId, safaOptionId } },
          create: { storeId, safaOptionId, price },
          update: { price },
        })
      );
      saved += 1;
    }

    if (ops.length) await prisma.$transaction(ops);
    return NextResponse.json({ saved, cleared });
  } catch (error: any) {
    console.error('PUT /api/store-safa-prices error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save rates' }, { status: 500 });
  }
}
