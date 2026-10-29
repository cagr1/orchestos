import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { run, writeGateRoles } from '../lib.mjs'

function plain(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`+/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/[*_]/g, '')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
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

export default async function codexLive({
  page,
  api,
  step,
  shot,
  visible,
  cleanup,
  databasePath,
  runDir,
}) {
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
  await projectButton.hover()
  await page.getByRole('button', { name: 'Launch new agent', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const codexOption = dialog.getByRole('button', { name: /Codex/ }).first()
  await step('Codex agent available', await visible(codexOption), 'Codex option')
  await codexOption.click()
  const startResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat/sessions',
  )
  await dialog.getByRole('button', { name: 'Launch Agent', exact: true }).click()
  const session = await (await startResponse).json()
  if (session.agent !== 'codex')
    throw new Error(`Expected Codex session, received ${session.agent}`)
  await page.locator(`[data-session-tab="${session.id}"][aria-selected="true"]`).waitFor()
  await page.locator('[data-dev-new-session]').waitFor({ state: 'detached' })

  const sessionThread = () =>
    runJson(`
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)}, { readonly: true })
    console.log(JSON.stringify(db.query('SELECT codex_thread_id FROM chat_sessions WHERE id = ?').get(${JSON.stringify(session.id)})?.codex_thread_id ?? null))
    db.close()
  `)
  const sessionLogs = (threadIds) =>
    readFileSync(join(runDir, 'dashboard.log'), 'utf8')
      .split('\n')
      .flatMap((line) => {
        const match = line.match(/\[(codex-turn|chat-turn)\] (\{.*\})/)
        if (!match) return []
        const event = JSON.parse(match[2])
        return event.sessionId === session.id ||
          (event.threadId && threadIds.includes(event.threadId))
          ? [{ ...event, source: match[1] }]
          : []
      })
  const sampleInterval = 150
  const composer = page.locator('textarea').last()
  const word = `MANGO-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
  const sentMessage = `Remember the word ${word}. Reply in ten short paragraphs about mangoes.`
  const firstStart = await sendTurn(page, composer, sentMessage)
  const timelineView = page.locator('main').last().locator('div.max-w-3xl').first()
  const bubbleVisibleAt = await waitFor(async () => {
    const bubble = page.locator('div.max-w-2xl').filter({ hasText: sentMessage }).first()
    return (await bubble.isVisible().catch(() => false)) ? Date.now() : null
  }, 2000)
  await step(
    'turn 1 user message appears before completion',
    Boolean(bubbleVisibleAt),
    bubbleVisibleAt ? `${bubbleVisibleAt - firstStart} ms after send` : 'not visible within 2 s',
  )
  const visibleText = async () =>
    (await page.locator('div.prose').allInnerTexts()).at(-1)?.trim() ?? ''
  const textSamples = []
  const sampler = setInterval(async () => {
    try {
      const text = await visibleText()
      if (text) textSamples.push({ text, at: Date.now() })
    } catch {}
  }, sampleInterval)
  sampler.unref?.()
  let firstDone
  const firstCompletion = await waitFor(async () => {
    const text = await visibleText()
    const timeline = await api(`/api/chat/sessions/${encodeURIComponent(session.id)}/timeline`, {
      headers: { 'x-orchestos-project-id': project.id },
    })
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
  const firstThreadId = sessionThread()
  const firstLogs = sessionLogs([firstThreadId])
  const firstDelta = firstLogs.find((entry) => entry.event === 'first-delta')
  const firstComplete = firstLogs.find((entry) => entry.event === 'turn-completed')
  const deltaCount = firstComplete?.notifications?.['item/agentMessage/delta'] ?? 0
  const backendWindow = firstDelta && firstComplete ? firstComplete.ms - firstDelta.ms : null
  const backendBurst =
    deltaCount > 1 &&
    backendWindow !== null &&
    backendWindow >= 0 &&
    backendWindow < 2 * sampleInterval
  await step(
    'turn 1 streams multiple visible text updates',
    Boolean(firstCompletion && (distinct >= 2 || backendBurst)),
    `${distinct} distinct non-empty samples before completion; sessionId=${session.id}; threadId=${firstThreadId}; first delta=${firstDelta?.ms ?? 'missing'} ms; complete=${firstComplete?.ms ?? 'missing'} ms; deltas=${deltaCount}; ${backendBurst ? `ráfaga del backend: ${deltaCount} deltas en ${backendWindow} ms` : `backend window=${backendWindow} ms`}`,
  )
  if (!firstCompletion) throw new Error('Turn 1 did not complete')
  await shot('codex-live-turn-one')
  await new Promise((resolve) => setTimeout(resolve, 3000))
  await step(
    'turn 1 working indicator stops after completion',
    (await timelineView.locator('[data-thread-working]').count()) === 0,
    `${await timelineView.locator('[data-thread-working]').count()} working indicators remain`,
  )

  const secondStart = await sendTurn(
    page,
    composer,
    'What word did I ask you to remember? Start with it, then explain mangoes in three short paragraphs.',
  )
  let secondMidTurn = false
  const secondUserPrompt =
    'What word did I ask you to remember? Start with it, then explain mangoes in three short paragraphs.'
  let secondDone = null
  let secondFinished = false
  const completionObserver = waitFor(async () => {
    const timeline = await api(`/api/chat/sessions/${encodeURIComponent(session.id)}/timeline`, {
      headers: { 'x-orchestos-project-id': project.id },
    })
    const assistants =
      timeline.data?.messages?.filter((message) => message.role === 'assistant') ?? []
    if (!timeline.data?.pending && assistants.length >= 2) {
      secondDone = Date.now() - secondStart
      secondFinished = true
      return assistants.at(-1)
    }
    return null
  }).then((result) => {
    secondFinished = true
    return result
  })
  const midTurnObserver = waitFor(async () => {
    if (secondFinished) return true
    const timeline = await api(`/api/chat/sessions/${encodeURIComponent(session.id)}/timeline`, {
      headers: { 'x-orchestos-project-id': project.id },
    })
    if (secondFinished) return true
    if (!timeline.data?.pending || !timeline.data.live?.text) return null
    const currentTurnId = timeline.data.turns.at(-1)?.id
    if (!currentTurnId || timeline.data.live.turnId !== currentTurnId) return null
    const firstAssistantText =
      timeline.data.messages.find((message) => message.role === 'assistant')?.content ?? ''
    if (timeline.data.live.text === firstAssistantText) return null
    const mixedOrder = await timelineView.locator('div.max-w-2xl, div.prose').allInnerTexts()
    if (!mixedOrder.some((text) => text.includes(secondUserPrompt))) return null
    if (
      !mixedOrder.some((text) => plain(text).includes(plain(timeline.data.live.text).slice(0, 32)))
    )
      return null
    const firstAssistantIndex = mixedOrder.findIndex((text) =>
      plain(text).includes(plain(firstAssistantText)),
    )
    const secondUserIndex = mixedOrder.findIndex((text) => text.includes(secondUserPrompt))
    const liveAssistantIndex = mixedOrder.findIndex((text) =>
      plain(text).includes(plain(timeline.data.live.text).slice(0, 32)),
    )
    if (liveAssistantIndex <= secondUserIndex) return null
    secondMidTurn = true
    await step(
      'turn 2 DOM order is assistant 1, user 2, live assistant 2 while generating',
      firstAssistantIndex < secondUserIndex && secondUserIndex < liveAssistantIndex,
      `${JSON.stringify(mixedOrder.map((text) => text.trim().slice(0, 50)))}; first answer=${plain(firstAssistantText).slice(0, 80)}`,
    )
    return true
  })
  const [secondCompletion] = await Promise.all([completionObserver, midTurnObserver])
  const secondThreadId = sessionThread()
  await step(
    'turn 2 remembers the word from turn 1',
    Boolean(secondCompletion?.content?.includes(word)),
    secondCompletion?.content ?? 'no second response',
  )
  await new Promise((resolve) => setTimeout(resolve, 3000))
  await step(
    'turn 2 working indicator stops after completion',
    (await timelineView.locator('[data-thread-working]').count()) === 0,
    `${await timelineView.locator('[data-thread-working]').count()} working indicators remain`,
  )
  const timelineBubbles = page.locator('main').last().locator('div.max-w-2xl')
  const bubbleTexts = await timelineBubbles.allInnerTexts()
  const proseTexts = await timelineView.locator('div.prose').allInnerTexts()
  const firstAnswer =
    firstCompletion.messages?.find((message) => message.role === 'assistant')?.content ?? ''
  await step(
    'both exchanges remain visible in order after turn 2',
    bubbleTexts.some((text) => text.includes(sentMessage)) &&
      bubbleTexts.some((text) => text.includes('What word did I ask you to remember?')) &&
      bubbleTexts.findIndex((text) => text.includes(sentMessage)) <
        bubbleTexts.findIndex((text) => text.includes('What word did I ask you to remember?')) &&
      proseTexts.some((text) => {
        const answer = plain(firstAnswer)
        const rendered = plain(text)
        return answer.includes(rendered) || rendered.includes(answer)
      }) &&
      proseTexts.length >= 2,
    `user bubbles=${bubbleTexts.length}; assistant bubbles=${proseTexts.length}; first answer=${plain(firstAnswer).slice(0, 80)}`,
  )
  const completedOrder = await timelineView.locator('div.max-w-2xl, div.prose').allInnerTexts()
  const orderIndex = (text) => {
    const prefix = plain(text).slice(0, 40)
    return completedOrder.findIndex((entry) => plain(entry).includes(prefix))
  }
  const completedIndices = [
    sentMessage,
    firstAnswer,
    secondUserPrompt,
    secondCompletion?.content ?? '',
  ].map(orderIndex)
  const inOrder = (indices) =>
    indices.every((index, i) => index >= 0 && (i === 0 || indices[i - 1] < index))
  const finalOrderOk = inOrder(completedIndices)
  await step(
    'timeline DOM alternates user 1, assistant 1, user 2, assistant 2',
    finalOrderOk,
    `indices=${JSON.stringify(completedIndices)}; secondMidTurn=${secondMidTurn}; ${JSON.stringify(completedOrder.map((text) => text.trim().slice(0, 50)))}`,
  )
  if (!finalOrderOk)
    throw new Error(
      `Final timeline order failed: indices=${JSON.stringify(completedIndices)}; secondMidTurn=${secondMidTurn}`,
    )
  await step(
    'user bubbles contain no agent markup or response text',
    (await timelineView.locator('div.max-w-2xl').allInnerTexts()).length >= 2 &&
      (await timelineView.locator('div.max-w-2xl').allInnerTexts()).every(
        (text) =>
          !plain(text).includes(plain(firstAnswer).slice(0, 40)) &&
          !plain(text).includes(plain(secondCompletion?.content ?? '').slice(0, 40)),
      ) &&
      (await timelineView
        .locator('div.max-w-2xl')
        .evaluateAll((bubbles) =>
          bubbles.every(
            (bubble) => !bubble.querySelector('code, .prose, [data-tool-row], [data-reasoning]'),
          ),
        )),
    `${await timelineView.locator('div.max-w-2xl').count()} user bubbles checked; first answer=${plain(firstAnswer).slice(0, 80)}`,
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const refreshedSessions = await api(
    `/api/chat/sessions?project=${encodeURIComponent(project.id)}`,
  )
  const refreshedSession = (refreshedSessions.data ?? []).find((item) => item.id === session.id)
  if (!refreshedSession?.title) throw new Error(`Codex session missing after reload: ${session.id}`)
  const reselectAgent = page.locator(`[data-thread-id="${session.id}"]`)
  if (!(await reselectAgent.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: basename(projectRoot), exact: true }).click()
  }
  await reselectAgent.click()
  const reloadedTimeline = page.locator('main').last()
  await waitFor(
    async () =>
      (await reloadedTimeline.locator('div.max-w-2xl').filter({ hasText: sentMessage }).count()) >
        0 &&
      (await reloadedTimeline
        .locator('div.max-w-2xl')
        .filter({ hasText: 'What word did I ask you to remember?' })
        .count()) > 0,
  )
  const reloadedBubbles = await reloadedTimeline.locator('div.max-w-2xl').allInnerTexts()
  const reloadedProse = await reloadedTimeline.locator('div.prose').allInnerTexts()
  const reloadedMixed = await reloadedTimeline.locator('div.max-w-2xl, div.prose').allInnerTexts()
  const reloadedIndex = (text) => {
    const prefix = plain(text).slice(0, 40)
    return reloadedMixed.findIndex((entry) => plain(entry).includes(prefix))
  }
  const reloadedIndices = [
    sentMessage,
    firstAnswer,
    secondUserPrompt,
    secondCompletion?.content ?? '',
  ].map(reloadedIndex)
  const reloadedOrderOk = inOrder(reloadedIndices) && reloadedProse.length >= 2
  await step(
    'timeline DOM alternates user 1, assistant 1, user 2, assistant 2 after reload',
    reloadedOrderOk,
    `indices=${JSON.stringify(reloadedIndices)}; secondMidTurn=${secondMidTurn}; user bubbles=${reloadedBubbles.length}; assistant bubbles=${reloadedProse.length}; ${JSON.stringify(reloadedMixed.map((text) => text.trim().slice(0, 50)))}`,
  )
  if (!reloadedOrderOk)
    throw new Error(
      `Reloaded timeline order failed: indices=${JSON.stringify(reloadedIndices)}; secondMidTurn=${secondMidTurn}`,
    )
  const turnLogs = sessionLogs([firstThreadId, secondThreadId])
  const completedTurns = turnLogs.filter((entry) => entry.event === 'turn-completed')
  await step(
    'turn 2 reuses the same Codex thread',
    Boolean(
      firstThreadId &&
        firstThreadId === secondThreadId &&
        completedTurns.length === 2 &&
        completedTurns.every((entry) => entry.threadId === firstThreadId),
    ),
    JSON.stringify({
      turn1: firstDone,
      turn2: secondDone,
      sessionId: session.id,
      firstThreadId,
      secondThreadId,
      codexTurn: turnLogs,
    }),
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
  await step(
    'project chat runs use the configured orchestrator model',
    records.length >= 2 && records.every((row) => row.model === config.roles.orchestrator.model),
    `expected=${config.roles.orchestrator.model}; records=${JSON.stringify(records)}`,
  )
  await shot('codex-live-turn-two')
}
