'use client';

import React from 'react';
import { X, Edit3, Clock, IndianRupee } from 'lucide-react';
import DateInput from '@/components/DateInput';
import { useAuth } from '@/lib/AuthContext';
import { useSafaOptions, invalidateAfterSale } from '@/lib/data';

interface Props {
  sale: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Correcting a sale after the bill has been raised.
 *
 * Sales had no edit at all, so a wrong tying count or a wrong discount was
 * permanent. Staff may correct one until the goods go out; after that only an
 * admin can, because the customer already has both the goods and the bill.
 *
 * Anything that changes what was paid moves the cash book too, dated today —
 * that is when the money actually moved.
 */
export default function EditSaleDialog({ sale, onClose, onSuccess }: Props) {
  const { user, isAdmin } = useAuth();
  const { data: styleData } = useSafaOptions(user?.storeId);
  const styleList: any[] = Array.isArray(styleData) ? styleData : [];

  const [customerName, setCustomerName] = React.useState('');
  const [customerPhone, setCustomerPhone] = React.useState('');
  const [customerAddress, setCustomerAddress] = React.useState('');
  const [fatherName, setFatherName] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [discount, setDiscount] = React.useState('0');
  const [paidAmount, setPaidAmount] = React.useState('0');
  const [tieSafa, setTieSafa] = React.useState(false);
  const [tyingQty, setTyingQty] = React.useState<Record<string, string>>({});
  const [tyingName, setTyingName] = React.useState('');
  const [tyingAddress, setTyingAddress] = React.useState('');
  const [tyingTime, setTyingTime] = React.useState('');
  const [tyingDate, setTyingDate] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!sale) return;
    setCustomerName(sale.customerName || '');
    setCustomerPhone(sale.customerPhone || '');
    setCustomerAddress(sale.customerAddress || '');
    setFatherName(sale.fatherName || '');
    setNotes(sale.notes || '');
    setDiscount(String(sale.discount ?? 0));
    setPaidAmount(String(sale.paidAmount ?? 0));
    setTieSafa(!!sale.tieSafa);
    setTyingName(sale.safaTyingName || '');
    setTyingAddress(sale.safaTyingAddress || '');
    setTyingTime(sale.safaTyingTime || '');
    setTyingDate(sale.safaTyingDate || '');
    const q: Record<string, string> = {};
    try {
      const parsed = sale.safaTyingStyles ? JSON.parse(sale.safaTyingStyles) : null;
      if (Array.isArray(parsed)) for (const st of parsed) if (st?.id) q[st.id] = String(st.quantity ?? 0);
    } catch {
      // Older sale with only safaShape — boxes start empty.
    }
    setTyingQty(q);
    setError('');
  }, [sale]);

  if (!sale) return null;

  const itemsTotal = (sale.items ?? []).reduce(
    (s: number, i: any) => s + (i.price || 0) * (i.quantity || 0),
    0
  );
  const chosenStyles = styleList
    .map(st => ({ ...st, quantity: Math.max(0, parseInt(tyingQty[st.id] || '0') || 0) }))
    .filter(st => st.quantity > 0);
  const tyingCount = chosenStyles.reduce((s, st) => s + st.quantity, 0);
  const tyingCharge = chosenStyles.length
    ? chosenStyles.reduce((s, st) => s + (st.price || 0) * st.quantity, 0)
    : sale.tieSafaCharge || 0;

  const discountAmount = Math.max(0, parseFloat(discount) || 0);
  const total = Math.max(0, itemsTotal + (tieSafa ? tyingCharge : 0) - discountAmount);
  const paid = Math.max(0, parseFloat(paidAmount) || 0);
  const remaining = Math.max(0, total - paid);
  const lockedOut = !!sale.pickupDate && !isAdmin;

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/sales/${sale.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerAddress,
          fatherName,
          notes,
          discount: discountAmount,
          paidAmount: paid,
          tieSafa,
          ...(tieSafa && chosenStyles.length
            ? {
                safaTyingCount: tyingCount,
                safaTyingStyles: JSON.stringify(
                  chosenStyles.map(st => ({
                    id: st.id,
                    name: st.name,
                    price: st.price,
                    quantity: st.quantity,
                  }))
                ),
                safaShape: chosenStyles.map(st => st.name).join(', '),
                tieSafaCharge: tyingCharge,
              }
            : {}),
          safaTyingName: tyingName,
          safaTyingAddress: tyingAddress,
          safaTyingTime: tyingTime,
          safaTyingDate: tyingDate,
          role: user?.role,
          editedBy: user?.username || user?.name || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not update the sale');
        return;
      }
      await invalidateAfterSale();
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Could not update the sale');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm';

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50 shrink-0">
          <h3 className="font-bold text-indigo-900 flex items-center gap-2">
            <Edit3 size={19} className="text-indigo-600" />
            {sale.pickupDate ? 'Correct sale' : 'Edit sale'} · {sale.orderNumber}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-3 overflow-y-auto">
          {lockedOut && (
            <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2">
              These goods have already gone out. Only an admin can correct this sale now.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Customer *</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Phone</label>
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Father</label>
              <input value={fatherName} onChange={e => setFatherName(e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Address</label>
              <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className={field} />
            </div>
          </div>

          {/* Tying, which had no way of being corrected at all before. */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <button
              type="button"
              onClick={() => setTieSafa(v => !v)}
              className="flex items-center gap-2 text-xs font-black text-amber-900 uppercase tracking-wider"
            >
              <Clock size={14} /> Safa tying
              <span className={`ml-1 px-2 py-0.5 rounded text-[10px] ${tieSafa ? 'bg-amber-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
                {tieSafa ? 'ON' : 'OFF'}
              </span>
            </button>

            {tieSafa && (
              <>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {styleList.map(st => (
                    <div key={st.id}>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        {st.name} <span className="text-slate-400">₹{st.price}</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={tyingQty[st.id] ?? ''}
                        onChange={e => setTyingQty(q => ({ ...q, [st.id]: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right outline-none focus:border-amber-500"
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] font-bold text-amber-900">
                  {chosenStyles.length ? `${tyingCount} safas · ₹${tyingCharge.toFixed(2)}` : `keeping ${sale.safaTyingCount || 0} as sold`}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Tying date</label>
                    <DateInput value={tyingDate} onChange={setTyingDate} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Time</label>
                    <input type="time" value={tyingTime} onChange={e => setTyingTime(e.target.value)} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Contact</label>
                    <input value={tyingName} onChange={e => setTyingName(e.target.value)} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Venue</label>
                    <input value={tyingAddress} onChange={e => setTyingAddress(e.target.value)} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-amber-500" />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Discount (₹)</label>
              <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Paid (₹)</label>
              <input type="number" min="0" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className={field} />
            </div>
          </div>

          {/* What the corrected bill comes to, before it is saved. */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs font-bold text-slate-700 space-y-1">
            <p className="flex justify-between"><span>Items</span><span>₹{itemsTotal.toFixed(2)}</span></p>
            {tieSafa && <p className="flex justify-between"><span>Tying</span><span>₹{tyingCharge.toFixed(2)}</span></p>}
            {discountAmount > 0 && <p className="flex justify-between text-amber-700"><span>Discount</span><span>− ₹{discountAmount.toFixed(2)}</span></p>}
            <p className="flex justify-between border-t border-slate-200 pt-1 text-sm font-black"><span>Total</span><span>₹{total.toFixed(2)}</span></p>
            <p className="flex justify-between"><span>Paid</span><span className="text-emerald-600">₹{paid.toFixed(2)}</span></p>
            <p className="flex justify-between"><span>Balance</span><span className={remaining > 0 ? 'text-rose-600' : 'text-slate-400'}>₹{remaining.toFixed(2)}</span></p>
            {paid > (sale.paidAmount || 0) && (
              <p className="flex items-center gap-1 text-[11px] text-emerald-700 pt-1 border-t border-slate-200">
                <IndianRupee size={11} /> ₹{(paid - (sale.paidAmount || 0)).toFixed(2)} will be added to today&apos;s cash book
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={field} />
          </div>

          {error && (
            <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 p-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={saving || lockedOut || !customerName.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-bold text-sm"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" onClick={onClose} className="w-full text-slate-500 font-medium py-1 hover:text-slate-700 text-xs">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
