'use client';

import React, { useState, useEffect } from 'react';
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
  ShieldCheck
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

// Define types for dashboard data
interface DashboardStats {
  activeRentals: number;
  overdueRentals: number;
  productCount: number;
  revenue: number;
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
  const [activity, setActivity] = useState<DashboardActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [activityRes, statsRes] = await Promise.all([
          fetch('/api/dashboard/activity'),
          fetch('/api/dashboard/stats')
        ]);
        setActivity(await activityRes.json());
        setStats(await statsRes.json());
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Combine activity for display
  const combinedActivity = [
    ...(activity?.overdue?.map(r => ({ ...r, type: 'OVERDUE' })) || []),
    ...(activity?.todays?.map(r => ({ ...r, type: 'TODAY' })) || []),
    ...(activity?.recent?.map(r => ({ ...r, type: 'RECENT' })) || [])
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
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center uppercase">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 leading-tight">{user.name}</p>
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">
                      {user.role} {user.store?.name ? `• ${user.store.name}` : user.role === 'ADMIN' ? '• All Stores' : ''}
                    </p>
                  </div>
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

            <Link href="/bookings/new" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2 font-bold text-xs shadow-md shadow-emerald-500/10 active:scale-95">
              <Plus size={16} /> {t('new_booking')}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-10">
        {/* Welcome & Stats Section */}
        <section className="mb-12">
            <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-3xl font-bold text-slate-800">{t('welcome')}</h2>
              <p className="text-slate-500">{t('dashboard_subtitle')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title={t('rentals')} value={stats?.activeRentals?.toString() || '0'} icon={<Clock />} color="blue" />
            <StatCard title={t('inventory')} value={stats?.productCount?.toString() || '0'} icon={<Package />} color="indigo" />
            <StatCard title={t('total')} value={`₹${stats?.revenue?.toLocaleString() || '0'}`} icon={<TrendingUp />} color="emerald" />
            <StatCard title={t('overdue')} value={stats?.overdueRentals?.toString() || '0'} icon={<AlertCircle />} color="rose" />
          </div>
        </section>

        {/* Quick Access Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <QuickAction 
            title={t('rentals')} 
            desc="Manage orders, pickups & returns" 
            href="/rentals"
            icon={<Calendar className="text-blue-600" />}
            bgColor="bg-blue-50"
            borderColor="border-blue-100"
          />
          <QuickAction 
            title={t('sales')} 
            desc="Direct sales and POS terminal" 
            href="/sales/history"
            icon={<ShoppingCart className="text-indigo-600" />}
            bgColor="bg-indigo-50"
            borderColor="border-indigo-100"
          />
          <QuickAction 
            title={t('inventory')} 
            desc="Stock levels and product settings" 
            href="/products"
            icon={<Package className="text-amber-600" />}
            bgColor="bg-amber-50"
            borderColor="border-amber-100"
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
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">Loading...</td></tr>
                ) : combinedActivity.length === 0 ? (
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
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-600 shadow-blue-200',
    indigo: 'bg-indigo-600 shadow-indigo-200',
    emerald: 'bg-emerald-600 shadow-emerald-200',
    rose: 'bg-rose-600 shadow-rose-200'
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl text-white ${colors[color]} shadow-lg`}>
          {React.cloneElement(icon as React.ReactElement<any>, { size: 24 })}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ title, desc, href, icon, bgColor, borderColor }: any) {
  return (
    <Link href={href} className={`block p-6 ${bgColor} border ${borderColor} rounded-2xl hover:scale-[1.02] transition-all group shadow-sm`}>
      <div className="flex flex-col gap-4">
        <div className="bg-white p-3 rounded-xl w-fit shadow-sm group-hover:shadow-md transition-all">
          {React.cloneElement(icon as React.ReactElement<any>, { size: 28 })}
        </div>
        <div>
          <h3 className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
