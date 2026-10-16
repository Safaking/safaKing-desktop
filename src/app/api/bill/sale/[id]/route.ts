import { prisma } from '@/lib/prisma';
import { buildBill } from '@/lib/gst';
import { billHtml, BillDoc } from '@/lib/gst-bill-html';

/**
 * A sale as a printable GST tax invoice.
 *
 * Served as a page rather than a download so staff can look at it before
 * committing it to paper, and print to PDF from the browser — which is how
 * every other billing program in the trade does it.
 *
 * Opening /api/bill/sale/sample while developing renders the layout with made
 * up figures, so it can be checked without a sale to hand. It is refused in
 * production.
 */

const page = (html: string, status = 200) =>
  new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

const plain = (message: string, status: number) =>
  page(`<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px">
        <h3>${message}</h3></body>`, status);

const dateText = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Next hands these over as a promise now; reading them straight gives
  // undefined and every bill falls through to "not found".
  const { id } = await params;

  if (id === 'sample') {
    if (process.env.NODE_ENV === 'production') return plain('Not found.', 404);
    return page(billHtml(sampleDoc()));
  }

  try {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, invoice: true, store: true },
    });
    if (!sale) return plain('That sale could not be found.', 404);

    // A sale without its own branch still has to print, so fall back to the
    // only store rather than refusing.
    const store = sale.store ?? (await prisma.store.findFirst());

    const bill = buildBill({
      lines: sale.items.map((item) => ({
        name: item.product?.name ?? 'Item',
        hsnCode: item.hsnCode ?? item.product?.hsnCode ?? null,
        gstPercent: item.gstPercent ?? item.product?.gstPercent ?? 0,
        quantity: item.quantity,
        rate: item.price,
      })),
      sellerStateCode: store?.stateCode ?? null,
      buyerStateCode: sale.customerStateCode ?? null,
      pricesIncludeTax: store?.pricesIncludeTax ?? true,
      freight: sale.freightAmount ?? 0,
      discount: sale.discount ?? 0,
    });

    const doc: BillDoc = {
      seller: {
        name: store?.legalName || store?.name || 'Joshi Safa House',
        lines: [store?.addressLine1, store?.addressLine2, [store?.city, store?.pincode].filter(Boolean).join(' ')]
          .filter(Boolean) as string[],
        phone: store?.phones ?? null,
        email: store?.email ?? null,
        gstin: store?.gstin ?? null,
        stateName: store?.stateName ?? null,
        stateCode: store?.stateCode ?? null,
        msmeNumber: store?.msmeNumber ?? null,
        bankName: store?.bankName ?? null,
        bankAccount: store?.bankAccount ?? null,
        bankIfsc: store?.bankIfsc ?? null,
        terms: store?.invoiceTerms ?? null,
        jurisdiction: store?.jurisdiction ?? null,
      },
      buyer: {
        name: sale.customerName,
        lines: [sale.customerAddress ?? ''].filter(Boolean),
        phone: sale.customerPhone,
        gstin: sale.customerGstin,
        stateName: store?.stateName ?? null,
        stateCode: sale.customerStateCode ?? store?.stateCode ?? null,
      },
      invoiceNumber: sale.invoice?.invoiceNumber ?? sale.orderNumber,
      invoiceDate: dateText(sale.createdAt),
      ewayBillNo: sale.ewayBillNo,
      transport: sale.transport,
      lrNumber: sale.lrNumber,
      station: sale.station,
      bill,
      // Without a GSTIN nothing may call itself a tax invoice.
      notATaxInvoice: !store?.gstin,
    };

    return page(billHtml(doc));
  } catch (error) {
    console.error('Could not build the bill:', error);
    return plain('The bill could not be built. Please try again.', 500);
  }
}

/** Made-up figures in the shape of a real cloth bill, for checking the layout. */
function sampleDoc(): BillDoc {
  const bill = buildBill({
    lines: [
      { name: 'JERRY (L-85) LUMP — ORANGE PITCH', hsnCode: '54071011', gstPercent: 5, quantity: 10, rate: 883.039 },
      { name: 'JERRY (L-85) LUMP — RED', hsnCode: '54071011', gstPercent: 5, quantity: 10, rate: 863.644 },
      { name: 'Jodhpuri Safa — ready tied', hsnCode: '65050090', gstPercent: 5, quantity: 4, rate: 1250 },
    ],
    sellerStateCode: '08',
    buyerStateCode: '08',
    pricesIncludeTax: false,
    freight: 0,
    discount: 0,
  });

  return {
    seller: {
      name: 'JOSHI SAFA HOUSE',
      lines: ['Near Pandya Memorial School, Char Khamba', 'Partapur, Banswara (Raj) 327024'],
      phone: '+91 90013 47143, 76918 56577',
      email: 'joshisafahouse@gmail.com',
      gstin: '08DBNPJ9280C1ZC',
      stateName: 'RAJASTHAN',
      stateCode: '08',
      // Placeholders. These were lifted off a supplier's own bill while the
      // layout was being matched, and someone's real account number has no
      // business sitting in a demo.
      msmeNumber: 'UDYAM-RJ-00-0000000',
      bankName: 'BANK NAME',
      bankAccount: '0000000000000000',
      bankIfsc: 'XXXX0000000',
      terms: 'Interest at 18% is charged after 30 days from the invoice date.\nGoods are forwarded at the buyer’s risk.\nPayment by account payee cheque only.',
      jurisdiction: 'Banswara',
      logoText: '|| SHREE GANESHAY NAMAH ||',
    },
    buyer: {
      name: 'SAMPLE CLOTH MERCHANT',
      lines: ['Main Bazar, Partapur', 'Banswara 327022'],
      phone: '9929632671',
      // A made-up buyer number. The seller's own GSTIN here made the sample
      // read as the shop billing itself.
      gstin: '08AAACS0000A1Z9',
      stateName: 'RAJASTHAN',
      stateCode: '08',
    },
    invoiceNumber: 'SAMPLE-0001',
    invoiceDate: dateText(new Date()),
    ewayBillNo: '791660220096',
    transport: 'UDAIPUR GOLDAN',
    lrNumber: 'RJ20-8403159',
    station: 'PARTAPUR',
    weight: '450.00',
    bill,
    notATaxInvoice: false,
  };
}
