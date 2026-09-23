import { expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveTasks } from './loader.ts'

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
