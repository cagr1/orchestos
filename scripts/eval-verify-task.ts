#!/usr/bin/env bun
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { loadEvalTask } from '../src/evals/schema.ts'
import { type CheckResult, runChecks } from '../src/run/checks.ts'
import { RunLogger } from '../src/run/logger.ts'

export interface EvalVerification {
  id: string
  origin: string
  results: CheckResult[]
}

export function listEvalDirectories(evalsRoot: string): string[] {
  if (!existsSync(evalsRoot)) throw new Error(`evals directory not found: ${evalsRoot}`)
  const directories = readdirSync(evalsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => join(evalsRoot, entry.name))
    .sort()
  if (directories.length === 0) {
    throw new Error(`no eval tasks found in: ${evalsRoot}`)
  }
  return directories
}

export async function verifyEvalDirectory(evalDirectory: string): Promise<EvalVerification> {
  const taskPath = join(evalDirectory, 'task.yaml')
  const baseProject = join(evalDirectory, 'project')
  if (!existsSync(taskPath)) throw new Error(`missing eval task: ${taskPath}`)
  if (!existsSync(baseProject)) throw new Error(`missing eval base project: ${baseProject}`)

  const task = loadEvalTask(taskPath)
  const tempRoot = mkdtempSync(join(tmpdir(), `orchestos-eval-${task.id}-`))
  const projectRoot = join(tempRoot, 'project')
  try {
    cpSync(baseProject, projectRoot, { recursive: true })
    for (const [relativePath, content] of Object.entries(task.reference_solution)) {
      const destination = resolve(projectRoot, relativePath)
      mkdirSync(dirname(destination), { recursive: true })
      writeFileSync(destination, content, 'utf-8')
    }

    const logger = new RunLogger(projectRoot, `eval-${task.id}`)
    const results = await runChecks(task.checks, projectRoot, logger)
    const failures = results.filter((result, index) => {
      const expected = task.checks[index]?.expect_exit ?? 0
      return result.timedOut || result.exitCode !== expected
    })
    if (failures.length > 0) {
      const detail = failures
        .map(
          (result) => `${result.cmd}: exit=${result.exitCode}${result.timedOut ? ' timeout' : ''}`,
        )
        .join(', ')
      throw new Error(`eval "${task.id}" reference solution failed its grader: ${detail}`)
    }
    logger.done()
    return { id: task.id, origin: task.origin, results }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

export async function verifyAllEvals(evalsRoot: string): Promise<EvalVerification[]> {
  const reports: EvalVerification[] = []
  for (const directory of listEvalDirectories(evalsRoot)) {
    reports.push(await verifyEvalDirectory(directory))
  }
  return reports
}

if (import.meta.main) {
  try {
    const evalsRoot = resolve(process.argv[2] ?? join(process.cwd(), 'evals'))
    const reports = await verifyAllEvals(evalsRoot)
    for (const report of reports) {
      console.log(`✓ ${report.id}: ${report.results.length} check(s) · ${report.origin}`)
    }
    console.log(`eval verification passed: ${reports.length} reference solution(s)`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
