import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const hook = readFileSync(new URL('./pre-push.sh', import.meta.url), 'utf8')
const unsetLine = hook.split('\n').find((line) => line.startsWith('unset GIT_DIR'))

test('pre-push clears inherited git environment variables', () => {
  expect(unsetLine).toBeDefined()
  const result = Bun.spawnSync(['bash', '-c', `${unsetLine}; env`], {
    env: { ...process.env, GIT_DIR: '/repo/.git/worktrees/example', GIT_INDEX_FILE: '/tmp/index' },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  expect(result.exitCode).toBe(0)
  const output = new TextDecoder().decode(result.stdout)
  expect(output).not.toMatch(/^GIT_DIR=/m)
  expect(output).not.toMatch(/^GIT_INDEX_FILE=/m)
})

test('pre-push clears git variables before creating its worktree and running coverage', () => {
  expect(unsetLine).toBeDefined()
  const unsetIndex = hook.indexOf(unsetLine ?? '')
  const worktreeIndex = hook.search(/^if ! git worktree add/m)
  const coverageIndex = hook.search(/^if ! \(cd .*bun run test:coverage/m)
  expect(unsetIndex).toBeGreaterThanOrEqual(0)
  expect(worktreeIndex).toBeGreaterThan(unsetIndex)
  expect(coverageIndex).toBeGreaterThan(unsetIndex)
})
