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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import DateInput from '@/components/DateInput';
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

const isoDay = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const shiftDay = (iso: string, by: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + by);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

/** "Today" and "Yesterday" read faster than a date when that is what it is. */
const dayLabel = (iso: string) => {
  if (iso === isoDay(0)) return 'Today';
  if (iso === isoDay(1)) return 'Yesterday';
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : format(d, 'EEEE, dd/MM/yyyy');
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
              {e.detail && <span className="ml-2 text-[11px] font-medium text-slate-400">{e.detail}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Working hours for one day at a time.
 *
 * A month of rows answered "who worked recently"; the question actually asked
 * is "who worked today, and until when" — so the day is the unit, and the view
 * shows one at a time.
 *
 * The shift runs from the day's first login to its last sign-out: stepping
 * away and back does not shorten the day worked, so summing sessions would
 * understate it.
 */
export default function WorkingHoursPanel() {
  const [open, setOpen] = useState<string | null>(null);
  const [date, setDate] = useState(isoDay(0));

  const { data, isLoading } = useSWR(`/api/work-sessions?date=${date}`, fetcher, {
    keepPreviousData: true,
  });

  const rows: any[] = Array.isArray(data?.rows) ? data.rows : [];
  const isToday = date === isoDay(0);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Clock size={16} className="text-indigo-600" /> Working hours
          </h2>
          <span className="text-[11px] font-bold text-slate-400">
            {isLoading ? 'Loading…' : `${rows.length} staff worked`}
          </span>
        </div>

        {/* One day at a time — step with the arrows or pick a date. */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setDate(d => shiftDay(d, -1))}
            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
            title="Previous day"
          >
            <ChevronLeft size={15} />
          </button>

          <p className="px-2 text-sm font-black text-slate-800 min-w-[160px] text-center">
            {dayLabel(date)}
          </p>

          <button
            onClick={() => setDate(d => shiftDay(d, 1))}
            disabled={isToday}
            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100"
            title="Next day"
          >
            <ChevronRight size={15} />
          </button>

          <div className="flex gap-2 ml-1">
            {[
              { label: 'Today', days: 0 },
              { label: 'Yesterday', days: 1 },
            ].map(q => {
              const target = isoDay(q.days);
              return (
                <button
                  key={q.label}
                  onClick={() => setDate(target)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                    date === target
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
          </div>

          <DateInput
            value={date}
            onChange={setDate}
            className="ml-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-xs font-bold w-36"
          />
        </div>

        {rows.length === 0 && !isLoading ? (
          <p className="p-10 text-center text-slate-400 font-medium text-sm">
            Nobody logged in on this day.
          </p>
        ) : (
          rows.map(r => {
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
                          title="Signed out the next day — the app was left open, so this is not a shift length"
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
          })
        )}
      </div>

      <p className="text-[11px] font-semibold text-slate-400">
        A day runs from the first login to the last sign-out. Closing the cash book signs a user
        out, so that is normally their end of day. A day still open shows as on shift and reports
        no hours; one marked LEFT OPEN was signed out the following day, so its span is not a
        shift length either. Click a row to see what that person did.
      </p>
    </div>
  );
}
