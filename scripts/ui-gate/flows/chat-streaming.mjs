import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { writeGateRoles } from '../lib.mjs'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

let postFailure = null

async function waitFor(predicate, timeout = 180_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (postFailure) throw new Error(postFailure)
    const result = await predicate()
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return null
}

async function sendTurn(page, composer, message) {
  postFailure = null
  await composer.waitFor({ state: 'visible', timeout: 30_000 })
  await composer.fill(message)
  const sendButton = page.getByRole('button', { name: 'Send message', exact: true }).last()
  const enabled = await waitFor(async () => ((await sendButton.isEnabled()) ? true : null), 30_000)
  if (!enabled) throw new Error('Chat send stayed disabled after model catalog loading')
  const startedAt = Date.now()
  const responsePromise = page
    .waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/chat',
      { timeout: 180_000 },
    )
    .catch(() => null)
  responsePromise.then(async (response) => {
    if (response && !response.ok()) {
      postFailure = `/api/chat returned HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`
    }
  })
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
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
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
  let liveBubbleAtBottom = true
  let liveBubbleMeasurements = 0
  const completion = await waitFor(async () => {
    const text = await visibleText()
    const timeline = await api(`/api/chat/sessions/${encodeURIComponent(session.id)}/timeline`, {
      headers: { 'x-orchestos-project-id': project.id },
    })
    if (text && firstAt === null) firstAt = Date.now() - startedAt
    if (text.length > previousLength) {
      if (previousLength > 0) growthCount++
      previousLength = text.length
      if (timeline.data?.pending) {
        const atBottom = await page
          .locator('div.prose')
          .last()
          .evaluate((element) => {
            let container = element.parentElement
            while (container && container !== document.body) {
              const style = getComputedStyle(container)
              if (/(auto|scroll)/.test(style.overflowY)) {
                return container.scrollHeight - container.scrollTop - container.clientHeight <= 2
              }
              container = container.parentElement
            }
            return false
          })
        liveBubbleAtBottom = liveBubbleAtBottom && atBottom
        liveBubbleMeasurements++
      }
    }
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
  await step(
    'live bubble stays at the bottom',
    liveBubbleMeasurements > 0 && liveBubbleAtBottom,
    `${liveBubbleMeasurements} growth measurements; remained at bottom: ${liveBubbleAtBottom}`,
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

  const extraChatPrompts = [
    'Escribe los números del 41 al 80 en palabras, uno por línea.',
    'Escribe los números del 81 al 120 en palabras, uno por línea.',
    'Escribe los números del 121 al 160 en palabras, uno por línea.',
  ]
  const sampledChatPrompts = []
  let chatMidTurnChecked = false
  let chatComposerMidTurnChecked = false
  let secondChatCompletion = null
  for (const prompt of extraChatPrompts) {
    await sendTurn(page, composer, prompt)
    sampledChatPrompts.push(prompt)
    secondChatCompletion = await waitFor(async () => {
      const timeline = await api(`/api/chat/sessions/${encodeURIComponent(session.id)}/timeline`, {
        headers: { 'x-orchestos-project-id': project.id },
      })
      if (timeline.data?.pending && !chatComposerMidTurnChecked) {
        chatComposerMidTurnChecked = true
        const composerValue = await composer.inputValue()
        await step('Chat composer empty during sampled turn', composerValue === '', composerValue)
      }
      if (timeline.data?.pending && timeline.data.live?.text && !chatMidTurnChecked) {
        const midOrder = await page.locator('div.max-w-2xl, div.prose').allInnerTexts()
        const index = (text) => midOrder.findIndex((entry) => squash(entry).includes(squash(text)))
        const previousAnswer =
          timeline.data.messages.filter((message) => message.role === 'assistant').at(-1)
            ?.content ?? ''
        const previousIndex = index(previousAnswer)
        const promptIndex = index(prompt)
        if (previousIndex < 0 || promptIndex < 0) return null
        const livePrefix = squash(timeline.data.live.text.slice(0, 32))
        const liveCount = midOrder.filter(
          (entry, i) => i > promptIndex && squash(entry).includes(livePrefix),
        ).length
        const liveIndex = midOrder.findIndex(
          (entry, i) => i > promptIndex && squash(entry).includes(livePrefix),
        )
        if (liveIndex < 0) return null
        chatMidTurnChecked = true
        await step(
          'Chat DOM order during sampled turn is previous assistant, user, live assistant',
          previousIndex < promptIndex && promptIndex < liveIndex && liveCount === 1,
          JSON.stringify({ liveCount, order: midOrder.map((text) => squash(text).slice(0, 50)) }),
        )
      }
      const assistants =
        timeline.data?.messages?.filter((message) => message.role === 'assistant') ?? []
      return !timeline.data?.pending && assistants.length >= 2 ? timeline.data : null
    })
    if (chatMidTurnChecked && chatComposerMidTurnChecked) break
  }
  await step(
    'Chat turn 2 was sampled while pending',
    chatMidTurnChecked && chatComposerMidTurnChecked,
    `${sampledChatPrompts.length} long turn(s) sent; pending composer and live DOM order sampled`,
  )
  const chatOrder = await page.locator('div.max-w-2xl, div.prose').allInnerTexts()
  const firstChatAnswer =
    completion?.timeline.messages.find((message) => message.role === 'assistant')?.content ?? ''
  const chatOrderIndex = (text) =>
    chatOrder.findIndex((entry) => squash(entry).includes(squash(text)))
  const completedChatAnswers =
    secondChatCompletion?.messages?.filter((message) => message.role === 'assistant') ?? []
  let previousChatIndex = chatOrderIndex(firstChatAnswer)
  const allSentTurnsAlternate = sampledChatPrompts.every((prompt, index) => {
    const userIndex = chatOrderIndex(prompt)
    const assistantIndex = chatOrderIndex(completedChatAnswers[index + 1]?.content ?? '')
    const ordered = userIndex > previousChatIndex && assistantIndex > userIndex
    previousChatIndex = assistantIndex
    return ordered
  })
  await step(
    'Chat bubbles alternate for every sent turn',
    Boolean(secondChatCompletion) &&
      chatOrderIndex('Escribe los números del 1 al 40 en palabras, uno por línea.') <
        chatOrderIndex(firstChatAnswer) &&
      allSentTurnsAlternate,
    JSON.stringify(chatOrder.map((text) => squash(text).slice(0, 50))),
  )
  const userBubbles = page.locator('div.max-w-2xl').filter({ hasText: /Escribe los números/ })
  await step(
    'Chat user bubbles contain no agent text or step markup',
    await page
      .locator('div.max-w-2xl')
      .evaluateAll((bubbles) =>
        bubbles
          .filter(
            (bubble) =>
              bubble.innerText.includes('Escribe los números') ||
              bubble.innerText.includes('¿Qué números'),
          )
          .every(
            (bubble) => !bubble.querySelector('code, .prose, [data-tool-row], [data-reasoning]'),
          ),
      ),
    `user bubbles=${await userBubbles.count()}`,
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page
    .getByRole('button', { name: /Escribe los números del 1 al 40/ })
    .first()
    .click()
  await page
    .locator('div.max-w-2xl, div.prose')
    .filter({ hasText: sampledChatPrompts.at(-1) })
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 })
  const restoredTexts = await page.locator('div.max-w-2xl, div.prose').allInnerTexts()
  const restoredAssistant1 = restoredTexts.findIndex((text) =>
    squash(text).includes(squash(firstChatAnswer)),
  )
  const secondChatAnswer =
    secondChatCompletion?.messages?.filter((message) => message.role === 'assistant').at(-1)
      ?.content ?? ''
  const restoredAssistant2 = restoredTexts.findIndex((text) =>
    squash(text).includes(squash(secondChatAnswer)),
  )
  const lastSentChatPrompt = sampledChatPrompts.at(-1) ?? ''
  await step(
    'Chat exchange order remains correct after reload',
    restoredTexts.findIndex((text) => text.includes('Escribe los números')) < restoredAssistant1 &&
      restoredAssistant1 < restoredTexts.findIndex((text) => text.includes(lastSentChatPrompt)) &&
      restoredTexts.findIndex((text) => text.includes(lastSentChatPrompt)) < restoredAssistant2,
    `messages=${restoredTexts.length}`,
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
    const timeline = await api(`/api/chat/sessions/${encodeURIComponent(devSession.id)}/timeline`, {
      headers: { 'x-orchestos-project-id': project.id },
    })
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
