import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// ORCHESTOS_HOME permite aislar la persistencia en tests y entornos controlados.
// En uso normal conserva ~/.orchestos como ubicación estable del usuario.
const DB_HOME = process.env.ORCHESTOS_HOME || homedir()
const DB_DIR = join(DB_HOME, '.orchestos')
const DB_PATH = join(DB_DIR, 'db.sqlite')

if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true })
}

export const db = new Database(DB_PATH, { create: true })
// Foreign-key clauses are present throughout the schema; enforce them for
// every connection instead of relying on SQLite's connection-local default.
db.exec('PRAGMA foreign_keys = ON;')
// Short concurrent writes (dashboard + CLI) wait for the writer instead of
// failing immediately with SQLITE_BUSY. Higher-level operations still need
// bounded transactions; this is not an infinite retry policy.
db.exec('PRAGMA busy_timeout = 5000;')
// WAL mode: better concurrent read performance. A second process opening the
// same DB while SQLite is recovering may not be able to change the pragma;
// keep the already-established mode instead of failing startup.
try {
  db.exec('PRAGMA journal_mode = WAL;')
} catch {
  /* another writer is recovering */
}
