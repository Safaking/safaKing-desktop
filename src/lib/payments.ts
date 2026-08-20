import { prisma } from '@/lib/prisma';

/**
 * Recording money as it comes in.
 *
 * Rental.paidAmount and Sale.paidAmount stay as running totals — every screen
 * and the bill read them — but the cash book cannot be built from them. It has
 * to answer "what came into this till today", and a total tells you nothing
 * about when it arrived. A balance collected at handover in November would be
 * counted into the book for the March day the order was booked, a day already
 * tallied, submitted and closed.
 *
 * So every receipt is also written here, stamped with the day, the till and
 * who took it, and the cash book reads these.
 */

type Receipt = {
  rentalId?: string | null;
  saleId?: string | null;
  storeId?: string | null;
  amount: number;
  method?: string | null;
  kind?: 'ADVANCE' | 'BALANCE' | 'ADJUSTMENT';
  note?: string | null;
  receivedBy?: string | null;
};

/**
 * Write a receipt, unless there is nothing to write.
 *
 * Zero and negative are dropped rather than stored: a booking with no advance
 * is normal, and a row of zero would clutter the day's till with lines that
 * move no money. Never throws — an order that has already been taken must not
 * fail because its bookkeeping row did.
 */
export async function recordPayment(client: any, receipt: Receipt) {
  const amount = Number(receipt.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  try {
    return await (client ?? prisma).orderPayment.create({
      data: {
        rentalId: receipt.rentalId ?? null,
        saleId: receipt.saleId ?? null,
        storeId: receipt.storeId ?? null,
        amount,
        method: receipt.method || 'CASH',
        kind: receipt.kind || 'ADVANCE',
        note: receipt.note || null,
        receivedBy: receipt.receivedBy || null,
      },
    });
  } catch (err) {
    console.error('[payments] could not record a receipt:', err);
    return null;
  }
}
