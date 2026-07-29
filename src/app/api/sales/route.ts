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
        invoice: true
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
  } = body;

  if (!customerName || !customerPhone || !items || items.length === 0) {
    return NextResponse.json({ error: 'Name and Phone are required' }, { status: 400 });
  }

  try {
    const total = parseFloat(totalAmount?.toString() || '0') || 0;
    const discountAmount = parseFloat(discount?.toString() || '0') || 0;
    const finalTotal = total - discountAmount;

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
          status: 'PAID',
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
