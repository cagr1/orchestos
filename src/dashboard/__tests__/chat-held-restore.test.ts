import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

it('restored cancelled tasks remain hidden even when the loaded task list is empty', () => {
  const source = readFileSync(new URL('../public/screens-core.js', import.meta.url), 'utf8')
  const visible = runInNewContext(`${source}\nshouldShowTaskConfirmation`, {
    window: {},
    SCREENS: {},
  })
  const pending = { id: 'cancelled-task', existingFiles: ['existing.txt'] }
  expect(visible({ tasksStatus: 'ok', tasks: [] }, pending)).toBe(false)
  expect(visible({ tasksStatus: 'loading', tasks: [] }, pending)).toBe(true)
  expect(visible({ tasksStatus: 'error', tasks: [] }, pending)).toBe(true)
  expect(visible({ tasksStatus: 'ok', tasksYamlError: 'bad YAML', tasks: [] }, pending)).toBe(true)
  expect(
    visible({ tasksStatus: 'ok', tasks: [{ id: pending.id, status: 'pending' }] }, pending),
  ).toBe(true)
  expect(visible({ tasksStatus: 'ok', tasks: [{ id: pending.id, status: 'done' }] }, pending)).toBe(
    false,
  )
  expect(visible({ tasksStatus: 'loading' }, { ...pending, resolved: true })).toBe(false)
})
