import { PrismaClient } from '@prisma/client'

/**
 * Supabase's transaction pooler (port 6543) hands each query a different
 * backend connection, so Prisma's prepared statements either vanish
 * ("prepared statement \"s18\" does not exist") or collide ("already exists").
 * Prisma only disables them when the URL carries ?pgbouncer=true.
 *
 * That flag is easy to drop when pasting a connection string into a hosting
 * dashboard, and the failure only shows up in production, so enforce it here
 * instead of trusting the environment to be configured correctly.
 */
function normalizeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw

  try {
    const url = new URL(raw)
    const isPooled =
      url.port === '6543' || url.hostname.includes('pooler.supabase.com')

    if (isPooled && url.searchParams.get('pgbouncer') !== 'true') {
      url.searchParams.set('pgbouncer', 'true')
      return url.toString()
    }

    return raw
  } catch {
    // Not a parseable URL — leave it alone and let Prisma report the problem.
    return raw
  }
}

const prismaClientSingleton = () => {
  const url = normalizeDatabaseUrl(process.env.DATABASE_URL)
  return url
    ? new PrismaClient({ datasources: { db: { url } } })
    : new PrismaClient()
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}
