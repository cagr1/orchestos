import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run } from '../lib.mjs'

export default async function settingsShell({ page, api, step, shot, cleanup, expectHttpError }) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'orchestos-ui-settings-shell-')))
  writeFileSync(join(root, 'README.md'), '# Settings shell gate\n')
  run('git', ['init', '-q'], root)
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', root], process.cwd())
  const project = ((await api('/api/projects')).data ?? []).find((item) => item.path === root)
  if (!project) throw new Error(`project not registered: ${root}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(root, { recursive: true, force: true })
  })
  const headers = { 'x-orchestos-project-id': project.id }
  const open = async () => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await page.getByRole('button', { name: basename(root), exact: true }).click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByText('Loading live settings…', { exact: true }).waitFor({ state: 'hidden' })
  }
  await open()
  const sidebar = page
    .locator('aside')
    .filter({ has: page.getByRole('button', { name: 'Back to app', exact: true }) })
  for (const group of ['App', 'Agents', 'Observe', 'Protect', 'Projects']) {
    await step(
      `navigation group ${group}`,
      (await sidebar.getByText(group, { exact: true }).count()) === 1,
    )
  }
  for (const section of [
    'General',
    'Appearance',
    'Keybindings',
    'Language',
    'Providers',
    'Model routing',
    'Executor',
    'API keys',
    'Health',
    'Usage',
    'Danger zone',
  ]) {
    const button = sidebar.getByRole('button', { name: section, exact: true })
    await button.click()
    await step(
      `${section} has an icon and title only`,
      (await button.locator('svg').count()) === 1 &&
        (await page.locator('main [data-page-header] h1').count()) === 1 &&
        (await page.locator('main [data-page-header] > p').count()) === 0,
    )
  }
  await sidebar.getByRole('button', { name: 'Executor', exact: true }).click()
  const before = (await api('/api/config', { headers })).data.externalTimeoutMinutes
  const row = page.locator('[data-settings-anchor="executor-timeout"]')
  const increase = row.getByRole('button', { name: 'Increase timeout', exact: true })
  const [saved] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith('/api/config') && res.request().method() === 'PUT',
    ),
    increase.click(),
  ])
  await page.locator('[data-settings-saving]').waitFor({ state: 'hidden' })
  await step(
    'timeout saves immediately',
    saved.ok() &&
      (await api('/api/config', { headers })).data.externalTimeoutMinutes === before + 5,
  )
  await open()
  await sidebar.getByRole('button', { name: 'Executor', exact: true }).click()
  await step('timeout survives reload', (await row.innerText()).includes(`${before + 5}`))
  await page.getByRole('textbox', { name: 'Search settings', exact: true }).click()
  const palette = page.getByRole('dialog', { name: /Search settings/ })
  await palette.getByRole('combobox').fill('timeout')
  await palette.getByRole('option', { name: 'Timeout', exact: true }).click()
  await row.locator('[data-settings-highlight]').waitFor({ state: 'attached' })
  await step(
    'search highlights the matching Timeout row',
    (await row.getByText('Timeout', { exact: true }).count()) === 1 &&
      (await row.locator('[data-settings-highlight]').count()) === 1,
  )
  await shot('settings-timeout-highlight')
  expectHttpError(/\/api\/config$/)
  await page.route('**/api/config', async (route) => {
    if (route.request().method() === 'PUT')
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'SET.1 save rejected' }),
      })
    else await route.continue()
  })
  await increase.click()
  await page.getByText('SET.1 save rejected', { exact: true }).waitFor()
  await page.locator('[data-settings-saving]').waitFor({ state: 'hidden' })
  await step(
    'save error shows reason and restores timeout',
    (await row.innerText()).includes(`${before + 5}`) &&
      (await api('/api/config', { headers })).data.externalTimeoutMinutes === before + 5,
  )
  await page.unroute('**/api/config')
  await sidebar.getByRole('button', { name: 'Model routing', exact: true }).click()
  await page.getByRole('button', { name: /Task rules/ }).click()
  await page.getByRole('button', { name: 'Add rule', exact: true }).click()
  await page.locator('[data-routing-rule][data-draft]').waitFor()
  await sidebar.getByRole('button', { name: 'Executor', exact: true }).click()
  await sidebar.getByRole('button', { name: 'Model routing', exact: true }).click()
  await step(
    'leaving an incomplete rule discards only its local draft',
    (await page.locator('[data-routing-rule]').count()) === 0 &&
      (await api('/api/config', { headers })).data.taskAgentRules.length === 0,
  )
  await step('global save bar is absent', (await page.locator('[data-unsaved-bar]').count()) === 0)
}
