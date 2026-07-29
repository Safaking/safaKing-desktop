'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Package, Plus, Trash2 } from 'lucide-react';

interface ProductDialogProps {
  product?: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProductDialog({ product, onClose, onSuccess }: ProductDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    rentPrice: '0',
    salePrice: '0',
    discount: '0',
    totalQuantity: '0',
    isRentable: true,
    isSellable: true,
    description: '',
    image: '',
  });
  const [loading, setLoading] = useState(false);

  const generateSku = () => {
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    return `JSH-${randomCode}`;
  };

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        category: product.category || '',
        rentPrice: product.rentPrice?.toString() || '0',
        salePrice: product.salePrice?.toString() || '0',
        discount: product.discount?.toString() || '0',
        totalQuantity: product.totalQuantity?.toString() || '0',
        isRentable: product.isRentable ?? true,
        isSellable: product.isSellable ?? true,
        description: product.description || '',
        image: product.image || '',
      });
    } else {
      setFormData(prev => ({
        ...prev,
        sku: generateSku(),
      }));
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const formattedBody = {
      ...formData,
      rentPrice: parseFloat(formData.rentPrice || '0'),
      salePrice: parseFloat(formData.salePrice || '0'),
      discount: parseFloat(formData.discount || '0'),
      totalQuantity: parseInt(formData.totalQuantity || '0'),
    };

    const method = product ? 'PUT' : 'POST';
    const res = await fetch('/api/products', {
      method,
      body: JSON.stringify(product ? { ...formattedBody, id: product.id } : formattedBody),
    });

    if (res.ok) {
      onSuccess();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to save product');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Package size={20} className="text-indigo-600" /> 
            {product ? 'Edit Product' : 'Create New Product'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Product Name</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-medium"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">SKU / Reference</label>
                {!product && (
                  <button 
                    type="button" 
                    onClick={() => setFormData({ ...formData, sku: generateSku() })}
                    className="text-[10px] text-indigo-600 font-bold hover:underline"
                  >
                    Auto-Generate
                  </button>
                )}
              </div>
              <input 
                required
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-mono text-sm"
                value={formData.sku}
                onChange={e => setFormData({...formData, sku: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Category</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-medium"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Product Image</label>
              <div className="flex gap-4 items-start">
                <div className="w-24 h-24 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                  {formData.image ? (
                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Package size={32} className="text-slate-300" />
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 font-bold text-xs cursor-pointer hover:bg-indigo-100 transition-all">
                      <Plus size={14} /> Import from Computer
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFormData({ ...formData, image: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {formData.image && (
                      <button 
                        type="button" 
                        onClick={() => setFormData({ ...formData, image: '' })}
                        className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-100 font-bold text-xs hover:bg-rose-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Or paste image URL..."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-xs transition-all"
                      value={formData.image.startsWith('data:') ? '' : formData.image}
                      onChange={e => setFormData({...formData, image: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Rental Price</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <input 
                  required
                  type="number" 
                  step="0.01"
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold"
                  value={formData.rentPrice}
                  onChange={e => setFormData({...formData, rentPrice: e.target.value})}
                  disabled={!formData.isRentable}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Sale Price</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <input 
                  required
                  type="number" 
                  step="0.01"
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold"
                  value={formData.salePrice}
                  onChange={e => setFormData({...formData, salePrice: e.target.value})}
                  disabled={!formData.isSellable}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Default Item Discount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">₹</span>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="0"
                  className="w-full pl-8 pr-4 py-3 bg-emerald-50/50 border border-emerald-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all font-bold text-emerald-900"
                  value={formData.discount}
                  onChange={e => setFormData({...formData, discount: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">In Stock</label>
              <input 
                required
                type="number" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold"
                value={formData.totalQuantity}
                onChange={e => setFormData({...formData, totalQuantity: e.target.value})}
              />
            </div>
          </div>

          <div className="flex gap-8 mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                checked={formData.isRentable}
                onChange={e => setFormData({...formData, isRentable: e.target.checked})}
              />
              <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Can be Rented</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                checked={formData.isSellable}
                onChange={e => setFormData({...formData, isSellable: e.target.checked})}
              />
              <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Can be Sold</span>
            </label>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              {loading ? 'Saving...' : <><Save size={18} /> {product ? 'Update Product' : 'Create Product'}</>}
            </button>
            <button type="button" onClick={onClose} className="w-full text-slate-500 font-medium py-2 hover:text-slate-700 transition-colors text-sm">
              Discard Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
