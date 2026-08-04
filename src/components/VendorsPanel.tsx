'use client';

import React, { useState } from 'react';
import { Building2, Edit3, Trash2 } from 'lucide-react';
import { useVendors, invalidateAfterVendorChange } from '@/lib/data';

/**
 * Vendor (bulk buyer) register.
 *
 * Lives here rather than inline in the admin page because two places show it:
 * the admin panel, and a standalone /vendors route for a SUPER who has been
 * granted vyapari access — admins only can reach /admin.
 */
export default function VendorsPanel() {
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [vendorGst, setVendorGst] = useState('');
  const [editingVendor, setEditingVendor] = useState<any | null>(null);
  const [vendorLoading, setVendorLoading] = useState(false);

  const vendorsSWR = useVendors(true);
  const vendors: any[] = Array.isArray(vendorsSWR.data) ? vendorsSWR.data : [];

  const resetVendorForm = () => {
    setEditingVendor(null);
    setVendorName('');
    setVendorPhone('');
    setVendorAddress('');
    setVendorGst('');
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) return;
    setVendorLoading(true);
    try {
      const res = await fetch('/api/vendors', {
        method: editingVendor ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingVendor ? { id: editingVendor.id } : {}),
          name: vendorName,
          phone: vendorPhone,
          address: vendorAddress,
          gstNumber: vendorGst,
        }),
      });
      if (res.ok) {
        resetVendorForm();
        await invalidateAfterVendorChange();
        vendorsSWR.mutate();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save vendor');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving vendor');
    } finally {
      setVendorLoading(false);
    }
  };

  const handleDeleteVendor = async (vendor: any) => {
    if (!window.confirm(`Remove vendor "${vendor.name}"?`)) return;
    try {
      const res = await fetch(`/api/vendors?id=${vendor.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        if (data?.message) alert(data.message);
        await invalidateAfterVendorChange();
        vendorsSWR.mutate();
      } else {
        alert(data.error || 'Failed to remove vendor');
      }
    } catch (err: any) {
      alert(err.message || 'Error removing vendor');
    }
  };

  return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white border border-slate-200 rounded-xl p-5 sticky top-24">
                <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <Building2 size={18} className="text-indigo-600" />
                  {editingVendor ? 'Edit Vendor' : 'Register Vendor'}
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Bulk buyers. Their orders go through the normal POS screen — pick the
                  vendor there and the order is tagged to them.
                </p>
                <form onSubmit={handleSaveVendor} className="space-y-3">
                  <input
                    required
                    type="text"
                    placeholder="Vendor name"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium"
                    value={vendorName}
                    onChange={e => setVendorName(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Phone (optional)"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium"
                    value={vendorPhone}
                    onChange={e => setVendorPhone(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Address (optional)"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium"
                    value={vendorAddress}
                    onChange={e => setVendorAddress(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="GST number (optional)"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-mono"
                    value={vendorGst}
                    onChange={e => setVendorGst(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={vendorLoading || !vendorName.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-2.5 rounded-xl font-bold text-sm transition-all"
                  >
                    {vendorLoading ? 'Saving…' : editingVendor ? 'Update Vendor' : 'Add Vendor'}
                  </button>
                  {editingVendor && (
                    <button
                      type="button"
                      onClick={resetVendorForm}
                      className="w-full text-slate-500 font-medium py-1 text-xs hover:text-slate-700"
                    >
                      Cancel edit
                    </button>
                  )}
                </form>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-3">
              {vendors.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 font-medium">
                  No vendors registered yet.
                </div>
              ) : (
                vendors.map(vendor => (
                  <div
                    key={vendor.id}
                    className={`bg-white border rounded-xl p-4 ${
                      vendor.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          {vendor.name}
                          {!vendor.isActive && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-black uppercase">
                              Inactive
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 font-medium truncate">
                          {[vendor.phone, vendor.gstNumber, vendor.address].filter(Boolean).join(' · ') ||
                            'No contact details'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setEditingVendor(vendor);
                            setVendorName(vendor.name || '');
                            setVendorPhone(vendor.phone || '');
                            setVendorAddress(vendor.address || '');
                            setVendorGst(vendor.gstNumber || '');
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteVendor(vendor)}
                          className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Orders</p>
                        <p className="text-sm font-black text-slate-800">{vendor.orderCount ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Purchased</p>
                        <p className="text-sm font-black text-slate-800">
                          ₹{(vendor.totalPurchased ?? 0).toFixed(0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Paid</p>
                        <p className="text-sm font-black text-emerald-600">
                          ₹{(vendor.totalPaid ?? 0).toFixed(0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Due</p>
                        <p
                          className={`text-sm font-black ${
                            (vendor.totalOutstanding ?? 0) > 0 ? 'text-rose-600' : 'text-slate-400'
                          }`}
                        >
                          ₹{(vendor.totalOutstanding ?? 0).toFixed(0)}
                        </p>
                      </div>
                    </div>

                    {vendor.sales?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                        {vendor.sales.slice(0, 5).map((order: any) => (
                          <div key={order.id} className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-600">{order.orderNumber}</span>
                            <span className="font-semibold text-slate-500">
                              ₹{(order.totalAmount ?? 0).toFixed(0)} · paid ₹{(order.paidAmount ?? 0).toFixed(0)}
                              {(order.remainingAmount ?? 0) > 0 && (
                                <span className="text-rose-600 font-bold">
                                  {' '}· due ₹{(order.remainingAmount ?? 0).toFixed(0)}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                        {vendor.sales.length > 5 && (
                          <p className="text-[10px] font-semibold text-slate-400">
                            + {vendor.sales.length - 5} more order{vendor.sales.length - 5 === 1 ? '' : 's'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
  );
}
