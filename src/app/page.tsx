'use client';

import React, { useState, useEffect } from 'react';
import { useDashboard } from '@/lib/data';
import { 
  Calendar, 
  Package, 
  ShoppingCart, 
  Clock, 
  AlertCircle, 
  Plus, 
  ChevronRight,
  TrendingUp,
  LayoutGrid,
  IndianRupee,
  Languages,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

interface Product {
  id: string;
  name: string;
  sku: string;
  totalQuantity: number;
  category: string;
}

interface DashboardStats {
  bookedRentals?: number;
  activeRentals?: number;
  overdueRentals?: number;
  returnedRentals?: number;
  totalRentals?: number;
  productCount?: number;
  totalStockQty?: number;
  availableStockQty?: number;
  salesCount?: number;
  totalOrdersCount?: number;
  revenue?: number;
}

interface RentalActivity {
  id: string;
  customerName: string;
  createdAt: string;
  itemCount: number;
  status: string;
  totalAmount: number;
  type?: 'OVERDUE' | 'TODAY' | 'RECENT';
}

interface DashboardActivity {
  overdue: RentalActivity[];
  todays: RentalActivity[];
  recent: RentalActivity[];
}

export default function Dashboard() {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout, isOwnerOrAdmin } = useAuth();
  const { stats, activity, isLoading: loading } = useDashboard() as {
    stats: DashboardStats | null;
    activity: DashboardActivity | null;
    isLoading: boolean;
  };

  // Combine activity for display
  const combinedActivity = [
    ...(activity?.overdue?.map(r => ({ ...r, type: 'OVERDUE' as const })) || []),
    ...(activity?.todays?.map(r => ({ ...r, type: 'TODAY' as const })) || []),
    ...(activity?.recent?.map(r => ({ ...r, type: 'RECENT' as const })) || [])
  ].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i).slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Odoo Style Top Bar */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-8">
            <div className="h-16 flex items-center">
              <img src="/assets/logo.png?v=3" alt="Logo" className="h-full w-auto object-contain" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-bold text-slate-700 tracking-tight leading-snug">Near Pandya Memorial School,</p>
              <p className="text-[11px] font-medium text-slate-500 tracking-wide">Char Khamba, Partapur, Dist. Banswara (Rajasthan) – 327024</p>
              <p className="text-xs font-bold text-indigo-600 mt-0.5 flex items-center gap-1">
                <span>+91 90013 47143</span>
                <span className="text-slate-300">|</span>
                <span>+91 76918 56577</span>
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${language === 'en' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                English
              </button>
              <button 
                onClick={() => setLanguage('hi')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${language === 'hi' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                हिंदी
              </button>
            </div>

            {user ? (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center uppercase">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 leading-tight">{user.name}</p>
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">
                    {user.role} {user.store?.name ? `• ${user.store.name}` : user.role === 'ADMIN' ? '• All Stores' : ''}
                  </p>
                </div>
                <button 
                  onClick={logout}
                  className="p-1 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors ml-1"
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link href="/login" className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition-all font-bold text-xs">
                Login
              </Link>
            )}

            {isOwnerOrAdmin && (
              <Link href="/admin" className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2 font-bold text-xs shadow-md active:scale-95">
                Admin
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-10">
        {loading ? (
          <div className="py-28 flex flex-col items-center justify-center space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin absolute" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-black text-slate-800 tracking-widest uppercase">Loading Dashboard...</p>
              <p className="text-xs font-medium text-slate-400">Fetching live inventory, order counts & stats</p>
            </div>
          </div>
        ) : (
          <>
            {/* Welcome Section */}
            <section className="mb-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">{t('welcome')}</h2>
                  <p className="text-slate-500">{t('dashboard_subtitle')}</p>
                </div>

                {/* The POS terminal was only reachable by going into Sales
                    first, even though selling is a top-level daily action
                    just like taking a booking. */}
                <div className="flex items-center gap-3">
                  <Link
                    href="/bookings/new"
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-7 py-4 rounded-2xl font-black text-base shadow-xl shadow-emerald-600/30 hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-3 border border-emerald-400/20 group"
                  >
                    <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus size={20} className="stroke-[3]" />
                    </div>
                    <span className="uppercase tracking-wider text-sm">{t('new_booking')}</span>
                  </Link>

                  <Link
                    href="/sales"
                    className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-7 py-4 rounded-2xl font-black text-base shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-3 border border-indigo-400/20 group"
                  >
                    <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ShoppingCart size={20} className="stroke-[3]" />
                    </div>
                    <span className="uppercase tracking-wider text-sm">New Sell</span>
                  </Link>
                </div>
              </div>
            </section>

            {/* Quick Access Grid with Count Overviews */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <QuickAction 
                title={t('rentals')} 
                desc="Manage orders, pickups & returns" 
                href="/rentals"
                icon={<Calendar className="text-blue-600" />}
                bgColor="bg-blue-50"
                borderColor="border-blue-100"
                metrics={
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-blue-200/60">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[11px]">
                      Booked: {stats?.bookedRentals ?? 0}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[11px]">
                      Active: {stats?.activeRentals ?? 0}
                    </span>
                    {!!stats?.overdueRentals && stats.overdueRentals > 0 ? (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[11px]">
                        Overdue: {stats.overdueRentals}
                      </span>
                    ) : null}
                    {!!stats?.returnedRentals && stats.returnedRentals > 0 ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[11px]">
                        Returned: {stats.returnedRentals}
                      </span>
                    ) : null}
                  </div>
                }
              />
              <QuickAction 
                title={t('sales')} 
                desc="Direct sales and POS terminal" 
                href="/sales/history"
                icon={<ShoppingCart className="text-indigo-600" />}
                bgColor="bg-indigo-50"
                borderColor="border-indigo-100"
                metrics={
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-indigo-200/60">
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold text-[11px]">
                      Total Orders: {stats?.totalOrdersCount ?? 0}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[11px]">
                      Revenue: ₹{stats?.revenue?.toLocaleString() || '0'}
                    </span>
                  </div>
                }
              />
              <QuickAction 
                title={t('inventory')} 
                desc="Stock levels and product settings" 
                href="/products"
                icon={<Package className="text-amber-600" />}
                bgColor="bg-amber-50"
                borderColor="border-amber-100"
                metrics={
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-amber-200/60">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[11px]">
                      Products: {stats?.productCount ?? 0}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-bold text-[11px]">
                      Stock: {stats?.availableStockQty ?? 0} Pcs
                    </span>
                  </div>
                }
              />
            </section>

            {/* Recent Activity Mini-Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Clock size={20} className="text-indigo-600" /> Recent Activity
                </h3>
                <Link href="/rentals" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 flex items-center gap-1 group">
                  View All <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-center">Qty</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {combinedActivity.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">No recent activity</td></tr>
                    ) : combinedActivity.map(rental => (
                      <tr 
                        key={rental.id} 
                        className="hover:bg-slate-50 transition-colors cursor-pointer group/row"
                        onClick={() => window.location.href = `/rentals`}
                      >
                        <td className="px-6 py-4 font-bold text-slate-800">
                          {rental.customerName}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-700">
                          {new Date(rental.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-center text-slate-600 font-medium">
                          {rental.itemCount}
                        </td>
                        <td className="px-6 py-4">
                          {rental.type === 'OVERDUE' ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-tighter">
                              Overdue
                            </span>
                          ) : rental.type === 'TODAY' ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100 uppercase tracking-tighter">
                              Today
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-tighter">
                              {rental.status}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-black text-slate-900 flex items-center justify-between">
                          ₹{rental.totalAmount.toLocaleString()}
                          <ChevronRight size={16} className="text-slate-300 opacity-0 group-hover/row:opacity-100 group-hover/row:translate-x-1 transition-all" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function QuickAction({ title, desc, href, icon, bgColor, borderColor, metrics }: any) {
  return (
    <Link href={href} className={`block p-6 ${bgColor} border ${borderColor} rounded-2xl hover:scale-[1.02] transition-all group shadow-sm flex flex-col justify-between`}>
      <div className="flex flex-col gap-4">
        <div className="bg-white p-3 rounded-xl w-fit shadow-sm group-hover:shadow-md transition-all">
          {React.cloneElement(icon as React.ReactElement<any>, { size: 28 })}
        </div>
        <div>
          <h3 className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors text-lg">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
        </div>
      </div>

      {metrics}
    </Link>
  );
}
