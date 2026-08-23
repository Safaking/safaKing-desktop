import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordPayment } from '@/lib/payments';

/**
 * Handing the goods over on a sale the customer left behind.
 *
 * Rentals have had this since delivery collection was added; sales did not, so
 * a counter sale paid part-now and collected next week had nowhere to record
 * who came, when, or the balance they handed over. The balance was ending up
 * as a manual correction, or not recorded at all.
 *
 * The balance is written as its own receipt, dated today — that is when the
 * money reached the till, not the day the sale was rung up.
 */
export async function POST(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const pickupName = (body?.pickupName || '').trim();
    const pickupPhone = (body?.pickupPhone || '').trim();

    if (!pickupName || !pickupPhone) {
      return NextResponse.json(
        { error: 'Who collected the goods, and their phone number, are both required' },
        { status: 400 }
      );
    }

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });

    const paidNow = Math.max(0, parseFloat(body?.paidNow?.toString() ?? '0') || 0);
    const newPaid = (sale.paidAmount || 0) + paidNow;
    const newRemaining = Math.max(0, sale.totalAmount - newPaid);

    const updated = await prisma.sale.update({
      where: { id },
      data: {
        pickupName,
        pickupPhone,
        pickupDate: body?.pickupDate?.trim() || new Date().toISOString(),
        paidAmount: newPaid,
        remainingAmount: newRemaining,
        // Handing it over is also confirmation it was ready, if nobody said so.
        readyAt: sale.readyAt ?? new Date(),
        readyBy: sale.readyBy ?? (body?.collectedBy || null),
      },
      include: { items: { include: { product: true } }, invoice: true },
    });

    if (updated.invoice) {
      await prisma.invoice.update({
        where: { id: updated.invoice.id },
        data: { status: newRemaining === 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID' },
      });
    }

    await recordPayment(null, {
      saleId: id,
      storeId: sale.storeId,
      amount: paidNow,
      kind: 'BALANCE',
      note: 'Collected at handover',
      receivedBy: body?.collectedBy || null,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('POST /api/sales/[id]/collect error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record the handover' }, { status: 500 });
  }
}
