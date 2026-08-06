import { NextResponse } from 'next/server';
import { ensureDbSchema } from '@/lib/db-init';

/**
 * Run the schema auto-migration once, on demand.
 *
 * These statements used to run inside every API route, which meant ~58 DDL
 * round-trips before the first response on each cold start — measured at 48
 * seconds on /api/rentals, close to the platform's 60s function timeout.
 * They are idempotent, so once the columns exist they achieve nothing and
 * only cost time.
 *
 * Call this after deploying a schema change instead:
 *   curl -X POST https://store.safaking.in/api/admin/migrate
 */
export async function POST() {
  const started = Date.now();
  try {
    // force, so a warm instance still applies anything new
    await ensureDbSchema(true);
    return NextResponse.json({
      ok: true,
      message: 'Schema is up to date.',
      tookMs: Date.now() - started,
    });
  } catch (error: any) {
    console.error('POST /api/admin/migrate error:', error);
    return NextResponse.json({ error: error.message || 'Migration failed' }, { status: 500 });
  }
}

/** Handy for checking it is reachable without running anything. */
export async function GET() {
  return NextResponse.json({
    message: 'POST here to apply pending schema changes.',
  });
}
