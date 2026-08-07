import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normaliseShares, validateShares, legacyMirror } from '@/lib/tying-split';

/**
 * Allocate the tying on a sale, split across one or more artists.
 * The rental route carries the full explanation; this mirrors it.
 */
export async function POST(request: Request, { params }: { params: any }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;
    if (!id) return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });

    const body = await request.json().catch(() => ({}));

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { tyingAssignments: true },
    });
    if (!sale) return NextResponse.json({ error: 'Sale order not found' }, { status: 404 });

    const raw = Array.isArray(body?.shares)
      ? body.shares
      : body?.artistId
      ? [
          {
            artistId: body.artistId,
            quantity: sale.safaTyingCount || 0,
            rate: body.artistRate,
            paid: body.artistPaid,
          },
        ]
      : [];

    const shares = normaliseShares(raw);

    if (shares.length) {
      const found = await prisma.artist.findMany({
        where: { id: { in: shares.map(s => s.artistId) } },
        select: { id: true },
      });
      if (found.length !== shares.length) {
        return NextResponse.json({ error: 'Artist not found' }, { status: 400 });
      }
    }

    const check = validateShares(shares, sale.safaTyingCount || 0);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const isAdmin = body?.role === 'ADMIN';
    const existing = new Map(sale.tyingAssignments.map(a => [a.artistId, a]));
    const toStore = shares.map(s => {
      const before = existing.get(s.artistId);
      return isAdmin
        ? s
        : { ...s, rate: before?.rate ?? s.rate, paid: before?.paid ?? false };
    });

    await prisma.$transaction([
      prisma.tyingAssignment.deleteMany({ where: { saleId: id } }),
      ...toStore.map(s =>
        prisma.tyingAssignment.create({
          data: {
            saleId: id,
            artistId: s.artistId,
            quantity: s.quantity,
            rate: s.rate,
            paid: s.paid,
          },
        })
      ),
      prisma.sale.update({ where: { id }, data: legacyMirror(toStore) }),
    ]);

    const updated = await prisma.sale.findUnique({
      where: { id },
      include: { artist: true, tyingAssignments: { include: { artist: true } } },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('POST /api/sales/[id]/artist error:', error);
    return NextResponse.json({ error: error.message || 'Failed to allocate artist' }, { status: 500 });
  }
}
