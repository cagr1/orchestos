import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { stringify as yamlStringify } from 'yaml'
import { writeGateRoles } from '../lib.mjs'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
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

async function recordRetry(api, projectId, task, step) {
  const listedRuns = await api('/api/runs', {
    headers: { 'x-orchestos-project-id': projectId },
  })
  const latestRun = (listedRuns.data ?? []).find((run) => run.taskId === task.id)
  const response = latestRun ? await api(`/api/runs/${encodeURIComponent(latestRun.id)}`) : null
  const run = response?.data ?? response ?? {}
  const detail = {
    attempt: task.retryCount,
    qa_verdict: run.qaVerdict ?? null,
    qa_reason: run.qaReason ?? null,
    qa_model: run.qaModel ?? null,
    file_diffs: run.fileDiffs ?? [],
  }
  await step(`failed attempt ${task.retryCount} QA detail`, true, JSON.stringify(detail))
}

export default async function tasks({ page, api, step, shot, visible, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-13-2d-'))
  writeFileSync(join(projectRoot, 'README.md'), '# UI.13.2d\n')
  writeFileSync(join(projectRoot, '.gitignore'), '.orchestos/\n')
  run('git', ['init', '-q'], projectRoot)
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
    rmSync(projectRoot, { recursive: true, force: true })
  })

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

  const taskIds = ['gate-first-task', 'gate-dependent-task']
  for (const taskId of taskIds) {
    await step(
      `task id ${taskId} visible`,
      await visible(page.getByText(taskId, { exact: true })),
      'real tasks.yaml id',
    )
  }
  await step(
    'real output visible',
    await visible(page.getByText('[README.md]', { exact: true })),
    'output boundary from tasks.yaml',
  )
  await step(
    'mock task absent',
    (await page.getByText('t1_sandbox_worktree', { exact: true }).count()) === 0,
    'no initialMockTasks id rendered',
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
    await recordRetry(api, project.id, finished, step)
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
        .locator('div.rounded-card', { has: page.getByText('gate-first-task', { exact: true }) })
        .getByText(statusLabel, { exact: true }),
    ),
    `StatusBadge text=${statusLabel}`,
  )
  if (visibleStatus === 'pending' && finished?.retryReason) {
    await step(
      'retry reason is visible in the task tab',
      await visible(page.getByText(finished.retryReason, { exact: false })),
      `retryReason=${finished.retryReason}`,
    )
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
  await shot('tasks-real-data')
}
