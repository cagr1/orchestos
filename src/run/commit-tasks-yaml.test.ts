import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { commitPaths, commitTasksYaml } from './commit-tasks-yaml.ts'

const dirs: string[] = []

afterEach(() => {
  // Restore diagnostics even if an assertion fails.
  errorSpy?.mockRestore()
  errorSpy = undefined
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>> | undefined

function git(args: string[], cwd: string): void {
  const result = Bun.spawnSync(['git', ...args], { cwd })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
}

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-commit-tasks-'))
  dirs.push(dir)
  git(['init', '-q'], dir)
  appendFileSync(
    join(dir, '.git/config'),
    '\n[user]\n\tname = fixture\n\temail = fixture@example.invalid\n',
  )
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
  for (const operation of ['add', 'commit'] as const) {
    for (const method of ['commitTasksYaml', 'commitPaths'] as const) {
      it(`${method} survives a transient index.lock during ${operation}`, async () => {
        const dir = fixture()
        const lock = join(dir, '.git/index.lock')
        const message = 'chore(tasks): changed done'
        writeFileSync(join(dir, 'tasks.yaml'), 'tasks:\n  - id: changed\n')
        errorSpy = spyOn(console, 'error').mockImplementation(() => {})
        const spawnSync = Bun.spawnSync.bind(Bun)
        let remover: ReturnType<typeof Bun.spawn> | undefined
        let injected = false
        const holdLock = () => {
          injected = true
          writeFileSync(lock, 'external owner\n')
          remover = Bun.spawn(['sh', '-c', 'sleep 0.3; rm -- "$1"', 'lock-owner', lock])
        }
        if (operation === 'add') holdLock()
        // Inject exactly at the actual add/commit boundary; the independent
        // process can release its lock while the synchronous helper waits.
        const spawnSpy = spyOn(Bun, 'spawnSync').mockImplementation(((
          ...args: Parameters<typeof Bun.spawnSync>
        ) => {
          if (!injected && args[0]?.[0] === 'git' && args[0]?.[1] === operation) holdLock()
          return spawnSync(...args)
        }) as typeof Bun.spawnSync)
        try {
          if (method === 'commitTasksYaml') commitTasksYaml(dir, message)
          else expect(commitPaths(dir, ['tasks.yaml'], message).ok).toBe(true)
        } finally {
          spawnSpy.mockRestore()
          if (remover) await remover.exited
        }
        expect(injected).toBe(true)
        const subject = spawnSync(['git', 'log', '-1', '--format=%s'], { cwd: dir })
        expect(subject.stdout.toString().trim()).toBe(message)
        expect(errorSpy).not.toHaveBeenCalled()
      })
    }
  }

  it('reports a persistent lock once, leaves it intact and bounds the wait', () => {
    const dir = fixture()
    const lock = join(dir, '.git/index.lock')
    writeFileSync(join(dir, 'tasks.yaml'), 'tasks:\n  - id: changed\n')
    writeFileSync(lock, 'external owner\n')
    errorSpy = spyOn(console, 'error').mockImplementation(() => {})
    const start = performance.now()

    commitTasksYaml(dir, 'chore(tasks): changed done')

    expect(performance.now() - start).toBeLessThan(5_000)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls[0]?.[0]).toStartWith('[tasks-yaml] commit skipped:')
    expect(errorSpy.mock.calls[0]?.[0]).toContain('index.lock')
    expect(existsSync(lock)).toBe(true)
  })

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
