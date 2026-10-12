import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { stringify as yamlStringify } from 'yaml'
import { writeGateRoles } from '../lib.mjs'

function run(command, args, cwd) {
  try {
    execFileSync(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
  } catch (error) {
    const detail = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim().slice(-600)
    throw new Error(
      `${command} ${args.join(' ')} failed (exit ${error.status ?? 'n/a'}): ${detail || 'sin salida'}`,
    )
  }
}

function rolloutFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return rolloutFiles(path)
    return entry.name.startsWith('rollout-') && entry.name.endsWith('.jsonl') ? [path] : []
  })
}

async function waitForTaskChange(api, projectId, taskId, previousRetryCount, previousRunId) {
  const deadline = Date.now() + 10 * 60_000
  let task
  while (Date.now() <= deadline) {
    const response = await api('/api/tasks', { headers: { 'x-orchestos-project-id': projectId } })
    task = (response.data?.tasks ?? []).find((item) => item.id === taskId)
    if (task && task.status !== 'pending' && task.status !== 'running') return task
    if (
      task?.status === 'pending' &&
      (task.retryCount !== previousRetryCount || task.runId !== previousRunId)
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

async function taskAndRun(api, projectId, taskId) {
  const taskResponse = await api('/api/tasks', { headers: { 'x-orchestos-project-id': projectId } })
  const task = (taskResponse.data?.tasks ?? []).find((item) => item.id === taskId)
  const listed = await api('/api/runs', { headers: { 'x-orchestos-project-id': projectId } })
  const summary = (listed.data ?? []).find((item) => item.taskId === taskId)
  const detail = summary
    ? await api(`/api/runs/${encodeURIComponent(summary.id)}`, {
        headers: { 'x-orchestos-project-id': projectId },
      })
    : null
  return { task, run: detail?.data ?? detail ?? null }
}

export default async function qaNegative({ page, api, step, shot, visible, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-r83-'))
  writeFileSync(join(projectRoot, 'README.md'), '# R.8.3 QA negative\n')
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
        project: 'r83-qa-negative',
        tasks: [
          {
            id: 'gate-qa-ok',
            description: 'Create the file ok.txt containing exactly one line: VERDE',
            executor_model: 'openai/gpt-6-luna',
            engine: 'codex',
            cli_effort: 'medium',
            input: [],
            output: ['ok.txt'],
            checks: [{ cmd: 'grep -qx VERDE ok.txt' }],
            acceptance_criteria: ['ok.txt contains the line: VERDE'],
            depends_on: [],
            status: 'pending',
            retry_count: 0,
          },
          {
            id: 'gate-qa-bad',
            description: 'Create the file nota.txt containing exactly one line: ROJO',
            executor_model: 'openai/gpt-6-luna',
            engine: 'codex',
            cli_effort: 'medium',
            input: [],
            output: ['nota.txt'],
            checks: [{ cmd: 'test -f nota.txt' }],
            acceptance_criteria: ['nota.txt contains the line: AZUL'],
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
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })

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

  const runButton = page.getByRole('button', { name: 'Run Next Task', exact: true })
  const enabled = await waitForEnabled(runButton)
  await step('Run Next Task enabled', enabled, 'task is runnable')
  if (!enabled) return

  let prior = await taskAndRun(api, project.id, 'gate-qa-ok')
  await runButton.click()
  await waitForTaskChange(
    api,
    project.id,
    'gate-qa-ok',
    prior.task?.retryCount ?? 0,
    prior.task?.runId ?? null,
  )
  const control = await taskAndRun(api, project.id, 'gate-qa-ok')
  const controlCriteria = control.run?.qaCriteria ?? []
  const controlChecks = control.run?.checks ?? []
  await step(
    'control task passes QA',
    control.task?.status === 'done' && control.run?.qaVerdict === 'pass',
    JSON.stringify({ status: control.task?.status, qaVerdict: control.run?.qaVerdict }),
  )
  await step(
    'control check executed',
    controlChecks.some((c) => c.cmd === 'grep -qx VERDE ok.txt' && c.exitCode === 0),
    JSON.stringify(controlChecks),
  )
  await step(
    'control criterion passed with literal evidence',
    controlCriteria.length === 1 &&
      controlCriteria[0]?.pass === true &&
      controlCriteria[0]?.evidence?.file === 'ok.txt' &&
      controlCriteria[0]?.evidence?.excerpt?.includes('VERDE'),
    JSON.stringify(controlCriteria),
  )
  const okPath = join(projectRoot, 'ok.txt')
  await step(
    'control output on disk',
    existsSync(okPath) && readFileSync(okPath, 'utf8').trim() === 'VERDE',
    JSON.stringify({
      exists: existsSync(okPath),
      content: existsSync(okPath) ? readFileSync(okPath, 'utf8').trim() : null,
    }),
  )
  if (control.task?.status !== 'done' || control.run?.qaVerdict !== 'pass') return

  // R.8.5.1 — la tarea de Codex corre con el CODEX_HOME aislado del proyecto.
  const agentHome = join(projectRoot, '.orchestos', 'agent-home', 'codex')
  const allRollouts = rolloutFiles(join(agentHome, 'sessions'))
  // Solo el rollout de la ejecución de gate-qa-ok: el contrato de salida de su prompt
  // (`buildCodexPrompt`) declara ok.txt; un rollout de chat o del revisor no lo lleva.
  const taskMarker = 'You may ONLY create or edit these files: ok.txt.'
  const rollouts = allRollouts.filter((path) => readFileSync(path, 'utf8').includes(taskMarker))
  await step(
    'task rollout written inside the project agent home',
    rollouts.length > 0,
    JSON.stringify({ agentHome, antes: allRollouts.length, despues: rollouts.length }),
  )
  const rolloutText = rollouts.map((path) => readFileSync(path, 'utf8')).join('\n')
  const hostAgents = join(homedir(), '.codex', 'AGENTS.md')
  const hostLine = existsSync(hostAgents)
    ? readFileSync(hostAgents, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 20)
    : undefined
  await step(
    'rollout contains the OrchestOS generated instructions',
    rolloutText.includes('OrchestOS isolated agent home'),
    JSON.stringify({
      rolloutBytes: rolloutText.length,
      hostAgents: hostLine === undefined ? 'absent' : 'checked',
    }),
  )
  if (hostLine !== undefined) {
    await step(
      'rollout does not contain the host AGENTS.md distinctive line',
      !rolloutText.includes(hostLine),
      `línea del host comprobada: ${JSON.stringify(hostLine.slice(0, 60))}`,
    )
  }

  prior = await taskAndRun(api, project.id, 'gate-qa-bad')
  await runButton.click()
  await waitForTaskChange(
    api,
    project.id,
    'gate-qa-bad',
    prior.task?.retryCount ?? 0,
    prior.task?.runId ?? null,
  )
  const rejected = await taskAndRun(api, project.id, 'gate-qa-bad')
  const badDiffs = rejected.run?.fileDiffs ?? []
  const diffText = badDiffs.map((d) => d.diff ?? '').join('\n')
  const wroteIncorrect = diffText.includes('+ROJO') && !diffText.includes('AZUL')
  await step(
    'executor wrote the incorrect output',
    wroteIncorrect,
    wroteIncorrect
      ? JSON.stringify(badDiffs)
      : `premisa no cumplida: el ejecutor no escribió ROJO; ${JSON.stringify(badDiffs)}`,
  )
  if (!wroteIncorrect) return
  const checks = rejected.run?.checks ?? []
  const criteria = rejected.run?.qaCriteria ?? []
  const diagnostic = JSON.stringify({
    qaVerdict: rejected.run?.qaVerdict,
    qaReason: rejected.run?.qaReason,
    qaModel: rejected.run?.qaModel,
    checks,
    qaCriteria: criteria,
  })
  await step(
    'QA rejects the incorrect output',
    rejected.run?.qaVerdict === 'fail' &&
      Boolean(rejected.run?.qaReason) &&
      Boolean(rejected.run?.qaModel),
    diagnostic,
  )
  await step(
    'check executed before QA',
    checks.some((c) => c.cmd === 'test -f nota.txt' && c.exitCode === 0),
    diagnostic,
  )
  await step(
    'failed criterion recorded',
    criteria.length === 1 &&
      criteria[0]?.text === 'nota.txt contains the line: AZUL' &&
      criteria[0]?.pass === false,
    diagnostic,
  )
  await step(
    'task returns to pending with retry',
    rejected.task?.status === 'pending' &&
      rejected.task?.retryCount === 1 &&
      rejected.run?.qaVerdict === 'fail',
    JSON.stringify({
      status: rejected.task?.status,
      retryCount: rejected.task?.retryCount,
      qaVerdict: rejected.run?.qaVerdict,
    }),
  )
  await step(
    'rejected output reverted',
    !existsSync(join(projectRoot, 'nota.txt')),
    JSON.stringify({ exists: existsSync(join(projectRoot, 'nota.txt')) }),
  )

  await page.getByRole('button', { name: 'Runs', exact: true }).click()
  let runRow = page.locator('tr').filter({ hasText: 'gate-qa-bad' }).first()
  await step('rejected run visible', await visible(runRow), 'gate-qa-bad appears in Runs')
  if (!(await runRow.isVisible())) return
  await runRow.click()
  await page.getByRole('button', { name: 'QA Assertions', exact: true }).click()
  await step(
    'check visible in QA tab',
    await visible(page.getByText('✓ test -f nota.txt (exit 0)', { exact: true })),
    '✓ test -f nota.txt (exit 0)',
  )
  await step(
    'failed criterion visible in QA tab',
    await visible(page.getByText(/^✗ nota\.txt contains the line: AZUL/)),
    '✗ nota.txt contains the line: AZUL',
  )
  await shot('qa-negative-rejected')
  await page.getByRole('button', { name: 'Back to Runs', exact: true }).click()
  runRow = page.locator('tr').filter({ hasText: 'gate-qa-ok' }).first()
  await step('control run visible', await visible(runRow), 'gate-qa-ok appears in Runs')
  if (!(await runRow.isVisible())) return
  await runRow.click()
  await page.getByRole('button', { name: 'QA Assertions', exact: true }).click()
  await step(
    'passed criterion visible with evidence',
    await visible(page.getByText(/^✓ ok\.txt contains the line: VERDE: ok\.txt: /)),
    '✓ ok.txt contains the line: VERDE with ok.txt evidence',
  )
}
