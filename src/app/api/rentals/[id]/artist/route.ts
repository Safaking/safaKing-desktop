import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normaliseShares, validateShares, legacyMirror } from '@/lib/tying-split';
import { baratiCount } from '@/lib/barati';

/**
 * Allocate the tying on a rental order, split across one or more artists.
 *
 * Body: { shares: [{ artistId, quantity, rate?, paid? }, ...], role? }
 *
 * A big order is shared out — forty safas to one artist, sixty to another —
 * so the whole split is sent at once and replaces whatever was there. An empty
 * list clears the order.
 *
 * A super may set who ties and how many, but not money: rate and paid are
 * admin-only and are carried over from what is already stored when anyone else
 * saves, so a super rearranging the split cannot quietly reset a rate to zero.
 */
export async function POST(request: Request, { params }: { params: any }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;
    if (!id) {
      return NextResponse.json({ error: 'Rental ID is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    const rental = await prisma.rental.findUnique({
      where: { id },
      include: { tyingAssignments: true },
    });
    if (!rental) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Accept the older single-artist body too, so an out-of-date client (a
    // desktop app that has not been restarted) keeps working.
    const raw = Array.isArray(body?.shares)
      ? body.shares
      : body?.artistId
      ? [
          {
            artistId: body.artistId,
            quantity: baratiCount(rental),
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

    // Artists are only sent out for barati; the counter ties the rest.
    const check = validateShares(shares, baratiCount(rental));
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    // A super's save must not move rates or paid flags, so those come back off
    // what is already stored for that artist.
    const isAdmin = body?.role === 'ADMIN';
    const existing = new Map(rental.tyingAssignments.map(a => [a.artistId, a]));
    const toStore = shares.map(s => {
      const before = existing.get(s.artistId);
      return isAdmin
        ? s
        : { ...s, rate: before?.rate ?? s.rate, paid: before?.paid ?? false };
    });

    // Replace the whole split in one go: rewriting is far simpler to reason
    // about than diffing rows, and the set is never more than a handful.
    await prisma.$transaction([
      prisma.tyingAssignment.deleteMany({ where: { rentalId: id } }),
      ...toStore.map(s =>
        prisma.tyingAssignment.create({
          data: {
            rentalId: id,
            artistId: s.artistId,
            quantity: s.quantity,
            rate: s.rate,
            paid: s.paid,
          },
        })
      ),
      prisma.rental.update({ where: { id }, data: legacyMirror(toStore) }),
    ]);

    const updated = await prisma.rental.findUnique({
      where: { id },
      include: { artist: true, tyingAssignments: { include: { artist: true } } },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('POST /api/rentals/[id]/artist error:', error);
    return NextResponse.json({ error: error.message || 'Failed to allocate artist' }, { status: 500 });
  }
}
