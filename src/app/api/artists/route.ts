import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** Registered safa-tying artists. Admin manages these; tying orders allocate one. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const withWork = searchParams.get('withWork') === 'true';

    const artists = await prisma.artist.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      ...(withWork
        ? {
            include: {
              // Work comes from the shares, not the order: on a split order
              // this artist tied forty of the hundred safas and is owed for
              // forty.
              assignments: {
                orderBy: { createdAt: 'desc' },
                include: {
                  rental: {
                    select: {
                      id: true,
                      orderNumber: true,
                      customerName: true,
                      startDate: true,
                      safaTyingCount: true,
                      status: true,
                    },
                  },
                  sale: {
                    select: {
                      id: true,
                      orderNumber: true,
                      customerName: true,
                      createdAt: true,
                      safaTyingCount: true,
                    },
                  },
                },
              },
            },
          }
        : {}),
    });

    if (!withWork) return NextResponse.json(artists);

    // Earnings are this artist's rate times this artist's share, so they are
    // derived rather than stored.
    const withTotals = artists.map((a: any) => {
      const orders = a.assignments
        .filter((s: any) => s.rental || s.sale)
        .map((s: any) => {
          const order = s.rental ?? s.sale;
          return {
            id: order.id,
            assignmentId: s.id,
            kind: s.rental ? 'RENTAL' : 'SALE',
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            startDate: s.rental ? order.startDate : order.createdAt,
            status: s.rental ? order.status : 'SOLD',
            // What the order needed, against what this artist took on.
            orderSafaCount: order.safaTyingCount || 0,
            safaTyingCount: s.quantity,
            artistRate: s.rate,
            artistPaid: s.paid,
            earned: (s.rate || 0) * (s.quantity || 0),
          };
        });

      const earned = orders.reduce((s: number, o: any) => s + o.earned, 0);
      const paid = orders.filter((o: any) => o.artistPaid).reduce((s: number, o: any) => s + o.earned, 0);
      return {
        ...a,
        assignments: undefined,
        rentals: orders,
        orderCount: orders.length,
        safasTied: orders.reduce((s: number, o: any) => s + (o.safaTyingCount || 0), 0),
        totalEarned: earned,
        totalPaid: paid,
        totalDue: Math.max(0, earned - paid),
      };
    });

    return NextResponse.json(withTotals);
  } catch (error: any) {
    console.error('GET /api/artists error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body?.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const artist = await prisma.artist.create({
      data: {
        name,
        ratePerPiece: Math.max(0, parseFloat(body.ratePerPiece?.toString() ?? '') || 0),
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });
    return NextResponse.json(artist);
  } catch (error: any) {
    console.error('POST /api/artists error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create artist' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body?.id) {
      return NextResponse.json({ error: 'Artist ID is required' }, { status: 400 });
    }

    const data: any = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if ('ratePerPiece' in body) {
      const parsed = parseFloat(body.ratePerPiece?.toString() ?? '');
      data.ratePerPiece = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    }
    if ('phone' in body) data.phone = body.phone?.trim() || null;
    if ('address' in body) data.address = body.address?.trim() || null;
    if ('notes' in body) data.notes = body.notes?.trim() || null;
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;

    const artist = await prisma.artist.update({ where: { id: body.id }, data });
    return NextResponse.json(artist);
  } catch (error: any) {
    console.error('PUT /api/artists error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update artist' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Artist ID is required' }, { status: 400 });
    }

    // Orders already allocated to this artist must keep their history, so an
    // artist with work against them is deactivated rather than deleted.
    const allocated = await prisma.tyingAssignment.count({ where: { artistId: id } });
    if (allocated > 0) {
      const artist = await prisma.artist.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({
        ...artist,
        deactivated: true,
        message: `Artist has ${allocated} order${allocated === 1 ? '' : 's'} allocated, so they were marked inactive instead of deleted.`,
      });
    }

    await prisma.artist.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/artists error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete artist' }, { status: 500 });
  }
}
