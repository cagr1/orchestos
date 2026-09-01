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

export function hasLiveGateEvidence(planDiff: string): boolean {
  const added = planDiff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
  const closesItem = added.some((line) => /^\+\s*- \[x\]/i.test(line))
  const hasGate = added.some((line) =>
    /Gate en vivo:.*(?:navegador|browser|Playwright)/i.test(line),
  )
  return closesItem && hasGate
}
