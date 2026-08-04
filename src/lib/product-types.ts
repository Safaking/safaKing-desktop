/**
 * Product categories used by the inventory chips and the product form.
 *
 * Stored on Product.productType. This is deliberately separate from
 * Product.category, which already holds fabric values (silk, poli, PYOR).
 *
 * Add a category by adding it to this list — nothing else needs changing.
 */
export const PRODUCT_TYPES = ['Safa Main', 'Barati safa', 'Poli Safa', 'Accessory'] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

/** Shown for products saved before categories existed. */
export const UNCATEGORISED = 'Uncategorised';

/**
 * Categories measured by length rather than piece count. Poli is cut from a
 * roll, so its stock is metres in hand and its rate is per metre. Whole metres
 * only, so the existing integer quantity/price fields carry it unchanged —
 * only the unit shown to staff differs.
 */
export const METER_BASED_TYPES: readonly string[] = ['Poli Safa'];

export function isMeterBased(product?: { productType?: string | null } | null): boolean {
  return !!product?.productType && METER_BASED_TYPES.includes(product.productType);
}

/** "m" for length-based products, "pcs" otherwise. */
export function unitLabel(product?: { productType?: string | null } | null): string {
  return isMeterBased(product) ? 'm' : 'pcs';
}

/** Short suffix for rates: "₹80 / m" vs plain "₹80". */
export function rateSuffix(product?: { productType?: string | null } | null): string {
  return isMeterBased(product) ? ' / m' : '';
}
