'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import {
  Clock,
  LogIn,
  LogOut,
  Wallet,
  ShoppingCart,
  CalendarPlus,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { fetcher } from '@/lib/data';

/** Minutes as "7h 20m", which reads faster than a decimal for a shift. */
const asHours = (minutes: number) => {
  const m = Math.round(minutes || 0);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

const clock = (v?: string | Date | null) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : format(d, 'HH:mm');
};

const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : format(d, 'EEE, MM/dd/yyyy');
};

const ICON: Record<string, { icon: React.ReactNode; tone: string }> = {
  LOGIN: { icon: <LogIn size={13} />, tone: 'text-emerald-600' },
  LOGOUT: { icon: <LogOut size={13} />, tone: 'text-slate-400' },
  RENTAL: { icon: <CalendarPlus size={13} />, tone: 'text-blue-600' },
  SALE: { icon: <ShoppingCart size={13} />, tone: 'text-emerald-600' },
  READY: { icon: <CheckCircle2 size={13} />, tone: 'text-amber-600' },
  CASHBOOK: { icon: <Wallet size={13} />, tone: 'text-violet-600' },
};

/** The day's activity for one person, loaded only when the row is opened. */
function DayActivity({ userId, date }: { userId: string; date: string }) {
  const { data, isLoading } = useSWR(`/api/work-sessions?userId=${userId}&date=${date}`, fetcher);
  const events: any[] = data?.events ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-5 py-3 text-slate-400">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-[11px] font-bold">Loading…</span>
      </div>
    );
  }

  if (!events.length) {
    return (
      <p className="px-5 py-3 text-[11px] font-semibold text-slate-400">
        Nothing recorded for this day beyond signing in.
      </p>
    );
  }

  return (
    <div className="px-5 py-2">
      {events.map((e, i) => {
        const meta = ICON[e.kind] ?? { icon: <Clock size={13} />, tone: 'text-slate-400' };
        return (
          <div key={i} className="flex items-start gap-3 py-1.5">
            <span className="text-[11px] font-mono font-bold text-slate-400 w-11 shrink-0 pt-0.5">
              {clock(e.at)}
            </span>
            <span className={`shrink-0 pt-0.5 ${meta.tone}`}>{meta.icon}</span>
            <span className="min-w-0">
              <span className="text-[11px] font-bold text-slate-700">{e.label}</span>
              {e.detail && (
                <span className="ml-2 text-[11px] font-medium text-slate-400">{e.detail}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Working hours, one row per person per day.
 *
 * The shift is the day's first login to its last sign-out — stepping away and
 * signing back in does not shorten the day worked, so summing individual
 * sessions would understate it. A day still open reports no hours rather than
 * a guessed figure.
 */
export default function WorkingHoursPanel() {
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useSWR('/api/work-sessions?days=30', fetcher, { keepPreviousData: true });

  const rows: any[] = Array.isArray(data?.rows) ? data.rows : [];

  // Group by day so the newest day reads as a block rather than a flat list.
  const byDate = rows.reduce<Record<string, any[]>>((acc, r) => {
    (acc[r.date] ||= []).push(r);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Clock size={16} className="text-indigo-600" /> Working hours
          </h2>
          <span className="text-[11px] font-bold text-slate-400">
            {isLoading ? 'Loading…' : `last 30 days · ${rows.length} days worked`}
          </span>
        </div>

        {dates.length === 0 && !isLoading ? (
          <p className="p-8 text-center text-slate-400 font-medium text-sm">No logins recorded yet.</p>
        ) : (
          dates.map(date => (
            <div key={date}>
              <div className="px-4 py-2 bg-slate-50/80 border-y border-slate-100">
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  {dayLabel(date)}
                </p>
              </div>

              {byDate[date].map(r => {
                const isOpen = open === r.key;
                return (
                  <div key={r.key} className="border-b border-slate-100 last:border-0">
                    <button
                      onClick={() => setOpen(isOpen ? null : r.key)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50/70 transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {r.name}
                          <span className="ml-2 text-[11px] font-mono font-normal text-slate-400">
                            @{r.username}
                          </span>
                          {r.open && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700">
                              ON SHIFT
                            </span>
                          )}
                          {r.overnight && (
                            <span
                              className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-700"
                              title="Signed out the next day — the browser was left open, so this is not a shift length"
                            >
                              LEFT OPEN
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                          {r.role} · {r.sessionCount} session{r.sessionCount === 1 ? '' : 's'}
                        </p>
                      </div>

                      <div className="hidden sm:flex items-center gap-6 shrink-0 text-center">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">In</p>
                          <p className="text-xs font-bold text-emerald-600">{clock(r.firstLogin)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Out</p>
                          <p className="text-xs font-bold text-slate-600">{clock(r.lastLogout)}</p>
                        </div>
                      </div>

                      <div className="w-20 text-right shrink-0">
                        <p className="text-sm font-black text-indigo-600">
                          {r.open || r.overnight ? '—' : asHours(r.minutes)}
                        </p>
                        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">
                          {isOpen ? 'hide' : 'activity'}
                        </p>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="bg-slate-50/60 border-t border-slate-100">
                        <DayActivity userId={r.userId} date={r.date} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <p className="text-[11px] font-semibold text-slate-400">
        A day runs from the first login to the last sign-out. Closing the cash book signs a user
        out, so that is normally their end of day. A day left open — a browser simply closed —
        shows as on shift and reports no hours, since inventing a sign-out time would overstate
        them. A day marked LEFT OPEN was signed out the following day, so its span is not a shift
        length either. Click a row to see what that person did.
      </p>
    </div>
  );
}
