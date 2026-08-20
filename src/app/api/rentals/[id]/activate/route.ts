import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordPayment } from '@/lib/payments';

export async function POST(
  request: Request,
  { params }: { params: any }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;

    if (!id) {
      return NextResponse.json({ error: 'Rental ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { pickupName, pickupPhone, pickupDate, paidNow } = body;

    if (!pickupName || !pickupPhone) {
      return NextResponse.json({ error: 'Receiver name and phone number are required' }, { status: 400 });
    }

    const rental = await prisma.rental.findUnique({ where: { id } });
    if (!rental) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const additionalPaid = Math.max(0, parseFloat(paidNow?.toString() ?? '0') || 0);
    const newPaidAmount = (rental.paidAmount || 0) + additionalPaid;
    const newRemainingAmount = Math.max(0, rental.totalAmount - newPaidAmount);

    const updatedRental = await prisma.rental.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        pickupName,
        pickupPhone,
        pickupDate: pickupDate || new Date().toISOString(),
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
      },
    });

    // The balance handed over at collection, stamped with today rather than
    // with the day the order was booked. Without this it landed in a cash book
    // that was tallied and closed weeks ago.
    await recordPayment(null, {
      rentalId: updatedRental.id,
      storeId: updatedRental.storeId,
      amount: additionalPaid,
      method: updatedRental.paymentMethod,
      kind: 'BALANCE',
      note: 'Collected at handover',
      receivedBy: body?.collectedBy || null,
    });

    return NextResponse.json(updatedRental);
  } catch (error: any) {
    console.error('POST /api/rentals/[id]/activate error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to activate rental' }, { status: 500 });
  }
}
