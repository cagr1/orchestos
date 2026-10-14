import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { writeGateRoles } from '../lib.mjs'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

function gitOut(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

// ERP.4.12 — el commit de tasks.yaml ocurre justo después de que el CLI escribe el estado
// final; se espera a que aparezca en vez de leer el log en el mismo instante.
async function waitForTasksYamlCommit(cwd, taskId) {
  const deadline = Date.now() + 15_000
  let status = ''
  let subject = ''
  while (Date.now() <= deadline) {
    status = gitOut(['status', '--porcelain'], cwd)
    subject = gitOut(['log', '-1', '--format=%s'], cwd)
    if (!/(^|\s)tasks\.yaml$/m.test(status) && subject.startsWith(`chore(tasks): ${taskId} `)) break
    await delay(500)
  }
  return { status, subject }
}

async function tasksFor(api, projectId) {
  const response = await api('/api/tasks', {
    headers: { 'x-orchestos-project-id': projectId },
  })
  return response.data?.tasks ?? []
}

async function waitForTaskFinished(api, projectId, taskId, initialTask) {
  const startedAt = Date.now()
  const deadline = startedAt + 10 * 60_000
  let task
  while (Date.now() <= deadline) {
    task = (await tasksFor(api, projectId)).find((item) => item.id === taskId)
    if (
      task &&
      ((task.status !== 'pending' && task.status !== 'running') ||
        (task.status === 'pending' &&
          (task.retryCount !== initialTask.retryCount || task.runId !== initialTask.runId)))
    )
      return task
    if (
      task?.status === 'pending' &&
      Date.now() - startedAt >= 20_000 &&
      task.retryCount === initialTask.retryCount &&
      task.runId === initialTask.runId
    )
      return task
    await delay(2_000)
  }
  return task
}

async function recordRetry(api, projectId, task, note) {
  const listedRuns = await api('/api/runs', {
    headers: { 'x-orchestos-project-id': projectId },
  })
  const latestRun = (listedRuns.data ?? []).find((run) => run.taskId === task.id)
  const response = latestRun
    ? await api(`/api/runs/${encodeURIComponent(latestRun.id)}`, {
        headers: { 'x-orchestos-project-id': projectId },
      })
    : null
  const run = response?.data ?? response ?? {}
  const detail = {
    attempt: task.retryCount,
    qa_verdict: run.qaVerdict ?? null,
    qa_reason: run.qaReason ?? null,
    qa_model: run.qaModel ?? null,
    file_diffs: run.fileDiffs ?? [],
  }
  note(`failed attempt ${task.retryCount} QA detail`, JSON.stringify(detail))
}

export default async function tasks({ page, api, step, note, shot, visible, cleanup, runDir }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-13-2d-'))
  writeFileSync(join(projectRoot, 'README.md'), '# UI.13.2d\n')
  writeFileSync(join(projectRoot, '.gitignore'), '.orchestos/\n')
  run('git', ['init', '-q'], projectRoot)
  // identidad propia del repo temporal: el helper de producción no fija la suya
  run('git', ['config', 'user.name', 'ui-gate'], projectRoot)
  run('git', ['config', 'user.email', 'ui-gate@example.invalid'], projectRoot)
  run('git', ['add', 'README.md', '.gitignore'], projectRoot)
  run(
    'git',
    [
      '-c',
      'user.name=ui-gate',
      '-c',
      'user.email=ui-gate@example.invalid',
      'commit',
      '-qm',
      'fixture',
    ],
    projectRoot,
  )

  const repoRoot = process.cwd()
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'init', projectRoot], repoRoot)
  writeGateRoles(projectRoot)
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'task', 'init'], projectRoot)
  writeFileSync(
    join(projectRoot, 'tasks.yaml'),
    yamlStringify(
      {
        version: 1,
        project: 'ui-13-2d-gate',
        tasks: [
          {
            id: 'gate-first-task',
            description: 'Append the line "Gate ran." at the end of README.md',
            executor_model: 'openai/gpt-6-luna',
            engine: 'codex',
            cli_effort: 'medium',
            input: ['README.md'],
            output: ['README.md'],
            acceptance_criteria: ['README.md contains the line: Gate ran.'],
            depends_on: [],
            status: 'pending',
            retry_count: 0,
          },
          {
            id: 'gate-dependent-task',
            description: 'Inspect the first task result.',
            executor_model: 'openai/gpt-6-luna',
            engine: 'codex',
            cli_effort: 'medium',
            input: ['README.md'],
            output: ['README.md'],
            acceptance_criteria: ['The first task is complete.'],
            depends_on: ['gate-first-task'],
            status: 'pending',
            retry_count: 0,
          },
          {
            id: 'gate-failed-task',
            description: 'Create NOTES.md containing the line: Retry ran.',
            executor_model: 'openai/gpt-6-luna',
            engine: 'codex',
            cli_effort: 'medium',
            input: [],
            output: ['NOTES.md'],
            acceptance_criteria: ['NOTES.md contains the line: Retry ran.'],
            depends_on: [],
            status: 'failed',
            retry_count: 0,
          },
        ],
      },
      { lineWidth: 120 },
    ),
  )
  run('git', ['add', '-A'], projectRoot)
  run(
    'git',
    [
      '-c',
      'user.name=ui-gate',
      '-c',
      'user.email=ui-gate@example.invalid',
      'commit',
      '-qm',
      'task fixture',
    ],
    projectRoot,
  )

  const projects = await api('/api/projects')
  const project = (projects.data ?? []).find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })

  const executorRole = yamlParse(readFileSync(join(projectRoot, 'orchestos.config.yaml'), 'utf8'))
    .roles.executor
  const created = await api('/api/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-orchestos-project-id': project.id },
    body: JSON.stringify({
      id: 'gate-role-task',
      description: 'Task created without its own model.',
      output: ['ROLE.md'],
    }),
  })
  if (!created.ok) throw new Error(`task create failed: ${created.status}`)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step(
    'temporary project visible',
    await visible(projectButton),
    'project visible in sidebar',
  )
  if (await projectButton.isVisible()) await projectButton.click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await step(
    'project settings visible',
    await visible(page.getByRole('heading', { name: basename(projectRoot), exact: true })),
    'project settings heading visible',
  )

  const taskIds = ['gate-first-task', 'gate-dependent-task', 'gate-failed-task']
  for (const taskId of taskIds) {
    await step(
      `task id ${taskId} visible`,
      await visible(page.getByText(taskId, { exact: true })),
      'real tasks.yaml id',
    )
  }
  await page.locator('[data-task-row][data-task-id="gate-first-task"]').click()
  await step(
    'real output visible',
    await visible(page.locator('[data-task-detail]').getByText('[README.md]', { exact: true })),
    'output boundary from tasks.yaml, in the task detail',
  )
  await page.keyboard.press('Escape')
  await step(
    'mock task absent',
    (await page.getByText('t1_sandbox_worktree', { exact: true }).count()) === 0,
    'no initialMockTasks id rendered',
  )
  const roleLabel = `${executorRole.agent} · ${executorRole.model}`
  await step(
    'task created without model shows the Executor role agent and model',
    await visible(
      page
        .locator('[data-task-row]', { has: page.getByText('gate-role-task', { exact: true }) })
        .getByText(roleLabel, { exact: true }),
    ),
    `expected=${roleLabel} from fixture orchestos.config.yaml`,
  )
  const roleTaskYaml = readFileSync(join(projectRoot, 'tasks.yaml'), 'utf8')
  await step(
    'created task yaml has no hardcoded provider executor',
    !/^\s*executor:\s*(openrouter|anthropic|openai)\b/m.test(
      roleTaskYaml.slice(roleTaskYaml.indexOf('gate-role-task')),
    ),
    'tasks.yaml entry for gate-role-task has no executor: openrouter|anthropic|openai',
  )
  const failedTaskButton = page.getByRole('button', { name: 'Run gate-failed-task', exact: true })
  await step(
    'failed task offers its own Run button',
    (await failedTaskButton.isVisible()) && (await failedTaskButton.isEnabled()),
    'visible=true enabled=true',
  )
  await step(
    'task with unfinished dependency has no Run button',
    (await page.getByRole('button', { name: 'Run gate-dependent-task', exact: true }).count()) ===
      0,
    'button count=0',
  )

  const runButton = page.getByRole('button', { name: 'Run Next Task', exact: true })
  await step(
    'Run Next Task enabled',
    await runButton.isEnabled(),
    'first task has no unfinished dependency',
  )
  const firstBefore = (await tasksFor(api, project.id)).find(
    (task) => task.id === 'gate-first-task',
  )
  if (await runButton.isEnabled()) await runButton.click()
  await step(
    'Run Next Task disabled while running',
    await runButton.isDisabled(),
    'running task prevents a second run',
  )
  const firstPending = (await tasksFor(api, project.id)).find(
    (task) => task.id === 'gate-first-task',
  )
  await step(
    'first task was posted',
    Boolean(firstPending),
    `status=${firstPending?.status ?? 'missing'}`,
  )
  await step(
    'dependent task remains pending before first finishes',
    (await tasksFor(api, project.id)).find((task) => task.id === 'gate-dependent-task')?.status ===
      'pending',
    'dependency prevents the second task from running',
  )
  let finished = await waitForTaskFinished(api, project.id, 'gate-first-task', firstBefore)
  let recordedRetryCount = firstBefore?.retryCount ?? 0
  while (
    finished &&
    (finished.retryCount > recordedRetryCount ||
      ((finished.status === 'failed' || finished.status === 'failed_permanent') && finished.runId))
  ) {
    await recordRetry(api, project.id, finished, note)
    recordedRetryCount = finished.retryCount
    if (finished.status !== 'pending' || finished.retryCount >= 3) break
    const retryBefore = finished
    if (await runButton.isEnabled()) await runButton.click()
    else break
    finished = await waitForTaskFinished(api, project.id, 'gate-first-task', retryBefore)
  }
  const visibleStatus = finished?.status ?? 'missing'
  const statusLabel =
    visibleStatus === 'running'
      ? 'RUNNING'
      : visibleStatus === 'done'
        ? 'DONE'
        : visibleStatus === 'failed' || visibleStatus === 'failed_permanent'
          ? 'FAIL'
          : 'PENDING'
  await step(
    'final status badge is visible without reload',
    await visible(
      page
        .locator('[data-task-row]', { has: page.getByText('gate-first-task', { exact: true }) })
        .getByText(statusLabel, { exact: true }),
    ),
    `StatusBadge text=${statusLabel}`,
  )
  if (visibleStatus === 'pending' && finished?.retryReason) {
    await page.locator('[data-task-row][data-task-id="gate-first-task"]').click()
    await step(
      'retry reason is visible in the task tab',
      await visible(
        page.locator('[data-task-detail]').getByText(finished.retryReason, { exact: false }),
      ),
      `retryReason=${finished.retryReason}`,
    )
    await page.keyboard.press('Escape')
  }
  await step(
    'badge leaves Pending without page reload',
    visibleStatus !== 'pending' && visibleStatus !== 'running',
    `status=${visibleStatus}`,
  )
  await step(
    'UI and API agree on final task state',
    (await tasksFor(api, project.id)).find((task) => task.id === 'gate-first-task')?.status ===
      visibleStatus,
    `status=${visibleStatus}`,
  )
  const firstCommit = await waitForTasksYamlCommit(projectRoot, 'gate-first-task')
  await step(
    'first task final state is committed in tasks.yaml',
    !/(^|\s)tasks\.yaml$/m.test(firstCommit.status) &&
      firstCommit.subject.startsWith('chore(tasks): gate-first-task '),
    `porcelain=${JSON.stringify(firstCommit.status)} subject=${firstCommit.subject}`,
  )
  const failedBefore = (await tasksFor(api, project.id)).find(
    (task) => task.id === 'gate-failed-task',
  )
  if (await failedTaskButton.isEnabled()) await failedTaskButton.click()
  const failedStartDeadline = Date.now() + 20_000
  let failedAfter = failedBefore
  while (Date.now() <= failedStartDeadline) {
    failedAfter = (await tasksFor(api, project.id)).find((task) => task.id === 'gate-failed-task')
    if (failedAfter && failedAfter.status !== 'failed') break
    await delay(500)
  }
  const relaunched = await waitForTaskFinished(api, project.id, 'gate-failed-task', failedBefore)
  await step(
    'failed task relaunched by id ran',
    Boolean(relaunched?.runId && relaunched.runId !== failedBefore?.runId),
    `runId=${relaunched?.runId ?? 'missing'} previous=${failedBefore?.runId ?? 'missing'}`,
  )
  await step(
    'relaunched task reaches done',
    relaunched?.status === 'done',
    `status=${relaunched?.status ?? 'missing'}`,
  )
  const relaunchedCommit = await waitForTasksYamlCommit(projectRoot, 'gate-failed-task')
  const relaunchedCommitOk =
    !/(^|\s)tasks\.yaml$/m.test(relaunchedCommit.status) &&
    relaunchedCommit.subject.startsWith('chore(tasks): gate-failed-task ')
  let relaunchedCommitDetail = `porcelain=${JSON.stringify(relaunchedCommit.status)} subject=${relaunchedCommit.subject}`
  if (!relaunchedCommitOk) {
    const taskStatus = (await tasksFor(api, project.id)).find(
      (task) => task.id === 'gate-failed-task',
    )
    const logLines = readFileSync(join(runDir, 'dashboard.log'), 'utf8')
      .split(/\r?\n/)
      .filter(
        (line) =>
          line.includes('[tasks-yaml]') ||
          line.includes('[task]') ||
          line.includes('gate-failed-task'),
      )
      .slice(-40)
    relaunchedCommitDetail = JSON.stringify({
      porcelain: gitOut(['status', '--porcelain'], projectRoot),
      subject: gitOut(['log', '-1', '--format=%s'], projectRoot),
      log: gitOut(['log', '-5', '--format=%h %s'], projectRoot),
      taskStatus: taskStatus
        ? { status: taskStatus.status, retryCount: taskStatus.retryCount }
        : null,
      dashboardLog: logLines,
    })
  }
  await step(
    'relaunched task final state is committed in tasks.yaml',
    relaunchedCommitOk,
    relaunchedCommitDetail,
  )
  const dependentAfterRelaunch = (await tasksFor(api, project.id)).find(
    (task) => task.id === 'gate-dependent-task',
  )
  await step(
    'relaunch did not start the dependent task',
    dependentAfterRelaunch?.status === 'pending' && !dependentAfterRelaunch.runId,
    `status=${dependentAfterRelaunch?.status ?? 'missing'} runId=${dependentAfterRelaunch?.runId ?? 'missing'}`,
  )
  const rowHeights = await page.locator('[data-task-row]').evaluateAll((rows) =>
    rows.map((row) => {
      const style = getComputedStyle(row)
      return {
        height: row.getBoundingClientRect().height,
        borderTop: style.borderTopWidth,
        shadow: style.boxShadow,
      }
    }),
  )
  await step(
    'task rows flat',
    rowHeights.length > 0 &&
      rowHeights.every(
        (row) => Math.abs(row.height - 40) <= 1 && row.borderTop === '0px' && row.shadow === 'none',
      ),
    JSON.stringify(rowHeights),
  )
  const listHeader = page.locator('[data-tasks-tab] [data-list-header]')
  const headerFacts = await listHeader.evaluate((header) => {
    const row = document.querySelector('[data-tasks-tab] [data-task-row]')
    const columns = ['id', 'title', 'meta', 'status']
    const headerCells = Object.fromEntries(
      columns.map((column) => {
        const rect = header.querySelector(`[data-col="${column}"]`)?.getBoundingClientRect()
        return [column, rect ? { left: rect.left, right: rect.right } : null]
      }),
    )
    const rowCells = Object.fromEntries(
      columns.map((column) => {
        const rect = row?.querySelector(`[data-col="${column}"]`)?.getBoundingClientRect()
        return [column, rect ? { left: rect.left, right: rect.right } : null]
      }),
    )
    return { text: header.textContent?.replace(/\s+/g, ' ').trim(), headerCells, rowCells }
  })
  const headerAligned =
    ['ID', 'Task', 'Agent', 'Status'].every((label) => headerFacts.text?.includes(label)) &&
    ['id', 'title', 'meta'].every((column) => {
      const head = headerFacts.headerCells[column]
      const row = headerFacts.rowCells[column]
      return head && row && Math.abs(head.left - row.left) <= 1
    }) &&
    headerFacts.headerCells.status &&
    headerFacts.rowCells.status &&
    Math.abs(headerFacts.headerCells.status.right - headerFacts.rowCells.status.right) <= 1
  await step('task list header aligned', Boolean(headerAligned), JSON.stringify(headerFacts))
  const paletteHits = await page.locator('[data-tasks-tab]').evaluate((root, palette) => {
    const re = new RegExp(palette)
    return [root, ...root.querySelectorAll('*')]
      .flatMap((el) => String(el.getAttribute('class') ?? '').split(/\s+/))
      .filter((cls) => re.test(cls))
      .slice(0, 5)
  }, '\\b(?:emerald|zinc|rose|sky|amber|teal|purple|indigo|blue|red|green|slate|gray|violet|pink|cyan|orange|yellow)-\\d+\\b')
  await step(
    'no palette in tasks tab',
    paletteHits.length === 0,
    paletteHits.join(' || ') || 'ninguna',
  )
  const lastRow = page.locator('[data-task-row][data-task-id="gate-dependent-task"]')
  await lastRow.click()
  await step(
    'task detail opens',
    await visible(
      page.locator('[data-task-detail]').getByText('gate-dependent-task', { exact: true }),
    ),
    'detail shows the task id',
  )
  await page.keyboard.press('Escape')
  await step(
    'task detail closes with Esc',
    (await page.locator('[data-task-detail]').count()) === 0,
    'detail count=0',
  )
  const dependentDescription = (await tasksFor(api, project.id)).find(
    (task) => task.id === 'gate-dependent-task',
  )?.description
  const firstLine =
    String(dependentDescription ?? '')
      .split('\n')[0]
      ?.slice(0, 80) ?? ''
  const rowText = await lastRow.innerText()
  await step(
    'no duplicated description',
    firstLine.length > 0 && rowText.split(firstLine).length - 1 === 1,
    `occurrences=${rowText.split(firstLine).length - 1} line=${JSON.stringify(firstLine)}`,
  )
  await shot('tasks-real-data')
}
