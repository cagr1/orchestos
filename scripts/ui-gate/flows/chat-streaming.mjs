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

// UI.24.7 — registra cada entrada animada: un mensaje (por elemento y por posición) anima una vez.
async function installEntranceObserver(page) {
  await page.evaluate(() => {
    window.__entrances?.observer?.disconnect()
    const state = { events: [], ids: new WeakMap(), next: 1, reduced: [] }
    const kindOf = (el) => (el.classList.contains('max-w-2xl') ? 'user' : 'assistant')
    const note = (el) => {
      if (el.getAttribute('data-entered') !== 'animate') return
      if (!state.ids.has(el)) state.ids.set(el, state.next++)
      const all = [...document.querySelectorAll('[data-entered]')]
      state.events.push({ id: state.ids.get(el), position: all.indexOf(el), kind: kindOf(el) })
      setTimeout(() => {
        const style = getComputedStyle(el)
        state.reduced.push({
          kind: kindOf(el),
          opacity: style.opacity,
          transform: style.transform,
        })
      }, 100)
    }
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes') note(record.target)
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue
          if (node.hasAttribute('data-entered')) note(node)
          for (const inner of node.querySelectorAll('[data-entered]')) note(inner)
        }
      }
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-entered'],
    })
    state.observer = observer
    window.__entrances = state
  })
}

async function readEntrances(page) {
  return page.evaluate(() => {
    const { events, reduced } = window.__entrances
    return { events, reduced }
  })
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
  await installEntranceObserver(page)
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
  let workingText = null
  const completion = await waitFor(async () => {
    if (workingText === null) {
      const indicator = page.locator('[data-thread-working]').first()
      if (await indicator.isVisible().catch(() => false)) {
        workingText = (await indicator.innerText().catch(() => '')) || null
      }
    }
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
  await step(
    'working-indicator-names-phase',
    workingText !== null &&
      /(Thinking|Writing|Running .+)/.test(workingText) &&
      /\d+ s/.test(workingText),
    `indicator text: ${JSON.stringify(workingText)}`,
  )
  const workingGoneStartedAt = Date.now()
  let workingIndicators = await page.locator('[data-thread-working]').count()
  while (workingIndicators > 0 && Date.now() - workingGoneStartedAt < 5_000) {
    await page.waitForTimeout(250)
    workingIndicators = await page.locator('[data-thread-working]').count()
  }
  const workingGoneMs = Date.now() - workingGoneStartedAt
  await step(
    'working-indicator-gone',
    workingIndicators === 0,
    workingIndicators === 0
      ? `indicator removed after ${workingGoneMs} ms`
      : `${workingIndicators} working indicators remain after ${workingGoneMs} ms`,
  )
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
  const entrances = await readEntrances(page)
  const perId = new Map()
  const perPosition = new Map()
  for (const event of entrances.events) {
    perId.set(event.id, (perId.get(event.id) ?? 0) + 1)
    perPosition.set(event.position, (perPosition.get(event.position) ?? 0) + 1)
  }
  const kinds = new Set(entrances.events.map((event) => event.kind))
  await step(
    'new messages enter with data-entered=animate',
    kinds.has('user') && kinds.has('assistant'),
    `animated kinds=${[...kinds].join(',')}; events=${JSON.stringify(entrances.events)}`,
  )
  await step(
    'no message animates its entrance twice',
    entrances.events.length > 0 &&
      [...perId.values()].every((count) => count === 1) &&
      [...perPosition.values()].every((count) => count === 1),
    `events=${JSON.stringify(entrances.events)}`,
  )
  const contextUrl = `/api/chat/sessions/${encodeURIComponent(session.id)}/context`
  const contextHeaders = { headers: { 'x-orchestos-project-id': project.id } }
  const ring = page.locator('[aria-label^="Context window usage:"]').last()
  const firstContext = await waitFor(async () => {
    const result = await api(contextUrl, contextHeaders)
    const label = await ring.getAttribute('aria-label')
    const shownPct = Number(label?.match(/^Context window usage: ([\d.]+)%$/)?.[1])
    return result.data?.pct > 0 &&
      shownPct > 0 &&
      Math.abs(shownPct - result.data.pct) < 0.01 &&
      (await visible(ring))
      ? result.data
      : null
  }, 10_000)
  await step(
    'context ring reflects thread',
    Boolean(firstContext && firstContext.pct > 0),
    firstContext
      ? `used=${firstContext.used}, window=${firstContext.window}, pct=${firstContext.pct}`
      : 'thread context or visible ring did not report positive usage',
  )
  const modelControl = page.locator('button[title="Select model and reasoning effort"]').last()
  const currentModel = firstContext?.model
  await modelControl.click()
  const options = page.locator('button[title]')
  const candidates = []
  for (let index = 0; index < (await options.count()); index++) {
    const option = options.nth(index)
    const model = await option.getAttribute('title')
    if (!model || model === 'Select model and reasoning effort' || model === currentModel) continue
    const candidate = await api(`${contextUrl}?model=${encodeURIComponent(model)}`, contextHeaders)
    if (
      Number.isFinite(candidate.data?.pct) &&
      Math.min(100, candidate.data.pct) !== Math.min(100, firstContext?.pct ?? 0)
    ) {
      const family = (value) => value.match(/^(claude-(?:haiku|sonnet|opus|fable)-)/)?.[1]
      const currentFamily = family(currentModel ?? '')
      const candidateFamily = family(model)
      candidates.push({
        model,
        pct: candidate.data.pct,
        option,
        priority:
          currentFamily && candidateFamily === currentFamily
            ? 0
            : /claude-(?:fable|opus)-/.test(model)
              ? 2
              : 1,
      })
    }
  }
  candidates.sort((a, b) => a.priority - b.priority)
  const alternate = candidates[0] ?? null
  const alternateModel = alternate?.model ?? null
  const alternatePct = alternate?.pct ?? null
  if (alternateModel) {
    await alternate.option.click()
    const changed = await waitFor(async () => {
      const label = await ring.getAttribute('aria-label')
      const shownPct = Number(label?.match(/^Context window usage: ([\d.]+)%$/)?.[1])
      return Number.isFinite(shownPct) && Math.abs(shownPct - Math.min(100, alternatePct)) < 0.01
        ? { label, shownPct }
        : null
    }, 5_000)
    await step(
      'context ring recalculates on model change',
      Boolean(changed),
      changed
        ? `model=${alternateModel}, expected pct=${alternatePct}, ring=${changed.label}`
        : `selected ${alternateModel}, expected pct=${alternatePct}; ring did not change within 5 s`,
    )
    await modelControl.click()
    let originalModelOption = null
    for (let index = 0; index < (await options.count()); index++) {
      const option = options.nth(index)
      if ((await option.getAttribute('title')) === currentModel) {
        originalModelOption = option
        break
      }
    }
    if (originalModelOption) await originalModelOption.click()
    else throw new Error(`original model option disappeared: ${currentModel}`)
    const restored = await waitFor(async () => {
      const label = await ring.getAttribute('aria-label')
      const shownPct = Number(label?.match(/^Context window usage: ([\d.]+)%$/)?.[1])
      return Number.isFinite(shownPct) &&
        Math.abs(shownPct - Math.min(100, firstContext.pct)) < 0.01
        ? label
        : null
    }, 5_000)
    if (!restored) {
      throw new Error(
        `restored ${currentModel} but context ring did not return to ${Math.min(100, firstContext.pct)}% within 5 s`,
      )
    }
  } else {
    await page.keyboard.press('Escape')
    await step(
      'context ring recalculates on model change',
      false,
      `no visible model option has a known window producing a percentage distinct from ${firstContext?.pct ?? 'the current value'}`,
    )
  }
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

  await shot('thread-hierarchy')
  const threadHierarchy = await page.evaluate(() => {
    const root = document.querySelector('[data-thread-root]')
    const prose = [...(root?.querySelectorAll('div.prose') ?? [])].at(-1)
    const user = root?.querySelector('div.max-w-2xl')
    const bubble = user?.querySelector('div.whitespace-pre-wrap')
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const labLightness = (color) => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = color
      context.fillRect(0, 0, 1, 1)
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
      const linearize = (channel) => {
        const value = channel / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2
      }
      const r = linearize(red)
      const g = linearize(green)
      const b = linearize(blue)
      const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / 1.0000001
      const delta = 6 / 29
      const f = y > delta ** 3 ? Math.cbrt(y) : y / (3 * delta ** 2) + 4 / 29
      return 116 * f - 16
    }
    const opaque = (element) =>
      Number.parseFloat(
        getComputedStyle(element).backgroundColor.match(/rgba?\([^)]*[,/]\s*([\d.]+)\s*\)$/)?.[1] ??
          '1',
      ) > 0
    let background = bubble?.parentElement
    while (background && !opaque(background)) background = background.parentElement
    const bubbleColor = bubble ? getComputedStyle(bubble).backgroundColor : ''
    const backgroundColor = background ? getComputedStyle(background).backgroundColor : ''
    const userBubbleL = bubbleColor ? labLightness(bubbleColor) : null
    const backgroundL = backgroundColor ? labLightness(backgroundColor) : null
    const assistantAncestors = []
    for (let node = prose; node && node !== root; node = node.parentElement) {
      const style = getComputedStyle(node)
      assistantAncestors.push({
        backgroundColor: style.backgroundColor,
        borderTopWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
      })
    }
    const decorations = [...(root?.querySelectorAll('*') ?? [])]
    return {
      fontFamily: getComputedStyle(document.body).fontFamily,
      proseFontSize: prose ? getComputedStyle(prose).fontSize : null,
      assistantAncestors,
      userBubble: {
        found: Boolean(bubble),
        backgroundColor: bubbleColor,
        opaque: bubble ? opaque(bubble) : false,
        userBubbleL,
        backgroundL,
        difference:
          userBubbleL == null || backgroundL == null ? null : Math.abs(userBubbleL - backgroundL),
      },
      decorations: {
        animatePing: root?.querySelectorAll('.animate-ping').length ?? 0,
        gradients: decorations.filter((element) =>
          getComputedStyle(element).backgroundImage.includes('gradient'),
        ).length,
        botIcons: root?.querySelectorAll('svg.lucide-bot').length ?? 0,
        userIcons: root?.querySelectorAll('svg.lucide-user').length ?? 0,
      },
    }
  })
  await step(
    'thread-font-inter',
    threadHierarchy.fontFamily.includes('Inter'),
    `font-family=${threadHierarchy.fontFamily}`,
  )
  await step(
    'thread-body-14px',
    threadHierarchy.proseFontSize === '14px',
    `font-size=${threadHierarchy.proseFontSize}`,
  )
  const assistantUnboxed = threadHierarchy.assistantAncestors.every((style) => {
    const alpha = Number.parseFloat(
      style.backgroundColor.match(/rgba?\([^)]*[,/]\s*([\d.]+)\s*\)$/)?.[1] ?? '1',
    )
    return alpha === 0 && style.borderTopWidth === '0px' && style.boxShadow === 'none'
  })
  await step(
    'thread-assistant-unboxed',
    assistantUnboxed,
    `ancestors=${JSON.stringify(threadHierarchy.assistantAncestors)}`,
  )
  await step(
    'thread-user-bubble-visible',
    threadHierarchy.userBubble.opaque && threadHierarchy.userBubble.difference >= 5,
    `bubble=${JSON.stringify(threadHierarchy.userBubble)}`,
  )
  const { animatePing, gradients, botIcons, userIcons } = threadHierarchy.decorations
  await step(
    'thread-no-decoration',
    animatePing === 0 && gradients === 0 && botIcons === 0 && userIcons === 0,
    `animate-ping=${animatePing}, gradients=${gradients}, bot-icons=${botIcons}, user-icons=${userIcons}`,
  )

  // UI.24.7 — recargar: el historial entra sin animar.
  await page.reload({ waitUntil: 'domcontentloaded' })
  const reloadedChat = page
    .locator('aside')
    .getByText(/^Escribe los números del 1 al 40/)
    .first()
  if (await visible(reloadedChat, 30_000)) await reloadedChat.click()
  const reloadedMessages = page.locator('[data-entered]')
  await waitFor(async () => ((await reloadedMessages.count()) >= 2 ? true : null), 30_000)
  const reloadedModes = await reloadedMessages.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-entered')),
  )
  await step(
    'after reload every message is static',
    reloadedModes.length >= 2 && reloadedModes.every((mode) => mode === 'static'),
    `modes=${JSON.stringify(reloadedModes)}`,
  )

  // UI.24.7 — con prefers-reduced-motion la respuesta llega con opacidad 1 y sin transformación.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await selectHaiku(page, visible)
  await installEntranceObserver(page)
  const reducedComposer = page.locator('textarea').last()
  await sendTurn(page, reducedComposer, 'Responde solo con la palabra: listo.')
  const reducedDone = await waitFor(async () => {
    const state = await readEntrances(page)
    return state.reduced.some((item) => item.kind === 'assistant') ? state : null
  }, 180_000)
  await page.emulateMedia({ reducedMotion: null })
  const flat = (item) =>
    item.opacity === '1' &&
    (item.transform === 'none' || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(item.transform))
  const reducedAssistant = reducedDone?.reduced.find((item) => item.kind === 'assistant')
  await step(
    'reduced motion: response arrives with opacity 1 and no transform within 100 ms',
    Boolean(reducedAssistant && flat(reducedAssistant)),
    `samples=${JSON.stringify(reducedDone?.reduced ?? null)}`,
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
