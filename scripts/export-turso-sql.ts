/**
 * NEXORA — SQLite → SQL dump exporter (for Turso initialization).
 *
 * Reads db/custom.db (bun:sqlite, readonly) and writes deploy/turso-init.sql:
 * a portable SQL script (schema + all demo data) that can be executed on a
 * fresh Turso database via `turso db shell <db> < deploy/turso-init.sql`
 * or pasted into the Turso web console SQL editor.
 *
 * Run: bun scripts/export-turso-sql.ts
 */
import { Database } from 'bun:sqlite'
import { writeFileSync, mkdirSync } from 'node:fs'

const SRC = 'db/custom.db'
const OUT = 'deploy/turso-init.sql'

const db = new Database(SRC, { readonly: true })

const quote = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'bigint') return String(v)
  if (v instanceof Uint8Array) {
    return `X'${Buffer.from(v).toString('hex')}'`
  }
  // string (covers TEXT + fallback)
  return `'${String(v).replace(/'/g, "''")}'`
}

const tables = (
  db.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all() as { name: string }[]
).map((r) => r.name)

const objects = db
  .query<{ type: string; name: string; sql: string }>(
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END, name"
  )
  .all() as { type: string; name: string; sql: string }[]

const lines: string[] = []
lines.push('-- NEXORA — Turso initialization script')
lines.push('-- Generated from db/custom.db (schema + demo data).')
lines.push(`-- Generated at: ${new Date().toISOString()}`)
lines.push('-- Usage: turso db shell <db-name> < deploy/turso-init.sql')
lines.push('--        (or paste into the Turso web console → SQL editor)')
lines.push('')
lines.push('PRAGMA foreign_keys=OFF;')
lines.push('BEGIN TRANSACTION;')
lines.push('')

// Schema first
for (const o of objects) {
  if (o.type === 'table') {
    lines.push(`${o.sql.replace(/;\s*$/, '')};`)
    lines.push('')
  }
}

// Data
for (const t of tables) {
  const cols = (db.query<{ name: string }>(`PRAGMA table_info('${t}')`).all() as { name: string }[]).map(
    (c) => c.name
  )
  if (cols.length === 0) continue
  const colList = cols.map((c) => `"${c}"`).join(', ')
  const rows = db.query(`SELECT * FROM "${t}"`).all() as Record<string, unknown>[]
  if (rows.length === 0) {
    lines.push(`-- ${t}: no rows`)
    lines.push('')
    continue
  }
  lines.push(`-- ${t} (${rows.length} rows)`)
  // Batch rows in chunks to keep statements reasonably sized.
  const CHUNK = 50
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const values = chunk.map((r) => `(${cols.map((c) => quote(r[c])).join(', ')})`).join(',\n  ')
    lines.push(`INSERT INTO "${t}" (${colList}) VALUES\n  ${values};`)
  }
  lines.push('')
}

// Indexes / triggers / views after data
for (const o of objects) {
  if (o.type !== 'table') {
    lines.push(`${o.sql.replace(/;\s*$/, '')};`)
  }
}

lines.push('COMMIT;')
lines.push('PRAGMA foreign_keys=ON;')
lines.push('')

mkdirSync('deploy', { recursive: true })
writeFileSync(OUT, lines.join('\n'))
console.log(`✔ Exported ${tables.length} tables → ${OUT} (${(lines.join('\n').length / 1024).toFixed(1)} KB)`)
