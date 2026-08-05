'use client';

import React from 'react';
import { X, Phone, MapPin, Calendar, User, Package, IndianRupee, Clock, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { unitLabel, rateSuffix } from '@/lib/product-types';

interface Props {
  rental: any | null;
  onClose: () => void;
}

const fmtDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value) : format(d, 'dd-MM-yy');
};

const money = (n?: number | null) => `₹${(Number(n) || 0).toFixed(2)}`;

/** One label/value line; renders nothing when there is no value to show. */
function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">{label}</span>
      <span className="text-xs font-bold text-slate-800 text-right break-words">{value}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="flex items-center gap-2 text-[11px] font-black text-indigo-900 uppercase tracking-widest mb-2">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}

/**
 * Read-only view of everything recorded against an order. The download button
 * next to it produces the customer invoice; this is the internal record —
 * pickup contact, tying event details and notes that never reach the bill.
 */
export default function RentalDetailsDialog({ rental, onClose }: Props) {
  React.useEffect(() => {
    if (!rental) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [rental, onClose]);

  if (!rental) return null;

  const items: any[] = Array.isArray(rental.items) ? rental.items : [];
  const itemsTotal = items.reduce(
    (s, i) => s + (Number(i.pricePerDay) || 0) * (Number(i.quantity) || 0),
    0
  );

  let tyingStyles: any[] = [];
  try {
    const parsed = rental.safaTyingStyles ? JSON.parse(rental.safaTyingStyles) : null;
    if (Array.isArray(parsed)) tyingStyles = parsed;
  } catch {
    // Older order or malformed value — fall back to safaShape below.
  }

  const statusStyle =
    {
      RETURNED: 'bg-emerald-100 text-emerald-700',
      ACTIVE: 'bg-blue-100 text-blue-700',
      BOOKED: 'bg-amber-100 text-amber-700',
      OVERDUE: 'bg-rose-100 text-rose-700',
    }[rental.status as string] || 'bg-slate-100 text-slate-700';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-2xl bg-slate-50 rounded-t-3xl sm:rounded-3xl shadow-2xl
                   max-h-[92vh] sm:max-h-[88vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="shrink-0 bg-white px-5 py-4 rounded-t-3xl border-b border-slate-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-indigo-700">{rental.orderNumber}</h2>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${statusStyle}`}>
                {rental.status}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              {fmtDate(rental.startDate)} → {fmtDate(rental.endDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <Section title="Customer" icon={<User size={13} />}>
            <Row label="Name" value={rental.customerName} />
            <Row label="Father" value={rental.fatherName} />
            <Row label="Phone" value={rental.customerPhone} />
            <Row label="Alt Phone" value={rental.customerAltPhone} />
            <Row label="Address" value={rental.customerAddress} />
            <Row label="Wedding" value={rental.weddingDate} />
            <Row label="Safa Size" value={rental.safaSize} />
          </Section>

          <Section title={`Items (${items.length})`} icon={<Package size={13} />}>
            {items.length === 0 ? (
              <p className="text-xs font-semibold text-slate-400">No items on this order.</p>
            ) : (
              <div className="space-y-1.5">
                {items.map((item: any, idx: number) => (
                  <div key={item.id ?? idx} className="flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">
                        {item.product?.name || item.name || 'Product'}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-400">
                        {item.product?.sku}
                        {item.returnedQuantity > 0 && ` · ${item.returnedQuantity}${unitLabel(item.product) === 'm' ? ' m' : ''} returned`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-slate-800">
                        {item.quantity}{unitLabel(item.product) === 'm' ? ' m' : ''} × {money(item.pricePerDay)}{rateSuffix(item.product)}
                      </p>
                      <p className="text-[11px] font-bold text-indigo-600">
                        {money((Number(item.pricePerDay) || 0) * (Number(item.quantity) || 0))}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 mt-1 border-t border-slate-100 text-xs">
                  <span className="font-bold text-slate-500">Items total</span>
                  <span className="font-black text-slate-800">{money(itemsTotal)}</span>
                </div>
              </div>
            )}
          </Section>

          {rental.tieSafa && (
            <Section title="Safa Tying" icon={<Clock size={13} />}>
              <Row
                label="Styles"
                value={
                  tyingStyles.length > 0
                    ? tyingStyles.map((s: any) => `${s.name} ×${s.quantity}`).join(', ')
                    : rental.safaShape
                }
              />
              <Row label="Total Tied" value={rental.safaTyingCount} />
              <Row label="Charge" value={money(rental.tieSafaCharge)} />
              <Row label="Contact" value={rental.safaTyingName} />
              <Row label="Time" value={rental.safaTyingTime} />
              <Row label="Date" value={rental.safaTyingDate} />
              <Row label="Venue" value={rental.safaTyingAddress} />
              <Row label="Artist" value={rental.artist?.name} />
              {rental.artist && (
                <Row
                  label="Artist Fee"
                  value={`${money(rental.artistRate)}/safa × ${rental.safaTyingCount || 0} = ${money(
                    (rental.artistRate || 0) * (rental.safaTyingCount || 0)
                  )} ${rental.artistPaid ? '(paid)' : '(unpaid)'}`}
                />
              )}
            </Section>
          )}

          {(rental.pickupName || rental.pickupPhone || rental.pickupDate) && (
            <Section title="Pickup" icon={<MapPin size={13} />}>
              <Row label="Name" value={rental.pickupName} />
              <Row label="Phone" value={rental.pickupPhone} />
              <Row label="Date" value={rental.pickupDate} />
            </Section>
          )}

          {rental.notes && (
            <Section title="Notes" icon={<StickyNote size={13} />}>
              <p className="text-xs font-semibold text-slate-700 whitespace-pre-wrap">{rental.notes}</p>
            </Section>
          )}

          <Section title="Payment" icon={<IndianRupee size={13} />}>
            <Row label="Items" value={money(itemsTotal)} />
            {rental.tieSafa && <Row label="Tying" value={money(rental.tieSafaCharge)} />}
            {Number(rental.discount) > 0 && <Row label="Discount" value={`− ${money(rental.discount)}`} />}
            {Number(rental.damageCharge) > 0 && <Row label="Damage" value={money(rental.damageCharge)} />}
            <Row label="Total" value={<span className="text-sm text-slate-900">{money(rental.totalAmount)}</span>} />
            <Row label="Paid" value={<span className="text-emerald-600">{money(rental.paidAmount)}</span>} />
            <Row
              label="Remaining"
              value={
                <span className={Number(rental.remainingAmount) > 0 ? 'text-rose-600' : 'text-slate-500'}>
                  {money(rental.remainingAmount)}
                </span>
              }
            />
            <Row label="Method" value={rental.invoice?.paymentMethod || rental.paymentMethod} />
            <Row label="Invoice" value={rental.invoice?.invoiceNumber} />
            <Row label="Invoice Status" value={rental.invoice?.status} />
          </Section>

          <Section title="Order" icon={<Calendar size={13} />}>
            <Row label="Rental From" value={fmtDate(rental.startDate)} />
            <Row label="Rental To" value={fmtDate(rental.endDate)} />
            <Row label="Created" value={fmtDate(rental.createdAt)} />
            <Row
              label="Ready"
              value={
                rental.readyAt
                  ? `Yes — ${fmtDate(rental.readyAt)}${rental.readyBy ? ` by ${rental.readyBy}` : ''}`
                  : 'Not yet'
              }
            />
            <Row label="Store" value={rental.store?.name} />
          </Section>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
