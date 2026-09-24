import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { stringify as yamlStringify } from 'yaml'

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

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}
function seedDb(projectId, databasePath) {
  const code = `
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)})
    const now = new Date().toISOString()
    const a = crypto.randomUUID(), b = crypto.randomUUID(), conflict = crypto.randomUUID()
    db.run('INSERT INTO memory_entries (id, project_id, topic_key, scope, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [a, ${JSON.stringify(projectId)}, 'gate-memory', 'project', 'Original gate memory', now, now])
    db.run('INSERT INTO memory_entries (id, project_id, topic_key, scope, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [b, ${JSON.stringify(projectId)}, 'gate-memory-observation', 'project', 'Conflicting gate observation', now, now])
    db.run('INSERT INTO memory_conflicts (id, entry_a_id, entry_b_id, relation, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)', [conflict, a, b, 'contradiction', 'high', now])
    console.log(JSON.stringify({ a, b, conflict }))
    db.close()
  `
  return JSON.parse(execFileSync('bun', ['-e', code], { encoding: 'utf8' }))
}
function cleanupDb(projectId, instinctIds, databasePath) {
  const code = `
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)})
    db.run('DELETE FROM memory_conflicts WHERE entry_a_id IN (SELECT id FROM memory_entries WHERE project_id = ?) OR entry_b_id IN (SELECT id FROM memory_entries WHERE project_id = ?)', [${JSON.stringify(projectId)}, ${JSON.stringify(projectId)}])
    db.run('DELETE FROM memory_entries WHERE project_id = ?', [${JSON.stringify(projectId)}])
    for (const id of ${JSON.stringify(instinctIds)}.filter(Boolean)) db.run('DELETE FROM instincts WHERE id = ?', [id])
    const memory = db.query('SELECT COUNT(*) AS count FROM memory_entries WHERE project_id = ?').get(${JSON.stringify(projectId)}).count
    const conflicts = db.query('SELECT COUNT(*) AS count FROM memory_conflicts WHERE entry_a_id IN (SELECT id FROM memory_entries WHERE project_id = ?) OR entry_b_id IN (SELECT id FROM memory_entries WHERE project_id = ?)').get(${JSON.stringify(projectId)}, ${JSON.stringify(projectId)}).count
    const instincts = ${JSON.stringify(instinctIds)}.filter(Boolean).reduce((total, id) => total + db.query('SELECT COUNT(*) AS count FROM instincts WHERE id = ?').get(id).count, 0)
    console.log(JSON.stringify({ memory, conflicts, instincts }))
    db.close()
  `
  return JSON.parse(execFileSync('bun', ['-e', code], { encoding: 'utf8' }))
}

export default async function projectTabs({
  page,
  api,
  step,
  shot,
  visible,
  cleanup,
  consoleErrors,
  databasePath,
}) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-13-2f-'))
  writeFileSync(join(projectRoot, 'README.md'), '# UI.13.2f\n')
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
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'task', 'init'], projectRoot)
  writeFileSync(
    join(projectRoot, 'tasks.yaml'),
    yamlStringify(
      {
        version: 1,
        project: 'ui-13-2f-gate',
        tasks: [
          {
            id: 'gate-tabs-task',
            description: 'Append Gate ran. to README.md',
            executor_model: 'openai/gpt-6-luna',
            engine: 'codex',
            cli_effort: 'medium',
            input: ['README.md'],
            output: ['README.md'],
            acceptance_criteria: ['README.md ends with Gate ran.'],
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
  const projects = await api('/api/projects')
  const project = (projects.data ?? []).find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  const instinctTrigger = `gate trigger ${crypto.randomUUID()}`
  const instinct = await api('/api/instincts/propose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger: instinctTrigger, action: 'gate action' }),
  })
  const instinctId = instinct.data?.id ?? instinct.id
  let createdInstinctId = null
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    const residue = cleanupDb(project.id, [instinctId, createdInstinctId], databasePath)
    if (residue.memory !== 0 || residue.conflicts !== 0 || residue.instincts !== 0)
      throw new Error(`cleanup residue: ${JSON.stringify(residue)}`)
    if (existsSync(projectRoot)) rmSync(projectRoot, { recursive: true, force: true })
    if (existsSync(projectRoot)) throw new Error(`temporary project remains: ${projectRoot}`)
  })
  seedDb(project.id, databasePath)
  const specPath = join(projectRoot, '.orchestos', 'specs', 'gate-tabs-spec.md')
  mkdirSync(join(projectRoot, '.orchestos', 'specs'), { recursive: true })
  writeFileSync(
    specPath,
    '---\nid: gate-tabs-spec\nstatus: draft\ncreatedAt: 2026-09-23T00:00:00.000Z\nclarify: none\n---\n# Gate tabs spec\n\n## Contexto\nThe project tabs gate uses a real temporary project.\n\n## Descripción\nLoad and mutate project data.\n\n## Criterios de aceptación\n- [ ] WHEN the gate opens THEN every project tab reads real data\n',
  )
  const seededMemory = await api('/api/memory', {
    headers: { 'x-orchestos-project-id': project.id },
  })
  if (!(seededMemory.data ?? []).some((item) => item.content === 'Original gate memory'))
    throw new Error(
      `seeded memory not returned by API for project ${project.id}: ${JSON.stringify(seededMemory.data)}`,
    )
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
    'settings heading',
  )
  const tab = (name) => page.getByRole('button', { name, exact: true })
  const mockTitles = [
    'Cross-Agent Memory Conflict Detection & Resolution',
    'Git Worktree Isolation & Cleanup Specification',
    'TypeScript Strict Verifier',
    'User specifies API contract without type declarations',
    't1_sandbox_worktree',
  ]
  const noMockData = async () =>
    (
      await Promise.all(mockTitles.map((title) => page.getByText(title, { exact: true }).count()))
    ).every((count) => count === 0)

  await tab('Memory').click()
  await step(
    'real memory visible',
    await visible(page.getByText('Original gate memory', { exact: true })),
    'seeded DB memory',
  )
  await step('mock memory absent', await noMockData(), 'no mock data')
  await page
    .getByRole('button', { name: 'Open Synthesis & Resolution Wizard', exact: true })
    .click()
  await page.locator('textarea').fill('Authoritative gate memory')
  await page.getByRole('button', { name: 'Commit Authoritative Resolution', exact: true }).click()
  await delay(500)
  await step(
    'memory conflict resolved',
    (await api(`/api/memory/conflicts?project=${project.id}`)).data.length === 0,
    'API conflict closed',
  )
  await step(
    'authoritative memory persisted and visible',
    (await api('/api/memory', { headers: { 'x-orchestos-project-id': project.id } })).data.some(
      (item) => item.content === 'Authoritative gate memory',
    ) && (await visible(page.getByText('Authoritative gate memory', { exact: true }))),
    'content of entry A matches the resolved API value',
  )

  await tab('Specs').click()
  await step(
    'real spec visible',
    await visible(page.getByText('gate-tabs-spec', { exact: true })),
    'seeded markdown spec',
  )
  await step('mock specs absent', await noMockData(), 'no mock data')
  await page.getByRole('button', { name: 'Approve Gate', exact: true }).click()
  await delay(500)
  await step(
    'spec approved',
    (await api('/api/specs', { headers: { 'x-orchestos-project-id': project.id } })).data.find(
      (item) => item.id === 'gate-tabs-spec',
    )?.status === 'approved',
    'API status approved',
  )
  const lintBefore = (
    await api('/api/specs', { headers: { 'x-orchestos-project-id': project.id } })
  ).data.find((item) => item.id === 'gate-tabs-spec')
  const lintResponse = page.waitForResponse((response) =>
    response.url().includes('/api/specs/gate-tabs-spec/lint'),
  )
  await page.getByRole('button', { name: 'Lint WHEN/THEN', exact: true }).click()
  const lintResult = await (await lintResponse).json()
  await delay(500)
  const lintAfter = (
    await api('/api/specs', { headers: { 'x-orchestos-project-id': project.id } })
  ).data.find((item) => item.id === 'gate-tabs-spec')
  const lintLabel = `Lint: ${lintAfter?.lintStatus} (${lintAfter?.lintFindings})`
  await step(
    'spec lint updates API and row',
    Boolean(lintAfter) &&
      lintAfter.lintStatus === (lintResult.findings?.length ? 'fail' : 'pass') &&
      lintAfter.lintFindings === (lintResult.freeFormCount ?? 0) &&
      (await visible(page.getByText(lintLabel, { exact: true }))),
    `${lintLabel}; response findings=${lintResult.findings?.length ?? 0}; before=${lintBefore?.lintStatus}/${lintBefore?.lintFindings}`,
  )

  await tab('Skills').click()
  const skillsBefore =
    (await api('/api/skills', { headers: { 'x-orchestos-project-id': project.id } })).data ?? []
  const compile = page.getByRole('button', { name: 'Recompile', exact: true }).first()
  await step(
    'real skills listed',
    (await compile.count()) > 0 &&
      (await page.getByRole('button', { name: 'Recompile', exact: true }).count()) ===
        skillsBefore.length,
    `API skills=${skillsBefore.length}`,
  )
  if (await compile.count()) {
    const buildResponse = page.waitForResponse(
      (response) => response.url().includes('/api/skills/') && response.url().endsWith('/build'),
    )
    await compile.click()
    const build = await (await buildResponse).json()
    const buildTextVisible = build.ok
      ? await visible(page.getByText('Build succeeded:', { exact: false }))
      : await visible(page.getByText('Build failed:', { exact: false }))
    await step(
      'compile response visible',
      buildTextVisible,
      `${build.ok ? 'success' : 'error'} response rendered in the skill row`,
    )
  }
  await step('mock skills absent', await noMockData(), 'no mock data')

  await tab('Instincts').click()
  await step('mock instincts absent', await noMockData(), 'no mock data')
  await page.getByRole('button', { name: 'Review Proposals', exact: true }).click()
  await step(
    'instinct review visible',
    await visible(page.getByText(instinctTrigger, { exact: true })),
    'unverified instinct',
  )
  await page
    .getByRole('button', { name: /Approve \(\+0.10\)/ })
    .first()
    .click()
  await step(
    'instinct approved',
    (await api('/api/instincts')).data.find((item) => item.id === instinctId)?.verified === true,
    'API verified',
  )
  await page.getByRole('button', { name: 'Add Manual Instinct', exact: true }).click()
  await page.locator('input[placeholder*="LLM generates"]').fill('new gate trigger')
  await page.locator('textarea[placeholder*="Automatically import"]').fill('new gate action')
  await page.getByRole('button', { name: 'Register Instinct', exact: true }).click()
  await delay(700)
  const created = (await api('/api/instincts')).data.find(
    (item) => item.trigger === 'new gate trigger',
  )
  createdInstinctId = created?.id ?? null
  await page.getByRole('button', { name: /Active Instincts/ }).click()
  await step(
    'manual instinct added',
    await visible(page.getByText('new gate trigger', { exact: true })),
    'new API row',
  )

  await tab('Plan').click()
  await step('mock plan absent', await noMockData(), 'no mock data')
  await page.getByRole('button', { name: 'Table', exact: true }).click()
  const explainApi = await api('/api/tasks/gate-tabs-task/explain', {
    headers: { 'x-orchestos-project-id': project.id },
  })
  await page.getByRole('button', { name: 'Dry-Run', exact: true }).click()
  await step(
    'explain fields visible as readable UI',
    (await visible(page.getByText('Dry-Run Verification', { exact: true }))) &&
      (await visible(page.getByText('0 tokens spent', { exact: true }))) &&
      (await visible(
        page.getByText(`Task ID: ${explainApi.data?.id ?? 'gate-tabs-task'}`, { exact: true }),
      )),
    'GET /explain fields rendered inside the template block',
  )
  await step(
    'explain has no [object Object]',
    (await page.getByText('[object Object]', { exact: false }).count()) === 0,
    'opened Explain modal contains no stringified object values',
  )
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  const taskBefore = (await tasksFor(api, project.id)).find((item) => item.id === 'gate-tabs-task')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  const runButton = page.getByRole('button', { name: 'Run', exact: true })
  let finished = await waitForTaskFinished(api, project.id, 'gate-tabs-task', taskBefore)
  let recordedRetryCount = taskBefore?.retryCount ?? 0
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
    finished = await waitForTaskFinished(api, project.id, 'gate-tabs-task', retryBefore)
  }
  const finishedStatus = finished?.status ?? 'missing'
  await step(
    'task run finishes and badge changes without reload',
    Boolean(finished) &&
      finishedStatus !== 'pending' &&
      finishedStatus !== 'running' &&
      (await visible(
        page
          .locator('tr', { hasText: 'gate-tabs-task' })
          .getByText(finishedStatus, { exact: true }),
      )),
    `status=${finishedStatus}; retryCount/runId changed or terminal status observed`,
  )
  const taskCountBeforeChat = (await tasksFor(api, project.id)).length
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  await step(
    'Add task opens Chat',
    (await visible(page.locator('textarea[placeholder^="Message "]'))) &&
      !(await page
        .getByRole('button', { name: 'Plan', exact: true })
        .isVisible()
        .catch(() => false)) &&
      (await tasksFor(api, project.id)).length === taskCountBeforeChat,
    'Chat composer visible, Plan view inactive, task count unchanged',
  )
  await step('0 console errors', consoleErrors().length === 0, consoleErrors().join('; ') || 'none')
  await shot('project-tabs-real-data')
}
