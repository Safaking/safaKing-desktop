/**
 * Click-to-send WhatsApp messages, the way the website's admin panel has
 * them: the message is written for you, you read it, and you press send.
 *
 * Nothing is sent automatically and nothing is charged — it opens WhatsApp
 * with the message already typed, on whatever account is signed in on this
 * computer. That is why it needs no API, no approval and no per-message fee.
 *
 * In the desktop app the link is handed to Windows, which opens WhatsApp
 * Desktop (see electron/main.js).
 */

import type { Language } from '@/lib/translations';

/** Indian numbers are stored every which way; WhatsApp wants digits with a country code. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  // 0XXXXXXXXXX — the trunk zero is not part of the number.
  else if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits;
  else if (digits.length < 10) return null;
  return digits;
}

export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const number = whatsappNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export interface MessageSubject {
  customerName: string;
  orderNumber: string;
  /** Rupees still to pay, if any. */
  remaining?: number;
  startDate?: string;
  endDate?: string;
  pickupDate?: string;
}

export interface WhatsAppDraft {
  id: string;
  label: { en: string; hi: string };
  body: (subject: MessageSubject, language: Language) => string;
}

const SHOP = 'Joshi Safa House';

const money = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`;

const day = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/** Each one is a complete message; staff can edit it in WhatsApp before sending. */
export const DRAFTS: WhatsAppDraft[] = [
  {
    id: 'ready',
    label: { en: 'Order is ready', hi: 'ऑर्डर तैयार है' },
    body: ({ customerName, orderNumber }, language) =>
      language === 'hi'
        ? `नमस्ते ${customerName} जी, आपका ऑर्डर ${orderNumber} तैयार है। आप इसे दुकान से ले जा सकते हैं। — ${SHOP}`
        : `Namaste ${customerName}, your order ${orderNumber} is ready and can be collected from the shop. — ${SHOP}`,
  },
  {
    id: 'pickup',
    label: { en: 'Collection reminder', hi: 'लेने आने की याद' },
    body: ({ customerName, orderNumber, pickupDate, startDate }, language) => {
      const when = day(pickupDate) || day(startDate);
      return language === 'hi'
        ? `नमस्ते ${customerName} जी, आपका ऑर्डर ${orderNumber}${when ? ` ${when} को` : ''} लेने आना है। तैयार रखा है। — ${SHOP}`
        : `Namaste ${customerName}, a reminder that order ${orderNumber} is to be collected${when ? ` on ${when}` : ''}. It is ready and waiting. — ${SHOP}`;
    },
  },
  {
    id: 'balance',
    label: { en: 'Balance to pay', hi: 'बाकी रकम' },
    body: ({ customerName, orderNumber, remaining }, language) =>
      language === 'hi'
        ? `नमस्ते ${customerName} जी, ऑर्डर ${orderNumber} पर ${remaining ? money(remaining) : 'बाकी रकम'} बाकी है। सामान लेते समय दे दीजिए। धन्यवाद। — ${SHOP}`
        : `Namaste ${customerName}, ${remaining ? money(remaining) : 'a balance'} is still due on order ${orderNumber}. It can be paid at collection. Thank you. — ${SHOP}`,
  },
  {
    id: 'return',
    label: { en: 'Return reminder', hi: 'वापसी की याद' },
    body: ({ customerName, orderNumber, endDate }, language) => {
      const when = day(endDate);
      return language === 'hi'
        ? `नमस्ते ${customerName} जी, ऑर्डर ${orderNumber} का सामान${when ? ` ${when} तक` : ''} वापस करना है। समय पर लौटाने पर डिपॉज़िट पूरा वापस मिल जाता है। — ${SHOP}`
        : `Namaste ${customerName}, the items on order ${orderNumber} are due back${when ? ` by ${when}` : ''}. Returning on time means the full deposit comes back. — ${SHOP}`;
    },
  },
  {
    id: 'overdue',
    label: { en: 'Overdue — please return', hi: 'तारीख निकल गई' },
    body: ({ customerName, orderNumber, endDate }, language) => {
      const when = day(endDate);
      return language === 'hi'
        ? `नमस्ते ${customerName} जी, ऑर्डर ${orderNumber} की वापसी की तारीख${when ? ` (${when})` : ''} निकल चुकी है। कृपया जल्दी लौटा दीजिए या हमें बता दीजिए। — ${SHOP}`
        : `Namaste ${customerName}, order ${orderNumber} was due back${when ? ` on ${when}` : ''}. Please return it soon, or let us know. — ${SHOP}`;
    },
  },
  {
    id: 'thanks',
    label: { en: 'Thank you', hi: 'धन्यवाद' },
    body: ({ customerName, orderNumber }, language) =>
      language === 'hi'
        ? `धन्यवाद ${customerName} जी! ऑर्डर ${orderNumber} पूरा हुआ। आपकी शादी की शुभकामनाएँ — फिर सेवा का मौका दीजिएगा। — ${SHOP}`
        : `Thank you ${customerName}! Order ${orderNumber} is complete. Our best wishes for the wedding — we hope to serve you again. — ${SHOP}`,
  },
];
