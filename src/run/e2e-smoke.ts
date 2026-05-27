/**
 * e2e smoke test — runs the hello-world task in examples/e2e against a live LLM.
 *
 * Usage:  bun run e2e:smoke
 * Requires: ANTHROPIC_API_KEY set in env (or OPENROUTER_API_KEY for openrouter executor)
 *
 * Exit 0 = task completed + QA passed + hello.txt written.
 * Exit 1 = any failure (prints reason).
 */

import { resolve, join } from 'path'
import { existsSync, readFileSync, rmSync } from 'fs'
import { runTask } from './harness.ts'
import { loadTasks } from '../tasks/loader.ts'
import { RunLogger } from './logger.ts'

const ROOT = resolve(import.meta.dir, '../../examples/e2e')
const HELLO_FILE = join(ROOT, 'hello.txt')

function fail(msg: string): never {
  console.error(`\n[e2e:smoke] FAIL — ${msg}`)
  process.exit(1)
}

async function main() {
  console.log('[e2e:smoke] Starting smoke test...')
  console.log(`  project: ${ROOT}`)

  // pre-cleanup
  if (existsSync(HELLO_FILE)) rmSync(HELLO_FILE)

  // load task
  const file = loadTasks(ROOT)
  const task = file.tasks.find(t => t.id === 'hello-world')
  if (!task) fail('hello-world task not found in examples/e2e/tasks.yaml')

  // reset status so harness doesn't skip it
  task.status = 'pending'

  const log = new RunLogger(ROOT, 'hello-world')

  console.log('[e2e:smoke] Calling LLM...')
  const result = await runTask({
    projectRoot: ROOT,
    contextText: '',
    task,
    logger: log,
    sandboxMode: 'cwd',
  })

  console.log(`\n[e2e:smoke] Result: ${result.status}`)
  console.log(`  QA:      ${result.qaVerdict} — ${result.qaReason}`)
  console.log(`  tokens:  ${result.cost.inputTokens} in / ${result.cost.outputTokens} out`)
  console.log(`  cost:    $${result.cost.usd.toFixed(5)}`)
  console.log(`  time:    ${result.elapsedMs}ms`)

  if (result.status !== 'done') {
    fail(`task status is "${result.status}", expected "done".\n  Reason: ${result.qaReason}`)
  }

  // verify file on disk
  if (!existsSync(HELLO_FILE)) fail('hello.txt was not written to disk')

  const content = readFileSync(HELLO_FILE, 'utf-8').trim()
  if (content !== 'OK') fail(`hello.txt content is "${content}", expected "OK"`)

  console.log('\n[e2e:smoke] PASS — hello.txt exists and contains "OK"')
  process.exit(0)
}

main().catch(e => {
  console.error('[e2e:smoke] Unexpected error:', e)
  process.exit(1)
})
