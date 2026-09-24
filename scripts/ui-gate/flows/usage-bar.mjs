import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

async function waitForRequest(requests, predicate, timeout = 15_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (requests.some(predicate)) return true
    await delay(100)
  }
  return false
}

async function waitForRequestAfter(requests, after, predicate, timeout = 5_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const match = requests.find(
      (entry) =>
        entry.observedAt > after && entry.observedAt <= deadline && predicate(entry.request),
    )
    if (match) return match
    await delay(100)
  }
  return null
}

export default async function usageBar({ page, api, step, visible, cleanup, statuslineHome }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-13-5-'))
  writeFileSync(join(projectRoot, 'README.md'), '# UI.13.5\n')
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
  const projectList = await api('/api/projects')
  const project = (projectList.data ?? []).find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}`, { method: 'DELETE' })
    rmSync(projectRoot, { recursive: true, force: true })
    const projectsAfter = await api('/api/projects')
    await step(
      'no temporary UI projects remain after cleanup',
      !(projectsAfter.data ?? []).some((item) => item.path?.includes('/orchestos-ui-')),
      'temporary projects are cleaned after the flow',
    )
  })

  const statuslineDirectory = join(statuslineHome, 'claude-statusline')
  mkdirSync(statuslineDirectory, { recursive: true })
  const reset = Math.floor(Date.now() / 1000) + 3600
  const writeStatusline = (session, used) =>
    writeFileSync(
      join(statuslineDirectory, `${session}.json`),
      JSON.stringify({ rate_limits: { five_hour: { used_percentage: used, resets_at: reset } } }),
    )
  writeStatusline('old-session', 33)
  writeStatusline('new-session', 39)

  const requests = []
  page.on('request', (request) => {
    if (request.url().includes('/api/session/status'))
      requests.push({ request, observedAt: Date.now() })
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step('temporary project is visible', await visible(projectButton), 'project in sidebar')
  if (await projectButton.isVisible()) await projectButton.click()
  const loaded = await waitForRequest(requests, () => true)
  await delay(3_000)
  const initialRequest = requests[0]?.request
  const initialHeaders = initialRequest?.headers() ?? {}
  await step(
    'one status request carries project id',
    loaded && requests.length === 1 && initialHeaders['x-orchestos-project-id'] === project.id,
    `requests=${requests.length}, header=${initialHeaders['x-orchestos-project-id'] ?? 'missing'}, expected=${project.id}`,
  )
  await step(
    'Claude quota uses newest session reading',
    await visible(page.getByText('61%', { exact: true })),
    '61% remaining in status bar',
  )
  const codexQuota = page.locator('button[title^="Codex:"]')
  const codexTitleBeforeTurn = await codexQuota.getAttribute('title')
  await step(
    'Codex account quota is visible without a project session',
    /^Codex: \d+% 5-hour quota remaining$/.test(codexTitleBeforeTurn ?? ''),
    codexTitleBeforeTurn ?? 'Codex button title missing',
  )

  const cacheHeaders = await page.evaluate(async () => {
    const [shell, bundle] = await Promise.all([fetch('/'), fetch('/app/dist/main.js')])
    return {
      shell: shell.headers.get('cache-control'),
      bundle: bundle.headers.get('cache-control'),
    }
  })
  await step(
    'app shell and bundle disable browser caching',
    cacheHeaders.shell?.includes('no-cache') === true &&
      cacheHeaders.bundle?.includes('no-cache') === true,
    `shell=${cacheHeaders.shell ?? 'missing'}, bundle=${cacheHeaders.bundle ?? 'missing'}`,
  )

  const refreshButton = page.getByRole('button', { name: 'Refresh usage', exact: true })
  const quota67 = page.getByText('67%', { exact: true }).first()
  const manualResponsePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes('/api/session/status') && response.request().method() === 'GET',
    )
    .catch(() => null)
  await refreshButton.click()
  const manualResponse = await manualResponsePromise
  let saw67DuringRefresh = false
  let saw61DuringRefresh = false
  const manualRefreshDeadline = Date.now() + 2_000
  while (Date.now() < manualRefreshDeadline) {
    if (await quota67.isVisible().catch(() => false)) saw67DuringRefresh = true
    if (
      await page
        .getByText('61%', { exact: true })
        .isVisible()
        .catch(() => false)
    )
      saw61DuringRefresh = true
    await delay(100)
  }
  await step(
    'manual usage refresh keeps the newest Claude quota',
    Boolean(manualResponse) && saw61DuringRefresh && !saw67DuringRefresh,
    `response=${Boolean(manualResponse)}, saw61=${saw61DuringRefresh}, saw67=${saw67DuringRefresh}`,
  )

  const requestsBeforeTurn = requests.length
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const codex = dialog.getByRole('button', { name: /Codex/ }).first()
  await step('Codex chat option visible', await visible(codex), 'Codex option')
  if (!(await codex.isVisible())) return
  await codex.click()
  await page.getByRole('button', { name: 'Start Chat', exact: true }).click()
  const modelControl = page.locator('button[title="Select model and reasoning effort"]')
  await modelControl.click()
  const model = page.getByRole('button', { name: /gpt-5\.6-luna/i }).first()
  await step('Luna model visible', await visible(model), 'gpt-5.6-luna')
  if (!(await model.isVisible())) return
  await model.click()
  await modelControl.click()
  const medium = page.getByRole('button', { name: /^medium$/i }).first()
  await step('medium effort visible', await visible(medium), 'medium')
  if (!(await medium.isVisible())) return
  await medium.click()
  await page.locator('textarea').last().fill('Responde únicamente: usage-bar-ok')
  const chatResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/chat') && response.request().method() === 'POST',
    { timeout: 180_000 },
  )
  await page.locator('textarea').last().press('Enter')
  const assistantResponse = page.getByText('usage-bar-ok', { exact: true }).last()
  const chatResponse = await chatResponsePromise
  const turnResponseAt = Date.now()
  const [turnFinished, refreshedAfterTurn] = await Promise.all([
    visible(assistantResponse, 5_000),
    waitForRequestAfter(requests, turnResponseAt, () => true, 5_000),
  ])
  await step(
    'usage refreshes after a real turn',
    Boolean(chatResponse) &&
      turnFinished &&
      Boolean(refreshedAfterTurn) &&
      refreshedAfterTurn.observedAt > turnResponseAt &&
      refreshedAfterTurn.observedAt <= turnResponseAt + 5_000 &&
      requests.length > requestsBeforeTurn,
    `chatResponse=${Boolean(chatResponse)}, usage-bar-ok=${turnFinished}, refresh=${Boolean(refreshedAfterTurn)}, requests before=${requestsBeforeTurn}, after=${requests.length}, requestTimes=${requests.map((entry) => entry.observedAt).join(',')}, responseAt=${turnResponseAt}`,
  )

  const codexTitleAfterTurn = await codexQuota.getAttribute('title')
  await step(
    'Codex account quota remains visible after a real turn',
    /^Codex: \d+% 5-hour quota remaining$/.test(codexTitleAfterTurn ?? ''),
    codexTitleAfterTurn ?? 'Codex button title missing after turn',
  )

  rmSync(statuslineDirectory, { recursive: true, force: true })
  mkdirSync(statuslineDirectory, { recursive: true })
  writeFileSync(
    join(statuslineDirectory, 'expired-session.json'),
    JSON.stringify({ rate_limits: { five_hour: { used_percentage: 80, resets_at: 1 } } }),
  )
  await delay(10_500)
  const expiredRefresh = page.waitForResponse(
    (response) =>
      response.url().includes('/api/session/status') && response.request().method() === 'GET',
    { timeout: 5_000 },
  )
  await refreshButton.click()
  await expiredRefresh
  await delay(4_000)
  const expiredRefreshAgain = page.waitForResponse(
    (response) =>
      response.url().includes('/api/session/status') && response.request().method() === 'GET',
    { timeout: 5_000 },
  )
  await refreshButton.click()
  await expiredRefreshAgain
  const expiredClaudeTitle = await page.locator('button[title^="Claude"]').getAttribute('title')
  await step(
    'an expired Claude window is shown as fully available',
    /100% 5-hour quota remaining$/.test(expiredClaudeTitle ?? ''),
    expiredClaudeTitle ?? 'Claude button title missing after expired reset',
  )
}
