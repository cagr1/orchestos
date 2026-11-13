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
    const turns = db.query('SELECT id, request_key, user_content, has_attachments, status FROM chat_turns WHERE session_id = ? ORDER BY created_at').all(id)
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

export default async function chatRestartInterrupted({
  page,
  api,
  step,
  shot,
  visible,
  cleanup,
  databasePath,
  restartDashboard,
}) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-chat-restart-'))
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

  await projectRow.hover()
  await page.getByRole('button', { name: 'Launch new agent', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('button', { name: /Claude/ })
    .first()
    .click()
  await dialog.getByRole('button', { name: 'Launch Agent', exact: true }).click()
  await page.locator('button[title="Select model and reasoning effort"]').last().click()
  await page.getByRole('button', { name: /haiku/i }).first().click()
  await page.keyboard.press('Escape')
  const message =
    'Cuenta del 1 al 1000 en palabras, un número por línea, sin usar herramientas ni escribir archivos.'
  const first = await send(page, message)
  void first.response.catch(() => null)
  const path = `/api/chat/sessions/${encodeURIComponent(first.sessionId)}`
  const live = await waitFor(async () => {
    const state = (await api(`${path}/timeline`, { headers })).data
    return state?.pending && state.live?.text ? state : null
  })
  const before = sessionState(databasePath, first.sessionId).turns.at(-1)
  await step(
    'real turn is pending with streamed text',
    before.status === 'pending' && Boolean(live.live.text),
    JSON.stringify(before),
  )
  const started = Date.now()
  await restartDashboard()
  const after = sessionState(databasePath, first.sessionId).turns.at(-1)
  await step(
    'SIGTERM marks the turn interrupted without waiting for lease expiry',
    after.status === 'interrupted' && Date.now() - started < 150_000,
    JSON.stringify({ after, elapsed: Date.now() - started }),
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  const notice = page.getByText('The last turn was interrupted.', { exact: true })
  const resume = page.getByRole('button', { name: 'Resume', exact: true })
  await step(
    'thread shows interruption and Resume',
    (await visible(notice)) && (await visible(resume)),
    first.sessionId,
  )
  await shot('chat-restart-interrupted')
  await step(
    'restart never resends automatically',
    sessionState(databasePath, first.sessionId).turns.length === 1,
    JSON.stringify(sessionState(databasePath, first.sessionId)),
  )
  const request = page.waitForRequest(
    (req) => req.method() === 'POST' && new URL(req.url()).pathname === '/api/chat',
  )
  const response = page.waitForResponse(
    (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/chat',
    { timeout: 180_000 },
  )
  await resume.click()
  const sent = (await request).postDataJSON()
  await waitFor(async () => sessionState(databasePath, first.sessionId).turns.length === 2)
  const resumed = sessionState(databasePath, first.sessionId).turns.at(-1)
  await step(
    'Resume sends original text with a new request key and turn',
    sent.message === message &&
      sent.requestKey !== before.request_key &&
      resumed.id !== before.id &&
      resumed.user_content === message,
    JSON.stringify({ sent, resumed }),
  )
  await api(`${path}/stop`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ turnId: resumed.id }),
  })
  const finished = await response
  await step(
    'resumed POST settles after Stop',
    finished.ok(),
    JSON.stringify(await finished.json()),
  )
  await shot('chat-restart-resumed')
}
