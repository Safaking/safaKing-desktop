import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordPayment } from '@/lib/payments';
import { checkMultiProductAvailability } from '@/lib/inventory';
import { pushProductSync } from '@/lib/sync';
import { orderItemsInclude, orderProductSelect } from '@/lib/order-selects';

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

  // Unbounded by default this query grew with every rental ever created.
  // Cap it, and let callers page through with ?limit= / ?offset= when needed.
  const limit = Math.min(Number(searchParams.get('limit')) || 200, 500);
  const offset = Number(searchParams.get('offset')) || 0;

  try {
    const rentals = await prisma.rental.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            // Only the product columns the rentals UI and invoice generator read.
            product: {
              select: { id: true, name: true, sku: true, salePrice: true, rentPrice: true, productType: true },
            },
          },
        },
        invoice: true,
        // Needed so the list can show who a tying order is allocated to.
        artist: { select: { id: true, name: true, phone: true } },
        // The real allocation: a big order is split between several artists,
        // and both the list and the allocate dialog read the whole split.
        tyingAssignments: {
          include: { artist: { select: { id: true, name: true, phone: true } } },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
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
    remainingAmount,
    storeId,
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
    paymentMethod,
    createdBy,
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
      // A genuine zero charge must stay zero: `parseFloat('0') || 50` would
      // silently bill 50, which matters now that tying can be switched on
      // before any style is chosen.
      const parsedTieCharge = parseFloat(tieSafaCharge?.toString() ?? '');
      totalAmount += Number.isFinite(parsedTieCharge) ? parsedTieCharge : 0;
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
          customerAltPhone: customerAltPhone || null,
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
          safaTyingCount: tieSafa ? (parseInt(safaTyingCount?.toString() || '1') || 1) : 1,
          safaTyingStyles: tieSafa ? (safaTyingStyles || null) : null,
          safaTyingName: tieSafa ? (safaTyingName || null) : null,
          safaTyingAddress: tieSafa ? (safaTyingAddress || null) : null,
          safaTyingTime: tieSafa ? (safaTyingTime || null) : null,
          safaTyingDate: tieSafa ? (safaTyingDate || null) : null,
          tieSafaCharge: parseFloat(tieSafaCharge?.toString() || '0') || 0,
          discount: parseFloat(discount?.toString() || '0') || 0,
          paymentMethod: paymentMethod || 'CASH',
          createdBy: createdBy?.trim() || null,
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
            include: { product: { select: orderProductSelect } }
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
      const invStatus = paid >= totalAmount && totalAmount > 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'DUE');

      await tx.invoice.create({
        data: {
          invoiceNumber,
          rentalId: newRental.id,
          amount: totalAmount,
          status: invStatus,
          paymentMethod: paymentMethod || 'CASH',
        },
      });

      // The advance taken at booking, stamped with today.
      await recordPayment(tx, {
        rentalId: newRental.id,
        storeId: newRental.storeId,
        amount: paid,
        method: newRental.paymentMethod,
        kind: 'ADVANCE',
        receivedBy: newRental.createdBy,
      });

      return newRental;
    });

    await pushProductSync((items as any[]).map((item) => item.productId));

    return NextResponse.json(rental);
  } catch (error: any) {
    console.error('RENTAL POST ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
