/**
 * Where to find a product's photo.
 *
 * The catalog listing no longer carries the photos themselves — they were
 * 6.5 MB of the 6.8 MB response — so screens point at this URL and let the
 * browser fetch and cache each one.
 *
 * updatedAt is in the URL on purpose: it makes the response safe to cache
 * forever, while a replaced photo still appears immediately because it comes
 * back under a different URL.
 */
export function productImageUrl(product: any): string | null {
  if (!product?.id) return null;
  // hasImage comes from the listing; `image` is still present on responses
  // that were not slimmed, so either is enough to know there is one.
  if (!product.hasImage && !product.image) return null;

  const stamp = product.updatedAt ? new Date(product.updatedAt).getTime() : '';
  return `/api/products/${product.id}/image${stamp ? `?v=${stamp}` : ''}`;
}
