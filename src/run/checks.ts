import { resolve } from 'path'
import type { Check } from '../tasks/schema.ts'
import type { RunLogger } from './logger.ts'

const DEFAULT_TIMEOUT_MS = 60_000
const OUTPUT_LIMIT = 2_000

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
