'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowLeft,
  Wallet,
  Landmark,
  Building2,
  Lock,
  CheckCircle2,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import DateInput from '@/components/DateInput';
import { fetcher, useStores } from '@/lib/data';
import { useAuth } from '@/lib/AuthContext';

const money = (n?: number | null) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** mm/dd/yyyy for display — matches every other date field in the app. */
const displayDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
};

const todayISO = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const TYPES = [
  { key: 'BANK', label: 'Bank Remittance', icon: Landmark },
  { key: 'OFFICE', label: 'Cash to Office', icon: Building2 },
  { key: 'ADJUSTMENT', label: 'Adjustment', icon: AlertCircle },
] as const;

export default function CashBookPage() {
  const { user, isAdmin, isSuperOrAdmin, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { data: storeData } = useStores();
  const stores: any[] = Array.isArray(storeData) ? storeData : [];

  const [date, setDate] = useState(todayISO());
  const [storeId, setStoreId] = useState('');
  const [type, setType] = useState<'BANK' | 'OFFICE' | 'ADJUSTMENT'>('BANK');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  // A user tied to a store starts on it; an admin picks from the list.
  React.useEffect(() => {
    if (storeId) return;
    if (user?.storeId) setStoreId(user.storeId);
    else if (stores.length > 0) setStoreId(stores[0].id);
  }, [user, stores, storeId]);

  const key = storeId ? `/api/cashbook?storeId=${storeId}&date=${date}` : null;
  const { data, isLoading, mutate, error } = useSWR(key, fetcher, { keepPreviousData: true });

  const isToday = date === todayISO();
  // A super records the day they are working. Yesterday is history: only an
  // admin can touch it, and only after reopening if it was submitted.
  const dayEditable = isToday || isAdmin;

  const post = async (payload: any) => {
    setBusy(true);
    try {
      const res = await fetch('/api/cashbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, date, role: user?.role, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) alert(json.error || 'Failed');
      else await mutate();
      return res.ok;
    } catch (e: any) {
      alert(e.message || 'Network error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await post({
      action: 'entry',
      type,
      amount: parseFloat(amount || '0'),
      reference,
      createdBy: user?.username || user?.name || '',
    });
    if (ok) {
      setAmount('');
      setReference('');
    }
  };

  const submitDay = async () => {
    if (
      !window.confirm(
        `Submit ${displayDate(date)}?\n\n` +
          `Closing ${money(data?.closing)} carries to the next day, this day locks, ` +
          `and you will be signed out for the day.`
      )
    )
      return;

    const ok = await post({ action: 'submit', submittedBy: user?.username || user?.name || '' });
    // Closing the account ends the shift, so signing off is part of the same
    // action rather than something staff have to remember separately.
    if (ok) {
      alert(`Account submitted for ${displayDate(date)}. Closing ${money(data?.closing)} carries to tomorrow.`);
      logout('CASHBOOK');
      router.replace('/login');
    }
  };

  const reopenDay = async () => {
    if (!window.confirm('Reopen this day for editing?')) return;
    await post({ action: 'reopen', role: user?.role });
  };

  const removeEntry = async (entryId: string) => {
    if (!window.confirm('Remove this entry?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cashbook?entryId=${entryId}&role=${user?.role ?? ''}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) alert(json.error || 'Failed to remove');
      else await mutate();
    } finally {
      setBusy(false);
    }
  };

  if (!authLoading && !isSuperOrAdmin) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-sm">
          <Lock size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-700">Cash book is for super and admin only</p>
          <Link href="/" className="text-xs font-bold text-indigo-600 mt-2 inline-block">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const locked = !!data?.submitted;

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Wallet size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Cash Book</h1>
              <p className="text-xs text-slate-500 font-medium">Opening, collections, remittance and day close</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Day + store */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
            <DateInput
              value={date}
              onChange={setDate}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm font-bold w-40"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Store</label>
            <select
              value={storeId}
              onChange={e => setStoreId(e.target.value)}
              disabled={!isAdmin && !!user?.storeId}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm font-bold disabled:opacity-60"
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setDate(todayISO())}
            className="px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            Today
          </button>

          {locked && (
            <span className="ml-auto inline-flex items-center gap-2 text-xs font-black text-emerald-700 bg-emerald-100 px-3 py-2 rounded-xl">
              <CheckCircle2 size={14} /> SUBMITTED
              {data?.submittedBy ? ` by ${data.submittedBy}` : ''}
            </span>
          )}
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm font-bold">
            Could not load the cash book.
          </div>
        )}

        {/* The day's arithmetic */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 space-y-2.5">
            <Line label="Opening balance" hint="carried from the previous day" value={money(data?.openingBalance)} />
            <Line
              label="Collections"
              hint={`${data?.rentalCount ?? 0} rental${data?.rentalCount === 1 ? '' : 's'} · ${data?.saleCount ?? 0} sale${data?.saleCount === 1 ? '' : 's'}`}
              value={`+ ${money(data?.collected)}`}
              tone="emerald"
            />
            {(data?.entries ?? []).length > 0 && (
              <Line label="Paid out" hint="bank, office and adjustments" value={`− ${money(data?.paidOut)}`} tone="rose" />
            )}
          </div>
          <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Closing balance</p>
              <p className="text-[11px] font-semibold text-slate-400">becomes tomorrow&apos;s opening</p>
            </div>
            <p className="text-3xl font-black text-emerald-400">{money(data?.closing)}</p>
          </div>
        </div>

        {/* Money out */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-800 text-sm">Send cash out</h2>
          </div>

          {locked ? (
            <p className="px-5 py-4 text-xs font-semibold text-slate-400">
              This day is submitted and locked.
            </p>
          ) : !dayEditable ? (
            <p className="px-5 py-4 text-xs font-semibold text-amber-600">
              Only today&apos;s cash book can be edited. Ask an admin to change a past day.
            </p>
          ) : (
            <form onSubmit={addEntry} className="px-5 py-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {TYPES.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setType(t.key)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        type === t.key
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Icon size={14} /> {t.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3">
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Amount"
                  className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm font-bold w-36"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Reference (slip no, person)"
                  className="flex-1 min-w-[180px] px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm font-medium"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={busy || !amount}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-bold"
                >
                  Add
                </button>
              </div>
            </form>
          )}

          {(data?.entries ?? []).length > 0 && (
            <div className="border-t border-slate-100">
              {data.entries.map((e: any) => (
                <div key={e.id} className="px-5 py-2.5 flex items-center justify-between border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {TYPES.find(t => t.key === e.type)?.label || e.type}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      {[e.reference, e.createdBy].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-rose-600">− {money(e.amount)}</span>
                    {!locked && dayEditable && (
                      <button
                        onClick={() => removeEntry(e.id)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Day close */}
        <div className="flex gap-3">
          {locked ? (
            isAdmin ? (
              <button
                onClick={reopenDay}
                disabled={busy}
                className="flex-1 py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:border-slate-300"
              >
                Reopen this day
              </button>
            ) : (
              <p className="flex-1 text-center text-xs font-semibold text-slate-400 py-3.5">
                Submitted — ask an admin to reopen if something is wrong.
              </p>
            )
          ) : dayEditable ? (
            <button
              onClick={submitDay}
              disabled={busy || isLoading}
              className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-sm shadow-lg shadow-emerald-600/20"
            >
              Submit account for {displayDate(date)} &amp; sign out
            </button>
          ) : (
            <p className="flex-1 text-center text-xs font-semibold text-amber-600 py-3.5">
              Not submitted, but only an admin can close a past day now.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function Line({
  label,
  hint,
  value,
  tone = 'slate',
}: {
  label: string;
  hint?: string;
  value: string;
  tone?: 'slate' | 'emerald' | 'rose';
}) {
  const toneClass = { slate: 'text-slate-800', emerald: 'text-emerald-600', rose: 'text-rose-600' }[tone];
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-bold text-slate-700">{label}</p>
        {hint && <p className="text-[11px] font-semibold text-slate-400">{hint}</p>}
      </div>
      <p className={`text-lg font-black ${toneClass}`}>{value}</p>
    </div>
  );
}
