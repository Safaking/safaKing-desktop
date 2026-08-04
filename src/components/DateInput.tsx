'use client';

import React from 'react';

/**
 * Date field with a fixed mm/dd/yyyy format.
 *
 * A native <input type="date"> takes its display format from the browser's UI
 * locale — an en-GB browser shows dd/mm/yyyy, an en-US one mm/dd/yyyy — and
 * neither the `lang` attribute nor CSS can override it (verified in Chromium:
 * no lang, lang="en-US" and lang="en-GB" all rendered dd/mm/yyyy on an en-GB
 * browser). Staff on different machines therefore saw different formats for
 * the same field. This types the date as text so every machine matches.
 *
 * `value` and `onChange` speak ISO yyyy-mm-dd, matching what the native input
 * and the API already use, so call sites don't change.
 */

const isoToDisplay = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  const [, y, mo, d] = m;
  return `${mo}/${d}/${y}`;
};

const displayToIso = (display: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return null;
  const [, mo, d, y] = m;
  const month = Number(mo);
  const day = Number(d);
  const year = Number(y);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
  // Reject impossible days such as 02/30 by round-tripping through Date.
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null;
  }
  return `${y}-${mo}-${d}`;
};

/** Digits only, with slashes inserted as the user types. */
const maskInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

interface Props {
  value?: string;
  onChange: (iso: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
}

export default function DateInput({
  value = '',
  onChange,
  className = '',
  placeholder = 'mm/dd/yyyy',
  required,
  id,
}: Props) {
  const [text, setText] = React.useState(() => isoToDisplay(value));

  // Follow the value when it changes from outside (form reset, editing a
  // record) without fighting what is being typed.
  React.useEffect(() => {
    const next = isoToDisplay(value);
    setText(prev => (displayToIso(prev) === value && value ? prev : next));
  }, [value]);

  const handleChange = (raw: string) => {
    // Pasting an ISO date (what the API and old inputs used) would otherwise
    // be masked digit-by-digit into nonsense like 20/26/0815.
    const pastedIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
    if (pastedIso) {
      const display = isoToDisplay(raw.trim());
      setText(display);
      const iso = displayToIso(display);
      if (iso) onChange(iso);
      return;
    }

    const masked = maskInput(raw);
    setText(masked);
    const iso = displayToIso(masked);
    if (iso) {
      onChange(iso);
    } else if (masked === '') {
      onChange('');
    }
  };

  const incomplete = text.length > 0 && displayToIso(text) === null;

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      required={required}
      placeholder={placeholder}
      value={text}
      onChange={e => handleChange(e.target.value)}
      onBlur={() => {
        // Clear a half-typed date rather than leaving something unparseable.
        if (incomplete) {
          setText(isoToDisplay(value));
        }
      }}
      className={className}
      aria-invalid={incomplete || undefined}
    />
  );
}
