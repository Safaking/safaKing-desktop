'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Plus, 
  Calendar, 
  User, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Download,
  ArrowLeft,
  RotateCcw
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { generateInvoicePDF } from '@/lib/invoice-gen';
import ReturnDialog from '@/components/ReturnDialog';

interface Rental {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  startDate: string;
  endDate: string;
  status: 'BOOKED' | 'ACTIVE' | 'RETURNED' | 'OVERDUE';
  totalAmount: number;
  items: any[];
  invoice?: {
    status: string;
    invoiceNumber: string;
  };
}

export default function RentalsPage() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);

  useEffect(() => {
    fetchRentals();
  }, [activeTab]);

  const fetchRentals = async () => {
    setLoading(true);
    const statusParam = activeTab === 'ALL' ? '' : `?status=${activeTab}`;
    const res = await fetch(`/api/rentals${statusParam}`);
    const data = await res.json();
      setRentals(data.map((r: any) => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const isPast = new Date(r.endDate) < startOfToday;
        const displayStatus = (isPast && r.status !== 'RETURNED') ? 'OVERDUE' : r.status;
        return { ...r, status: displayStatus };
      }));
    setLoading(false);
  };

  const filteredRentals = rentals.filter(r => 
    r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'RETURNED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'ACTIVE': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'BOOKED': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'OVERDUE': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

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
              <h1 className="text-xl font-semibold text-slate-800">Rentals</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Search customer or order..."
                  className="pl-10 pr-4 py-2 bg-slate-100 border-transparent border focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-lg outline-none w-64 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Link href="/bookings/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-md shadow-indigo-200 transition-all font-medium">
                <Plus size={18} /> Create
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 -mb-px">
            {['ALL', 'BOOKED', 'ACTIVE', 'RETURNED', 'OVERDUE'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 px-1 text-sm font-medium transition-all border-b-2 ${
                  activeTab === tab 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab === 'ALL' ? 'All Rentals' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
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
                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Dates</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Payment</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Clock className="animate-spin mx-auto mb-2" size={24} />
                    Loading rentals...
                  </td>
                </tr>
              ) : filteredRentals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No rentals found.
                  </td>
                </tr>
              ) : filteredRentals.map(rental => (
                <tr key={rental.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-mono text-indigo-600 font-semibold">{rental.orderNumber}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <User size={14} />
                      </div>
                      <span className="font-medium">{rental.customerName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} className="text-slate-400" />
                      {format(new Date(rental.startDate), 'MMM dd')} - {format(new Date(rental.endDate), 'MMM dd, yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800">
                    ₹{rental.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${getStatusStyle(rental.status)}`}>
                      {rental.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1 text-sm font-bold ${
                      rental.invoice?.status === 'PAID' ? 'text-emerald-600' : 'text-rose-500'
                    }`}>
                      {rental.invoice?.status === 'PAID' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      {rental.invoice?.status || 'UNPAID'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => generateInvoicePDF(rental)}
                        className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition-colors" 
                        title="Download Invoice"
                      >
                        <Download size={18} />
                      </button>
                      <button 
                        onClick={() => setSelectedRental(rental)}
                        className="p-2 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg text-slate-400 transition-colors" 
                        title="Process Return"
                      >
                        <RotateCcw size={18} />
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

      {selectedRental && (
        <ReturnDialog 
          rental={selectedRental} 
          onClose={() => setSelectedRental(null)} 
          onSuccess={() => {
            setSelectedRental(null);
            fetchRentals();
          }} 
        />
      )}
    </div>
  );
}
