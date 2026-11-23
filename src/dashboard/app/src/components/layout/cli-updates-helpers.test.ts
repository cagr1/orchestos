import { expect, test } from 'bun:test'
import { cliUpdatesLabel, runCliUpdatesSequentially } from './cli-updates-helpers.ts'

test('pluralizes the entry label', () => {
  expect(cliUpdatesLabel(1)).toBe('1 CLI update')
  expect(cliUpdatesLabel(2)).toBe('2 CLI updates')
})
test('Update all awaits each CLI before starting the next', async () => {
  const calls: string[] = []
  let release = () => {}
  const first = new Promise<void>((resolve) => {
    release = resolve
  })
  const run = runCliUpdatesSequentially(['codex', 'claude'], async (id) => {
    calls.push(`start ${id}`)
    if (id === 'codex') await first
    calls.push(`end ${id}`)
  })
  expect(calls).toEqual(['start codex'])
  release()
  await run
  expect(calls).toEqual(['start codex', 'end codex', 'start claude', 'end claude'])
})
