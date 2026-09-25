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

async function runsFor(api, projectId) {
  const response = await api('/api/runs', {
    headers: { 'x-orchestos-project-id': projectId },
  })
  return Array.isArray(response.data) ? response.data : []
}

async function waitForTaskChange(api, projectId, taskId, previousRetryCount, previousRunId) {
  const startedAt = Date.now()
  const deadline = startedAt + 10 * 60_000
  let task
  while (Date.now() <= deadline) {
    const response = await api('/api/tasks', {
      headers: { 'x-orchestos-project-id': projectId },
    })
    task = (response.data?.tasks ?? []).find((item) => item.id === taskId)
    if (
      task &&
      ((task.status !== 'pending' && task.status !== 'running') ||
        (task.status === 'pending' &&
          (task.retryCount !== previousRetryCount || task.runId !== previousRunId)))
    )
      return task
    if (
      task?.status === 'pending' &&
      Date.now() - startedAt >= 20_000 &&
      task.retryCount === previousRetryCount &&
      task.runId === previousRunId
    )
      return task
    await delay(2_000)
  }
  return task
}

async function waitForEnabled(locator, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await locator.isEnabled()) return true
    await delay(100)
  }
  return locator.isEnabled()
}

export default async function runsGraph({ page, api, step, shot, visible, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-13-2e-'))
  writeFileSync(join(projectRoot, 'README.md'), '# UI.13.2e\n')
  writeFileSync(join(projectRoot, 'src.ts'), 'export const gate = true\n')
  writeFileSync(join(projectRoot, '.gitignore'), '.orchestos/\n')
  run('git', ['init', '-q'], projectRoot)
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
        project: 'ui-13-2e-gate',
        tasks: [
          {
            id: 'gate-runs-task',
            description: 'Append the line "Runs graph gate." at the end of README.md',
            executor_model: 'openai/gpt-6-luna',
            engine: 'codex',
            cli_effort: 'medium',
            input: ['README.md'],
            output: ['README.md'],
            acceptance_criteria: ['README.md contains the line: Runs graph gate.'],
            depends_on: [],
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

  const projectList = await api('/api/projects')
  const project = (projectList.data ?? []).find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true })
  })

  const globalBefore = await api('/api/runs')
  const otherRunIds = new Set((globalBefore.data ?? []).map((run) => run.id))

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step(
    'temporary project visible',
    await visible(projectButton),
    'project visible in sidebar',
  )
  if (!(await projectButton.isVisible())) return
  await projectButton.click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await step(
    'project settings visible',
    await visible(page.getByRole('heading', { name: basename(projectRoot), exact: true })),
    'project settings heading visible',
  )

  const graphBefore = await api('/api/project/graph', {
    headers: { 'x-orchestos-project-id': project.id },
  })
  await step(
    'graph count from API',
    Number.isInteger(graphBefore.data?.files),
    `files=${graphBefore.data?.files}`,
  )

  const runButton = page.getByRole('button', { name: 'Run Next Task', exact: true })
  const taskBecameRunnable = await waitForEnabled(runButton)
  await step('Run Next Task enabled', taskBecameRunnable, 'task is runnable')
  if (!taskBecameRunnable) return
  let task = (
    await api('/api/tasks', { headers: { 'x-orchestos-project-id': project.id } })
  ).data?.tasks?.find((item) => item.id === 'gate-runs-task')
  for (let clickCount = 0; task && task.retryCount < 3 && clickCount < 3; clickCount++) {
    const retryCount = task.retryCount
    const runId = task.runId
    if (!(await runButton.isEnabled())) {
      const enabled = await waitForEnabled(runButton)
      if (!enabled) break
    }
    await runButton.click()
    task = await waitForTaskChange(api, project.id, 'gate-runs-task', retryCount, runId)
    if (
      task &&
      (task.retryCount > retryCount ||
        task.status === 'failed' ||
        task.status === 'failed_permanent')
    ) {
      const listedRuns = await api('/api/runs', {
        headers: { 'x-orchestos-project-id': project.id },
      })
      const latestRun = (listedRuns.data ?? []).find((run) => run.taskId === 'gate-runs-task')
      const detail = latestRun ? await api(`/api/runs/${encodeURIComponent(latestRun.id)}`) : null
      const run = detail?.data ?? detail ?? {}
      const diagnostic = {
        attempt: task.retryCount ?? retryCount + 1,
        qa_verdict: run.qaVerdict ?? null,
        qa_reason: run.qaReason ?? null,
        qa_model: run.qaModel ?? null,
        file_diffs: run.fileDiffs ?? [],
      }
      await step(`failed attempt ${task.retryCount} QA detail`, true, JSON.stringify(diagnostic))
    }
    if (task?.status === 'pending' && task.retryCount > retryCount && task.retryCount < 3) continue
    break
  }
  await step('task finished', task?.status === 'done', `status=${task?.status ?? 'missing'}`)

  const projectRuns = await runsFor(api, project.id)
  await step(
    'project run exists',
    projectRuns.some((run) => run.taskId === 'gate-runs-task'),
    'run linked to task',
  )
  await step(
    'project runs are scoped',
    projectRuns.every((run) => !otherRunIds.has(run.id) || run.taskId === 'gate-runs-task'),
    `runs=${projectRuns.length}`,
  )

  await page.getByRole('button', { name: 'Runs', exact: true }).click()
  const runRow = page.locator('tr').filter({ hasText: 'gate-runs-task' }).first()
  await step('real run visible', await visible(runRow), 'task run appears in Runs')
  if (await runRow.isVisible()) await runRow.click()
  await step(
    'contract output is real',
    await visible(page.getByText('README.md', { exact: true })),
    'README.md output',
  )
  await page.getByRole('button', { name: 'QA Assertions', exact: true }).click()
  await step(
    'mock QA copy absent',
    (await page.getByText('Vitest automated test suite', { exact: false }).count()) === 0,
    'no hardcoded QA assertion',
  )
  await page.getByRole('button', { name: 'Cost ($)', exact: true }).click()
  await step(
    'real run status visible',
    await visible(page.getByText('done', { exact: true })),
    'status from run',
  )

  await page.getByRole('button', { name: 'Back to Runs', exact: true }).click()
  await page.getByRole('button', { name: 'Graph', exact: true }).click()
  await page.getByRole('button', { name: /^Code Graph/ }).click()
  await step(
    'graph view visible',
    await visible(page.getByText('Dependency Topology & Code Graph', { exact: true })),
    'graph heading',
  )
  await step(
    'mock graph copy absent',
    (await page.getByText('TypeScript (82%)', { exact: false }).count()) === 0,
    'no hardcoded language split',
  )
  await step(
    'graph count is real before rebuild',
    (await visible(page.getByText(`${graphBefore.data.files} source units`, { exact: true }))) &&
      (await page.getByText('48 source units', { exact: true }).count()) === 0,
    `files=${graphBefore.data?.files}, not the sample 48`,
  )
  writeFileSync(join(projectRoot, 'extra.ts'), 'export const extra = 1\n')
  const rebuild = page.getByRole('button', { name: 'Rebuild Code Graph', exact: true })
  if (await rebuild.isVisible()) await rebuild.click()
  await step(
    'graph rebuild completes',
    await visible(page.getByText(`${graphBefore.data.files + 1} source units`, { exact: true })),
    'indexed source count changed',
  )
  await shot('runs-graph-real-data')
  const projectsAfter = await api('/api/projects')
  const sameBasename = (projectsAfter.data ?? []).filter(
    (item) => basename(item.path) === basename(projectRoot),
  )
  await step(
    'no duplicate project',
    sameBasename.length === 1,
    `basename=${basename(projectRoot)}, matches=${sameBasename.length}`,
  )
}
