import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleApiTasksCommitRun, handleApiTasksRun, resolveTaskRunProjectId } from './tasks.ts'

const roots: string[] = []
afterAll(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })))

describe('dashboard task run project binding', () => {
  test('uses the request-selected project id instead of re-resolving by path', () => {
    expect(resolveTaskRunProjectId('/path-that-is-not-registered', 'request-project')).toBe(
      'request-project',
    )
  })
})

describe('dashboard task run session reporting', () => {
  test('ignora sessionId desconocido y responde ok sin lanzar un CLI real', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-task-run-session-'))
    roots.push(root)
    writeFileSync(
      join(root, 'tasks.yaml'),
      'version: 1\nproject: test\ntasks:\n  - id: task-test\n    description: Test\n    executor: openrouter\n    input: []\n    output: [out.txt]\n    depends_on: []\n    status: running\n    retry_count: 0\n',
    )
    for (const args of [
      ['init', '-b', 'main'],
      ['add', 'tasks.yaml'],
      [
        '-c',
        'user.name=OrchestOS test',
        '-c',
        'user.email=test@invalid',
        'commit',
        '-m',
        'fixture',
      ],
    ]) {
      const proc = Bun.spawnSync(['git', ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
      expect(proc.exitCode, new TextDecoder().decode(proc.stderr)).toBe(0)
    }
    const originalSpawn = Bun.spawn
    Bun.spawn = (() => ({ pid: 424242, exited: Promise.resolve(0) })) as unknown as typeof Bun.spawn
    try {
      const response = await handleApiTasksRun(
        new Request('http://localhost/api/tasks/task-test/run', {
          method: 'POST',
          body: JSON.stringify({ sessionId: 'unknown-session' }),
        }),
        new URL('http://localhost/api/tasks/task-test/run'),
        root,
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ ok: true })
    } finally {
      Bun.spawn = originalSpawn
    }
  })
})

describe('dashboard task commit-run (ERP.4.13)', () => {
  function git(root: string, ...args: string[]) {
    const proc = Bun.spawnSync(
      ['git', '-c', 'user.name=OrchestOS test', '-c', 'user.email=test@invalid', ...args],
      {
        cwd: root,
        env: { PATH: process.env.PATH ?? '', HOME: root },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    expect(proc.exitCode, proc.stderr.toString()).toBe(0)
    return proc.stdout.toString().trim()
  }

  function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-commit-run-'))
    roots.push(root)
    writeFileSync(
      join(root, 'tasks.yaml'),
      'version: 1\nproject: test\ntasks:\n  - id: task-dirty\n    description: Test\n    executor: openrouter\n    input: []\n    output: [out.txt]\n    depends_on: []\n    status: pending\n    retry_count: 0\n    retry_reason: "uncommitted changes: a.txt"\n',
    )
    git(root, 'init', '-b', 'main')
    git(root, 'add', 'tasks.yaml')
    git(root, 'commit', '-m', 'fixture')
    writeFileSync(join(root, 'a.txt'), 'a')
    writeFileSync(join(root, 'b.txt'), 'b')
    return root
  }

  const call = (root: string, body: unknown) =>
    handleApiTasksCommitRun(
      new Request('http://localhost/api/tasks/task-dirty/commit-run', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      new URL('http://localhost/api/tasks/task-dirty/commit-run'),
      root,
    )

  test('rechaza rutas fuera de la lista sucia, con .. o absolutas, sin commitear nada', async () => {
    const root = fixture()
    const head = git(root, 'rev-parse', 'HEAD')
    for (const file of ['limpio.txt', '../a.txt', '/etc/passwd']) {
      const response = await call(root, { files: ['a.txt', file] })
      expect(response.status).toBe(400)
      expect(JSON.stringify(await response.json())).toContain(file)
    }
    expect((await call(root, { files: [] })).status).toBe(400)
    expect(git(root, 'rev-parse', 'HEAD')).toBe(head)
  })

  test('commitea solo los archivos pedidos y lanza la tarea', async () => {
    const root = fixture()
    const originalSpawn = Bun.spawn
    let spawned = 0
    Bun.spawn = (() => {
      spawned += 1
      return { pid: 424243, exited: Promise.resolve(0) }
    }) as unknown as typeof Bun.spawn
    try {
      const response = await call(root, { files: ['a.txt'] })
      expect(response.status).toBe(200)
      expect(spawned).toBe(1)
      const message = git(root, 'log', '--grep=chore: commit pending changes', '-1', '--format=%s')
      expect(message).toBe('chore: commit pending changes before task-dirty (dashboard)')
      const files = git(
        root,
        'log',
        '--grep=chore: commit pending changes',
        '-1',
        '--name-only',
        '--format=',
      )
      expect(files).toBe('a.txt')
      expect(git(root, 'status', '--porcelain')).toContain('b.txt')
      expect(readFileSync(join(root, 'tasks.yaml'), 'utf8')).not.toContain('uncommitted changes')
    } finally {
      Bun.spawn = originalSpawn
    }
  })
})
