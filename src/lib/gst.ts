/**
 * The arithmetic behind a GST tax invoice.
 *
 * Kept away from the drawing so it can be checked on its own, because this is
 * the part that has to survive an accountant: a rupee wrong here is wrong on
 * a government return, not merely ugly on a page.
 *
 * Two rules decide everything:
 *
 *   Where the buyer is. Same state as the shop and the tax splits into CGST
 *   and SGST, half each; another state and it is one IGST line. The two-digit
 *   state code on each GSTIN is what decides it, never the address text.
 *
 *   Where the tax already is. A counter price of ₹400 usually holds the tax
 *   inside it; a wholesale rate per metre usually has it added on top. The
 *   same bill can be read either way and the totals differ, so the shop says
 *   which it is and this follows.
 */

export interface TaxLine {
  /** What it is called on the bill. */
  name: string;
  hsnCode: string | null;
  gstPercent: number;
  quantity: number;
  /** Price for one, as the shop quotes it. */
  rate: number;
}

export interface ComputedLine extends TaxLine {
  /** quantity × rate, as quoted. */
  gross: number;
  /** The part the tax is charged on. */
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** What this line adds to the bill. */
  total: number;
}

export interface TaxSummaryRow {
  hsnCode: string | null;
  gstPercent: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface Bill {
  lines: ComputedLine[];
  summary: TaxSummaryRow[];
  /** Before tax. */
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  /** Charges that are not goods, taxed at the same rate as the bill. */
  freight: number;
  discount: number;
  /** Taxable + tax + freight − discount, before rounding. */
  beforeRounding: number;
  roundOff: number;
  /** What the customer pays. */
  net: number;
  interState: boolean;
}

const paise = (value: number) => Math.round(value * 100) / 100;

export interface BillInput {
  lines: TaxLine[];
  /** The shop's state code and the buyer's — two digits each. */
  sellerStateCode?: string | null;
  buyerStateCode?: string | null;
  /** True when a quoted price already holds the tax. */
  pricesIncludeTax: boolean;
  freight?: number;
  discount?: number;
}

export function buildBill({
  lines,
  sellerStateCode,
  buyerStateCode,
  pricesIncludeTax,
  freight = 0,
  discount = 0,
}: BillInput): Bill {
  // No buyer state means a walk-in customer, who is by definition local.
  const seller = (sellerStateCode ?? '').trim();
  const buyer = (buyerStateCode ?? '').trim();
  const interState = Boolean(seller && buyer && seller !== buyer);

  const computed: ComputedLine[] = lines.map((line) => {
    const gross = paise(line.quantity * line.rate);
    const rate = Math.max(0, line.gstPercent) / 100;
    const taxable = pricesIncludeTax ? paise(gross / (1 + rate)) : gross;
    return { ...line, gross, taxable, cgst: 0, sgst: 0, igst: 0, total: taxable };
  });

  // One row per code and rate, which is the shape a return expects — and the
  // level the tax is actually worked out at.
  const grouped = new Map<string, TaxSummaryRow>();
  for (const line of computed) {
    const key = `${line.hsnCode ?? '-'}|${line.gstPercent}`;
    const row = grouped.get(key) ?? {
      hsnCode: line.hsnCode,
      gstPercent: line.gstPercent,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    };
    row.taxable = paise(row.taxable + line.taxable);
    grouped.set(key, row);
  }

  for (const row of grouped.values()) {
    const tax = paise((row.taxable * row.gstPercent) / 100);
    if (interState) {
      row.igst = tax;
    } else {
      row.cgst = paise(tax / 2);
      row.sgst = paise(tax - row.cgst);
    }
  }

  const rows = [...grouped.values()];
  const addUp = (pick: (row: TaxSummaryRow) => number) => paise(rows.reduce((total, row) => total + pick(row), 0));

  const taxable = addUp((r) => r.taxable);
  const cgst = addUp((r) => r.cgst);
  const sgst = addUp((r) => r.sgst);
  const igst = addUp((r) => r.igst);
  const totalTax = paise(cgst + sgst + igst);
  const beforeRounding = paise(taxable + totalTax + freight - discount);
  const net = Math.round(beforeRounding);

  return {
    lines: computed,
    summary: rows,
    taxable,
    cgst,
    sgst,
    igst,
    totalTax,
    freight: paise(freight),
    discount: paise(discount),
    beforeRounding,
    roundOff: paise(net - beforeRounding),
    net,
    interState,
  };
}

/**
 * The amount written out, the way an Indian bill writes it — in lakhs and
 * crores, not millions.
 */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paiseLeft = Math.round((Math.abs(amount) - rupees) * 100);

  const ones = [
    '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
    'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
  ];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

  const under100 = (n: number): string =>
    n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;

  const under1000 = (n: number): string => {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    return [hundred ? `${ones[hundred]} HUNDRED` : '', rest ? under100(rest) : ''].filter(Boolean).join(' ');
  };

  const say = (n: number): string => {
    if (n === 0) return 'ZERO';
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const rest = n % 1000;
    return [
      crore ? `${say(crore)} CRORE` : '',
      lakh ? `${under1000(lakh)} LAKH` : '',
      thousand ? `${under1000(thousand)} THOUSAND` : '',
      rest ? under1000(rest) : '',
    ].filter(Boolean).join(' ');
  };

  const words = say(rupees);
  const sign = amount < 0 ? 'MINUS ' : '';
  return paiseLeft > 0
    ? `${sign}${words} AND ${under100(paiseLeft)} PAISE ONLY`
    : `${sign}${words} ONLY`;
}
