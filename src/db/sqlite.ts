import { Database } from 'bun:sqlite'
import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const DB_DIR = join(homedir(), '.orchestos')
const DB_PATH = join(DB_DIR, 'db.sqlite')

if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true })
}

export const db = new Database(DB_PATH, { create: true })
// WAL mode: better concurrent read performance
db.exec('PRAGMA journal_mode = WAL;')
