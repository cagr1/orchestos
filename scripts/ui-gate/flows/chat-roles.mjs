import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { writeGateRoles } from '../lib.mjs'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

function runJson(source) {
  return JSON.parse(execFileSync('bun', ['-e', source], { encoding: 'utf8' }))
}

export default async function chatRoles({ page, api, step, shot, visible, cleanup, databasePath }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-mr-1-d1-'))
  writeFileSync(join(projectRoot, 'README.md'), '# Chat roles\n')
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
  writeFileSync(
    join(projectRoot, 'tasks.yaml'),
    yamlStringify({ version: 1, project: basename(projectRoot), tasks: [] }),
  )
  writeGateRoles(projectRoot)
  const configPath = join(projectRoot, 'orchestos.config.yaml')
  const config = yamlParse(readFileSync(configPath, 'utf8'))
  delete config.roles.auxiliary
  writeFileSync(configPath, yamlStringify(config))

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
    await projectButton.innerText().catch(() => 'Temporary project button not found'),
  )
  await shot('temporary-project-visible')
  if (await projectButton.isVisible()) await projectButton.click()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const codexOption = dialog.getByRole('button', { name: /Codex/ }).first()
  await step(
    'Orchestrator Codex selected by default',
    await visible(codexOption),
    `Codex option visible: ${await codexOption.innerText()}`,
  )
  await shot('orchestrator-preselected')
  await dialog.getByRole('button', { name: 'Start Chat', exact: true }).click()

  const composer = page.locator('textarea').last()
  // A turn counts as sent only when POST /api/chat leaves; Enter while the previous
  // turn is still busy is ignored by the composer (the text stays), so retry until it
  // goes out and then wait for the composer to clear, which happens when the reply is
  // on screen.
  let lastTurnMs = null
  const sendTurn = async (text) => {
    const startedAt = Date.now()
    await composer.fill(text)
    const deadline = Date.now() + 180_000
    let sent = false
    while (!sent && Date.now() < deadline) {
      const post = page
        .waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/chat', {
          timeout: 5_000,
        })
        .then(() => true)
        .catch(() => false)
      await composer.press('Enter')
      sent = await post
    }
    if (!sent) return false
    while (Date.now() < deadline) {
      if ((await composer.inputValue()) === '') {
        lastTurnMs = Date.now() - startedAt
        return true
      }
      await page.waitForTimeout(500)
    }
    return false
  }
  await page.getByRole('button', { name: /GPT-6-Luna · medium/ }).waitFor({ state: 'visible' })
  await sendTurn('How many lines are in the README?')
  await step(
    'question turn receives a response',
    await visible(page.locator('div.prose').last(), 180_000),
    await page
      .locator('div.prose')
      .last()
      .innerText()
      .catch(() => 'No response text'),
  )
  await step(
    'first normal turn latency (ms)',
    Number.isFinite(lastTurnMs),
    `${lastTurnMs} ms from send to visible reply`,
  )
  await shot('orchestrator-question-response')
  const firstTurn = runJson(`
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)}, { readonly: true })
    const row = db.query("SELECT provider, model FROM runs WHERE project_id = ? AND task_class = 'chat' ORDER BY created_at DESC LIMIT 1").get(${JSON.stringify(project.id)})
    console.log(JSON.stringify(row ?? null))
    db.close()
  `)
  await step(
    'Orchestrator provider and model are recorded',
    firstTurn?.provider === 'codex' && firstTurn?.model === 'gpt-6-luna',
    JSON.stringify(firstTurn),
  )
  await shot('orchestrator-turn-recorded')

  const request = 'Modify README.md to add the line "Orchestrator marker gate".'
  const secondTurnDone = await sendTurn(request)
  const heldTaskLabel = page.getByText('Task ready to run', { exact: true }).last()
  await step(
    'Orchestrator marker creates a held task without Auxiliary',
    secondTurnDone && (await visible(heldTaskLabel, 180_000)),
    await heldTaskLabel.innerText().catch(() => 'No held task label visible'),
  )
  await shot('task-held-without-auxiliary')
  await step(
    'task marker is stripped from the chat',
    (await page.getByText('[[orchestos:task]]', { exact: true }).count()) === 0,
    `Visible marker count: ${await page.getByText('[[orchestos:task]]', { exact: true }).count()}`,
  )
  const tasksAfterAuxiliary = await api('/api/tasks', {
    headers: { 'x-orchestos-project-id': project.id },
  })
  const task = (tasksAfterAuxiliary.data?.tasks ?? []).find((row) => row.status === 'pending')
  const yaml = yamlParse(readFileSync(join(projectRoot, 'tasks.yaml'), 'utf8'))
  const taskYaml = yaml.tasks?.find((row) => row.id === task?.id)
  await step(
    'task delegates execution without fixed model or engine',
    Boolean(taskYaml) && !('executor_model' in taskYaml) && !('engine' in taskYaml),
    JSON.stringify(taskYaml ?? null),
  )
  await shot('task-yaml-delegates-to-role')

  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await projectButton.click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Executor', exact: true }).click()
  await step(
    'Executor settings no longer contain Default agent chips',
    (await page.getByRole('heading', { name: 'Default agent', exact: true }).count()) === 0 &&
      (await page.getByRole('button', { name: /^Default agent:/ }).count()) === 0,
    `Default agent headings: ${await page.getByRole('heading', { name: 'Default agent', exact: true }).count()}; chips: ${await page.getByRole('button', { name: /^Default agent:/ }).count()}`,
  )
  await shot('executor-settings-without-default-agent')
}
