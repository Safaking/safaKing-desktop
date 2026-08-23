import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordPayment } from '@/lib/payments';

export async function DELETE(
  request: Request,
  { params }: { params: any }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;

    if (!id) {
      return NextResponse.json({ error: 'Rental ID is required' }, { status: 400 });
    }

    // The menu only offers this to an admin; the server has to say so too, or
    // the rule is only a suggestion.
    const role = new URL(request.url).searchParams.get('role');
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only an admin can delete an order' }, { status: 403 });
    }

    const rental = await prisma.rental.findUnique({
      where: { id },
    });

    if (!rental) {
      return NextResponse.json({ error: 'Rental order not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Everything hanging off the order goes with it. The live tables carry
      // no foreign keys, so nothing is cascaded for us: leaving these behind
      // kept a deleted order's money in the cash book, where the day would
      // never tally again, and kept an artist owed for work that no longer
      // existed.
      await tx.orderPayment.deleteMany({ where: { rentalId: id } });
      await tx.tyingAssignment.deleteMany({ where: { rentalId: id } });
      // Delete invoice
      await tx.invoice.deleteMany({
        where: { rentalId: id }
      });
      // Delete rental items
      await tx.rentalItem.deleteMany({
        where: { rentalId: id }
      });
      // Delete rental
      await tx.rental.delete({
        where: { id }
      });
    });

    return NextResponse.json({ success: true, message: 'Rental order deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/rentals/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete rental order' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: any }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;

    if (!id) {
      return NextResponse.json({ error: 'Rental ID is required' }, { status: 400 });
    }

    const existingRental = await prisma.rental.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!existingRental) {
      return NextResponse.json({ error: 'Rental order not found' }, { status: 404 });
    }

    const body = await request.json();

    // Staff may correct an order until it goes out of the door; after that the
    // customer has the goods and the bill, so only an admin can. Refusing
    // everyone left the shop unable to fix a bill it had already printed —
    // a tying count typed as 3 instead of 30 could not be put right at all.
    if (existingRental.status !== 'BOOKED' && body?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'This order has already gone out. Ask an admin to correct it.' },
        { status: 403 }
      );
    }
    const { 
      customerName, 
      customerPhone, 
      customerAltPhone,
      customerAddress, 
      fatherName,
      weddingDate,
      safaSize,
      notes,
      startDate, 
      endDate, 
      items, 
      paidAmount, 
      tieSafa,
      safaShape,
      safaTyingCount,
      safaTyingStyles,
      safaTyingName,
      safaTyingAddress,
      safaTyingTime,
      safaTyingDate,
      tieSafaCharge,
      discount,
      paymentMethod
    } = body;

    const sDate = startDate ? new Date(startDate) : existingRental.startDate;
    const eDate = endDate ? new Date(endDate) : existingRental.endDate;

    let totalAmount = existingRental.totalAmount;
    if (items && items.length > 0) {
      totalAmount = items.reduce((sum: number, item: any) => {
        const price = parseFloat(item.pricePerDay?.toString() || '0') || 0;
        const qty = parseInt(item.quantity?.toString() || '0') || 0;
        return sum + (price * qty);
      }, 0);
    }

    // The tying charge follows the styles when they are sent, so correcting a
    // count of 3 to 30 corrects the bill too rather than leaving the old
    // charge sitting against a new quantity.
    let tyingCharge = existingRental.tieSafaCharge;
    if (tieSafaCharge !== undefined) {
      const parsed = parseFloat(tieSafaCharge?.toString() ?? '');
      if (Number.isFinite(parsed) && parsed >= 0) tyingCharge = parsed;
    }
    if (tieSafa) {
      totalAmount += tyingCharge;
    }
    if (discount) {
      totalAmount -= parseFloat(discount?.toString() || '0') || 0;
    }

    const paid = paidAmount !== undefined ? parseFloat(paidAmount.toString()) : existingRental.paidAmount;
    const remaining = Math.max(0, totalAmount - paid);

    const updatedRental = await prisma.$transaction(async (tx) => {
      if (items && items.length > 0) {
        await tx.rentalItem.deleteMany({ where: { rentalId: id } });
      }

      const rental = await tx.rental.update({
        where: { id },
        data: {
          customerName: customerName || existingRental.customerName,
          customerPhone: customerPhone || existingRental.customerPhone,
          customerAltPhone: customerAltPhone !== undefined ? customerAltPhone : existingRental.customerAltPhone,
          customerAddress: customerAddress !== undefined ? customerAddress : existingRental.customerAddress,
          fatherName: fatherName !== undefined ? fatherName : existingRental.fatherName,
          weddingDate: weddingDate !== undefined ? weddingDate : existingRental.weddingDate,
          safaSize: safaSize !== undefined ? safaSize : existingRental.safaSize,
          notes: notes !== undefined ? notes : existingRental.notes,
          startDate: sDate,
          endDate: eDate,
          totalAmount,
          paidAmount: paid,
          remainingAmount: remaining,
          tieSafa: tieSafa !== undefined ? !!tieSafa : existingRental.tieSafa,
          safaTyingCount:
            safaTyingCount !== undefined
              ? Math.max(0, parseInt(safaTyingCount?.toString() || '0') || 0)
              : existingRental.safaTyingCount,
          safaTyingStyles:
            safaTyingStyles !== undefined ? safaTyingStyles : existingRental.safaTyingStyles,
          tieSafaCharge: tyingCharge,
          safaShape: safaShape || existingRental.safaShape,
          safaTyingName: safaTyingName !== undefined ? safaTyingName : existingRental.safaTyingName,
          safaTyingAddress: safaTyingAddress !== undefined ? safaTyingAddress : existingRental.safaTyingAddress,
          safaTyingTime: safaTyingTime !== undefined ? safaTyingTime : existingRental.safaTyingTime,
          safaTyingDate: safaTyingDate !== undefined ? safaTyingDate : existingRental.safaTyingDate,
          discount: discount !== undefined ? parseFloat(discount.toString()) : existingRental.discount,
          paymentMethod: paymentMethod || existingRental.paymentMethod || 'CASH',
          ...(items && items.length > 0 ? {
            items: {
              create: items.map((item: any) => ({
                productId: item.productId,
                quantity: parseInt(item.quantity?.toString() || '1') || 1,
                pricePerDay: parseFloat(item.pricePerDay?.toString() || '0') || 0,
              }))
            }
          } : {})
        },
        include: { items: { include: { product: true } }, invoice: true }
      });

      // Update associated invoice
      if (rental.invoice) {
        const invStatus = paid >= totalAmount && totalAmount > 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'DUE');
        await tx.invoice.update({
          where: { id: rental.invoice.id },
          data: {
            amount: totalAmount,
            status: invStatus,
            paymentMethod: paymentMethod || existingRental.paymentMethod || 'CASH',
          }
        });
      }

      return rental;
    });

    // Correcting what was paid has to move the till too, or the cash book and
    // the order stop agreeing. Recorded as an adjustment dated today, since
    // that is when the correction was actually made.
    const paidDelta = paid - (existingRental.paidAmount || 0);
    if (paidDelta > 0) {
      await recordPayment(null, {
        rentalId: id,
        storeId: existingRental.storeId,
        amount: paidDelta,
        method: paymentMethod || existingRental.paymentMethod,
        kind: 'ADJUSTMENT',
        note: 'Correction to the order',
        receivedBy: body?.editedBy || null,
      });
    }

    return NextResponse.json(updatedRental);
  } catch (error: any) {
    console.error('PUT /api/rentals/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update rental order' }, { status: 500 });
  }
}
