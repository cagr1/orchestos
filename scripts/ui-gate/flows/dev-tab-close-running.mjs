import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { run, writeGateRoles } from '../lib.mjs'

async function waitFor(predicate, timeout = 30_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const value = await predicate()
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Condition timed out after ${timeout} ms`)
}

function turns(databasePath, sessionId) {
  return JSON.parse(
    execFileSync(
      'bun',
      [
        '-e',
        `import { Database } from 'bun:sqlite'
const db = new Database(${JSON.stringify(databasePath)}, { readonly: true })
try {
  console.log(JSON.stringify(db.query('SELECT id, status FROM chat_turns WHERE session_id = ? ORDER BY created_at').all(${JSON.stringify(sessionId)})))
} finally { db.close() }`,
      ],
      { encoding: 'utf8' },
    ),
  )
}

export default async function devTabCloseRunning({
  page,
  api,
  step,
  shot,
  hidden,
  visible,
  cleanup,
  databasePath,
}) {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-dev-tab-close-'))
  writeFileSync(join(root, 'README.md'), '# Dev tab close running\n')
  writeFileSync(join(root, '.gitignore'), '.orchestos/\n')
  run('git', ['init', '-q'], root)
  run('git', ['add', 'README.md', '.gitignore'], root)
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
    root,
  )
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', root], process.cwd())
  writeFileSync(
    join(root, 'tasks.yaml'),
    stringifyYaml({ version: 1, project: basename(root), tasks: [] }),
  )
  writeGateRoles(root)
  const configPath = join(root, 'orchestos.config.yaml')
  const config = parseYaml(readFileSync(configPath, 'utf8'))
  config.roles = Object.fromEntries(
    ['orchestrator', 'executor', 'reviewer', 'auxiliary'].map((role) => [
      role,
      { agent: 'claude', model: 'haiku', effort: 'low' },
    ]),
  )
  writeFileSync(configPath, stringifyYaml(config))
  const project = (await api('/api/projects')).data.find((item) => item.path === root)
  if (!project) throw new Error('Dev tab close fixture was not registered')
  const headers = { 'Content-Type': 'application/json', 'x-orchestos-project-id': project.id }
  const sessions = []
  const responses = []
  const path = (session) => `/api/chat/sessions/${encodeURIComponent(session.id)}`
  cleanup(async () => {
    for (const session of sessions) {
      const stopped = await api(`${path(session)}/stop`, {
        method: 'POST',
        headers,
        body: '{}',
      })
      if (!stopped.ok) throw new Error(`Cleanup stop failed: ${JSON.stringify(stopped)}`)
      await waitFor(
        () => !turns(databasePath, session.id).some((turn) => turn.status === 'pending'),
        15_000,
      )
    }
    await Promise.all(responses)
    const purged = await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, {
      method: 'POST',
    })
    if (!purged.ok) throw new Error(`Fixture purge failed: ${JSON.stringify(purged)}`)
    const remaining = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
    if (!remaining.ok || remaining.data.length)
      throw new Error('Fixture sessions remain after purge')
    for (const session of sessions) {
      if (turns(databasePath, session.id).length)
        throw new Error('Fixture turns remain after purge')
    }
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })
  for (const title of ['Close idle', 'Keep working', 'Stop working']) {
    const created = await api('/api/chat/sessions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ agent: 'claude', projectId: project.id, title }),
    })
    if (!created.ok || !created.data.id)
      throw new Error(`Create session: ${JSON.stringify(created)}`)
    sessions.push(created.data)
  }
  await page.evaluate(
    ({ projectId, ids }) => {
      localStorage.setItem('orchestos-chat', JSON.stringify({ closeRunningTab: 'ask' }))
      localStorage.setItem('orchestos-last-dev', JSON.stringify({ projectId, sessionId: ids[0] }))
      localStorage.setItem(
        'orchestos-dev-tabs',
        JSON.stringify({
          [projectId]: { tabs: ids.map((id) => ({ type: 'session', id })), activeId: ids[0] },
        }),
      )
    },
    { projectId: project.id, ids: sessions.map((session) => session.id) },
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.getByRole('button', { name: basename(root), exact: true }).click()
  await page.locator(`[data-thread-id="${sessions[0].id}"]`).waitFor()
  const tab = (session) => page.locator(`[data-session-tab="${session.id}"]`)
  const working = (session) =>
    page.locator(`[data-thread-id="${session.id}"]`).locator('..').locator('[aria-label="Working"]')
  const close = async (session) => {
    await tab(session).hover()
    await page.getByRole('button', { name: `Close tab ${session.title}`, exact: true }).click()
  }
  const dialog = page.getByRole('dialog', { name: 'Stop this agent?', exact: true })
  const [idle, keep, stop] = sessions
  await tab(idle).waitFor()
  await close(idle)
  await step(
    'Idle: X closes without a dialog',
    (await hidden(tab(idle))) &&
      (await page.getByRole('dialog').count()) === 0 &&
      turns(databasePath, idle.id).length === 0,
  )
  await shot('idle-closed')

  const start = async (session) => {
    await tab(session).click()
    await page.locator('button[title="Select model and reasoning effort"]').last().click()
    await page.getByRole('button', { name: /haiku/i }).first().click()
    await page.keyboard.press('Escape')
    await page
      .locator('textarea')
      .last()
      .fill(
        'Cuenta del 1 al 3000 en palabras, un número por línea, sin usar herramientas ni escribir archivos.',
      )
    const send = page.getByRole('button', { name: 'Send message', exact: true }).last()
    await waitFor(() => send.isEnabled())
    const request = page.waitForRequest(
      (req) => req.method() === 'POST' && new URL(req.url()).pathname === '/api/chat',
    )
    const response = page
      .waitForResponse(
        (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/chat',
        { timeout: 180_000 },
      )
      .then(async (res) => ({ ok: res.ok(), body: await res.json() }))
      .catch((error) => ({ error: String(error) }))
    responses.push(response)
    await send.click()
    const sent = (await request).postDataJSON()
    if (sent.sessionId !== session.id) throw new Error(`Wrong session: ${JSON.stringify(sent)}`)
    await waitFor(async () => {
      const timeline = await api(`${path(session)}/timeline`, { headers })
      return timeline.data?.pending && timeline.data.live?.text
    }, 180_000)
    await step(
      `${session.title}: real turn is pending with a visible tab spinner`,
      (await visible(tab(session).getByRole('img', { name: 'Running', exact: true }))) &&
        turns(databasePath, session.id).at(-1)?.status === 'pending',
      JSON.stringify(turns(databasePath, session.id)),
    )
    return { response }
  }

  const keepStarted = await start(keep)
  await close(keep)
  await step(
    'Working: X opens all three choices',
    (await visible(dialog)) &&
      (await visible(dialog.getByRole('button', { name: 'Cancel', exact: true }))) &&
      (await visible(dialog.getByRole('button', { name: 'Keep running', exact: true }))) &&
      (await visible(dialog.getByRole('button', { name: 'Stop and close', exact: true }))),
  )
  await shot('working-close-dialog')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await step(
    'Cancel: tab and turn remain',
    (await hidden(dialog)) &&
      (await visible(tab(keep))) &&
      turns(databasePath, keep.id).at(-1)?.status === 'pending',
  )
  await shot('cancel-keeps-tab')
  await close(keep)
  await dialog.getByRole('button', { name: 'Keep running', exact: true }).click()
  await step(
    'Keep running: tab closes, sidebar Working and pending DB turn remain',
    (await hidden(tab(keep))) &&
      (await hidden(dialog)) &&
      (await visible(working(keep))) &&
      turns(databasePath, keep.id).at(-1)?.status === 'pending',
    JSON.stringify(turns(databasePath, keep.id)),
  )
  await shot('keep-running-sidebar')
  const stoppedKeep = await api(`${path(keep)}/stop`, { method: 'POST', headers, body: '{}' })
  await waitFor(() => turns(databasePath, keep.id).at(-1)?.status === 'cancelled', 15_000)
  const keepResponse = await keepStarted.response
  await step(
    'Keep running: explicit API cleanup cancels the turn',
    stoppedKeep.ok && keepResponse.ok && keepResponse.body?.stopped === true,
  )

  const stopStarted = await start(stop)
  await close(stop)
  await dialog.waitFor()
  await shot('stop-and-close-dialog')
  const stoppedAt = Date.now()
  await dialog.getByRole('button', { name: 'Stop and close', exact: true }).click()
  await waitFor(
    () => turns(databasePath, stop.id).at(-1)?.status === 'cancelled',
    Math.max(1, 15_000 - (Date.now() - stoppedAt)),
  )
  const elapsed = Date.now() - stoppedAt
  const stopResponse = await stopStarted.response
  await step(
    'Stop and close: tab closes and DB turn is cancelled within 15 s',
    elapsed <= 15_000 &&
      (await hidden(tab(stop))) &&
      (await hidden(dialog)) &&
      stopResponse.ok &&
      stopResponse.body?.stopped === true,
    `elapsed=${elapsed} ms; turns=${JSON.stringify(turns(databasePath, stop.id))}`,
  )
  await step('Stop and close: sidebar no longer shows Working', await hidden(working(stop)))
  await shot('stopped-and-closed')

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByText('Loading live settings…', { exact: true }).waitFor({ state: 'hidden' })
  const settingsSidebar = page
    .locator('aside')
    .filter({ has: page.getByRole('button', { name: /^(Back to app|Volver a la app)$/ }) })
  await settingsSidebar.getByRole('button', { name: 'Chat', exact: true }).click()
  const row = page.locator('[data-settings-anchor="chat-close-running"]')
  await step(
    "Settings: Closing a working agent's tab offers Ask / Stop it / Keep running",
    (await visible(row.getByText("Closing a working agent's tab", { exact: true }))) &&
      (await visible(row.getByRole('radio', { name: 'Ask', exact: true }))) &&
      (await visible(row.getByRole('radio', { name: 'Stop it', exact: true }))) &&
      (await visible(row.getByRole('radio', { name: 'Keep running', exact: true }))),
  )
  await shot('settings-close-working-tab')
}
