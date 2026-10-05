import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleApiTasksRun, resolveTaskRunProjectId } from './tasks.ts'

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
    Bun.spawn = (() => ({ exited: Promise.resolve(0) })) as unknown as typeof Bun.spawn
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
