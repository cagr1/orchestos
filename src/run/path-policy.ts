import { existsSync, lstatSync, readlinkSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path'

export class PathPolicyError extends Error {}

function decodePath(input: string): string {
  let value = input
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(value)
      if (decoded === value) break
      value = decoded
    } catch {
      break
    }
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
  return Boolean(
    value &&
      value !== '.' &&
      !isAbsolute(value) &&
      !value.startsWith('/') &&
      !value.split('/').some((segment) => segment === '..'),
  )
}

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** Exported so callers that need to compute a path relative to root (e.g. after
 * resolveProjectPath) use the same resolved root — root itself can differ from
 * its realpath on hosts where tmpdir() sits behind a symlink (macOS /var), which
 * otherwise produces a bogus `..`-laden relative path. */
export function realRoot(root: string): string {
  return realpathSync.native(resolve(root))
}

/** Resolve every existing component, including dangling symlinks; missing suffixes stay lexical. */
export function realPathWithin(root: string, target: string): boolean {
  let links = 0
  function canonical(input: string, base = realpathSync.native(process.cwd())): string {
    let actual = isAbsolute(input) ? parse(input).root : base
    const segments = input.slice(isAbsolute(input) ? actual.length : 0).split(sep)
    for (const [index, segment] of segments.entries()) {
      if (!segment || segment === '.') continue
      if (segment === '..') {
        actual = dirname(actual)
        continue
      }
      const candidate = join(actual, segment)
      let stat: ReturnType<typeof lstatSync>
      try {
        stat = lstatSync(candidate)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return resolve(candidate, ...segments.slice(index + 1))
        }
        throw error
      }
      if (stat.isSymbolicLink()) {
        if (++links > 40) throw new PathPolicyError('too many symbolic links')
        actual = canonical(readlinkSync(candidate), actual)
      } else {
        actual = candidate
      }
    }
    return actual
  }
  try {
    return isWithin(realRoot(root), canonical(target))
  } catch {
    return false
  }
}

/** Resolve a project path and verify its existing parent chain is in-root. */
export function resolveProjectPath(
  root: string,
  input: string,
  operation: 'read' | 'write' = 'read',
): string {
  if (!isSafeRelPath(input)) throw new PathPolicyError(`unsafe relative path: ${input}`)
  const rootReal = realRoot(root)
  const lexical = resolve(rootReal, normalizeRelPath(input))
  if (!isWithin(rootReal, lexical)) throw new PathPolicyError(`path escapes project root: ${input}`)

  let existing = lexical
  while (existing !== rootReal) {
    let stat: ReturnType<typeof lstatSync> | undefined
    try {
      stat = lstatSync(existing)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    if (stat) {
      if (operation === 'write' && stat.isSymbolicLink()) {
        throw new PathPolicyError(`refusing to write through symlink: ${input}`)
      }
      break
    }
    existing = resolve(existing, '..')
  }
  if (!realPathWithin(rootReal, lexical)) {
    throw new PathPolicyError(`path crosses a symlink outside project root: ${input}`)
  }
  if (existsSync(lexical)) {
    const stat = lstatSync(lexical)
    if (operation === 'write' && stat.isSymbolicLink())
      throw new PathPolicyError(`refusing to write through symlink: ${input}`)
    if (operation === 'write' && !stat.isFile() && !stat.isDirectory())
      throw new PathPolicyError(`refusing to write special file: ${input}`)
  }
  return lexical
}

export function resolveProjectCwd(root: string, cwd = '.'): string {
  const resolved = cwd.trim() === '.' ? realRoot(root) : resolveProjectPath(root, cwd, 'read')
  if (!existsSync(resolved) || !lstatSync(resolved).isDirectory())
    throw new PathPolicyError(`command cwd is not a directory: ${cwd}`)
  return resolved
}

/** Do not leak arbitrary parent-process variables into task checks or CLIs. */
export function safeChildEnv(
  source: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const allowed =
    /^(PATH|HOME|USER|LOGNAME|TMPDIR|TMP|TEMP|LANG|LC_[A-Z_]+|CI|ORCHESTOS_[A-Z0-9_]+|OPENROUTER_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY|GOOGLE_API_KEY|GITHUB_TOKEN)$/
  return Object.fromEntries(
    Object.entries(source).filter(([key, value]) => allowed.test(key) && value !== undefined),
  ) as Record<string, string>
}
