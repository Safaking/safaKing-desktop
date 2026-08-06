import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { needsArtist, baratiCount, slotOf, type Slot } from '@/lib/barati';

/**
 * How much barati tying is already booked on one date, split morning/evening.
 *
 * Asked before a new barati booking is confirmed. The shop has a fixed number
 * of artists and a baraat happens at a set hour, so two orders at the same
 * hour need two sets of people — taking the booking without seeing what is
 * already on that slot is how the day ends up oversold, and it is only found
 * out on the morning itself.
 *
 * GET ?date=yyyy-mm-dd
 */

type Row = {
  kind: 'BOOKING' | 'SALE';
  id: string;
  orderNumber: string;
  customerName: string;
  time: string | null;
  safas: number;
  artistId: string | null;
  artistName: string | null;
};

const select = {
  id: true,
  orderNumber: true,
  customerName: true,
  tieSafa: true,
  safaShape: true,
  safaTyingStyles: true,
  safaTyingCount: true,
  safaTyingTime: true,
  artistId: true,
  artist: { select: { name: true } },
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'A date of yyyy-mm-dd is required' }, { status: 400 });
    }

    const [rentals, sales, artists] = await Promise.all([
      prisma.rental.findMany({
        where: { tieSafa: true, safaTyingDate: date, status: { not: 'CANCELLED' } },
        select,
      }),
      prisma.sale.findMany({ where: { tieSafa: true, safaTyingDate: date }, select }),
      prisma.artist.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    ]);

    const rows: Row[] = [
      ...rentals.map(r => ({ ...r, kind: 'BOOKING' as const })),
      ...sales.map(s => ({ ...s, kind: 'SALE' as const })),
    ]
      // Only barati tying travels; the rest is tied at the counter.
      .filter(needsArtist)
      .map(o => ({
        kind: o.kind,
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        time: o.safaTyingTime,
        safas: baratiCount(o),
        artistId: o.artistId,
        artistName: o.artist?.name ?? null,
      }));

    const bySlot = (slot: Slot) => {
      const list = rows
        .filter(r => slotOf(r.time) === slot)
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

      // An artist on two orders in the same slot is one artist, not two.
      const committed = new Set(list.map(r => r.artistId).filter(Boolean) as string[]);

      return {
        orders: list,
        orderCount: list.length,
        safas: list.reduce((s, r) => s + r.safas, 0),
        unallocated: list.filter(r => !r.artistId).length,
        artistsCommitted: committed.size,
        artistsFree: Math.max(0, artists.length - committed.size),
      };
    };

    return NextResponse.json({
      date,
      artistTotal: artists.length,
      AM: bySlot('AM'),
      PM: bySlot('PM'),
    });
  } catch (error: any) {
    console.error('GET /api/tying-load error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load the tying schedule' },
      { status: 500 }
    );
  }
}
