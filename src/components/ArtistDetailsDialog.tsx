'use client';

import React from 'react';
import { format } from 'date-fns';
import { X, Palette, Printer, Phone, MapPin } from 'lucide-react';

interface Props {
  artist: any | null;
  onClose: () => void;
}

const money = (n?: number | null) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const day = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : format(d, 'MM/dd/yyyy');
};

/**
 * An artist's account: every tying order allocated to them, what each earned,
 * and what is still owed — with a print view for settling up in person.
 */
export default function ArtistDetailsDialog({ artist, onClose }: Props) {
  React.useEffect(() => {
    if (!artist) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [artist, onClose]);

  if (!artist) return null;

  const orders: any[] = Array.isArray(artist.rentals) ? artist.rentals : [];
  const unpaid = orders.filter(o => !o.artistPaid);

  const print = () => {
    const rows = orders
      .map(
        o => `<tr>
          <td>${o.orderNumber}</td>
          <td>${o.customerName ?? ''}</td>
          <td>${day(o.startDate)}</td>
          <td style="text-align:right">${o.safaTyingCount ?? 0}</td>
          <td style="text-align:right">${money(o.artistRate)}</td>
          <td style="text-align:right">${money(o.earned)}</td>
          <td>${o.artistPaid ? 'Paid' : 'Due'}</td>
        </tr>`
      )
      .join('');

    // A separate window keeps the app's own layout out of the printout.
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) {
      alert('Allow pop-ups to print this statement.');
      return;
    }
    w.document.write(`<!doctype html><html><head><title>${artist.name} — tying statement</title>
      <style>
        body{font-family:system-ui,-apple-system,sans-serif;padding:28px;color:#1e293b}
        h1{font-size:20px;margin:0}
        .sub{color:#64748b;font-size:12px;margin:2px 0 18px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{text-align:left;background:#f1f5f9;padding:7px;border-bottom:1px solid #cbd5e1}
        td{padding:7px;border-bottom:1px solid #e2e8f0}
        .totals{margin-top:18px;font-size:13px}
        .totals div{display:flex;justify-content:space-between;padding:4px 0;max-width:280px;margin-left:auto}
        .due{font-weight:800;color:#be123c;border-top:1px solid #cbd5e1;padding-top:8px}
        @media print{ button{display:none} }
      </style></head><body>
      <h1>Joshi Safa House</h1>
      <p class="sub">Safa tying statement — <strong>${artist.name}</strong>${
        artist.phone ? ` · ${artist.phone}` : ''
      } · printed ${format(new Date(), 'MM/dd/yyyy')}</p>
      <table>
        <thead><tr>
          <th>Order</th><th>Customer</th><th>Date</th>
          <th style="text-align:right">Safas</th><th style="text-align:right">Rate</th>
          <th style="text-align:right">Earned</th><th>Status</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="7">No tying orders yet.</td></tr>'}</tbody>
      </table>
      <div class="totals">
        <div><span>Total earned</span><span>${money(artist.totalEarned)}</span></div>
        <div><span>Already paid</span><span>${money(artist.totalPaid)}</span></div>
        <div class="due"><span>Balance due</span><span>${money(artist.totalDue)}</span></div>
      </div>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-full sm:max-w-2xl bg-slate-50 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <div className="shrink-0 bg-white px-5 py-4 rounded-t-3xl border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Palette size={18} className="text-violet-600" /> {artist.name}
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5 flex flex-wrap gap-x-3">
              {artist.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone size={11} /> {artist.phone}
                </span>
              )}
              {artist.address && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={11} /> {artist.address}
                </span>
              )}
              <span>Rate {money(artist.ratePerPiece)}/safa</span>
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={print}
              className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Earned', value: money(artist.totalEarned), tone: 'text-slate-800' },
              { label: 'Paid', value: money(artist.totalPaid), tone: 'text-emerald-600' },
              { label: 'Balance due', value: money(artist.totalDue), tone: 'text-rose-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-3 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                <p className={`text-lg font-black mt-0.5 ${s.tone}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-black text-slate-800">
                Tying orders ({orders.length})
              </p>
              {unpaid.length > 0 && (
                <span className="text-[11px] font-black text-rose-600">{unpaid.length} unpaid</span>
              )}
            </div>

            {orders.length === 0 ? (
              <p className="p-6 text-center text-xs font-semibold text-slate-400">
                No tying orders allocated yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[520px]">
                  <thead className="bg-slate-50/70 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2 text-right">Safas</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Earned</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <span className="font-black text-indigo-600">{o.orderNumber}</span>
                          <span className="block text-[10px] font-semibold text-slate-400">{o.customerName}</span>
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-500">{day(o.startDate)}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-700">{o.safaTyingCount}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-500">{money(o.artistRate)}</td>
                        <td className="px-3 py-2 text-right font-black text-slate-800">{money(o.earned)}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              o.artistPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {o.artistPaid ? 'PAID' : 'DUE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 rounded-b-3xl">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
