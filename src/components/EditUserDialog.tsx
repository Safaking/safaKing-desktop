'use client';

import React from 'react';
import { X, ShieldCheck, KeyRound, Check } from 'lucide-react';

interface Props {
  user: any | null;
  stores: any[];
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Admin-only editor for an existing user: change the login id, reset the
 * password, move them between roles/stores, and grant a SUPER access to the
 * vendor register.
 *
 * Leaving the password blank keeps the current one — resetting is a deliberate
 * act, not a side effect of editing a name.
 */
export default function EditUserDialog({ user, stores, onClose, onSuccess }: Props) {
  const [username, setUsername] = React.useState('');
  const [name, setName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<'ADMIN' | 'SUPER' | 'USER'>('USER');
  const [storeId, setStoreId] = React.useState('');
  const [canManageVendors, setCanManageVendors] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    setUsername(user.username || '');
    setName(user.name || '');
    setPassword('');
    setRole(user.role || 'USER');
    setStoreId(user.storeId || '');
    setCanManageVendors(!!user.canManageVendors);
  }, [user]);

  if (!user) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          username,
          name,
          // Blank password means leave it unchanged.
          ...(password.trim() ? { password } : {}),
          role,
          storeId: storeId || null,
          canManageVendors,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        alert(data.error || 'Failed to update user');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck size={20} className="text-indigo-600" /> Edit User
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={save} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Full Name</label>
              <input
                required
                type="text"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Login ID</label>
              <input
                required
                type="text"
                autoComplete="off"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-mono"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                <span className="inline-flex items-center gap-1">
                  <KeyRound size={12} /> New Password
                </span>
              </label>
              <input
                type="text"
                autoComplete="new-password"
                placeholder="Leave blank to keep current password"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-mono"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-indigo-50/50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-indigo-900"
              >
                <option value="ADMIN">ADMIN (Full control)</option>
                <option value="SUPER">SUPER (Cash book, artists)</option>
                <option value="USER">USER (POS & bookings)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Store</label>
              <select
                value={storeId}
                onChange={e => setStoreId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium"
              >
                <option value="">{role === 'ADMIN' ? 'All stores' : '-- Select store --'}</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.location || 'Main'})
                  </option>
                ))}
              </select>
            </div>

            {role === 'SUPER' && (
              <button
                type="button"
                onClick={() => setCanManageVendors(v => !v)}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl border transition-all ${
                  canManageVendors ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="text-left">
                  <span className="block text-xs font-bold text-slate-800">Vyapari (vendor) access</span>
                  <span className="block text-[11px] font-semibold text-slate-500">
                    Let this super manage the vendor register
                  </span>
                </span>
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    canManageVendors
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'bg-white border-slate-300 text-transparent'
                  }`}
                >
                  <Check size={13} strokeWidth={4} />
                </span>
              </button>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-100 p-5 flex flex-col gap-2">
            <button
              type="submit"
              disabled={saving || !username.trim() || !name.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-bold text-sm transition-all"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full text-slate-500 font-medium py-1 hover:text-slate-700 transition-colors text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
