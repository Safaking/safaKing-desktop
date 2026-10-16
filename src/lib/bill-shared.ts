import { BillSeller } from '@/lib/gst-bill-html';

/**
 * The parts a sale bill and a hire bill have in common.
 *
 * The seller block is the shop's billing identity and is the same whichever
 * kind of document is being raised, so it is built once here rather than kept
 * in step by hand in two routes.
 */

export const page = (html: string, status = 200) =>
  new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

export const plain = (message: string, status: number) =>
  page(
    `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px">
     <h3>${message}</h3></body>`,
    status
  );

export const dateText = (value: Date | string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

/** Whatever this branch bills under. */
export function sellerFrom(store: any): BillSeller {
  return {
    name: store?.legalName || store?.name || 'Joshi Safa House',
    lines: [
      store?.addressLine1,
      store?.addressLine2,
      [store?.city, store?.pincode].filter(Boolean).join(' '),
    ].filter(Boolean) as string[],
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
    logoText: store?.logoText ?? null,
  };
}
