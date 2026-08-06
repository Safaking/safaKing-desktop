'use client';

import React, { useState, useEffect } from 'react';
import { useProducts, useSafaOptions, useVendors, invalidateAfterSale } from '@/lib/data';
import { isMeterBased, rateSuffix } from '@/lib/product-types';
import SafaTyingDialog from '@/components/SafaTyingDialog';
import DateInput from '@/components/DateInput';
import { 
  Plus, 
  Search, 
  ShoppingCart, 
  X, 
  Package, 
  ArrowLeft,
  CheckCircle2,
  Trash2,
  CreditCard,
  User,
  Phone,
  LayoutGrid,
  MapPin,
  Calendar,
  Minus,
  Building2
} from 'lucide-react';
import Link from 'next/link';
import { generateInvoicePDF } from '@/lib/invoice-gen';
import BillPreviewDialog from '@/components/BillPreviewDialog';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  salePrice: number;
  totalQuantity: number;
  availableQuantity: number;
  isSellable: boolean;
  image?: string;
}

interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export default function SalesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [customer, setCustomer] = useState({ 
    name: '', 
    phone: '', 
    address: '',
    fatherName: '',
    weddingDate: '',
    safaSize: '',
    notes: ''
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [previewBill, setPreviewBill] = useState<any | null>(null);
  // Safa tying, same model as the booking page: styles are multi-select and
  // each carries its own quantity.
  const [tieSafa, setTieSafa] = useState(false);
  const [tyingQuantities, setTyingQuantities] = useState<Record<string, number>>({});
  const [tyingDialogOpen, setTyingDialogOpen] = useState(false);
  const [tyingCountEdited, setTyingCountEdited] = useState(false);
  // Bulk buyers order through this same screen; the sale is tagged to them and
  // can be part-paid, unlike a counter sale which settles in full.
  const [vendorId, setVendorId] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [safaTyingDetails, setSafaTyingDetails] = useState({ name: '', address: '', time: '', marriageDate: '' });
  const [recentSale, setRecentSale] = useState<any>(null);

  const { data: productData } = useProducts();
  const { data: safaOptionData } = useSafaOptions();
  const { data: vendorData } = useVendors();
  const vendors: any[] = Array.isArray(vendorData) ? vendorData : [];
  const safaOptions: any[] = Array.isArray(safaOptionData) ? safaOptionData : [];

  useEffect(() => {
    if (Array.isArray(productData)) {
      setProducts(productData.filter((p: any) => p.isSellable));
    }
  }, [productData]);

  // Read ?vendorId= from URL search params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const vId = params.get('vendorId');
      if (vId) handleVendorSelect(vId);
    }
  }, [vendors]);

  const handleVendorSelect = (id: string) => {
    setVendorId(id);
    if (id) {
      const v = vendors.find(x => x.id === id);
      if (v) {
        setCustomer(prev => ({
          ...prev,
          name: v.name || prev.name,
          phone: v.phone || prev.phone,
          address: v.address || prev.address,
        }));
      }
    }
  };

  // Stock ceiling for a product, same guard the booking catalog uses so a sale
  // cannot be rung up for more than is actually on the shelf.
  const getAvailable = (product: { availableQuantity?: number; totalQuantity?: number }) => {
    const raw = product.availableQuantity ?? product.totalQuantity ?? 0;
    return Math.max(0, Number(raw) || 0);
  };

  const availableFor = (productId: string) => {
    const p = products.find(x => x.id === productId);
    return p ? getAvailable(p) : 0;
  };

  const addToCart = (product: Product) => {
    const available = getAvailable(product);
    if (available <= 0) return;

    setItems((prev: SaleItem[]) => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= available) return prev;
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1, price: product.salePrice }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    const available = availableFor(productId);
    setItems((prev: SaleItem[]) => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.min(available, Math.max(1, item.quantity + delta));
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const setQuantity = (productId: string, value: string) => {
    const qty = parseInt(value) || 0;
    const available = availableFor(productId);
    setItems((prev: SaleItem[]) => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, quantity: Math.min(available, Math.max(1, qty)) };
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  };

  const selectedStyles = React.useMemo(
    () =>
      safaOptions
        .filter((opt: any) => (tyingQuantities[opt.id] ?? 0) > 0)
        .map((opt: any) => ({
          id: opt.id,
          name: opt.name,
          price: parseFloat(opt.price?.toString() || '0') || 0,
          quantity: tyingQuantities[opt.id] ?? 0,
        })),
    [safaOptions, tyingQuantities]
  );

  const totalTyingCount = selectedStyles.reduce((s, st) => s + st.quantity, 0);
  const getSafaCharge = () => (tieSafa ? selectedStyles.reduce((s, st) => s + st.price * st.quantity, 0) : 0);
  const soldSafaQty = items.reduce((s, i) => s + i.quantity, 0);

  const setStyleQty = (styleId: string, qty: number) => {
    setTyingCountEdited(true);
    setTyingQuantities(prev => ({ ...prev, [styleId]: Math.max(0, qty) }));
  };

  // Tied count follows what is in the cart until staff type a number.
  useEffect(() => {
    if (!tieSafa || tyingCountEdited) return;
    if (soldSafaQty <= 0 || selectedStyles.length !== 1) return;
    const only = selectedStyles[0];
    if (only.quantity === soldSafaQty) return;
    setTyingQuantities(prev => ({ ...prev, [only.id]: soldSafaQty }));
  }, [tieSafa, tyingCountEdited, soldSafaQty, selectedStyles]);

  const toggleStyle = (style: any) => {
    const current = tyingQuantities[style.id] ?? 0;
    if (current > 0) {
      setTyingQuantities(prev => ({ ...prev, [style.id]: 0 }));
      return;
    }
    const seed = totalTyingCount === 0 && soldSafaQty > 0 ? soldSafaQty : 1;
    setTyingQuantities(prev => ({ ...prev, [style.id]: seed }));
  };

  const calculateTotal = () => {
    return items.reduce((s, i) => s + (i.price * i.quantity), 0) + getSafaCharge();
  };

  const handleSale = async () => {
    if (!customer.name || !customer.phone || items.length === 0) {
      alert('Please fill in Customer Name and Phone');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customer.name,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          fatherName: customer.fatherName,
          weddingDate: customer.weddingDate,
          safaSize: customer.safaSize,
          notes: customer.notes,
          items,
          totalAmount: calculateTotal(),
          tieSafa,
          safaShape: tieSafa ? selectedStyles.map(st => st.name).join(', ') : null,
          safaTyingCount: tieSafa ? Math.max(1, totalTyingCount) : 1,
          safaTyingStyles: tieSafa ? JSON.stringify(selectedStyles) : null,
          safaTyingName: tieSafa ? safaTyingDetails.name : null,
          safaTyingAddress: tieSafa ? safaTyingDetails.address : null,
          safaTyingTime: tieSafa ? safaTyingDetails.time : null,
          safaTyingDate: tieSafa ? safaTyingDetails.marriageDate : null,
          tieSafaCharge: getSafaCharge(),
          createdBy: user?.username || user?.name || null,
          vendorId: vendorId || null,
          // Blank means settled in full, which is the counter-sale default.
          paidAmount: vendorId && paidAmount !== '' ? parseFloat(paidAmount) || 0 : undefined,
        })
      });

      const data = await res.json();
      if (!res.ok) alert(data.error || 'Sale failed');
      else {
        // A sale moves stock and revenue, so drop the caches that depend on it.
        await invalidateAfterSale();
        setRecentSale(data);
        setShowSuccess(true);
        generateInvoicePDF(data, 'SALE');
        setItems([]);
        setCustomer({ name: '', phone: '', address: '', fatherName: '', weddingDate: '', safaSize: '', notes: '' });
        setTieSafa(false);
        setTyingQuantities({});
        setTyingCountEdited(false);
        setVendorId('');
        setPaidAmount('');
      }
    } catch (error) {
      alert('Network error');
    }
    setLoading(false);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-screen bg-[#f8f9fa] text-slate-900 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shrink-0">
        <div className="max-w-full mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-emerald-600 transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="h-10 flex items-center">
              <img src="/assets/logo.png?v=3" alt="Logo" className="h-full w-auto object-contain" />
            </div>
            <h1 className="text-lg font-bold text-slate-800 uppercase tracking-wider">{t('new_sale')}</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleSale}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-6 py-2 rounded text-base font-bold shadow-sm transition-all"
            >
              {loading ? '...' : t('confirm')}
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 flex overflow-hidden p-2 gap-2">
         {/* COLUMN 1: CUSTOMER DETAILS (30%) */}
         <div className="w-[30%] bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden">
           <div className="p-3 border-b border-slate-50 flex items-center gap-2 shrink-0">
             <User size={18} className="text-emerald-600" />
             <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{t('customer_details')}</h3>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder={`${t('customer')}${t('mandatory')}`}
                    className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded focus:border-emerald-500 outline-none font-bold text-sm"
                    value={customer.name}
                    onChange={e => setCustomer({...customer, name: e.target.value})}
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder={`${t('phone')}${t('mandatory')}`}
                    className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded focus:border-emerald-500 outline-none font-bold text-sm"
                    value={customer.phone}
                    onChange={e => setCustomer({...customer, phone: e.target.value})}
                  />
                </div>
              </div>

              {/* Wholesale / Retail Toggle Button Bar */}
              <div className="bg-slate-100 p-1 rounded-xl flex gap-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => handleVendorSelect('')}
                  className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    !vendorId ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <User size={14} /> रिटेल (Walk-in)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (vendors.length > 0) handleVendorSelect(vendors[0].id);
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    vendorId ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Building2 size={14} /> होलसेल (व्यापारी)
                </button>
              </div>

              {/* Vendor Selection Card */}
              {vendorId ? (
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-3 space-y-2">
                  <label className="block text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                    <Building2 size={14} className="text-indigo-600" /> व्यापारी चुनें (Select Vendor) *
                  </label>
                  <select
                    className="w-full px-3 py-2.5 bg-white border border-indigo-300 rounded-xl outline-none focus:border-indigo-600 font-bold text-xs text-indigo-950 shadow-sm"
                    value={vendorId}
                    onChange={e => handleVendorSelect(e.target.value)}
                  >
                    <option value="">-- व्यापारी चुनें (Select Vendor) --</option>
                    {vendors
                      .filter(v => v.isActive)
                      .map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name}{v.phone ? ` (${v.phone})` : ''}
                        </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-indigo-700 font-bold">
                    ✓ यह बिल व्यापारी के खाते (Ledger) में खुद-ब-खुद जुड़ जाएगा!
                  </p>
                </div>
              ) : (
                vendors.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      होलसेल / व्यापारी (Optional Vendor Tag)
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold"
                      value={vendorId}
                      onChange={e => handleVendorSelect(e.target.value)}
                    >
                      <option value="">Walk-in Customer (कोई व्यापारी नहीं)</option>
                      {vendors
                        .filter(v => v.isActive)
                        .map(v => (
                          <option key={v.id} value={v.id}>
                            {v.name}{v.phone ? ` — ${v.phone}` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                )
              )}

              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  placeholder={`${t('father_name')}${t('optional')}`}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded focus:border-emerald-500 outline-none text-xs"
                  value={customer.fatherName}
                  onChange={e => setCustomer({...customer, fatherName: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                   <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                   <DateInput
                     placeholder={`${t('wedding_date')} (mm/dd/yyyy)`}
                     className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded focus:border-emerald-500 outline-none text-sm"
                     value={customer.weddingDate}
                     onChange={v => setCustomer({...customer, weddingDate: v})}
                   />
                </div>
                <div className="relative">
                   <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                   <input 
                     type="text" 
                     placeholder={`${t('safa_size')}${t('optional')}`}
                     className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded focus:border-emerald-500 outline-none text-sm"
                     value={customer.safaSize}
                     onChange={e => setCustomer({...customer, safaSize: e.target.value})}
                   />
                </div>
              </div>

              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-slate-400" size={14} />
                <textarea 
                  placeholder={`${t('address')}${t('optional')}`}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded focus:border-emerald-500 outline-none h-16 text-xs resize-none"
                  value={customer.address}
                  onChange={e => setCustomer({...customer, address: e.target.value})}
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('notes')}</label>
                <textarea 
                  placeholder={`${t('notes')}${t('optional')}`}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded focus:border-emerald-500 outline-none h-32 text-xs resize-none"
                  value={customer.notes}
                  onChange={e => setCustomer({...customer, notes: e.target.value})}
                />
              </div>
           </div>
         </div>

         {/* COLUMN 2: CATALOG (42%) */}
         <div className="w-[42%] bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-50 flex justify-between items-center shrink-0">
             <div className="flex items-center gap-2">
               <Package size={18} className="text-emerald-600" />
               <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{t('catalog')}</h3>
             </div>
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
               <input 
                 type="text" 
                 placeholder="Search products..."
                 className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none w-48 focus:w-64 focus:bg-white transition-all"
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
               />
             </div>
           </div>

           <div className="flex-1 overflow-y-auto p-2 bg-slate-50/30">
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                {filteredProducts.map(p => {
                  const available = getAvailable(p);
                  const inCart = items.find(i => i.productId === p.id)?.quantity ?? 0;
                  const remaining = available - inCart;
                  const soldOut = available <= 0;
                  const maxedOut = !soldOut && remaining <= 0;
                  return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={soldOut || maxedOut}
                    title={soldOut ? 'Out of stock' : maxedOut ? `All ${available} already in the cart` : undefined}
                    className={`flex flex-col bg-white border rounded transition-all text-left group overflow-hidden ${
                      soldOut || maxedOut
                        ? 'border-slate-200 opacity-50 cursor-not-allowed'
                        : 'border-slate-200 hover:border-emerald-500 hover:shadow-md'
                    }`}
                  >
                    <div className="h-20 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border-b border-slate-50 relative">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt=""
                          className={`w-full h-full object-cover transition-transform ${soldOut ? 'grayscale' : 'group-hover:scale-110'}`}
                        />
                      ) : (
                        <Package size={20} className="text-slate-300" />
                      )}
                      {soldOut && (
                        <span className="absolute inset-x-0 bottom-0 bg-rose-600/90 text-white text-[10px] font-black text-center py-0.5">
                          OUT OF STOCK
                        </span>
                      )}
                      {maxedOut && (
                        <span className="absolute inset-x-0 bottom-0 bg-amber-500/90 text-white text-[10px] font-black text-center py-0.5">
                          ALL {available} IN CART
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="font-bold text-slate-800 text-xs truncate leading-tight">{p.name}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[11px] text-slate-400 font-bold">{p.sku}</span>
                        <span className="font-black text-emerald-600 text-[12px]">₹{p.salePrice.toFixed(0)}{rateSuffix(p as any)}</span>
                      </div>
                      <p
                        className={`text-[10px] font-black mt-0.5 ${
                          soldOut ? 'text-rose-600' : remaining <= 3 ? 'text-amber-600' : 'text-emerald-600'
                        }`}
                      >
                        {remaining}/{p.totalQuantity}{isMeterBased(p as any) ? ' m' : ''}
                      </p>
                    </div>
                  </button>
                  );
                })}
              </div>
           </div>
         </div>

         {/* COLUMN 3: CART & TOTALS (28%) */}
         <div className="w-[28%] flex flex-col gap-2 shrink-0 overflow-hidden">
            <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden">
               <div className="p-3 border-b border-slate-50 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={18} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{t('cart')}</h3>
                  </div>
                  <span className="text-[11px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full uppercase">{items.length} items</span>
               </div>

               <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                       <ShoppingCart size={32} strokeWidth={1} />
                       <p className="text-[10px] font-bold mt-2">Empty Cart</p>
                    </div>
                  ) : items.map((item) => (
                    <div key={item.productId} className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex items-center gap-2 group">
                       <div className="flex-1 min-w-0">
                         <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                         <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex items-center gap-1 bg-white rounded border border-slate-200 p-0.5">
                              <button onClick={() => updateQuantity(item.productId, -1)} className="p-0.5 hover:bg-slate-50 text-slate-500">
                                <Minus size={8} />
                              </button>
                              <input 
                                type="number" 
                                className="w-8 text-center font-bold text-[9px] bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={item.quantity}
                                onChange={(e) => setQuantity(item.productId, e.target.value)}
                              />
                              <button onClick={() => updateQuantity(item.productId, 1)} className="p-0.5 hover:bg-slate-50 text-slate-500">
                                <Plus size={8} />
                              </button>
                            </div>
                            <span className="text-[9px] font-black text-emerald-600">@ ₹{item.price.toFixed(0)}</span>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="font-black text-slate-800 text-[10px]">₹{(item.price * item.quantity).toFixed(0)}</p>
                         <button onClick={() => removeItem(item.productId)} className="text-rose-400 opacity-0 group-hover:opacity-100 transition-all">
                           <X size={10} />
                         </button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Tie Safa — sits with the cart, same as the booking page */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 shrink-0">
              <div
                onClick={() => {
                  const next = !tieSafa;
                  setTieSafa(next);
                  if (next) setTyingDialogOpen(true);
                }}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                  tieSafa ? 'bg-emerald-50/80 border-emerald-200' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input type="checkbox" checked={tieSafa} readOnly className="w-4 h-4 accent-emerald-600 pointer-events-none" />
                  <span className="text-xs font-black text-slate-800">Tie Safa</span>
                </div>
                {tieSafa && (
                  <span className="px-2 py-0.5 bg-emerald-600 text-white font-black text-[11px] rounded-md">
                    +₹{getSafaCharge()}
                  </span>
                )}
              </div>

              {tieSafa && (
                <button
                  type="button"
                  onClick={() => setTyingDialogOpen(true)}
                  className="mt-2 w-full text-left px-2.5 py-2 rounded-lg border border-emerald-100 bg-emerald-50/40 hover:border-emerald-300 transition-all"
                >
                  {selectedStyles.length === 0 ? (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold text-slate-600">No style selected — nothing charged</p>
                      <span className="text-[10px] font-black text-emerald-700 shrink-0">SELECT</span>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black text-slate-800">
                          {totalTyingCount} safa{totalTyingCount === 1 ? '' : 's'} tied
                        </p>
                        <span className="text-[10px] font-black text-emerald-700 shrink-0">EDIT</span>
                      </div>
                      <p className="text-[10px] font-semibold text-slate-500 truncate">
                        {selectedStyles.map(st => `${st.name} \u00d7${st.quantity}`).join(', ')}
                      </p>
                    </div>
                  )}
                </button>
              )}
            </div>

            <div className="bg-slate-900 text-white rounded-lg shadow-xl p-4 shrink-0">
               <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs font-black text-slate-400 uppercase tracking-widest">
                    <span>Items</span>
                    <span className="text-white text-sm">₹{items.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2)}</span>
                  </div>

                  {tieSafa && (
                    <div className="flex justify-between items-center text-xs font-black text-emerald-300 uppercase tracking-widest">
                      <span>Safa Tying</span>
                      <span className="text-emerald-300 text-sm">+ ₹{getSafaCharge().toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs font-black text-slate-400 uppercase tracking-widest">
                    <span>Subtotal</span>
                    <span className="text-white text-sm">₹{calculateTotal().toFixed(2)}</span>
                  </div>
                  
                  {vendorId && (
                    <div className="pt-3 border-t border-white/10 space-y-2 bg-indigo-950/60 -mx-4 px-4 py-3 border-l-4 border-l-indigo-400">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-1">
                          <Building2 size={12} /> व्यापारी बिल (Wholesale Order)
                        </label>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                          Auto-Adjusts in Ledger
                        </span>
                      </div>
                      <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                        अभी प्राप्त राशि / Paid Now (blank = full)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder={calculateTotal().toFixed(0)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-sm font-black text-white outline-none focus:border-emerald-400"
                        value={paidAmount}
                        onChange={e => setPaidAmount(e.target.value)}
                      />
                      <p className="text-[10px] font-bold text-slate-300">
                        {paidAmount === ''
                          ? '✓ पूरा भुगतान (Paid in Full)'
                          : `बकाया ₹${Math.max(0, calculateTotal() - (parseFloat(paidAmount) || 0)).toFixed(2)} व्यापारी के खाते में जुड़ेगा`}
                      </p>
                    </div>
                  )}

                  <div className="pt-3 border-t border-white/10 flex justify-between items-end">
                     <div>
                      <span className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">{t('total_payable')}</span>
                      <span className="text-4xl font-black leading-none tracking-tight text-emerald-400">₹{calculateTotal().toFixed(0)}</span>
                     </div>
                     <button 
                      onClick={handleSale}
                      disabled={loading || items.length === 0 || !customer.name || !customer.phone}
                      className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-white px-6 py-3 rounded font-black text-sm shadow-lg transition-all flex items-center gap-2"
                    >
                      <CreditCard size={18} /> {loading ? '...' : t('validate_payment')}
                    </button>
                  </div>
               </div>
            </div>
         </div>
      </main>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in duration-300 relative">
            <button 
              onClick={() => { setShowSuccess(false); window.location.reload(); }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-1">{t('sale_complete')}</h2>
            <p className="text-xs text-slate-500 mb-6 font-medium">Order <span className="font-mono font-black text-emerald-600">{recentSale?.orderNumber}</span> created.</p>
            
            <button
              onClick={() => setPreviewBill(recentSale)}
              className="w-full mb-2 py-3 px-3 rounded-lg font-black text-xs uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 transition-all"
            >
              {t('view_bill')}
            </button>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => generateInvoicePDF(recentSale, 'SALE', 'download')} className="py-3 px-3 rounded-lg font-black text-xs uppercase tracking-widest bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all border border-emerald-200">
                {t('download_bill')}
              </button>
              <button onClick={() => generateInvoicePDF(recentSale, 'SALE', 'print')} className="py-3 px-3 rounded-lg font-black text-xs uppercase tracking-widest bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all border border-indigo-200">
                {t('print_bill')}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => { setShowSuccess(false); window.location.reload(); }} className="py-3 px-4 rounded-lg font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all border border-slate-200 bg-white">
                {t('new_sale')}
              </button>
              <Link href="/sales/history" className="py-3 px-4 rounded-lg font-black text-xs uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg text-center">
                History
              </Link>
            </div>
          </div>
        </div>
      )}

      <SafaTyingDialog
        open={tyingDialogOpen}
        onClose={() => setTyingDialogOpen(false)}
        safaOptions={safaOptions}
        tyingQuantities={tyingQuantities}
        setStyleQty={setStyleQty}
        toggleStyle={toggleStyle}
        selectedStyles={selectedStyles}
        totalTyingCount={totalTyingCount}
        charge={getSafaCharge()}
        bookedSafaQty={soldSafaQty}
        details={safaTyingDetails}
        setDetails={setSafaTyingDetails}
      />
      <BillPreviewDialog order={previewBill} type='SALE' onClose={() => setPreviewBill(null)} />
    </div>
  );
}
