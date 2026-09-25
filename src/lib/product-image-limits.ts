/**
 * How many photos one product may carry.
 *
 * Photos are stored as base64 data URIs on the row itself, not in a file
 * store, so every one of them is weight in the database and in any response
 * that carries it — the catalog was 6.8 MB and 25 seconds slow for exactly
 * this reason. Unlimited uploads would quietly walk the database back into
 * that state, so there is a ceiling; ten leaves room for a front shot and the
 * angles a safa is actually photographed from.
 *
 * Only the admin edit screen ever loads the alternates, so raising this does
 * not touch the till or the booking screen. It does raise what one product can
 * weigh in the database — at roughly 100 KB a photo, a fully stocked gallery
 * is about a megabyte.
 */
export const MAX_ALTERNATE_IMAGES = 10;

/** Front photo plus the alternates. */
export const MAX_PRODUCT_IMAGES = MAX_ALTERNATE_IMAGES + 1;
