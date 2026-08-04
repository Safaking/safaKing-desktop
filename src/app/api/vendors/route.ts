import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Registered bulk buyers. Their orders go through the normal POS screen and
 * are simply tagged with vendorId, so the totals here are derived from sales
 * rather than kept as a separate ledger.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const withOrders = searchParams.get('withOrders') === 'true';

    const vendors = await prisma.vendor.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      ...(withOrders
        ? {
            include: {
              sales: {
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true,
                  orderNumber: true,
                  totalAmount: true,
                  paidAmount: true,
                  remainingAmount: true,
                  createdAt: true,
                },
              },
            },
          }
        : {}),
    });

    if (!withOrders) return NextResponse.json(vendors);

    // Roll each vendor's orders into purchased / paid / outstanding.
    const withTotals = vendors.map((v: any) => {
      const purchased = v.sales.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
      const paid = v.sales.reduce((s: number, o: any) => s + (o.paidAmount || 0), 0);
      return {
        ...v,
        orderCount: v.sales.length,
        totalPurchased: purchased,
        totalPaid: paid,
        totalOutstanding: Math.max(0, purchased - paid),
      };
    });

    return NextResponse.json(withTotals);
  } catch (error: any) {
    console.error('GET /api/vendors error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body?.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const vendor = await prisma.vendor.create({
      data: {
        name,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        gstNumber: body.gstNumber?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });
    return NextResponse.json(vendor);
  } catch (error: any) {
    console.error('POST /api/vendors error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create vendor' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body?.id) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 });
    }

    const data: any = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if ('phone' in body) data.phone = body.phone?.trim() || null;
    if ('address' in body) data.address = body.address?.trim() || null;
    if ('gstNumber' in body) data.gstNumber = body.gstNumber?.trim() || null;
    if ('notes' in body) data.notes = body.notes?.trim() || null;
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;

    const vendor = await prisma.vendor.update({ where: { id: body.id }, data });
    return NextResponse.json(vendor);
  } catch (error: any) {
    console.error('PUT /api/vendors error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update vendor' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 });
    }

    // A vendor with orders is deactivated so the sales keep their attribution.
    const orders = await prisma.sale.count({ where: { vendorId: id } });
    if (orders > 0) {
      const vendor = await prisma.vendor.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({
        ...vendor,
        deactivated: true,
        message: `Vendor has ${orders} order${orders === 1 ? '' : 's'}, so they were marked inactive instead of deleted.`,
      });
    }

    await prisma.vendor.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/vendors error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete vendor' }, { status: 500 });
  }
}
