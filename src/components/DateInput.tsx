'use client';

import React from 'react';
import {
  format,
  parse,
  isValid,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  getDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

/**
 * Date picker with a calendar popup.
 *
 * `value` and `onChange` speak ISO yyyy-mm-dd so all call sites are unchanged.
 * Clicking the field or the calendar icon opens a month-view popup.
 * The text input still accepts mm/dd/yyyy typing as a fallback.
 */

const isoToDisplay = (iso: string): string => {
  if (!iso) return '';
  const d = parse(iso, 'yyyy-MM-dd', new Date());
  return isValid(d) ? format(d, 'MM/dd/yyyy') : '';
};

const displayToIso = (display: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return null;
  const [, mo, d, y] = m;
  const month = Number(mo);
  const day = Number(d);
  const year = Number(y);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
  const probe = new Date(year, month - 1, day);
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  )
    return null;
  return `${y}-${mo}-${d}`;
};

const maskInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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
  const [open, setOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState<Date>(() => {
    if (value) {
      const d = parse(value, 'yyyy-MM-dd', new Date());
      if (isValid(d)) return startOfMonth(d);
    }
    return startOfMonth(new Date());
  });
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Sync external value changes
  React.useEffect(() => {
    const next = isoToDisplay(value);
    setText(prev => (displayToIso(prev) === value && value ? prev : next));
    if (value) {
      const d = parse(value, 'yyyy-MM-dd', new Date());
      if (isValid(d)) setViewDate(startOfMonth(d));
    }
  }, [value]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleTextChange = (raw: string) => {
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
      const d = parse(iso, 'yyyy-MM-dd', new Date());
      if (isValid(d)) setViewDate(startOfMonth(d));
    } else if (masked === '') {
      onChange('');
    }
  };

  const selectDay = (day: Date) => {
    const iso = format(day, 'yyyy-MM-dd');
    onChange(iso);
    setText(format(day, 'MM/dd/yyyy'));
    setOpen(false);
  };

  // Calendar grid
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart); // 0=Sun

  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
  const today = new Date();

  const incomplete = text.length > 0 && displayToIso(text) === null;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required={required}
          placeholder={placeholder}
          value={text}
          onChange={e => handleTextChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            if (incomplete) setText(isoToDisplay(value));
          }}
          className={`${className} pr-8`}
          aria-invalid={incomplete || undefined}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen(v => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-600 transition-colors"
        >
          <Calendar size={15} />
        </button>
      </div>

      {open && (
        <div
          className="absolute z-50 top-full mt-1 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 w-64 select-none"
          onMouseDown={e => e.preventDefault()}
        >
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              type="button"
              onClick={() => setViewDate(d => subMonths(d, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-bold text-slate-800">
              {format(viewDate, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(d => addMonths(d, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(wd => (
              <div
                key={wd}
                className="text-center text-[10px] font-bold text-slate-400 py-1"
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {/* Leading blanks */}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map(day => {
              const isSelected = selectedDate && isValid(selectedDate) && isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              const inMonth = isSameMonth(day, viewDate);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`
                    w-full aspect-square flex items-center justify-center text-xs font-semibold rounded-lg transition-all
                    ${isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : isToday
                      ? 'bg-indigo-50 text-indigo-700 font-bold ring-1 ring-indigo-300'
                      : inMonth
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-300'}
                  `}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-2 pt-2 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => selectDay(today)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
