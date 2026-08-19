'use client';

import React, { useState, useEffect } from 'react';
import { useProducts, useStores, useUsers, useSafaOptions, useArtists, invalidateAfterArtistChange, invalidate, KEYS } from '@/lib/data';
import { PRODUCT_TYPES, UNCATEGORISED, isMeterBased, rateSuffix } from '@/lib/product-types';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Store as StoreIcon, 
  Plus, 
  MapPin, 
  Package, 
  Search, 
  Tag, 
  MoreVertical,
  Users,
  UserPlus,
  ShieldCheck,
  Trash2,
  IndianRupee,
  Edit3,
  Palette,
  Building2,
  BarChart3,
  Clock,
  BookOpen,
  Coins
} from 'lucide-react';
import ProductDialog from '@/components/ProductDialog';
import EditUserDialog from '@/components/EditUserDialog';
import VendorsPanel from '@/components/VendorsPanel';
import WorkingHoursPanel from '@/components/WorkingHoursPanel';
import StorePricesPanel from '@/components/StorePricesPanel';
import ArtistLedgerDialog from '@/components/ArtistLedgerDialog';
import { useAuth } from '@/lib/AuthContext';

interface StoreData {
  id: string;
  name: string;
  location: string | null;
  /** Public asset path for this branch's mark; null means the shop default. */
  logo?: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string;
  category: string | null;
  rentPrice: number;
  salePrice: number;
  discount: number;
  totalQuantity: number;
  availableQuantity: number;
  isRentable: boolean;
  isSellable: boolean;
  image: string | null;
}

interface UserData {
  id: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'SUPER' | 'USER';
  canManageVendors?: boolean;
  storeId: string | null;
  store: { name: string } | null;
}

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'inventory' | 'stores' | 'users' | 'safa_pricing' | 'branch_prices' | 'artists' | 'vendors' | 'hours'>('inventory');
  
  // Stores state
  const [stores, setStores] = useState<StoreData[]>([]);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreLocation, setNewStoreLocation] = useState('');
  const [addStoreLoading, setAddStoreLoading] = useState(false);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Users State
  const [users, setUsers] = useState<UserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'SUPER' | 'USER'>('USER');
  const [newStoreId, setNewStoreId] = useState('');
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // Artists
  const [artistName, setArtistName] = useState('');
  const [artistPhone, setArtistPhone] = useState('');
  const [artistAddress, setArtistAddress] = useState('');
  const [artistRate, setArtistRate] = useState('0');
  const [editingArtist, setEditingArtist] = useState<any | null>(null);
  const [artistLoading, setArtistLoading] = useState(false);
  const [artistLedger, setArtistLedger] = useState<any | null>(null);

  // Dynamic Safa Options State
  const [safaOptions, setSafaOptions] = useState<any[]>([]);
  const [editingSafaOption, setEditingSafaOption] = useState<any | null>(null);
  const [safaOptionName, setSafaOptionName] = useState('');
  const [safaOptionPrice, setSafaOptionPrice] = useState('50');
  const [safaOptionLoading, setSafaOptionLoading] = useState(false);

  // All four admin lists are cached. The fetchX helpers below are kept so the
  // existing post-mutation call sites still work — they now force a
  // revalidation of that one key instead of an uncached refetch.
  const storesSWR = useStores();
  const productsSWR = useProducts();
  const usersSWR = useUsers();
  const safaOptionsSWR = useSafaOptions();
  const artistsSWR = useArtists();
  const artists: any[] = Array.isArray(artistsSWR.data) ? artistsSWR.data : [];

  useEffect(() => {
    setStores(Array.isArray(storesSWR.data) ? storesSWR.data : []);
  }, [storesSWR.data]);

  useEffect(() => {
    setProducts(Array.isArray(productsSWR.data) ? productsSWR.data : []);
    setProductsLoading(productsSWR.isLoading);
  }, [productsSWR.data, productsSWR.isLoading]);

  useEffect(() => {
    setUsers(Array.isArray(usersSWR.data) ? usersSWR.data : []);
    setUsersLoading(usersSWR.isLoading);
  }, [usersSWR.data, usersSWR.isLoading]);

  useEffect(() => {
    setSafaOptions(Array.isArray(safaOptionsSWR.data) ? safaOptionsSWR.data : []);
  }, [safaOptionsSWR.data]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchStores = () => storesSWR.mutate();
  const fetchProducts = () => productsSWR.mutate();
  const fetchUsers = () => usersSWR.mutate();
  const fetchSafaOptions = () => safaOptionsSWR.mutate();

  const resetArtistForm = () => {
    setEditingArtist(null);
    setArtistName('');
    setArtistPhone('');
    setArtistAddress('');
    setArtistRate('0');
  };

  const handleSaveArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artistName.trim()) return;
    setArtistLoading(true);
    try {
      const res = await fetch('/api/artists', {
        method: editingArtist ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingArtist ? { id: editingArtist.id } : {}),
          name: artistName,
          phone: artistPhone,
          address: artistAddress,
          ratePerPiece: parseFloat(artistRate || '0') || 0,
        }),
      });
      if (res.ok) {
        resetArtistForm();
        await invalidateAfterArtistChange();
        artistsSWR.mutate();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save artist');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving artist');
    } finally {
      setArtistLoading(false);
    }
  };

  const handleDeleteArtist = async (artist: any) => {
    if (!window.confirm(`Remove artist "${artist.name}"?`)) return;
    try {
      const res = await fetch(`/api/artists?id=${artist.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        // Artists with orders against them are deactivated, not deleted.
        if (data?.message) alert(data.message);
        await invalidateAfterArtistChange();
        artistsSWR.mutate();
      } else {
        alert(data.error || 'Failed to remove artist');
      }
    } catch (err: any) {
      alert(err.message || 'Error removing artist');
    }
  };

  const handleToggleArtistActive = async (artist: any) => {
    try {
      const res = await fetch('/api/artists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: artist.id, isActive: !artist.isActive }),
      });
      if (res.ok) {
        await invalidateAfterArtistChange();
        artistsSWR.mutate();
      }
    } catch {
      /* surfaced by the list not changing */
    }
  };

  const handleSaveSafaOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safaOptionName) return;
    setSafaOptionLoading(true);

    try {
      const isEdit = !!editingSafaOption;
      const url = '/api/safa-options';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = isEdit 
        ? { id: editingSafaOption.id, name: safaOptionName, price: parseFloat(safaOptionPrice || '0') }
        : { name: safaOptionName, price: parseFloat(safaOptionPrice || '0') };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditingSafaOption(null);
        setSafaOptionName('');
        setSafaOptionPrice('50');
        fetchSafaOptions();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save safa option');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving safa option');
    } finally {
      setSafaOptionLoading(false);
    }
  };

  const handleDeleteSafaOption = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" safa style?`)) return;

    try {
      const res = await fetch(`/api/safa-options?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSafaOptions();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete option');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting option');
    }
  };

  /** Set which mark a branch trades under. '' puts it back on the default. */
  const handleSetStoreLogo = async (id: string, logo: string) => {
    try {
      const res = await fetch('/api/stores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, logo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Could not change the logo');
        return;
      }
      await invalidate(KEYS.stores, '/api/branding');
    } catch (err: any) {
      alert(err.message || 'Could not change the logo');
    }
  };

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName) return;
    
    setAddStoreLoading(true);
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStoreName, location: newStoreLocation }),
      });
      
      if (res.ok) {
        setNewStoreName('');
        setNewStoreLocation('');
        fetchStores();
      } else {
        alert('Failed to add store');
      }
    } catch (error) {
      console.error(error);
    }
    setAddStoreLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword || !newName) return;

    setCreateUserLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          name: newName,
          role: newRole,
          storeId: newStoreId || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNewUsername('');
        setNewPassword('');
        setNewName('');
        setNewRole('USER');
        setNewStoreId('');
        fetchUsers();
      } else {
        alert(data.error || 'Failed to create user');
      }
    } catch (error) {
      console.error(error);
      alert('Error creating user');
    } finally {
      setCreateUserLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchUsers();
      else alert('Failed to delete user');
    } catch (error) {
      console.error(error);
    }
  };

  // Chips are multi-select: no chip active means show everything, otherwise
  // show products in any of the selected categories.
  const typeOf = (p: any) => p.productType || UNCATEGORISED;

  const availableTypes = React.useMemo(() => {
    const present = new Set(products.map(typeOf));
    // Keep the canonical order, then append anything unexpected in the data.
    const ordered: string[] = PRODUCT_TYPES.filter(t => present.has(t));
    const extras = [...present].filter(t => !PRODUCT_TYPES.includes(t as any)).sort();
    return [...ordered, ...extras];
  }, [products]);

  const countByType = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) counts[typeOf(p)] = (counts[typeOf(p)] ?? 0) + 1;
    return counts;
  }, [products]);

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const filteredProducts = products.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      (p as any).productType?.toLowerCase().includes(q);
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(typeOf(p));
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 font-sans">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
                <ArrowLeft size={20} />
              </Link>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Admin Dashboard</h1>
            </div>

          </div>

          {/* Its own row: beside the title the strip had to scroll and
              clipped the last tab. */}
          <div className="pb-3">
            {/* Tab Controls */}
            <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto [&>*]:shrink-0">
              <button 
                onClick={() => setActiveTab('inventory')}
                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === 'inventory' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Package size={16} /> Inventory
              </button>
              <button 
                onClick={() => setActiveTab('stores')}
                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === 'stores' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <StoreIcon size={16} /> Stores
              </button>
              <button 
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === 'users' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users size={16} /> Users & Roles
              </button>
              <button
                onClick={() => setActiveTab('artists')}
                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === 'artists'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Palette size={16} /> Artists
              </button>
              <button
                onClick={() => setActiveTab('hours')}
                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === 'hours'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Clock size={16} /> Working Hours
              </button>
              <Link
                href="/admin/reports"
                className="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 text-slate-500 hover:text-slate-800"
              >
                <BarChart3 size={16} /> Reports
              </Link>
              <button
                onClick={() => setActiveTab('vendors')}
                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === 'vendors'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building2 size={16} /> Vendors
              </button>
              <button
                onClick={() => setActiveTab('branch_prices')}
                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === 'branch_prices'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Coins size={16} /> Branch Prices &amp; Stock
              </button>
              <button 
                onClick={() => setActiveTab('safa_pricing')}
                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === 'safa_pricing' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <IndianRupee size={16} /> Safa Tying Rates
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Inventory Management</h2>
                <p className="text-xs text-slate-500 font-medium">Manage all products, pricing, stock levels, and rentals.</p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search product or SKU..."
                    className="pl-10 pr-4 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-lg outline-none w-full sm:w-64 text-sm font-medium transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-bold text-sm shadow-sm shrink-0"
                >
                  <Plus size={18} /> New Product
                </button>
              </div>
            </div>

            {/* Category chips — multi-select; none selected shows everything */}
            {availableTypes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => setSelectedTypes([])}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    selectedTypes.length === 0
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  All
                  <span className={`ml-1.5 ${selectedTypes.length === 0 ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {products.length}
                  </span>
                </button>

                {availableTypes.map(type => {
                  const active = selectedTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {type}
                      <span className={`ml-1.5 ${active ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {countByType[type] ?? 0}
                      </span>
                    </button>
                  );
                })}

                {selectedTypes.length > 0 && (
                  <span className="text-xs font-semibold text-slate-500 ml-1">
                    {filteredProducts.length} shown
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {productsLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
                    <div className="w-full h-40 bg-slate-100 rounded-lg mb-4"></div>
                    <div className="h-4 bg-slate-100 rounded w-2/3 mb-2"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                  </div>
                ))
              ) : filteredProducts.length === 0 ? (
                <div className="col-span-full bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 font-medium">
                  No products found. Click "New Product" to add one.
                </div>
              ) : filteredProducts.map(product => (
                <div key={product.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-xl hover:border-indigo-200 transition-all group relative">
                  <div className="h-40 bg-slate-50 border-b border-slate-100 flex items-center justify-center overflow-hidden relative">
                    {(product as any).image ? (
                      <img src={(product as any).image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <Package size={48} className="text-slate-200 group-hover:text-indigo-200 transition-colors" />
                    )}
                    <span
                      className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-black shadow-sm ${
                        (product as any).productType
                          ? 'bg-white/95 text-indigo-700'
                          : 'bg-slate-200/95 text-slate-500'
                      }`}
                    >
                      {(product as any).productType || UNCATEGORISED}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="bg-slate-100 p-2 rounded-lg text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                        <Tag size={18} />
                      </div>
                      <div className="relative">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === product.id ? null : product.id);
                          }}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors"
                        >
                          <MoreVertical size={18} />
                        </button>
                        
                        {activeMenuId === product.id && (
                          <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-20 py-1">
                            <button 
                              onClick={() => {
                                setSelectedProduct(product);
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 font-medium"
                            >
                              Update Stock
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedProduct(product);
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 font-medium"
                            >
                              Edit Details
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {product.name}
                      </h3>
                      <p className="text-xs text-slate-400 mb-4 font-mono">{product.sku}</p>
                      
                      <div className="flex gap-2 mb-4">
                        {product.isRentable && (
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase">
                            Rentable
                          </span>
                        )}
                        {product.isSellable && (
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">
                            Sellable
                          </span>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-50 grid grid-cols-1 gap-2">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rent Price</p>
                          <p className={`font-bold ${product.isRentable ? 'text-slate-800' : 'text-slate-300 line-through'}`}>
                            ₹{product.rentPrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sale Price</p>
                          <p className={`font-bold ${product.isSellable ? 'text-slate-800' : 'text-slate-300 line-through'}`}>
                            ₹{product.salePrice.toFixed(2)}
                          </p>
                        </div>
                        {!!product.discount && product.discount > 0 && (
                          <div className="flex justify-between items-center">
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Item Discount</p>
                            <p className="font-bold text-emerald-600">
                              -₹{product.discount.toFixed(2)}
                            </p>
                          </div>
                        )}
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available</p>
                          <p className={`font-bold ${product.availableQuantity > 5 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {product.availableQuantity} / {product.totalQuantity}{isMeterBased(product as any) ? ' m' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STORES TAB */}
        {activeTab === 'stores' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6">
                <StoreIcon className="text-indigo-600" />
                <h2 className="text-xl font-bold text-slate-800">Add New Store</h2>
              </div>
              
              <form onSubmit={handleAddStore} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Store Name</label>
                  <input 
                    type="text" 
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder="e.g. Main Branch"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:border-indigo-500 outline-none font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Location / Address</label>
                  <input 
                    type="text" 
                    value={newStoreLocation}
                    onChange={(e) => setNewStoreLocation(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:border-indigo-500 outline-none font-medium"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={addStoreLoading || !newStoreName}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg disabled:opacity-50 transition-all shadow-sm"
                >
                  <Plus size={18} />
                  {addStoreLoading ? 'Adding...' : 'Add Store'}
                </button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-6">Existing Stores</h2>
              {stores.length === 0 ? (
                <p className="text-slate-500 text-sm font-medium">No stores found.</p>
              ) : (
                <div className="space-y-3">
                  {stores.map(store => (
                    <div key={store.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-slate-800">{store.name}</h3>
                          {store.location && (
                            <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
                              <MapPin size={14} />
                              <span>{store.location}</span>
                            </div>
                          )}
                        </div>
                        <img
                          src={store.logo || '/assets/logo.png?v=4'}
                          alt=""
                          className="h-10 w-auto object-contain shrink-0"
                        />
                      </div>

                      {/* Which mark this branch trades under. Partapur's
                          customers know the Joshi bill; the newer branches
                          bill as Safa King. It shows on their screens and on
                          every bill they raise. */}
                      <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">
                          Logo
                        </span>
                        {[
                          { label: 'Safa King', value: '' },
                          { label: 'Joshi Safa House', value: '/assets/logo-joshi.png' },
                        ].map(opt => {
                          const active = (store.logo || '') === opt.value;
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() => handleSetStoreLogo(store.id, opt.value)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                                active
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Create User Form (Admin only) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <UserPlus className="text-indigo-600" />
                <h2 className="text-xl font-bold text-slate-800">Create New User</h2>
              </div>
              
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name</label>
                  <input 
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:border-indigo-500 outline-none text-sm font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Username</label>
                  <input 
                    type="text" 
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. ramesh"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:border-indigo-500 outline-none text-sm font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Password</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:border-indigo-500 outline-none text-sm font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Assigned Role</label>
                  <select 
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:border-indigo-500 outline-none text-sm font-bold text-indigo-900 bg-indigo-50/50"
                  >
                    <option value="ADMIN">ADMIN (Full Control & All Stores)</option>
                    <option value="SUPER">SUPER (Cash book, artists & store control)</option>
                    <option value="USER">USER (POS & rental booking)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Assign to Store</label>
                  <select 
                    value={newStoreId}
                    onChange={(e) => setNewStoreId(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:border-indigo-500 outline-none text-sm font-medium"
                    required={newRole === 'USER' || newRole === 'SUPER'}
                  >
                    <option value="">{newRole === 'ADMIN' ? 'All Stores (Admin Access)' : '-- Select Store --'}</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.location || 'Main'})</option>
                    ))}
                  </select>
                  {newRole === 'USER' && (
                    <p className="text-[11px] text-slate-400 font-medium mt-1">User will only be allowed to operate in this store.</p>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={createUserLoading || !newUsername || !newPassword || !newName || (newRole === 'USER' && !newStoreId)}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg disabled:opacity-50 transition-all shadow-sm text-sm"
                >
                  <UserPlus size={18} />
                  {createUserLoading ? 'Creating...' : 'Create User'}
                </button>
              </form>
            </div>

            {/* List of Users */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">System Users</h2>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase">{users.length} Users</span>
              </div>

              {usersLoading ? (
                <div className="space-y-3">
                  {Array(3).fill(0).map((_, i) => (
                    <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse"></div>
                  ))}
                </div>
              ) : users.length === 0 ? (
                <p className="text-slate-500 text-sm font-medium">No users found.</p>
              ) : (
                <div className="space-y-3">
                  {users.map(u => (
                    <div key={u.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 font-black flex items-center justify-center text-sm uppercase">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 text-sm">{u.name}</h3>
                            <span className="text-xs font-mono text-slate-400">(@{u.username})</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              u.role === 'ADMIN' 
                                ? 'bg-rose-100 text-rose-700' 
                                : u.role === 'SUPER' 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-blue-100 text-blue-700'
                            }`}>
                              {u.role}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-200/60 px-2 py-0.5 rounded-full">
                              📍 {u.store?.name || 'All Stores'}
                            </span>
                            {u.canManageVendors && u.role === 'SUPER' && (
                              <span className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                                Vyapari
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Edit user, reset password"
                      >
                        <Edit3 size={18} />
                      </button>
                      {currentUser?.username !== u.username && (
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Delete User"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SAFA TYING RATES & STYLES TAB */}
        {activeTab === 'artists' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white border border-slate-200 rounded-xl p-5 sticky top-24">
                <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <Palette size={18} className="text-indigo-600" />
                  {editingArtist ? 'Edit Artist' : 'Register Artist'}
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Artists available to allocate to safa tying orders.
                </p>
                <form onSubmit={handleSaveArtist} className="space-y-3">
                  <input
                    required
                    type="text"
                    placeholder="Artist name"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium"
                    value={artistName}
                    onChange={e => setArtistName(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Phone (optional)"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium"
                    value={artistPhone}
                    onChange={e => setArtistPhone(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Address (optional)"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium"
                    value={artistAddress}
                    onChange={e => setArtistAddress(e.target.value)}
                  />
                  <div>
                    <label className="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
                      प्रति साफा रेट (Rate per safa ₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 font-bold text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        className="w-full pl-7 pr-3 py-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-indigo-900"
                        value={artistRate}
                        onChange={e => setArtistRate(e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Only shown in Artist Payment report</p>
                  </div>
                  <button
                    type="submit"
                    disabled={artistLoading || !artistName.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-2.5 rounded-xl font-bold text-sm transition-all"
                  >
                    {artistLoading ? 'Saving…' : editingArtist ? 'Update Artist' : 'Add Artist'}
                  </button>
                  {editingArtist && (
                    <button
                      type="button"
                      onClick={resetArtistForm}
                      className="w-full text-slate-500 font-medium py-1 text-xs hover:text-slate-700"
                    >
                      Cancel edit
                    </button>
                  )}
                </form>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-3">
              {artists.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 font-medium">
                  No artists registered yet.
                </div>
              ) : (
                artists.map(artist => (
                  <div
                    key={artist.id}
                    className={`bg-white border rounded-xl p-4 flex items-center justify-between gap-4 ${
                      artist.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        {artist.name}
                        {!artist.isActive && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-black uppercase">
                            Inactive
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 font-medium truncate">
                        {[artist.phone, artist.address].filter(Boolean).join(' · ') || 'No contact details'}
                      </p>
                      {artist.ratePerPiece > 0 && (
                        <p className="text-xs font-bold text-indigo-600 mt-0.5">
                          ₹{artist.ratePerPiece}/safa
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleArtistActive(artist)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                      >
                        {artist.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingArtist(artist);
                          setArtistName(artist.name || '');
                          setArtistPhone(artist.phone || '');
                          setArtistAddress(artist.address || '');
                          setArtistRate(artist.ratePerPiece?.toString() || '0');
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        title="Edit artist"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => setArtistLedger(artist)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-600 transition-colors"
                        title="Ledger / खाता बही"
                      >
                        <BookOpen size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteArtist(artist)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'vendors' && <VendorsPanel />}

        {activeTab === 'hours' && <WorkingHoursPanel />}

        {activeTab === 'branch_prices' && <StorePricesPanel />}

        {activeTab === 'safa_pricing' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center font-bold shrink-0">
                  <IndianRupee size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Safa Tying Styles & Pricing</h2>
                  <p className="text-xs text-slate-500 font-medium">Add, edit, or remove custom Safa tying options and their rates.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Add / Edit Form Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit space-y-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center justify-between">
                  <span>{editingSafaOption ? 'Edit Safa Style' : 'Add New Safa Style'}</span>
                  {editingSafaOption && (
                    <button 
                      onClick={() => {
                        setEditingSafaOption(null);
                        setSafaOptionName('');
                        setSafaOptionPrice('50');
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Cancel Edit
                    </button>
                  )}
                </h3>

                <form onSubmit={handleSaveSafaOption} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Style Name *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Royal Groom Safa"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                      value={safaOptionName}
                      onChange={e => setSafaOptionName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Tying Rate (₹) *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">₹</span>
                      <input 
                        type="number"
                        step="0.01"
                        required
                        className="w-full pl-8 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                        value={safaOptionPrice}
                        onChange={e => setSafaOptionPrice(e.target.value)}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={safaOptionLoading || !safaOptionName}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    {safaOptionLoading ? 'Saving...' : editingSafaOption ? <><Edit3 size={16} /> Update Safa Style</> : <><Plus size={16} /> Add Safa Style</>}
                  </button>
                </form>
              </div>

              {/* Safa Options List */}
              <div className="md:col-span-2 space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Active Safa Tying Options ({safaOptions.length})</p>

                {safaOptions.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                    No safa tying styles added yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {safaOptions.map((opt: any) => (
                      <div key={opt.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-indigo-200 transition-all">
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{opt.name}</h4>
                          <p className="text-xs font-black text-indigo-600 mt-0.5">₹{parseFloat(opt.price || '0').toFixed(2)} / pc</p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingSafaOption(opt);
                              setSafaOptionName(opt.name);
                              setSafaOptionPrice(opt.price?.toString() || '50');
                            }}
                            className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                            title="Edit Style"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteSafaOption(opt.id, opt.name)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                            title="Delete Style"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Product Dialog for Create/Edit */}
      <EditUserDialog
        user={editingUser}
        stores={stores}
        onClose={() => setEditingUser(null)}
        onSuccess={() => {
          setEditingUser(null);
          fetchUsers();
        }}
      />

      {selectedProduct !== undefined && (
        <ProductDialog 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(undefined)} 
          onSuccess={() => {
            setSelectedProduct(undefined);
            fetchProducts();
          }} 
        />
      )}

      {artistLedger && (
        <ArtistLedgerDialog
          artist={artistLedger}
          onClose={() => setArtistLedger(null)}
        />
      )}
    </div>
  );
}
