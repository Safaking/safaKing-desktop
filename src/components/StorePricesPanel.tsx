'use client';

import React from 'react';
import { Store, Search, IndianRupee, RotateCcw, Loader2, Check } from 'lucide-react';
import { useStores, useProducts, useStorePrices, invalidateAfterStorePriceChange } from '@/lib/data';
import { isMeterBased, rateSuffix } from '@/lib/product-types';

/** A blank box means "use the shop price"; only a real number is an override. */
const clean = (v: string) => v.trim();
const asNumber = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

type Draft = Record<string, { rent: string; sale: string }>;

/**
 * Per-branch prices.
 *
 * The same safa does not fetch the same rate in Partapur as it does in Chitri,
 * and until now the catalog carried one price for the whole shop, so whichever
 * branch was not the reference had to be corrected by hand on every order.
 *
 * A branch only stores the prices it actually differs on. Anything left blank
 * follows the shop-wide rate and keeps following it — including later changes
 * to that rate, which is what a branch that simply is not different wants.
 */
export default function StorePricesPanel() {
  const { data: storeData } = useStores();
  const stores: any[] = Array.isArray(storeData) ? storeData : [];

  const [storeId, setStoreId] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [onlySet, setOnlySet] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>({});
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState('');
  const [error, setError] = React.useState('');

  // Base prices, so the screen can show what the shop charges next to what this
  // branch charges. Asked for without a branch on purpose.
  const { data: productData } = useProducts();
  const products: any[] = Array.isArray(productData) ? productData : [];
  const { data: priceData, isLoading } = useStorePrices(storeId || null);
  const overrides: any[] = Array.isArray(priceData) ? priceData : [];

  React.useEffect(() => {
    if (!storeId && stores.length) setStoreId(stores[0].id);
  }, [stores, storeId]);

  // Switching branch or reloading its prices starts a fresh draft — carrying
  // half-typed numbers across branches would set them on the wrong one.
  React.useEffect(() => {
    const next: Draft = {};
    for (const o of overrides) {
      next[o.productId] = {
        rent: o.rentPrice === null || o.rentPrice === undefined ? '' : String(o.rentPrice),
        sale: o.salePrice === null || o.salePrice === undefined ? '' : String(o.salePrice),
      };
    }
    setDraft(next);
    setSaved('');
    setError('');
  }, [priceData, storeId]);

  const cell = (productId: string, field: 'rent' | 'sale') =>
    draft[productId]?.[field] ?? '';

  const set = (productId: string, field: 'rent' | 'sale', value: string) =>
    setDraft(d => {
      const row = d[productId] ?? { rent: '', sale: '' };
      return { ...d, [productId]: { ...row, [field]: value } };
    });

  const clearRow = (productId: string) =>
    setDraft(d => ({ ...d, [productId]: { rent: '', sale: '' } }));

  /** Rows whose boxes no longer match what is stored. */
  const changed = React.useMemo(() => {
    const stored = new Map(
      overrides.map(o => [
        o.productId,
        {
          rent: o.rentPrice === null || o.rentPrice === undefined ? '' : String(o.rentPrice),
          sale: o.salePrice === null || o.salePrice === undefined ? '' : String(o.salePrice),
        },
      ])
    );
    return products.filter(p => {
      const now = { rent: cell(p.id, 'rent'), sale: cell(p.id, 'sale') };
      const before = stored.get(p.id) ?? { rent: '', sale: '' };
      return clean(now.rent) !== before.rent || clean(now.sale) !== before.sale;
    });
  }, [draft, overrides, products]);

  const hasOverride = (id: string) =>
    clean(cell(id, 'rent')) !== '' || clean(cell(id, 'sale')) !== '';

  const visible = products.filter(p => {
    const q = query.trim().toLowerCase();
    const matches = !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
    return matches && (!onlySet || hasOverride(p.id));
  });

  const save = async () => {
    if (!storeId || !changed.length) return;
    setSaving(true);
    setError('');
    setSaved('');
    try {
      const res = await fetch('/api/store-prices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          prices: changed.map(p => ({
            productId: p.id,
            rentPrice: clean(cell(p.id, 'rent')) === '' ? null : asNumber(cell(p.id, 'rent')),
            salePrice: clean(cell(p.id, 'sale')) === '' ? null : asNumber(cell(p.id, 'sale')),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save the prices');
        return;
      }
      await invalidateAfterStorePriceChange();
      const bits = [
        data.saved ? `${data.saved} price${data.saved === 1 ? '' : 's'} saved` : '',
        data.cleared ? `${data.cleared} back on the shop rate` : '',
      ].filter(Boolean);
      setSaved(bits.join(' · ') || 'Saved');
    } catch (err: any) {
      setError(err.message || 'Could not save the prices');
    } finally {
      setSaving(false);
    }
  };

  const setCount = products.filter(p => hasOverride(p.id)).length;

  if (!stores.length) {
    return (
      <p className="p-10 text-center text-sm font-semibold text-slate-400">
        No branches yet. Add one under Branches first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Store size={16} className="text-indigo-600" /> Branch prices
          </h2>
          <p className="text-[11px] font-bold text-slate-400">
            {setCount} of {products.length} set for this branch
          </p>
        </div>

        {/* Which branch is being priced. Getting this wrong would reprice the
            other shop, so it is a row of buttons rather than a quiet dropdown. */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-2">
          {stores.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStoreId(s.id)}
              className={`px-3 py-2 rounded-lg text-xs font-bold text-left transition-colors ${
                storeId === s.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.name}
              {s.location && (
                <span
                  className={`block text-[10px] font-semibold ${
                    storeId === s.id ? 'text-indigo-100' : 'text-slate-400'
                  }`}
                >
                  {s.location}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search product or SKU"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-xs font-bold"
            />
          </div>
          <button
            type="button"
            onClick={() => setOnlySet(v => !v)}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              onlySet ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Only this branch&apos;s own prices
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-right">Shop rent</th>
                <th className="px-3 py-2 text-right">This branch</th>
                <th className="px-3 py-2 text-right">Shop sale</th>
                <th className="px-3 py-2 text-right">This branch</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    <Loader2 size={15} className="animate-spin inline" />
                  </td>
                </tr>
              )}
              {!isLoading && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs font-semibold text-slate-400">
                    Nothing matches this filter.
                  </td>
                </tr>
              )}
              {!isLoading &&
                visible.map(p => {
                  const own = hasOverride(p.id);
                  const suffix = rateSuffix(p);
                  return (
                    <tr
                      key={p.id}
                      className={`border-t border-slate-100 ${own ? 'bg-indigo-50/40' : ''}`}
                    >
                      <td className="px-4 py-2">
                        <p className="font-bold text-slate-800 text-xs">{p.name}</p>
                        <p className="text-[10px] font-semibold text-slate-400">
                          {p.sku}
                          {isMeterBased(p) && ' · per metre'}
                        </p>
                      </td>

                      <td className="px-3 py-2 text-right text-xs font-semibold text-slate-400 whitespace-nowrap">
                        ₹{Number(p.baseRentPrice ?? p.rentPrice ?? 0).toFixed(0)}
                        {suffix}
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative w-24 ml-auto">
                          <IndianRupee
                            size={11}
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300"
                          />
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={cell(p.id, 'rent')}
                            onChange={e => set(p.id, 'rent', e.target.value)}
                            placeholder="shop"
                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-xs font-bold text-right"
                          />
                        </div>
                      </td>

                      <td className="px-3 py-2 text-right text-xs font-semibold text-slate-400 whitespace-nowrap">
                        ₹{Number(p.baseSalePrice ?? p.salePrice ?? 0).toFixed(0)}
                        {suffix}
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative w-24 ml-auto">
                          <IndianRupee
                            size={11}
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300"
                          />
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={cell(p.id, 'sale')}
                            onChange={e => set(p.id, 'sale', e.target.value)}
                            placeholder="shop"
                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-xs font-bold text-right"
                          />
                        </div>
                      </td>

                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => clearRow(p.id)}
                          disabled={!own}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-0"
                          title="Back to the shop price"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold text-slate-400">
            Leave a box empty to charge the shop price. Blank follows the shop rate even when it
            changes later.
          </p>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                <Check size={13} /> {saved}
              </span>
            )}
            {error && <span className="text-[11px] font-bold text-rose-600">{error}</span>}
            <button
              type="button"
              onClick={save}
              disabled={saving || !changed.length}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold transition-colors"
            >
              {saving
                ? 'Saving…'
                : changed.length
                ? `Save ${changed.length} change${changed.length === 1 ? '' : 's'}`
                : 'No changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
