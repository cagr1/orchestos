/** Reproduce with bun run gate:evidence -- --label erp.7.1d1 -- bun run docs/done/evidence/ERP.7.1d1/live.ts */
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { chromium } from 'playwright'
import { loadOrcheConfig } from '../../../../src/config/load.ts'
import { settleTaskRun } from '../../../../src/dashboard/handlers/task-report.ts'
import { startServer } from '../../../../src/dashboard/server.ts'
import { appendChatExchange, createChatSession } from '../../../../src/db/chat-sessions.ts'
import { runMigrations } from '../../../../src/db/migrate.ts'
import { getProject, upsertProject } from '../../../../src/db/projects.ts'
import { getTaskRunWatch, upsertTaskRunWatch } from '../../../../src/db/task-run-watch.ts'
import {
  activeApprovalRun,
  approvalEvents,
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
const results: Array<Record<string, unknown>> = ['approve', 'reject'].map((decision) => ({
  decision,
  status: 'not_run',
}))
try {
  runMigrations()
  dashboard = startServer(62472)
  browser = await chromium.launch({ headless: true })
  const config = loadOrcheConfig(process.cwd())
  const claudeRoleName = (['executor', 'orchestrator', 'reviewer', 'auxiliary'] as const).find(
    (role) => config.roles[role]?.agent === 'claude',
  )
  const claudeRole = claudeRoleName ? config.roles[claudeRoleName] : undefined
  check(
    claudeRole,
    'Configure a Claude executor explicitly before running this gate; no model substitution',
  )
  for (const decision of ['approve', 'reject'] as const) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'erp71d1-live-')))
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
        engine: 'external',
        executor_model: claudeRole.model,
        cli_effort: claudeRole.effort,
        approvalMode: 'auto-edit',
        output: ['edit.txt'],
        status: 'running',
        description:
          'Permission fixture. The entire edit.txt content is exactly before followed by a newline. Do not inspect files, run pwd, cat, or any other command before the patch. First use Edit to change edit.txt from before to after (preserve its newline). Then use Bash to execute exactly mkdir -p command-marker in the current worktree directory. This command is required. ' +
          'Do not request escalation. If denied, do not retry or use alternatives. Do not make any other change. Finish immediately.',
      },
      0,
    )
    saveTasks(root, { version: 1, project: 'permission-fixture', tasks: [task] })
    git(root, 'add', '.')
    git(root, 'commit', '-m', 'fixture')
    upsertProject(root, {} as any, '')
    const project = getProject(root)!
    const session = createChatSession({
      projectId: project.id,
      agent: 'claude',
      mode: 'chat',
      title: `Approval ${decision}`,
    })
    appendChatExchange({
      sessionId: session.id,
      userContent: 'Run the permission fixture',
      assistantContent: `Permission fixture.\n\n⏸ Created task \`${task.id}\`, waiting for your confirmation before it runs.`,
      taskId: task.id,
      taskHeld: false,
    })
    upsertTaskRunWatch({
      root,
      task_id: task.id,
      project_id: project.id,
      session_id: session.id,
      pid: process.pid,
    })
    const page = await browser.newPage()
    await page.addInitScript(
      ({ projectId }) => {
        localStorage.setItem('orchestos-last-project', projectId)
        localStorage.removeItem('orchestos-last-dev')
      },
      { projectId: project.id },
    )
    await page.goto(dashboard.url)
    await page.getByRole('button', { name: 'Chat', exact: true }).click()
    const resultPromise = runTask({
      projectRoot: root,
      projectId: project.id,
      contextText: '',
      task,
      logger: new RunLogger(root, task.id),
      orcheConfig: config,
      orcheConfigFound: true,
      sandboxMode: 'worktree',
      sandboxBranch: 'master',
    })
    runs.push(resultPromise)
    let settled = false
    void resultPromise
      .finally(() => {
        settled = true
      })
      .catch(() => {})
    const request = async (path: string) =>
      page.evaluate(
        async ({ path, projectId }) => {
          const response = await fetch(path, { headers: { 'x-orchestos-project-id': projectId } })
          if (!response.ok) throw new Error(`GET ${path}: ${response.status}`)
          return response.json()
        },
        { path, projectId: project.id },
      )
    const deadline = Date.now() + 240000
    let runId: string | undefined
    let pending: any
    while (Date.now() < deadline && !settled) {
      const tasks = await request('/api/tasks')
      runId = tasks.tasks?.[0]?.runId
      if (runId) {
        pending = await request(`/api/runs/${runId}/approval`)
        if (pending.pending?.length) break
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    check(
      runId && pending?.pending?.length === 1,
      `Expected one pending approval: settled=${settled}`,
    )
    liveRunIds.push(runId)
    const commandCwd = pending.pending[0].detail.cwd
    check(
      pending.pending[0].detail.command === 'mkdir -p command-marker',
      'Exact command must request approval',
    )
    check(pending.pending[0].kind === 'command', 'Edit must auto-approve')
    check(
      readFileSync(join(commandCwd, 'edit.txt'), 'utf8') === 'after\n',
      'Automatic patch happened',
    )
    check(!existsSync(join(commandCwd, 'command-marker')), 'Command cannot execute before approval')
    const card = page.locator(`[data-task-id="${task.id}"]`)
    await card
      .locator('[data-task-approval] pre')
      .filter({ hasText: 'mkdir -p command-marker' })
      .waitFor({ timeout: 15000 })
    await page.getByTitle('Waiting for your approval', { exact: true }).waitFor()
    await page.screenshot({ path: join(evidence, `${decision}-chat-sidebar.png`) })
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await page.getByRole('button', { name: basename(root), exact: true }).click()
    await page.getByTitle('Waiting for your approval', { exact: true }).waitFor()
    await page.screenshot({ path: join(evidence, `${decision}-sidebar.png`) })
    await page.getByRole('button', { name: 'Chat', exact: true }).click()
    const label = decision === 'approve' ? 'Approve' : 'Reject'
    await card.getByRole('button', { name: label, exact: true }).waitFor()
    await page.screenshot({
      path: join(evidence, decision === 'reject' ? 'reject.png' : `${decision}.png`),
    })
    const posted = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/runs/${runId}/approval`) &&
        response.request().method() === 'POST',
    )
    await card.getByRole('button', { name: label, exact: true }).click()
    const resolution = await posted
    check(resolution.ok(), 'UI approval POST must succeed')
    check(resolution.request().postDataJSON().decision === decision, 'UI sends selected decision')
    let markerObserved = false
    while (!settled && Date.now() < deadline) {
      markerObserved ||= existsSync(join(commandCwd, 'command-marker'))
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    check(settled, 'Run must complete before deadline')
    const result = await resultPromise
    check(result.status === 'done', `Expected done: ${JSON.stringify(result)}`)
    check(result.runId === runId, 'Final run identity matches approval run')
    check(markerObserved === (decision !== 'reject'), 'Directory existence matches decision')
    check(
      pendingApprovals(runId).length === 0 && getApprovalRun(runId)?.active === 0,
      'No pending requests after run',
    )
    const events = approvalEvents(runId)
    const file = loadTasks(root)
    file.tasks[0]!.status = 'done'
    file.tasks[0]!.run_id = result.runId
    saveTasks(root, file)
    const watch = getTaskRunWatch(root, task.id)
    if (watch) settleTaskRun(watch)
    await card.locator('[data-task-approval]').waitFor({ state: 'hidden', timeout: 15000 })
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await page
      .getByTitle('Waiting for your approval', { exact: true })
      .waitFor({ state: 'hidden', timeout: 15000 })
    await page.getByRole('button', { name: 'Chat', exact: true }).click()
    await page
      .getByTitle('Waiting for your approval', { exact: true })
      .waitFor({ state: 'hidden', timeout: 15000 })
    await card
      .locator('[data-task-state-label]')
      .filter({ hasText: 'Done' })
      .waitFor({ timeout: 15000 })
    const record = {
      decision,
      pass: true,
      role: claudeRoleName,
      model: claudeRole.model,
      pending,
      result,
      markerObserved,
      events,
    }
    results[results.findIndex((item) => item.decision === decision)] = {
      ...record,
      status: 'passed',
    }
    console.log('CASE_PASS', JSON.stringify(record))
    await page.close()
  }
} catch (error) {
  for (const result of results) {
    if (result.status !== 'passed')
      Object.assign(result, { status: 'blocked', pass: false, error: String(error) })
  }
  throw error
} finally {
  writeFileSync(
    join(evidence, '../ERP.7.1d1-live.json'),
    `${JSON.stringify({ cases: results }, null, 2)}\n`,
  )
  for (const root of roots) {
    for (const task of loadTasks(root).tasks) {
      const runId = activeApprovalRun(task.id, getProject(root)?.id ?? null)
      if (runId) finishApprovalRun(runId)
    }
  }
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
