'use client';

import { useState } from 'react';
import { Package, X, ZoomIn } from 'lucide-react';

/**
 * A product's photograph, small in a list and full size when tapped.
 *
 * "बहुत बार स्लिप खो जाती है तो फोटो देखकर माल ढूंढ सकते हैं" — when the slip
 * goes missing, the photograph is how the goods are found on the shelf. So
 * every order line shows one, and tapping it fills the screen: a thumbnail
 * the size of a stamp is no use for telling one red safa from another.
 *
 * The photo is fetched from /api/products/[id]/image rather than carried in
 * the order response, which is what keeps a listing of orders small — the
 * photos are base64 and once made a seven-sale listing 809 KB. Products with
 * no photograph answer 404, and this quietly shows a box instead.
 */
export function ProductPhoto({
  productId,
  updatedAt,
  name,
  size = 44,
}: {
  productId?: string | null;
  updatedAt?: string | null;
  name?: string | null;
  /** Thumbnail edge in pixels. */
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState(false);

  if (!productId) return null;

  const stamp = updatedAt ? `?v=${new Date(updatedAt).getTime()}` : '';
  const src = `/api/products/${productId}/image${stamp}`;

  return (
    <>
      <button
        type="button"
        onClick={() => !missing && setOpen(true)}
        disabled={missing}
        title={missing ? 'No photo for this product' : 'Tap to see it big'}
        aria-label={missing ? 'No photo' : `See ${name ?? 'this product'} full size`}
        style={{ width: size, height: size }}
        className="group relative shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
      >
        {missing ? (
          <Package size={Math.round(size * 0.45)} className="m-auto text-slate-300" />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={name ?? ''}
              loading="lazy"
              decoding="async"
              onError={() => setMissing(true)}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 hidden items-center justify-center bg-slate-900/40 group-hover:flex">
              <ZoomIn size={Math.round(size * 0.38)} className="text-white" />
            </span>
          </>
        )}
      </button>

      {open && <PhotoLightbox src={src} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The photograph filling the screen, with its name underneath. */
export function PhotoLightbox({
  src,
  name,
  onClose,
}: {
  src: string;
  name?: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-slate-900/90 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-2 text-white/80 hover:bg-white/10"
        >
          <X size={20} />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name ?? ''}
          onClick={(event) => event.stopPropagation()}
          className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
        />
      </div>
      {name && <p className="pb-2 pt-3 text-center text-sm font-bold text-white/90">{name}</p>}
    </div>
  );
}
