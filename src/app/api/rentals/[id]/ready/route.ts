import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Mark a rental order ready for handover, or undo that.
 *
 * Body: { ready: boolean, readyBy?: string }
 * Records who set it and when so the report can show an audit trail; clearing
 * it wipes both fields rather than leaving a stale name behind.
 */
export async function POST(request: Request, { params }: { params: any }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;
    if (!id) {
      return NextResponse.json({ error: 'Rental ID is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const ready = body?.ready !== false; // default to marking ready
    const readyBy = typeof body?.readyBy === 'string' ? body.readyBy.trim() : '';

    const existing = await prisma.rental.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const rental = await prisma.rental.update({
      where: { id },
      data: ready
        ? { readyAt: new Date(), readyBy: readyBy || null }
        : { readyAt: null, readyBy: null },
    });

    return NextResponse.json(rental);
  } catch (error: any) {
    console.error('POST /api/rentals/[id]/ready error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update ready state' }, { status: 500 });
  }
}
