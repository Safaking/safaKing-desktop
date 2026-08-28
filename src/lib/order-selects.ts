/**
 * What an order needs to know about a product.
 *
 * `include: { product: true }` pulls the whole row, and the photo on that row
 * is a base64 data URI — which put 778 KB of images into an 809 KB sales
 * listing for seven sales, and would do the same on every order response that
 * carries its lines. Nothing reading an order needs the photo; these are the
 * columns the order screens and the bill actually use.
 */
export const orderProductSelect = {
  id: true,
  name: true,
  sku: true,
  salePrice: true,
  rentPrice: true,
  productType: true,
} as const;

/** The lines of an order, without dragging the photos along. */
export const orderItemsInclude = {
  include: { product: { select: orderProductSelect } },
} as const;
