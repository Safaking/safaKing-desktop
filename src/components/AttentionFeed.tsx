'use client';

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { format } from 'date-fns';
import { AlertCircle, Clock, CalendarDays, Palette, CheckCircle2, ChevronRight } from 'lucide-react';
import { fetcher } from '@/lib/data';
import { useLanguage } from '@/lib/LanguageContext';

const money = (n?: number | null) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const day = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : format(d, 'MM/dd');
};

/** Whole days between today and a date — negative means it is already past. */
const daysAway = (v?: string | null) => {
  if (!v) return 0;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const d = new Date(v);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
};

type Tone = 'rose' | 'amber' | 'blue' | 'violet';

const TONE: Record<Tone, { chip: string; bar: string; icon: string; ring: string }> = {
  rose: { chip: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500', icon: 'text-rose-600', ring: 'border-rose-100' },
  amber: { chip: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', icon: 'text-amber-600', ring: 'border-amber-100' },
  blue: { chip: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500', icon: 'text-blue-600', ring: 'border-blue-100' },
  violet: { chip: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500', icon: 'text-violet-600', ring: 'border-violet-100' },
};

function Group({
  title,
  subtitle,
  tone,
  icon,
  items,
  renderMeta,
}: {
  title: string;
  subtitle: string;
  tone: Tone;
  icon: React.ReactNode;
  items: any[];
  renderMeta: (r: any) => React.ReactNode;
}) {
  const t = TONE[tone];
  if (!items?.length) return null;

  return (
    <div className={`bg-white border ${t.ring} rounded-2xl overflow-hidden shadow-xs`}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <span className={`w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center ${t.icon}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-800 leading-tight">{title}</p>
          <p className="text-[11px] font-semibold text-slate-400">{subtitle}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${t.chip}`}>{items.length}</span>
      </div>

      <div>
        {items.map(r => (
          <Link
            key={r.id}
            href="/rentals"
            className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition-colors group"
          >
            <span className={`w-1 h-8 rounded-full ${t.bar} shrink-0`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-slate-800 truncate">
                {r.customerName}
                <span className="ml-2 font-mono text-[10px] font-bold text-slate-400">{r.orderNumber}</span>
              </p>
              <p className="text-[11px] font-semibold text-slate-500 truncate">{renderMeta(r)}</p>
            </div>
            <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * What still needs doing, replacing the list of recent orders.
 *
 * Recent activity was a record of what had already happened, which nobody
 * needed to act on. These four groups are the things that go wrong if they
 * are missed: overdue returns, orders going out unpacked, and tying booked
 * with nobody assigned to do it.
 */
export default function AttentionFeed() {
  const { t } = useLanguage();
  const { data, isLoading } = useSWR('/api/dashboard/attention', fetcher, {
    keepPreviousData: true,
    refreshInterval: 60_000,
  });

  const overdue: any[] = data?.overdue ?? [];
  const dueToday: any[] = data?.dueToday ?? [];
  const upcoming: any[] = data?.upcoming ?? [];
  const unallocated: any[] = data?.unallocated ?? [];
  const total = overdue.length + dueToday.length + upcoming.length + unallocated.length;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-black text-slate-800">{t('needs_attention')}</h3>
          <p className="text-xs font-semibold text-slate-500">{t('needs_attention_sub')}</p>
        </div>
        <Link
          href="/rentals"
          className="text-xs font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
        >
          {t('all_orders')} <ChevronRight size={14} />
        </Link>
      </div>

      {isLoading && total === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-xs font-bold text-slate-400">{t('loading')}</p>
        </div>
      ) : total === 0 ? (
        <div className="bg-white border border-emerald-100 rounded-2xl p-10 text-center">
          <CheckCircle2 size={28} className="text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-black text-slate-800">{t('nothing_pending')}</p>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">{t('nothing_pending_sub')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Group
            title={t('attn_overdue')}
            subtitle={t('attn_overdue_sub')}
            tone="rose"
            icon={<AlertCircle size={16} />}
            items={overdue}
            renderMeta={r => {
              const late = Math.abs(daysAway(r.endDate));
              return `${late} day${late === 1 ? '' : 's'} late · due ${day(r.endDate)} · ${r.itemCount} safa${
                r.itemCount === 1 ? '' : 's'
              }${r.remainingAmount > 0 ? ` · ${money(r.remainingAmount)} due` : ''}`;
            }}
          />

          <Group
            title={t('attn_today')}
            subtitle={t('attn_today_sub')}
            tone="amber"
            icon={<Clock size={16} />}
            items={dueToday}
            renderMeta={r =>
              `${r.itemCount} safa${r.itemCount === 1 ? '' : 's'}${
                r.tieSafa ? ` · tying ${r.safaTyingCount}` : ''
              }${r.safaTyingTime ? ` at ${r.safaTyingTime}` : ''}`
            }
          />

          <Group
            title={t('attn_week')}
            subtitle={t('attn_week_sub')}
            tone="blue"
            icon={<CalendarDays size={16} />}
            items={upcoming}
            renderMeta={r => {
              const away = daysAway(r.startDate);
              return `${away === 1 ? 'tomorrow' : `in ${away} days`} · ${day(r.startDate)} · ${
                r.itemCount
              } safa${r.itemCount === 1 ? '' : 's'}`;
            }}
          />

          <Group
            title={t('attn_artist')}
            subtitle={t('attn_artist_sub')}
            tone="violet"
            icon={<Palette size={16} />}
            items={unallocated}
            renderMeta={r => {
              const away = daysAway(r.startDate);
              return `${r.safaTyingCount} safa${r.safaTyingCount === 1 ? '' : 's'} to tie · ${
                away <= 0 ? 'today' : away === 1 ? 'tomorrow' : `in ${away} days`
              }${r.safaTyingTime ? ` at ${r.safaTyingTime}` : ''}`;
            }}
          />
        </div>
      )}
    </section>
  );
}
