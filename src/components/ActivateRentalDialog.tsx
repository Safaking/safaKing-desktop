'use client';

import React, { useState } from 'react';
import DateInput from '@/components/DateInput';
import { X, CheckCircle2, Truck, User, Phone, Calendar } from 'lucide-react';

interface ActivateRentalDialogProps {
  rental: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ActivateRentalDialog({ rental, onClose, onSuccess }: ActivateRentalDialogProps) {
  const [pickupName, setPickupName] = useState(rental.customerName || '');
  const [pickupPhone, setPickupPhone] = useState(rental.customerPhone || '');
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupName || !pickupPhone) {
      alert('Please fill in Receiver Name and Phone number.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/rentals/${rental.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupName,
          pickupPhone,
          pickupDate,
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to activate rental');
      }
    } catch (e: any) {
      alert(e.message || 'Error confirming delivery');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
          <h3 className="font-bold text-blue-900 flex items-center gap-2">
            <Truck size={20} className="text-blue-600" /> Confirm Delivery / Pickup
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleActivate} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order Details</p>
            <p className="text-sm font-bold text-slate-800">{rental.orderNumber} • {rental.customerName}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Receiver / Delivery Person Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                required
                type="text" 
                placeholder="Name of person taking delivery"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold text-sm"
                value={pickupName}
                onChange={e => setPickupName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Receiver Mobile Number *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                required
                type="text" 
                placeholder="Mobile number"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold text-sm"
                value={pickupPhone}
                onChange={e => setPickupPhone(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Delivery / Pickup Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <DateInput
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold text-sm"
                value={pickupDate}
                onChange={v => setPickupDate(v)}
              />
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-2">
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-2"
            >
              {loading ? 'Confirming...' : <><CheckCircle2 size={18} /> Move to Active State</>}
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
