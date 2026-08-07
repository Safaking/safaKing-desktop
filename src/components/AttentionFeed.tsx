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
  return isNaN(d.getTime()) ? '' : format(d, 'dd/MM');
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

const TONE: Record<Tone, { chip: string; bar: string; icon: string; iconBg: string }> = {
  rose: { chip: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500', icon: 'text-rose-600', iconBg: 'bg-rose-50' },
  amber: { chip: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', icon: 'text-amber-600', iconBg: 'bg-amber-50' },
  blue: { chip: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500', icon: 'text-blue-600', iconBg: 'bg-blue-50' },
  violet: {
    chip: 'bg-violet-100 text-violet-700',
    bar: 'bg-violet-500',
    icon: 'text-violet-600',
    iconBg: 'bg-violet-50',
  },
};

/**
 * One attention group.
 *
 * Empty groups still render. A card that vanishes when it empties leaves a
 * hole in the grid and hides the fact that the check happened at all — an
 * empty one says so instead.
 */
function Group({
  title,
  subtitle,
  tone,
  icon,
  items,
  emptyLabel,
  renderMeta,
}: {
  title: string;
  subtitle: string;
  tone: Tone;
  icon: React.ReactNode;
  items: any[];
  emptyLabel: string;
  renderMeta: (r: any) => React.ReactNode;
}) {
  const c = TONE[tone];
  const empty = !items?.length;

  return (
    // Fixed height on purpose: a card that grows with its row count makes the
    // whole grid jump every time the data refreshes. Overflow scrolls inside.
    <div
      className={`bg-white border rounded-2xl overflow-hidden h-[340px] flex flex-col ${
        empty ? 'border-slate-100' : 'border-slate-200 shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3 px-5 py-4 shrink-0">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.iconBg} ${c.icon}`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-black leading-tight ${empty ? 'text-slate-400' : 'text-slate-800'}`}>
            {title}
          </p>
          <p className="text-[11px] font-medium text-slate-400 mt-0.5 leading-snug">{subtitle}</p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-lg text-xs font-black shrink-0 ${
            empty ? 'bg-slate-100 text-slate-400' : c.chip
          }`}
        >
          {items?.length ?? 0}
        </span>
      </div>

      {empty ? (
        <div className="flex-1 px-5 pb-5 pt-1 flex">
          <div className="flex-1 rounded-xl border border-dashed border-slate-200 flex items-center justify-center">
            <p className="text-[11px] font-bold text-slate-300">{emptyLabel}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto border-t border-slate-100">
          {items.map(r => (
            <Link
              key={r.id}
              href="/rentals"
              className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition-colors group"
            >
              <span className={`w-1 self-stretch min-h-[34px] rounded-full ${c.bar} shrink-0`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-bold text-slate-800 truncate">{r.customerName}</p>
                  <span className="font-mono text-[10px] font-bold text-slate-400 shrink-0">{r.orderNumber}</span>
                </div>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">{renderMeta(r)}</p>
              </div>
              <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * What still needs doing, in place of a list of recent orders.
 *
 * Recent activity recorded what had already happened, which nobody had to act
 * on. These four groups are the things that go wrong when missed: overdue
 * returns, orders going out unpacked, and tying booked with nobody assigned.
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

  /** "2 safas" / "1 safa", in whichever language is on. */
  const safas = (n: number) => `${n} ${n === 1 ? t('safa_one') : t('safas')}`;

  /** "tomorrow" / "in 5 days", reading naturally in both languages. */
  const when = (n: number) => {
    if (n <= 0) return t('today');
    if (n === 1) return t('tomorrow');
    return [t('in_days'), n, t('days')].filter(Boolean).join(' ');
  };

  return (
    <section>
      <div className="flex items-end justify-between mb-5 gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-black text-slate-800">{t('needs_attention')}</h3>
          <p className="text-xs font-medium text-slate-500 mt-0.5">{t('needs_attention_sub')}</p>
        </div>
        <Link
          href="/rentals"
          className="text-xs font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1 shrink-0"
        >
          {t('all_orders')} <ChevronRight size={14} />
        </Link>
      </div>

      {/* The four cards are always rendered. Swapping them for a single
          "all clear" panel when everything is empty was itself a layout jump,
          and each card already says it is empty. */}
      {total === 0 && !isLoading && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <p className="text-xs font-bold text-emerald-800">{t('nothing_pending')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Group
            title={t('attn_overdue')}
            subtitle={t('attn_overdue_sub')}
            tone="rose"
            icon={<AlertCircle size={17} />}
            items={overdue}
            emptyLabel={t('none_here')}
            renderMeta={r => {
              const late = Math.abs(daysAway(r.endDate));
              return [
                `${late} ${late === 1 ? t('day_late') : t('days_late')}`,
                `${t('due_on')} ${day(r.endDate)}`,
                safas(r.itemCount),
                r.remainingAmount > 0 ? `${money(r.remainingAmount)} ${t('due').toLowerCase()}` : '',
              ]
                .filter(Boolean)
                .join(' · ');
            }}
          />

          <Group
            title={t('attn_today')}
            subtitle={t('attn_today_sub')}
            tone="amber"
            icon={<Clock size={17} />}
            items={dueToday}
            emptyLabel={t('none_here')}
            renderMeta={r =>
              [
                safas(r.itemCount),
                r.tieSafa ? `${t('tying')} ${r.safaTyingCount}` : '',
                r.safaTyingTime ? `${t('at_time')} ${r.safaTyingTime}` : '',
              ]
                .filter(Boolean)
                .join(' · ')
            }
          />

          <Group
            title={t('attn_week')}
            subtitle={t('attn_week_sub')}
            tone="blue"
            icon={<CalendarDays size={17} />}
            items={upcoming}
            emptyLabel={t('none_here')}
            renderMeta={r =>
              [when(daysAway(r.startDate)), day(r.startDate), safas(r.itemCount)].filter(Boolean).join(' · ')
            }
          />

          <Group
            title={t('attn_artist')}
            subtitle={t('attn_artist_sub')}
            tone="violet"
            icon={<Palette size={17} />}
            items={unallocated}
            emptyLabel={t('none_here')}
            renderMeta={r =>
              [
                `${safas(r.safaTyingCount)} ${t('to_tie')}`,
                when(daysAway(r.startDate)),
                r.safaTyingTime ? `${t('at_time')} ${r.safaTyingTime}` : '',
              ]
                .filter(Boolean)
                .join(' · ')
            }
          />
        </div>
    </section>
  );
}
