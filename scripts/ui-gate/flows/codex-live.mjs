import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { writeGateRoles } from '../lib.mjs'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

function runJson(source) {
  return JSON.parse(execFileSync('bun', ['-e', source], { encoding: 'utf8' }))
}

async function waitFor(predicate, timeout = 180_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const result = await predicate()
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return null
}

async function sendTurn(page, composer, message) {
  await composer.waitFor({ state: 'visible', timeout: 30_000 })
  await composer.fill(message)
  const send = page.getByRole('button', { name: 'Send message', exact: true }).last()
  if (!(await waitFor(async () => (await send.isEnabled()) || null, 30_000)))
    throw new Error('Codex chat send stayed disabled')
  const startedAt = Date.now()
  let sent = false
  while (!sent && Date.now() - startedAt < 180_000) {
    const request = page
      .waitForRequest(
        (req) => req.method() === 'POST' && new URL(req.url()).pathname === '/api/chat',
        {
          timeout: 5_000,
        },
      )
      .then(() => true)
      .catch(() => false)
    await composer.press('Enter')
    sent = await request
  }
  if (!sent) throw new Error('Chat send request was not observed')
  return startedAt
}

export default async function codexLive({ page, api, step, shot, visible, cleanup, databasePath }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-codex-live-'))
  writeFileSync(join(projectRoot, 'README.md'), '# Codex live chat\n')
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
    stringifyYaml({ version: 1, project: basename(projectRoot), tasks: [] }),
  )
  writeGateRoles(projectRoot)
  const configPath = join(projectRoot, 'orchestos.config.yaml')
  const config = parseYaml(readFileSync(configPath, 'utf8'))
  config.roles.orchestrator = { agent: 'codex', model: 'gpt-6-luna', effort: 'medium' }
  writeFileSync(configPath, stringifyYaml(config))

  const projects = await api('/api/projects')
  const project = (projects.data ?? []).find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step('temporary project visible', await visible(projectButton), basename(projectRoot))
  if (await projectButton.isVisible()) await projectButton.click()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const codexOption = dialog.getByRole('button', { name: /Codex/ }).first()
  await step('Orchestrator Codex available', await visible(codexOption), 'Codex option')
  await codexOption.click()
  const startResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat/sessions',
  )
  await dialog.getByRole('button', { name: 'Start Chat', exact: true }).click()
  const session = await (await startResponse).json()
  if (session.agent !== 'codex')
    throw new Error(`Expected Codex session, received ${session.agent}`)
  await page.getByRole('button', { name: /GPT-6-Luna · medium/i }).waitFor({ state: 'visible' })

  const composer = page.locator('textarea').last()
  const word = `MANGO-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
  const firstStart = await sendTurn(
    page,
    composer,
    `Remember the word ${word}. Reply in three short paragraphs about mangoes.`,
  )
  const visibleText = async () =>
    (await page.locator('div.prose').allInnerTexts()).at(-1)?.trim() ?? ''
  const textSamples = []
  const sampler = setInterval(async () => {
    try {
      const text = await visibleText()
      if (text) textSamples.push({ text, at: Date.now() })
    } catch {}
  }, 150)
  sampler.unref?.()
  let firstDone
  const firstCompletion = await waitFor(async () => {
    const text = await visibleText()
    const timeline = await api(`/api/chat/sessions/${encodeURIComponent(session.id)}/timeline`)
    if (
      !timeline.data?.pending &&
      timeline.data?.messages?.some((message) => message.role === 'assistant')
    ) {
      firstDone = Date.now() - firstStart
      return timeline.data
    }
    return text ? null : null
  })
  clearInterval(sampler)
  const samplesBeforeCompletion = textSamples.filter((sample) => sample.at < firstStart + firstDone)
  const distinct = new Set(samplesBeforeCompletion.map((sample) => sample.text)).size
  await step(
    'turn 1 streams multiple visible text updates',
    Boolean(firstCompletion && distinct >= 2),
    `${distinct} distinct non-empty samples before completion`,
  )
  await shot('codex-live-turn-one')

  const secondStart = await sendTurn(
    page,
    composer,
    'What word did I ask you to remember? Reply with the word only.',
  )
  const secondCompletion = await waitFor(async () => {
    const timeline = await api(`/api/chat/sessions/${encodeURIComponent(session.id)}/timeline`)
    const assistants =
      timeline.data?.messages?.filter((message) => message.role === 'assistant') ?? []
    return !timeline.data?.pending && assistants.length >= 2 ? assistants.at(-1) : null
  })
  const secondDone = secondCompletion ? Date.now() - secondStart : null
  await step(
    'turn 2 remembers the word from turn 1',
    Boolean(secondCompletion?.content?.includes(word)),
    secondCompletion?.content ?? 'no second response',
  )
  await step(
    'turn 2 is faster than turn 1',
    Number.isFinite(secondDone) && secondDone < firstDone,
    `turn 1=${firstDone} ms; turn 2=${secondDone ?? 'timeout'} ms`,
  )

  const records = runJson(`
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)}, { readonly: true })
    const rows = db.query("SELECT provider, model FROM runs WHERE project_id = ? AND task_class = 'chat' ORDER BY created_at").all(${JSON.stringify(project.id)})
    console.log(JSON.stringify(rows))
    db.close()
  `)
  await step(
    'project chat runs are recorded with provider=codex',
    records.length >= 2 && records.every((row) => row.provider === 'codex'),
    JSON.stringify(records),
  )
  await shot('codex-live-turn-two')
}
