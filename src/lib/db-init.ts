import { prisma } from '@/lib/prisma';

let initPromise: Promise<void> | null = null;

export async function ensureDbSchema() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const statements = [
      `CREATE TABLE IF NOT EXISTS "SafaOption" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "price" DOUBLE PRECISION NOT NULL DEFAULT 50,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SafaOption_pkey" PRIMARY KEY ("id")
      );`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "safaTyingCount" INTEGER DEFAULT 1;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT DEFAULT 'CASH';`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "tieSafa" BOOLEAN DEFAULT false;`,
      `ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "safaShape" TEXT;`,
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
      `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT DEFAULT 'CASH';`,
      `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "discount" DOUBLE PRECISION DEFAULT 0;`
    ];

    for (const sql of statements) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (err) {
        console.error('Auto migration statement error:', err);
      }
    }
  })();

  return initPromise;
}
