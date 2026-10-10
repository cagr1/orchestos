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

async function sendTurn(page, composer, message) {
  await composer.waitFor({ state: 'visible', timeout: 30_000 })
  const previousReplyCount = await page.locator('div.prose').count()
  await composer.fill(message)
  const responsePromise = page.waitForResponse(
    (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/chat',
    { timeout: 180_000 },
  )
  await composer.press('Enter')
  const response = await responsePromise
  if (!response.ok())
    throw new Error(
      `/api/chat returned HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`,
    )
  const apiText = (await response.json()).text
  if (typeof apiText !== 'string')
    throw new Error('/api/chat response text was not a string')
  const reply = page.locator('div.prose').nth(previousReplyCount)
  const deadline = Date.now() + 30_000
  let domText = ''
  while (Date.now() < deadline) {
    if (await reply.isVisible().catch(() => false)) {
      domText = await reply.innerText()
      if (domText.trim().includes(apiText.trim())) break
    }
    await page.waitForTimeout(300)
  }
  return { api: apiText, dom: domText }
}

async function startChat(page, agent, projectName) {
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const projectOption = dialog.getByRole('button', { name: projectName, exact: true })
  if (await projectOption.isVisible()) await projectOption.click()
  await dialog
    .getByRole('button', { name: new RegExp(agent, 'i') })
    .first()
    .click()
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat/sessions',
  )
  await dialog.getByRole('button', { name: 'Start Chat', exact: true }).click()
  const session = await (await responsePromise).json()
  if (session.agent !== agent.toLowerCase())
    throw new Error(`Expected ${agent} session, received ${session.agent}`)
  return session
}

async function selectClaudeHaiku(page) {
  const modelControl = page.locator('button[title="Select model and reasoning effort"]').last()
  await modelControl.waitFor({ state: 'visible', timeout: 15_000 })
  await modelControl.click()
  await page.getByRole('button', { name: /haiku/i }).first().click()
  await page.keyboard.press('Escape')
}

async function reopenSession(page, api, project, session) {
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectName = basename(project.path)
  const sessions = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
  const saved = (sessions.data ?? []).find((item) => item.id === session.id)
  if (!saved?.title) throw new Error(`Chat session missing after reload: ${session.id}`)
  const projectButton = page.getByRole('button', { name: projectName, exact: true })
  if (
    !(await page
      .getByRole('button', { name: saved.title, exact: true })
      .isVisible()
      .catch(() => false))
  )
    await projectButton.click()
  await page.getByRole('button', { name: saved.title, exact: true }).click()
}

export default async function chatContinuity({
  page,
  api,
  step,
  shot,
  visible,
  cleanup,
  databasePath,
  captureDir,
}) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-chat-continuity-'))
  writeFileSync(join(projectRoot, 'README.md'), '# Chat continuity\n')
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

  const sentinel = `R82-${Math.random().toString(16).slice(2, 10).padEnd(8, '0').slice(0, 8).toUpperCase()}`
  const question = 'What was the code I gave you earlier in this chat? Reply with only the code.'
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step('temporary project visible', await visible(projectButton), basename(projectRoot))
  await projectButton.click()
  const claudeSession = await startChat(page, 'Claude', basename(projectRoot))
  await selectClaudeHaiku(page)
  const claudeComposer = page.locator('textarea').last()
  const firstClaude = await sendTurn(
    page,
    claudeComposer,
    `Remember this code for later: ${sentinel}. Reply only OK.`,
  )
  await reopenSession(page, api, project, claudeSession)
  const claudeQuestion = await sendTurn(page, page.locator('textarea').last(), question)
  const claudeCapture = readFileSync(
    join(captureDir, `chat-cli-input-${claudeSession.id}.txt`),
    'utf8',
  )
  await step('Claude second prompt excludes sentinel', !question.includes(sentinel), question)
  await step(
    'Claude CLI receives prior sentinel from transcript',
    claudeCapture.includes(sentinel),
    claudeCapture,
  )
  await step('Claude first reply is non-empty', !!firstClaude.api.trim(), firstClaude.api)
  await step(
    'Claude recalls sentinel after reload in API and DOM',
    claudeQuestion.api.includes(sentinel) && claudeQuestion.dom.includes(sentinel),
    `API: ${claudeQuestion.api}\nDOM: ${claudeQuestion.dom}`,
  )
  await shot('chat-continuity-claude')

  const codexSession = await startChat(page, 'Codex', basename(projectRoot))
  const codexComposer = page.locator('textarea').last()
  await sendTurn(page, codexComposer, `Remember this code for later: ${sentinel}. Reply only OK.`)
  await reopenSession(page, api, project, codexSession)
  const codexAnswer = await sendTurn(page, page.locator('textarea').last(), question)
  const resumedCapture = readFileSync(
    join(captureDir, `chat-cli-input-${codexSession.id}.txt`),
    'utf8',
  )
  await step(
    'Codex thread remembers sentinel without transcript duplication',
    codexAnswer.api.includes(sentinel) &&
      codexAnswer.dom.includes(sentinel) &&
      !resumedCapture.includes(sentinel),
    `${resumedCapture}\nAPI: ${codexAnswer.api}\nDOM: ${codexAnswer.dom}`,
  )

  const updated = runJson(`
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)})
    const result = db.query("UPDATE chat_sessions SET codex_thread_id = ? WHERE id = ?").run(${JSON.stringify(crypto.randomUUID())}, ${JSON.stringify(codexSession.id)})
    db.close()
    console.log(JSON.stringify({ changes: result.changes }))
  `)
  if (updated.changes !== 1)
    throw new Error(`Could not replace Codex thread id for ${codexSession.id}`)
  const afterExpiry = await sendTurn(page, page.locator('textarea').last(), question)
  const expiredCapture = readFileSync(
    join(captureDir, `chat-cli-input-${codexSession.id}.txt`),
    'utf8',
  )
  await step(
    'expired Codex thread resends transcript and recalls sentinel',
    expiredCapture.includes(sentinel) &&
      afterExpiry.api.includes(sentinel) &&
      afterExpiry.dom.includes(sentinel),
    `${expiredCapture}\nAPI: ${afterExpiry.api}\nDOM: ${afterExpiry.dom}`,
  )
  await shot('chat-continuity-codex-expired')
}
