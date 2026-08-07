'use client';

import React, { useState, useEffect } from 'react';
import { useRentals, invalidateAfterRentalChange } from '@/lib/data';
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
  Eye,
  ArrowLeft,
  RotateCcw,
  Truck,
  Edit3,
  Trash2
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { generateInvoicePDF } from '@/lib/invoice-gen';
import ReturnDialog from '@/components/ReturnDialog';
import ActivateRentalDialog from '@/components/ActivateRentalDialog';
import RentalDetailsDialog from '@/components/RentalDetailsDialog';
import AllocateArtistDialog from '@/components/AllocateArtistDialog';
import { needsArtist } from '@/lib/barati';
import { artistLabel, artistTitle, isFullyAssigned } from '@/lib/tying-split';
import DeliveryLine from '@/components/DeliveryLine';
import EditRentalDialog from '@/components/EditRentalDialog';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';

interface Rental {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  customerAltPhone?: string;
  customerAddress?: string;
  fatherName?: string;
  weddingDate?: string;
  safaSize?: string;
  notes?: string;
  pickupName?: string;
  pickupPhone?: string;
  pickupDate?: string;
  startDate: string;
  endDate: string;
  status: 'BOOKED' | 'ACTIVE' | 'RETURNED' | 'OVERDUE';
  totalAmount: number;
  paidAmount?: number;
  remainingAmount?: number;
  discount?: number;
  paymentMethod?: string;
  readyAt?: string | null;
  readyBy?: string | null;
  tieSafa?: boolean;
  safaShape?: string | null;
  safaTyingCount?: number;
  artistId?: string | null;
  artistRate?: number;
  artistPaid?: boolean;
  artist?: { id: string; name: string } | null;
  items: any[];
  invoice?: {
    status: string;
    invoiceNumber: string;
    paymentMethod?: string;
  };
}

export default function RentalsPage() {
  const { t } = useLanguage();
  const { user, isSuperOrAdmin, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [activateRental, setActivateRental] = useState<Rental | null>(null);
  const [viewRental, setViewRental] = useState<Rental | null>(null);
  const [artistRental, setArtistRental] = useState<Rental | null>(null);
  const [editRental, setEditRental] = useState<Rental | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Cached per tab: switching tabs (or leaving and coming back) renders the
  // previous result immediately while SWR revalidates in the background.
  const { data: rentalData, isLoading: loading, mutate: refreshRentals } = useRentals(
    activeTab === 'ALL' ? undefined : activeTab
  );

  const rentals: Rental[] = React.useMemo(() => {
    if (!Array.isArray(rentalData)) return [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return rentalData.map((r: any) => {
      const isPast = new Date(r.endDate) < startOfToday;
      // Only mark OVERDUE if order was ACTIVE (delivered). BOOKED stays BOOKED until manually activated!
      const displayStatus = (isPast && r.status === 'ACTIVE') ? 'OVERDUE' : r.status;
      return { ...r, status: displayStatus };
    });
  }, [rentalData]);

  const fetchRentals = async () => {
    await invalidateAfterRentalChange();
    await refreshRentals();
  };

  const filteredRentals = rentals.filter(r => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (r.customerName && r.customerName.toLowerCase().includes(q)) ||
      (r.orderNumber && r.orderNumber.toLowerCase().includes(q)) ||
      (r.customerPhone && r.customerPhone.includes(q)) ||
      (r.customerAltPhone && r.customerAltPhone.includes(q)) ||
      (r.fatherName && r.fatherName.toLowerCase().includes(q)) ||
      (r.pickupName && r.pickupName.toLowerCase().includes(q)) ||
      (r.pickupPhone && r.pickupPhone.includes(q)) ||
      (r.invoice?.invoiceNumber && r.invoice.invoiceNumber.toLowerCase().includes(q))
    );
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'RETURNED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'ACTIVE': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'BOOKED': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'OVERDUE': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleToggleReady = async (rental: Rental) => {
    const next = !rental.readyAt;
    try {
      const res = await fetch(`/api/rentals/${rental.id}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ready: next, readyBy: user?.username || user?.name || '' }),
      });
      if (res.ok) {
        setOpenMenuId(null);
        fetchRentals();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update ready state');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating ready state');
    }
  };

  const handleDeleteRental = async (rental: Rental) => {
    const confirmed = window.confirm(`Are you sure you want to delete order ${rental.orderNumber}? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/rentals/${rental.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setOpenMenuId(null);
        fetchRentals();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete order');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting order');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans" onClick={() => setOpenMenuId(null)}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <ArrowLeft size={20} className="text-slate-600" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                <RotateCcw size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">{t('rentals_title')}</h1>
                <p className="text-xs text-slate-500 font-medium">{t('rentals_sub')}</p>
              </div>
            </div>
          </div>
          <Link href="/bookings/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2">
            <Plus size={16} />{t('new_booking')}</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-10 space-y-6">
        {/* Filter Tabs & Search */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-xs overflow-x-auto max-w-full [&>*]:shrink-0">
            {([
              ['ALL', 'all'],
              ['BOOKED', 'booked'],
              ['ACTIVE', 'active'],
              ['RETURNED', 'returned'],
              ['OVERDUE', 'overdue'],
            ] as const).map(([tab, key]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {t(key)}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by Bill No, Name, Phone..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
            />
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-slate-50/70 border-b border-slate-200">
              <tr className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">{t('order')}</th>
                <th className="px-6 py-4">{t('customer')}</th>
                <th className="px-6 py-4">{t('dates')}</th>
                <th className="px-6 py-4">{t('amount')}</th>
                <th className="px-6 py-4">{t('status')}</th>
                <th className="px-6 py-4">{t('payment')}</th>
                <th className="px-6 py-4 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
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
                <tr key={rental.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-indigo-600 font-semibold">{rental.orderNumber}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-800">{rental.customerName}</p>
                    <DeliveryLine order={rental} />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {format(new Date(rental.startDate), 'dd-MM-yy')} - {format(new Date(rental.endDate), 'dd-MM-yy')}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800">₹{rental.totalAmount.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusStyle(rental.status)}`}>
                      {rental.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const status = rental.invoice?.status || 'UNPAID';
                      const pm = rental.invoice?.paymentMethod || rental.paymentMethod || 'CASH';
                      const isPaid = status === 'PAID';
                      const isPartial = status === 'PARTIAL';

                      return (
                        <div className="flex flex-col items-start gap-0.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-extrabold ${
                            isPaid ? 'text-emerald-600' : isPartial ? 'text-amber-600' : 'text-rose-500'
                          }`}>
                            {isPaid ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                            {status}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Via {pm}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2 relative">
                      <button
                        onClick={() => handleToggleReady(rental)}
                        title={
                          rental.readyAt
                            ? `Ready${rental.readyBy ? ` — marked by ${rental.readyBy}` : ''}. Click to undo.`
                            : 'Mark this order ready for handover'
                        }
                        className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                          rental.readyAt
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {rental.readyAt ? t('ready') : t('mark_ready')}
                      </button>

                      {/* Only barati tying sends artists out to the event; the rest is
                          tied at the counter, so it has nobody to allot. */}
                      {needsArtist(rental) && isSuperOrAdmin && (
                        <button
                          onClick={() => setArtistRental(rental)}
                          title={artistTitle(rental)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                            isFullyAssigned(rental)
                              ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          }`}
                        >
                          {artistLabel(rental, t('allocate'))}
                        </button>
                      )}

                      <button
                        onClick={() => setViewRental(rental)}
                        className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition-colors"
                        title={t('view_details')}
                      >
                        <Eye size={18} />
                      </button>

                      <button
                        onClick={() => generateInvoicePDF(rental)}
                        className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition-colors"
                        title={t('download_invoice')}
                      >
                        <Download size={18} />
                      </button>

                      {rental.status === 'BOOKED' && (
                        <button 
                          onClick={() => setActivateRental(rental)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1.5"
                        >
                          <Truck size={14} /> Activate
                        </button>
                      )}

                      {(rental.status === 'ACTIVE' || rental.status === 'OVERDUE') && (
                        <button 
                          onClick={() => setSelectedRental(rental)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1.5"
                        >
                          <RotateCcw size={14} /> Return
                        </button>
                      )}

                      {/* Three Dot Action Menu */}
                      <div className="relative">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === rental.id ? null : rental.id);
                          }}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                          title="More Options"
                        >
                          <MoreVertical size={18} />
                        </button>

                        {openMenuId === rental.id && (
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-10 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 text-left animate-in fade-in zoom-in-95 duration-150"
                          >
                            {rental.status === 'BOOKED' ? (
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setEditRental(rental);
                                }}
                                className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                              >
                                <Edit3 size={14} className="text-indigo-600" /> Edit Booking
                              </button>
                            ) : (
                              <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 flex items-center gap-2 cursor-not-allowed">
                                <Edit3 size={14} className="text-slate-300" /> Edit (Booked Only)
                              </div>
                            )}

                            {user?.role === 'ADMIN' && (
                              <button
                                onClick={() => handleDeleteRental(rental)}
                                className="w-full px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100"
                              >
                                <Trash2 size={14} /> Delete Order
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </main>

      {editRental && (
        <EditRentalDialog 
          rental={editRental} 
          onClose={() => setEditRental(null)} 
          onSuccess={() => {
            setEditRental(null);
            fetchRentals();
          }} 
        />
      )}

      <RentalDetailsDialog rental={viewRental} onClose={() => setViewRental(null)} />

      <AllocateArtistDialog
        rental={artistRental}
        onClose={() => setArtistRental(null)}
        onSuccess={() => {
          setArtistRental(null);
          fetchRentals();
        }}
      />

      {activateRental && (
        <ActivateRentalDialog
          rental={activateRental}
          onClose={() => setActivateRental(null)} 
          onSuccess={() => {
            setActivateRental(null);
            fetchRentals();
          }} 
        />
      )}

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
