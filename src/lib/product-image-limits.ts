/**
 * How many photos one product may carry.
 *
 * Photos are stored as base64 data URIs on the row itself, not in a file
 * store, so every one of them is weight in the database and in any response
 * that carries it — the catalog was 6.8 MB and 25 seconds slow for exactly
 * this reason. A safa needs a front photo and a few angles; unlimited uploads
 * would quietly walk the database back into that state.
 */
export const MAX_ALTERNATE_IMAGES = 5;

/** Front photo plus the alternates. */
export const MAX_PRODUCT_IMAGES = MAX_ALTERNATE_IMAGES + 1;
