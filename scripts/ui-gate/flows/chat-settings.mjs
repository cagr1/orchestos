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

export default async function chatSettings({ page, api, step, shot, visible, hidden, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-chat-settings-'))
  writeFileSync(join(projectRoot, 'README.md'), '# Chat settings\n')
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
  if (!project) throw new Error('Chat settings fixture was not registered')
  cleanup(async () => {
    const purged = await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, {
      method: 'POST',
    })
    if (!purged.ok) throw new Error(`Chat settings fixture purge failed: ${purged.status}`)
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })
  const headers = { 'x-orchestos-project-id': project.id }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectRow = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await projectRow.click()

  const settings = async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByText('Loading live settings…', { exact: true }).waitFor({ state: 'hidden' })
    const sidebar = page
      .locator('aside')
      .filter({ has: page.getByRole('button', { name: /^(Back to app|Volver a la app)$/ }) })
    await sidebar.getByRole('button', { name: 'Chat', exact: true }).click()
  }
  const back = async () =>
    page.getByRole('button', { name: /^(Back to app|Volver a la app)$/ }).click()
  await settings()
  await step(
    'Settings Chat shows its four rows',
    (await page.locator('[data-settings-page] [data-settings-row]').count()) === 4,
  )
  const modLabel = await page.evaluate(() =>
    /Mac/.test(navigator.platform) ? '⌘ Enter' : 'Ctrl Enter',
  )
  const modKey = modLabel === '⌘ Enter' ? 'Meta+Enter' : 'Control+Enter'
  await page.getByRole('radio', { name: modLabel, exact: true }).click()
  await shot('settings-chat')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await step(
    'send key persists after reload',
    (await page.evaluate(() => JSON.parse(localStorage.getItem('orchestos-chat')).sendKey)) ===
      'mod-enter',
  )
  await settings()
  await back()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  const create = async () => {
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
  }
  await create()
  const composer = page.locator('textarea').last()
  const posts = []
  const responses = []
  let active = 0
  let concurrent = false
  const onRequest = (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/chat') {
      concurrent ||= active > 0
      active++
      posts.push(request.postDataJSON())
    }
  }
  const onResponse = async (response) => {
    if (
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat'
    ) {
      await response.finished()
      responses.push({ ok: response.ok(), status: response.status(), body: await response.json() })
      active--
    }
  }
  page.on('request', onRequest)
  page.on('response', onResponse)
  cleanup(() => {
    page.off('request', onRequest)
    page.off('response', onResponse)
  })
  await composer.fill('Responde únicamente: primero')
  await composer.press('Enter')
  await step(
    'Enter inserts newline in modifier mode without POST',
    (await composer.inputValue()).endsWith('\n') && posts.length === 0,
  )
  await composer.press(modKey)
  await waitFor(() => responses.length === 1)
  await step('modifier Enter sends', posts.length === 1 && responses[0].ok)
  const sessionId = posts[0].sessionId
  const timelinePath = `/api/chat/sessions/${encodeURIComponent(sessionId)}/timeline`
  const long =
    'Cuenta del 1 al 300 en palabras, un número por línea, sin usar herramientas ni escribir archivos.'
  const startLong = async () => {
    const count = posts.length
    await composer.fill(long)
    await waitFor(
      async () =>
        page.getByRole('button', { name: 'Send message', exact: true }).last().isEnabled(),
      30_000,
    )
    await composer.press(modKey)
    await waitFor(
      async () => posts.length > count && (await api(timelinePath, { headers })).data?.pending,
    )
    await page
      .getByRole('button', { name: 'Stop response', exact: true })
      .waitFor({ state: 'visible' })
  }
  await startLong()
  await composer.fill('Responde únicamente: encolado')
  await composer.press(modKey)
  await page.locator('[data-queued-message]').waitFor()
  await composer.fill('Responde únicamente: segundo encolado')
  await composer.press(modKey)
  await composer.fill('Este mensaje se elimina de la cola')
  await composer.press(modKey)
  await step(
    'busy sends queue locally and clear the textarea',
    posts.length === 2 &&
      (await page.locator('[data-queued-message]').count()) === 3 &&
      (await composer.inputValue()) === '',
  )
  await page.getByRole('button', { name: 'Remove queued message', exact: true }).last().click()
  await shot('queued-message')
  await waitFor(() => responses.length >= 4 || responses.some((item) => !item.ok))
  await step(
    'two retained queue messages send in order after each preceding turn, without 409',
    posts.length === 4 &&
      responses.length === 4 &&
      !concurrent &&
      responses.every((item) => item.ok),
    JSON.stringify({
      posts,
      responses: responses.map(({ ok, status }) => ({ ok, status })),
      concurrent,
    }),
  )
  await step(
    'queued message used its original thread',
    posts[2]?.sessionId === sessionId &&
      posts[2]?.message.includes('encolado') &&
      posts[3]?.sessionId === sessionId &&
      posts[3]?.message.includes('segundo encolado'),
  )
  await step(
    'both queued user bubbles appear',
    (await visible(page.getByText('Responde únicamente: encolado', { exact: true }))) &&
      (await visible(page.getByText('Responde únicamente: segundo encolado', { exact: true }))),
  )
  await settings()
  await page.getByRole('radio', { name: 'Stop and send', exact: true }).click()
  await back()
  await page.locator('button[title="Select model and reasoning effort"]').last().click()
  await page.getByRole('button', { name: /haiku/i }).first().click()
  await page.keyboard.press('Escape')
  await startLong()
  const stop = page.waitForRequest(
    (request) => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/stop'),
  )
  await composer.fill('Responde únicamente: después de detener')
  await composer.press(modKey)
  await stop
  await waitFor(() => responses.length === 6)
  await step(
    'Stop and send stops first turn then sends the queue',
    responses[4].body.stopped === true && responses[5].ok && posts.length === 6 && !concurrent,
  )
  await page.getByRole('button', { name: 'Delete chat', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Delete this chat?', exact: true })
  await dialog.waitFor()
  await step(
    'confirmation initially focuses Cancel',
    await dialog
      .getByRole('button', { name: 'Cancel', exact: true })
      .evaluate((element) => element === document.activeElement),
  )
  await shot('delete-confirmation')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await step(
    'Cancel preserves chat',
    (await api(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`, { headers })).ok,
  )
  await page.getByRole('button', { name: 'Delete chat', exact: true }).first().click()
  await dialog.getByRole('checkbox', { name: "Don't ask again", exact: true }).check()
  const deletion = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      new URL(response.url()).pathname.endsWith(sessionId),
  )
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await step('Delete confirms mutation', (await deletion).ok())
  await settings()
  await page.getByRole('radio', { name: 'Queue message', exact: true }).click()
  await back()
  await create()
  const newStart = posts.length
  await composer.fill(long)
  await composer.press(modKey)
  await page.getByRole('button', { name: 'Stop response', exact: true }).waitFor()
  await composer.fill('Responde únicamente: encolado en hilo nuevo')
  await composer.press(modKey)
  await step(
    'new thread keeps its queued message visible',
    await visible(
      page.locator('[data-queued-message]').filter({ hasText: 'encolado en hilo nuevo' }),
    ),
  )
  await shot('new-thread-queued-message')
  await waitFor(() => responses.length >= newStart + 2 || responses.some((item) => !item.ok))
  await step(
    'new thread drains into the same session after its first turn',
    posts.length === newStart + 2 &&
      responses.length === newStart + 2 &&
      posts[newStart]?.sessionId === posts[newStart + 1]?.sessionId &&
      posts[newStart + 1]?.message.includes('encolado en hilo nuevo') &&
      responses.every((item) => item.ok) &&
      !concurrent,
    JSON.stringify({
      posts: posts.slice(newStart),
      responses: responses.slice(newStart).map(({ ok, status }) => ({ ok, status })),
      concurrent,
    }),
  )
  await step(
    'new thread queued user bubble appears',
    await visible(page.getByText('Responde únicamente: encolado en hilo nuevo', { exact: true })),
  )
  await shot('new-thread-queue-completed')
  const deletion2 = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      new URL(response.url()).pathname.includes('/api/chat/sessions/'),
  )
  await page.getByRole('button', { name: 'Delete chat', exact: true }).first().click()
  await step(
    "Don't ask again skips the next confirmation",
    (await deletion2).ok() && (await dialog.count()) === 0,
  )
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await projectRow.hover()
  await page.getByRole('button', { name: 'Launch new agent', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Claude/ })
    .first()
    .click()
  await page.getByRole('dialog').getByRole('button', { name: 'Launch Agent', exact: true }).click()
  await projectRow.hover()
  const expand = page.getByRole('button', { name: 'Expand agents', exact: true })
  if (await expand.isVisible()) await expand.click()
  const close = page.getByRole('button', { name: 'Close agent', exact: true }).last()
  await page.locator('[data-thread-id]').last().locator('..').hover()
  await close.click()
  const archive = page.getByRole('dialog', { name: 'Archive this agent?', exact: true })
  await step(
    'Close agent asks before archiving',
    (await visible(archive)) &&
      (await visible(
        archive.getByText('It moves to History; you can restore it.', { exact: true }),
      )),
  )
  await archive.press('Escape')
  await step('Escape cancels archive', await hidden(archive))
  await page.locator('[data-thread-id]').last().locator('..').hover()
  await close.click()
  const archived = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/archive'),
  )
  await page.getByRole('dialog').press('Enter')
  await step('Enter confirms archive', (await archived).ok())
}
