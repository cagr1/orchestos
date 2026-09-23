import { afterEach, describe, expect, it } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stringify as yamlStringify } from 'yaml'
import { handleApiTasksBulkDelete, handleApiTasksDelete } from '../handlers/tasks.ts'

const roots: string[] = []

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-task-delete-'))
  roots.push(root)
  writeFileSync(join(root, '.gitignore'), '.orchestos/\n')
  writeFileSync(
    join(root, 'tasks.yaml'),
    yamlStringify({
      version: 1,
      project: 'fixture',
      tasks: [
        { id: 'one', description: 'one', output: ['one.txt'], status: 'pending' },
        { id: 'two', description: 'two', output: ['two.txt'], status: 'pending' },
      ],
    }),
  )
  execFileSync('git', ['init', '-q'], { cwd: root })
  execFileSync('git', ['add', '.gitignore', 'tasks.yaml'], { cwd: root })
  execFileSync(
    'git',
    [
      '-c',
      'user.name=task-test',
      '-c',
      'user.email=task-test@example.invalid',
      'commit',
      '-qm',
      'fixture',
    ],
    { cwd: root },
  )
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('dashboard task deletion', () => {
  it('commits single deletion so the project is clean for a later run', () => {
    const root = fixtureRoot()
    const response = handleApiTasksDelete(new URL('http://localhost/api/tasks/one'), root)
    expect(response.status).toBe(200)
    expect(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })).toBe('')
    expect(readFileSync(join(root, 'tasks.yaml'), 'utf8')).not.toContain('id: one')
  })

  it('commits bulk deletion too', async () => {
    const root = fixtureRoot()
    const response = await handleApiTasksBulkDelete(
      new Request('http://localhost/api/tasks/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: ['one', 'two'] }),
      }),
      root,
    )
    expect(response.status).toBe(200)
    expect(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })).toBe('')
    expect(readFileSync(join(root, 'tasks.yaml'), 'utf8')).not.toContain('id: one')
  })
})
