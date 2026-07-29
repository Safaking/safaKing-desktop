import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    const rental = await prisma.rental.findUnique({
      where: { id },
    });

    if (!rental) {
      return NextResponse.json({ error: 'Rental order not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
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

    // Edit is allowed only when status is BOOKED
    if (existingRental.status !== 'BOOKED') {
      return NextResponse.json({ error: 'Only bookings in BOOKED status can be edited' }, { status: 400 });
    }

    const body = await request.json();
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
      safaTyingName,
      safaTyingAddress,
      safaTyingTime,
      safaTyingDate,
      tieSafaCharge,
      discount
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

    if (tieSafa) {
      totalAmount += parseFloat(tieSafaCharge?.toString() || '50') || 50;
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
          safaShape: safaShape || existingRental.safaShape,
          safaTyingName: safaTyingName !== undefined ? safaTyingName : existingRental.safaTyingName,
          safaTyingAddress: safaTyingAddress !== undefined ? safaTyingAddress : existingRental.safaTyingAddress,
          safaTyingTime: safaTyingTime !== undefined ? safaTyingTime : existingRental.safaTyingTime,
          safaTyingDate: safaTyingDate !== undefined ? safaTyingDate : existingRental.safaTyingDate,
          tieSafaCharge: tieSafaCharge !== undefined ? parseFloat(tieSafaCharge.toString()) : existingRental.tieSafaCharge,
          discount: discount !== undefined ? parseFloat(discount.toString()) : existingRental.discount,
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
        await tx.invoice.update({
          where: { id: rental.invoice.id },
          data: {
            amount: totalAmount,
            status: paid >= totalAmount ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID'),
          }
        });
      }

      return rental;
    });

    return NextResponse.json(updatedRental);
  } catch (error: any) {
    console.error('PUT /api/rentals/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update rental order' }, { status: 500 });
  }
}
