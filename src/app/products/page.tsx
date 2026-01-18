'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Package, 
  Filter, 
  ArrowLeft,
  MoreVertical,
  Tag,
  Layers,
  Archive
} from 'lucide-react';
import Link from 'next/link';
import ProductDialog from '@/components/ProductDialog';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  rentPrice: number;
  salePrice: number;
  totalQuantity: number;
  availableQuantity: number;
  isRentable: boolean;
  isSellable: boolean;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null | undefined>(undefined); // undefined = closed, null = new
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchProducts = () => {
    setLoading(true);
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
      });
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft size={20} className="text-slate-500" />
              </Link>
              <h1 className="text-xl font-semibold text-slate-800">Inventory</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Items, category..."
                  className="pl-10 pr-4 py-2 bg-slate-100 border-transparent border focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-lg outline-none w-64 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setSelectedProduct(null)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-sm"
              >
                <Plus size={18} /> New Product
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            Array(8).fill(0).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
                <div className="w-full h-40 bg-slate-100 rounded-lg mb-4"></div>
                <div className="h-4 bg-slate-100 rounded w-2/3 mb-2"></div>
                <div className="h-4 bg-slate-100 rounded w-1/2"></div>
              </div>
            ))
          ) : filteredProducts.map(product => (
            <div key={product.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-xl hover:border-indigo-200 transition-all group relative">
              <div className="h-40 bg-slate-50 border-b border-slate-100 flex items-center justify-center overflow-hidden">
                {(product as any).image ? (
                  <img src={(product as any).image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <Package size={48} className="text-slate-200 group-hover:text-indigo-200 transition-colors" />
                )}
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
                      <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-20 py-1 animate-in fade-in zoom-in duration-200">
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
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available</p>
                      <p className={`font-bold ${product.availableQuantity > 5 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {product.availableQuantity} / {product.totalQuantity}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>
      </main>

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
    </div>
  );
}
