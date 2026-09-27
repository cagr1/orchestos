import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { writeGateRoles } from '../lib.mjs'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
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
  const sendButton = page.getByRole('button', { name: 'Send message', exact: true }).last()
  const enabled = await waitFor(async () => ((await sendButton.isEnabled()) ? true : null), 30_000)
  if (!enabled) throw new Error('Chat send stayed disabled after model catalog loading')
  const startedAt = Date.now()
  let sent = false
  while (!sent && Date.now() - startedAt < 180_000) {
    const request = page
      .waitForRequest(
        (req) => req.method() === 'POST' && new URL(req.url()).pathname === '/api/chat',
        { timeout: 5_000 },
      )
      .then(() => true)
      .catch(() => false)
    await composer.press('Enter')
    sent = await request
  }
  if (!sent) throw new Error('Chat send request was not observed')
  return startedAt
}

// `fable` (default del catálogo de Claude) puede quedar sin crédito y responder de una pieza:
// el flujo fija `haiku` en el composer para medir streaming real (2026-09-27).
const squash = (text) => text.replace(/\s+/g, ' ').trim()

async function selectHaiku(page, visible) {
  const modelControl = page.locator('button[title="Select model and reasoning effort"]').last()
  if (!(await visible(modelControl, 15_000))) throw new Error('composer model control not visible')
  await modelControl.click()
  const haiku = page.getByRole('button', { name: /haiku/i }).first()
  if (!(await visible(haiku))) throw new Error('haiku model option not visible')
  await haiku.click()
  await page.keyboard.press('Escape')
}

export default async function chatStreaming({ page, api, step, shot, visible, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-mr-1-d4-'))
  writeFileSync(join(projectRoot, 'README.md'), '# Chat streaming\n')
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
  config.roles = Object.fromEntries(
    ['orchestrator', 'executor', 'reviewer', 'auxiliary'].map((role) => [
      role,
      { agent: 'claude', model: 'haiku', effort: 'low' },
    ]),
  )
  writeFileSync(configPath, stringifyYaml(config))

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
  await step('temporary project visible', await visible(projectButton), basename(projectRoot))
  if (await projectButton.isVisible()) await projectButton.click()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const chatDialog = page.getByRole('dialog')
  const projectOption = chatDialog.getByRole('button', { name: basename(projectRoot), exact: true })
  if (await projectOption.isVisible()) await projectOption.click()
  const chatClaudeOption = chatDialog.getByRole('button', { name: /Claude/ }).first()
  const chatClaudeAvailable = await visible(chatClaudeOption, 15_000)
  await step('Claude option available', chatClaudeAvailable, await chatDialog.innerText())
  if (!chatClaudeAvailable)
    throw new Error(`Claude option is unavailable: ${await chatDialog.innerText()}`)
  await chatClaudeOption.click()
  const startChatButton = page.getByRole('button', { name: 'Start Chat', exact: true })
  if (!(await startChatButton.isEnabled())) {
    throw new Error(
      `Start Chat disabled; executor modes: ${JSON.stringify(await api('/api/system/executor-modes'))}`,
    )
  }
  const sessionResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat/sessions',
  )
  await startChatButton.click()
  let sessionResponse
  try {
    sessionResponse = await sessionResponsePromise
  } catch (error) {
    throw new Error(`Chat creation did not complete: ${await chatDialog.innerText()}; ${error}`)
  }
  const session = await sessionResponse.json()
  if (session.agent !== 'claude')
    throw new Error(`Expected Claude session, received ${session.agent}`)
  await selectHaiku(page, visible)
  const composer = page.locator('textarea').last()
  const startedAt = await sendTurn(
    page,
    composer,
    'Escribe los números del 1 al 40 en palabras, uno por línea.',
  )

  const visibleText = async () =>
    (await page.locator('div.prose').allInnerTexts()).at(-1)?.trim() ?? ''
  let firstAt = null
  let previousLength = 0
  let growthCount = 0
  let tookScreenshot = false
  const completion = await waitFor(async () => {
    const text = await visibleText()
    if (text && firstAt === null) firstAt = Date.now() - startedAt
    if (text.length > previousLength) {
      if (previousLength > 0) growthCount++
      previousLength = text.length
    }
    const timeline = await api(`/api/chat/sessions/${encodeURIComponent(session.id)}/timeline`)
    if (text && !tookScreenshot && timeline.data?.pending) {
      tookScreenshot = true
      await shot('chat-text-visible-mid-turn')
    }
    return !timeline.data?.pending &&
      timeline.data?.messages?.some((message) => message.role === 'assistant')
      ? { timeline: timeline.data, doneAt: Date.now() - startedAt }
      : null
  })
  await step(
    'first assistant text appears before completion',
    Boolean(completion && firstAt < completion.doneAt),
    `t_first=${firstAt} ms; t_done=${completion?.doneAt ?? 'timeout'} ms`,
  )
  await step(
    'visible text grows at least twice before completion',
    Boolean(completion && growthCount >= 2),
    `${growthCount} growth updates`,
  )
  await step('captured screenshot during active turn', tookScreenshot, 'chat-text-visible-mid-turn')
  const visibleFinal = await visibleText()
  const assistantMessages =
    completion?.timeline.messages.filter((message) => message.role === 'assistant') ?? []
  await step(
    'one assistant bubble matches persisted response',
    // Markdown convierte los saltos simples en espacios: se compara con espacios normalizados.
    assistantMessages.length === 1 &&
      squash(visibleFinal) === squash(assistantMessages[0]?.content ?? ''),
    `bubbles=${await page.locator('div.prose').count()}; persisted=${assistantMessages.length}; visible=${squash(visibleFinal).slice(0, 80)}`,
  )
  await step(
    'task marker is not visible',
    !(await page.getByText(/\[\[orchestos:/).count()),
    'no task marker in the DOM',
  )

  // The Dev workspace uses the same session timeline renderer and shares its composer.
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectRow = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await projectRow.hover()
  await page.getByRole('button', { name: 'Launch new agent' }).click()
  const devDialog = page.getByRole('dialog')
  const devClaudeOption = devDialog.getByRole('button', { name: /Claude/ }).first()
  if (!(await visible(devClaudeOption, 15_000))) {
    throw new Error(`Claude Dev option is unavailable: ${await devDialog.innerText()}`)
  }
  await devClaudeOption.click()
  const devSessionResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat/sessions',
  )
  await devDialog.getByRole('button', { name: /Launch|Start/i }).click()
  const devSessionResponse = await devSessionResponsePromise
  const devSession = await devSessionResponse.json()
  if (devSession.agent !== 'claude')
    throw new Error(`Expected Claude Dev session, received ${devSession.agent}`)
  await selectHaiku(page, visible)
  const devComposer = page.locator('textarea').last()
  const devStart = await sendTurn(
    page,
    devComposer,
    'Escribe una respuesta breve: uno, dos, tres, cuatro y cinco.',
  )
  let devFirst = null
  let devDone = null
  let devVisible = ''
  const devCompletion = await waitFor(async () => {
    devVisible = (await page.locator('div.prose').allInnerTexts()).at(-1)?.trim() ?? ''
    if (devVisible && devFirst === null) devFirst = Date.now() - devStart
    const timeline = await api(`/api/chat/sessions/${encodeURIComponent(devSession.id)}/timeline`)
    if (
      !timeline.data?.pending &&
      timeline.data?.messages?.some((message) => message.role === 'assistant')
    ) {
      devDone = Date.now() - devStart
      return timeline.data
    }
    return null
  })
  await step(
    'Dev renders text during generation before completion',
    Boolean(devCompletion && devFirst < devDone),
    `t_first=${devFirst} ms; t_done=${devDone} ms; visible=${devVisible.slice(0, 80)}`,
  )
}
