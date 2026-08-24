import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Receives a push from SafaKing (the web storefront, a separate database)
 * whenever a SKU's web-committed quantity changes — see
 * src/lib/inventory.ts, which subtracts this so the shop's own availability
 * figure accounts for web sales too.
 */

function authorized(request: Request): boolean {
  const expected = process.env.SYNC_SHARED_SECRET;
  if (!expected) return false;

  const provided = request.headers.get('x-sync-secret') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { sku?: string; webCommitted?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'malformed body' }, { status: 400 });
  }

  const sku = body.sku?.trim();
  const webCommitted = Number(body.webCommitted);

  if (!sku || !Number.isFinite(webCommitted)) {
    return NextResponse.json({ error: 'sku and webCommitted are required' }, { status: 400 });
  }

  try {
    await prisma.webCommitted.upsert({
      where: { sku },
      create: { sku, webCommitted },
      update: { webCommitted },
    });
  } catch (error: any) {
    console.error('[sync/web-committed]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
