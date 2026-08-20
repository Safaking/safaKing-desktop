'use client';

import React, { useState } from 'react';
import DateInput from '@/components/DateInput';
import { X, Edit3, User, Phone, MapPin, Calendar, FileText, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useSafaOptions } from '@/lib/data';

interface EditRentalDialogProps {
  rental: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditRentalDialog({ rental, onClose, onSuccess }: EditRentalDialogProps) {
  const [customerName, setCustomerName] = useState(rental.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(rental.customerPhone || '');
  const [customerAltPhone, setCustomerAltPhone] = useState(rental.customerAltPhone || '');
  const [customerAddress, setCustomerAddress] = useState(rental.customerAddress || '');
  const [fatherName, setFatherName] = useState(rental.fatherName || '');
  const [weddingDate, setWeddingDate] = useState(rental.weddingDate || '');
  const [safaSize, setSafaSize] = useState(rental.safaSize || '');
  const [notes, setNotes] = useState(rental.notes || '');
  const [startDate, setStartDate] = useState(rental.startDate ? new Date(rental.startDate).toISOString().split('T')[0] : '');
  const [endDate, setEndDate] = useState(rental.endDate ? new Date(rental.endDate).toISOString().split('T')[0] : '');
  const [paidAmount, setPaidAmount] = useState(rental.paidAmount?.toString() || '0');
  const [discount, setDiscount] = useState(rental.discount?.toString() || '0');
  const [paymentMethod, setPaymentMethod] = useState(rental.paymentMethod || 'CASH');

  // Tying, which could not be corrected at all before: a count entered as 3
  // instead of 30 was stuck, and so was the charge sitting against it.
  const { user, isAdmin } = useAuth();
  const { data: styleData } = useSafaOptions(user?.storeId);
  const styleList: any[] = Array.isArray(styleData) ? styleData : [];

  const [tieSafa, setTieSafa] = useState(!!rental.tieSafa);
  const [tyingQty, setTyingQty] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    try {
      const parsed = rental.safaTyingStyles ? JSON.parse(rental.safaTyingStyles) : null;
      if (Array.isArray(parsed)) {
        for (const st of parsed) if (st?.id) out[st.id] = String(st.quantity ?? 0);
      }
    } catch {
      // Older order with only safaShape — the boxes start empty and whatever
      // is typed becomes the new breakdown.
    }
    return out;
  });
  const [tyingName, setTyingName] = useState(rental.safaTyingName || '');
  const [tyingAddress, setTyingAddress] = useState(rental.safaTyingAddress || '');
  const [tyingTime, setTyingTime] = useState(rental.safaTyingTime || '');
  const [tyingDate, setTyingDate] = useState(rental.safaTyingDate || '');

  /** The styles actually chosen, priced at this branch's rate. */
  const chosenStyles = styleList
    .map(st => ({ ...st, quantity: Math.max(0, parseInt(tyingQty[st.id] || '0') || 0) }))
    .filter(st => st.quantity > 0);
  const tyingCount = chosenStyles.reduce((s, st) => s + st.quantity, 0);
  const tyingCharge = chosenStyles.reduce((s, st) => s + (st.price || 0) * st.quantity, 0);

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/rentals/${rental.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerAltPhone,
          customerAddress,
          fatherName,
          weddingDate,
          safaSize,
          notes,
          startDate,
          endDate,
          paidAmount: parseFloat(paidAmount || '0'),
          discount: parseFloat(discount || '0'),
          paymentMethod,
          tieSafa,
          // Only send the breakdown when styles were actually picked, so a
          // dialog opened on an older order does not wipe its safaShape.
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
          // The server only lets an admin touch an order that has gone out.
          role: user?.role,
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update rental booking');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Edit3 size={18} className="text-indigo-600" /> Edit Booking {rental.orderNumber}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Customer Name *</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  required
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Phone Number *</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  required
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Alternate Phone</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Optional"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  value={customerAltPhone}
                  onChange={e => setCustomerAltPhone(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Father Name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Optional"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  value={fatherName}
                  onChange={e => setFatherName(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Start Date *</label>
              <DateInput
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                value={startDate}
                onChange={v => setStartDate(v)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">End Date *</label>
              <DateInput
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                value={endDate}
                onChange={v => setEndDate(v)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Address</label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-3 text-slate-400" />
              <textarea 
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white h-16 resize-none"
                value={customerAddress}
                onChange={e => setCustomerAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Payment Method</label>
              <select 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-indigo-900 outline-none focus:border-indigo-500 focus:bg-white"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
              >
                <option value="CASH">💵 Cash</option>
                <option value="ONLINE">🌐 Online</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Advance / Paid (₹)</label>
              <input 
                type="number" 
                step="0.01"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Discount (₹)</label>
              <input 
                type="number" 
                step="0.01"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <button
                type="button"
                onClick={() => setTieSafa(v => !v)}
                className="flex items-center gap-2 text-xs font-black text-amber-900 uppercase tracking-wider"
              >
                <Clock size={14} />
                Safa tying
                <span
                  className={`ml-1 px-2 py-0.5 rounded text-[10px] ${
                    tieSafa ? 'bg-amber-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
                  }`}
                >
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
                    {tyingCount} safa{tyingCount === 1 ? '' : 's'} · ₹{tyingCharge.toFixed(2)}
                    {chosenStyles.length === 0 && (
                      <span className="ml-1 font-semibold text-slate-500">
                        (leave blank to keep {rental.safaTyingCount || 0} as booked)
                      </span>
                    )}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Tying date</label>
                      <DateInput
                        value={tyingDate}
                        onChange={setTyingDate}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Time</label>
                      <input
                        type="time"
                        value={tyingTime}
                        onChange={e => setTyingTime(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Contact</label>
                      <input
                        value={tyingName}
                        onChange={e => setTyingName(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Venue</label>
                      <input
                        value={tyingAddress}
                        onChange={e => setTyingAddress(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {rental.status !== 'BOOKED' && !isAdmin && (
              <p className="mb-3 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2">
                This order has already gone out. Only an admin can correct it now.
              </p>
            )}

            <label className="block text-xs font-bold text-slate-600 mb-1">Notes / Remarks</label>
            <textarea 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white h-16 resize-none"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 text-sm"
            >
              {loading ? 'Saving Changes...' : <><CheckCircle2 size={18} /> Update Booking Details</>}
            </button>
            <button type="button" onClick={onClose} className="w-full text-slate-500 font-medium py-2 hover:text-slate-700 transition-colors text-xs">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
