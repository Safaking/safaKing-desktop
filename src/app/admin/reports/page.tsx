'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { format } from 'date-fns';
import {
  ArrowLeft,
  BarChart3,
  IndianRupee,
  Package,
  Palette,
  AlertCircle,
  CheckCircle2,
  Printer,
} from 'lucide-react';
import DateInput from '@/components/DateInput';
import { fetcher } from '@/lib/data';

const money = (n?: number | null) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const fmtDate = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : format(d, 'dd-MM-yy');
};

/** Today and N days ago as yyyy-mm-dd, for the quick range buttons. */
const isoDay = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
};

function Stat({
  label,
  value,
  tone = 'slate',
  hint,
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'emerald' | 'rose' | 'indigo';
  hint?: string;
}) {
  const toneClass = {
    slate: 'text-slate-800',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    indigo: 'text-indigo-600',
  }[tone];
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-black mt-1 ${toneClass}`}>{value}</p>
      {hint && <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export default function ReportsPage() {
  // Default to the last 30 days so the page is useful before touching anything.
  const [from, setFrom] = useState(isoDay(30));
  const [to, setTo] = useState(isoDay(0));
  const [kind, setKind] = useState<'ALL' | 'RENTAL' | 'SALE'>('ALL');
  // Revenue and artist dues answer different questions, so they are separate
  // reports over the same date range rather than one long page.
  const [report, setReport] = useState<'REVENUE' | 'ARTISTS'>('REVENUE');
  const [openArtist, setOpenArtist] = useState<string | null>(null);

  const { data, isLoading, error } = useSWR(
    `/api/reports?from=${from}&to=${to}`,
    fetcher,
    { keepPreviousData: true }
  );

  const summary = data?.summary;
  const orders: any[] = Array.isArray(data?.orders) ? data.orders : [];
  const artists: any[] = Array.isArray(data?.artists) ? data.artists : [];

  const visibleOrders = orders.filter(o => kind === 'ALL' || o.kind === kind);

  const artistTotals = artists.reduce(
    (t, a) => ({
      orders: t.orders + (a.orderCount || 0),
      safas: t.safas + (a.safasTied || 0),
      payable: t.payable + (a.feeTotal || 0),
      paid: t.paid + (a.feePaid || 0),
      due: t.due + (a.feeDue || 0),
    }),
    { orders: 0, safas: 0, payable: 0, paid: 0, due: 0 }
  );

  /**
   * Print what is on screen. A separate window keeps the app chrome out of the
   * printout rather than fighting it with print-only stylesheets.
   */
  const printReport = () => {
    const rows = visibleOrders
      .map(
        o => `<tr>
          <td>${o.orderNumber} <span class="k">${o.kind}</span></td>
          <td>${o.customerName ?? ''}${o.vendorName ? `<br><span class="k">${o.vendorName}</span>` : ''}${
            o.itemNames ? `<br><span class="k">${o.itemNames}</span>` : ''
          }</td>
          <td>${fmtDate(o.createdAt)}</td>
          <td>${o.status}</td>
          <td style="text-align:right">${money(o.totalAmount)}</td>
          <td style="text-align:right">${money(o.paidAmount)}</td>
          <td style="text-align:right">${money(o.remainingAmount)}</td>
          <td>${o.kind === 'SALE' ? '' : o.readyAt ? 'Ready' : 'Not ready'}</td>
          <td>${o.artistName ?? ''}</td>
        </tr>`
      )
      .join('');

    const artistRows = artists
      .map(
        a => `<tr><td>${a.name}</td><td style="text-align:right">${a.orderCount}</td>
          <td style="text-align:right">${a.safasTied}</td>
          <td style="text-align:right">${money(a.feeTotal)}</td>
          <td style="text-align:right">${money(a.feePaid)}</td>
          <td style="text-align:right">${money(a.feeDue)}</td></tr>`
      )
      .join('');

    const w = window.open('', '_blank', 'width=1000,height=760');
    if (!w) {
      alert('Allow pop-ups to print this report.');
      return;
    }
    w.document.write(`<!doctype html><html><head><title>Report ${from} to ${to}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#1e293b}
      h1{font-size:20px;margin:0} h2{font-size:14px;margin:22px 0 8px}
      .sub{color:#64748b;font-size:12px;margin:2px 0 16px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{text-align:left;background:#f1f5f9;padding:6px;border-bottom:1px solid #cbd5e1}
      td{padding:6px;border-bottom:1px solid #e2e8f0;vertical-align:top}
      .k{color:#94a3b8;font-size:10px}
      .cards{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px}
      .card{border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;min-width:118px}
      .card b{display:block;font-size:15px} .card span{font-size:10px;color:#64748b;text-transform:uppercase}
    </style></head><body>
      <h1>Joshi Safa House</h1>
      <p class="sub">${report === 'ARTISTS' ? 'Artist payments' : 'Revenue report'} ${from} to ${to} &middot; printed ${format(new Date(), 'MM/dd/yyyy')}</p>
      <div class="cards">
        <div class="card"><span>Revenue</span><b>${money(summary?.revenue)}</b></div>
        <div class="card"><span>Collected</span><b>${money(summary?.collected)}</b></div>
        <div class="card"><span>Outstanding</span><b>${money(summary?.outstanding)}</b></div>
        <div class="card"><span>Orders</span><b>${summary?.orderCount ?? 0}</b></div>
        <div class="card"><span>Not ready</span><b>${summary?.notReadyCount ?? 0}</b></div>
      </div>
      ${
        artistRows
          ? `<h2>Artist workload &amp; dues</h2><table><thead><tr><th>Artist</th>
             <th style="text-align:right">Orders</th><th style="text-align:right">Safas</th>
             <th style="text-align:right">Earned</th><th style="text-align:right">Paid</th>
             <th style="text-align:right">Due</th></tr></thead><tbody>${artistRows}</tbody></table>`
          : ''
      }
      ${report === 'ARTISTS' ? '' : `<h2>Orders (${visibleOrders.length})</h2>`}
      ${
        report === 'ARTISTS'
          ? ''
          : `<table><thead><tr><th>Order</th><th>Customer &amp; items</th><th>Taken</th><th>Status</th>
        <th style="text-align:right">Total</th><th style="text-align:right">Paid</th>
        <th style="text-align:right">Due</th><th>Ready</th><th>Artist</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="9">No orders in this range.</td></tr>'}</tbody></table>`
      }
    </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const setRange = (days: number) => {
    setFrom(isoDay(days));
    setTo(isoDay(0));
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <Link href="/admin" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <BarChart3 size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Reports</h1>
              <p className="text-xs text-slate-500 font-medium">Orders, money and artist dues for a date range</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 w-fit">
          {([
            { key: 'REVENUE', label: 'Revenue' },
            { key: 'ARTISTS', label: 'Artists' },
          ] as const).map(r => (
            <button
              key={r.key}
              onClick={() => setReport(r.key)}
              className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                report === r.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-end gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">From</label>
            <DateInput
              value={from}
              onChange={setFrom}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold w-40"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">To</label>
            <DateInput
              value={to}
              onChange={setTo}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold w-40"
            />
          </div>

          <div className="flex flex-wrap gap-2 lg:ml-2">
            {[
              { label: 'Today', days: 0 },
              { label: '7 days', days: 7 },
              { label: '30 days', days: 30 },
              { label: '90 days', days: 90 },
            ].map(r => (
              <button
                key={r.label}
                onClick={() => setRange(r.days)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="lg:ml-auto flex gap-2">
            <button
              onClick={printReport}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Printer size={14} /> Print
            </button>
            {report === 'REVENUE' &&
              (['ALL', 'RENTAL', 'SALE'] as const).map(k => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                  kind === k
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {k === 'ALL' ? 'All orders' : k === 'RENTAL' ? 'Rentals' : 'Sales'}
                </button>
              ))}
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={16} /> Could not load the report. {String(error.message || '')}
          </div>
        )}

        {report === 'REVENUE' ? (
          <>
        {/* Money summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat
            label="Revenue"
            value={money(summary?.revenue)}
            tone="indigo"
            hint={`${summary?.orderCount ?? 0} orders`}
          />
          <Stat label="Collected" value={money(summary?.collected)} tone="emerald" />
          <Stat
            label="Outstanding"
            value={money(summary?.outstanding)}
            tone={(summary?.outstanding ?? 0) > 0 ? 'rose' : 'slate'}
          />
          <Stat
            label="Discount given"
            value={money(summary?.discount)}
            hint={`Tying charged ${money(summary?.tyingCharge)}`}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Rentals" value={String(summary?.rentalCount ?? 0)} hint={money(summary?.rentalRevenue)} />
          <Stat label="Sales" value={String(summary?.saleCount ?? 0)} hint={money(summary?.saleRevenue)} />
          <Stat label="Ready" value={String(summary?.readyCount ?? 0)} tone="emerald" hint="rentals marked ready" />
          <Stat
            label="Not ready"
            value={String(summary?.notReadyCount ?? 0)}
            tone={(summary?.notReadyCount ?? 0) > 0 ? 'rose' : 'slate'}
            hint="rentals still to prepare"
          />
        </div>

        {/* Orders */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Package size={16} className="text-indigo-600" /> Orders
            </h2>
            <span className="text-[11px] font-bold text-slate-400">
              {isLoading ? 'Loading…' : `${visibleOrders.length} shown`}
            </span>
          </div>

          {visibleOrders.length === 0 && !isLoading ? (
            <p className="p-8 text-center text-slate-400 font-medium text-sm">
              No orders in this date range.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[900px]">
                <thead className="bg-slate-50/70 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2">Order</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">Taken</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-right">Paid</th>
                    <th className="px-4 py-2 text-right">Due</th>
                    <th className="px-4 py-2">Ready</th>
                    <th className="px-4 py-2">Artist</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map(o => (
                    <tr key={`${o.kind}-${o.id}`} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5">
                        <span className="font-black text-indigo-600">{o.orderNumber}</span>
                        <span
                          className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-black ${
                            o.kind === 'RENTAL' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {o.kind}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-700">
                        {o.customerName}
                        {o.vendorName && (
                          <span className="block text-[10px] font-bold text-violet-600">{o.vendorName}</span>
                        )}
                        {o.itemNames && (
                          <span
                            className="block text-[10px] font-semibold text-slate-400 max-w-[220px] truncate"
                            title={o.itemNames}
                          >
                            {o.itemNames}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-500">{fmtDate(o.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-black text-slate-600">{o.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-800">{money(o.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{money(o.paidAmount)}</td>
                      <td
                        className={`px-4 py-2.5 text-right font-bold ${
                          (o.remainingAmount ?? 0) > 0 ? 'text-rose-600' : 'text-slate-300'
                        }`}
                      >
                        {money(o.remainingAmount)}
                      </td>
                      <td className="px-4 py-2.5">
                        {o.kind === 'SALE' ? (
                          <span className="text-slate-300 text-xs">—</span>
                        ) : o.readyAt ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700"
                            title={o.readyBy ? `by ${o.readyBy}` : undefined}
                          >
                            <CheckCircle2 size={12} /> {fmtDate(o.readyAt)}
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-amber-600">Not ready</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {o.artistName ? (
                          <span className="text-[11px] font-bold text-violet-700">
                            {o.artistName}
                            {o.artistOwed > 0 && (
                              <span className={o.artistPaid ? 'text-emerald-600' : 'text-rose-600'}>
                                {' '}
                                {money(o.artistOwed)}
                              </span>
                            )}
                          </span>
                        ) : o.tieSafa ? (
                          <span className="text-[10px] font-black text-amber-600">Unallocated</span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </>
        ) : (
          <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Artists" value={String(artists.length)} hint={`${artistTotals.orders} orders`} />
          <Stat label="Safas tied" value={String(artistTotals.safas)} />
          <Stat label="Total payable" value={money(artistTotals.payable)} tone="indigo" />
          <Stat
            label="Still to pay"
            value={money(artistTotals.due)}
            tone={artistTotals.due > 0 ? 'rose' : 'slate'}
            hint={`${money(artistTotals.paid)} already paid`}
          />
        </div>

        {/* Artist workload */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Palette size={16} className="text-violet-600" /> Artist workload &amp; dues
            </h2>
            {(data?.unallocatedTying ?? 0) > 0 && (
              <span className="text-[11px] font-black text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">
                {data.unallocatedTying} tying order{data.unallocatedTying === 1 ? '' : 's'} unallocated
              </span>
            )}
          </div>
          {artists.length === 0 ? (
            <p className="p-6 text-center text-slate-400 font-medium text-sm">
              No tying orders allocated in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[560px]">
              <thead className="bg-slate-50/70 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2">Artist</th>
                  <th className="px-4 py-2 text-right">Orders</th>
                  <th className="px-4 py-2 text-right">Safas tied</th>
                  <th className="px-4 py-2 text-right">Earned</th>
                  <th className="px-4 py-2 text-right">Paid</th>
                  <th className="px-4 py-2 text-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {artists.map(a => (
                  <React.Fragment key={a.id}>
                  <tr
                    className="border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer"
                    onClick={() => setOpenArtist(openArtist === a.id ? null : a.id)}
                  >
                    <td className="px-4 py-2.5 font-bold text-slate-800">
                      {a.name}
                      <span className="ml-2 text-[10px] font-bold text-slate-400">
                        {openArtist === a.id ? 'hide orders' : 'view orders'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-600">{a.orderCount}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-600">{a.safasTied}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-800">{money(a.feeTotal)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-600">{money(a.feePaid)}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-black ${
                        a.feeDue > 0 ? 'text-rose-600' : 'text-slate-400'
                      }`}
                    >
                      {money(a.feeDue)}
                    </td>
                  </tr>

                  {openArtist === a.id &&
                    (a.orders ?? []).map((o: any) => (
                      <tr key={o.id} className="bg-slate-50/60 border-t border-slate-100 text-[11px]">
                        <td className="px-4 py-1.5 pl-8">
                          <span className="font-black text-indigo-600">{o.orderNumber}</span>
                          <span className="ml-2 font-semibold text-slate-500">{o.customerName}</span>
                        </td>
                        <td className="px-4 py-1.5 font-semibold text-slate-500">{fmtDate(o.startDate)}</td>
                        <td className="px-4 py-1.5 text-right font-bold text-slate-600">{o.safaTyingCount}</td>
                        <td className="px-4 py-1.5 text-right font-semibold text-slate-500">
                          {money(o.artistRate)}/safa
                        </td>
                        <td className="px-4 py-1.5 text-right font-black text-slate-700">{money(o.earned)}</td>
                        <td className="px-4 py-1.5 text-right">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                              o.artistPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {o.artistPaid ? 'PAID' : 'DUE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

          </>
        )}

      </main>
    </div>
  );
}
