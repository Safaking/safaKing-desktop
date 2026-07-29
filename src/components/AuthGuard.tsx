'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // If user is not logged in and not on /login page, redirect to /login
      if (!user && pathname !== '/login') {
        router.replace('/login');
      }
      // If user is logged in and tries to visit /login page, redirect to home /
      else if (user && pathname === '/login') {
        router.replace('/');
      }
      // If employee tries to visit /admin, redirect to home /
      else if (user && pathname.startsWith('/admin') && user.role === 'EMPLOYEE') {
        router.replace('/');
      }
    }
  }, [user, loading, pathname, router]);

  // While checking auth state, render a styled loading screen
  if (loading && pathname !== '/login') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white font-medium">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-300 font-semibold">Verifying session...</p>
        </div>
      </div>
    );
  }

  // Prevent flash of protected content before redirect
  if (!loading && !user && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}
