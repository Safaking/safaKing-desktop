import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: any }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;
    if (!id) return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const artistId = body?.artistId || null;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return NextResponse.json({ error: 'Sale order not found' }, { status: 404 });

    if (artistId) {
      const artist = await prisma.artist.findUnique({ where: { id: artistId } });
      if (!artist) return NextResponse.json({ error: 'Artist not found' }, { status: 400 });
    }

    const parsedRate = parseFloat(body?.artistRate?.toString() ?? '');
    const rate = Number.isFinite(parsedRate) && parsedRate >= 0 ? parsedRate : 0;
    const isAdmin = body?.role === 'ADMIN';

    const updated = await prisma.sale.update({
      where: { id },
      data: artistId
        ? {
            artistId,
            ...(isAdmin ? { artistRate: rate, artistPaid: !!body?.artistPaid } : {}),
          }
        : { artistId: null, artistRate: 0, artistPaid: false },
      include: { artist: true },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('POST /api/sales/[id]/artist error:', error);
    return NextResponse.json({ error: error.message || 'Failed to allocate artist' }, { status: 500 });
  }
}
