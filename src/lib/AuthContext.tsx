'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  username: string;
  email?: string | null;
  name: string;
  role: 'ADMIN' | 'SUPER' | 'USER';
  /** Work session opened at login, closed on sign out. */
  sessionId?: string;
  canManageVendors?: boolean;
  language?: 'en' | 'hi';
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
  logout: (reason?: 'MANUAL' | 'CASHBOOK') => void;
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

  // While the app is open it says so every couple of minutes. If those stop —
  // window closed, machine asleep, power gone — the server closes the session
  // at the last heartbeat instead of leaving it open forever.
  useEffect(() => {
    const sessionId = user?.sessionId;
    if (!sessionId) return;

    // On load, check in. A refresh will have closed the session via pagehide,
    // in which case the server opens a fresh one and hands back its id.
    let currentId = sessionId;
    fetch('/api/work-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resume', sessionId, userId: user?.id }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(res => {
        if (!res?.sessionId || res.sessionId === currentId) return;
        currentId = res.sessionId;
        setUser(prev => {
          if (!prev) return prev;
          const next = { ...prev, sessionId: res.sessionId };
          localStorage.setItem('jsh_user', JSON.stringify(next));
          return next;
        });
      })
      .catch(() => {
        /* tracking is best-effort and must never block the app */
      });

    const beat = () => {
      fetch('/api/work-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'heartbeat', sessionId: currentId }),
        keepalive: true,
      }).catch(() => {
        /* a missed beat is fine; the next one covers it */
      });
    };

    beat();
    const id = setInterval(beat, 2 * 60_000);

    // Closing the window is the common case and can be caught directly, which
    // is more accurate than waiting for the heartbeat to lapse. sendBeacon is
    // the only request guaranteed to survive the page going away.
    const onLeave = () => {
      const body = JSON.stringify({ action: 'close', sessionId: currentId, reason: 'CLOSED' });
      try {
        navigator.sendBeacon('/api/work-sessions', new Blob([body], { type: 'application/json' }));
      } catch {
        /* the heartbeat sweep will settle it instead */
      }
    };
    window.addEventListener('pagehide', onLeave);

    return () => {
      clearInterval(id);
      window.removeEventListener('pagehide', onLeave);
    };
  }, [user?.sessionId]);

  const logout = (reason: 'MANUAL' | 'CASHBOOK' = 'MANUAL') => {
    // Close the work session before clearing local state, so the logout time
    // is recorded even though the request is fire-and-forget.
    const sessionId = user?.sessionId;
    if (sessionId) {
      const body = JSON.stringify({ action: 'close', sessionId, reason });
      // keepalive lets it survive the navigation that follows.
      fetch('/api/work-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        /* hours are best-effort; never block signing out */
      });
    }
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
