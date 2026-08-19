import { prisma } from '@/lib/prisma';

let initPromise: Promise<void> | null = null;

/**
 * Idempotent auto-migration: ensures all columns and tables that are in the
 * Prisma schema exist in the live Supabase database.
 *
 * Each statement runs individually so a single failure does not abort the rest.
 * Uses IF NOT EXISTS / IF EXISTS everywhere so it is always safe to re-run.
 *
 * This is NOT called from request handlers. Running ~58 DDL statements before
 * every cold-start response cost 48 seconds on /api/rentals, near the 60s
 * function timeout, and achieved nothing once the columns existed. Deploy a
 * schema change, then POST /api/admin/migrate once.
 *
 * @param force re-run even if it already ran in this process, so the manual
 *              endpoint is not silently a no-op on a warm instance.
 */
export async function ensureDbSchema(force = false) {
  if (initPromise && !force) return initPromise;

  initPromise = (async () => {
    const statements = [
      // ── SafaOption ────────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS "SafaOption" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "price" DOUBLE PRECISION NOT NULL DEFAULT 50,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SafaOption_pkey" PRIMARY KEY ("id")
      );`,

      // ── Artist ────────────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS "Artist" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "ratePerPiece" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "phone" TEXT,
        "address" TEXT,
        "notes" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
      );`,

      // ── ArtistPayment (ledger) ─────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS "ArtistPayment" (
        "id" TEXT NOT NULL,
        "artistId" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "note" TEXT,
        "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "paidBy" TEXT,
        CONSTRAINT "ArtistPayment_pkey" PRIMARY KEY ("id")
      );`,

      // ── TyingAssignment — one artist's share of one order ─────────────────
      `CREATE TABLE IF NOT EXISTS "TyingAssignment" (
        "id" TEXT NOT NULL,
        "rentalId" TEXT,
        "saleId" TEXT,
        "artistId" TEXT NOT NULL,
        "quantity" INTEGER NOT NULL DEFAULT 0,
        "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "paid" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TyingAssignment_pkey" PRIMARY KEY ("id")
      );`,
      `CREATE INDEX IF NOT EXISTS "TyingAssignment_rentalId_idx" ON "TyingAssignment"("rentalId");`,
      `CREATE INDEX IF NOT EXISTS "TyingAssignment_saleId_idx" ON "TyingAssignment"("saleId");`,
      `CREATE INDEX IF NOT EXISTS "TyingAssignment_artistId_idx" ON "TyingAssignment"("artistId");`,

      // Carry the orders that already had a single artist into the new table,
      // so nobody's earnings disappear the moment the split goes live. The NOT
      // EXISTS guard makes this safe to run again — it only ever fills gaps.
      `INSERT INTO "TyingAssignment" ("id", "rentalId", "artistId", "quantity", "rate", "paid", "createdAt", "updatedAt")
       SELECT gen_random_uuid()::text, r."id", r."artistId",
              COALESCE(r."safaTyingCount", 0), COALESCE(r."artistRate", 0),
              COALESCE(r."artistPaid", false), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       FROM "Rental" r
       WHERE r."artistId" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "TyingAssignment" t WHERE t."rentalId" = r."id");`,
      `INSERT INTO "TyingAssignment" ("id", "saleId", "artistId", "quantity", "rate", "paid", "createdAt", "updatedAt")
       SELECT gen_random_uuid()::text, s."id", s."artistId",
              COALESCE(s."safaTyingCount", 0), COALESCE(s."artistRate", 0),
              COALESCE(s."artistPaid", false), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       FROM "Sale" s
       WHERE s."artistId" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "TyingAssignment" t WHERE t."saleId" = s."id");`,

      // ── StorePrice — one branch's own price for one product ───────────────
      `CREATE TABLE IF NOT EXISTS "StorePrice" (
        "id" TEXT NOT NULL,
        "storeId" TEXT NOT NULL,
        "productId" TEXT NOT NULL,
        "rentPrice" DOUBLE PRECISION,
        "salePrice" DOUBLE PRECISION,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StorePrice_pkey" PRIMARY KEY ("id")
      );`,
      // One row per branch per product, so a repeated save updates instead of
      // stacking a second price nobody can tell apart from the first.
      `CREATE UNIQUE INDEX IF NOT EXISTS "StorePrice_storeId_productId_key" ON "StorePrice"("storeId", "productId");`,
      `CREATE INDEX IF NOT EXISTS "StorePrice_storeId_idx" ON "StorePrice"("storeId");`,

      // ── StoreSafaPrice — one branch's own tying rate for one style ────────
      `CREATE TABLE IF NOT EXISTS "StoreSafaPrice" (
        "id" TEXT NOT NULL,
        "storeId" TEXT NOT NULL,
        "safaOptionId" TEXT NOT NULL,
        "price" DOUBLE PRECISION NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StoreSafaPrice_pkey" PRIMARY KEY ("id")
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "StoreSafaPrice_storeId_safaOptionId_key" ON "StoreSafaPrice"("storeId", "safaOptionId");`,
      `CREATE INDEX IF NOT EXISTS "StoreSafaPrice_storeId_idx" ON "StoreSafaPrice"("storeId");`,

      // ── Vendor ────────────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS "Vendor" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "phone" TEXT,
        "address" TEXT,
        "gstNumber" TEXT,
        "notes" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
      );`,

      // ── VendorPayment (ledger) ─────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS "VendorPayment" (
        "id" TEXT NOT NULL,
        "vendorId" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "note" TEXT,
        "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "paidBy" TEXT,
        CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
      );`,

      // ── CashBook ──────────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS "CashBook" (
        "id" TEXT NOT NULL,
        "storeId" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "submitted" BOOLEAN NOT NULL DEFAULT false,
        "submittedAt" TIMESTAMP(3),
        "submittedBy" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CashBook_pkey" PRIMARY KEY ("id")
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "CashBook_storeId_date_key" ON "CashBook"("storeId", "date");`,

      // ── CashEntry ─────────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS "CashEntry" (
        "id" TEXT NOT NULL,
        "cashBookId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "reference" TEXT,
        "notes" TEXT,
        "createdBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CashEntry_pkey" PRIMARY KEY ("id")
      );`,

      // ── WorkSession ───────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS "WorkSession" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "username" TEXT NOT NULL,
        "storeId" TEXT,
        "loggedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "loggedOutAt" TIMESTAMP(3),
        "logoutReason" TEXT,
        CONSTRAINT "WorkSession_pkey" PRIMARY KEY ("id")
      );`,
      `CREATE INDEX IF NOT EXISTS "WorkSession_userId_loggedInAt_idx" ON "WorkSession"("userId", "loggedInAt");`,

      // ── User — new columns ────────────────────────────────────────────────
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canManageVendors" BOOLEAN NOT NULL DEFAULT false;`,

      // ── Product — new columns ─────────────────────────────────────────────
      `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "discount" DOUBLE PRECISION DEFAULT 0;`,
      `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productType" TEXT;`,

      // ── Rental — new columns ──────────────────────────────────────────────
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "safaTyingCount" INTEGER DEFAULT 1;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT DEFAULT 'CASH';`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "tieSafa" BOOLEAN DEFAULT false;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "safaShape" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "safaTyingStyles" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "safaTyingName" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "safaTyingAddress" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "safaTyingTime" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "safaTyingDate" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "tieSafaCharge" DOUBLE PRECISION DEFAULT 0;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "discount" DOUBLE PRECISION DEFAULT 0;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "pickupName" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "pickupPhone" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "pickupDate" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "damageCharge" DOUBLE PRECISION DEFAULT 0;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "fatherName" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "customerAltPhone" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "weddingDate" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "safaSize" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "readyAt" TIMESTAMP(3);`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "readyBy" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "artistId" TEXT;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "artistRate" DOUBLE PRECISION DEFAULT 0;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "artistPaid" BOOLEAN DEFAULT false;`,

      // ── Sale — new columns ────────────────────────────────────────────────
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "tieSafa" BOOLEAN DEFAULT false;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "safaShape" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "safaTyingCount" INTEGER DEFAULT 1;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "safaTyingStyles" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "safaTyingName" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "safaTyingAddress" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "safaTyingTime" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "pickupName" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "pickupPhone" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "pickupDate" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "safaTyingDate" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "tieSafaCharge" DOUBLE PRECISION DEFAULT 0;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION DEFAULT 0;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT DEFAULT 'CASH';`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "fatherName" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "customerAltPhone" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "weddingDate" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "safaSize" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "readyAt" TIMESTAMP(3);`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "readyBy" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "artistId" TEXT;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "artistRate" DOUBLE PRECISION DEFAULT 0;`,
      `ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "artistPaid" BOOLEAN DEFAULT false;`,

      // ── Store — new columns ───────────────────────────────────────────────
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "logo" TEXT;`,
      // Partapur keeps the mark it has always traded under. Matched on the name
      // because that is the only thing that identifies it across databases, and
      // only where nothing has been chosen yet, so an admin's pick is never
      // overwritten by a later migration.
      `UPDATE "Store" SET "logo" = '/assets/logo-joshi.png'
       WHERE "logo" IS NULL AND "name" ILIKE '%partapur%';`,

      // ── Invoice — new columns ─────────────────────────────────────────────
      `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT DEFAULT 'CASH';`,
    ];

    for (const sql of statements) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (err: any) {
        // Ignore "already exists" errors — everything else is worth logging.
        if (!err.message?.includes('already exists') && !err.message?.includes('duplicate')) {
          console.error('[db-init] statement failed:', err.message);
        }
      }
    }
  })();

  return initPromise;
}
