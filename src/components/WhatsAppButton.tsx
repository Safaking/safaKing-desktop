'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { DRAFTS, MessageSubject, whatsappLink } from '@/lib/whatsapp';

/**
 * Sends a customer a WhatsApp message in one click, the way the website's
 * admin panel does it: pick what you want to say, WhatsApp opens with the
 * message already written, and you press send.
 *
 * Free, because it is your own WhatsApp doing the sending — no API, no
 * approval, no per-message charge. Nothing leaves this computer until the
 * person at the counter presses send.
 */
export function WhatsAppButton({
  phone,
  subject,
  compact = false,
}: {
  phone: string | null | undefined;
  subject: MessageSubject;
  /** Icon only, for a crowded row of buttons. */
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  // No number on the order — nothing to send to.
  if (!whatsappLink(phone, 'x')) return null;

  const send = (message: string) => {
    const url = whatsappLink(phone, message);
    if (!url) return;
    setOpen(false);
    // In the desktop app this is handed to Windows, which opens WhatsApp
    // Desktop; in a browser it opens web.whatsapp.com.
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div ref={boxRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        title={language === 'hi' ? 'WhatsApp पर भेजें' : 'Send on WhatsApp'}
        className={
          compact
            ? 'p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors'
            : 'px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm'
        }
      >
        <MessageCircle size={compact ? 18 : 13} />
        {!compact && (language === 'hi' ? 'WhatsApp' : 'WhatsApp')}
        {!compact && <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'hi' ? 'क्या भेजना है?' : 'What do you want to say?'}
          </p>
          {DRAFTS.map((draft) => (
            <button
              key={draft.id}
              type="button"
              onClick={() => send(draft.body(subject, language))}
              className="block w-full px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              {language === 'hi' ? draft.label.hi : draft.label.en}
            </button>
          ))}
          <button
            type="button"
            onClick={() => send('')}
            className="block w-full border-t border-slate-100 px-3 py-2.5 text-left text-[11px] font-semibold text-slate-400 hover:bg-slate-50"
          >
            {language === 'hi' ? 'बिना संदेश, बस चैट खोलें' : 'Just open the chat'}
          </button>
        </div>
      )}
    </div>
  );
}
