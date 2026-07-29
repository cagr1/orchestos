import { Database } from 'bun:sqlite'
import { chmodSync, copyFileSync, existsSync, mkdirSync, renameSync, statSync } from 'fs'
import { dirname } from 'path'
import { randomUUID } from 'crypto'
import { db } from './sqlite.ts'

export interface DatabaseBackup {
  path: string
  bytes: number
  createdAt: string
}

/**
 * Creates a consistent SQLite snapshot without copying WAL sidecar files.
 * The temporary file + rename sequence prevents consumers from observing a
 * partially written backup. Backups are sensitive and are restricted to the
 * current user on supported filesystems.
 */
export function createDatabaseBackup(destination: string): DatabaseBackup {
  const tempPath = `${destination}.tmp-${randomUUID()}`
  mkdirSync(dirname(destination), { recursive: true })
  // VACUUM INTO creates a normal SQLite file and includes a consistent view of
  // the database, unlike copying db.sqlite while WAL may still be active.
  const sqlPath = tempPath.replaceAll("'", "''")
  db.exec(`VACUUM INTO '${sqlPath}'`)
  chmodSync(tempPath, 0o600)
  renameSync(tempPath, destination)
  chmodSync(destination, 0o600)
  return { path: destination, bytes: statSync(destination).size, createdAt: new Date().toISOString() }
}

/** Opens a backup read-only and runs SQLite's built-in integrity check. */
export function verifyDatabaseBackup(path: string): { ok: boolean; detail: string } {
  try {
    const readonlyBackup = new Database(path, { readonly: true })
    // First prove the artifact opens in read-only mode.
    readonlyBackup.query('SELECT name FROM sqlite_master LIMIT 1').get()
    const row = readonlyBackup.query<Record<string, string>, []>('PRAGMA integrity_check').get()
    const detail = row ? Object.values(row)[0] ?? 'no integrity result' : 'no integrity result'
    readonlyBackup.close()
    return { ok: detail === 'ok', detail }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Restores a validated backup to a new path. Refuses to overwrite anything;
 * replacing the live DB remains an explicit operator action.
 */
export function restoreDatabaseBackup(backupPath: string, destination: string): DatabaseBackup {
  const verified = verifyDatabaseBackup(backupPath)
  if (!verified.ok) throw new Error(`refusing corrupt backup: ${verified.detail}`)
  if (existsSync(destination)) throw new Error(`refusing to overwrite existing database: ${destination}`)
  mkdirSync(dirname(destination), { recursive: true })
  const tempPath = `${destination}.tmp-${randomUUID()}`
  copyFileSync(backupPath, tempPath)
  chmodSync(tempPath, 0o600)
  renameSync(tempPath, destination)
  chmodSync(destination, 0o600)
  const restored = verifyDatabaseBackup(destination)
  if (!restored.ok) throw new Error(`restored database failed integrity check: ${restored.detail}`)
  return { path: destination, bytes: statSync(destination).size, createdAt: new Date().toISOString() }
}
