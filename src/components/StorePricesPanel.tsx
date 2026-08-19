'use client';

import React from 'react';
import { Store, Search, IndianRupee, RotateCcw, Loader2, Check } from 'lucide-react';
import {
  useStores,
  useProducts,
  useStorePrices,
  useSafaOptions,
  useStoreSafaPrices,
  useStoreStock,
  invalidateAfterStorePriceChange,
} from '@/lib/data';
import { isMeterBased, rateSuffix, isSharedStock, unitLabel } from '@/lib/product-types';

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

  // A branch's own shelf. Barati safas are not here: they travel out to the
  // wedding from one shop-wide pool, so they have no per-branch count.
  const { data: stockData } = useStoreStock(storeId || null);
  const stockRows: any[] = Array.isArray(stockData) ? stockData : [];
  const [stock, setStock] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const next: Record<string, string> = {};
    for (const r of stockRows) next[r.productId] = String(r.quantity);
    setStock(next);
  }, [stockData, storeId]);

  const stockChanged = products.filter(p => {
    if (isSharedStock(p)) return false;
    const stored = stockRows.find(r => r.productId === p.id);
    return clean(stock[p.id] ?? '') !== (stored ? String(stored.quantity) : '');
  });

  // Tying is charged by area too, and there are only a handful of styles, so
  // they sit on the same screen rather than in a tab of their own.
  const { data: styleData } = useSafaOptions();
  const styles: any[] = Array.isArray(styleData) ? styleData : [];
  const { data: styleOverrideData } = useStoreSafaPrices(storeId || null);
  const styleOverrides: any[] = Array.isArray(styleOverrideData) ? styleOverrideData : [];
  const [tying, setTying] = React.useState<Record<string, string>>({});
  const [savingTying, setSavingTying] = React.useState(false);
  const [tyingSaved, setTyingSaved] = React.useState('');

  React.useEffect(() => {
    const next: Record<string, string> = {};
    for (const o of styleOverrides) next[o.safaOptionId] = String(o.price);
    setTying(next);
    setTyingSaved('');
  }, [styleOverrideData, storeId]);

  const tyingChanged = styles.filter(st => {
    const stored = styleOverrides.find(o => o.safaOptionId === st.id);
    return clean(tying[st.id] ?? '') !== (stored ? String(stored.price) : '');
  });

  const saveTying = async () => {
    if (!storeId || !tyingChanged.length) return;
    setSavingTying(true);
    setTyingSaved('');
    try {
      const res = await fetch('/api/store-safa-prices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          prices: tyingChanged.map(st => ({
            safaOptionId: st.id,
            price: clean(tying[st.id] ?? '') === '' ? null : asNumber(tying[st.id] ?? ''),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save the tying rates');
        return;
      }
      await invalidateAfterStorePriceChange();
      setTyingSaved('Saved');
    } catch (err: any) {
      setError(err.message || 'Could not save the tying rates');
    } finally {
      setSavingTying(false);
    }
  };

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
    if (!storeId || (!changed.length && !stockChanged.length)) return;
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
      let stockResult: any = {};
      if (stockChanged.length) {
        const sres = await fetch('/api/store-stock', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId,
            stock: stockChanged.map(p => ({
              productId: p.id,
              quantity: clean(stock[p.id] ?? '') === '' ? null : clean(stock[p.id] ?? ''),
            })),
          }),
        });
        stockResult = await sres.json().catch(() => ({}));
        if (!sres.ok) {
          setError(stockResult.error || 'Prices saved, but the stock did not');
          return;
        }
      }

      await invalidateAfterStorePriceChange();
      const bits = [
        data.saved ? `${data.saved} price${data.saved === 1 ? '' : 's'} saved` : '',
        data.cleared ? `${data.cleared} back on the shop rate` : '',
        stockResult.saved ? `${stockResult.saved} stock count${stockResult.saved === 1 ? '' : 's'} set` : '',
        stockResult.cleared ? `${stockResult.cleared} back on the shop count` : '',
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
                <th className="px-3 py-2 text-right">Stock here</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <Loader2 size={15} className="animate-spin inline" />
                  </td>
                </tr>
              )}
              {!isLoading && visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs font-semibold text-slate-400">
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

                      {/* Barati travels out to the wedding from one shop pool,
                          so it has no per-branch count to set. */}
                      <td className="px-3 py-2">
                        {isSharedStock(p) ? (
                          <span className="block text-right text-[10px] font-black text-amber-600 uppercase tracking-wider">
                            Shared
                            <span className="block font-bold text-slate-400 normal-case tracking-normal">
                              {p.totalQuantity} {unitLabel(p)}
                            </span>
                          </span>
                        ) : (
                          <div className="w-24 ml-auto">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={stock[p.id] ?? ''}
                              onChange={e => setStock(t => ({ ...t, [p.id]: e.target.value }))}
                              placeholder={`shop ${p.totalQuantity}`}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-xs font-bold text-right"
                            />
                          </div>
                        )}
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
            Leave a price empty to charge the shop rate — blank keeps following it when it changes.
            Leave stock empty and the product stays on one undivided shop-wide count; give it a
            number and this branch keeps its own. Barati safas are always shared: they go out to
            the wedding from one pool.
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
              disabled={saving || (!changed.length && !stockChanged.length)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold transition-colors"
            >
              {(() => {
                const n = changed.length + stockChanged.length;
                if (saving) return 'Saving…';
                return n ? `Save ${n} change${n === 1 ? '' : 's'}` : 'No changes';
              })()}
            </button>
          </div>
        </div>
      </div>

      {/* Tying rates for this branch. Same rule as the products above: blank
          means the shop rate, and it keeps meaning that. */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <IndianRupee size={15} className="text-indigo-600" /> Safa tying rates for this branch
          </h2>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
            Per safa. Leave blank to charge the shop rate.
          </p>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {styles.length === 0 && (
            <p className="text-xs font-semibold text-slate-400">No tying styles set up yet.</p>
          )}
          {styles.map(st => {
            const own = clean(tying[st.id] ?? '') !== '';
            return (
              <div
                key={st.id}
                className={`rounded-xl border p-3 ${
                  own ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200'
                }`}
              >
                <p className="text-xs font-bold text-slate-800">{st.name}</p>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  Shop rate ₹{Number(st.basePrice ?? st.price ?? 0).toFixed(0)}
                </p>
                <div className="relative mt-2">
                  <IndianRupee
                    size={11}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300"
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="shop rate"
                    value={tying[st.id] ?? ''}
                    onChange={e => setTying(t => ({ ...t, [st.id]: e.target.value }))}
                    className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-xs font-bold text-right"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-end gap-3">
          {tyingSaved && (
            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
              <Check size={13} /> {tyingSaved}
            </span>
          )}
          <button
            type="button"
            onClick={saveTying}
            disabled={savingTying || !tyingChanged.length}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold transition-colors"
          >
            {savingTying
              ? 'Saving…'
              : tyingChanged.length
              ? `Save ${tyingChanged.length} rate${tyingChanged.length === 1 ? '' : 's'}`
              : 'No changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
