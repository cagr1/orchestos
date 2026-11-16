import { afterEach, expect, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { commitEnv, createWorktree, git, mergeWorktreeBack, type Worktree } from '../run/sandbox.ts'

const WRITER_LOCK = path
  .resolve(import.meta.dir, '../../scripts/writer-lock.mjs')
  .replaceAll('\\', '/')
const saved = process.env.CLAUDE_CODE_SESSION_ID
const cleanups: Array<() => void> = []

afterEach(() => {
  if (saved === undefined) delete process.env.CLAUDE_CODE_SESSION_ID
  else process.env.CLAUDE_CODE_SESSION_ID = saved
  for (const cleanup of cleanups.splice(0).reverse()) cleanup()
})

function lockedWorktree(): { worktree: Worktree; marker: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'win14-'))
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }))
  git(['init', '-q', '-b', 'main'], dir)
  git(['config', 'user.name', 'WIN14'], dir)
  git(['config', 'user.email', 'win14@example.test'], dir)
  fs.writeFileSync(path.join(dir, 'README.md'), '# t\n')
  git(['add', '-A'], dir)
  git(['commit', '-q', '-m', 'initial'], dir)
  // Same check as scripts/pre-commit.sh. Local hooksPath wins over any global one; the marker proves it ran.
  const hooks = path.join(dir, '.git', 'test-hooks')
  const marker = path.join(dir, '.git', 'hook-ran')
  fs.mkdirSync(hooks)
  fs.writeFileSync(
    path.join(hooks, 'pre-commit'),
    `#!/bin/sh\necho ran >> "${marker.replaceAll('\\', '/')}"\nexec node "${WRITER_LOCK}" check "$PWD"\n`,
    { mode: 0o755 },
  )
  git(['config', 'core.hooksPath', hooks.replaceAll('\\', '/')], dir)
  const worktree = createWorktree('win14', 'main', dir) // mergeWorktreeBack removes it
  // The task's executor (codex, no session id) holds its worktree's lock.
  const gitDir = git(['rev-parse', '--absolute-git-dir'], worktree.path).stdout
  const now = new Date().toISOString()
  fs.writeFileSync(
    path.join(gitDir, 'agent-writer.lock'),
    JSON.stringify({ session: 'codex', agent: 'codex', startedAt: now, touchedAt: now }),
  )
  fs.writeFileSync(path.join(worktree.path, 'a.txt'), 'a\n')
  return { worktree, marker }
}

test('WIN.14 — commitEnv drops the agent-session identity and keeps the rest', () => {
  const env = commitEnv({
    CLAUDE_CODE_SESSION_ID: 's',
    AGENT_WRITER_TOKEN: 't',
    AGENT_WRITER_NAME: 'n',
    PATH: '/bin',
  })
  expect(env).toEqual({ PATH: '/bin' })
})

test('WIN.14 — a dashboard launched from a Claude Code session still commits in its task worktree', () => {
  const { worktree, marker } = lockedWorktree()
  process.env.CLAUDE_CODE_SESSION_ID = 'claude-session-that-launched-the-dashboard'
  const sha = mergeWorktreeBack(worktree, 'commit', 'orchestos: task', ['a.txt'])
  expect(sha).toMatch(/^[0-9a-f]{40}$/)
  expect(fs.readFileSync(marker, 'utf8')).toContain('ran')
})

test('WIN.14 — the squash commit in the task worktree (base branch not checked out) passes the lock too', () => {
  const { worktree, marker } = lockedWorktree()
  git(['checkout', '-q', '-b', 'other'], worktree.projectRoot)
  process.env.CLAUDE_CODE_SESSION_ID = 'claude-session-that-launched-the-dashboard'
  const sha = mergeWorktreeBack(worktree, 'squash', 'orchestos: task', ['a.txt'])
  expect(sha).toMatch(/^[0-9a-f]{40}$/)
  expect(fs.readFileSync(marker, 'utf8').match(/ran/g)?.length).toBe(2)
})
