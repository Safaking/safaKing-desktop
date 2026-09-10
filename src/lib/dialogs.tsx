'use client';

import React from 'react';

/**
 * In-page replacements for alert(), confirm() and prompt().
 *
 * The desktop app is Electron on Windows, where closing a native popup hands
 * focus back to the window but not to the page inside it: every text box
 * then shows a cursor and silently ignores the keyboard until the window is
 * clicked away from and back. At a busy counter that reads as "the form is
 * broken". Nothing drawn inside the page can cause that, so these never
 * leave it.
 *
 * alert() is replaced globally by <DialogHost />, since nothing waits on its
 * return value. confirm() and prompt() do return values, so call sites use
 * the awaitable askConfirm() / askPrompt() instead.
 */

type Toast = { id: number; message: string; sticky: boolean; resolve: () => void };

type Ask =
  | {
      id: number;
      kind: 'confirm';
      message: string;
      confirmLabel: string;
      cancelLabel: string;
      danger: boolean;
      resolve: (value: boolean) => void;
    }
  | {
      id: number;
      kind: 'prompt';
      message: string;
      defaultValue: string;
      confirmLabel: string;
      cancelLabel: string;
      resolve: (value: string | null) => void;
    };

let seq = 0;
let toasts: Toast[] = [];
let asks: Ask[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

// Captured before <DialogHost /> swaps window.alert, so a page rendered
// without the host still gets a working (if native) message.
const nativeAlert = typeof window !== 'undefined' ? window.alert.bind(window) : null;

const hostMounted = () => listeners.size > 0;

function dismissToast(id: number) {
  const toast = toasts.find((t) => t.id === id);
  if (!toast) return;
  toasts = toasts.filter((t) => t.id !== id);
  emit();
  toast.resolve();
}

/**
 * Shows a message. Resolves when it is dismissed — or, unless `sticky`, after
 * a few seconds. Use `sticky` when the next line navigates away, so the
 * message is read before the page changes under it.
 */
export function notify(message: string, opts: { sticky?: boolean } = {}): Promise<void> {
  if (!hostMounted()) {
    nativeAlert?.(message);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const id = ++seq;
    toasts = [...toasts, { id, message, sticky: !!opts.sticky, resolve }];
    emit();
    if (!opts.sticky) setTimeout(() => dismissToast(id), 6000);
  });
}

export function askConfirm(
  message: string,
  opts: { confirmLabel?: string; cancelLabel?: string; danger?: boolean } = {}
): Promise<boolean> {
  if (!hostMounted()) return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => {
    asks = [
      ...asks,
      {
        id: ++seq,
        kind: 'confirm',
        message,
        confirmLabel: opts.confirmLabel ?? 'OK',
        cancelLabel: opts.cancelLabel ?? 'Cancel',
        danger: !!opts.danger,
        resolve,
      },
    ];
    emit();
  });
}

export function askPrompt(
  message: string,
  defaultValue = '',
  opts: { confirmLabel?: string; cancelLabel?: string } = {}
): Promise<string | null> {
  if (!hostMounted()) return Promise.resolve(window.prompt(message, defaultValue));
  return new Promise((resolve) => {
    asks = [
      ...asks,
      {
        id: ++seq,
        kind: 'prompt',
        message,
        defaultValue,
        confirmLabel: opts.confirmLabel ?? 'OK',
        cancelLabel: opts.cancelLabel ?? 'Cancel',
        resolve,
      },
    ];
    emit();
  });
}

function settleConfirm(value: boolean) {
  const [head, ...rest] = asks;
  if (!head || head.kind !== 'confirm') return;
  asks = rest;
  emit();
  head.resolve(value);
}

function settlePrompt(value: string | null) {
  const [head, ...rest] = asks;
  if (!head || head.kind !== 'prompt') return;
  asks = rest;
  emit();
  head.resolve(value);
}

function AskDialog({ ask }: { ask: Ask }) {
  const [value, setValue] = React.useState(ask.kind === 'prompt' ? ask.defaultValue : '');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const confirmRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (ask.kind === 'prompt') {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      confirmRef.current?.focus();
    }
  }, [ask]);

  const cancel = () => (ask.kind === 'confirm' ? settleConfirm(false) : settlePrompt(null));
  const accept = () => (ask.kind === 'confirm' ? settleConfirm(true) : settlePrompt(value));
  const danger = ask.kind === 'confirm' && ask.danger;

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          accept();
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`ask-${ask.id}`}
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="p-5 space-y-4">
          <p id={`ask-${ask.id}`} className="text-sm font-bold text-slate-800 whitespace-pre-line leading-relaxed">
            {ask.message}
          </p>
          {ask.kind === 'prompt' && (
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold text-sm"
            />
          )}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button
            type="button"
            onClick={cancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm"
          >
            {ask.cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={accept}
            className={`flex-1 py-2.5 rounded-xl text-white font-bold text-sm ${
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {ask.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DialogHost() {
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    listeners.add(rerender);
    const original = window.alert;
    window.alert = (message?: unknown) => {
      void notify(message == null ? '' : String(message));
    };
    return () => {
      listeners.delete(rerender);
      window.alert = original;
    };
  }, []);

  const ask = asks[0];

  return (
    <>
      {toasts.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] w-[min(92vw,26rem)] space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className="bg-white border border-slate-200 shadow-xl rounded-2xl p-4 flex items-start gap-3"
            >
              <p className="flex-1 text-sm font-bold text-slate-800 whitespace-pre-line leading-relaxed">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className={`shrink-0 rounded-lg font-bold text-xs ${
                  toast.sticky
                    ? 'px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'px-2 py-1 text-slate-400 hover:text-slate-700'
                }`}
                aria-label="Dismiss"
              >
                {toast.sticky ? 'OK' : '×'}
              </button>
            </div>
          ))}
        </div>
      )}
      {ask && <AskDialog key={ask.id} ask={ask} />}
    </>
  );
}
