/**
 * Bring the database up to the schema this build needs, before the build.
 *
 * Schema changes used to be applied by hand after deploying, which meant
 * every one of them opened a window where the new code was live and asking
 * for columns the database did not have yet — and in that window every read
 * of the affected table failed. It took the shop's sales and rentals screens
 * down three times in a day.
 *
 * Running here reverses the order. The statements are additive and
 * idempotent, so a database ahead of the code is harmless: the old code
 * simply ignores columns it does not know about. A database behind the code
 * is the outage. Applying before the new code can serve keeps us on the safe
 * side of that permanently.
 *
 *   No DATABASE_URL        → skip, and say so. Someone is building without a
 *                            database and should still get a build.
 *   Set but unreachable    → fail the build. Shipping code whose columns do
 *                            not exist is the thing this exists to prevent.
 *   A statement fails      → fail the build, for the same reason. "Already
 *                            exists" is not a failure; it is the normal
 *                            answer on every build after the first.
 */

import { SCHEMA_STATEMENTS } from '../prisma/schema-statements.mjs';

const url = process.env.DATABASE_URL;

if (!url) {
  console.log('[schema] No DATABASE_URL — skipping. The app applies this at runtime instead.');
  process.exit(0);
}

/** Already there is the normal answer, not a problem. */
const harmless = (message = '') =>
  /already exists|duplicate/i.test(message);

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url } } });

// Counting "applied" would be a lie: IF NOT EXISTS succeeds silently whether
// it created anything or not, so a statement that did nothing is
// indistinguishable from one that did. Report what is actually known — how
// many ran and how many failed — rather than implying work that may not have
// happened. A success message that overstates itself is what let a migration
// that did nothing report {"ok":true}.
let ran = 0;
const failures = [];

try {
  await prisma.$connect();
} catch (error) {
  console.error('[schema] Could not reach the database.');
  console.error(`[schema] ${error.message}`);
  console.error('[schema] Refusing to build: the deploy would ask for columns that are not there.');
  process.exit(1);
}

for (const sql of SCHEMA_STATEMENTS) {
  try {
    await prisma.$executeRawUnsafe(sql);
    ran += 1;
  } catch (error) {
    if (harmless(error.message)) {
      ran += 1;
      continue;
    }
    failures.push({ sql: sql.replace(/\s+/g, ' ').slice(0, 120), message: error.message });
  }
}

await prisma.$disconnect();

if (failures.length) {
  console.error(`[schema] ${failures.length} statement(s) failed:`);
  for (const f of failures) {
    console.error(`  ${f.sql}`);
    console.error(`    → ${f.message}`);
  }
  console.error('[schema] Refusing to build with the database in this state.');
  process.exit(1);
}

console.log(`[schema] Database is up to date — ${ran} statements ran, none failed.`);
