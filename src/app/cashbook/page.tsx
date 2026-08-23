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
  Pencil,
  AlertCircle,
} from 'lucide-react';
import DateInput from '@/components/DateInput';
import { fetcher, useStores } from '@/lib/data';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';

const money = (n?: number | null) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** dd/mm/yyyy for display — matches every other date field in the app. */
const displayDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

const todayISO = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const TYPES = [
  { key: 'BANK', label: 'bank_remittance', icon: Landmark },
  { key: 'OFFICE', label: 'cash_to_office', icon: Building2 },
  { key: 'ADJUSTMENT', label: 'adjustment', icon: AlertCircle },
] as const;

export default function CashBookPage() {
  const { t } = useLanguage();
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

  /**
   * Closing the day, and handing the cash over in the same step.
   *
   * Submitting used to only lock the day; to start tomorrow at zero, staff had
   * to remember a separate entry first and choose between "bank remittance"
   * and "cash to office" with nothing telling them which. So it mostly was not
   * done, and the balance rolled on for weeks.
   */
  const [closeOpen, setCloseOpen] = useState(false);
  const [handOver, setHandOver] = useState('');
  const [handOverTo, setHandOverTo] = useState('');
  const [handOverType, setHandOverType] = useState<'OFFICE' | 'BANK'>('OFFICE');
  const [handOverRef, setHandOverRef] = useState('');

  const openClose = () => {
    // Everything in the drawer, by default: that is what closing a day means.
    setHandOver(String(Math.max(0, Math.round((data?.closing ?? 0) * 100) / 100)));
    setHandOverTo('');
    setHandOverType('OFFICE');
    setHandOverRef('');
    setCloseOpen(true);
  };

  const handingOver = Math.max(0, parseFloat(handOver) || 0);
  const keptBack = Math.max(0, (data?.closing ?? 0) - handingOver);

  const submitDay = async () => {
    if (handingOver > (data?.closing ?? 0) + 0.001) {
      alert(`Only ${money(data?.closing)} is in the drawer.`);
      return;
    }
    if (handingOver > 0 && !handOverTo.trim()) {
      alert('Name the person you handed the cash to.');
      return;
    }

    const ok = await post({
      action: 'submit',
      submittedBy: user?.username || user?.name || '',
      handOver: handingOver,
      handOverTo: handOverTo.trim(),
      handOverType,
      handOverReference: handOverRef.trim(),
    });
    // Closing the account ends the shift, so signing off is part of the same
    // action rather than something staff have to remember separately.
    if (ok) {
      setCloseOpen(false);
      alert(
        keptBack > 0
          ? `Account submitted for ${displayDate(date)}. ${money(keptBack)} stays in the drawer and opens tomorrow.`
          : `Account submitted for ${displayDate(date)}. Tomorrow opens at ${money(0)}.`
      );
      logout('CASHBOOK');
      router.replace('/login');
    }
  };

  /** The admin end of the same handover: confirming the cash arrived. */
  const approveDay = async () => {
    const counted = window.prompt(
      `Confirm the cash for ${displayDate(date)}.\n\nThe branch says it handed over ${money(
        data?.handedOver
      )}. How much did you actually count?`,
      String(data?.handedOver ?? 0)
    );
    if (counted === null) return;
    const ok = await post({
      action: 'approve',
      role: user?.role,
      approvedBy: user?.username || user?.name || '',
      approvedAmount: counted,
    });
    if (ok) alert('Recorded as received.');
  };

  const reopenDay = async () => {
    if (!window.confirm('Reopen this day for editing?')) return;
    await post({ action: 'reopen', role: user?.role });
  };

  const editEntry = async (entry: any) => {
    const amount = window.prompt(`New amount for ${entry.reference || entry.type}`, String(entry.amount));
    if (amount === null) return;
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      alert('Enter an amount greater than zero.');
      return;
    }
    const reference = window.prompt('Reference (optional)', entry.reference || '');
    await post({ action: 'editEntry', entryId: entry.id, amount: parsed, reference: reference ?? entry.reference });
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
          <p className="font-bold text-slate-700">{t('cashbook_only_super')}</p>
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
              <h1 className="text-xl font-bold text-slate-800">{t('cashbook_title')}</h1>
              <p className="text-xs text-slate-500 font-medium">{t('cashbook_sub')}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Day + store */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('date')}</label>
            <DateInput
              value={date}
              onChange={setDate}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm font-bold w-40"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('store')}</label>
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
            <Line label={t('opening_balance')} hint={t('opening_hint')} value={money(data?.openingBalance)} />
            <Line
              label={t('collections')}
              hint={`${data?.rentalCount ?? 0} rental${data?.rentalCount === 1 ? '' : 's'} · ${data?.saleCount ?? 0} sale${data?.saleCount === 1 ? '' : 's'}`}
              value={`+ ${money(data?.collected)}`}
              tone="emerald"
            />
            {(data?.entries ?? []).length > 0 && (
              <Line label={t('paid_out')} hint={t('paid_out_hint')} value={`− ${money(data?.paidOut)}`} tone="rose" />
            )}
          </div>
          <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{t('closing_balance')}</p>
              <p className="text-[11px] font-semibold text-slate-400">{t('closing_hint')}</p>
            </div>
            <p className="text-3xl font-black text-emerald-400">{money(data?.closing)}</p>
          </div>
        </div>

        {/* Money out */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-800 text-sm">{t('send_cash_out')}</h2>
          </div>

          {locked ? (
            <p className="px-5 py-4 text-xs font-semibold text-slate-400">{t('day_locked')}</p>
          ) : !dayEditable ? (
            <p className="px-5 py-4 text-xs font-semibold text-amber-600">
              {t('only_today')}
            </p>
          ) : (
            <form onSubmit={addEntry} className="px-5 py-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {TYPES.map(entry => {
                  const Icon = entry.icon;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => setType(entry.key)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        type === entry.key
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Icon size={14} /> {t(entry.label as any)}
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
                  placeholder={t('reference_hint')}
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
                      {(() => { const m = TYPES.find(x => x.key === e.type); return m ? t(m.label as any) : e.type; })()}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      {[e.reference, e.createdBy].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-rose-600">− {money(e.amount)}</span>
                    {!locked && isAdmin && (
                      <button
                        onClick={() => editEntry(e)}
                        title="Correct this entry"
                        className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
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

        {/* Whether the money actually reached the office. Submitting is the
            branch saying it handed the cash over; this is the other end saying
            it arrived. Until both exist, the day is money in transit. */}
        {locked && (
          <div
            className={`rounded-2xl border px-5 py-4 flex flex-wrap items-center justify-between gap-3 ${
              data?.approvedAt
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            <div className="min-w-0">
              <p
                className={`text-xs font-black uppercase tracking-widest ${
                  data?.approvedAt ? 'text-emerald-800' : 'text-amber-800'
                }`}
              >
                {data?.approvedAt ? 'Cash received' : 'Waiting for the office to confirm'}
              </p>
              <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                Branch handed over {money(data?.handedOver)}
                {data?.approvedAt && (
                  <>
                    {' · '}counted {money(data?.approvedAmount ?? data?.handedOver)}
                    {data?.approvedBy ? ` by ${data.approvedBy}` : ''}
                  </>
                )}
              </p>
              {data?.approvedAt &&
                Math.abs((data?.approvedAmount ?? data?.handedOver ?? 0) - (data?.handedOver ?? 0)) >
                  0.01 && (
                  <p className="text-[11px] font-black text-rose-600 mt-0.5">
                    Short by {money((data?.handedOver ?? 0) - (data?.approvedAmount ?? 0))}
                  </p>
                )}
            </div>

            {isAdmin && !data?.approvedAt && (
              <button
                onClick={approveDay}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-black shrink-0"
              >
                Confirm I received it
              </button>
            )}
          </div>
        )}

        {/* Day close */}
        <div className="flex gap-3">
          {locked ? (
            isAdmin ? (
              <button
                onClick={reopenDay}
                data-reopen
                disabled={busy}
                className="flex-1 py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:border-slate-300"
              >{t('reopen_day')}</button>
            ) : (
              <p className="flex-1 text-center text-xs font-semibold text-slate-400 py-3.5">
                Submitted — ask an admin to reopen if something is wrong.
              </p>
            )
          ) : dayEditable ? (
            <button
              onClick={openClose}
              disabled={busy || isLoading}
              className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-sm shadow-lg shadow-emerald-600/20"
            >
              {t('submit_account')} {displayDate(date)} {t('and_sign_out')}
            </button>
          ) : (
            <p className="flex-1 text-center text-xs font-semibold text-amber-600 py-3.5">
              Not submitted, but only an admin can close a past day now.
            </p>
          )}
        </div>
      </main>

      {closeOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 bg-emerald-50/60">
              <h3 className="font-black text-emerald-900 text-sm">
                Close {displayDate(date)}
              </h3>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                Hand the cash over now, so tomorrow starts clean.
              </p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="rounded-xl bg-slate-900 text-white px-4 py-3">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                  In the drawer
                </p>
                <p className="text-3xl font-black text-emerald-400 leading-tight">
                  {money(data?.closing)}
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Handing over
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={handOver}
                  onChange={e => setHandOver(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-black text-lg text-right"
                />
                <p
                  className={`text-[11px] font-bold mt-1 ${
                    keptBack > 0 ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {keptBack > 0
                    ? `${money(keptBack)} stays in the drawer and opens tomorrow`
                    : 'Tomorrow opens at ₹0'}
                </p>
              </div>

              {handingOver > 0 && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Handed to *
                    </label>
                    <input
                      value={handOverTo}
                      onChange={e => setHandOverTo(e.target.value)}
                      placeholder="Name of the person who took the cash"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Where it went
                    </label>
                    <div className="flex gap-2">
                      {([
                        { key: 'OFFICE', label: t('cash_to_office') },
                        { key: 'BANK', label: t('bank_remittance') },
                      ] as const).map(o => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => setHandOverType(o.key)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                            handOverType === o.key
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Slip / reference (optional)
                    </label>
                    <input
                      value={handOverRef}
                      onChange={e => setHandOverRef(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold text-xs"
                    />
                  </div>
                </>
              )}

              <p className="text-[11px] font-semibold text-slate-400">
                This locks the day and signs you out. The office confirms the cash separately.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={submitDay}
                disabled={busy}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-sm"
              >
                {busy ? 'Saving…' : `${t('submit_account')} ${t('and_sign_out')}`}
              </button>
              <button
                onClick={() => setCloseOpen(false)}
                className="w-full text-slate-500 font-medium py-1 hover:text-slate-700 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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
