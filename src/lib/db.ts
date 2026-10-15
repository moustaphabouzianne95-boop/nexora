import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

/**
 * NEXORA — Prisma client factory with dual-database support.
 *
 * - Local development (default): standard Prisma engine against a local
 *   SQLite file (DATABASE_URL="file:./db/custom.db").
 * - Production / Vercel: when TURSO_DATABASE_URL is set, the client is
 *   created with the libSQL driver adapter (Turso). Serverless platforms
 *   cannot persist a SQLite file, so Turso (SQLite-compatible, libSQL
 *   protocol) is used as the remote database. No other code changes are
 *   required — every query goes through the same `db` export.
 *
 * Required env vars in production:
 *   TURSO_DATABASE_URL — e.g. libsql://nexora-<org>.turso.io
 *   TURSO_AUTH_TOKEN   — Turso database auth token
 *   DATABASE_URL       — file:./db/custom.db (still needed by the Prisma CLI
 *                        during `prisma generate` on the build step)
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const logConfig = process.env.NODE_ENV === 'production' ? [] : (['warn', 'error'] as const)

  const tursoUrl = process.env.TURSO_DATABASE_URL

  if (tursoUrl) {
    // Serverless / hosted mode — Turso over the libSQL driver adapter.
    const libsql = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter, log: logConfig })
  }

  // Local development mode — file-based SQLite via the standard engine.
  return new PrismaClient({ log: logConfig })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
