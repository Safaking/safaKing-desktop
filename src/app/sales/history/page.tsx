'use client';

import React, { useState } from 'react';
import { useSales, invalidateAfterSale } from '@/lib/data';
import { useAuth } from '@/lib/AuthContext';
import {
  Search, 
  ArrowLeft, 
  Download, 
  User, 
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Eye,
  Palette,
  Tag
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { generateInvoicePDF } from '@/lib/invoice-gen';
import SaleDetailsDialog from '@/components/SaleDetailsDialog';
import AllocateArtistDialog from '@/components/AllocateArtistDialog';
import { needsArtist } from '@/lib/barati';
import { artistLabel, artistTitle, isFullyAssigned } from '@/lib/tying-split';
import DeliveryLine from '@/components/DeliveryLine';

export default function SalesHistoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewSale, setViewSale] = useState<any | null>(null);
  const [artistSale, setArtistSale] = useState<any | null>(null);
  const { user, isSuperOrAdmin } = useAuth();
  const { data, isLoading: loading, mutate: refreshSales } = useSales();
  const sales: any[] = Array.isArray(data) ? data : [];

  const filteredSales = sales.filter(s => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (s.customerName && s.customerName.toLowerCase().includes(q)) ||
      (s.orderNumber && s.orderNumber.toLowerCase().includes(q)) ||
      (s.customerPhone && s.customerPhone.includes(q)) ||
      (s.invoice?.invoiceNumber && s.invoice.invoiceNumber.toLowerCase().includes(q))
    );
  });

  const handleToggleReady = async (sale: any) => {
    const next = !sale.readyAt;
    try {
      const res = await fetch(`/api/sales/${sale.id}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ready: next, readyBy: user?.username || user?.name || '' }),
      });
      if (res.ok) {
        await invalidateAfterSale();
        refreshSales();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update ready state');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating ready state');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft size={20} className="text-slate-500" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-slate-800">Sales Orders</h1>
                <p className="text-xs text-slate-500 font-medium">Counter sales & Safa tying orders</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Search by Bill No, Name, Phone..."
                  className="pl-10 pr-4 py-2 bg-slate-100 border-transparent border focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl outline-none w-72 text-xs font-semibold transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Link href="/sales" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all font-bold text-xs">
                <Plus size={16} /> POS / New Sale
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Order / Bill</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status & Options</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Clock className="animate-spin mx-auto mb-2 text-indigo-600" size={24} />
                    Loading orders...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No sales orders found.
                  </td>
                </tr>
              ) : filteredSales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-mono text-indigo-600 font-bold text-sm cursor-pointer hover:underline" onClick={() => setViewSale(sale)}>
                        {sale.orderNumber}
                      </span>
                      {sale.invoice?.invoiceNumber && (
                        <span className="text-[11px] font-mono text-slate-400">
                          {sale.invoice.invoiceNumber}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-800 text-xs">{sale.customerName}</p>
                        <DeliveryLine order={sale} />
                        {sale.customerPhone && (
                          <p className="text-[11px] text-slate-400 font-medium">{sale.customerPhone}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Calendar size={14} className="text-slate-400" />
                      {format(new Date(sale.createdAt), 'dd MMM yyyy HH:mm')}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800 text-sm">
                    ₹{sale.totalAmount.toLocaleString('en-IN')}
                    {sale.remainingAmount > 0 && (
                      <span className="block text-[10px] text-rose-600 font-bold">
                        ₹{sale.remainingAmount} Due
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1 ${
                        (sale.remainingAmount || 0) <= 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <CheckCircle2 size={12} />
                        {(sale.remainingAmount || 0) <= 0 ? 'Paid' : 'Partial'}
                      </span>

                      {/* Ready Badge & Toggle for Safa Tying */}
                      {sale.tieSafa && (
                        <button
                          onClick={() => handleToggleReady(sale)}
                          title={
                            sale.readyAt
                              ? `Ready${sale.readyBy ? ` — marked by ${sale.readyBy}` : ''}. Click to undo.`
                              : 'Mark this sale safa ready'
                          }
                          className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                            sale.readyAt
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {sale.readyAt ? '✓ Ready' : 'Mark Ready'}
                        </button>
                      )}

                      {/* Allocate Artist Badge for Safa Tying */}
                      {/* Only barati tying sends artists out to the event; the rest is
                          tied at the counter, so it has nobody to allot. */}
                      {needsArtist(sale) && isSuperOrAdmin && (
                        <button
                          onClick={() => setArtistSale(sale)}
                          title={artistTitle(sale)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                            isFullyAssigned(sale)
                              ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          }`}
                        >
                          {artistLabel(sale, 'Allocate')}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setViewSale(sale)}
                        className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition-colors"
                        title="View Details"
                      >
                        <Eye size={17} />
                      </button>
                      <button 
                        onClick={() => generateInvoicePDF(sale, 'SALE')}
                        className="p-2 hover:bg-slate-100 hover:text-slate-700 rounded-lg text-slate-400 transition-colors" 
                        title="Download Invoice"
                      >
                        <Download size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Sale View Details Modal */}
      <SaleDetailsDialog
        sale={viewSale}
        onClose={() => setViewSale(null)}
      />

      {/* Artist Allocation Modal for Sales */}
      <AllocateArtistDialog
        rental={artistSale}
        type="SALE"
        onClose={() => setArtistSale(null)}
        onSuccess={() => {
          setArtistSale(null);
          refreshSales();
        }}
      />
    </div>
  );
}
