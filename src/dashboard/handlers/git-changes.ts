import { readFileSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { errorResponse, jsonResponse } from '../http.ts'

function git(root: string, args: string[]) {
  return Bun.spawnSync(['git', ...args], {
    cwd: root,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    stdout: 'pipe',
    stderr: 'ignore',
  })
}

function untrackedLines(root: string, path: string): number {
  try {
    const target = resolve(root, path)
    if (statSync(target).size > 1_000_000) return 0
    const data = readFileSync(target)
    if (data.includes(0) || !data.length) return 0
    const text = data.toString('utf8')
    return text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
  } catch {
    return 0
  }
}

export function handleApiGitChanges(root: string): Response {
  const status = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
  if (status.exitCode !== 0) return jsonResponse({ branch: null, files: [] })
  const branch =
    git(root, ['symbolic-ref', '--short', '-q', 'HEAD']).stdout.toString().trim() || null
  const hasHead = git(root, ['rev-parse', '--verify', 'HEAD']).exitCode === 0
  const records = git(root, ['diff', ...(hasHead ? ['HEAD'] : ['--cached']), '--numstat', '-z'])
    .stdout.toString()
    .split('\0')
  const counts = new Map<string, { additions: number; deletions: number }>()
  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    if (!record) continue
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(record)
    if (!match) continue
    let path = match[3]!
    if (!path) {
      i++ // rename source
      path = records[++i] || ''
    }
    counts.set(path, { additions: Number(match[1]) || 0, deletions: Number(match[2]) || 0 })
  }
  const entries = status.stdout.toString().split('\0')
  const files = []
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (!entry) continue
    const code = entry.slice(0, 2)
    const path = entry.slice(3)
    if (code.includes('R') || code.includes('C')) i++ // porcelain -z lists destination first
    const state =
      code === '??'
        ? 'U'
        : code.includes('U') || code === 'AA' || code === 'DD'
          ? 'M'
          : code.includes('R')
            ? 'R'
            : code.includes('D')
              ? 'D'
              : code.includes('A')
                ? 'A'
                : 'M'
    files.push({
      path,
      status: state,
      ...(state === 'U'
        ? { additions: untrackedLines(root, path), deletions: 0 }
        : counts.get(path) || { additions: 0, deletions: 0 }),
    })
  }
  files.sort((a, b) => a.path.localeCompare(b.path))
  return jsonResponse({ branch, files })
}

export function handleApiGitDiff(url: URL, root: string): Response {
  const path = url.searchParams.get('path')
  if (!path) return errorResponse('Missing path', 400)
  const target = resolve(root, path)
  if (target !== root && !target.startsWith(root + sep)) return errorResponse('Invalid path', 400)
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', path])
    .stdout.toString()
    .split('\0')
    .includes(path)
  const hasHead = git(root, ['rev-parse', '--verify', 'HEAD']).exitCode === 0
  const result = git(
    root,
    untracked
      ? ['diff', '--no-index', '--', '/dev/null', path]
      : ['diff', ...(hasHead ? ['HEAD'] : ['--cached']), '--', path],
  )
  const patch =
    result.stdout.length > 200_000
      ? `${result.stdout.subarray(0, 200_000).toString('utf8')}\n… diff truncated`
      : result.stdout.toString()
  return jsonResponse({ path, patch })
}
