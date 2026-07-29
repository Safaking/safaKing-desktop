import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMultiProductAvailability } from '@/lib/inventory';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let whereClause: any = {};
  if (status === 'OVERDUE') {
    whereClause = {
      status: { in: ['ACTIVE', 'BOOKED'] },
      endDate: { lt: startOfToday }
    };
  } else if (status) {
    whereClause = { status };
  }

  try {
    const rentals = await prisma.rental.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        invoice: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(rentals);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log('RENTAL POST API HIT');
  const body = await request.json();
  console.log('BODY:', JSON.stringify(body, null, 2));
  const { 
    customerName, 
    customerPhone, 
    customerAddress, 
    fatherName,
    weddingDate,
    safaSize,
    notes,
    startDate, 
    endDate, 
    items, 
    paidAmount, 
    remainingAmount,
    storeId,
    tieSafa,
    safaShape,
    tieSafaCharge,
    discount
  } = body;

  if (!customerName || !customerPhone || !startDate || !endDate || !items || items.length === 0) {
    return NextResponse.json({ error: 'Name, Phone, and Dates are required' }, { status: 400 });
  }

  try {
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);

    let totalAmount = items.reduce((sum: number, item: any) => {
      const price = parseFloat(item.pricePerDay?.toString() || '0') || 0;
      const qty = parseInt(item.quantity?.toString() || '0') || 0;
      return sum + (price * qty);
    }, 0);

    if (tieSafa) {
      totalAmount += parseFloat(tieSafaCharge?.toString() || '50') || 50;
    }
    if (discount) {
      totalAmount -= parseFloat(discount?.toString() || '0') || 0;
    }

    const paid = parseFloat(paidAmount?.toString() || '0') || 0;
    const remaining = totalAmount - paid;

    const availability = await checkMultiProductAvailability(items, sDate, eDate);
    if (!availability.allAvailable) {
      return NextResponse.json({ 
        error: 'One or more items are not available for the selected dates',
        details: availability.details 
      }, { status: 400 });
    }

    const rental = await prisma.$transaction(async (tx: any) => {
      const lastRental = await tx.rental.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      let lastNum = 0;
      if (lastRental && lastRental.orderNumber.includes('-')) {
        const parts = lastRental.orderNumber.split('-');
        lastNum = parseInt(parts[parts.length - 1]) || 0;
      }

      const orderNumber = `RENT-${(lastNum + 1).toString().padStart(5, '0')}`;

      const newRental = await tx.rental.create({
        data: {
          orderNumber,
          customerName,
          customerPhone,
          customerAddress,
          fatherName,
          weddingDate,
          safaSize,
          notes,
          startDate: sDate,
          endDate: eDate,
          status: 'BOOKED',
          totalAmount,
          paidAmount: paid,
          remainingAmount: remaining,
          storeId: storeId || null,
          tieSafa: !!tieSafa,
          safaShape,
          tieSafaCharge: parseFloat(tieSafaCharge?.toString() || '0') || 0,
          discount: parseFloat(discount?.toString() || '0') || 0,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: parseInt(item.quantity?.toString() || '1') || 1,
              pricePerDay: parseFloat(item.pricePerDay?.toString() || '0') || 0,
            })),
          },
        },
        include: { 
          items: {
            include: { product: true }
          }
        },
      });

      const lastInvoice = await tx.invoice.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      let lastInvNum = 0;
      if (lastInvoice && lastInvoice.invoiceNumber.includes('-')) {
        const parts = lastInvoice.invoiceNumber.split('-');
        lastInvNum = parseInt(parts[parts.length - 1]) || 0;
      }

      const invoiceNumber = `INV-${(lastInvNum + 1).toString().padStart(5, '0')}`;

      await tx.invoice.create({
        data: {
          invoiceNumber,
          rentalId: newRental.id,
          amount: totalAmount,
          status: paid >= totalAmount ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID'),
        },
      });

      return newRental;
    });

    return NextResponse.json(rental);
  } catch (error: any) {
    console.error('RENTAL POST ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
