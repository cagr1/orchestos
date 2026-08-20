#!/usr/bin/env bun
/**
 * CC.0-D6 — run a live harness gate with an isolated ORCHESTOS_HOME, then
 * copy its non-chat run evidence into the durable user database before the
 * temporary home is deleted.
 *
 * The child never writes to the durable DB. If migration/export fails, the
 * temporary home is deliberately preserved so evidence is not destroyed.
 */
import { Database } from 'bun:sqlite'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { join, resolve } from 'path'

export interface ExportResult {
  discovered: number
  exported: number
  duplicates: number
}

export interface GateOptions {
  label: string
  command: string[]
  evidenceHome?: string
  cwd?: string
}

const REQUIRED_COLUMNS = ['id', 'project_id', 'task_class'] as const

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function tableColumns(database: Database, table: string): string[] {
  return database.query<{ name: string }, []>(`PRAGMA table_info(${quoteIdentifier(table)})`).all()
    .map(row => row.name)
}

export function normalizeEvidenceLabel(raw: string): string {
  const label = raw.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{0,47}$/.test(label)) {
    throw new Error('label must be 1-48 chars: lowercase letters, numbers, dot, underscore or dash')
  }
  return label
}

export function databasePathForHome(home: string): string {
  return join(resolve(home), '.orchestos', 'db.sqlite')
}

/**
 * Copies every non-chat, non-exported run using the columns shared by both
 * schemas. project_id becomes NULL because a disposable project registry must
 * never leak into the durable DB. The original run id makes retries idempotent.
 */
export function exportRunEvidence(sourcePath: string, targetPath: string, rawLabel: string): ExportResult {
  const label = normalizeEvidenceLabel(rawLabel)
  if (!existsSync(sourcePath)) return { discovered: 0, exported: 0, duplicates: 0 }
  if (resolve(sourcePath) === resolve(targetPath)) {
    throw new Error('source and durable evidence database must be different')
  }
  if (!existsSync(targetPath)) throw new Error(`durable database not found: ${targetPath}`)

  const source = new Database(sourcePath, { readonly: true })
  const target = new Database(targetPath)
  try {
    target.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
    const sourceColumns = tableColumns(source, 'runs')
    const targetColumnSet = new Set(tableColumns(target, 'runs'))
    for (const required of REQUIRED_COLUMNS) {
      if (!sourceColumns.includes(required) || !targetColumnSet.has(required)) {
        throw new Error(`runs schema is missing required column: ${required}`)
      }
    }
    const columns = sourceColumns.filter(column => targetColumnSet.has(column))
    const quotedColumns = columns.map(quoteIdentifier).join(', ')
    const rows = source.query<Record<string, unknown>, []>(
      `SELECT ${quotedColumns} FROM runs
       WHERE task_class != 'chat' AND task_class NOT LIKE 'gate:%'
       ORDER BY created_at, id`
    ).all()
    const placeholders = columns.map(() => '?').join(', ')
    const insert = target.query(
      `INSERT INTO runs (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT(id) DO NOTHING`
    )
    let exported = 0
    const copy = target.transaction(() => {
      for (const row of rows) {
        const values = columns.map(column => {
          if (column === 'project_id') return null
          if (column === 'task_class') return `gate:${label}:${String(row.task_class)}`
          return row[column] ?? null
        })
        const result = insert.run(...(values as any[]))
        exported += result.changes
      }
    })
    copy()
    return { discovered: rows.length, exported, duplicates: rows.length - exported }
  } finally {
    source.close()
    target.close()
  }
}

function migrateDurableDatabase(evidenceHome: string, cwd: string): void {
  const result = Bun.spawnSync({
    cmd: ['bun', 'run', 'db:migrate'],
    cwd,
    env: { ...process.env, ORCHESTOS_HOME: evidenceHome },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) {
    throw new Error(`durable DB migration failed: ${result.stderr.toString().trim()}`)
  }
}

export function runEvidenceGate(options: GateOptions): number {
  const label = normalizeEvidenceLabel(options.label)
  if (options.command.length === 0) throw new Error('a command is required after --')
  const cwd = resolve(options.cwd ?? process.cwd())
  const evidenceHome = resolve(
    options.evidenceHome ?? process.env.ORCHESTOS_EVIDENCE_HOME ?? process.env.ORCHESTOS_HOME ?? homedir(),
  )
  const tempHome = mkdtempSync(join(tmpdir(), `orchestos-evidence-${label}-`))
  let safeToDelete = false

  console.log(`[gate:evidence] isolated home: ${tempHome}`)
  console.log(`[gate:evidence] durable home: ${evidenceHome}`)
  try {
    if (tempHome === evidenceHome) throw new Error('isolated and durable homes must be different')
    const child = Bun.spawnSync({
      cmd: options.command,
      cwd,
      env: { ...process.env, ORCHESTOS_HOME: tempHome },
      stdout: 'inherit',
      stderr: 'inherit',
    })

    const sourcePath = databasePathForHome(tempHome)
    let result: ExportResult = { discovered: 0, exported: 0, duplicates: 0 }
    if (existsSync(sourcePath)) {
      migrateDurableDatabase(evidenceHome, cwd)
      result = exportRunEvidence(sourcePath, databasePathForHome(evidenceHome), label)
    }
    safeToDelete = true
    console.log(`[gate:evidence] evidence: ${result.exported} exported, ${result.duplicates} duplicate(s)`)
    return child.exitCode
  } catch (error) {
    console.error(`[gate:evidence] export failed; evidence preserved at ${tempHome}`)
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  } finally {
    if (safeToDelete) rmSync(tempHome, { recursive: true, force: true })
  }
}

function parseCliArgs(args: string[]): GateOptions {
  const separator = args.indexOf('--')
  const optionArgs = separator >= 0 ? args.slice(0, separator) : []
  const command = separator >= 0 ? args.slice(separator + 1) : []
  const labelIndex = optionArgs.indexOf('--label')
  if (labelIndex < 0 || !optionArgs[labelIndex + 1]) {
    throw new Error('usage: bun run gate:evidence -- --label <gate-id> -- <command> [args...]')
  }
  const evidenceHomeIndex = optionArgs.indexOf('--evidence-home')
  return {
    label: optionArgs[labelIndex + 1]!,
    command,
    evidenceHome: evidenceHomeIndex >= 0 ? optionArgs[evidenceHomeIndex + 1] : undefined,
  }
}

if (import.meta.main) {
  try {
    process.exit(runEvidenceGate(parseCliArgs(Bun.argv.slice(2))))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(2)
  }
}
