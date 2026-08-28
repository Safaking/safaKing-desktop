import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordPayment } from '@/lib/payments';
import { orderItemsInclude, orderProductSelect } from '@/lib/order-selects';

/**
 * Correcting or removing a sale after the bill has been raised.
 *
 * A sale had neither, so a wrong figure or a wrong tying count was permanent
 * once the bill printed. Staff may correct a sale that has not been handed
 * over; after that the customer has the goods, so only an admin can.
 *
 * Any change to what was paid writes a receipt, dated today, because that is
 * when the money actually moved — the cash book is built from receipts and
 * must not be able to drift from the order.
 */
export async function PUT(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });

    const existing = await prisma.sale.findUnique({ where: { id }, include: { items: true } });
    if (!existing) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const isAdmin = body?.role === 'ADMIN';

    if (existing.pickupDate && !isAdmin) {
      return NextResponse.json(
        { error: 'These goods have already gone out. Ask an admin to correct the sale.' },
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
      items,
      discount,
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
    } = body;

    // The bill is rebuilt from whatever was sent, so a corrected tying count
    // corrects the total too rather than leaving the old charge against it.
    let itemsTotal = existing.items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0);
    if (Array.isArray(items) && items.length > 0) {
      itemsTotal = items.reduce(
        (s: number, i: any) =>
          s +
          (parseFloat(i.price?.toString() || '0') || 0) * (parseInt(i.quantity?.toString() || '0') || 0),
        0
      );
    }

    let tyingCharge = existing.tieSafaCharge;
    if (tieSafaCharge !== undefined) {
      const parsed = parseFloat(tieSafaCharge?.toString() ?? '');
      if (Number.isFinite(parsed) && parsed >= 0) tyingCharge = parsed;
    }
    const wantsTying = tieSafa !== undefined ? !!tieSafa : existing.tieSafa;

    const discountAmount =
      discount !== undefined
        ? Math.max(0, parseFloat(discount?.toString() || '0') || 0)
        : existing.discount || 0;

    const gross = itemsTotal + (wantsTying ? tyingCharge : 0);
    const total = Math.max(0, gross - discountAmount);

    const paid =
      paidAmount !== undefined
        ? Math.max(0, parseFloat(paidAmount?.toString() || '0') || 0)
        : existing.paidAmount || 0;
    const remaining = Math.max(0, total - paid);

    const updated = await prisma.$transaction(async tx => {
      if (Array.isArray(items) && items.length > 0) {
        await tx.saleItem.deleteMany({ where: { saleId: id } });
      }

      const sale = await tx.sale.update({
        where: { id },
        data: {
          customerName: customerName || existing.customerName,
          customerPhone: customerPhone !== undefined ? customerPhone : existing.customerPhone,
          customerAltPhone:
            customerAltPhone !== undefined ? customerAltPhone : existing.customerAltPhone,
          customerAddress:
            customerAddress !== undefined ? customerAddress : existing.customerAddress,
          fatherName: fatherName !== undefined ? fatherName : existing.fatherName,
          weddingDate: weddingDate !== undefined ? weddingDate : existing.weddingDate,
          safaSize: safaSize !== undefined ? safaSize : existing.safaSize,
          notes: notes !== undefined ? notes : existing.notes,
          totalAmount: total,
          discount: discountAmount,
          paidAmount: paid,
          remainingAmount: remaining,
          tieSafa: wantsTying,
          tieSafaCharge: tyingCharge,
          safaShape: safaShape !== undefined ? safaShape : existing.safaShape,
          safaTyingCount:
            safaTyingCount !== undefined
              ? Math.max(0, parseInt(safaTyingCount?.toString() || '0') || 0)
              : existing.safaTyingCount,
          safaTyingStyles:
            safaTyingStyles !== undefined ? safaTyingStyles : existing.safaTyingStyles,
          safaTyingName: safaTyingName !== undefined ? safaTyingName : existing.safaTyingName,
          safaTyingAddress:
            safaTyingAddress !== undefined ? safaTyingAddress : existing.safaTyingAddress,
          safaTyingTime: safaTyingTime !== undefined ? safaTyingTime : existing.safaTyingTime,
          safaTyingDate: safaTyingDate !== undefined ? safaTyingDate : existing.safaTyingDate,
          ...(Array.isArray(items) && items.length > 0
            ? {
                items: {
                  create: items.map((i: any) => ({
                    productId: i.productId,
                    quantity: parseInt(i.quantity?.toString() || '1') || 1,
                    price: parseFloat(i.price?.toString() || '0') || 0,
                  })),
                },
              }
            : {}),
        },
        include: { items: orderItemsInclude, invoice: true },
      });

      // The bill on file must agree with the corrected sale.
      if (sale.invoice) {
        await tx.invoice.update({
          where: { id: sale.invoice.id },
          data: {
            amount: total,
            status: remaining === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID',
          },
        });
      }

      return sale;
    });

    // Money that moved because of the correction, dated today.
    const delta = paid - (existing.paidAmount || 0);
    if (delta > 0) {
      await recordPayment(null, {
        saleId: id,
        storeId: existing.storeId,
        amount: delta,
        kind: 'ADJUSTMENT',
        note: 'Correction to the sale',
        receivedBy: body?.editedBy || null,
      });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/sales/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update the sale' }, { status: 500 });
  }
}

/**
 * Remove a sale entirely. Admin only.
 *
 * Its receipts go with it: leaving them behind would keep the money in the
 * cash book for a sale that no longer exists, and the day would never tally.
 */
export async function DELETE(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });

    const role = new URL(request.url).searchParams.get('role');
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only an admin can delete a sale' }, { status: 403 });
    }

    const existing = await prisma.sale.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });

    await prisma.$transaction(async tx => {
      await tx.orderPayment.deleteMany({ where: { saleId: id } });
      await tx.tyingAssignment.deleteMany({ where: { saleId: id } });
      await tx.invoice.deleteMany({ where: { saleId: id } });
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.sale.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/sales/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete the sale' }, { status: 500 });
  }
}
