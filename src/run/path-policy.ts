import { existsSync, lstatSync, realpathSync } from 'fs'
import { isAbsolute, relative, resolve } from 'path'

export class PathPolicyError extends Error {}

function decodePath(input: string): string {
  let value = input
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(value)
      if (decoded === value) break
      value = decoded
    } catch { break }
  }
  return value
}

/** Normalize without resolving `..`; traversal segments remain rejectable. */
export function normalizeRelPath(input: string): string {
  let value = decodePath(input.trim()).replaceAll('\\', '/').replace(/\/+/g, '/')
  while (value.startsWith('./')) value = value.slice(2)
  if (value.length > 1 && value.endsWith('/')) value = value.slice(0, -1)
  return value
}

export function isSafeRelPath(input: string): boolean {
  const value = normalizeRelPath(input)
  return Boolean(value && value !== '.' && !isAbsolute(value) && !value.startsWith('/') &&
    !value.split('/').some(segment => segment === '..'))
}

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function realRoot(root: string): string {
  return realpathSync.native(resolve(root))
}

/** Resolve a project path and verify its existing parent chain is in-root. */
export function resolveProjectPath(root: string, input: string, operation: 'read' | 'write' = 'read'): string {
  if (!isSafeRelPath(input)) throw new PathPolicyError(`unsafe relative path: ${input}`)
  const rootReal = realRoot(root)
  const lexical = resolve(rootReal, normalizeRelPath(input))
  if (!isWithin(rootReal, lexical)) throw new PathPolicyError(`path escapes project root: ${input}`)

  let existing = lexical
  while (existing !== rootReal) {
    if (existsSync(existing)) {
      if (operation === 'write' && lstatSync(existing).isSymbolicLink()) {
        throw new PathPolicyError(`refusing to write through symlink: ${input}`)
      }
      break
    }
    existing = resolve(existing, '..')
  }
  if (!isWithin(rootReal, realpathSync.native(existing))) {
    throw new PathPolicyError(`path crosses a symlink outside project root: ${input}`)
  }
  if (existsSync(lexical)) {
    const stat = lstatSync(lexical)
    if (operation === 'write' && stat.isSymbolicLink()) throw new PathPolicyError(`refusing to write through symlink: ${input}`)
    if (operation === 'write' && !stat.isFile() && !stat.isDirectory()) throw new PathPolicyError(`refusing to write special file: ${input}`)
  }
  return lexical
}

export function resolveProjectCwd(root: string, cwd = '.'): string {
  const resolved = cwd.trim() === '.' ? realRoot(root) : resolveProjectPath(root, cwd, 'read')
  if (!existsSync(resolved) || !lstatSync(resolved).isDirectory()) throw new PathPolicyError(`command cwd is not a directory: ${cwd}`)
  return resolved
}

/** Do not leak arbitrary parent-process variables into task checks or CLIs. */
export function safeChildEnv(source: Record<string, string | undefined> = process.env): Record<string, string> {
  const allowed = /^(PATH|HOME|USER|LOGNAME|TMPDIR|TMP|TEMP|LANG|LC_[A-Z_]+|CI|ORCHESTOS_[A-Z0-9_]+|OPENROUTER_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY|GOOGLE_API_KEY|GITHUB_TOKEN)$/
  return Object.fromEntries(Object.entries(source).filter(([key, value]) => allowed.test(key) && value !== undefined)) as Record<string, string>
}
