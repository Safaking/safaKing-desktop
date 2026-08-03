'use client';

import React, { useState, useEffect } from 'react';
import { useSales } from '@/lib/data';
import {
  Search, 
  ArrowLeft, 
  Download, 
  MoreVertical, 
  User, 
  Calendar,
  CheckCircle2,
  Clock,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { generateInvoicePDF } from '@/lib/invoice-gen';

interface Sale {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  items: any[];
  createdAt: string;
  invoice?: {
    status: string;
    invoiceNumber: string;
  };
}

export default function SalesHistoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data, isLoading: loading } = useSales();
  const sales: Sale[] = Array.isArray(data) ? data : [];

  const filteredSales = sales.filter(s =>
    s.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Odoo Style Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft size={20} className="text-slate-500" />
              </Link>
              <h1 className="text-xl font-semibold text-slate-800">Sales Orders</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Search orders..."
                  className="pl-10 pr-4 py-2 bg-slate-100 border-transparent border focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-lg outline-none w-64 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Link href="/sales" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all font-medium">
                <Plus size={18} /> POS
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Order</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Clock className="animate-spin mx-auto mb-2" size={24} />
                    Loading orders...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No sales orders found.
                  </td>
                </tr>
              ) : filteredSales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-mono text-indigo-600 font-semibold">{sale.orderNumber}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <User size={14} className="text-slate-400" />
                      <span className="font-medium">{sale.customerName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} className="text-slate-400" />
                      {format(new Date(sale.createdAt), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800">
                    ₹{sale.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-4 py-1.5 rounded-full text-sm font-bold border flex items-center gap-1 w-fit bg-emerald-50 text-emerald-700 border-emerald-200`}>
                      <CheckCircle2 size={14} /> Paid
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => generateInvoicePDF(sale, 'SALE')}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors" 
                        title="Download Invoice"
                      >
                        <Download size={18} />
                      </button>
                      <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
