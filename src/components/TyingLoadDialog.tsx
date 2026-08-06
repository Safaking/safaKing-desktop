'use client';

import React from 'react';
import useSWR from 'swr';
import { X, Sunrise, Sunset, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { fetcher } from '@/lib/data';
import { slotOf, type Slot } from '@/lib/barati';

interface Props {
  open: boolean;
  /** Tying date of the order about to be placed, yyyy-mm-dd. */
  date: string;
  /** Its tying time, "HH:mm" — decides which slot it lands in. */
  time: string;
  /** How many barati safas this new order adds. */
  safas: number;
  saving?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const fmtTime = (t?: string | null) => (t && t.trim() ? t : '—');

/** One half of the day. The slot the new order falls into is the highlighted one. */
function SlotCard({
  slot,
  data,
  incoming,
}: {
  slot: Slot;
  data: any;
  incoming: number;
}) {
  const isTarget = incoming > 0;
  const orders: any[] = data?.orders ?? [];
  const free = data?.artistsFree ?? 0;
  // Only the slot being booked into can be over capacity — the other half of
  // the day is shown for context, not judged.
  const short = isTarget && free === 0;

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isTarget ? 'border-indigo-300 bg-indigo-50/50 ring-2 ring-indigo-500/15' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`${slot === 'AM' ? 'text-amber-500' : 'text-violet-500'}`}>
          {slot === 'AM' ? <Sunrise size={16} /> : <Sunset size={16} />}
        </span>
        <p className="text-xs font-black text-slate-800 uppercase tracking-wider">
          {slot === 'AM' ? 'Morning' : 'Evening'}
        </p>
        <span className="text-[10px] font-bold text-slate-400">
          {slot === 'AM' ? 'before 12' : '12 onwards'}
        </span>
        {isTarget && (
          <span className="ml-auto px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-black uppercase tracking-wider">
            This order
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl bg-white border border-slate-200 px-2 py-2 text-center">
          <p className="text-lg font-black text-slate-800 leading-none">{data?.orderCount ?? 0}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Booked</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 px-2 py-2 text-center">
          <p className="text-lg font-black text-slate-800 leading-none">{data?.safas ?? 0}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Safas</p>
        </div>
        <div
          className={`rounded-xl border px-2 py-2 text-center ${
            short ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'
          }`}
        >
          <p className={`text-lg font-black leading-none ${short ? 'text-rose-600' : 'text-emerald-600'}`}>
            {free}
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Artists free</p>
        </div>
      </div>

      {incoming > 0 && (
        <p className="text-[11px] font-bold text-indigo-700 mb-2">
          + this order: {incoming} safa{incoming === 1 ? '' : 's'}
        </p>
      )}

      {orders.length === 0 ? (
        <p className="text-[11px] font-semibold text-slate-400">Nothing booked in this slot yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {orders.map(o => (
            <div
              key={`${o.kind}-${o.id}`}
              className="flex items-center gap-2 rounded-lg bg-white border border-slate-100 px-2.5 py-1.5"
            >
              <span className="font-mono text-[10px] font-bold text-slate-400 w-11 shrink-0">
                {fmtTime(o.time)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold text-slate-700 truncate">
                  {o.customerName}
                </span>
                <span className="block text-[10px] font-semibold text-slate-400 truncate">
                  {o.orderNumber} · {o.safas} safa{o.safas === 1 ? '' : 's'}
                </span>
              </span>
              <span
                className={`text-[10px] font-black shrink-0 ${
                  o.artistName ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {o.artistName ? o.artistName.split(' ')[0] : 'No artist'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Shown before a barati booking is confirmed.
 *
 * The shop has a fixed number of artists and a baraat happens at a set hour,
 * so the question that decides whether an order can be taken is "who is
 * already out at that hour on that date" — not the day's total. Answering it
 * after the booking is written means finding out on the morning itself.
 *
 * It never blocks: a shortage is shown, and taking the order anyway is the
 * shop's call to make.
 */
export default function TyingLoadDialog({
  open,
  date,
  time,
  safas,
  saving,
  onCancel,
  onConfirm,
}: Props) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onCancel();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onCancel, saving]);

  // Only ask the server once the sheet is actually open and the date is usable.
  const key = open && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `/api/tying-load?date=${date}` : null;
  const { data, isLoading, error } = useSWR(key, fetcher, { revalidateOnFocus: false });

  if (!open) return null;

  const slot = slotOf(time);
  const target = data?.[slot];
  const free = target?.artistsFree ?? 0;
  const short = !!data && free === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={saving ? undefined : onCancel} />

      <div
        className="relative w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl
                   max-h-[92vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Barati tying already booked on this date"
      >
        <div className="px-5 pt-5 pb-3 flex items-start justify-between shrink-0 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-base font-black text-slate-900">Barati tying on {fmtDate(date)}</h2>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              What is already booked at this hour, before the order is placed
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isLoading && !data ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs font-bold">Checking that date…</span>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-bold text-amber-800">
                Could not read the schedule for that date. You can still place the order.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-2.5">
                <Users size={15} className="text-slate-500 shrink-0" />
                <p className="text-xs font-bold text-slate-700">
                  {data?.artistTotal ?? 0} artist{data?.artistTotal === 1 ? '' : 's'} on the register
                </p>
              </div>

              {short && (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-rose-800">
                    Every artist is already committed in this slot. Taking this order means
                    reassigning someone or bringing in extra help.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SlotCard slot="AM" data={data?.AM} incoming={slot === 'AM' ? safas : 0} />
                <SlotCard slot="PM" data={data?.PM} incoming={slot === 'PM' ? safas : 0} />
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-4 flex gap-3 bg-white rounded-b-3xl">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-700 text-sm font-black hover:bg-slate-200 transition-colors disabled:opacity-40"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 active:scale-[0.99] transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-60"
          >
            {saving ? 'Placing…' : 'Confirm booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
