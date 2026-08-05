import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureDbSchema } from '@/lib/db-init';

/**
 * Vendor ledger payments for a single vendor (bulk buyer).
 *
 * GET  /api/vendors/[id]/payments  — list payments & sales for this vendor, with running balance
 * POST /api/vendors/[id]/payments  — record a payment received from vendor
 * DELETE /api/vendors/[id]/payments?paymentId=xxx — delete a payment entry
 */

export async function GET(request: Request, { params }: { params: any }) {
  await ensureDbSchema();
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Vendor ID required' }, { status: 400 });

    const [vendor, payments, sales] = await Promise.all([
      prisma.vendor.findUnique({ where: { id } }),
      prisma.vendorPayment.findMany({
        where: { vendorId: id },
        orderBy: { paidAt: 'desc' },
      }),
      prisma.sale.findMany({
        where: { vendorId: id },
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerPhone: true,
          totalAmount: true,
          paidAmount: true,
          remainingAmount: true,
          readyAt: true,
          readyBy: true,
          createdAt: true,
          items: {
            select: {
              quantity: true,
              price: true,
              product: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

    const totalPurchased = sales.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
    const totalPaidOnOrders = sales.reduce((s: number, o: any) => s + (o.paidAmount || 0), 0);
    const totalPaidViaLedger = payments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    
    // Total paid is payments recorded via ledger + order-level payments if any
    const totalPaid = totalPaidViaLedger > 0 ? totalPaidViaLedger : totalPaidOnOrders;
    const balance = Math.max(0, totalPurchased - totalPaid);

    return NextResponse.json({
      vendor,
      payments,
      sales,
      totalPurchased,
      totalPaid,
      balance,
    });
  } catch (error: any) {
    console.error('GET /api/vendors/[id]/payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: any }) {
  await ensureDbSchema();
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Vendor ID required' }, { status: 400 });

    const body = await request.json();
    const amount = parseFloat(body?.amount?.toString() ?? '');
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'A valid positive amount is required' }, { status: 400 });
    }

    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

    const payment = await prisma.vendorPayment.create({
      data: {
        vendorId: id,
        amount,
        note: body?.note?.trim() || null,
        paidAt: body?.paidAt ? new Date(body.paidAt) : new Date(),
        paidBy: body?.paidBy?.trim() || null,
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/vendors/[id]/payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: any }) {
  await ensureDbSchema();
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');

    if (!id || !paymentId) {
      return NextResponse.json({ error: 'Vendor ID and Payment ID are required' }, { status: 400 });
    }

    await prisma.vendorPayment.delete({ where: { id: paymentId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/vendors/[id]/payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
