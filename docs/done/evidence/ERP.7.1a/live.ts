/** Reproduce with bun run gate:evidence -- --label erp.7.1a -- bun run docs/done/evidence/ERP.7.1a/live.ts */
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { loadOrcheConfig } from '../../../../src/config/load.ts'
import { startServer } from '../../../../src/dashboard/server.ts'
import { runMigrations } from '../../../../src/db/migrate.ts'
import { getProject, upsertProject } from '../../../../src/db/projects.ts'
import {
  finishApprovalRun,
  getApprovalRun,
  pendingApprovals,
} from '../../../../src/run/approvals.ts'
import { runTask } from '../../../../src/run/harness.ts'
import { RunLogger } from '../../../../src/run/logger.ts'
import { loadTasks, saveTasks } from '../../../../src/tasks/loader.ts'
import { validateTask } from '../../../../src/tasks/schema.ts'

const evidence = import.meta.dir
const roots: string[] = []
const runs: Promise<unknown>[] = []
const liveRunIds: string[] = []
let dashboard: ReturnType<typeof startServer> | undefined
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
function git(root: string, ...args: string[]) {
  const result = Bun.spawnSync({
    cmd: [
      'git',
      '-c',
      'user.name=ERP fixture',
      '-c',
      'user.email=erp-fixture@invalid',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    cwd: root,
    env: { ...process.env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return result.stdout.toString().trim()
}
try {
  runMigrations()
  dashboard = startServer(62471)
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(dashboard.url)
  console.log('DASHBOARD', dashboard.url, 'browser title:', await page.title())
  const config = loadOrcheConfig(process.cwd())
  check(
    config.roles.executor?.agent === 'codex',
    'Use the configured Codex executor, without model substitution',
  )
  for (const decision of ['approve', 'reject'] as const) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'erp71a-live-')))
    roots.push(root)
    git(root, 'init', '-b', 'master')
    writeFileSync(join(root, '.gitignore'), '.orchestos/\nruns/\n')
    writeFileSync(join(root, 'edit.txt'), 'before\n')
    writeFileSync(
      join(root, 'orchestos.config.yaml'),
      readFileSync(join(process.cwd(), 'orchestos.config.yaml')),
    )
    const task = validateTask(
      {
        id: `approval-${decision}`,
        executor: 'openrouter',
        engine: 'codex',
        executor_model: config.roles.executor.model,
        cli_effort: config.roles.executor.effort,
        approvalMode: 'auto-edit',
        output: ['edit.txt'],
        status: 'running',
        description:
          'Permission fixture. The entire edit.txt content is exactly before followed by a newline. Do not inspect files, run pwd, cat, or any other command before the patch. First use apply_patch to change edit.txt from before to after. Then execute exactly mkdir command-marker in the current worktree directory. This command is required. Do not request escalation. If denied, do not retry or use alternatives. Do not make any other change. Finish immediately.',
      },
      0,
    )
    saveTasks(root, { version: 1, project: 'permission-fixture', tasks: [task] })
    git(root, 'add', '.')
    git(root, 'commit', '-m', 'fixture')
    upsertProject(root, {} as any, '')
    const project = getProject(root)!
    const log = new RunLogger(root, task.id)
    const resultPromise = runTask({
      projectRoot: root,
      projectId: project.id,
      contextText: '',
      task,
      logger: log,
      orcheConfig: config,
      orcheConfigFound: true,
      sandboxMode: 'worktree',
      sandboxBranch: 'master',
    })
    runs.push(resultPromise)
    let settled = false
    void resultPromise.then(() => {
      settled = true
    })
    let runId: string | undefined
    let response: any
    const request = async (path: string, body?: unknown) =>
      page.evaluate(
        async ({ path, projectId, body }) => {
          const response = await fetch(path, {
            method: body === undefined ? 'GET' : 'POST',
            headers: { 'content-type': 'application/json', 'x-orchestos-project-id': projectId },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          })
          return { status: response.status, body: await response.json() }
        },
        { path, projectId: project.id, body },
      )
    const deadline = Date.now() + 240000
    while (Date.now() < deadline && !settled) {
      const tasks = await request('/api/tasks')
      runId = (tasks.body as any).tasks?.[0]?.runId ?? undefined
      if (runId) {
        response = await request(`/api/runs/${runId}/approval`)
        if (response.body.pending?.length) break
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    check(
      runId && response?.body.pending?.length === 1,
      `Expected command approval, settled=${settled}`,
    )
    liveRunIds.push(runId)
    console.log('GET_PENDING', decision, JSON.stringify(response))
    check(response.body.pending[0].kind === 'command', 'Editing must not ask')
    check(
      response.body.events.some(
        (event: any) => event.type === 'approval_resolved' && event.decision === 'auto',
      ),
      'Patch must have an automatic resolution',
    )
    const commandCwd = response.body.pending[0].detail.cwd
    check(
      readFileSync(join(commandCwd, 'edit.txt'), 'utf8') === 'after\n',
      'Patch happened before user approval',
    )
    check(!existsSync(join(commandCwd, 'command-marker')), 'Command has not run before approval')
    const csrf = await page.evaluate(
      async ({ runId, projectId }) => {
        const r = await fetch(`/api/runs/${runId}/approval`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-orchestos-project-id': projectId },
          body: '{}',
        })
        return r.status
      },
      { runId, projectId: project.id },
    )
    // Same-origin browser requests reach validation (400), proving CSRF middleware remains active.
    check(csrf === 400, 'Expected body validation for same-origin request')
    const resolution = await request(`/api/runs/${runId}/approval`, {
      approvalId: response.body.pending[0].approvalId,
      decision,
    })
    console.log('POST_APPROVAL', decision, JSON.stringify(resolution))
    check(resolution.status === 200, 'Decision must be accepted')
    // Poll the marker while the worktree still exists; harness discards it after merge-back.
    let markerObserved = false
    while (!settled && Date.now() < deadline) {
      markerObserved ||= existsSync(join(commandCwd, 'command-marker'))
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    const result = await resultPromise
    console.log('RESULT', decision, JSON.stringify(result), 'commandMarkerObserved', markerObserved)
    check(result.runId === runId, 'Live run identity must equal persisted final run identity')
    check(result.status === 'done', `Expected done: ${JSON.stringify(result)}`)
    check(markerObserved === (decision === 'approve'), 'Command marker must match decision')
    check(
      pendingApprovals(runId).length === 0 && getApprovalRun(runId)?.active === 0,
      'Run must release pending requests',
    )
    const file = loadTasks(root)
    file.tasks[0]!.status = 'done'
    file.tasks[0]!.run_id = result.runId
    saveTasks(root, file)
    console.log('GET_FINAL', JSON.stringify(await request(`/api/runs/${runId}/approval`)))
    writeFileSync(
      join(evidence, `live-${decision}.json`),
      `${JSON.stringify({ decision, pending: response, resolution, result, markerObserved }, null, 2)}\n`,
    )
    await page.screenshot({ path: join(evidence, `dashboard-${decision}.png`) })
  }
  console.log(
    'LIVE PASS: real dashboard + browser + Codex tasks; auto patch; approve/reject command; done; no pending approvals',
  )
} finally {
  for (const id of liveRunIds) finishApprovalRun(id)
  await Promise.allSettled(runs)
  await browser?.close()
  dashboard?.server.stop(true)
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true })
    console.log('FIXTURE_REMOVED', root, !existsSync(root))
  }
  console.log('Temporary runs exported and home cleaned by gate:evidence after this process exits')
}
