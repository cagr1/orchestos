import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const REQUIRED_RULE_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'docs/agent-work-protocol.md',
  'PLAN.md',
] as const

export const LIVE_GATE_PATHS = [
  'src/dashboard/public/',
  'src/dashboard/handlers/config.ts',
  'src/dashboard/handlers/setup.ts',
  'src/config/',
] as const

export const UI_COPY_BUDGET_PATHS = [
  'src/dashboard/public/i18n.js',
  'src/dashboard/ui-copy-budget.json',
] as const

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

export type RunCommand = (args: string[], cwd: string) => CommandResult

export function runCommand(args: string[], cwd: string): CommandResult {
  const result = Bun.spawnSync(args, { cwd, stdout: 'pipe', stderr: 'pipe' })
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }
}

export function findOpenPlanItem(plan: string, itemId: string): string | null {
  const escaped = itemId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = plan.match(new RegExp(`^- \\[ \\] \\*\\*${escaped}(?:\\s|—)`, 'm'))
  return match?.[0] ?? null
}

export function hookPath(root: string, hook: string, run: RunCommand = runCommand): string {
  const result = run(['git', 'rev-parse', '--git-path', `hooks/${hook}`], root)
  if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `no se pudo resolver ${hook}`)
  return resolve(root, result.stdout.trim())
}

export function checkHooks(root: string, run: RunCommand = runCommand): string[] {
  const errors: string[] = []
  for (const hook of ['pre-commit', 'pre-push']) {
    const source = resolve(root, 'scripts', `${hook}.sh`)
    const installed = hookPath(root, hook, run)
    if (!existsSync(source)) {
      errors.push(`falta fuente ${source}`)
      continue
    }
    if (!existsSync(installed)) {
      errors.push(`falta hook instalado ${installed}`)
      continue
    }
    if (readFileSync(source, 'utf8') !== readFileSync(installed, 'utf8')) {
      errors.push(`${hook} desincronizado: ${installed}`)
    }
  }
  return errors
}

export function requiresLiveGate(paths: string[]): boolean {
  return paths.some((path) =>
    LIVE_GATE_PATHS.some((prefix) => path === prefix || path.startsWith(prefix)),
  )
}

export function requiresUiCopyBudget(paths: string[]): boolean {
  return paths.some((path) =>
    UI_COPY_BUDGET_PATHS.includes(path as (typeof UI_COPY_BUDGET_PATHS)[number]),
  )
}

const EVIDENCE_FILE_PATTERN = /`([^`\s]+\.(?:ts|js|mjs|json|ndjson|log))`/g

/**
 * H.10.1 — rutas citadas entre backticks en las líneas AGREGADAS de PLAN.md.
 * No basta con la frase "Gate en vivo:": tiene que citar un archivo real,
 * y ese archivo debe estar en el propio commit (ver hasLiveGateEvidence).
 */
export function citedEvidenceFiles(planDiff: string): string[] {
  const added = planDiff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
  const cited: string[] = []
  for (const line of added) {
    for (const match of line.matchAll(EVIDENCE_FILE_PATTERN)) {
      if (match[1]) cited.push(match[1])
    }
  }
  return cited
}

/**
 * H.10.1 (2026-09-08) — incidente R.5: un commit declaró "Gate en vivo: navegador
 * real..." con la frase exigida por el regex de abajo, pero el hecho (dos procesos
 * concurrentes) nunca ocurrió — nadie lo detectó hasta una revisión de otro modelo,
 * horas después. La frase sola dejó de ser evidencia suficiente: ahora la línea
 * "Gate en vivo:" debe además citar (entre backticks) un archivo de evidencia
 * versionado — script reproducible + JSON/log con datos reales, no prosa — y ese
 * archivo tiene que estar presente en el mismo commit (stagedPaths), no solo
 * mencionado. Sin ambas cosas, el gate falla igual que hoy falla sin la frase.
 */
export function hasLiveGateEvidence(planDiff: string, stagedPaths: string[] = []): boolean {
  const added = planDiff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
  const closesItem = added.some((line) => /^\+\s*- \[x\]/i.test(line))
  const hasGate = added.some((line) =>
    /Gate en vivo:.*(?:navegador|browser|Playwright)/i.test(line),
  )
  if (!closesItem || !hasGate) return false
  const cited = citedEvidenceFiles(planDiff)
  if (cited.length === 0) return false
  const staged = new Set(stagedPaths)
  return cited.some((path) => staged.has(path))
}
