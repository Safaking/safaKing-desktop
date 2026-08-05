'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { Clock, LogIn, LogOut, Wallet } from 'lucide-react';
import DateInput from '@/components/DateInput';
import { fetcher } from '@/lib/data';

/** Minutes as "7h 20m", which reads faster than a decimal for a shift. */
const asHours = (minutes: number) => {
  const m = Math.round(minutes || 0);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

const isoDay = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const stamp = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : format(d, 'dd-MM-yy HH:mm');
};

/**
 * Staff working hours for a date range, from login to sign-out.
 *
 * A session with no sign-out is someone still on shift — those are shown as
 * "on shift" and contribute nothing to the total, because the app never sees
 * a browser simply being closed and guessing would inflate the hours.
 */
export default function WorkingHoursPanel() {
  const [from, setFrom] = useState(isoDay(7));
  const [to, setTo] = useState(isoDay(0));
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useSWR(`/api/work-sessions?from=${from}&to=${to}`, fetcher, {
    keepPreviousData: true,
  });

  const users: any[] = Array.isArray(data?.users) ? data.users : [];
  const sessions: any[] = Array.isArray(data?.sessions) ? data.sessions : [];

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">From</label>
          <DateInput
            value={from}
            onChange={setFrom}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold w-40"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">To</label>
          <DateInput
            value={to}
            onChange={setTo}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold w-40"
          />
        </div>
        <div className="flex gap-2">
          {[
            { label: 'Today', days: 0 },
            { label: '7 days', days: 7 },
            { label: '30 days', days: 30 },
          ].map(r => (
            <button
              key={r.label}
              onClick={() => {
                setFrom(isoDay(r.days));
                setTo(isoDay(0));
              }}
              className="px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Clock size={16} className="text-indigo-600" /> Working hours
          </h2>
          <span className="text-[11px] font-bold text-slate-400">
            {isLoading ? 'Loading…' : `${users.length} staff · ${sessions.length} sessions`}
          </span>
        </div>

        {users.length === 0 && !isLoading ? (
          <p className="p-8 text-center text-slate-400 font-medium text-sm">
            No logins in this date range.
          </p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[720px]">
            <thead className="bg-slate-50/70 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2">Staff</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2 text-right">Sessions</th>
                <th className="px-4 py-2">Last login</th>
                <th className="px-4 py-2">Last sign out</th>
                <th className="px-4 py-2 text-right">Total hours</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <React.Fragment key={u.userId}>
                  <tr
                    className="border-t border-slate-100 hover:bg-slate-50/50 cursor-pointer"
                    onClick={() => setExpanded(expanded === u.userId ? null : u.userId)}
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-slate-800">{u.name}</span>
                      <span className="ml-2 text-[11px] font-mono text-slate-400">@{u.username}</span>
                      {u.openCount > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700">
                          ON SHIFT
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] font-black text-slate-500">{u.role}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-600">{u.sessionCount}</td>
                    <td className="px-4 py-2.5 text-[11px] font-semibold text-slate-500">{stamp(u.lastLogin)}</td>
                    <td className="px-4 py-2.5 text-[11px] font-semibold text-slate-500">{stamp(u.lastLogout)}</td>
                    <td className="px-4 py-2.5 text-right font-black text-indigo-600">{asHours(u.totalMinutes)}</td>
                  </tr>

                  {expanded === u.userId &&
                    sessions
                      .filter(s => s.userId === u.userId)
                      .map(s => (
                        <tr key={s.id} className="bg-slate-50/60 border-t border-slate-100">
                          <td className="px-4 py-1.5 pl-8 text-[11px] font-semibold text-slate-500" colSpan={2}>
                            <LogIn size={11} className="inline mr-1 text-emerald-600" />
                            {stamp(s.loggedInAt)}
                          </td>
                          <td className="px-4 py-1.5 text-[11px] font-semibold text-slate-500" colSpan={2}>
                            {s.open ? (
                              <span className="text-amber-600 font-bold">still on shift</span>
                            ) : (
                              <>
                                <LogOut size={11} className="inline mr-1 text-slate-400" />
                                {stamp(s.loggedOutAt)}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-1.5 text-[11px] font-semibold text-slate-500">
                            {s.logoutReason === 'CASHBOOK' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <Wallet size={11} /> cash book closed
                              </span>
                            ) : s.logoutReason === 'MANUAL' ? (
                              'signed out'
                            ) : (
                              ''
                            )}
                          </td>
                          <td className="px-4 py-1.5 text-right text-[11px] font-bold text-slate-600">
                            {s.open ? '—' : asHours(s.minutes)}
                          </td>
                        </tr>
                      ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <p className="text-[11px] font-semibold text-slate-400">
        Hours count from login to sign out. Closing the cash book signs a user out, so that is
        normally their end of day. A session left open — a browser simply closed — shows as on
        shift and adds nothing to the total.
      </p>
    </div>
  );
}
