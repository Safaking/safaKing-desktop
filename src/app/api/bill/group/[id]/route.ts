import { prisma } from '@/lib/prisma';

/**
 * One customer's visit on one bill.
 *
 * A groom buys one safa and hires another; until now that was two orders, two
 * bills and two totals to add up at the counter. The two orders stay exactly
 * as they are — separate records, separate stock, separate returns — and this
 * prints them together.
 *
 * Served as a page rather than a download, like the tax invoice: staff look at
 * it, then print or save as PDF from the browser.
 *
 * Deliberately not a GST bill. A hire is a supply of service and would need
 * its own SAC code, which the shop has not settled; a sale that needs a tax
 * invoice still has its own at /api/bill/sale/[id].
 */

const page = (html: string, status = 200) =>
  new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

const plain = (message: string, status: number) =>
  page(
    `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px">
     <h3>${message}</h3></body>`,
    status
  );

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const money = (n: number) =>
  `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const day = (v: Date | string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

/** Indian numbers are stored every which way; WhatsApp wants digits and a country code. */
function waNumber(phone: string | null | undefined) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, '');
  if (d.length === 10) d = `91${d}`;
  else if (d.length === 11 && d.startsWith('0')) d = `91${d.slice(1)}`;
  else if (d.length < 10) return null;
  return d;
}

function rows(lines: Array<{ name: string; quantity: number; rate: number }>) {
  return lines
    .map(
      (l, i) => `<tr>
        <td class="n">${i + 1}</td>
        <td>${esc(l.name)}</td>
        <td class="n">${l.quantity}</td>
        <td class="n">${money(l.rate)}</td>
        <td class="n">${money(l.rate * l.quantity)}</td>
      </tr>`
    )
    .join('');
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const [sales, rentals] = await Promise.all([
      prisma.sale.findMany({
        where: { groupId: id },
        include: { items: { include: { product: true } }, invoice: true, store: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.rental.findMany({
        where: { groupId: id },
        include: { items: { include: { product: true } }, invoice: true, store: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (sales.length === 0 && rentals.length === 0) {
      return plain('That bill could not be found.', 404);
    }

    const first: any = sales[0] ?? rentals[0];
    const store: any = first.store ?? (await prisma.store.findFirst());

    const sellerLines = [
      store?.addressLine1,
      store?.addressLine2,
      [store?.city, store?.pincode].filter(Boolean).join(' '),
    ].filter(Boolean);

    // Tying and damage are charged on the order but are not among its items,
    // so they go on as their own lines or the total would not add up.
    const saleLines = sales.flatMap((s: any) => [
      ...s.items.map((i: any) => ({
        name: i.product?.name ?? 'Item',
        quantity: i.quantity,
        rate: i.price,
      })),
      ...((s.tieSafaCharge ?? 0) > 0
        ? [{ name: s.safaShape ? `साफा बँधाई — ${s.safaShape}` : 'साफा बँधाई', quantity: 1, rate: s.tieSafaCharge }]
        : []),
    ]);

    const hireDays = (r: any) => {
      const from = new Date(r.startDate).getTime();
      const to = new Date(r.endDate).getTime();
      if (Number.isNaN(from) || Number.isNaN(to)) return 1;
      return Math.max(1, Math.round((to - from) / 86400000) || 1);
    };

    const rentalLines = rentals.flatMap((r: any) => [
      ...r.items.map((i: any) => ({
        name: `${i.product?.name ?? 'Item'} — ${hireDays(r)} दिन`,
        quantity: i.quantity,
        rate: i.pricePerDay * hireDays(r),
      })),
      ...((r.tieSafaCharge ?? 0) > 0
        ? [{ name: r.safaShape ? `साफा बँधाई — ${r.safaShape}` : 'साफा बँधाई', quantity: 1, rate: r.tieSafaCharge }]
        : []),
      ...((r.damageCharge ?? 0) > 0
        ? [{ name: 'नुक़सान / Damage', quantity: 1, rate: r.damageCharge }]
        : []),
    ]);

    // Each order keeps its own books; the bill only adds them up. Nothing here
    // moves money between them.
    const sum = (list: any[], field: string) =>
      list.reduce((t, o) => t + (Number(o[field]) || 0), 0);

    const total = sum(sales, 'totalAmount') + sum(rentals, 'totalAmount');
    const paid = sum(sales, 'paidAmount') + sum(rentals, 'paidAmount');
    const due = Math.max(0, total - paid);

    const orderNumbers = [...sales, ...rentals].map((o: any) => o.orderNumber);
    const wa = waNumber(first.customerPhone);

    const section = (
      title: string,
      lines: Array<{ name: string; quantity: number; rate: number }>,
      meta: string
    ) =>
      lines.length === 0
        ? ''
        : `<div class="sec">
             <div class="sechead"><b>${esc(title)}</b><span>${esc(meta)}</span></div>
             <table>
               <thead><tr><th>#</th><th>विवरण / Particulars</th><th class="n">नग</th><th class="n">दर</th><th class="n">राशि</th></tr></thead>
               <tbody>${rows(lines)}</tbody>
             </table>
           </div>`;

    const hireMeta = rentals
      .map((r: any) => `${day(r.startDate)} — ${day(r.endDate)}`)
      .join(', ');

    const html = `<!doctype html><html lang="hi"><head><meta charset="utf-8">
<title>बिल ${esc(first.customerName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, "Segoe UI", sans-serif; background: #f1f5f9; margin: 0; padding: 16px; color: #000; }
  .sheet { width: 210mm; min-height: 280mm; margin: 0 auto; background: #fff; padding: 12mm; border: 1px solid #000; }
  .shop { text-align: center; }
  .shop h1 { font-size: 26px; margin: 2px 0 4px; letter-spacing: 1px; }
  .shop p { margin: 1px 0; font-size: 11px; }
  .inv { text-align: center; margin: 10px 0; }
  .inv span { border: 1px solid #000; background: #000; color: #fff; padding: 2px 12px; font-weight: bold; letter-spacing: 1px; font-size: 12px; }
  .who { border: 1px solid #000; padding: 8px 10px; margin-top: 8px; font-size: 12px; display: flex; justify-content: space-between; gap: 12px; }
  .who b { display: block; font-size: 14px; }
  .sec { margin-top: 12px; }
  .sechead { display: flex; justify-content: space-between; align-items: baseline;
             border: 1px solid #000; border-bottom: 0; padding: 5px 8px; font-size: 12px; background: #f3f4f6; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; }
  th { background: #f3f4f6; font-size: 11px; }
  .n { text-align: right; }
  .totals { margin-top: 12px; margin-left: auto; width: 62mm; font-size: 13px; }
  .totals td { border: 1px solid #000; padding: 5px 8px; }
  .totals .big td { font-size: 16px; font-weight: bold; }
  .foot { margin-top: 14px; font-size: 11px; display: flex; justify-content: space-between; }
  .bar { width: 210mm; margin: 0 auto 8px; text-align: right; }
  .bar button { padding: 8px 18px; font-weight: bold; cursor: pointer; }
  .wa { background: #25D366; color: #fff; border: 1px solid #1da851; border-radius: 4px; margin-right: 6px; }
  @media print { body { background: #fff; padding: 0; } .sheet { border: 0; width: auto; padding: 6mm; } .bar { display: none; } }
</style></head><body>

<div class="bar">
  ${wa ? `<button class="wa" id="wa">WhatsApp भेजें</button>` : ''}
  <button onclick="window.print()">Print / Save as PDF</button>
</div>

<div class="sheet">
  <div class="shop">
    ${store?.logoText ? `<p>${esc(store.logoText)}</p>` : ''}
    <h1>${esc(store?.legalName || store?.name || 'Joshi Store')}</h1>
    ${sellerLines.map((l: string) => `<p>${esc(l)}</p>`).join('')}
    ${store?.phones ? `<p>फ़ोन: ${esc(store.phones)}</p>` : ''}
  </div>

  <div class="inv"><span>बिल / BILL</span></div>

  <div class="who">
    <div>
      <b>${esc(first.customerName)}</b>
      ${first.customerPhone ? `${esc(first.customerPhone)}<br>` : ''}
      ${first.customerAddress ? esc(first.customerAddress) : ''}
    </div>
    <div class="n">
      दिनांक: ${day(first.createdAt)}<br>
      ऑर्डर: ${orderNumbers.map(esc).join(' + ')}
    </div>
  </div>

  ${section('ख़रीद / PURCHASE', saleLines, sales.map((s: any) => s.orderNumber).join(', '))}
  ${section('किराया / HIRE', rentalLines, hireMeta)}

  <table class="totals">
    <tr><td>कुल / Total</td><td class="n">${money(total)}</td></tr>
    <tr><td>जमा / Paid</td><td class="n">${money(paid)}</td></tr>
    <tr class="big"><td>बकाया / Due</td><td class="n">${money(due)}</td></tr>
  </table>

  <div class="foot">
    <div>किराये का सामान समय पर लौटाना है।</div>
    <div>के लिए <b>${esc(store?.legalName || store?.name || 'Joshi Store')}</b></div>
  </div>
</div>

${
  wa
    ? `<script>
        document.getElementById('wa').addEventListener('click', function () {
          var text = ${JSON.stringify(`नमस्ते ${first.customerName} जी, आपका बिल —`)} + ' ' + window.location.href;
          window.open('https://wa.me/${wa}?text=' + encodeURIComponent(text), '_blank');
        });
      </script>`
    : ''
}
</body></html>`;

    return page(html);
  } catch (error) {
    console.error('Could not build the group bill:', error);
    return plain('The bill could not be built. Please try again.', 500);
  }
}
