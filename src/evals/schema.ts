import { readFileSync } from 'node:fs'
import { isAbsolute, normalize, sep, win32 } from 'node:path'
import { parse } from 'yaml'
import { type Check, type Task, validateTask } from '../tasks/schema.ts'

export interface EvalTask extends Task {
  checks: Check[]
  reference_solution: Record<string, string>
  origin: string
}

export function validateEvalTask(raw: unknown, index = 0, source = 'evals'): EvalTask {
  const err = (message: string): never => {
    throw new Error(`[eval:${source}:${index}] ${message}`)
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return err('task must be an object')
  }

  const record = raw as Record<string, unknown>
  const task = validateTask(record, index)
  const checks = task.checks
  if (!checks || checks.length === 0) {
    return err('"checks" must be a non-empty array — an eval without a grader is invalid')
  }
  const origin = typeof record.origin === 'string' ? record.origin.trim() : ''
  if (origin === '') {
    err('"origin" must identify the documented real failure')
  }
  if (
    typeof record.reference_solution !== 'object' ||
    record.reference_solution === null ||
    Array.isArray(record.reference_solution)
  ) {
    err('"reference_solution" must be a non-empty path-to-content mapping')
  }

  const entries = Object.entries(record.reference_solution as Record<string, unknown>)
  if (entries.length === 0) {
    err('"reference_solution" must be a non-empty path-to-content mapping')
  }

  const referenceSolution: Record<string, string> = {}
  for (const [path, content] of entries) {
    if (!isSafeRelativePath(path)) {
      err(`reference_solution path must be relative and stay inside the project: ${path}`)
    }
    if (!task.output.includes(path)) {
      err(`reference_solution path must be declared in output: ${path}`)
    }
    if (typeof content !== 'string') {
      err(`reference_solution content must be a string: ${path}`)
    }
    referenceSolution[path] = content as string
  }

  return {
    ...task,
    checks,
    reference_solution: referenceSolution,
    origin,
  }
}

export function loadEvalTask(filePath: string, index = 0): EvalTask {
  const raw = parse(readFileSync(filePath, 'utf-8'))
  return validateEvalTask(raw, index, filePath)
}

function isSafeRelativePath(path: string): boolean {
  if (path.trim() === '' || isAbsolute(path) || win32.isAbsolute(path)) return false
  const normalized = normalize(path)
  return normalized !== '..' && !normalized.startsWith(`..${sep}`)
}
