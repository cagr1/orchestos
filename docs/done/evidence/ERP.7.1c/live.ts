/** bun run gate:evidence -- --label erp.7.1c -- bun run docs/done/evidence/ERP.7.1c/live.ts */
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'
import type { AgentChoice } from '../../../../src/config/schema.ts'
import { loadOrcheConfig } from '../../../../src/config/load.ts'
import { startServer } from '../../../../src/dashboard/server.ts'
import { createChatSession } from '../../../../src/db/chat-sessions.ts'
import { runMigrations } from '../../../../src/db/migrate.ts'
import { getProject, upsertProject } from '../../../../src/db/projects.ts'
import { getTaskRunWatch } from '../../../../src/db/task-run-watch.ts'
import { activeApprovalRun, finishApprovalRun } from '../../../../src/run/approvals.ts'
import { loadTasks, saveTasks } from '../../../../src/tasks/loader.ts'

const evidence = import.meta.dir
const checks: Record<string, unknown>[] = []
let root: string | undefined
let taskId: string | undefined
let projectId: string | undefined
let dashboard: ReturnType<typeof startServer> | undefined
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
let failure: unknown
function check(value: unknown, name: string, detail?: unknown): asserts value {
  checks.push({ name, pass: !!value, detail })
  console.log(JSON.stringify(checks.at(-1)))
  if (!value) throw new Error(name)
}
function git(cwd: string, ...args: string[]) {
  const result = Bun.spawnSync(
    [
      'git',
      '-c',
      'user.name=ERP fixture',
      '-c',
      'user.email=erp-fixture@invalid',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd, stdout: 'pipe', stderr: 'pipe' },
  )
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
}
try {
  runMigrations()
  dashboard = startServer(0)
  browser = await chromium.launch({ headless: true })
  root = realpathSync(mkdtempSync(join(tmpdir(), 'erp71c-live-')))
  git(root, 'init', '-b', 'master')
  writeFileSync(join(root, '.gitignore'), '.orchestos/\nruns/\n')
  writeFileSync(join(root, 'README.md'), '# Composer permission fixture\n')
  writeFileSync(
    join(root, 'orchestos.config.yaml'),
    readFileSync(join(process.cwd(), 'orchestos.config.yaml')),
  )
  saveTasks(root, { version: 1, project: 'composer-permission-fixture', tasks: [] })
  git(root, 'add', '.')
  git(root, 'commit', '-m', 'fixture')
  upsertProject(root, {} as never, '')
  projectId = getProject(root)!.id
  const config = loadOrcheConfig(root)
  check(!!config.roles.orchestrator, 'Use configured orchestrator without substituting its model')
  const session = createChatSession({
    projectId,
    agent: config.roles.orchestrator!.agent as AgentChoice,
    mode: 'code',
    title: 'Composer permissions',
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.addInitScript(
    ({ projectId }) => {
      localStorage.setItem('orchestos-last-project', projectId)
      localStorage.removeItem('orchestos-last-dev')
    },
    { projectId },
  )
  await page.goto(dashboard.url)
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  const selector = page.getByRole('button', { name: 'Task approval mode', exact: true })
  await selector.waitFor({ timeout: 30000 })
  check((await selector.innerText()).includes('Auto-edit'), 'Composer defaults to Auto-edit')
  await selector.click()
  const menu = page.getByRole('menu', { name: 'Task approval modes' })
  check(
    (await menu.getByRole('menuitemradio').allTextContents())
      .map((text) => text.replace(/\s+/g, ''))
      .join('|') ===
      'SupervisedAsksbeforeeveryeditandcommand|Auto-editEditsfilesfreely,asksbeforecommands|FullaccessRunswithoutasking',
    'Menu exposes ordered choices and descriptions',
  )
  await page.screenshot({ path: join(evidence, 'composer-menu.png') })
  await menu.getByRole('menuitemradio', { name: /^Supervised/ }).click()
  await page.reload()
  await selector.waitFor()
  check((await selector.innerText()).includes('Supervised'), 'Supervised survives reload')
  const posted = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/chat' && response.request().method() === 'POST',
    { timeout: 240000 },
  )
  const composer = page.locator('[data-composer-region] textarea')
  await composer.fill(
    'Create a task now using create_task. Output: permission.txt. Description: First use apply_patch to create permission.txt containing exactly approved followed by a newline. Do not run commands before the patch. Do not inspect files. After the patch run exactly mkdir -p command-marker. If denied, stop immediately without retrying. Use no acceptance_criteria. Create the task; do not execute it in chat.',
  )
  await composer.press('Enter')
  const response = await posted
  const payload = await response.json()
  check(response.ok(), 'Real chat turn succeeds', payload)
  check(
    response.request().postDataJSON().approvalMode === 'supervised',
    'Chat request sends selected mode',
  )
  check(response.request().postDataJSON().sessionId === session.id, 'Chat uses the fixture session')
  taskId = payload.autoTask?.id
  check(!!taskId, 'Real chat creates a task', payload)
  const task = loadTasks(root).tasks.find((entry) => entry.id === taskId)
  check(task?.approvalMode === 'supervised', 'tasks.yaml persists selected mode', task)
  const card = page.locator(`[data-task-id="${taskId}"]`)
  if (payload.autoTask?.held)
    await card.getByRole('button', { name: 'Approve', exact: true }).click()
  const scope = { 'x-orchestos-project-id': projectId }
  const deadline = Date.now() + 240000
  if (config.roles.executor?.agent === 'codex') {
    await card
      .locator('[data-task-approval]')
      .getByRole('button', { name: 'Approve', exact: true })
      .first()
      .waitFor({ timeout: 240000 })
    check(
      await card.locator('[data-task-approval]').isVisible(),
      'Codex task shows per-action approval',
    )
    await page.screenshot({ path: join(evidence, 'task-mode.png') })
    // Let the real task finish so gate:evidence can export its durable run.
    while (Date.now() < deadline) {
      const pending = card.locator('[data-task-approval] button:enabled', {
        hasText: 'Always approve in this task',
      })
      if (await pending.count()) {
        try {
          await pending.first().click({ timeout: 2000 })
        } catch (error) {
          if (!(error instanceof Error) || !/detached|not attached/i.test(error.message))
            throw error
        }
      }
      const rows = await page.request
        .get(`${dashboard.url}/api/tasks`, { headers: scope })
        .then((res) => res.json())
      const row = rows.tasks?.find((entry: { id: string }) => entry.id === taskId)
      if (row?.status === 'done' || row?.status === 'failed' || row?.status === 'failed_permanent')
        break
      await delay(300)
    }
  } else {
    await card.waitFor()
    await page.screenshot({ path: join(evidence, 'task-mode.png') })
  }
  const settleDeadline = Date.now() + 30000
  while (getTaskRunWatch(root, taskId) && Date.now() < settleDeadline) await delay(250)
  check(!getTaskRunWatch(root, taskId), 'Task worker finishes before cleanup')
  check(!activeApprovalRun(taskId, projectId), 'No approval run remains active')
} catch (error) {
  failure = error
  console.error(error)
} finally {
  if (root && taskId) {
    const id = activeApprovalRun(taskId, projectId ?? null)
    if (id) finishApprovalRun(id)
    const deadline = Date.now() + 30000
    while (getTaskRunWatch(root, taskId) && Date.now() < deadline) await delay(250)
  }
  await browser?.close()
  dashboard?.server.stop(true)
  if (root && (!taskId || !getTaskRunWatch(root, taskId))) {
    rmSync(root, { recursive: true, force: true })
    check(!existsSync(root), 'Fixture removed')
  }
  writeFileSync(
    join(evidence, '../ERP.7.1c-live.json'),
    `${JSON.stringify({ pass: !failure, checks, ...(failure ? { error: String(failure) } : {}) }, null, 2)}\n`,
  )
  console.log(
    'Temporary runs are exported by gate:evidence; failed exports preserve the temporary home.',
  )
}
if (failure) process.exitCode = 1
