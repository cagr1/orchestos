import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { stringify as yamlStringify } from 'yaml'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

export default async function modelRouting({ page, api, step, shot, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-mr-1-c-'))
  writeFileSync(join(projectRoot, 'README.md'), '# Model routing gate\n')
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
    yamlStringify({
      version: 1,
      project: 'model-routing-gate',
      tasks: [
        {
          id: 'gate-model-routing',
          description: 'Append the line "Model routing passed." to README.md',
          input: ['README.md'],
          output: ['README.md'],
          acceptance_criteria: ['README.md contains the line: Model routing passed.'],
          status: 'pending',
        },
      ],
    }),
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

  const projectHeaders = { 'x-orchestos-project-id': project.id }
  const saveConfigAndWait = async () => {
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().endsWith('/api/config') && res.request().method() === 'PUT',
      ),
      page.getByRole('button', { name: 'Save', exact: true }).click(),
    ])
    const body = await response.text()
    if (!response.ok()) {
      throw new Error(`Save config failed: HTTP ${response.status()} ${body}`)
    }
    return { status: response.status(), body }
  }
  const reopenModelRouting = async () => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await projectButton.click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: 'Model routing', exact: true }).click()
    await page.getByText('Model routing config').waitFor()
    await page.getByText('Loading live settings…', { exact: true }).waitFor({ state: 'hidden' })
  }

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await projectButton.waitFor({ state: 'visible' })
  await projectButton.click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Model routing', exact: true }).click()
  const cards = page.locator('.rounded-card.border.border-app.bg-app-surface.space-y-2.relative')
  await step('4 role cards are shown', (await cards.count()) === 4)
  await step(
    'all role cards start unassigned',
    (await page.getByText('Unassigned', { exact: true }).count()) === 4,
  )
  await shot('roles-unassigned')
  await step(
    'legacy QA judge and model are absent',
    (await page.getByText('QA judge', { exact: true }).count()) === 0 &&
      (await page.getByText('Claude 3.7 Sonnet', { exact: true }).count()) === 0,
  )

  const catalog = (await api('/api/models/catalog')).data.agents
  const codex = catalog.find((agent) => agent.id === 'codex')
  if (!codex?.installed || !codex.models.some((model) => model.id === 'gpt-6-luna'))
    throw new Error('Codex gpt-6-luna is not available in the model catalog')
  const roles = ['Orchestrator', 'Executor', 'Reviewer', 'Auxiliary']
  for (const [index, role] of roles.entries()) {
    const card = cards.nth(index)
    await card.getByLabel(`${role} agent`).click()
    await page.getByRole('button', { name: 'codex', exact: true }).last().click()
    await card.getByRole('button', { name: 'Select model' }).click()
    await card.getByPlaceholder('Filter models...').fill('gpt-6-luna')
    await card.getByRole('button', { name: /gpt-6-luna/ }).click()
    await card.getByLabel(`${role} effort`).click()
    await page.getByRole('button', { name: 'medium', exact: true }).last().click()
  }
  await saveConfigAndWait()
  await reopenModelRouting()
  const config = (await api('/api/config', { headers: projectHeaders })).data
  const roleAssignmentsPersisted = ['orchestrator', 'executor', 'reviewer', 'auxiliary'].every(
    (role) =>
      config.roleAssignments[role]?.agent === 'codex' &&
      config.roleAssignments[role]?.model === 'gpt-6-luna' &&
      config.roleAssignments[role]?.effort === 'medium',
  )
  await step(
    'role assignments persist and reviewer warning appears',
    roleAssignmentsPersisted &&
      config.roleWarnings.includes('reviewer-same-as-executor') &&
      (await cards.count()) === 4 &&
      (
        await Promise.all(
          roles.map(async (role, index) => {
            const card = cards.nth(index)
            return (
              (await card.getByLabel(`${role} agent`).innerText()) === 'Codex' &&
              (await card.getByRole('button', { name: 'GPT-6-Luna', exact: true }).count()) === 1 &&
              (await card.getByLabel(`${role} effort`).innerText()) === 'medium'
            )
          }),
        )
      ).every(Boolean) &&
      (await page
        .getByText('Same agent and model as Executor: errors may correlate.', { exact: true })
        .isVisible()) &&
      !(await page.getByText('Source: defaults', { exact: true }).count()),
    JSON.stringify({
      roleAssignments: config.roleAssignments,
      roleWarnings: config.roleWarnings,
      ui: await cards.allInnerTexts(),
      source: await page.locator('text=Source:').allInnerTexts(),
    }),
  )
  await shot('roles-assigned')

  await page.getByRole('button', { name: /Task rules/ }).click()
  await page.getByRole('button', { name: 'Add rule' }).click()
  await page.getByLabel('rule agent').click()
  await page.getByRole('button', { name: 'Codex', exact: true }).last().click()
  await page.getByLabel('output globs').fill('docs/**')
  await saveConfigAndWait()
  await reopenModelRouting()
  await page.getByRole('button', { name: /Task rules/ }).click()
  let savedRules = (await api('/api/config', { headers: projectHeaders })).data.taskAgentRules
  await step(
    'task rule persists after reload',
    savedRules.length === 1 &&
      savedRules[0].match.output.includes('docs/**') &&
      savedRules[0].agent === 'codex' &&
      (await page.getByRole('button', { name: 'Task rules (1)', exact: true }).count()) === 1 &&
      (await page.getByLabel('output globs').inputValue()) === 'docs/**',
    JSON.stringify({
      rules: savedRules,
      ui: await page.locator('text=Task rules').allInnerTexts(),
      output: await page.getByLabel('output globs').inputValue(),
    }),
  )
  await shot('task-rules')
  await page.getByRole('button', { name: 'Delete rule' }).click()
  await saveConfigAndWait()
  await reopenModelRouting()
  savedRules = (await api('/api/config', { headers: projectHeaders })).data.taskAgentRules
  await step(
    'deleting the rule persists an empty list',
    savedRules.length === 0,
    JSON.stringify(savedRules),
  )

  // The gate records task execution through the project Tasks view.
  if (project?.id) {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await projectButton.click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const finalConfig = (await api('/api/config', { headers: projectHeaders })).data
    await step(
      'project config remains selected before running task',
      finalConfig.roleAssignments.executor?.model === 'gpt-6-luna',
      JSON.stringify({ roleAssignments: finalConfig.roleAssignments }),
    )
    run('git', ['add', 'orchestos.config.yaml'], projectRoot)
    run(
      'git',
      [
        '-c',
        'user.name=ui-gate',
        '-c',
        'user.email=ui-gate@example.invalid',
        'commit',
        '-qm',
        'save model routing config',
      ],
      projectRoot,
    )
    const runNextTask = page.getByRole('button', { name: 'Run Next Task', exact: true })
    await runNextTask.click()
    const deadline = Date.now() + 10 * 60_000
    let runRecord
    let listedRunId
    while (Date.now() < deadline) {
      const runs = await api('/api/runs', { headers: { 'x-orchestos-project-id': project.id } })
      const recent = (runs.data ?? []).find((item) => item.taskId === 'gate-model-routing')
      if (recent) {
        listedRunId = recent.id
        const detail = await api(`/api/runs/${encodeURIComponent(recent.id)}`)
        runRecord = detail.data ?? detail
        if (runRecord.status !== 'running' && runRecord.status !== 'queued') break
      }
      await delay(2000)
    }
    await step(
      'run record stores the executor and QA models chosen in the UI',
      runRecord?.id === listedRunId &&
        runRecord?.model === 'gpt-6-luna' &&
        runRecord?.qaModel === 'gpt-6-luna',
      JSON.stringify({ id: runRecord?.id, model: runRecord?.model, qa_model: runRecord?.qaModel }),
    )
  } else {
    await step('temporary task project is registered', false, JSON.stringify(projects.data))
  }
}
