'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, RotateCcw } from 'lucide-react';

interface ReturnDialogProps {
  rental: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReturnDialog({ rental, onClose, onSuccess }: ReturnDialogProps) {
  const [items, setItems] = useState(
    rental.items.map((item: any) => ({
      productId: item.productId,
      name: item.product.name,
      total: item.quantity,
      returned: item.returnedQuantity,
      returning: item.quantity - item.returnedQuantity,
    }))
  );
  const [loading, setLoading] = useState(false);

  const handleReturn = async () => {
    setLoading(true);
    const res = await fetch('/api/rentals/return', {
      method: 'POST',
      body: JSON.stringify({
        rentalId: rental.id,
        items: items.map((i: any) => ({
          productId: i.productId,
          quantity: i.returning,
        })),
      }),
    });
    
    if (res.ok) {
      onSuccess();
    } else {
      const data = await res.json();
      alert(data.error);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <RotateCcw size={20} className="text-indigo-600" /> Process Return
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Order Details</p>
            <p className="text-sm text-slate-700 font-medium">{rental.orderNumber} - {rental.customerName}</p>
          </div>

          <div className="space-y-4">
            {items.map((item: any, idx: number) => (
              <div key={item.productId} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="font-medium text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-400">Total: {item.total} | Already Returned: {item.returned}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="0" 
                    max={item.total - item.returned}
                    className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-center font-bold text-indigo-600 outline-none focus:border-indigo-500"
                    value={item.returning}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      const newItems = [...items];
                      newItems[idx].returning = Math.min(val, item.total - item.returned);
                      setItems(newItems);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <button 
              onClick={handleReturn}
              disabled={loading || items.every((i: any) => i.returning === 0)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              {loading ? 'Processing...' : <><CheckCircle2 size={18} /> Confirm Return</>}
            </button>
            <button onClick={onClose} className="w-full text-slate-500 font-medium py-2 hover:text-slate-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
