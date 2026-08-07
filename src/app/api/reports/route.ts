import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Reporting data for a date range.
 *
 * Query: ?from=yyyy-mm-dd&to=yyyy-mm-dd
 * Orders are selected on createdAt (when the order was taken), and `to` is
 * inclusive of the whole day rather than midnight at its start.
 *
 * All money is aggregated here rather than in the browser so the page stays
 * fast as the order history grows.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromRaw = searchParams.get('from');
    const toRaw = searchParams.get('to');

    const from = fromRaw ? new Date(`${fromRaw}T00:00:00`) : null;
    // Inclusive end: everything up to the last moment of the `to` day.
    const to = toRaw ? new Date(`${toRaw}T23:59:59.999`) : null;

    if ((fromRaw && isNaN(from!.getTime())) || (toRaw && isNaN(to!.getTime()))) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }
    if (from && to && from > to) {
      return NextResponse.json({ error: '"From" date is after the "to" date' }, { status: 400 });
    }

    const createdAt: any = {};
    if (from) createdAt.gte = from;
    if (to) createdAt.lte = to;
    const where = from || to ? { createdAt } : {};

    const [rentals, sales] = await Promise.all([
      prisma.rental.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          artist: { select: { id: true, name: true } },
          tyingAssignments: { include: { artist: { select: { id: true, name: true } } } },
          invoice: { select: { status: true, invoiceNumber: true } },
          items: { select: { quantity: true, product: { select: { name: true } } } },
        },
      }),
      prisma.sale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: { select: { id: true, name: true } },
          tyingAssignments: { include: { artist: { select: { id: true, name: true } } } },
          invoice: { select: { status: true, invoiceNumber: true } },
          items: { select: { quantity: true, product: { select: { name: true } } } },
        },
      }),
    ]);

    /** "Red x10, Pink s x5" — what was actually on the order. */
    const itemNames = (items: any[]) =>
      items
        .map(i => `${i.product?.name ?? 'Item'}${i.quantity > 1 ? ` x${i.quantity}` : ''}`)
        .join(', ');

    const sum = (xs: any[], pick: (x: any) => number) => xs.reduce((s, x) => s + (pick(x) || 0), 0);

    const rentalRevenue = sum(rentals, r => r.totalAmount);
    const rentalPaid = sum(rentals, r => r.paidAmount);
    const saleRevenue = sum(sales, s => s.totalAmount);
    const salePaid = sum(sales, s => s.paidAmount);

    const summary = {
      rentalCount: rentals.length,
      saleCount: sales.length,
      orderCount: rentals.length + sales.length,
      rentalRevenue,
      saleRevenue,
      revenue: rentalRevenue + saleRevenue,
      collected: rentalPaid + salePaid,
      outstanding: Math.max(0, rentalRevenue + saleRevenue - (rentalPaid + salePaid)),
      discount: sum(rentals, r => r.discount) + sum(sales, s => s.discount),
      tyingCharge: sum(rentals, r => r.tieSafaCharge) + sum(sales, s => s.tieSafaCharge),
      readyCount: rentals.filter(r => r.readyAt).length,
      notReadyCount: rentals.filter(r => !r.readyAt).length,
    };

    // Artist workload and what they are owed, over the same range.
    //
    // Walks the shares rather than the orders: a hundred-safa order split
    // forty/sixty is two artists' work, and each is owed for their own share
    // at their own rate.
    const byArtist = new Map<string, any>();
    const collect = (order: any, kind: 'RENTAL' | 'SALE') => {
      for (const share of order.tyingAssignments ?? []) {
        if (!share.artist) continue;
        const entry = byArtist.get(share.artistId) ?? {
          id: share.artistId,
          name: share.artist.name,
          orderCount: 0,
          safasTied: 0,
          feeTotal: 0,
          feePaid: 0,
          feeDue: 0,
          // The artist report lists the orders behind the totals, so they can
          // be checked line by line when settling up.
          orders: [] as any[],
        };
        const owed = (share.rate || 0) * (share.quantity || 0);
        entry.orderCount += 1;
        entry.safasTied += share.quantity || 0;
        entry.feeTotal += owed;
        if (share.paid) entry.feePaid += owed;
        else entry.feeDue += owed;
        entry.orders.push({
          id: order.id,
          kind,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          createdAt: order.createdAt,
          startDate: kind === 'RENTAL' ? order.startDate : order.createdAt,
          // This artist's share, and what the whole order needed — so a split
          // order reads as a split rather than looking like a short count.
          safaTyingCount: share.quantity,
          orderSafaCount: order.safaTyingCount || 0,
          artistRate: share.rate,
          artistPaid: share.paid,
          earned: owed,
        });
        byArtist.set(share.artistId, entry);
      }
    };
    for (const r of rentals) collect(r, 'RENTAL');
    for (const sale of sales) collect(sale, 'SALE');

    /** Safas on an order that still have nobody tying them. */
    const shortBy = (o: any) =>
      Math.max(
        0,
        (o.safaTyingCount || 0) -
          (o.tyingAssignments ?? []).reduce((sum: number, a: any) => sum + (a.quantity || 0), 0)
      );

    // Half-staffed counts as still to assign: somebody has to be found either
    // way, and only counting the untouched ones hides the harder cases.
    const unallocatedTying =
      rentals.filter(r => r.tieSafa && shortBy(r) > 0).length +
      sales.filter(s => s.tieSafa && shortBy(s) > 0).length;

    /** "Ramesh 40 · Suresh 60" when split, just the name when it is not. */
    const artistLabel = (o: any) => {
      const shares = o.tyingAssignments ?? [];
      if (!shares.length) return null;
      if (shares.length === 1) return shares[0].artist?.name ?? null;
      return shares.map((a: any) => `${a.artist?.name ?? '?'} ${a.quantity}`).join(' · ');
    };
    /** A single rate only means anything when one artist holds the order. */
    const soleRate = (o: any) =>
      (o.tyingAssignments ?? []).length === 1 ? o.tyingAssignments[0].rate || 0 : 0;
    const owedOn = (o: any) =>
      (o.tyingAssignments ?? []).reduce((sum: number, a: any) => sum + (a.rate || 0) * (a.quantity || 0), 0);
    /** Settled only once every artist on the order has been paid. */
    const allPaid = (o: any) =>
      (o.tyingAssignments ?? []).length > 0 && o.tyingAssignments.every((a: any) => a.paid);

    const orders = [
      ...rentals.map(r => ({
        kind: 'RENTAL' as const,
        id: r.id,
        orderNumber: r.orderNumber,
        customerName: r.customerName,
        createdAt: r.createdAt,
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
        totalAmount: r.totalAmount,
        paidAmount: r.paidAmount,
        remainingAmount: r.remainingAmount,
        itemCount: r.items.reduce((s, i) => s + (i.quantity || 0), 0),
        itemNames: itemNames(r.items),
        readyAt: r.readyAt,
        readyBy: r.readyBy,
        createdBy: r.createdBy,
        tieSafa: r.tieSafa,
        artistName: artistLabel(r),
        artistRate: soleRate(r),
        artistOwed: owedOn(r),
        artistPaid: allPaid(r),
        vendorName: null,
        invoiceStatus: r.invoice?.status ?? null,
      })),
      ...sales.map(s => ({
        kind: 'SALE' as const,
        id: s.id,
        orderNumber: s.orderNumber,
        customerName: s.customerName,
        createdAt: s.createdAt,
        startDate: null,
        endDate: null,
        status: 'SOLD',
        totalAmount: s.totalAmount,
        paidAmount: s.paidAmount,
        remainingAmount: s.remainingAmount,
        itemCount: s.items.reduce((acc, i) => acc + (i.quantity || 0), 0),
        itemNames: itemNames(s.items),
        readyAt: null,
        readyBy: null,
        createdBy: s.createdBy,
        tieSafa: s.tieSafa,
        artistName: artistLabel(s),
        artistRate: soleRate(s),
        artistOwed: owedOn(s),
        artistPaid: allPaid(s),
        vendorName: s.vendor?.name ?? null,
        invoiceStatus: s.invoice?.status ?? null,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      range: { from: fromRaw, to: toRaw },
      summary,
      orders,
      artists: [...byArtist.values()].sort((a, b) => b.feeDue - a.feeDue),
      unallocatedTying,
    });
  } catch (error: any) {
    console.error('GET /api/reports error:', error);
    return NextResponse.json({ error: error.message || 'Failed to build report' }, { status: 500 });
  }
}
