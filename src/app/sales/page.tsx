'use client';

import React, { useState, useEffect } from 'react';
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
  Minus
} from 'lucide-react';
import Link from 'next/link';
import { generateInvoicePDF } from '@/lib/invoice-gen';
import { useLanguage } from '@/lib/LanguageContext';

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
  const [recentSale, setRecentSale] = useState<any>(null);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data.filter((p: any) => p.isSellable)));
  }, []);

  const addToCart = (product: Product) => {
    setItems((prev: SaleItem[]) => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1, price: product.salePrice }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setItems((prev: SaleItem[]) => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const setQuantity = (productId: string, value: string) => {
    const qty = parseInt(value) || 0;
    setItems((prev: SaleItem[]) => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, quantity: Math.max(1, qty) };
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  };

  const calculateTotal = () => {
    return items.reduce((s, i) => s + (i.price * i.quantity), 0);
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
          totalAmount: calculateTotal()
        })
      });

      const data = await res.json();
      if (!res.ok) alert(data.error || 'Sale failed');
      else {
        setRecentSale(data);
        setShowSuccess(true);
        generateInvoicePDF(data, 'SALE');
        setItems([]);
        setCustomer({ name: '', phone: '', address: '', fatherName: '', weddingDate: '', safaSize: '', notes: '' });
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
                   <input 
                     type="date" 
                     placeholder={`${t('wedding_date')}${t('optional')}`}
                     className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded focus:border-emerald-500 outline-none text-sm"
                     value={customer.weddingDate}
                     onChange={e => setCustomer({...customer, weddingDate: e.target.value})}
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
                {filteredProducts.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="flex flex-col bg-white border border-slate-200 rounded hover:border-emerald-500 hover:shadow-md transition-all text-left group overflow-hidden"
                  >
                    <div className="h-20 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border-b border-slate-50">
                      {p.image ? (
                        <img src={p.image} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                      ) : (
                        <Package size={20} className="text-slate-300" />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="font-bold text-slate-800 text-xs truncate leading-tight">{p.name}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[11px] text-slate-400 font-bold">{p.sku}</span>
                        <span className="font-black text-emerald-600 text-[12px]">₹{p.salePrice.toFixed(0)}</span>
                      </div>
                    </div>
                  </button>
                ))}
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

            <div className="bg-slate-900 text-white rounded-lg shadow-xl p-4 shrink-0">
               <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs font-black text-slate-400 uppercase tracking-widest">
                    <span>Subtotal</span>
                    <span className="text-white text-sm">₹{calculateTotal().toFixed(2)}</span>
                  </div>
                  
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
    </div>
  );
}
