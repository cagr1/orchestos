/**
 * S22.10 — Sub-agents end-to-end smoke test
 *
 * Validates the full sub-agent pipeline:
 *   plan → 2 sub-tasks with depends_on → memory written by A → read by B → merged to base branch
 *
 * Usage:    bun run e2e:smoke-agents
 * Requires: ANTHROPIC_API_KEY (or OPENROUTER_API_KEY for openrouter executor)
 *
 * Exit 0 = both sub-tasks completed, memory persisted, files on base branch.
 * Exit 1 = any failure (prints reason + scheduler log).
 *
 * The test spins up a disposable git repo in a temp directory, so it never
 * pollutes the OrchestOS repo itself.
 */

import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } from 'fs'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'
import { createPlan } from '../agents/planner.ts'
import { executePlan } from './scheduler.ts'
import { executeSubTask } from '../agents/executor.ts'
import { getMemory } from '../db/memory.ts'
import { runMigrations } from '../db/migrate.ts'
import { upsertProject, getProject } from '../db/projects.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(msg: string, detail?: string): never {
  console.error(`\n[smoke-agents] FAIL — ${msg}`)
  if (detail) console.error(detail)
  process.exit(1)
}

function pass(msg: string) {
  console.log(`[smoke-agents] ✓  ${msg}`)
}

function git(cmd: string, cwd: string) {
  return execSync(`git ${cmd}`, { cwd, stdio: 'pipe' }).toString().trim()
}

// ---------------------------------------------------------------------------
// Plan YAML — two sub-tasks with real depends_on
//
//   write-greeting  →  write-response
//
//   write-greeting: writes greeting.txt, stores summary in topic_key: smoke-greeting
//   write-response: depends on write-greeting, reads prior memory, writes response.txt
// ---------------------------------------------------------------------------

const PLAN_YAML = `
version: 1
parent_task_id: smoke-plan

sub_tasks:
  - id: write-greeting
    description: >
      Create a file called greeting.txt containing exactly one line with the text
      "Hello from sub-agent A" and nothing else.
    acceptance:
      - greeting.txt exists
      - greeting.txt contains the text Hello from sub-agent A
    depends_on: []
    allowed_tools: [read, write]
    topic_key: smoke-greeting
    executor_model: anthropic/claude-3-haiku
    output:
      - greeting.txt

  - id: write-response
    description: >
      Create a file called response.txt containing exactly one line that starts
      with the word Response followed by a colon, for example "Response: OK".
    acceptance:
      - response.txt exists
      - response.txt first line starts with Response
    depends_on: [write-greeting]
    allowed_tools: [read, write]
    topic_key: smoke-response
    executor_model: anthropic/claude-3-haiku
    output:
      - response.txt
`.trim()

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('[smoke-agents] Starting sub-agent smoke test…\n')

  // 1. DB migrations (needed for memory_entries)
  runMigrations()

  // 2. Disposable git repo in temp dir
  const repoDir = mkdtempSync(join(tmpdir(), 'orchestos-smoke-agents-'))
  console.log(`[smoke-agents] temp repo: ${repoDir}`)

  try {
    // Init git repo
    git('init', repoDir)
    git('config user.email "smoke@orchestos.test"', repoDir)
    git('config user.name "Smoke"', repoDir)

    // Write minimal AGENTS.md so harness has context
    writeFileSync(join(repoDir, 'AGENTS.md'), [
      '# smoke-agents test project',
      '',
      'Disposable project used by the sub-agent smoke test.',
      'Two sub-tasks: write-greeting → write-response.',
    ].join('\n'))

    git('add .', repoDir)
    git('commit -m "initial commit"', repoDir)

    const baseBranch = git('rev-parse --abbrev-ref HEAD', repoDir)
    console.log(`[smoke-agents] base branch: ${baseBranch}\n`)

    // 3. Register project in SQLite (needed for memory_entries queries)
    const emptyProfile = {
      manifest: { name: 'smoke-agents', runtime: 'unknown', framework: 'none', deps: [] },
      languages: [],
      conventions: { prettier: null, eslint: null, editorconfig: null, tsconfig: null },
      commands: [],
    }
    upsertProject(repoDir, emptyProfile, readFileSync(join(repoDir, 'AGENTS.md'), 'utf-8'))
    const project = getProject(repoDir)
    if (!project) fail('project not found in SQLite after upsert')
    const projectId = project!.id
    console.log(`[smoke-agents] project id: ${projectId}`)

    // 4. Parse plan
    const subTasks = createPlan(PLAN_YAML)
    console.log(`[smoke-agents] plan: ${subTasks.map(t => t.id).join(' → ')}\n`)

    // 5. Execute plan
    const schedulerResult = await executePlan(
      subTasks,
      {
        parentTaskId: 'smoke-plan',
        projectRoot:  repoDir,
        baseBranch,
        projectId,
      },
      (st, worktree) => executeSubTask(st, worktree, {
        projectId,
        parentExecutor: 'openrouter',
        allSubTasks: subTasks,
      }),
    )

    // 6. Print per-task summary
    console.log('\n[smoke-agents] Sub-task results:')
    for (const log of schedulerResult.sub_tasks) {
      const icon = log.status === 'completed' ? '✓' : '✗'
      const cost = `$${log.usd_cost.toFixed(5)}`
      const tok  = `${log.tokens.input}in/${log.tokens.output}out`
      console.log(`  ${icon} ${log.id.padEnd(20)} ${log.status.padEnd(12)} ${cost}  ${tok}`)
      if (log.error) console.log(`    error: ${log.error}`)
    }

    console.log(`\n  aggregated cost: $${schedulerResult.aggregated_cost.toFixed(5)}`)
    console.log(`  aggregated time: ${schedulerResult.aggregated_ms}ms`)

    if (!schedulerResult.all_passed) {
      fail('scheduler reported all_passed=false', JSON.stringify(schedulerResult.sub_tasks, null, 2))
    }

    // 7. Verify files exist on base branch
    const greetingPath = join(repoDir, 'greeting.txt')
    const responsePath = join(repoDir, 'response.txt')

    if (!existsSync(greetingPath)) fail('greeting.txt not found on base branch after merge')
    if (!existsSync(responsePath)) fail('response.txt not found on base branch after merge')

    const greetingContent = readFileSync(greetingPath, 'utf-8').trim()
    const responseContent = readFileSync(responsePath, 'utf-8').trim()

    if (!greetingContent.includes('Hello from sub-agent A')) {
      fail(`greeting.txt content unexpected: "${greetingContent}"`)
    }
    const responseFirstLine = responseContent.split('\n')[0] ?? ''
    if (!responseFirstLine.toLowerCase().startsWith('response')) {
      fail(`response.txt first line must start with "Response", got: "${responseFirstLine}"`)
    }

    pass(`greeting.txt: "${greetingContent}"`)
    pass(`response.txt: "${responseContent}"`)

    // 8. Verify memory_entries written (S22.5a)
    const greetingMem = getMemory(projectId, 'smoke-greeting')
    const responseMem = getMemory(projectId, 'smoke-response')

    if (!greetingMem) fail('memory_entries: smoke-greeting not found')
    if (!responseMem) fail('memory_entries: smoke-response not found')

    pass(`memory smoke-greeting: "${greetingMem!.content.slice(0, 60)}…"`)
    pass(`memory smoke-response: "${responseMem!.content.slice(0, 60)}…"`)

    console.log('\n[smoke-agents] PASS — sub-agent pipeline complete ✓')
    process.exit(0)

  } finally {
    // Cleanup temp repo
    try {
      // Remove worktrees first to avoid git errors
      execSync('git worktree prune', { cwd: repoDir, stdio: 'pipe' })
    } catch { /* ignore */ }
    try {
      rmSync(repoDir, { recursive: true, force: true })
    } catch { /* ignore */ }
  }
}

main().catch(e => {
  console.error('[smoke-agents] Unexpected error:', e)
  process.exit(1)
})
