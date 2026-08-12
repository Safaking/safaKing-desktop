'use client';

import React from 'react';
import { X, User, Phone, MapPin, Calendar, Tag, Package, Palette, IndianRupee, FileText, CheckCircle2, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { generateInvoicePDF } from '@/lib/invoice-gen';
import { unassignedCount } from '@/lib/tying-split';

interface SaleDetailsDialogProps {
  sale: any | null;
  onClose: () => void;
}

export default function SaleDetailsDialog({ sale, onClose }: SaleDetailsDialogProps) {
  if (!sale) return null;

  const isPaid = (sale.remainingAmount ?? 0) <= 0;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center font-bold">
              <Tag size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">{sale.orderNumber}</h3>
              <p className="text-xs text-slate-500">Sales Order Details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Customer Info Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</p>
                <p className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <User size={16} className="text-indigo-600" />
                  {sale.customerName}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {isPaid ? '✓ Paid' : `₹${sale.remainingAmount} Due`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-200/60">
              {sale.customerPhone && (
                <p className="flex items-center gap-1.5 font-medium">
                  <Phone size={13} className="text-slate-400" /> {sale.customerPhone}
                </p>
              )}
              {sale.fatherName && (
                <p className="font-medium">S/O: {sale.fatherName}</p>
              )}
              {sale.weddingDate && (
                <p className="flex items-center gap-1.5 font-medium">
                  <Calendar size={13} className="text-slate-400" /> Wedding: {sale.weddingDate}
                </p>
              )}
              {sale.createdAt && (
                <p className="flex items-center gap-1.5 text-slate-500">
                  Date: {format(new Date(sale.createdAt), 'dd MMM yyyy HH:mm')}
                </p>
              )}
            </div>

            {sale.customerAddress && (
              <p className="text-xs text-slate-500 flex items-start gap-1.5 pt-1">
                <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                {sale.customerAddress}
              </p>
            )}
          </div>

          {/* Items Purchased */}
          <div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Package size={14} className="text-indigo-600" /> Purchased Items ({sale.items?.length || 0})
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {sale.items?.map((item: any, idx: number) => (
                <div key={idx} className="p-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{item.product?.name || item.name || 'Product'}</p>
                    <p className="text-slate-500">Qty: {item.quantity} × ₹{item.price}</p>
                  </div>
                  <p className="font-bold text-slate-800 text-sm">₹{(item.quantity * item.price).toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Who is collecting, and when. Often not the buyer. */}
          {(sale.pickupName || sale.pickupPhone || sale.pickupDate) && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                <Truck size={14} className="text-slate-500" /> Delivery
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 font-medium">
                {sale.pickupName && <p>Collected by: <strong>{sale.pickupName}</strong></p>}
                {sale.pickupPhone && <p>Phone: <strong>{sale.pickupPhone}</strong></p>}
                {sale.pickupDate && <p className="col-span-2">Date: <strong>{sale.pickupDate}</strong></p>}
              </div>
            </div>
          )}

          {/* Safa Tying Details (if any) */}
          {sale.tieSafa && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider">
                <Palette size={14} className="text-amber-600" /> Safa Tying Details
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-amber-900 font-medium">
                <p>Safas to tie: <strong>{sale.safaTyingCount || 1}</strong></p>
                <p>Charge: <strong>₹{sale.tieSafaCharge || 0}</strong></p>
                {sale.safaShape && <p className="col-span-2">Styles: <strong>{sale.safaShape}</strong></p>}
                {sale.safaTyingName && <p>Tying Contact: {sale.safaTyingName}</p>}
                {sale.safaTyingDate && <p>Tying Date: {sale.safaTyingDate}</p>}
                {sale.safaTyingTime && <p>Tying Time: {sale.safaTyingTime}</p>}
                {sale.safaTyingAddress && <p className="col-span-2">Tying Location: {sale.safaTyingAddress}</p>}
              </div>

              {/* One line per artist: the tying on a big order is shared out. */}
              <div className="pt-2 border-t border-amber-200/60 space-y-1 text-xs">
                <span className="font-bold text-slate-700">Allocated Artists:</span>
                {(sale.tyingAssignments ?? []).length === 0 ? (
                  <p className="font-bold text-slate-400">Not allocated</p>
                ) : (
                  (sale.tyingAssignments ?? []).map((a: any) => (
                    <p key={a.id} className="flex justify-between gap-3">
                      <span className="font-bold text-violet-700">{a.artist?.name ?? 'Artist'}</span>
                      {/* No rate here: this screen is read at the counter, and
                          what an artist is paid belongs in their ledger. */}
                      <span className="font-semibold text-slate-600">
                        {a.quantity} safa{a.quantity === 1 ? '' : 's'}
                      </span>
                    </p>
                  ))
                )}
                {unassignedCount(sale) > 0 && (
                  <p className="font-bold text-amber-600">
                    {unassignedCount(sale)} safas still to allocate
                  </p>
                )}
              </div>

              {/* Ready status */}
              <div className="pt-1 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">Ready Status:</span>
                <span className={`font-bold ${sale.readyAt ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {sale.readyAt ? `✓ Ready ${sale.readyBy ? `(by ${sale.readyBy})` : ''}` : '⏳ Not Ready'}
                </span>
              </div>
            </div>
          )}

          {/* Payment Summary */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span>₹{(sale.totalAmount + (sale.discount || 0)).toLocaleString('en-IN')}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount:</span>
                <span>- ₹{sale.discount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-slate-800 pt-1 border-t border-slate-200">
              <span>Total Amount:</span>
              <span>₹{(sale.totalAmount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-bold">
              <span>Paid Amount:</span>
              <span>₹{(sale.paidAmount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className={`flex justify-between font-bold ${
              (sale.remainingAmount || 0) > 0 ? 'text-rose-600' : 'text-slate-500'
            }`}>
              <span>Remaining Amount:</span>
              <span>₹{(sale.remainingAmount || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          <button
            onClick={() => generateInvoicePDF(sale, 'SALE')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-sm"
          >
            <FileText size={15} /> Download Invoice
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
