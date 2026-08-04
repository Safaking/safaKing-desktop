'use client';

import React from 'react';
import { X, User, Clock, Calendar, MapPin, Plus, Minus, Check } from 'lucide-react';
import DateInput from '@/components/DateInput';

interface SafaStyle {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface SafaTyingDetails {
  name: string;
  address: string;
  time: string;
  marriageDate: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  safaOptions: any[];
  tyingQuantities: Record<string, number>;
  setStyleQty: (styleId: string, qty: number) => void;
  toggleStyle: (style: any) => void;
  selectedStyles: SafaStyle[];
  totalTyingCount: number;
  charge: number;
  bookedSafaQty: number;
  details: SafaTyingDetails;
  setDetails: (d: SafaTyingDetails) => void;
}

/**
 * Safa tying used to sit inline in the booking form, which pushed the rest of
 * the order below the fold and made the page long to scroll. It lives in a
 * sheet now: the form keeps a one-line summary and opens this to edit.
 */
export default function SafaTyingDialog({
  open,
  onClose,
  safaOptions,
  tyingQuantities,
  setStyleQty,
  toggleStyle,
  selectedStyles,
  totalTyingCount,
  charge,
  bookedSafaQty,
  details,
  setDetails,
}: Props) {
  // Let Escape close the sheet, and stop the page behind it scrolling.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] animate-in fade-in duration-150"
        onClick={onClose}
      />

      <div
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl
                   max-h-[92vh] sm:max-h-[85vh] flex flex-col
                   animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Safa tying details"
      >
        {/* Grab handle (mobile) */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        <div className="px-5 pt-3 pb-3 flex items-start justify-between shrink-0 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900">Safa Tying</h2>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Choose styles and how many safas each covers
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Only this middle section scrolls */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <label className="block text-[11px] font-bold text-indigo-900 uppercase tracking-widest mb-2">
              Tying Styles
              <span className="ml-2 normal-case tracking-normal font-semibold text-slate-500">
                (choose one or more)
              </span>
            </label>

            <div className="space-y-2">
              {safaOptions.map((style: any) => {
                const qty = tyingQuantities[style.id] ?? 0;
                const isSelected = qty > 0;
                const price = parseFloat(style.price || '0') || 0;
                return (
                  <div
                    key={style.id}
                    className={`px-3 py-2.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 shadow-md shadow-indigo-600/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleStyle(style)}
                      className="w-full flex items-center justify-between gap-2 text-left"
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-white border-white text-indigo-600'
                              : 'bg-white border-slate-300 text-transparent'
                          }`}
                        >
                          <Check size={13} strokeWidth={4} />
                        </span>
                        <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                          {style.name}
                        </span>
                      </span>
                      <span
                        className={`text-xs font-extrabold ${isSelected ? 'text-indigo-100' : 'text-indigo-600'}`}
                      >
                        ₹{price.toFixed(2)}
                      </span>
                    </button>

                    {isSelected && (
                      <div className="mt-2.5 pt-2.5 border-t border-white/25 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-indigo-100">
                          ₹{price} × {qty} = ₹{(price * qty).toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1 bg-white/15 p-0.5 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setStyleQty(style.id, qty - 1)}
                            className="w-7 h-7 rounded-md bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white active:scale-95 transition-all"
                            aria-label={`Decrease ${style.name}`}
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            type="number"
                            min="0"
                            className="w-11 text-center text-sm font-black text-white bg-transparent outline-none"
                            value={qty}
                            onChange={(e) => setStyleQty(style.id, parseInt(e.target.value) || 0)}
                          />
                          <button
                            type="button"
                            onClick={() => setStyleQty(style.id, qty + 1)}
                            className="w-7 h-7 rounded-md bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white active:scale-95 transition-all"
                            aria-label={`Increase ${style.name}`}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {bookedSafaQty > 0 && (
              <p
                className={`text-[11px] font-semibold mt-2 ${
                  totalTyingCount === bookedSafaQty ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {totalTyingCount === bookedSafaQty
                  ? `Matches the ${bookedSafaQty} safas booked in this order.`
                  : `Booking has ${bookedSafaQty} safas but ${totalTyingCount} are set to be tied.`}
              </p>
            )}
            {bookedSafaQty === 0 && totalTyingCount > 0 && (
              <p className="text-[11px] font-semibold text-slate-500 mt-2">
                Tying-only order — counted separately from any booking.
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <p className="text-[11px] font-black text-indigo-900 uppercase tracking-widest">
              Event Details
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Contact Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Name of Tying Person"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    value={details.name}
                    onChange={(e) => setDetails({ ...details, name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tying Time</label>
                <div className="relative">
                  <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="time"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    value={details.time}
                    onChange={(e) => setDetails({ ...details, time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Marriage Date</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <DateInput
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    value={details.marriageDate}
                    onChange={(v) => setDetails({ ...details, marriageDate: v })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Venue / Address</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Event venue or address"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    value={details.address}
                    onChange={(e) => setDetails({ ...details, address: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Totals stay pinned so the charge is visible while editing */}
        <div className="shrink-0 border-t border-slate-100 px-5 py-4 bg-white rounded-b-3xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-600">Total Safas Tied</span>
            <span className="text-sm font-black text-slate-900">{totalTyingCount}</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-black text-slate-900">Tying Charge</span>
            <span className="text-lg font-black text-indigo-600">₹{charge.toFixed(2)}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 active:scale-[0.99] transition-all shadow-lg shadow-indigo-600/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
