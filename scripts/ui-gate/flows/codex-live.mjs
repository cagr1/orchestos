import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { writeGateRoles } from '../lib.mjs'

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
  await new Promise((resolve) => setTimeout(resolve, 3000))
  await step(
    'turn 1 timeline loader stops after completion',
    (await timelineView.locator('.animate-spin').count()) === 0,
    `${await timelineView.locator('.animate-spin').count()} spinning loaders remain`,
  )

  const secondStart = await sendTurn(
    page,
    composer,
    'What word did I ask you to remember? Start with it, then explain mangoes in three short paragraphs.',
  )
  let secondMidTurn = false
  const secondUserPrompt =
    'What word did I ask you to remember? Start with it, then explain mangoes in three short paragraphs.'
  await waitFor(async () => {
    const timeline = await api(`/api/chat/sessions/${encodeURIComponent(session.id)}/timeline`)
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
  await new Promise((resolve) => setTimeout(resolve, 3000))
  await step(
    'turn 2 timeline loader stops after completion',
    (await timelineView.locator('.animate-spin').count()) === 0,
    `${await timelineView.locator('.animate-spin').count()} spinning loaders remain`,
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
  await step(
    'timeline DOM alternates user 1, assistant 1, user 2, assistant 2',
    secondMidTurn &&
      orderIndex(sentMessage) < orderIndex(firstAnswer) &&
      orderIndex(firstAnswer) < orderIndex(secondUserPrompt) &&
      orderIndex(secondUserPrompt) < orderIndex(secondCompletion?.content ?? ''),
    `${JSON.stringify(completedOrder.map((text) => text.trim().slice(0, 50)))}; first answer=${plain(firstAnswer).slice(0, 80)}`,
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
  const reselectAgent = page.getByRole('button', { name: refreshedSession.title, exact: true })
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
  await step(
    'timeline DOM alternates user 1, assistant 1, user 2, assistant 2 after reload',
    reloadedIndex(sentMessage) >= 0 &&
      reloadedIndex(sentMessage) < reloadedIndex(firstAnswer) &&
      reloadedIndex(firstAnswer) < reloadedIndex(secondUserPrompt) &&
      reloadedIndex(secondUserPrompt) < reloadedIndex(secondCompletion?.content ?? '') &&
      reloadedProse.length >= 2,
    `user bubbles=${reloadedBubbles.length}; assistant bubbles=${reloadedProse.length}; first answer=${plain(firstAnswer).slice(0, 80)}`,
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
