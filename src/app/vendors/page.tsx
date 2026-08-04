'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, Lock } from 'lucide-react';
import VendorsPanel from '@/components/VendorsPanel';
import { useAuth } from '@/lib/AuthContext';

/**
 * Vendor register for a SUPER who has been granted vyapari access.
 *
 * Admins manage vendors inside /admin, but that panel is admin-only, so this
 * route exists for the supers an admin has explicitly given the permission to.
 */
export default function VendorsPage() {
  const { canManageVendors, loading } = useAuth();

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
              <Building2 size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Vyapari (Vendors)</h1>
              <p className="text-xs text-slate-500 font-medium">Bulk buyers, their orders and dues</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {loading ? (
          <p className="text-sm font-semibold text-slate-400 py-12 text-center">Checking access…</p>
        ) : canManageVendors ? (
          <VendorsPanel />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <Lock size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-700">You do not have vyapari access</p>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Ask an admin to grant it from Admin → Users.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
