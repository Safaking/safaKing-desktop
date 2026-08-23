'use client';

import React from 'react';
import { X, Truck, IndianRupee } from 'lucide-react';
import DateInput from '@/components/DateInput';
import { useAuth } from '@/lib/AuthContext';
import { invalidateAfterSale } from '@/lib/data';

interface Props {
  sale: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Handing over a sale the customer left behind.
 *
 * The counter takes an advance and the buyer collects later — often somebody
 * else turns up for them. This records who came, when, and the balance they
 * paid, which lands in today's cash book rather than the day of the sale.
 */
export default function CollectSaleDialog({ sale, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [date, setDate] = React.useState('');
  const [paidNow, setPaidNow] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!sale) return;
    setName(sale.pickupName || '');
    setPhone(sale.pickupPhone || sale.customerPhone || '');
    setDate('');
    setPaidNow('');
    setError('');
  }, [sale]);

  if (!sale) return null;

  const remaining = Math.max(0, sale.remainingAmount ?? 0);
  const paying = Math.max(0, parseFloat(paidNow) || 0);
  const stillOwed = Math.max(0, remaining - paying);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('Who collected the goods, and their phone number, are both required.');
      return;
    }
    if (stillOwed > 0) {
      setError(`₹${stillOwed.toFixed(2)} is still due. Collect the full balance before handing over.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/sales/${sale.id}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupName: name,
          pickupPhone: phone,
          pickupDate: date || undefined,
          paidNow: paying,
          collectedBy: user?.username || user?.name || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not record the handover');
        return;
      }
      await invalidateAfterSale();
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Could not record the handover');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50 shrink-0">
          <h3 className="font-bold text-emerald-900 flex items-center gap-2">
            <Truck size={20} className="text-emerald-600" /> Hand over the goods
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-sm font-bold text-slate-800">
              {sale.orderNumber} • {sale.customerName}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Bill ₹{(sale.totalAmount || 0).toFixed(2)} · paid ₹{(sale.paidAmount || 0).toFixed(2)}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Collected by *
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Name of the person collecting"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Their phone *
            </label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Date collected
            </label>
            <DateInput
              value={date}
              onChange={setDate}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold text-sm"
            />
            <p className="text-[11px] font-semibold text-slate-400 mt-1">Blank means today.</p>
          </div>

          {/* The balance goes into today's till, not the day of the sale. */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <p className="text-xs font-black text-emerald-900">
              Balance due ₹{remaining.toFixed(2)}
            </p>
            <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest mt-2 mb-1">
              Collecting now
            </label>
            <div className="relative">
              <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                min="0"
                step="1"
                placeholder={remaining.toFixed(0)}
                value={paidNow}
                onChange={e => setPaidNow(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold text-sm"
              />
            </div>
            {stillOwed > 0 ? (
              <p className="text-[11px] font-black text-rose-600 mt-1.5">
                ₹{stillOwed.toFixed(2)} still owing — the goods cannot go out until this is paid
              </p>
            ) : (
              <p className="text-[11px] font-bold text-emerald-700 mt-1.5">✓ Settled in full</p>
            )}
          </div>

          {error && (
            <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
              {error}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 p-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={saving || stillOwed > 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-bold text-sm"
          >
            {saving ? 'Saving…' : stillOwed > 0 ? `₹${stillOwed.toFixed(2)} still due` : 'Record handover'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full text-slate-500 font-medium py-1 hover:text-slate-700 text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
