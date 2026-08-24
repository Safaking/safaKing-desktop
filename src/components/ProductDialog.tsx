'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Package, Plus, Trash2, Loader2 } from 'lucide-react';
import { PRODUCT_TYPES, isMeterBased } from '@/lib/product-types';

interface ProductDialogProps {
  product?: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.75): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = () => resolve(event.target?.result as string);
    };
    reader.onerror = () => resolve('');
  });
};

export default function ProductDialog({ product, onClose, onSuccess }: ProductDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    productType: '',
    rentPrice: '0',
    salePrice: '0',
    discount: '0',
    totalQuantity: '0',
    isRentable: true,
    isSellable: true,
    description: '',
    image: '',
  });
  const [alternateImages, setAlternateImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [altImageCompressing, setAltImageCompressing] = useState(false);

  // Poli is cut from a roll: its stock is metres and its rate is per metre.
  const meterBased = isMeterBased({ productType: formData.productType });

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
        productType: (product as any).productType || '',
        rentPrice: product.rentPrice?.toString() || '0',
        salePrice: product.salePrice?.toString() || '0',
        discount: product.discount?.toString() || '0',
        totalQuantity: product.totalQuantity?.toString() || '0',
        isRentable: product.isRentable ?? true,
        isSellable: product.isSellable ?? true,
        description: product.description || '',
        image: product.image || '',
      });
      setAlternateImages(Array.isArray(product.alternateImages) ? product.alternateImages : []);
    } else {
      setFormData(prev => ({
        ...prev,
        sku: generateSku(),
      }));
      setAlternateImages([]);
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (imageCompressing || altImageCompressing) {
      alert('Please wait while the image is being processed');
      return;
    }
    setLoading(true);
    
    try {
      const formattedBody = {
        ...formData,
        rentPrice: parseFloat(formData.rentPrice || '0'),
        salePrice: parseFloat(formData.salePrice || '0'),
        discount: parseFloat(formData.discount || '0'),
        totalQuantity: parseInt(formData.totalQuantity || '0'),
        alternateImages,
      };

      const method = product ? 'PUT' : 'POST';
      const res = await fetch('/api/products', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(product ? { ...formattedBody, id: product.id } : formattedBody),
      });

      if (res.ok) {
        onSuccess();
      } else {
        let errorMessage = 'Failed to save product';
        try {
          const data = await res.json();
          errorMessage = data.error || errorMessage;
        } catch {
          if (res.status === 413) {
            errorMessage = 'Image size is too large for the server. Please choose a smaller photo.';
          } else {
            errorMessage = `Server error (${res.status})`;
          }
        }
        alert(errorMessage);
      }
    } catch (err: any) {
      console.error('Error saving product:', err);
      alert(err.message || 'Network error while saving product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* The form is taller than a laptop viewport, so the panel is capped and
          only the fields scroll — otherwise the header (and its close button)
          scrolled off the top of the screen and became unreachable. */}
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Package size={20} className="text-indigo-600" /> 
            {product ? 'Edit Product' : 'Create New Product'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          {/* Fields scroll; the actions below stay pinned. */}
          <div className="flex-1 overflow-y-auto p-6">
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
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-medium"
                value={formData.productType}
                onChange={e => setFormData({...formData, productType: e.target.value})}
              >
                <option value="">Select category…</option>
                {PRODUCT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                Fabric <span className="normal-case tracking-normal text-slate-300">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. silk, poli"
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
                      {imageCompressing ? (
                        <>
                          <Loader2 size={14} className="animate-spin text-indigo-600" /> Optimizing Image...
                        </>
                      ) : (
                        <>
                          <Plus size={14} /> Import from Computer
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        disabled={imageCompressing}
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setImageCompressing(true);
                            try {
                              const compressedDataUrl = await compressImage(file);
                              setFormData(prev => ({ ...prev, image: compressedDataUrl }));
                            } catch (err) {
                              console.error('Failed to compress image', err);
                            } finally {
                              setImageCompressing(false);
                            }
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

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Alternate Photos <span className="normal-case tracking-normal text-slate-300">(shown as a gallery on the website — angles, close-ups, etc.)</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {alternateImages.map((src, i) => (
                  <div key={i} className="relative w-20 h-20 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden group">
                    <img src={src} alt={`Alternate ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setAlternateImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      aria-label={`Remove alternate photo ${i + 1}`}
                    >
                      <Trash2 size={16} className="text-white" />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 flex flex-col items-center justify-center gap-1 bg-indigo-50 text-indigo-600 rounded-xl border border-dashed border-indigo-200 font-bold text-[10px] cursor-pointer hover:bg-indigo-100 transition-all">
                  {altImageCompressing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={16} />
                      Add Photo
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={altImageCompressing}
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setAltImageCompressing(true);
                      try {
                        const compressedDataUrl = await compressImage(file);
                        setAlternateImages(prev => [...prev, compressedDataUrl]);
                      } catch (err) {
                        console.error('Failed to compress alternate image', err);
                      } finally {
                        setAltImageCompressing(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Rental Price{meterBased && ' / metre'}</label>
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
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Sale Price{meterBased && ' / metre'}</label>
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
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{meterBased ? 'Stock (metres)' : 'In Stock'}</label>
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

          </div>

          <div className="shrink-0 flex flex-col gap-3 border-t border-slate-100 bg-white px-6 py-4">
            <button 
              type="submit"
              disabled={loading || imageCompressing || altImageCompressing}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Saving...
                </>
              ) : imageCompressing || altImageCompressing ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Optimizing Image...
                </>
              ) : (
                <>
                  <Save size={18} /> {product ? 'Update Product' : 'Create Product'}
                </>
              )}
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
