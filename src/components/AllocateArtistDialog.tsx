'use client';

import React from 'react';
import { X, Palette, IndianRupee, Check } from 'lucide-react';
import { useArtists, invalidateAfterArtistChange } from '@/lib/data';
import { useAuth } from '@/lib/AuthContext';

interface Props {
  rental: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Allocate a registered artist to a tying order, with their per-safa rate.
 * Only reachable by admins and owners — the rentals list gates the entry point.
 */
export default function AllocateArtistDialog({ rental, onClose, onSuccess }: Props) {
  const { user, isAdmin } = useAuth();
  const { data: artistData } = useArtists();
  const artists: any[] = Array.isArray(artistData) ? artistData : [];

  const [artistId, setArtistId] = React.useState('');
  const [rate, setRate] = React.useState('0');
  const [paid, setPaid] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!rental) return;
    setArtistId(rental.artistId || '');
    setRate((rental.artistRate ?? 0).toString());
    setPaid(!!rental.artistPaid);
  }, [rental]);

  if (!rental) return null;

  const selectable = artists.filter(a => a.isActive || a.id === rental.artistId);

  // The rate is per safa, so the amount owed follows the tied count.
  const safas = rental.safaTyingCount || 0;
  const owed = (parseFloat(rate || '0') || 0) * safas;

  // Picking an artist pulls in their usual rate, unless this order already
  // carries one an admin set deliberately.
  React.useEffect(() => {
    if (!artistId) return;
    if (rental.artistId === artistId && (rental.artistRate ?? 0) > 0) return;
    const picked = artists.find(a => a.id === artistId);
    if (picked) setRate((picked.ratePerPiece ?? 0).toString());
  }, [artistId, artists, rental]);

  const save = async (clear = false) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/rentals/${rental.id}/artist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          clear
            ? { artistId: null, role: user?.role }
            : {
                artistId: artistId || null,
                artistRate: parseFloat(rate || '0') || 0,
                artistPaid: paid,
                role: user?.role,
              }
        ),
      });
      if (res.ok) {
        await invalidateAfterArtistChange();
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to allocate artist');
      }
    } catch (err: any) {
      alert(err.message || 'Error allocating artist');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-violet-50/50 shrink-0">
          <h3 className="font-bold text-violet-900 flex items-center gap-2">
            <Palette size={20} className="text-violet-600" /> Allocate Artist
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order</p>
            <p className="text-sm font-bold text-slate-800">
              {rental.orderNumber} • {rental.customerName}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              {rental.safaTyingCount || 0} safas to tie
              {rental.safaShape ? ` — ${rental.safaShape}` : ''}
            </p>
          </div>

          {selectable.length === 0 ? (
            <p className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-xl p-3">
              No artists registered yet. Add one under Admin → Artists first.
            </p>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Artist</label>
              <select
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-violet-500 font-bold text-sm"
                value={artistId}
                onChange={e => setArtistId(e.target.value)}
              >
                <option value="">Not allocated</option>
                {selectable.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.phone ? ` — ${a.phone}` : ''}
                    {a.isActive ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Rate per safa
            </label>
            <div className="relative">
              <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                min="0"
                step="1"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-violet-500 font-bold text-sm"
                value={rate}
                onChange={e => setRate(e.target.value)}
                disabled={!artistId || !isAdmin}
              />
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">
              ₹{parseFloat(rate || '0') || 0} × {safas} safa{safas === 1 ? '' : 's'} ={' '}
              <span className="font-black text-violet-700">₹{owed.toFixed(2)}</span> owed
            </p>
          </div>

          <button
            type="button"
            onClick={() => setPaid(p => !p)}
            disabled={!artistId || !isAdmin}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all disabled:opacity-50 ${
              paid ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-xs font-bold text-slate-700">Already paid to artist</span>
            <span
              className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                paid ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-transparent'
              }`}
            >
              <Check size={13} strokeWidth={4} />
            </span>
          </button>

          {!isAdmin && (
            <p className="text-[11px] font-semibold text-slate-400">
              A super allocates the artist; only an admin changes the rate or marks it paid.
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 p-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => save(false)}
            disabled={saving}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-bold transition-all text-sm"
          >
            {saving ? 'Saving…' : 'Save Allocation'}
          </button>
          {rental.artistId && (
            <button
              type="button"
              onClick={() => save(true)}
              disabled={saving}
              className="w-full text-rose-500 font-bold py-2 hover:text-rose-600 transition-colors text-xs"
            >
              Remove allocation
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full text-slate-500 font-medium py-1 hover:text-slate-700 transition-colors text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
