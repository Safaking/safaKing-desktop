'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, RotateCcw, AlertTriangle, IndianRupee } from 'lucide-react';

interface ReturnDialogProps {
  rental: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReturnDialog({ rental, onClose, onSuccess }: ReturnDialogProps) {
  const [items, setItems] = useState(
    rental.items.map((item: any) => {
      const booked = item.quantity;
      const alreadyReturned = item.returnedQuantity || 0;
      const remainingToReturn = Math.max(0, booked - alreadyReturned);
      const salePrice = item.product?.salePrice || 0;

      return {
        productId: item.productId,
        name: item.product?.name || item.name || 'Product',
        sku: item.product?.sku || '',
        booked,
        alreadyReturned,
        remainingToReturn,
        returningQty: remainingToReturn, // Default to full return
        salePrice,
      };
    })
  );

  const [paidNow, setPaidNow] = useState('0');
  const [loading, setLoading] = useState(false);

  // Calculate missing item charges
  const totalUnreturnedCharge = items.reduce((sum: number, item: any) => {
    const unreturned = Math.max(0, item.remainingToReturn - item.returningQty);
    return sum + (unreturned * item.salePrice);
  }, 0);

  const currentOutstanding = rental.remainingAmount || 0;
  const grandTotalDue = currentOutstanding + totalUnreturnedCharge;

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payloadItems = items.map((i: any) => {
        const unreturned = Math.max(0, i.remainingToReturn - i.returningQty);
        return {
          productId: i.productId,
          newlyReturned: i.returningQty,
          unreturnedCharge: unreturned * i.salePrice,
        };
      });

      const res = await fetch('/api/rentals/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalId: rental.id,
          items: payloadItems,
          paidNow: parseFloat(paidNow || '0'),
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to process return');
      }
    } catch (err: any) {
      alert(err.message || 'Error processing return');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <RotateCcw size={20} className="text-emerald-600" /> Confirm Return & Inventory Update
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleReturnSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order Reference</p>
              <p className="text-sm font-bold text-slate-800">{rental.orderNumber} • {rental.customerName}</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full">
              {rental.status}
            </span>
          </div>

          {/* Items Return Table */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
              Confirm Returned Quantities
            </label>

            {items.map((item: any, idx: number) => {
              const missingQty = Math.max(0, item.remainingToReturn - item.returningQty);
              const missingCharge = missingQty * item.salePrice;

              return (
                <div key={item.productId} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                      <p className="text-xs text-slate-500 font-medium">
                        SKU: {item.sku} | Booked: <span className="font-bold text-slate-800">{item.booked}</span> | Already Returned: {item.alreadyReturned}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-bold uppercase">Sale Value</p>
                      <p className="text-xs font-bold text-slate-700">₹{item.salePrice.toFixed(2)}/pc</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600">Returning Now:</span>
                      <input 
                        type="number" 
                        min="0" 
                        max={item.remainingToReturn}
                        className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-emerald-700 text-sm outline-none focus:border-emerald-500"
                        value={item.returningQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          const updated = [...items];
                          updated[idx].returningQty = Math.min(val, item.remainingToReturn);
                          setItems(updated);
                        }}
                      />
                      <span className="text-xs text-slate-400 font-medium">/ {item.remainingToReturn} pcs</span>
                    </div>

                    {missingQty > 0 && (
                      <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-lg border border-rose-200 text-xs font-bold">
                        <AlertTriangle size={14} />
                        <span>{missingQty} Missing = ₹{missingCharge.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Financial Summary */}
          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
              <span>Unreturned Items Charge ({items.reduce((s: number, i: any) => s + Math.max(0, i.remainingToReturn - i.returningQty), 0)} pcs @ Sale Price):</span>
              <span className="text-amber-400 text-sm font-bold">₹{totalUnreturnedCharge.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
              <span>Existing Remaining Balance:</span>
              <span className="text-white text-sm font-bold">₹{currentOutstanding.toFixed(2)}</span>
            </div>

            <div className="pt-2 border-t border-slate-700 flex justify-between items-center">
              <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">Total Required to Pay:</span>
              <span className="text-lg font-black text-emerald-400">₹{grandTotalDue.toFixed(2)}</span>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">Amount Paid Now (₹):</label>
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                <input 
                  type="number"
                  step="0.01"
                  className="w-full pl-7 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-right font-bold text-white text-sm outline-none focus:border-emerald-500"
                  value={paidNow}
                  onChange={e => setPaidNow(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 text-sm"
            >
              {loading ? 'Updating Return & Inventory...' : <><CheckCircle2 size={18} /> Confirm Return & Update Inventory</>}
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
