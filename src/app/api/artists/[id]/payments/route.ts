import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Artist ledger payments for a single artist.
 *
 * GET  /api/artists/[id]/payments  — list all payments for this artist, with totals
 * POST /api/artists/[id]/payments  — add a new payment entry
 * DELETE /api/artists/[id]/payments?paymentId=xxx  — remove a payment entry
 */

export async function GET(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Artist ID required' }, { status: 400 });

    const [artist, payments, rentals] = await Promise.all([
      prisma.artist.findUnique({ where: { id } }),
      prisma.artistPayment.findMany({
        where: { artistId: id },
        orderBy: { paidAt: 'desc' },
      }),
      // The artist's shares, not the whole orders — on a split order they are
      // owed for the safas they tied, not for all of them.
      prisma.tyingAssignment.findMany({
        where: { artistId: id },
        include: {
          rental: {
            select: {
              id: true,
              orderNumber: true,
              customerName: true,
              createdAt: true,
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
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!artist) return NextResponse.json({ error: 'Artist not found' }, { status: 404 });

    const orders = rentals
      .filter((s: any) => s.rental || s.sale)
      .map((s: any) => {
        const order = s.rental ?? s.sale;
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          createdAt: order.createdAt,
          startDate: s.rental ? order.startDate : order.createdAt,
          status: s.rental ? order.status : 'SOLD',
          orderSafaCount: order.safaTyingCount || 0,
          safaTyingCount: s.quantity,
          artistRate: s.rate,
          artistPaid: s.paid,
          earned: (s.rate || 0) * (s.quantity || 0),
        };
      });

    const totalEarned = orders.reduce((s: number, o: any) => s + o.earned, 0);
    const totalPaidViaLedger = payments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const balance = Math.max(0, totalEarned - totalPaidViaLedger);

    return NextResponse.json({
      artist,
      payments,
      orders,
      totalEarned,
      totalPaidViaLedger,
      balance,
    });
  } catch (error: any) {
    console.error('GET /api/artists/[id]/payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Artist ID required' }, { status: 400 });

    const body = await request.json();
    const amount = parseFloat(body?.amount?.toString() ?? '');
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'A valid positive amount is required' }, { status: 400 });
    }

    const artist = await prisma.artist.findUnique({ where: { id } });
    if (!artist) return NextResponse.json({ error: 'Artist not found' }, { status: 404 });

    // Ensure the ArtistPayment table exists (auto-migration)
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ArtistPayment" (
          "id" TEXT NOT NULL,
          "artistId" TEXT NOT NULL,
          "amount" DOUBLE PRECISION NOT NULL,
          "note" TEXT,
          "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "paidBy" TEXT,
          CONSTRAINT "ArtistPayment_pkey" PRIMARY KEY ("id")
        );
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ArtistPayment" ADD COLUMN IF NOT EXISTS "artistId" TEXT;
      `);
    } catch {
      // Table likely already exists
    }

    const payment = await prisma.artistPayment.create({
      data: {
        artistId: id,
        amount,
        note: body?.note?.trim() || null,
        paidAt: body?.paidAt ? new Date(body.paidAt) : new Date(),
        paidBy: body?.paidBy?.trim() || null,
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/artists/[id]/payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');

    if (!id || !paymentId) {
      return NextResponse.json({ error: 'Artist ID and Payment ID are required' }, { status: 400 });
    }

    await prisma.artistPayment.delete({ where: { id: paymentId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/artists/[id]/payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
