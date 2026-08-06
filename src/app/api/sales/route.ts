import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        items: {
          include: {
            product: true
          }
        },
        invoice: true,
        artist: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(sales);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { 
    customerName, 
    customerPhone, 
    customerAddress, 
    fatherName,
    weddingDate,
    safaSize,
    notes,
    items, 
    totalAmount,
    storeId,
    discount,
    tieSafa,
    safaShape,
    safaTyingCount,
    safaTyingStyles,
    safaTyingName,
    safaTyingAddress,
    safaTyingTime,
    safaTyingDate,
    tieSafaCharge,
    vendorId,
    paidAmount,
  } = body;

  if (!customerName || !customerPhone || !items || items.length === 0) {
    return NextResponse.json({ error: 'Name and Phone are required' }, { status: 400 });
  }

  try {
    const total = parseFloat(totalAmount?.toString() || '0') || 0;
    const discountAmount = parseFloat(discount?.toString() || '0') || 0;
    const finalTotal = total - discountAmount;

    // Counter sales are settled at the till, so an unspecified paid amount
    // means paid in full. Bulk vendor orders send an explicit figure.
    const parsedPaid = parseFloat(paidAmount?.toString() ?? '');
    const paid = Number.isFinite(parsedPaid) ? Math.max(0, parsedPaid) : finalTotal;
    const remaining = Math.max(0, finalTotal - paid);

    const sale = await prisma.$transaction(async (tx) => {
      const lastSale = await tx.sale.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      let lastNum = 0;
      if (lastSale && lastSale.orderNumber.includes('-')) {
        const parts = lastSale.orderNumber.split('-');
        lastNum = parseInt(parts[parts.length - 1]) || 0;
      }

      const orderNumber = `SALE-${(lastNum + 1).toString().padStart(5, '0')}`;

      const newSale = await tx.sale.create({
        data: {
          orderNumber,
          customerName,
          customerPhone,
          customerAddress,
          fatherName,
          weddingDate,
          safaSize,
          notes,
          totalAmount: finalTotal,
          storeId: storeId || null,
          discount: discountAmount,
          vendorId: vendorId || null,
          paidAmount: paid,
          remainingAmount: remaining,
          tieSafa: !!tieSafa,
          safaShape: tieSafa ? (safaShape || null) : null,
          safaTyingCount: tieSafa ? (parseInt(safaTyingCount?.toString() || '1') || 1) : 1,
          safaTyingStyles: tieSafa ? (safaTyingStyles || null) : null,
          safaTyingName: tieSafa ? (safaTyingName || null) : null,
          safaTyingAddress: tieSafa ? (safaTyingAddress || null) : null,
          safaTyingTime: tieSafa ? (safaTyingTime || null) : null,
          safaTyingDate: tieSafa ? (safaTyingDate || null) : null,
          tieSafaCharge: (() => {
            // A real zero must stay zero: `parseFloat('0') || x` would not.
            const parsed = parseFloat(tieSafaCharge?.toString() ?? '');
            return tieSafa && Number.isFinite(parsed) ? parsed : 0;
          })(),
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: parseInt(item.quantity?.toString() || '1') || 1,
              price: parseFloat(item.price?.toString() || '0') || 0,
            })),
          },
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
          saleId: newSale.id,
          amount: finalTotal,
          // Hardcoding PAID was fine while every sale settled at the till, but
          // a bulk vendor order can be part-paid.
          status: paid >= finalTotal && finalTotal > 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'DUE',
        },
      });

      return newSale;
    });

    return NextResponse.json(sale);
  } catch (error: any) {
    console.error('SALE POST ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
