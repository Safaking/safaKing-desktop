import { prisma } from '@/lib/prisma';
import { SCHEMA_STATEMENTS } from '../../prisma/schema-statements.mjs';

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
    const statements = SCHEMA_STATEMENTS;

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
