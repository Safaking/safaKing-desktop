import { Bill, amountInWords } from '@/lib/gst';

/**
 * A GST tax invoice as a printable page.
 *
 * Built as plain HTML rather than drawn with a PDF library on purpose: this
 * layout is a dense grid of boxes, and a browser does boxes far better than
 * hand-placed coordinates do. Staff press Print and choose Save as PDF, which
 * is what every other billing program in the trade does too.
 *
 * It follows the shape of the bills this shop already receives — seller at the
 * top with the GSTIN, buyer and consignee side by side, the lorry details,
 * the goods, then tax by rate, the amount in words and the net.
 */

export interface BillParty {
  name: string;
  lines: string[];
  phone?: string | null;
  gstin?: string | null;
  stateName?: string | null;
  stateCode?: string | null;
}

export interface BillSeller extends BillParty {
  email?: string | null;
  msmeNumber?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankIfsc?: string | null;
  terms?: string | null;
  jurisdiction?: string | null;
  logoText?: string | null;
}

export interface BillDoc {
  seller: BillSeller;
  buyer: BillParty;
  shipTo?: BillParty | null;
  invoiceNumber: string;
  invoiceDate: string;
  /** The lorry paperwork a cloth bill carries. */
  ewayBillNo?: string | null;
  transport?: string | null;
  lrNumber?: string | null;
  station?: string | null;
  weight?: string | null;
  bill: Bill;
  /** Printed when the shop has no GSTIN yet, so nothing pretends to be a tax invoice. */
  notATaxInvoice: boolean;
}

const money = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const escape = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const party = (heading: string, p: BillParty) => `
  <div class="party">
    <div class="party-head">${escape(heading)}</div>
    <div class="party-body">
      <div class="party-name">${escape(p.name)}</div>
      ${p.lines.filter(Boolean).map((line) => `<div>${escape(line)}</div>`).join('')}
      ${p.phone ? `<div class="kv"><span>PHONE</span> ${escape(p.phone)}</div>` : ''}
      <div class="kv"><span>STATE</span> ${escape(p.stateName ?? '—')}
        <span class="right-label">STATE CODE</span> <b>${escape(p.stateCode ?? '—')}</b></div>
      <div class="kv"><span>GSTIN</span> <b>${escape(p.gstin ?? 'Unregistered')}</b></div>
    </div>
  </div>`;

export function billHtml(doc: BillDoc): string {
  const { bill, seller, buyer } = doc;
  const taxWord = bill.interState ? 'IGST' : 'CGST / SGST';

  const itemRows = bill.lines
    .map(
      (line, index) => `
      <tr>
        <td class="num">${index + 1}</td>
        <td>${escape(line.name)}</td>
        <td class="mono">${escape(line.hsnCode ?? '—')}</td>
        <td class="num">${line.gstPercent.toFixed(2)}</td>
        <td class="num">${line.quantity}</td>
        <td class="num">${money(line.rate)}</td>
        <td class="num">${money(line.gross)}</td>
      </tr>`
    )
    .join('');

  const taxRows = bill.summary
    .map(
      (row) => `
      <tr>
        <td class="mono">${escape(row.hsnCode ?? '—')}</td>
        <td class="num">${row.gstPercent.toFixed(2)}%</td>
        <td class="num">${money(row.taxable)}</td>
        ${
          bill.interState
            ? `<td class="num">${money(row.igst)}</td>`
            : `<td class="num">${money(row.cgst)}</td><td class="num">${money(row.sgst)}</td>`
        }
      </tr>`
    )
    .join('');

  const terms = (seller.terms ?? '')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(doc.notATaxInvoice ? 'Bill' : 'Tax Invoice')} ${escape(doc.invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; padding: 12px;
         font-size: 11px; background: #f3f4f6; }
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 8mm;
           border: 1px solid #000; }
  .topline { display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; }
  .title { text-align: center; font-size: 26px; font-weight: bold; letter-spacing: 1px; margin: 2px 0 0; }
  .seller { text-align: center; line-height: 1.45; }
  .badge { border: 1px solid #000; background: #000; color: #fff; padding: 2px 10px;
           font-weight: bold; letter-spacing: 1px; display: inline-block; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #000; margin-top: 6px; }
  .party { border-right: 1px solid #000; }
  .party:last-child { border-right: 0; }
  .party-head { background: #f0f0f0; border-bottom: 1px solid #000; padding: 2px 6px;
                font-weight: bold; font-size: 10px; letter-spacing: 0.5px; }
  .party-body { padding: 5px 6px; line-height: 1.5; }
  .party-name { font-weight: bold; font-size: 12px; }
  .kv span { display: inline-block; min-width: 46px; color: #444; font-size: 10px; }
  .right-label { margin-left: 10px; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #000;
          border-top: 0; }
  .meta div { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 6px; }
  .meta div:nth-child(4n) { border-right: 0; }
  .meta b { display: block; font-size: 10px; color: #444; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #000; padding: 3px 5px; }
  th { background: #f0f0f0; font-size: 10px; letter-spacing: 0.3px; }
  .num { text-align: right; }
  .mono { font-family: "Courier New", monospace; }
  .totals { display: grid; grid-template-columns: 1.6fr 1fr; gap: 6px; margin-top: 6px; }
  .totals table { margin: 0; }
  .net { font-size: 15px; font-weight: bold; }
  .words { border: 1px solid #000; padding: 5px 6px; margin-top: 6px; font-weight: bold; }
  .foot { display: grid; grid-template-columns: 1.3fr 1fr; gap: 10px; margin-top: 8px;
          font-size: 10px; line-height: 1.5; }
  .sign { text-align: right; padding-top: 34px; }
  .warn { border: 1px solid #000; padding: 6px; margin-top: 6px; font-weight: bold; }
  @media print {
    body { background: #fff; padding: 0; font-size: 10px; }
    .sheet { border: 0; width: auto; min-height: auto; padding: 6mm; }
    .no-print { display: none; }
  }
</style>
</head><body>
<div class="no-print" style="width:210mm;margin:0 auto 8px;text-align:right">
  <button onclick="window.print()" style="padding:8px 18px;font-weight:bold;cursor:pointer">
    Print / Save as PDF
  </button>
</div>

<div class="sheet">
  <div class="topline">
    <span>${seller.gstin ? `GSTIN: ${escape(seller.gstin)}` : ''}</span>
    <span>${escape(seller.logoText ?? '')}</span>
    <span>Original</span>
  </div>

  <div class="title">${escape(seller.name)}</div>
  <div class="seller">
    ${seller.lines.filter(Boolean).map((l) => `<div>${escape(l)}</div>`).join('')}
    ${seller.phone ? `<div>Phone: ${escape(seller.phone)}</div>` : ''}
    ${seller.email ? `<div>${escape(seller.email)}</div>` : ''}
    ${seller.msmeNumber ? `<div>MSME REG. NO: ${escape(seller.msmeNumber)}</div>` : ''}
    <div style="margin-top:4px">
      <span class="badge">${doc.notATaxInvoice ? 'BILL OF SUPPLY' : 'TAX INVOICE'}</span>
      <span style="margin-left:10px;font-weight:bold">
        ${bill.interState ? 'Inter State' : 'Intra State'}
      </span>
    </div>
  </div>

  <div class="grid2">
    ${party('BILL TO', buyer)}
    ${party('SHIP TO', doc.shipTo ?? buyer)}
  </div>

  <div class="meta">
    <div><b>INV. NO</b>${escape(doc.invoiceNumber)}</div>
    <div><b>DATE</b>${escape(doc.invoiceDate)}</div>
    <div><b>E-WAY BILL</b>${escape(doc.ewayBillNo ?? '—')}</div>
    <div><b>TRANSPORT</b>${escape(doc.transport ?? '—')}</div>
    <div><b>L.R. NO</b>${escape(doc.lrNumber ?? '—')}</div>
    <div><b>STATION</b>${escape(doc.station ?? '—')}</div>
    <div><b>FREIGHT</b>${money(bill.freight)}</div>
    <div><b>WEIGHT</b>${escape(doc.weight ?? '—')}</div>
  </div>

  <table>
    <thead><tr>
      <th style="width:28px">#</th>
      <th>PARTICULARS</th>
      <th style="width:72px">HSN / SAC</th>
      <th style="width:48px">GST %</th>
      <th style="width:44px">QTY</th>
      <th style="width:74px">RATE</th>
      <th style="width:88px">AMOUNT</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <table>
      <thead><tr>
        <th>HSN / SAC</th><th>RATE</th><th>TAXABLE</th>
        ${bill.interState ? '<th>IGST</th>' : '<th>CGST</th><th>SGST</th>'}
      </tr></thead>
      <tbody>${taxRows}</tbody>
    </table>

    <table>
      <tr><td>Taxable value</td><td class="num">${money(bill.taxable)}</td></tr>
      ${
        bill.interState
          ? `<tr><td>IGST</td><td class="num">${money(bill.igst)}</td></tr>`
          : `<tr><td>CGST</td><td class="num">${money(bill.cgst)}</td></tr>
             <tr><td>SGST</td><td class="num">${money(bill.sgst)}</td></tr>`
      }
      ${bill.freight ? `<tr><td>Freight</td><td class="num">${money(bill.freight)}</td></tr>` : ''}
      ${bill.discount ? `<tr><td>Less discount</td><td class="num">−${money(bill.discount)}</td></tr>` : ''}
      <tr><td>Round off</td><td class="num">${bill.roundOff >= 0 ? '' : '−'}${money(Math.abs(bill.roundOff))}</td></tr>
      <tr class="net"><td>NET PAYABLE</td><td class="num">₹${money(bill.net)}</td></tr>
    </table>
  </div>

  <div class="words">Amount in words: ${escape(amountInWords(bill.net))}</div>

  ${
    doc.notATaxInvoice
      ? `<div class="warn">This is not a tax invoice. No GST has been charged, because this shop
          has no GSTIN recorded. Add it in Admin to issue tax invoices.</div>`
      : ''
  }

  <div class="foot">
    <div>
      ${seller.bankAccount ? `<div><b>Bank:</b> ${escape(seller.bankName ?? '')} A/C ${escape(seller.bankAccount)}${seller.bankIfsc ? ` · IFSC ${escape(seller.bankIfsc)}` : ''}</div>` : ''}
      ${terms.length ? `<div style="margin-top:4px"><b>Terms &amp; conditions</b></div>` : ''}
      ${terms.map((t, i) => `<div>${i + 1}. ${escape(t)}</div>`).join('')}
      ${seller.jurisdiction ? `<div style="margin-top:4px">Subject to ${escape(seller.jurisdiction)} jurisdiction.</div>` : ''}
      <div style="margin-top:6px">Tax charged: ${escape(taxWord)}</div>
    </div>
    <div class="sign">
      <div>For <b>${escape(seller.name)}</b></div>
      <div style="margin-top:30px">(Authorised Signatory)</div>
    </div>
  </div>
</div>
</body></html>`;
}
