'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  username: string;
  email?: string | null;
  name: string;
  role: 'ADMIN' | 'SUPER' | 'USER';
  canManageVendors?: boolean;
  storeId?: string | null;
  store?: {
    id: string;
    name: string;
  } | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => void;
  isAdmin: boolean;
  isSuperOrAdmin: boolean;
  /** Admin always; a SUPER only when granted the vendor permission. */
  canManageVendors: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  isAdmin: false,
  isSuperOrAdmin: false,
  canManageVendors: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('jsh_user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load user session', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('jsh_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('jsh_user');
  };

  const isAdmin = user?.role === 'ADMIN';
  const isSuperOrAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER';
  const canManageVendors = isAdmin || (user?.role === 'SUPER' && !!user?.canManageVendors);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isSuperOrAdmin, canManageVendors }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
