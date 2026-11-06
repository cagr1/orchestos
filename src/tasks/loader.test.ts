import { expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hashFile, loadTasks, mutateTasks, saveTasks, updateTaskStatus } from './loader.ts'

function fixture(root: string) {
  const file = {
    version: 1 as const,
    project: 'fixture',
    tasks: ['one', 'two', 'three', 'four'].map((id) => ({
      id,
      description: id,
      executor: 'openrouter' as const,
      input: [],
      output: [`${id}.txt`],
      depends_on: [],
      status: 'pending' as const,
      retry_count: 0,
    })),
  }
  saveTasks(root, file)
  return file
}

it('rejects an invalid task file before writing tasks.yaml', () => {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-loader-test-'))
  const path = join(root, 'tasks.yaml')
  const original = 'version: 1\nproject: fixture\ntasks: []\n'
  writeFileSync(path, original)

  expect(() =>
    saveTasks(root, {
      version: 1,
      project: 'fixture',
      tasks: [
        {
          id: 'missing-output',
          description: 'Invalid task',
          executor: 'openrouter',
          input: [],
          output: [],
          depends_on: [],
          status: 'pending',
          retry_count: 0,
        },
      ],
    }),
  ).toThrow('tasks.yaml[0]: "output" must be a non-empty array — this is the contract')

  expect(readFileSync(path, 'utf8')).toBe(original)
})

it('saveTasks preserves the optimistic conflict error inside its lock', () => {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-loader-test-'))
  fixture(root)
  const staleHash = hashFile(join(root, 'tasks.yaml'))
  updateTaskStatus(root, 'one', { retry_reason: 'newer' })
  expect(() => saveTasks(root, loadTasks(root), staleHash)).toThrow(
    /tasks.yaml conflict: file changed since last read/,
  )
})

it('mutateTasks does not write when its callback throws and updateTaskStatus never recreates missing tasks', () => {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-loader-test-'))
  fixture(root)
  const before = readFileSync(join(root, 'tasks.yaml'), 'utf8')
  expect(() =>
    mutateTasks(root, (file) => {
      file.tasks.pop()
      throw new Error('abort mutation')
    }),
  ).toThrow('abort mutation')
  expect(readFileSync(join(root, 'tasks.yaml'), 'utf8')).toBe(before)
  mutateTasks(root, (file) => {
    file.tasks = file.tasks.filter((task) => task.id !== 'one')
  })
  expect(() => updateTaskStatus(root, 'one', { retry_reason: 'should not return' })).toThrow(
    'Task "one" not found in tasks.yaml',
  )
  expect(loadTasks(root).tasks.some((task) => task.id === 'one')).toBe(false)
})
