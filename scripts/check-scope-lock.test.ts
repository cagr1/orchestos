import { afterEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { main } from './check-scope-lock.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

test.each(['delete', 'rename'])('AUD.26 rejects out-of-scope source on %s', (operation) => {
  const root = mkdtempSync(join(tmpdir(), 'scope-lock-aud26-'))
  roots.push(root)
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(['git', ...args], { cwd: root })
    expect(result.exitCode).toBe(0)
  }
  git('init')
  writeFileSync(join(root, 'outside.txt'), 'outside scope\n')
  writeFileSync(join(root, 'PLAN.md'), '- [ ] **AUD.26 — Scope.**\n')
  git('add', '.')
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'fixture')
  mkdirSync(join(root, '.orchestos'))
  writeFileSync(
    join(root, '.orchestos/active-item.json'),
    JSON.stringify({ item: 'AUD.26', scope: ['inside/**'], declaredAt: new Date().toISOString() }),
  )
  if (operation === 'delete') git('rm', 'outside.txt')
  else {
    mkdirSync(join(root, 'inside'))
    git('mv', 'outside.txt', 'inside/moved.txt')
  }
  expect(main(root)).toBe(1)
})
