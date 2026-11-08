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

export default async function notifications({
  page,
  api,
  step,
  shot,
  visible,
  hidden,
  cleanup,
  note,
}) {
  await page.addInitScript(() => {
    window.__attention = { calls: [], tones: [], instances: [], focused: false }
    document.hasFocus = () => window.__attention.focused
    class FakeNotification {
      static permission = 'default'
      static async requestPermission() {
        this.permission = 'granted'
        return 'granted'
      }
      constructor(title, options) {
        window.__attention.calls.push({ title, ...options })
        window.__attention.instances.push(this)
      }
      close() {}
    }
    window.Notification = FakeNotification
    window.AudioContext = class {
      currentTime = 0
      destination = {}
      async resume() {}
      createOscillator() {
        return {
          frequency: {},
          connect() {},
          disconnect() {},
          start() {
            window.__attention.tones.push('tone')
          },
          stop() {},
        }
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
          disconnect() {},
        }
      }
    }
  })
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-notifications-'))
  writeFileSync(join(projectRoot, 'README.md'), '# Notifications\n')
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
  if (!project) throw new Error('Notifications fixture was not registered')
  cleanup(async () => {
    const purged = await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, {
      method: 'POST',
    })
    if (!purged.ok) throw new Error(`Notifications fixture purge failed: ${purged.status}`)
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })
  const headers = { 'x-orchestos-project-id': project.id }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectRow = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await projectRow.click()

  const settings = async () => {
    note('opening notifications settings')
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByText('Loading live settings…', { exact: true }).waitFor({ state: 'hidden' })
    const sidebar = page
      .locator('aside')
      .filter({ has: page.getByRole('button', { name: /^(Back to app|Volver a la app)$/ }) })
    await sidebar.getByRole('button', { name: 'Notifications', exact: true }).click()
  }
  const back = async () =>
    page.getByRole('button', { name: /^(Back to app|Volver a la app)$/ }).click()
  await settings()
  await step(
    'Notifications exposes three switches and permission',
    (await page.getByRole('switch').count()) === 3 &&
      (await visible(page.getByRole('button', { name: 'Allow notifications', exact: true }))),
  )
  await page.getByRole('button', { name: 'Allow notifications', exact: true }).click()
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await waitFor(() => page.evaluate(() => window.__attention.tones.length === 1))
  await step(
    'permission request and Test exercise browser notification and audio',
    await page.evaluate(
      () => Notification.permission === 'granted' && window.__attention.calls.length === 1,
    ),
  )
  await shot('notifications-settings')
  await back()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const option = dialog.getByRole('button', { name: basename(projectRoot), exact: true })
  if (await option.isVisible()) await option.click()
  await dialog
    .getByRole('button', { name: /Claude/ })
    .first()
    .click()
  await dialog.getByRole('button', { name: 'Start Chat', exact: true }).click()
  await page.locator('button[title="Select model and reasoning effort"]').last().click()
  await page.getByRole('button', { name: /haiku/i }).first().click()
  await page.keyboard.press('Escape')
  const composer = page.locator('textarea').last()
  const reset = async (focused) =>
    page.evaluate((focused) => {
      window.__attention.focused = focused
      window.__attention.calls = []
      window.__attention.tones = []
    }, focused)
  let sessionId
  const turn = async () => {
    note('sending chat turn')
    await page.locator('button[title="Select model and reasoning effort"]').last().click()
    await page.getByRole('button', { name: /haiku/i }).first().click()
    await page.keyboard.press('Escape')
    const response = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/chat',
      { timeout: 180_000 },
    )
    await page.getByRole('button', { name: 'Send message', exact: true }).waitFor()
    await composer.fill('Responde únicamente: listo')
    await waitFor(
      () => page.getByRole('button', { name: 'Send message', exact: true }).isEnabled(),
      30_000,
    )
    await page.getByRole('button', { name: 'Send message', exact: true }).click()
    const finished = await response
    await finished.finished()
    note('chat response finished', String(finished.status()))
    sessionId = finished.request().postDataJSON().sessionId
    if (!finished.ok()) throw new Error(`Chat failed: ${finished.status()}`)
    await page.getByRole('button', { name: 'Send message', exact: true }).waitFor()
  }
  await reset(false)
  await turn()
  await waitFor(() =>
    page.evaluate(
      () => window.__attention.calls.length === 1 && window.__attention.tones.length === 1,
    ),
  )
  const session = (await api('/api/chat/sessions', { headers })).data.find(
    (item) => item.id === sessionId,
  )
  await step(
    'real background chat emits exactly one notification and tone with the thread title',
    await page.evaluate(
      (title) =>
        window.__attention.calls.length === 1 &&
        window.__attention.calls[0].title === title &&
        window.__attention.calls[0].body === 'Finished' &&
        window.__attention.tones.length === 1,
      session.title,
    ),
  )
  await reset(true)
  await turn()
  await page.waitForTimeout(700)
  await step(
    'focused chat emits neither notification nor sound',
    await page.evaluate(
      () => window.__attention.calls.length === 0 && window.__attention.tones.length === 0,
    ),
  )
  await settings()
  await page.getByRole('switch', { name: 'When an agent finishes', exact: true }).uncheck()
  await back()
  await reset(false)
  await turn()
  await page.waitForTimeout(700)
  await step(
    'disabled completion type suppresses both channels',
    await page.evaluate(
      () => window.__attention.calls.length === 0 && window.__attention.tones.length === 0,
    ),
  )
  await settings()
  await page.getByRole('switch', { name: 'When an agent finishes', exact: true }).check()
  await back()
  // Seed a pending approval in the existing task/approval read contracts. Chat turns above are real.
  let pending = false
  await page.route('**/api/tasks**', async (route) => {
    const response = await route.fetch()
    const data = await response.json()
    if (pending && Array.isArray(data.tasks))
      data.tasks.push({
        id: 'notification-approval',
        description: 'Notification approval',
        status: 'running',
        runId: 'notification-run',
        sessionId,
        pendingApprovals: 1,
        output: [],
        depends_on: [],
        acceptance_criteria: [],
        retryCount: 0,
        engine: 'agentic',
      })
    await route.fulfill({ response, json: data })
  })
  await page.route('**/api/runs/notification-run/approval', (route) =>
    route.fulfill({
      json: {
        pending: [
          {
            runId: 'notification-run',
            approvalId: 'approval-1',
            kind: 'command',
            detail: { command: 'echo approved' },
          },
        ],
      },
    }),
  )
  await reset(false)
  // Reload task data through normal project selection, then let the existing polling take over.
  pending = true
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await waitFor(() =>
    page.evaluate(() =>
      window.__attention.calls.some((call) => call.body === 'Needs your approval'),
    ),
  )
  await page.waitForTimeout(1500)
  await step(
    'pending approval emits once with two tones',
    await page.evaluate(
      () => window.__attention.calls.length === 1 && window.__attention.tones.length === 2,
    ),
  )
  await settings()
  await page.evaluate(() => window.__attention.instances.at(-1).onclick())
  await step(
    'notification click opens its original Chat thread',
    (await hidden(page.getByRole('heading', { name: 'Notifications', exact: true }))) &&
      (await visible(page.locator('[data-thread-root]'))) &&
      (await hidden(page.getByRole('tablist', { name: 'Open Dev tabs' }))) &&
      (await page
        .locator(`[data-thread-id="${sessionId}"]`)
        .evaluate((element) => element.classList.contains('text-app'))) &&
      (await visible(page.getByText('Responde únicamente: listo', { exact: true }).first())),
  )
  pending = false
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await projectRow.hover()
  await page.getByRole('button', { name: 'Launch new agent', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Claude/ })
    .first()
    .click()
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat/sessions',
  )
  await page.getByRole('dialog').getByRole('button', { name: 'Launch Agent', exact: true }).click()
  const devSession = await (await created).json()
  sessionId = devSession.id
  const devTab = page.locator(`[data-session-tab="${sessionId}"]`)
  await devTab.waitFor()
  // Creation opens the tab before refreshing project agents; wait for the workspace too.
  await page.locator('textarea').last().waitFor()
  await step(
    'agent has an open Dev tab before notification',
    (await devTab.getAttribute('aria-selected')) === 'true',
  )
  await reset(false)
  pending = true
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await waitFor(() =>
    page.evaluate(() =>
      window.__attention.calls.some((call) => call.body === 'Needs your approval'),
    ),
  )
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await step(
    'Dev notification is clicked from Chat mode',
    await visible(page.getByPlaceholder('Search chats', { exact: true })),
  )
  await page.evaluate(() => window.__attention.instances.at(-1).onclick())
  await waitFor(async () => (await devTab.getAttribute('aria-selected')) === 'true')
  await step(
    'notification click opens its original Dev tab in Dev mode',
    (await visible(page.getByRole('tablist', { name: 'Open Dev tabs' }))) &&
      (await devTab.getAttribute('aria-selected')) === 'true' &&
      (await hidden(page.locator('[data-thread-root]'))) &&
      (await hidden(page.getByRole('heading', { name: 'Notifications', exact: true }))),
  )
  await page.evaluate(() => {
    const pre = document.createElement('pre')
    Object.assign(pre.style, {
      position: 'fixed',
      inset: '80px 24px auto auto',
      zIndex: '9999',
      background: '#fff',
      color: '#111',
      padding: '24px',
    })
    pre.textContent = JSON.stringify(
      { calls: window.__attention.calls, tones: window.__attention.tones },
      null,
      2,
    )
    document.body.append(pre)
  })
  await shot('notifications-calls')
  pending = false
  await page.unroute('**/api/tasks**')
  await page.unroute('**/api/runs/notification-run/approval')
}
