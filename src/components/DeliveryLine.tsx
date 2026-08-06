'use client';

import React from 'react';
import { Truck } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Who is collecting the order and when, shown on the order lists.
 *
 * The counter needs this at a glance — the person who turns up is often not
 * the customer whose name is on the booking, and staff were opening each order
 * to find out. Renders nothing when nothing has been recorded, so rows that
 * have no collection detail stay quiet rather than showing empty labels.
 *
 * pickupDate is a plain string: bookings activated at the counter store a full
 * timestamp, the sale form stores yyyy-mm-dd. Both are shown as mm/dd/yyyy.
 */
export default function DeliveryLine({ order }: { order: any }) {
  const { t } = useLanguage();

  const name = order?.pickupName?.trim?.() || '';
  const phone = order?.pickupPhone?.trim?.() || '';
  const raw = order?.pickupDate || '';

  if (!name && !phone && !raw) return null;

  const parsed = raw ? new Date(raw) : null;
  const date =
    parsed && !isNaN(parsed.getTime())
      ? `${String(parsed.getMonth() + 1).padStart(2, '0')}/${String(parsed.getDate()).padStart(2, '0')}/${parsed.getFullYear()}`
      : raw;

  return (
    <p className="mt-1 flex items-start gap-1.5 text-[11px] font-semibold text-slate-500">
      <Truck size={12} className="mt-0.5 shrink-0 text-slate-400" />
      <span className="min-w-0">
        <span className="text-slate-600">{name || t('collected_by')}</span>
        {phone && <span className="text-slate-400"> · {phone}</span>}
        {date && (
          <span className="block text-slate-400">
            {t('collection_on')} {date}
          </span>
        )}
      </span>
    </p>
  );
}
