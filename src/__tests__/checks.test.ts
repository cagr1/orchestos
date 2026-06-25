/**
 * D3 follow-up (Mes 14, 2026-06-25) — defaultChecksFor(): fills in tsc/bun test for
 * code-output tasks that don't declare their own `checks:`. See docs/E2E.md for the
 * real bug this closes (LLM QA approved a generated test file that didn't compile).
 */
import { describe, it, expect, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { defaultChecksFor } from '../run/checks.ts'

let tmpDirs: string[] = []

function makeRoot(withNodeModules: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), 'checks-test-'))
  if (withNodeModules) mkdirSync(join(dir, 'node_modules'))
  tmpDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true })
  tmpDirs = []
})

describe('defaultChecksFor', () => {
  it('adds a tsc check when output includes a .ts file and node_modules exists', () => {
    const root = makeRoot(true)
    const checks = defaultChecksFor(['src/foo.ts'], root)
    expect(checks).toContainEqual(expect.objectContaining({ cmd: 'bunx tsc --noEmit' }))
  })

  it('adds a tsc check for .tsx output too', () => {
    const root = makeRoot(true)
    const checks = defaultChecksFor(['src/Foo.tsx'], root)
    expect(checks.some(c => c.cmd === 'bunx tsc --noEmit')).toBe(true)
  })

  it('adds a bun test check per *.test.ts output file', () => {
    const root = makeRoot(true)
    const checks = defaultChecksFor(['src/foo.ts', 'src/__tests__/foo.test.ts'], root)
    expect(checks).toContainEqual(expect.objectContaining({ cmd: 'bun test src/__tests__/foo.test.ts' }))
  })

  it('returns no checks for non-code output (e.g. markdown)', () => {
    const root = makeRoot(true)
    const checks = defaultChecksFor(['docs/README.md'], root)
    expect(checks).toHaveLength(0)
  })

  it('returns no checks at all when node_modules is missing (fresh worktree)', () => {
    const root = makeRoot(false)
    const checks = defaultChecksFor(['src/foo.ts', 'src/__tests__/foo.test.ts'], root)
    expect(checks).toHaveLength(0)
  })

  it('does not duplicate the tsc check when multiple .ts files are declared', () => {
    const root = makeRoot(true)
    const checks = defaultChecksFor(['src/a.ts', 'src/b.ts'], root)
    expect(checks.filter(c => c.cmd === 'bunx tsc --noEmit')).toHaveLength(1)
  })
})
