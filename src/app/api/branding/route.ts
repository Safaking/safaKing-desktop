import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Which mark a branch trades under.
 *
 * Partapur has always been Joshi Safa House and its customers know that bill;
 * the newer branches trade as Safa King. The mark therefore belongs to the
 * branch, not to the app, and the bill has to carry whichever branch took the
 * order — not whichever branch happens to be printing it.
 *
 * GET            → every branch
 * GET ?storeId=  → just that one, resolved to a usable logo path
 */

export const DEFAULT_LOGO = '/assets/logo.png?v=4';

export async function GET(request: Request) {
  try {
    const storeId = new URL(request.url).searchParams.get('storeId');

    if (storeId) {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true, location: true, logo: true },
      });
      // An unknown branch still gets a bill, with the shop default on it.
      return NextResponse.json({
        id: store?.id ?? null,
        name: store?.name ?? null,
        location: store?.location ?? null,
        logo: store?.logo || DEFAULT_LOGO,
      });
    }

    const stores = await prisma.store.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, location: true, logo: true },
    });
    return NextResponse.json(
      stores.map(s => ({ ...s, logo: s.logo || DEFAULT_LOGO }))
    );
  } catch (error: any) {
    console.error('GET /api/branding error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
