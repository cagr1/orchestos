import { resolve, join } from 'path'
import { existsSync } from 'fs'
import type { Check } from '../tasks/schema.ts'
import type { RunLogger } from './logger.ts'

const DEFAULT_TIMEOUT_MS = 60_000
const OUTPUT_LIMIT = 2_000
const TSC_TIMEOUT_MS = 120_000

/**
 * D3 finding (Mes 14, 2026-06-25): a task with no explicit `checks:` only gets
 * validated by the LLM QA judge (qa.ts), which approved a generated test file that
 * didn't even compile (wrong test framework import, missing Task fields). These are
 * sensible defaults for code-output tasks that don't declare their own checks —
 * explicit `checks:` always wins (this is never consulted if the task has any).
 *
 * Both checks are skipped when `effectiveRoot` has no node_modules (e.g. a fresh
 * git worktree that doesn't symlink dependencies — see follow-up task on worktree
 * isolation) — running `tsc`/`bun test` there would fail on missing modules, not
 * on the generated code, producing a false failure unrelated to what we're checking.
 */
export function defaultChecksFor(output: string[], effectiveRoot: string): Check[] {
  if (!existsSync(join(effectiveRoot, 'node_modules'))) return []
  const checks: Check[] = []
  if (output.some(p => p.endsWith('.ts') || p.endsWith('.tsx'))) {
    checks.push({ cmd: 'bunx tsc --noEmit', timeout_ms: TSC_TIMEOUT_MS })
  }
  for (const p of output) {
    if (p.endsWith('.test.ts') || p.endsWith('.test.tsx')) {
      checks.push({ cmd: `bun test ${p}` })
    }
  }
  return checks
}

export interface CheckResult {
  cmd: string
  exitCode: number
  stdout: string
  stderr: string
  elapsedMs: number
  timedOut: boolean
}

export async function runChecks(
  checks: Check[],
  projectRoot: string,
  logger: RunLogger
): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  for (const check of checks) {
    const result = await runOneCheck(check, projectRoot)
    results.push(result)

    const expected = check.expect_exit ?? 0
    if (result.timedOut) {
      logger.error(`CHECK timeout: ${check.cmd}`)
    } else if (result.exitCode !== expected) {
      logger.error(`CHECK failed: ${check.cmd} exit=${result.exitCode} expected=${expected}`)
    }
  }
  return results
}

async function runOneCheck(check: Check, projectRoot: string): Promise<CheckResult> {
  const argv = splitCommand(check.cmd)
  const command = argv[0]
  const args = argv.slice(1)
  const cwd = resolve(projectRoot, check.cwd ?? '.')
  const timeoutMs = check.timeout_ms ?? DEFAULT_TIMEOUT_MS
  const started = performance.now()

  if (!command) {
    return failureResult(check.cmd, 'empty command', started, false)
  }

  let timedOut = false
  try {
    const proc = Bun.spawn([command, ...args], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill()
    }, timeoutMs)

    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    clearTimeout(timer)

    return {
      cmd: check.cmd,
      exitCode,
      stdout: tail(stdout),
      stderr: tail(stderr),
      elapsedMs: Math.round(performance.now() - started),
      timedOut,
    }
  } catch (e: any) {
    return failureResult(check.cmd, e.message, started, timedOut)
  }
}

function splitCommand(cmd: string): string[] {
  const parts: string[] = []
  const re = /"([^"]*)"|'([^']*)'|[^\s]+/g
  for (const match of cmd.matchAll(re)) {
    parts.push(match[1] ?? match[2] ?? match[0])
  }
  return parts
}

function tail(text: string): string {
  return text.length > OUTPUT_LIMIT ? text.slice(-OUTPUT_LIMIT) : text
}

function failureResult(cmd: string, message: string, started: number, timedOut: boolean): CheckResult {
  return {
    cmd,
    exitCode: 1,
    stdout: '',
    stderr: tail(message),
    elapsedMs: Math.round(performance.now() - started),
    timedOut,
  }
}
