import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseJson, z } from '../boundary/index.ts'

const writerLockSchema = z.object({ session: z.string() }).passthrough()

export interface CutReport {
  baseHead: string | null
  dirty: string[]
  dirtyTotal: number
  branch: string | null
  upstream: string | null
  ahead: number | null
  behind: number | null
  lock: 'released' | 'held' | 'held-by-other' | 'none'
  handoff: string | null
  checkFailed?: boolean
}

export type CutGit = (root: string, args: string[]) => string

const systemGit: CutGit = (root, args) => {
  const result = Bun.spawnSync(['git', '-C', root, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr))
  return new TextDecoder().decode(result.stdout).replace(/\r?\n$/, '')
}

export function cutBaseHead(root: string, git: CutGit = systemGit): string | null {
  try {
    return git(root, ['rev-parse', 'HEAD']).trim() || null
  } catch {
    return null
  }
}

export function cutCheck(
  root: string,
  cliSessionId?: string | null,
  {
    git = systemGit,
    reply = '',
    baseHead = null,
  }: {
    git?: CutGit
    reply?: string
    baseHead?: string | null
  } = {},
): CutReport {
  try {
    return check(root, cliSessionId, git, reply, baseHead)
  } catch {
    return {
      baseHead,
      dirty: [],
      dirtyTotal: 0,
      branch: null,
      upstream: null,
      ahead: null,
      behind: null,
      lock: 'held-by-other',
      handoff: replyHandoff(reply),
      checkFailed: true,
    }
  }
}

function replyHandoff(reply: string): string | null {
  return (
    reply
      .match(/^## Handoff[ \t]*\r?\n([\s\S]*?)(?=^#{1,2} |$(?![\s\S]))/m)?.[1]
      ?.trim()
      .slice(0, 4000) || null
  )
}

function check(
  root: string,
  cliSessionId: string | null | undefined,
  git: CutGit,
  reply: string,
  baseHead: string | null,
): CutReport {
  const status = git(root, ['status', '--porcelain'])
  const dirty = status
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3))
  let branch: string | null = null
  let hasHead = true
  try {
    branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim() || null
  } catch {
    hasHead = false
    try {
      branch = git(root, ['symbolic-ref', '--short', 'HEAD']).trim() || null
    } catch {
      // An unborn branch may not have a readable symbolic ref either.
    }
  }
  let upstream: string | null = null
  let ahead: number | null = hasHead ? null : 0
  let behind: number | null = hasHead ? null : 0
  try {
    if (hasHead) upstream = git(root, ['rev-parse', '--abbrev-ref', '@{u}']).trim() || null
  } catch {
    // A branch without an upstream cannot be reported as pushed.
  }
  if (upstream) {
    const counts = git(root, ['rev-list', '--left-right', '--count', 'HEAD...@{u}'])
      .trim()
      .split(/\s+/)
    if (counts.length !== 2 || counts.some((count) => !/^\d+$/.test(count)))
      throw new Error('Invalid git ahead/behind counts')
    ;[ahead, behind] = counts.map(Number) as [number, number]
  }
  const gitdir = resolve(root, git(root, ['rev-parse', '--git-dir']).trim())
  const lockPath = join(gitdir, 'agent-writer.lock')
  let lock: CutReport['lock'] = 'none'
  let checkFailed = false
  if (existsSync(lockPath)) {
    let stored: z.infer<typeof writerLockSchema> | undefined
    try {
      const parsed = parseJson(writerLockSchema, readFileSync(lockPath, 'utf8'))
      if (parsed.ok) stored = parsed.data
      else checkFailed = true
    } catch {
      checkFailed = true
    }
    const own = Boolean(cliSessionId) && stored?.session === cliSessionId
    lock = own ? 'held' : 'held-by-other'
  }
  let handoff: string | null = null
  if (existsSync(join(root, 'NEXT.md'))) {
    const changedSinceBase = baseHead
      ? git(root, ['diff', '--name-only', baseHead, '--', 'NEXT.md']).trim()
      : ''
    const committedWithoutBase =
      !baseHead && hasHead
        ? git(root, ['ls-tree', '--name-only', 'HEAD', '--', 'NEXT.md']).trim()
        : ''
    if (changedSinceBase || committedWithoutBase || dirty.some((path) => path === 'NEXT.md'))
      handoff = 'next-md'
  }
  if (!handoff) {
    handoff = replyHandoff(reply)
  }
  if (lock === 'held' && dirty.length === 0 && !checkFailed) {
    unlinkSync(lockPath)
    lock = 'released'
  }
  return {
    baseHead,
    dirty: dirty.slice(0, 20),
    dirtyTotal: dirty.length,
    branch,
    upstream,
    ahead,
    behind,
    lock,
    handoff,
    ...(checkFailed ? { checkFailed: true } : {}),
  }
}
