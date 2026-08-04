/**
 * Product categories used by the inventory chips and the product form.
 *
 * Stored on Product.productType. This is deliberately separate from
 * Product.category, which already holds fabric values (silk, poli, PYOR).
 *
 * Add a category by adding it to this list — nothing else needs changing.
 */
export const PRODUCT_TYPES = ['Safa Main', 'Barati safa', 'Accessory'] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

/** Shown for products saved before categories existed. */
export const UNCATEGORISED = 'Uncategorised';
