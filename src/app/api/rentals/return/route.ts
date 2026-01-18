import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const body = await request.json();
  const { rentalId, items } = body; 
  // items: { productId: string, quantity: number }[]

  try {
    const rental = await prisma.rental.findUnique({
      where: { id: rentalId },
      include: { items: true },
    });

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const rentalItem = rental.items.find(ri => ri.productId === item.productId);
        if (rentalItem) {
          await tx.rentalItem.update({
            where: { id: rentalItem.id },
            data: {
              returnedQuantity: {
                increment: item.quantity
              }
            }
          });
        }
      }

      // Check if all items are returned
      const updatedRental = await tx.rental.findUnique({
        where: { id: rentalId },
        include: { items: true },
      });

      const allReturned = updatedRental?.items.every(ri => ri.returnedQuantity >= ri.quantity);

      if (allReturned) {
        await tx.rental.update({
          where: { id: rentalId },
          data: { status: 'RETURNED' }
        });
      } else {
        await tx.rental.update({
          where: { id: rentalId },
          data: { status: 'ACTIVE' } // Partially returned or still active
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
