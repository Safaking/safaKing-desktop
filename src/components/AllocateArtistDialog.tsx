'use client';

import React from 'react';
import { X, Palette, IndianRupee, Check, Plus, Trash2, Users } from 'lucide-react';
import { useArtists, invalidateAfterArtistChange } from '@/lib/data';
import { useAuth } from '@/lib/AuthContext';
import { baratiCount } from '@/lib/barati';

interface Props {
  rental: any | null;
  type?: 'RENTAL' | 'SALE';
  onClose: () => void;
  onSuccess: () => void;
}

type Row = {
  key: string;
  artistId: string;
  quantity: string;
  rate: string;
  paid: boolean;
};

let rowSeq = 0;
const newRow = (): Row => ({
  key: `r${(rowSeq += 1)}`,
  artistId: '',
  quantity: '',
  rate: '0',
  paid: false,
});

const num = (v: string) => {
  const n = parseFloat(v || '0');
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/**
 * Share one order's tying between artists.
 *
 * A hundred safas is more than one person ties before a baraat leaves, so the
 * job is split — forty to one, sixty to another — each at their own rate, each
 * settled separately. One artist is just a split of one.
 *
 * The split may add up to less than the order needs; that is a job still being
 * staffed and the dialog says how many are left. It may never add up to more,
 * or the shop would pay out for safas nobody tied.
 */
export default function AllocateArtistDialog({ rental, type = 'RENTAL', onClose, onSuccess }: Props) {
  const { user, isAdmin } = useAuth();
  const { data: artistData } = useArtists();
  const artists: any[] = Array.isArray(artistData) ? artistData : [];

  const [rows, setRows] = React.useState<Row[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  // Every hook runs on every render, so all of them sit above the early return
  // below. Placed after it, the closed dialog ran fewer hooks than the open one
  // and React aborted the whole page the moment Allocate was clicked.
  React.useEffect(() => {
    if (!rental) return;
    const existing = rental.tyingAssignments ?? [];
    setError('');
    setRows(
      existing.length
        ? existing.map((a: any) => ({
            key: `a${a.id}`,
            artistId: a.artistId,
            quantity: String(a.quantity ?? 0),
            rate: String(a.rate ?? 0),
            paid: !!a.paid,
          }))
        : [newRow()]
    );
  }, [rental]);

  if (!rental) return null;

  // Only the barati safas need artists sent out — the rest are tied at the
  // counter when the customer collects, so they are nobody's allocation.
  const required = baratiCount(rental);
  const assigned = rows.reduce((s, r) => s + (r.artistId ? num(r.quantity) : 0), 0);
  const left = required - assigned;
  const over = left < 0;

  const filled = rows.filter(r => r.artistId && num(r.quantity) > 0);
  const owed = filled.reduce((s, r) => s + num(r.rate) * num(r.quantity), 0);

  const update = (key: string, patch: Partial<Row>) =>
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));

  /**
   * Picking an artist fills in their usual rate and, on a fresh row, whatever
   * is still unstaffed — the common case being one artist taking the rest.
   */
  const pickArtist = (row: Row, artistId: string) => {
    const picked = artists.find(a => a.id === artistId);
    const others = rows.reduce(
      (s, r) => s + (r.key !== row.key && r.artistId ? num(r.quantity) : 0),
      0
    );
    update(row.key, {
      artistId,
      rate: picked ? String(picked.ratePerPiece ?? 0) : row.rate,
      quantity: num(row.quantity) > 0 ? row.quantity : String(Math.max(0, required - others)),
    });
  };

  const addRow = () => setRows(rs => [...rs, newRow()]);
  const removeRow = (key: string) =>
    setRows(rs => (rs.length === 1 ? [newRow()] : rs.filter(r => r.key !== key)));

  /** An artist already on another row must not be offered twice. */
  const optionsFor = (row: Row) => {
    const taken = new Set(rows.filter(r => r.key !== row.key).map(r => r.artistId).filter(Boolean));
    return artists.filter(
      a => !taken.has(a.id) && (a.isActive || a.id === row.artistId)
    );
  };

  const save = async (clear = false) => {
    if (!clear && over) {
      setError(`The split adds up to ${assigned} safas but the order only has ${required}.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const endpoint =
        type === 'SALE' ? `/api/sales/${rental.id}/artist` : `/api/rentals/${rental.id}/artist`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shares: clear
            ? []
            : filled.map(r => ({
                artistId: r.artistId,
                quantity: num(r.quantity),
                rate: num(r.rate),
                paid: r.paid,
              })),
          role: user?.role,
        }),
      });
      if (res.ok) {
        await invalidateAfterArtistChange();
        onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to allocate artist');
      }
    } catch (err: any) {
      setError(err.message || 'Error allocating artist');
    } finally {
      setSaving(false);
    }
  };

  const hasArtists = artists.some(a => a.isActive);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-violet-50/50 shrink-0">
          <h3 className="font-bold text-violet-900 flex items-center gap-2">
            <Palette size={20} className="text-violet-600" /> Allocate Artists
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
              {required} barati safa{required === 1 ? '' : 's'} to tie
              {(rental.safaTyingCount || 0) > required &&
                ` (of ${rental.safaTyingCount} on the order)`}
            </p>
            {/* Item 2: when and where, on the allocation screen itself. The
                artist is being booked for an hour on a day, and that was only
                visible by opening the order. */}
            {(rental.safaTyingDate || rental.safaTyingTime || rental.safaTyingAddress) && (
              <p className="text-[11px] font-bold text-violet-700 mt-1.5 flex flex-wrap gap-x-2">
                {rental.safaTyingDate && <span>{rental.safaTyingDate}</span>}
                {rental.safaTyingTime && <span>· {rental.safaTyingTime}</span>}
                {rental.safaTyingAddress && (
                  <span className="font-semibold text-slate-500">· {rental.safaTyingAddress}</span>
                )}
              </p>
            )}
          </div>

          {/* The running total is the whole point of the screen, so it sits
              above the rows rather than being worked out at the end. */}
          <div
            className={`rounded-xl border px-4 py-3 ${
              over
                ? 'bg-rose-50 border-rose-200'
                : left === 0
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <Users size={14} /> {assigned} of {required} allocated
              </span>
              <span
                className={`text-xs font-black ${
                  over ? 'text-rose-700' : left === 0 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {over
                  ? `${Math.abs(left)} too many`
                  : left === 0
                  ? 'Fully allocated'
                  : `${left} still to allocate`}
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/70 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  over ? 'bg-rose-500' : left === 0 ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${required ? Math.min(100, (assigned / required) * 100) : 0}%` }}
              />
            </div>
          </div>

          {!hasArtists && (
            <p className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-xl p-3">
              No artists registered yet. Add one under Admin → Artists first.
            </p>
          )}

          <div className="space-y-3">
            {rows.map((row, i) => {
              const rowOwed = num(row.rate) * num(row.quantity);
              return (
                <div
                  key={row.key}
                  className="rounded-xl border border-slate-200 p-3 space-y-2 bg-white"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-violet-100 text-violet-700 text-[11px] font-black flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <select
                      className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-violet-500 font-bold text-sm"
                      value={row.artistId}
                      onChange={e => pickArtist(row, e.target.value)}
                    >
                      <option value="">Choose artist…</option>
                      {optionsFor(row).map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.phone ? ` — ${a.phone}` : ''}
                          {a.isActive ? '' : ' (inactive)'}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 shrink-0"
                      title="Remove this artist"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="flex gap-2 pl-8">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Safas
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-violet-500 font-bold text-sm"
                        value={row.quantity}
                        onChange={e => update(row.key, { quantity: e.target.value })}
                        disabled={!row.artistId}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Rate / safa
                      </label>
                      <div className="relative">
                        <IndianRupee
                          size={13}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="w-full pl-7 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-violet-500 font-bold text-sm disabled:opacity-60"
                          value={row.rate}
                          onChange={e => update(row.key, { rate: e.target.value })}
                          disabled={!row.artistId || !isAdmin}
                        />
                      </div>
                    </div>
                  </div>

                  {row.artistId && (
                    <div className="flex items-center justify-between gap-2 pl-8">
                      <p className="text-[11px] font-semibold text-slate-500">
                        ₹{num(row.rate)} × {num(row.quantity)} ={' '}
                        <span className="font-black text-violet-700">₹{rowOwed.toFixed(2)}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => update(row.key, { paid: !row.paid })}
                        disabled={!isAdmin}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all disabled:opacity-50 ${
                          row.paid
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            row.paid
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-slate-300 text-transparent'
                          }`}
                        >
                          <Check size={11} strokeWidth={4} />
                        </span>
                        Paid
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addRow}
            disabled={!hasArtists}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-violet-300 text-violet-600 hover:bg-violet-50 font-bold text-xs disabled:opacity-40"
          >
            <Plus size={15} /> Add another artist
          </button>

          {filled.length > 1 && (
            <div className="flex items-baseline justify-between rounded-xl bg-violet-50 border border-violet-100 px-4 py-2.5">
              <span className="text-xs font-bold text-violet-900">
                {filled.length} artists · total owed
              </span>
              <span className="text-sm font-black text-violet-700">₹{owed.toFixed(2)}</span>
            </div>
          )}

          {error && (
            <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
              {error}
            </p>
          )}

          {!isAdmin && (
            <p className="text-[11px] font-semibold text-slate-400">
              A super sets who ties and how many; only an admin changes a rate or marks it paid.
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 p-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => save(false)}
            disabled={saving || over}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-bold transition-all text-sm"
          >
            {saving ? 'Saving…' : 'Save Allocation'}
          </button>
          {(rental.tyingAssignments ?? []).length > 0 && (
            <button
              type="button"
              onClick={() => save(true)}
              disabled={saving}
              className="w-full text-rose-500 font-bold py-2 hover:text-rose-600 transition-colors text-xs"
            >
              Remove all allocations
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
