import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Allocate (or clear) the tying artist on a rental order.
 *
 * Body: { artistId: string | null, artistRate?: number, artistPaid?: boolean }
 * artistRate is per safa; the amount owed is rate * safaTyingCount.
 * Clearing the artist also resets the rate and paid flag so an unallocated
 * order never carries a stray amount owed to nobody.
 */
export async function POST(request: Request, { params }: { params: any }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;
    if (!id) {
      return NextResponse.json({ error: 'Rental ID is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const artistId = body?.artistId || null;

    const rental = await prisma.rental.findUnique({ where: { id } });
    if (!rental) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (artistId) {
      const artist = await prisma.artist.findUnique({ where: { id: artistId } });
      if (!artist) {
        return NextResponse.json({ error: 'Artist not found' }, { status: 400 });
      }
    }

    // A real zero rate must stay zero, so parse explicitly rather than with `||`.
    const parsedRate = parseFloat(body?.artistRate?.toString() ?? '');
    const rate = Number.isFinite(parsedRate) && parsedRate >= 0 ? parsedRate : 0;

    const updated = await prisma.rental.update({
      where: { id },
      data: artistId
        ? { artistId, artistRate: rate, artistPaid: !!body?.artistPaid }
        : { artistId: null, artistRate: 0, artistPaid: false },
      include: { artist: true },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('POST /api/rentals/[id]/artist error:', error);
    return NextResponse.json({ error: error.message || 'Failed to allocate artist' }, { status: 500 });
  }
}
