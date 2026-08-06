'use client';

import React from 'react';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import { generateInvoicePDF } from '@/lib/invoice-gen';
import { useLanguage } from '@/lib/LanguageContext';

interface Props {
  order: any | null;
  type?: 'RENTAL' | 'SALE';
  onClose: () => void;
}

/**
 * Shows the bill before it is printed or saved.
 *
 * Staff previously had only Download and Print, so the only way to check a
 * bill was to save it and open it from the file manager. The PDF is rendered
 * to a blob and shown in an iframe, which is the same document the other two
 * buttons produce.
 */
export default function BillPreviewDialog({ order, type = 'RENTAL', onClose }: Props) {
  const { t } = useLanguage();
  const [url, setUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!order) {
      setUrl(null);
      setFailed(false);
      return;
    }

    let revoked: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const blobUrl = (await generateInvoicePDF(order, type, 'view')) as string;
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        revoked = blobUrl;
        setUrl(blobUrl);
      } catch (e) {
        console.error('Failed to build bill preview', e);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      // Blob URLs stay in memory until released, and a busy counter can open
      // a lot of bills in a day.
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [order, type]);

  React.useEffect(() => {
    if (!order) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [order, onClose]);

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-full max-w-3xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-900 truncate">
              {order.orderNumber}
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 truncate">{order.customerName}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => generateInvoicePDF(order, type, 'print')}
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5"
            >
              <Printer size={14} /> {t('print_bill')}
            </button>
            <button
              onClick={() => generateInvoicePDF(order, type, 'download')}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 flex items-center gap-1.5"
            >
              <Download size={14} /> {t('download_bill')}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-100">
          {failed ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
              <p className="text-sm font-bold text-slate-700">Could not build the bill preview.</p>
              <p className="text-xs font-semibold text-slate-500">
                Download still works — use the button above.
              </p>
            </div>
          ) : url ? (
            <iframe src={url} title={`Bill ${order.orderNumber}`} className="w-full h-full border-0" />
          ) : (
            <div className="h-full flex items-center justify-center gap-2 text-slate-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-xs font-bold">{t('loading')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
