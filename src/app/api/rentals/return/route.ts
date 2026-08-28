import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordPayment } from '@/lib/payments';
import { pushProductSync } from '@/lib/sync';
import { orderItemsInclude, orderProductSelect } from '@/lib/order-selects';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rentalId, items, paidNow } = body; 
    // items: { productId: string, newlyReturned: number, unreturnedCharge: number }[]

    const rental = await prisma.rental.findUnique({
      where: { id: rentalId },
      include: { items: orderItemsInclude, invoice: true },
    });

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }

    let additionalDamageCharge = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const rentalItem = rental.items.find(ri => ri.productId === item.productId);
        if (rentalItem) {
          const newlyReturned = Math.max(0, parseInt(item.newlyReturned?.toString() || '0') || 0);
          const unreturnedCharge = parseFloat(item.unreturnedCharge?.toString() || '0') || 0;

          additionalDamageCharge += unreturnedCharge;

          if (newlyReturned > 0) {
            await tx.rentalItem.update({
              where: { id: rentalItem.id },
              data: {
                returnedQuantity: {
                  increment: newlyReturned
                }
              }
            });
          }
        }
      }

      // Check remaining balances and status
      const updatedRental = await tx.rental.findUnique({
        where: { id: rentalId },
        include: { items: true },
      });

      const totalDamageCharge = (rental.damageCharge || 0) + additionalDamageCharge;
      const newTotalAmount = rental.totalAmount + additionalDamageCharge;
      const newPaidAmount = (rental.paidAmount || 0) + (parseFloat(paidNow?.toString() || '0') || 0);
      const newRemaining = Math.max(0, newTotalAmount - newPaidAmount);

      const allReturnedOrSettled = updatedRental?.items.every(ri => ri.returnedQuantity >= ri.quantity) || additionalDamageCharge > 0;

      await tx.rental.update({
        where: { id: rentalId },
        data: {
          status: allReturnedOrSettled ? 'RETURNED' : 'ACTIVE',
          damageCharge: totalDamageCharge,
          totalAmount: newTotalAmount,
          paidAmount: newPaidAmount,
          remainingAmount: newRemaining,
        }
      });

      // Money taken at the return desk — a damage charge settled, or the last
      // of a balance — belongs in today's till, not the booking day's.
      await recordPayment(tx, {
        rentalId,
        storeId: rental.storeId,
        amount: parseFloat(paidNow?.toString() || '0') || 0,
        method: rental.paymentMethod,
        kind: 'BALANCE',
        note: additionalDamageCharge > 0 ? 'Collected at return (incl. damage)' : 'Collected at return',
      });

      if (rental.invoice) {
        await tx.invoice.update({
          where: { id: rental.invoice.id },
          data: {
            amount: newTotalAmount,
            status: newRemaining === 0 ? 'PAID' : (newPaidAmount > 0 ? 'PARTIAL' : 'UNPAID')
          }
        });
      }
    });

    await pushProductSync(items.map((item: any) => item.productId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('POST /api/rentals/return error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process return' }, { status: 500 });
  }
}
