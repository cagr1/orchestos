import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { run, writeGateRoles } from '../lib.mjs'

async function waitFor(predicate, timeout = 180_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const value = await predicate()
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Condition timed out after ${timeout} ms`)
}

function sessionState(databasePath, sessionId) {
  return JSON.parse(
    execFileSync(
      'bun',
      [
        '-e',
        `
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)}, { readonly: true })
    const id = ${JSON.stringify(sessionId)}
    const session = db.query('SELECT claude_session_id FROM chat_sessions WHERE id = ?').get(id)
    const turns = db.query('SELECT status FROM chat_turns WHERE session_id = ? ORDER BY created_at').all(id)
    db.close()
    console.log(JSON.stringify({ session, turns }))
  `,
      ],
      { encoding: 'utf8' },
    ),
  )
}

async function send(page, message) {
  const composer = page.locator('textarea').last()
  await composer.fill(message)
  const button = page.getByRole('button', { name: 'Send message', exact: true }).last()
  await waitFor(async () => await button.isEnabled(), 30_000)
  const request = page.waitForRequest(
    (req) => req.method() === 'POST' && new URL(req.url()).pathname === '/api/chat',
  )
  const response = page.waitForResponse(
    (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/chat',
    { timeout: 180_000 },
  )
  await button.click()
  const sent = await request
  return { sessionId: sent.postDataJSON().sessionId, response }
}

export default async function chatStop({ page, api, step, shot, visible, cleanup, databasePath }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-chat-stop-'))
  writeFileSync(join(projectRoot, 'README.md'), '# Chat stop\n')
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
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', projectRoot], process.cwd())
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
  const project = (await api('/api/projects')).data.find((item) => item.path === projectRoot)
  if (!project) throw new Error('Stop fixture was not registered')
  cleanup(async () => {
    const purged = await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, {
      method: 'POST',
    })
    if (!purged.ok) throw new Error(`Stop fixture purge failed: ${purged.status}`)
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })
  const headers = { 'x-orchestos-project-id': project.id }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectRow = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await projectRow.click()

  for (const view of ['Chat', 'Dev']) {
    await page.getByRole('button', { name: view, exact: true }).click()
    if (view === 'Chat') {
      await page.getByRole('button', { name: 'New chat', exact: true }).click()
      const option = page
        .getByRole('dialog')
        .getByRole('button', { name: basename(projectRoot), exact: true })
      if (await option.isVisible()) await option.click()
    } else {
      await projectRow.hover()
      await page.getByRole('button', { name: 'Launch new agent', exact: true }).click()
    }
    const dialog = page.getByRole('dialog')
    await dialog
      .getByRole('button', { name: /Claude/ })
      .first()
      .click()
    await dialog
      .getByRole('button', { name: view === 'Chat' ? 'Start Chat' : 'Launch Agent', exact: true })
      .click()
    const modelControl = page.locator('button[title="Select model and reasoning effort"]').last()
    await modelControl.click()
    await page.getByRole('button', { name: /haiku/i }).first().click()
    await page.keyboard.press('Escape')

    const first = await send(
      page,
      'Cuenta del 1 al 300 en palabras, un número por línea, sin usar herramientas ni escribir archivos.',
    )
    const path = `/api/chat/sessions/${encodeURIComponent(first.sessionId)}`
    const live = await waitFor(async () => {
      const state = await api(`${path}/timeline`, { headers })
      return state.data?.pending && state.data.live?.text ? state.data : null
    })
    const visiblePartial = await waitFor(async () =>
      (await page.locator('div.prose').allInnerTexts()).some((text) => text.trim().length > 0),
    )
    await step(
      `${view}: live text before Stop`,
      visiblePartial,
      `turn=${live.live.turnId}; partial=${live.live.text.length}`,
    )

    // Enter queues a draft without interrupting the in-flight response.
    const composer = page.locator('textarea').last()
    await composer.fill('This draft must not interrupt or send')
    let extraPosts = 0
    const countPost = (request) => {
      if (
        request.method() === 'POST' &&
        /\/api\/chat(?:\?|$|\/sessions\/[^/]+\/stop)/.test(request.url())
      )
        extraPosts++
    }
    page.on('request', countPost)
    await composer.press('Enter')
    await page.waitForTimeout(400)
    page.off('request', countPost)
    await step(
      `${view}: Enter while busy queues without concurrent POST or Stop`,
      extraPosts === 0 &&
        (await page.locator('[data-queued-message]').count()) === 1 &&
        (await page.getByRole('button', { name: 'Stop response', exact: true }).isEnabled()),
      `posts=${extraPosts}`,
    )
    await page.getByRole('button', { name: 'Remove queued message', exact: true }).click()
    await composer.fill('')

    // Observe transient Stopping in the browser even if the CLI aborts between two polls.
    await page.evaluate(() => {
      window.__chatStopSeen = false
      const observer = new MutationObserver(() => {
        if (document.querySelector('button[aria-label="Stopping response"]:disabled')) {
          window.__chatStopSeen = true
          observer.disconnect()
        }
      })
      observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    })
    const stopRequest = page.waitForRequest(
      (request) =>
        request.method() === 'POST' && new URL(request.url()).pathname === `${path}/stop`,
    )
    await page.getByRole('button', { name: 'Stop response', exact: true }).click()
    await step(
      `${view}: Stop sends the current turnId`,
      (await stopRequest).postDataJSON().turnId === live.live.turnId,
      live.live.turnId,
    )
    const result = await first.response
    const body = await result.json()
    await step(
      `${view}: POST completes as stopped`,
      result.ok() && body.stopped === true,
      JSON.stringify(body).slice(0, 200),
    )
    await step(
      `${view}: Stopping was visible and disabled`,
      await page.evaluate(() => window.__chatStopSeen),
      'MutationObserver sampled stopping button',
    )
    const mark = page.getByText('Respuesta detenida', { exact: true })
    await step(`${view}: stopped mark visible`, await visible(mark), 'Respuesta detenida')
    const ready = page.getByRole('button', { name: 'Send message', exact: true }).last()
    await ready.waitFor()
    const messages = await api(`${path}/messages`, { headers })
    const stopped = messages.data?.find(
      (message) => message.role === 'assistant' && message.turnId === live.live.turnId,
    )
    await step(
      `${view}: persisted partial is stopped`,
      stopped?.stopped === true && stopped.content === body.text && stopped.content.length > 0,
      `length=${stopped?.content?.length}`,
    )
    const proseBefore = await page.locator('div.prose').allInnerTexts()
    await page.waitForTimeout(5000)
    const after = await api(`${path}/messages`, { headers })
    const stoppedAfter = after.data?.find((message) => message.id === stopped?.id)
    await step(
      `${view}: partial does not grow for 5 s`,
      stoppedAfter?.content === stopped?.content &&
        JSON.stringify(await page.locator('div.prose').allInnerTexts()) ===
          JSON.stringify(proseBefore),
      `partial=${stoppedAfter?.content?.length}`,
    )
    const cancelled = sessionState(databasePath, first.sessionId)
    await step(
      `${view}: cancelled Claude session cannot resume`,
      cancelled.session?.claude_session_id === null &&
        cancelled.turns.at(-1)?.status === 'cancelled',
      JSON.stringify(cancelled),
    )
    await shot(`${view.toLowerCase()}-stopped`)
    const second = await send(page, 'Responde únicamente: listo')
    const secondResponse = await second.response
    const secondBody = await secondResponse.json()
    await waitFor(async () => {
      const timeline = await api(`${path}/timeline`, { headers })
      return (
        !timeline.data?.pending &&
        timeline.data.messages.filter((message) => message.role === 'assistant').length === 2
      )
    })
    const completed = sessionState(databasePath, first.sessionId)
    await step(
      `${view}: second turn in same session completes normally`,
      second.sessionId === first.sessionId &&
        secondResponse.ok() &&
        !secondBody.stopped &&
        /listo/i.test(secondBody.text) &&
        completed.turns.at(-1)?.status === 'completed' &&
        Boolean(completed.session?.claude_session_id),
      JSON.stringify({ body: secondBody, state: completed }),
    )
    await step(
      `${view}: second answer appears in thread`,
      (await page.locator('div.prose').allInnerTexts()).some((text) => /listo/i.test(text)),
      'second response rendered',
    )
    await shot(`${view.toLowerCase()}-second-turn`)
    if (view === 'Chat') {
      const resumed = await send(
        page,
        'Cuenta del 1 al 300 en palabras, un número por línea, sin usar herramientas ni escribir archivos.',
      )
      // Reload disconnects the original request; completion is observed through the durable timeline.
      void resumed.response.catch(() => null)
      const resumedPath = `/api/chat/sessions/${encodeURIComponent(resumed.sessionId)}`
      await waitFor(async () => (await api(`${resumedPath}/timeline`, { headers })).data?.pending)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await step(
        'Chat: reload restores Stop and working state',
        await visible(page.getByRole('button', { name: 'Stop response', exact: true })),
        `session=${resumed.sessionId}`,
      )
      await waitFor(async () => !(await api(`${resumedPath}/timeline`, { headers })).data?.pending)
      const saved = await api(`${resumedPath}/messages`, { headers })
      const answer = saved.data?.filter((message) => message.role === 'assistant').at(-1)
      await waitFor(async () =>
        (await page.locator('div.prose').allInnerTexts()).some(
          (text) => answer?.content && text.trim() === answer.content.trim(),
        ),
      )
      await step(
        'Chat: recovered turn completes and its persisted answer appears',
        Boolean(answer?.content) &&
          sessionState(databasePath, resumed.sessionId).turns.at(-1)?.status === 'completed',
        `saved=${answer?.content?.length}`,
      )
      await shot('chat-reloaded-completed')
    }
  }
}
