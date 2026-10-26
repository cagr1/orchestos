import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run } from '../lib.mjs'

export default async function settingsPages({ page, api, step, shot, cleanup }) {
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
    .filter({ has: page.getByRole('button', { name: /^(Back to app|Volver a la app)$/ }) })
  await sidebar.getByRole('button', { name: 'General', exact: true }).click()
  await step(
    'Language lives in General without a navigation entry',
    (await page.locator('[data-settings-anchor="language"] [role="radio"]').count()) === 2 &&
      (await sidebar.getByRole('button', { name: 'Language', exact: true }).count()) === 0,
  )
  await page.getByRole('radio', { name: 'Español', exact: true }).click()
  await open()
  await sidebar.getByRole('button', { name: 'General', exact: true }).click()
  await step(
    'language saves instantly and survives reload',
    (await page
      .getByRole('radio', { name: 'Español', exact: true })
      .getAttribute('aria-checked')) === 'true',
  )
  await page.getByRole('radio', { name: 'English', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search settings', exact: true }).click()
  const palette = page.getByRole('dialog', { name: /Search settings/ })
  await palette.getByRole('combobox').fill('language')
  await palette.getByRole('option', { name: 'Language', exact: true }).click()
  await page
    .locator('[data-settings-anchor="language"] [data-settings-highlight]')
    .waitFor({ state: 'attached' })
  await step(
    'language search highlights its General row',
    (await page.getByRole('heading', { name: 'General', exact: true }).count()) === 1,
  )
  await sidebar.getByRole('button', { name: 'Appearance', exact: true }).click()
  const themes = page.locator('[data-settings-anchor^="theme-"]')
  await step('Appearance has four themes', (await themes.count()) === 4)
  for (const name of ['OrchestOS', 'Graphite', 'Carbon', 'Light']) {
    await step(`theme ${name} is available`, (await themes.filter({ hasText: name }).count()) === 1)
  }
  await page.locator('[data-settings-anchor="theme-graphite"]').click()
  await open()
  await sidebar.getByRole('button', { name: 'Appearance', exact: true }).click()
  await step(
    'chosen theme persists after reload',
    (await page.locator('[data-theme]').getAttribute('data-theme')) === 'graphite' &&
      (await page
        .locator('[data-settings-anchor="theme-graphite"] [aria-label="Active"]')
        .count()) === 1,
  )
  await shot('appearance')
  await sidebar.getByRole('button', { name: 'Keybindings', exact: true }).click()
  const registry = JSON.parse(
    execFileSync(
      'bun',
      [
        '-e',
        "import { KEYBINDINGS } from './src/dashboard/app/src/lib/keybindings.ts'; console.log(JSON.stringify(KEYBINDINGS))",
      ],
      { encoding: 'utf8' },
    ),
  )
  const rows = page.locator('[data-keybinding]')
  await step('Keybindings has one row per registry entry', (await rows.count()) === registry.length)
  for (const binding of registry) {
    const row = page.locator(`[data-keybinding="${binding.id}"]`)
    await step(
      `registered shortcut ${binding.id}`,
      (await row.innerText()).includes(binding.command) &&
        (await row.innerText()).includes(binding.when) &&
        JSON.stringify(await row.locator('kbd').allTextContents()) === JSON.stringify(binding.keys),
    )
  }
  const search = page.getByRole('searchbox', { name: 'Search keybindings', exact: true })
  await search.fill('palette')
  await step(
    'command filter leaves exactly its matching row',
    (await rows.count()) === 1 &&
      (await rows.first().getAttribute('data-keybinding')) === 'command-palette',
  )
  await search.fill('Cmd/Ctrl')
  await step(
    'key filter matches the registered shortcuts',
    (await rows.count()) === registry.length,
  )
  await search.fill('no-such-shortcut-SET5')
  await step(
    'unmatched filter has zero rows and keeps page usable',
    (await rows.count()) === 0 &&
      (await page.getByRole('heading', { name: 'Keybindings', exact: true }).count()) === 1,
  )
  await search.fill('')
  await step('clearing the filter restores all rows', (await rows.count()) === registry.length)
  await shot('keybindings')
  const shortcut = process.platform === 'darwin' ? 'Meta+k' : 'Control+k'
  await page.keyboard.press(shortcut)
  await palette.waitFor({ state: 'visible' })
  await step('registered Settings shortcut opens search', await palette.isVisible())
  await page.keyboard.press('Escape')
}
