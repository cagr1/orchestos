import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { commitTasksYaml } from './commit-tasks-yaml.ts'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function git(args: string[], cwd: string): void {
  const result = Bun.spawnSync(['git', ...args], { cwd })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
}

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-commit-tasks-'))
  dirs.push(dir)
  git(['init', '-q'], dir)
  writeFileSync(join(dir, 'tasks.yaml'), 'tasks: []\n')
  git(['add', 'tasks.yaml'], dir)
  git(
    [
      '-c',
      'user.name=fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-qm',
      'initial',
    ],
    dir,
  )
  return dir
}

describe('commitTasksYaml diagnostics', () => {
  it('logs when the git commit fails', () => {
    const dir = fixture()
    writeFileSync(join(dir, 'tasks.yaml'), 'tasks:\n  - id: changed\n')
    // Without git templates, git init does not create .git/hooks.
    mkdirSync(join(dir, '.git/hooks'), { recursive: true })
    writeFileSync(join(dir, '.git/hooks/pre-commit'), '#!/bin/sh\necho blocked >&2\nexit 1\n')
    git(['config', 'core.hooksPath', '.git/hooks'], dir)
    Bun.spawnSync(['chmod', '+x', join(dir, '.git/hooks/pre-commit')])
    const error = spyOn(console, 'error').mockImplementation(() => {})

    commitTasksYaml(dir, 'chore(tasks): changed done')

    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]?.[0]).toStartWith('[tasks-yaml] commit skipped:')
    error.mockRestore()
  })

  it('keeps the no changes case silent', () => {
    const dir = fixture()
    const error = spyOn(console, 'error').mockImplementation(() => {})

    commitTasksYaml(dir, 'chore(tasks): unchanged done')

    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})
