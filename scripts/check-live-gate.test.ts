// main() takes an explicit `root` and never touches process.cwd() or the shared sqlite
// singleton, so these run in-process against real temp git repos — no subprocess needed.

import { afterEach, expect, it } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { onlyCommentChanges } from './agent-governance.ts'
import { main } from './check-live-gate.ts'

it('recognizes comment-only diffs, including block comments and empty lines', () => {
  expect(
    onlyCommentChanges(
      '--- a/file.ts\n+++ b/file.ts\n@@ -1,3 +1,3 @@\n-// old\n+// new\n- * old\n+ * new\n-\n+  \n+/* block\n+*/\n',
    ),
  ).toBe(true)
})

it('rejects code with a trailing comment', () => {
  expect(onlyCommentChanges('-x = 1 // old\n+x = 1 // new\n')).toBe(false)
})

it('rejects empty diffs and diffs without changed lines', () => {
  expect(onlyCommentChanges('')).toBe(false)
  expect(onlyCommentChanges('--- a/file.ts\n+++ b/file.ts\n')).toBe(false)
})

it('rejects a mix of comments and code', () => {
  expect(onlyCommentChanges('-// old\n+// new\n+const x = 1\n')).toBe(false)
})

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
}

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-live-gate-'))
  roots.push(root)
  execFileSync('git', ['init'], { cwd: root, stdio: 'pipe' })
  execFileSync('git', ['-c', 'init.defaultBranch=master', 'checkout', '-b', 'master'], {
    cwd: root,
    stdio: 'pipe',
  })
  return root
}

function write(root: string, path: string, content: string): void {
  mkdirSync(join(root, path, '..'), { recursive: true })
  writeFileSync(join(root, path), content, 'utf8')
}

function git(root: string, args: string[]): void {
  execFileSync('git', args, { cwd: root, stdio: 'pipe', env: gitEnv })
}

function baseCommit(root: string): void {
  write(
    root,
    'PLAN.md',
    '## Sprint fixture\n### Block fixture\n- [ ] **F.1 — Item fixture.**\n  F.1 body.\n',
  )
  write(root, 'docs/specs/F.1.md', '# F.1 spec\n')
  write(root, 'src/dashboard/app/src/App.tsx', 'export default function App() {}\n')
  git(root, ['add', '-A'])
  git(root, ['commit', '-m', 'base'])
}

it('exempts comment-only changes to existing dashboard files', () => {
  const root = makeRepo()
  baseCommit(root)
  write(root, 'src/dashboard/app/src/App.tsx', 'export default function App() {}\n// comment\n')
  git(root, ['add', '-A'])
  expect(main(root)).toBe(0)
})

it('does not exempt new dashboard files containing only comments', () => {
  const root = makeRepo()
  baseCommit(root)
  write(root, 'src/dashboard/app/src/new.ts', '// comment\n')
  git(root, ['add', '-A'])
  expect(main(root)).toBe(1)
})

it('passes when the item closed inline in PLAN.md carries its own evidence', () => {
  const root = makeRepo()
  baseCommit(root)
  write(root, 'src/dashboard/app/src/App.tsx', 'export default function App() { return null }\n')
  write(
    root,
    'PLAN.md',
    '## Sprint fixture\n### Block fixture\n- [x] **F.1 — Item fixture.**\n  Gate en vivo: verificado con Playwright (navegador real) — `scripts/f1-evidence.json`.\n',
  )
  write(root, 'scripts/f1-evidence.json', '{}\n')
  git(root, ['add', '-A'])
  expect(main(root)).toBe(0)
})

it('fails when a dashboard change ships with no [x] and no live-gate evidence', () => {
  const root = makeRepo()
  baseCommit(root)
  write(root, 'src/dashboard/app/src/App.tsx', 'export default function App() { return null }\n')
  git(root, ['add', '-A'])
  expect(main(root)).toBe(1)
})

it('passes when evidence for the closed item lives in docs/done/ behind an evidencia link', () => {
  const root = makeRepo()
  baseCommit(root)
  write(root, 'src/dashboard/app/src/App.tsx', 'export default function App() { return null }\n')
  write(
    root,
    'PLAN.md',
    '## Sprint fixture\n### Block fixture\n- [x] **F.1 — Item fixture.** → [evidencia](docs/done/bloque-F.md#bloque-f-f-1)\n',
  )
  write(
    root,
    'docs/done/bloque-F.md',
    '<a id="bloque-f-f-1"></a>\nGate en vivo: verificado con Playwright (navegador real) — `scripts/f1-evidence.json`.\n',
  )
  write(root, 'scripts/f1-evidence.json', '{}\n')
  git(root, ['add', '-A'])
  git(root, ['rm', '--cached', 'docs/specs/F.1.md'])
  unlinkSync(join(root, 'docs/specs/F.1.md'))
  expect(main(root)).toBe(0)
})

it('fails when the archived section has the phrase but the cited evidence file is not staged', () => {
  const root = makeRepo()
  baseCommit(root)
  write(root, 'src/dashboard/app/src/App.tsx', 'export default function App() { return null }\n')
  write(
    root,
    'PLAN.md',
    '## Sprint fixture\n### Block fixture\n- [x] **F.1 — Item fixture.** → [evidencia](docs/done/bloque-F.md#bloque-f-f-1)\n',
  )
  write(
    root,
    'docs/done/bloque-F.md',
    '<a id="bloque-f-f-1"></a>\nGate en vivo: verificado con Playwright (navegador real) — `scripts/f1-evidence.json`.\n',
  )
  // scripts/f1-evidence.json is never written or staged.
  git(root, ['add', 'PLAN.md', 'docs/done/bloque-F.md', 'src/dashboard/app/src/App.tsx'])
  git(root, ['rm', '--cached', 'docs/specs/F.1.md'])
  unlinkSync(join(root, 'docs/specs/F.1.md'))
  expect(main(root)).toBe(1)
})

it('fails when the archived section is missing the browser/Playwright phrase entirely', () => {
  const root = makeRepo()
  baseCommit(root)
  write(root, 'src/dashboard/app/src/App.tsx', 'export default function App() { return null }\n')
  write(
    root,
    'PLAN.md',
    '## Sprint fixture\n### Block fixture\n- [x] **F.1 — Item fixture.** → [evidencia](docs/done/bloque-F.md#bloque-f-f-1)\n',
  )
  write(root, 'docs/done/bloque-F.md', '<a id="bloque-f-f-1"></a>\nTests unitarios verdes.\n')
  write(root, 'scripts/f1-evidence.json', '{}\n')
  git(root, ['add', '-A'])
  git(root, ['rm', '--cached', 'docs/specs/F.1.md'])
  unlinkSync(join(root, 'docs/specs/F.1.md'))
  expect(main(root)).toBe(1)
})

it('requires staged evidence for every archived closing item, with citations on following lines', () => {
  const root = makeRepo()
  baseCommit(root)
  write(root, 'PLAN.md', '- [ ] **F.1 — First.**\n- [ ] **F.2 — Second.**\n')
  git(root, ['add', 'PLAN.md'])
  git(root, ['commit', '-m', 'open both items'])
  write(root, 'src/dashboard/app/src/App.tsx', 'export default function App() { return null }\n')
  write(
    root,
    'PLAN.md',
    '- [x] **F.1 — First.** → [evidencia](docs/done/bloque-F.md#f1)\n' +
      '- [x] **F.2 — Second.** → [evidencia](docs/done/bloque-F.md#f2)\n',
  )
  write(
    root,
    'docs/done/bloque-F.md',
    '<a id="f1"></a>\nGate en vivo: navegador real.\n`scripts/f1-evidence.json`\n' +
      '<a id="f2"></a>\nGate en vivo: Playwright real.\n`scripts/f2-evidence.json`\n',
  )
  write(root, 'scripts/f1-evidence.json', '{}\n')
  git(root, ['add', '-A'])
  expect(main(root)).toBe(1)
  write(root, 'scripts/f2-evidence.json', '{}\n')
  git(root, ['add', 'scripts/f2-evidence.json'])
  expect(main(root)).toBe(0)
})
