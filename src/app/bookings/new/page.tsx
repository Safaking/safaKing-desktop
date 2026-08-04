'use client';

import React, { useState, useEffect } from 'react';
import { useProducts, useSafaOptions, useStores, invalidateAfterRentalChange } from '@/lib/data';
import { 
  Calendar, 
  Package, 
  ShoppingCart, 
  Plus, 
  ArrowLeft,
  CheckCircle2,
  X,
  User,
  Phone,
  LayoutGrid,
  Search,
  Minus,
  MapPin,
  CreditCard,
  FileText,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { generateInvoicePDF } from '@/lib/invoice-gen';
import SafaTyingDialog from '@/components/SafaTyingDialog';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

interface Product {
  id: string;
  name: string;
  sku: string;
  totalQuantity: number;
  availableQuantity: number;
  rentPrice: number;
  isRentable: boolean;
  image?: string;
}

interface BookingItem {
  productId: string;
  name: string;
  quantity: number;
  pricePerDay: number;
}

export default function OdooBookingPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customer, setCustomer] = useState({ 
    name: '', 
    phone: '', 
    altPhone: '',
    address: '',
    fatherName: '',
    weddingDate: '',
    safaSize: '',
    notes: ''
  });
  const [dates, setDates] = useState({ start: '', end: '' });
  const [items, setItems] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [recentBooking, setRecentBooking] = useState<any>(null);
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ONLINE'>('CASH');
  
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [tieSafa, setTieSafa] = useState(false);
  // styleId -> number of safas tied in that style (0 / absent means unselected)
  const [tyingQuantities, setTyingQuantities] = useState<Record<string, number>>({});
  const [tyingDialogOpen, setTyingDialogOpen] = useState(false);
  const [safaOptions, setSafaOptions] = useState<any[]>([]);
  const [safaTyingDetails, setSafaTyingDetails] = useState({
    name: '',
    address: '',
    time: '',
    marriageDate: '',
  });
  const [discount, setDiscount] = useState('0');
  const [safaPricingConfig, setSafaPricingConfig] = useState({
    roundedPrice: 50,
    jodhpuriPrice: 50,
    baratiSafaPrice: 50,
  });

  // These three lists barely change, so they come from cache on repeat visits
  // instead of three fresh round-trips every time the booking form opens.
  const { data: productData } = useProducts();
  const { data: safaOptionData } = useSafaOptions();
  const { data: storeData } = useStores();

  useEffect(() => {
    if (Array.isArray(productData)) {
      setProducts(productData.filter((p: any) => p.isRentable));
    }
  }, [productData]);

  useEffect(() => {
    if (Array.isArray(safaOptionData)) {
      // No style is preselected — tying is multi-select and starts empty so
      // nothing is billed until staff actively choose a style and quantity.
      setSafaOptions(safaOptionData);
    }
  }, [safaOptionData]);

  useEffect(() => {
    if (Array.isArray(storeData)) {
      setStores(storeData);
      if (user?.storeId) {
        setSelectedStore(user.storeId);
      } else if (storeData.length > 0) {
        setSelectedStore(storeData[0].id);
      }
    } else if (storeData !== undefined) {
      setStores([]);
    }
  }, [storeData, user]);

  // Styles are multi-select: each chosen style carries its own quantity, so a
  // customer can have e.g. 10 Jodhpuri and 5 Rounded at their separate rates.
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

  const getSafaCharge = () => {
    if (!tieSafa) return 0;
    return selectedStyles.reduce((s, st) => s + st.price * st.quantity, 0);
  };

  // Total safas being booked — the tying count defaults to this so staff don't
  // re-enter it, but it stays editable for "book 20, tie only 12" cases.
  const bookedSafaQty = items.reduce((s, i) => s + i.quantity, 0);

  const setStyleQty = (styleId: string, qty: number) => {
    setTyingQuantities(prev => ({ ...prev, [styleId]: Math.max(0, qty) }));
  };

  // First style picked on a booking order inherits the booked quantity.
  const toggleStyle = (style: any) => {
    const current = tyingQuantities[style.id] ?? 0;
    if (current > 0) {
      setStyleQty(style.id, 0);
      return;
    }
    const seed = totalTyingCount === 0 && bookedSafaQty > 0 ? bookedSafaQty : 1;
    setStyleQty(style.id, seed);
  };

  const addToBooking = (product: Product) => {
    setItems((prev: BookingItem[]) => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1, pricePerDay: product.rentPrice }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setItems((prev: BookingItem[]) => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const setQuantity = (productId: string, value: string) => {
    const qty = parseInt(value) || 0;
    setItems((prev: BookingItem[]) => prev.map(item => {
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
    let sum = items.reduce((s, i) => s + (i.pricePerDay * i.quantity), 0);
    if (tieSafa) sum += getSafaCharge();
    const discountVal = parseFloat(discount) || 0;
    return Math.max(0, sum - discountVal);
  };

  const handleBooking = async () => {
    if (!customer.name || !customer.phone || !dates.start || !dates.end || items.length === 0) {
      alert('Please fill in Name, Phone, and select Dates');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch('/api/rentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customer.name,
          customerPhone: customer.phone,
          customerAltPhone: customer.altPhone,
          customerAddress: customer.address,
          fatherName: customer.fatherName,
          weddingDate: customer.weddingDate,
          safaSize: customer.safaSize,
          notes: customer.notes,
          startDate: dates.start,
          endDate: dates.end,
          items,
          paidAmount: parseFloat(paidAmount || '0'),
          storeId: selectedStore,
          tieSafa,
          // safaShape / safaTyingCount stay populated from the multi-select so
          // existing invoices and order lists keep rendering unchanged.
          safaShape: tieSafa ? selectedStyles.map(s => s.name).join(', ') : null,
          safaTyingCount: tieSafa ? Math.max(1, totalTyingCount) : 1,
          safaTyingStyles: tieSafa ? JSON.stringify(selectedStyles) : null,
          safaTyingName: tieSafa ? safaTyingDetails.name : null,
          safaTyingAddress: tieSafa ? safaTyingDetails.address : null,
          safaTyingTime: tieSafa ? safaTyingDetails.time : null,
          safaTyingDate: tieSafa ? safaTyingDetails.marriageDate : null,
          tieSafaCharge: getSafaCharge(),
          discount: parseFloat(discount || '0'),
          paymentMethod,
        })
      });
      const data = await res.json();
      
      if (!res.ok) alert(data.error || 'Booking failed');
      else {
        // New booking changes rentals, stock and dashboard figures.
        await invalidateAfterRentalChange();
        setRecentBooking(data);
        setShowSuccess(true);
        generateInvoicePDF(data);
        setItems([]);
        setCustomer({ name: '', phone: '', altPhone: '', address: '', fatherName: '', weddingDate: '', safaSize: '', notes: '' });
        setPaidAmount('0');
        setPaymentMethod('CASH');
        setTieSafa(false);
        setTyingQuantities({});
        setDiscount('0');
      }
    } catch (error) {
      alert('Network error during checkout');
    }
    setLoading(false);
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-screen bg-[#f8f9fa] text-slate-900 font-sans flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <div className="bg-white border-b border-slate-100 shrink-0">
        <div className="max-w-full mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-indigo-600 transition-colors">
              <ArrowLeft size={22} />
            </Link>
            <div className="h-10 flex items-center">
              <img src="/assets/logo.png?v=3" alt="Logo" className="h-full w-auto object-contain" />
            </div>
            <h1 className="text-lg font-bold text-slate-800 uppercase tracking-wider">{t('new_rental')}</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleBooking}
              disabled={loading || items.length === 0 || !customer.name || !customer.phone || !dates.start || !dates.end}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-6 py-2 rounded text-base font-bold shadow-sm transition-all"
            >
              {loading ? '...' : t('confirm')}
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 flex overflow-hidden p-2 gap-2">
        {/* COLUMN 1: CUSTOMER DETAILS (35%) */}
        <div className="w-[30%] bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden">
           <div className="p-3 border-b border-slate-50 flex items-center gap-2 shrink-0">
             <User size={18} className="text-indigo-600" />
             <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{t('customer_details')}</h3>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Store Selection */}
              {stores.length > 0 && (
                <div className="relative mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Select Store</label>
                    {user?.role !== 'ADMIN' && user?.storeId && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                        Assigned Store
                      </span>
                    )}
                  </div>
                  <select 
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    disabled={user?.role !== 'ADMIN' && !!user?.storeId}
                    className="w-full px-3 py-2 bg-indigo-50/50 border border-indigo-100 rounded text-sm font-bold text-indigo-900 outline-none focus:border-indigo-500 disabled:opacity-80 disabled:bg-slate-100"
                  >
                    {stores.map(store => (
                      <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Mandatory Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                   <input 
                    type="text" 
                    placeholder={`${t('customer')}${t('mandatory')}`}
                    className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded focus:border-indigo-500 outline-none font-bold text-sm"
                    value={customer.name}
                    onChange={e => setCustomer({...customer, name: e.target.value})}
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder={`${t('phone')}${t('mandatory')}`}
                    className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded focus:border-indigo-500 outline-none font-bold text-sm"
                    value={customer.phone}
                    onChange={e => setCustomer({...customer, phone: e.target.value})}
                  />
                </div>
              </div>

              {/* Alternate Phone (Optional) */}
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Alternate Mobile (Optional)"
                  className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded focus:border-indigo-500 outline-none text-sm font-medium"
                  value={customer.altPhone}
                  onChange={e => setCustomer({...customer, altPhone: e.target.value})}
                />
              </div>

              {/* Extra Info */}
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  placeholder={`${t('father_name')}${t('optional')}`}
                  className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded focus:border-indigo-500 outline-none text-sm"
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
                     className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded focus:border-indigo-500 outline-none text-sm"
                     value={customer.weddingDate}
                     onChange={e => setCustomer({...customer, weddingDate: e.target.value})}
                   />
                </div>
                <div className="relative">
                   <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                   <input 
                     type="text" 
                     placeholder={`${t('safa_size')}${t('optional')}`}
                     className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded focus:border-indigo-500 outline-none text-sm"
                     value={customer.safaSize}
                     onChange={e => setCustomer({...customer, safaSize: e.target.value})}
                   />
                </div>
              </div>

              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-slate-400" size={14} />
                <textarea 
                  placeholder={`${t('address')}${t('optional')}`}
                  className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded focus:border-indigo-500 outline-none h-20 text-sm resize-none"
                  value={customer.address}
                  onChange={e => setCustomer({...customer, address: e.target.value})}
                />
              </div>

              {/* Tie Safa Options */}
              <div className="pt-4 border-t border-slate-100">
                <div 
                  onClick={() => {
                    const next = !tieSafa;
                    setTieSafa(next);
                    // Switching tying on goes straight to the sheet so styles
                    // and quantities get filled in rather than left at zero.
                    if (next) setTyingDialogOpen(true);
                  }}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                    tieSafa 
                      ? 'bg-indigo-50/80 border-indigo-200 shadow-xs' 
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={tieSafa}
                      onChange={(e) => setTieSafa(e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded-md border-gray-300 focus:ring-indigo-500 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div>
                      <span className="text-sm font-bold text-slate-800">
                        Tie Safa Service
                      </span>
                      <p className="text-[11px] font-medium text-slate-500">
                        Professional safa tying service for wedding & events
                      </p>
                    </div>
                  </div>
                  {tieSafa && (
                    <span className="px-2.5 py-1 bg-indigo-600 text-white font-black text-xs rounded-lg shadow-sm">
                      +₹{getSafaCharge()}
                    </span>
                  )}
                </div>
                
                {tieSafa && (
                  <button
                    type="button"
                    onClick={() => setTyingDialogOpen(true)}
                    className="mt-3 w-full text-left bg-gradient-to-br from-indigo-50/60 via-slate-50/80 to-indigo-50/30 p-4 rounded-2xl border border-indigo-100 shadow-xs hover:border-indigo-300 transition-all animate-in fade-in zoom-in-95 duration-200"
                  >
                    {selectedStyles.length === 0 ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black text-slate-800">Choose tying styles</p>
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                            No style selected yet — nothing is being charged
                          </p>
                        </div>
                        <span className="text-[11px] font-black text-indigo-600 shrink-0 ml-3">SELECT</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-slate-800">
                            {totalTyingCount} safa{totalTyingCount === 1 ? '' : 's'} to be tied
                          </p>
                          <span className="text-[11px] font-black text-indigo-600 shrink-0 ml-3">EDIT</span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {selectedStyles.map(s => `${s.name} \u00d7${s.quantity}`).join(', ')}
                        </p>
                        {bookedSafaQty > 0 && totalTyingCount !== bookedSafaQty && (
                          <p className="text-[11px] font-semibold text-amber-600">
                            Booking has {bookedSafaQty} safas but {totalTyingCount} are set to be tied.
                          </p>
                        )}
                      </div>
                    )}
                  </button>
                )}
              </div>

              {/* Rental Period */}
              <div className="pt-2 border-t border-slate-100">
                 <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Rental Period</label>
                 <div className="flex items-center gap-2">
                   <input 
                     type="date" 
                     className="flex-1 px-3 py-3 bg-slate-50 border border-slate-200 rounded text-sm font-bold outline-none focus:border-indigo-500"
                     onChange={e => setDates(prev => ({ ...prev, start: e.target.value }))}
                   />
                   <span className="text-slate-400 text-xs font-bold">TO</span>
                   <input 
                     type="date" 
                     className="flex-1 px-3 py-3 bg-slate-50 border border-slate-200 rounded text-sm font-bold outline-none focus:border-indigo-500"
                     onChange={e => setDates(prev => ({ ...prev, end: e.target.value }))}
                   />
                 </div>
              </div>

              {/* Notes */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t('notes')}</label>
                <textarea 
                  placeholder={`${t('notes')}${t('optional')}`}
                  className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded focus:border-indigo-500 outline-none h-24 text-sm resize-none"
                  value={customer.notes}
                  onChange={e => setCustomer({...customer, notes: e.target.value})}
                />
              </div>
           </div>
        </div>

        {/* COLUMN 2: CATALOG (40%) */}
        <div className="w-[42%] bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden">
           <div className="p-3 border-b border-slate-50 flex justify-between items-center shrink-0">
             <div className="flex items-center gap-2">
               <Package size={16} className="text-indigo-600" />
               <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t('catalog')}</h3>
             </div>
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
               <input 
                 type="text" 
                 placeholder="Search product..."
                 className="pl-9 pr-3 py-1 bg-slate-50 border border-slate-200 rounded text-xs outline-none w-40 focus:w-56 focus:bg-white transition-all"
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
                    onClick={() => addToBooking(p)}
                    className="flex flex-col bg-white border border-slate-200 rounded hover:border-indigo-500 hover:shadow-md transition-all text-left group overflow-hidden"
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
                        <span className="font-black text-indigo-600 text-[12px]">₹{p.rentPrice.toFixed(0)}</span>
                      </div>
                    </div>
                  </button>
                ))}
             </div>
           </div>
        </div>

        {/* COLUMN 3: CART & BILLING (25%) */}
        <div className="w-[28%] flex flex-col gap-2 shrink-0 overflow-hidden">
          {/* Cart Header & Items */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-50 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-2">
                 <ShoppingCart size={18} className="text-indigo-600" />
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
                            <Minus size={10} />
                          </button>
                          <input 
                            type="number" 
                            className="w-10 text-center font-bold text-xs bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={item.quantity}
                            onChange={(e) => setQuantity(item.productId, e.target.value)}
                          />
                          <button onClick={() => updateQuantity(item.productId, 1)} className="p-0.5 hover:bg-slate-50 text-slate-500">
                            <Plus size={10} />
                          </button>
                        </div>
                        <span className="text-xs font-black text-indigo-600">@ ₹{item.pricePerDay.toFixed(0)}</span>
                     </div>
                   </div>
                   <div className="text-right">
                     <p className="font-black text-slate-800 text-sm">₹{(item.pricePerDay * item.quantity).toFixed(0)}</p>
                     <button onClick={() => removeItem(item.productId)} className="text-rose-400 opacity-0 group-hover:opacity-100 transition-all">
                       <X size={14} />
                     </button>
                   </div>
                 </div>
               ))}
            </div>
          </div>

          {/* Billing Summary */}
          <div className="bg-indigo-900 text-white rounded-lg shadow-xl p-4 shrink-0">
             <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-black text-indigo-300 uppercase tracking-widest">
                  <span>Days</span>
                  <span className="text-white text-sm">
                    {dates.start && dates.end 
                      ? (Math.ceil(Math.abs(new Date(dates.end).setHours(0,0,0,0) - new Date(dates.start).setHours(0,0,0,0)) / (1000 * 3600 * 24)) + 1) 
                      : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-black text-indigo-300 uppercase tracking-widest">
                  <span>Item Total</span>
                  <span className="text-white text-sm">₹{items.reduce((s, i) => s + (i.pricePerDay * i.quantity), 0).toFixed(2)}</span>
                </div>
                
                {tieSafa && (
                  <div className="flex justify-between items-center text-xs font-black text-emerald-300 uppercase tracking-widest">
                    <span>
                      Safa Tying Charge
                      {selectedStyles.length > 0 && (
                        <span className="normal-case tracking-normal font-semibold">
                          {' '}({selectedStyles.map(s => `${s.name} ×${s.quantity}`).join(', ')})
                        </span>
                      )}
                    </span>
                    <span className="text-emerald-300 text-sm">+ ₹{getSafaCharge().toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-xs font-black text-rose-300 uppercase tracking-widest mt-1">
                  <span className="flex-1">Discount (Admin)</span>
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50 text-xs">₹</span>
                    <input 
                      type="number" 
                      className="w-full bg-black/20 border border-white/10 rounded px-2 pl-6 py-1 outline-none focus:border-white/30 text-xs font-black text-white"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                    />
                  </div>
                </div>
                
                {/* Payment Method Selector */}
                <div className="pt-2 border-t border-white/10 mt-2">
                  <label className="block text-[11px] font-black text-indigo-300 uppercase tracking-widest mb-1.5">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'CASH', label: '💵 Cash' },
                      { id: 'ONLINE', label: '🌐 Online' },
                    ].map(pm => (
                      <button
                        type="button"
                        key={pm.id}
                        onClick={() => setPaymentMethod(pm.id as any)}
                        className={`py-2 rounded text-xs font-extrabold text-center transition-all ${
                          paymentMethod === pm.id
                            ? 'bg-white text-indigo-950 font-black shadow-md'
                            : 'bg-black/20 text-indigo-200 hover:bg-black/30'
                        }`}
                      >
                        {pm.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Amount & Dynamic Status */}
                <div className="pt-2 border-t border-white/10">
                   <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-black text-indigo-300 uppercase tracking-widest">Advance Paid</label>
                      {/* Dynamic Payment Status Badge */}
                      {(() => {
                        const paid = parseFloat(paidAmount || '0');
                        const total = calculateTotal();
                        if (paid >= total && total > 0) {
                          return <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-400 text-emerald-950 uppercase">FULL PAID</span>;
                        } else if (paid > 0) {
                          return <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-300 text-amber-950 uppercase">PARTIAL PAID</span>;
                        }
                        return <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-400 text-rose-950 uppercase">DUE</span>;
                      })()}
                    </div>
                    <span className="text-xs font-black text-rose-300 uppercase">Due: ₹{Math.max(0, calculateTotal() - parseFloat(paidAmount || '0')).toFixed(0)}</span>
                   </div>
                   <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 text-sm font-black">₹</span>
                    <input 
                      type="number"
                      className="w-full bg-black/20 border border-white/10 rounded px-3 pl-8 py-2 outline-none focus:border-white/30 text-base font-black"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                    />
                   </div>
                </div>

                <div className="pt-3 flex justify-between items-end">
                   <div>
                    <span className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{t('total')}</span>
                    <span className="text-4xl font-black leading-none tracking-tight">₹{calculateTotal().toFixed(0)}</span>
                   </div>
                   <button 
                    onClick={handleBooking}
                    disabled={loading || items.length === 0 || !customer.name || !customer.phone || !dates.start || !dates.end}
                    className="bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 text-white px-6 py-3 rounded font-black text-sm shadow-lg transition-all flex items-center gap-2"
                  >
                    <CreditCard size={18} /> {loading ? '...' : t('confirm')}
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
            <h2 className="text-2xl font-black text-slate-800 mb-1">{t('booking_complete')}</h2>
            <p className="text-xs text-slate-500 mb-6 font-medium">Order <span className="font-mono font-black text-indigo-600">{recentBooking?.orderNumber}</span> created.</p>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => generateInvoicePDF(recentBooking, 'RENTAL', 'download')} className="py-3 px-3 rounded-lg font-black text-xs uppercase tracking-widest bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all border border-emerald-200">
                {t('download_bill')}
              </button>
              <button onClick={() => generateInvoicePDF(recentBooking, 'RENTAL', 'print')} className="py-3 px-3 rounded-lg font-black text-xs uppercase tracking-widest bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all border border-indigo-200">
                {t('print_bill')}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => { setShowSuccess(false); window.location.reload(); }} className="py-3 px-4 rounded-lg font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all border border-slate-200 bg-white">
                {t('new_booking')}
              </button>
              <Link href="/rentals" className="py-3 px-4 rounded-lg font-black text-xs uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg text-center">
                {t('view_all')}
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
        bookedSafaQty={bookedSafaQty}
        details={safaTyingDetails}
        setDetails={setSafaTyingDetails}
      />
    </div>
  );
}
