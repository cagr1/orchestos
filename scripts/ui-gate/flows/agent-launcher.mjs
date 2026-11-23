import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run, writeGateRoles } from '../lib.mjs'

export default async function agentLauncher({ page, api, step, shot, cleanup, visible }) {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-agent-launcher-'))
  const previousTheme = await page.evaluate(() => localStorage.getItem('orchestos-theme'))
  let project
  const modesRoute = '**/api/system/executor-modes'
  const modesHandler = async (route) => {
    const response = await route.fetch()
    const data = await response.json()
    await route.fulfill({
      response,
      json: {
        ...data,
        modes: [
          ...data.modes,
          {
            id: 'gate-missing',
            label: 'Gate Missing',
            detected: false,
            session: 'terminal',
            path: null,
          },
        ],
      },
    })
  }
  cleanup(async () => {
    await page.unroute(modesRoute, modesHandler)
    await page.evaluate((theme) => {
      if (theme === null) localStorage.removeItem('orchestos-theme')
      else localStorage.setItem('orchestos-theme', theme)
    }, previousTheme)
    await page.reload({ waitUntil: 'domcontentloaded' })
    if (project) {
      const purged = await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, {
        method: 'POST',
      })
      if (!purged.ok) throw new Error(`purge failed: ${JSON.stringify(purged)}`)
      const remaining = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
      if (remaining.data.length) throw new Error('fixture sessions remain after purge')
    }
    rmSync(root, { recursive: true, force: true })
  })
  writeFileSync(join(root, 'README.md'), '# Agent launcher fixture\n')
  writeFileSync(join(root, '.gitignore'), '.orchestos/\n')
  run('git', ['init', '-q'], root)
  run('git', ['add', 'README.md', '.gitignore'], root)
  run(
    'git',
    ['-c', 'user.name=Gate', '-c', 'user.email=gate@example.test', 'commit', '-qm', 'fixture'],
    root,
  )
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', root], process.cwd())
  writeGateRoles(root)
  project = (await api('/api/projects')).data.find((item) => item.path === root)
  if (!project) throw new Error('fixture project missing')
  const seeded = await api('/api/chat/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-orchestos-project-id': project.id },
    body: JSON.stringify({ agent: 'claude', projectId: project.id, title: 'Launcher baseline' }),
  })
  if (!seeded.ok || !seeded.data.id) throw new Error(`create session: ${JSON.stringify(seeded)}`)
  await page.evaluate(
    ({ projectId, sessionId }) => {
      localStorage.setItem('orchestos-last-dev', JSON.stringify({ projectId, sessionId }))
      localStorage.setItem(`orchestos-dev-agent:${projectId}`, 'claude')
      localStorage.removeItem('orchestos-dev-tabs')
    },
    { projectId: project.id, sessionId: seeded.data.id },
  )
  await page.route(modesRoute, modesHandler)
  const tabs = page.locator('[data-dev-session-tabs]')
  const plus = page.getByRole('button', { name: 'New session', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Launch agent', exact: true })
  const search = dialog.getByRole('combobox', { name: 'Search agents', exact: true })
  const selected = dialog.locator('[role=option][aria-selected=true]')
  const enterDev = async () => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await tabs.waitFor()
  }
  const openLauncher = async (source) => {
    if (source === 'tabs') await plus.click()
    else {
      const projectButton = page.getByRole('button', { name: basename(root), exact: true })
      await projectButton.hover()
      await projectButton
        .locator('..')
        .getByRole('button', { name: 'Launch new agent', exact: true })
        .click()
    }
    await selected.waitFor()
    await dialog.getByRole('option', { name: 'Gate Missing', exact: true }).waitFor()
  }
  const sessionCount = async () =>
    (await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)).data.length
  await enterDev()
  await openLauncher('tabs')
  await step(
    'launcher focuses search on open',
    await search.evaluate((input) => document.activeElement === input),
  )
  await search.fill('cOdEx')
  await step(
    'search filters agents without case sensitivity',
    (await dialog.getByRole('option').count()) === 1 &&
      (await dialog.getByRole('option').first().getAttribute('aria-label')) === 'Codex',
    await dialog.innerText(),
  )
  await search.fill('')
  await selected.waitFor()
  const beforeTabs = await tabs.getByRole('tab').count()
  const beforeSessions = await sessionCount()
  const missing = dialog.getByRole('option', { name: 'Gate Missing', exact: true })
  // Exercise the component guard: Playwright normally refuses aria-disabled clicks.
  await missing.evaluate((row) => row.click())
  await step(
    'disabled agent ignores click without creating a tab or session',
    (await missing.getAttribute('aria-disabled')) === 'true' &&
      (await missing.innerText()).includes('Not installed') &&
      (await tabs.getByRole('tab').count()) === beforeTabs &&
      (await sessionCount()) === beforeSessions &&
      (await dialog.count()) === 1,
    await missing.innerText(),
  )
  await search.fill('gate-missing')
  await selected.waitFor({ state: 'detached' })
  await search.press('Enter')
  await step(
    'Enter cannot launch a disabled filtered agent',
    (await dialog.count()) === 1 &&
      (await tabs.getByRole('tab').count()) === beforeTabs &&
      (await sessionCount()) === beforeSessions,
  )
  await search.fill('')
  await selected.waitFor()
  const ready = await dialog
    .locator('[role=option][aria-disabled=false]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label')))
  for (const [key, delta] of [
    ['ArrowDown', 1],
    ['ArrowUp', -1],
  ]) {
    let index = 0
    for (let count = 0; count < ready.length; count++) {
      index = (index + delta + ready.length) % ready.length
      await search.press(key)
      await dialog.getByRole('option', { name: ready[index], exact: true }).and(selected).waitFor()
      await step(
        `${key} skips disabled agents and wraps: ${count + 1}`,
        (await selected.getAttribute('aria-label')) === ready[index] &&
          (await missing.getAttribute('aria-selected')) === 'false',
        ready[index],
      )
    }
  }
  await shot('new-session-agent-menu')
  await search.press('Escape')
  await step(
    'Escape closes launcher without creating and restores opener focus',
    (await dialog.count()) === 0 &&
      (await tabs.getByRole('tab').count()) === beforeTabs &&
      (await sessionCount()) === beforeSessions &&
      (await plus.evaluate((button) => document.activeElement === button)),
  )
  await openLauncher('tabs')
  const activeAgent = await selected.getAttribute('aria-label')
  await search.press('Enter')
  const fresh = page.locator('[data-dev-new-session]')
  await tabs.locator('[data-new-session-tab][aria-selected=true]').waitFor()
  await fresh.locator('textarea').waitFor()
  await fresh.locator(`textarea[placeholder^="Message ${activeAgent}"]`).waitFor()
  await step(
    'Enter opens active New session for the selected agent',
    (await tabs.getByRole('tab').count()) === beforeTabs + 1 &&
      (await fresh.locator('textarea').getAttribute('placeholder')).includes(
        `Message ${activeAgent}`,
      ) &&
      (await sessionCount()) === beforeSessions,
    activeAgent,
  )
  await openLauncher('sidebar')
  const [created] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/chat/sessions',
    ),
    selected.click(),
  ])
  if (!created.ok()) throw new Error(`sidebar launch failed: HTTP ${created.status()}`)
  const session = await created.json()
  const activeTab = tabs.locator(`[data-session-tab="${session.id}"][aria-selected=true]`)
  await activeTab.waitFor()
  await step(
    'sidebar click creates a project session and activates its tab',
    session.projectId === project.id &&
      created.status() >= 200 &&
      created.status() < 300 &&
      (await visible(activeTab)) &&
      (await dialog.count()) === 0,
    JSON.stringify(session),
  )
  for (const theme of ['orchestos', 'light']) {
    await page.evaluate((theme) => localStorage.setItem('orchestos-theme', theme), theme)
    await enterDev()
    for (const source of ['tabs', 'sidebar']) {
      await openLauncher(source)
      const colors = await dialog.evaluate((element) => {
        const probe = document.createElement('span')
        probe.style.backgroundColor = 'var(--app-surface)'
        element.appendChild(probe)
        const expected = getComputedStyle(probe).backgroundColor
        probe.remove()
        return {
          actual: getComputedStyle(element).backgroundColor,
          expected,
          theme: document.documentElement.getAttribute('data-theme'),
        }
      })
      await step(
        `launcher uses surface token: ${theme} ${source}`,
        colors.theme === theme &&
          colors.actual === colors.expected &&
          colors.actual !== 'rgba(0, 0, 0, 0)',
        JSON.stringify(colors),
      )
      await shot(`agent-launcher-${theme}-${source}`)
      await dialog.getByRole('button', { name: 'Agent settings…', exact: true }).click()
      const providers = page.getByRole('heading', { name: 'Providers', exact: true })
      await providers.waitFor()
      await step(
        `agent settings opens Providers from ${source} in ${theme}`,
        (await dialog.count()) === 0 && (await visible(providers)),
      )
      await page.getByRole('button', { name: 'Back to app', exact: true }).click()
      await tabs.waitFor()
    }
  }
}
