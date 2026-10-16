'use client';

import React from 'react';
import { X, Save, Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  store: any | null;
  onSaved: () => void;
  onClose: () => void;
}

/**
 * The branch's billing identity — what gets printed at the top of a GST tax
 * invoice, and what decides CGST+SGST against IGST.
 *
 * Filled in once per branch. Without a GSTIN here nothing may legally call
 * itself a tax invoice, so the bill prints "BILL OF SUPPLY" instead and says
 * why; this screen is where that is put right.
 */
export default function StoreGstDialog({ store, onSaved, onClose }: Props) {
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [pricesIncludeTax, setPricesIncludeTax] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!store) return;
    const text = (value: unknown) => (typeof value === 'string' ? value : '');
    setForm({
      legalName: text(store.legalName),
      gstin: text(store.gstin),
      stateName: text(store.stateName),
      stateCode: text(store.stateCode),
      addressLine1: text(store.addressLine1),
      addressLine2: text(store.addressLine2),
      city: text(store.city),
      pincode: text(store.pincode),
      phones: text(store.phones),
      email: text(store.email),
      msmeNumber: text(store.msmeNumber),
      bankName: text(store.bankName),
      bankAccount: text(store.bankAccount),
      bankIfsc: text(store.bankIfsc),
      invoiceTerms: text(store.invoiceTerms),
      jurisdiction: text(store.jurisdiction),
    });
    // Counter prices in this trade are quoted tax-inclusive, so that is the
    // default for a branch that has never been asked.
    setPricesIncludeTax(store.pricesIncludeTax !== false);
    setError(null);
  }, [store]);

  if (!store) return null;

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const setGstin = (value: string) => {
    const gstin = value.toUpperCase();
    // The first two digits of a GSTIN are the state code; filling one fills
    // the other so the two can never disagree on the bill.
    setForm(f => ({
      ...f,
      gstin,
      stateCode: /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : f.stateCode,
    }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/stores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: store.id, ...form, pricesIncludeTax }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save.');
      } else {
        onSaved();
        onClose();
      }
    } catch {
      setError('Network error — nothing was saved.');
    }
    setSaving(false);
  };

  const field = (
    label: string,
    name: string,
    placeholder?: string,
    width: 'full' | 'half' = 'full',
    upper = false
  ) => (
    <Field
      key={name}
      label={label}
      placeholder={placeholder}
      width={width}
      upper={upper}
      value={form[name] ?? ''}
      onChange={value => (name === 'gstin' ? setGstin(value) : set(name, upper ? value.toUpperCase() : value))}
    />
  );

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-amber-50/60 shrink-0">
          <div>
            <h3 className="font-bold text-slate-800 text-base">GST बिल विवरण</h3>
            <p className="text-xs text-slate-500">{store.name} — tax invoice details</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {!form.gstin && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-amber-800">
                बिना GSTIN के बिल “BILL OF SUPPLY” छपेगा — tax invoice नहीं।
              </p>
            </div>
          )}

          <section className="grid grid-cols-2 gap-3">
            {field("बिल पर नाम / Legal name", "legalName", "JOSHI SAFA HOUSE", "full")}
            {field("GSTIN", "gstin", "08ABCDE1234F1Z5", "half")}
            {field("राज्य कोड / State code", "stateCode", "08", "half")}
            {field("राज्य / State", "stateName", "RAJASTHAN", "half", true)}
            {field("MSME / Udyam", "msmeNumber", "UDYAM-RJ-...", "half")}
          </section>

          <section className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
            {field("पता पंक्ति 1", "addressLine1", "Near Pandya Memorial School", "full")}
            {field("पता पंक्ति 2", "addressLine2", "Char Khamba", "full")}
            {field("शहर / City", "city", "Partapur, Banswara", "half")}
            {field("पिन कोड", "pincode", "327024", "half")}
            {field("फ़ोन", "phones", "+91 90013 47143, 76918 56577", "half")}
            {field("ईमेल", "email", "joshisafahouse@gmail.com", "half")}
          </section>

          <section className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
            {field("बैंक", "bankName", "PNB", "half")}
            {field("IFSC", "bankIfsc", "PUNB0356200", "half", true)}
            {field("खाता संख्या", "bankAccount", "3562002100023383", "full")}
            {field("न्यायक्षेत्र / Jurisdiction", "jurisdiction", "Banswara", "full")}
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                शर्तें / Terms (एक पंक्ति = एक शर्त)
              </label>
              <textarea
                rows={3}
                value={form.invoiceTerms ?? ''}
                onChange={e => set('invoiceTerms', e.target.value)}
                placeholder={'Interest at 18% is charged after 30 days from the invoice date.\nGoods are forwarded at the buyer’s risk.'}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </section>

          {/* This decides whether the tax is worked back out of the counter
              price or added on top of it — the single setting most likely to
              make a bill's total disagree with what was taken at the till. */}
          <section className="pt-4 border-t border-slate-100">
            <div
              onClick={() => setPricesIncludeTax(v => !v)}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                pricesIncludeTax ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <input type="checkbox" checked={pricesIncludeTax} readOnly className="w-4 h-4 mt-0.5 accent-emerald-600 pointer-events-none" />
              <div>
                <p className="text-xs font-black text-slate-800">दाम में GST शामिल है (prices include tax)</p>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  {pricesIncludeTax
                    ? 'बिल का कुल वही रहेगा जो काउंटर पर लिया गया — टैक्स उसी में से निकाला जाएगा।'
                    : 'दाम पर GST जोड़ा जाएगा — बिल का कुल काउंटर से ज़्यादा आएगा।'}
                </p>
              </div>
            </div>
          </section>

          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-2"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One labelled text box. Defined at module level, not inside the dialog: a
 * component declared in a render body is a new type on every keystroke, so
 * React would tear the input down and rebuild it, and the cursor would jump
 * out of the field after every character typed.
 */
function Field({
  label, value, onChange, placeholder, width = 'full', upper = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: 'full' | 'half';
  upper?: boolean;
}) {
  return (
    <div className={width === 'full' ? 'col-span-2' : 'col-span-2 sm:col-span-1'}>
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-indigo-500 ${
          upper ? 'uppercase tracking-wide' : ''
        }`}
      />
    </div>
  );
}
