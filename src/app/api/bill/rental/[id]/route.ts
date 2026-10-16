import { prisma } from '@/lib/prisma';
import { buildBill } from '@/lib/gst';
import { billHtml, BillDoc } from '@/lib/gst-bill-html';
import { page, plain, dateText, sellerFrom } from '@/lib/bill-shared';

/**
 * A hire as a printable GST tax invoice.
 *
 * Renting out a safa is a supply of service, not of goods, so the lines carry
 * the shop's SAC code rather than a product's HSN. Everything else — the tax
 * working, the layout, the paper — is the sale bill's, so a customer gets the
 * same document whichever side of the shop they bought from.
 *
 * Like the sale route, /api/bill/rental/sample renders the layout with made up
 * figures outside production.
 */

/** Days charged. A one-day hire is a day, not nothing. */
function hireDays(start: Date | string, end: Date | string): number {
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 1;
  return Math.max(1, Math.round((to - from) / 86400000) || 1);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (id === 'sample') {
    if (process.env.NODE_ENV === 'production') return plain('Not found.', 404);
    return page(billHtml(sampleDoc()));
  }

  try {
    const rental = await prisma.rental.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, invoice: true, store: true },
    });
    if (!rental) return plain('That order could not be found.', 404);

    // Same rule as a sale: a tax invoice belongs to an order that was rung up
    // as one, so an ordinary hire keeps its ordinary bill and has no tax
    // worked backwards onto it.
    if (!rental.gstBill) {
      return plain(
        `${rental.orderNumber} was not billed with GST — use Download Invoice for its ordinary bill.`,
        404
      );
    }

    const store = rental.store ?? (await prisma.store.findFirst());
    const sac = store?.rentalSacCode ?? null;
    const rate = store?.rentalGstPercent ?? 5;
    const days = hireDays(rental.startDate, rental.endDate);

    // Hire is priced per day, so the charge is the daily rate across the days
    // the goods are out. The bill shows that as the rate, because a line
    // reading "1 × ₹200" on a four-day hire is what starts arguments.
    const lines = rental.items.map((item) => ({
      name: `${item.product?.name ?? 'Item'} — hire, ${days} day${days === 1 ? '' : 's'}`,
      hsnCode: sac,
      gstPercent: rate,
      quantity: item.quantity,
      rate: item.pricePerDay * days,
    }));

    if ((rental.tieSafaCharge ?? 0) > 0) {
      lines.push({
        name: rental.safaShape ? `Safa tying — ${rental.safaShape}` : 'Safa tying',
        hsnCode: sac,
        gstPercent: rate,
        quantity: 1,
        rate: rental.tieSafaCharge,
      });
    }

    // Charged when goods come back damaged, so it is part of what was supplied
    // and belongs on the bill rather than beside it.
    if ((rental.damageCharge ?? 0) > 0) {
      lines.push({
        name: 'Damage charge',
        hsnCode: sac,
        gstPercent: rate,
        quantity: 1,
        rate: rental.damageCharge,
      });
    }

    const bill = buildBill({
      lines,
      sellerStateCode: store?.stateCode ?? null,
      buyerStateCode: rental.customerStateCode ?? null,
      pricesIncludeTax: store?.pricesIncludeTax ?? true,
      discount: rental.discount ?? 0,
    });

    const doc: BillDoc = {
      seller: sellerFrom(store),
      buyer: {
        name: rental.customerName,
        lines: [rental.customerAddress ?? ''].filter(Boolean),
        phone: rental.customerPhone,
        gstin: rental.customerGstin,
        stateName: store?.stateName ?? null,
        stateCode: rental.customerStateCode ?? store?.stateCode ?? null,
      },
      invoiceNumber: rental.invoice?.invoiceNumber ?? rental.orderNumber,
      invoiceDate: dateText(rental.createdAt),
      // The hire period, in the slots the sale bill uses for lorry paperwork —
      // a hire has no e-way bill, but it very much has dates.
      transport: `${dateText(rental.startDate)} — ${dateText(rental.endDate)}`,
      station: `${days} day${days === 1 ? '' : 's'}`,
      bill,
      notATaxInvoice: !store?.gstin,
      buyerPhone: rental.customerPhone,
      serviceBill: true,
    };

    return page(billHtml(doc));
  } catch (error) {
    console.error('Could not build the hire bill:', error);
    return plain('The bill could not be built. Please try again.', 500);
  }
}

/** Made-up figures in the shape of a real hire, for checking the layout. */
function sampleDoc(): BillDoc {
  const bill = buildBill({
    lines: [
      { name: 'Jodhpuri Safa — hire, 3 days', hsnCode: '997329', gstPercent: 5, quantity: 25, rate: 150 },
      { name: 'Safa tying — Jodhpuri', hsnCode: '997329', gstPercent: 5, quantity: 1, rate: 1250 },
    ],
    sellerStateCode: '08',
    buyerStateCode: '08',
    pricesIncludeTax: false,
    discount: 0,
  });

  return {
    seller: {
      name: 'JOSHI SAFA HOUSE',
      lines: ['Near Pandya Memorial School', 'Char Khamba', 'Partapur, Dist. Banswara (Rajasthan) 327024'],
      phone: '+91 90013 47143, +91 76918 56577',
      email: 'safakingn111@gmail.com',
      gstin: '08DBNPJ9280C1ZC',
      stateName: 'RAJASTHAN',
      stateCode: '08',
      msmeNumber: null,
      bankName: null,
      bankAccount: null,
      bankIfsc: null,
      terms: 'Interest at 18% is charged after 30 days from the invoice date.\nGoods are forwarded at the buyer’s risk.',
      jurisdiction: 'Banswara',
      logoText: '|| SHREE GANESHAY NAMAH ||',
    },
    buyer: {
      name: 'SAMPLE CUSTOMER',
      lines: ['Main Bazar, Partapur', 'Banswara 327022'],
      phone: '9929632671',
      gstin: null,
      stateName: 'RAJASTHAN',
      stateCode: '08',
    },
    invoiceNumber: 'SAMPLE-R-0001',
    invoiceDate: dateText(new Date()),
    transport: '20/10/2026 — 23/10/2026',
    station: '3 days',
    bill,
    notATaxInvoice: false,
    buyerPhone: '9929632671',
    serviceBill: true,
  };
}
