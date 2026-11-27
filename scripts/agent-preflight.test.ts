import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { main } from './agent-preflight.ts'

test('sin item diagnostica con hooks y reglas válidos sin escribir active-item', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-preflight-'))
  try {
    const git = Bun.spawnSync(['git', 'init'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    expect(git.exitCode, git.stderr.toString()).toBe(0)
    for (const file of ['AGENTS.md', 'CLAUDE.md', 'docs/agent-work-protocol.md', 'PLAN.md']) {
      mkdirSync(join(root, file, '..'), { recursive: true })
      writeFileSync(join(root, file), '')
    }
    mkdirSync(join(root, 'scripts'))
    mkdirSync(join(root, '.git/hooks'), { recursive: true })
    for (const hook of ['pre-commit', 'pre-push', 'post-commit']) {
      writeFileSync(join(root, 'scripts', `${hook}.sh`), '#!/bin/sh\n')
      writeFileSync(join(root, '.git/hooks', hook), '#!/bin/sh\n')
    }
    expect(main([], root)).toBe(0)
    const active = join(root, '.orchestos/active-item.json')
    expect(existsSync(active)).toBe(false)
    mkdirSync(join(root, '.orchestos'))
    const prior = '{"item":"OTHER.1","scope":["src/**"]}'
    writeFileSync(active, prior)
    expect(main([], root)).toBe(0)
    expect(readFileSync(active, 'utf8')).toBe(prior)
    expect(main(['--item', 'MISSING.1'], root)).toBe(1)
    rmSync(join(root, 'AGENTS.md'))
    expect(main([], root)).toBe(1)
    writeFileSync(join(root, 'AGENTS.md'), '')
    writeFileSync(join(root, '.git/hooks/pre-commit'), 'out of sync')
    expect(main([], root)).toBe(1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
