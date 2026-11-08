import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run, writeGateRoles } from '../lib.mjs'

export default async function appearance({
  page,
  base,
  api,
  step,
  shot,
  cleanup,
  consoleErrors,
  note,
}) {
  page.setDefaultTimeout(15_000)
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'orchestos-ui-appearance-')))
  writeFileSync(join(root, '.gitignore'), 'ignored.txt\n.orchestos/\n')
  writeFileSync(join(root, 'README.md'), '# Before appearance\n')
  writeFileSync(join(root, 'ignored.txt'), 'Ignored fixture\n')
  run('git', ['init', '-q'], root)
  run('git', ['add', 'README.md', '.gitignore'], root)
  run(
    'git',
    ['-c', 'user.name=Gate', '-c', 'user.email=gate@example.test', 'commit', '-qm', 'fixture'],
    root,
  )
  writeFileSync(join(root, 'README.md'), '# After appearance\n')
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', root], process.cwd())
  writeGateRoles(root)
  const project = (await api('/api/projects')).data.find((item) => item.path === root)
  if (!project) throw new Error('appearance fixture missing')
  cleanup(async () => {
    const purged = await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, {
      method: 'POST',
    })
    if (!purged.ok) throw new Error('appearance purge failed')
    if ((await api('/api/projects')).data.some((item) => item.id === project.id))
      throw new Error('appearance project remains')
    const sessions = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
    if (sessions.data.length) throw new Error('appearance sessions remain')
    rmSync(root, { recursive: true, force: true })
  })
  const session = await api('/api/chat/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-orchestos-project-id': project.id },
    body: JSON.stringify({ projectId: project.id, agent: 'codex', title: 'Appearance fixture' }),
  })
  if (!session.ok) throw new Error('appearance session missing')
  await page.evaluate(
    ({ projectId, sessionId }) => {
      localStorage.removeItem('orchestos-appearance')
      localStorage.setItem('orchestos-last-dev', JSON.stringify({ projectId, sessionId }))
    },
    { projectId: project.id, sessionId: session.data.id },
  )
  const openDev = async () => {
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await page.getByRole('button', { name: basename(root), exact: true }).click()
  }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await openDev()
  const ignored = page.locator('[data-explorer-file="ignored.txt"]')
  await ignored.waitFor()
  await step(
    'git-ignored file is visible and dimmed by default',
    await ignored.evaluate(
      (el) => getComputedStyle(el).opacity === '0.5' && getComputedStyle(el).fontStyle === 'italic',
    ),
  )
  const primary = await page.evaluate(() => (/Mac/.test(navigator.platform) ? 'Meta' : 'Control'))
  const zoom = async (expected) => {
    await page.waitForFunction(
      (value) => Number(document.documentElement.style.zoom) === value,
      expected,
    )
  }
  await page.evaluate(() =>
    window.addEventListener('keydown', (event) => {
      if (['Equal', 'Minus', 'Digit0'].includes(event.code))
        setTimeout(() => {
          window.__appearancePrevented = event.defaultPrevented
        }, 0)
    }),
  )
  await page.evaluate(() => {
    window.__appearancePrevented = null
  })
  await page.keyboard.press(`${primary}+Equal`)
  await zoom(1.1)
  await page.waitForFunction(() => window.__appearancePrevented === true)
  await step(
    'zoom in prevents native browser zoom',
    await page.evaluate(() => window.__appearancePrevented === true),
  )
  await page.keyboard.press(`${primary}+Minus`)
  await zoom(1)
  await step(
    'zoom out uses the previous supported step',
    await page.locator('html').evaluate((el) => el.style.zoom === '1'),
  )
  await page.keyboard.press(`${primary}+Shift+Equal`)
  await zoom(1.1)
  await step(
    'US Command/Control plus alias increases scale',
    await page.locator('html').evaluate((el) => el.style.zoom === '1.1'),
  )
  await page.evaluate(() => {
    window.__appearancePrevented = null
  })
  await page.keyboard.press(`${primary}+Digit0`)
  await zoom(1)
  await page.waitForFunction(() => window.__appearancePrevented === true)
  await step(
    'zoom reset returns to 100 percent',
    await page.evaluate(() => window.__appearancePrevented === true),
  )
  await page.keyboard.press(`${primary}+Equal`)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await zoom(1.1)
  await step(
    'interface scale survives reload',
    await page.locator('html').evaluate((el) => el.style.zoom === '1.1'),
  )
  const settings = async (target = page) => {
    await target.getByRole('button', { name: 'Settings', exact: true }).click()
    await target.getByText('Loading live settings…', { exact: true }).waitFor({ state: 'hidden' })
    const sidebar = target
      .locator('aside')
      .filter({ has: target.getByRole('button', { name: 'Back to app', exact: true }) })
    await sidebar.getByRole('button', { name: 'Appearance', exact: true }).click()
  }
  const back = async () => {
    await page.getByRole('button', { name: 'Back to app', exact: true }).click()
    await openDev()
  }
  await settings()
  const scale = page.getByRole('combobox', { name: 'Interface scale', exact: true })
  await step('Appearance selector reflects persisted scale', (await scale.inputValue()) === '1.1')
  for (const [query, label, anchor] of [
    ['zoom', 'Interface scale', 'interface-scale'],
    ['gitignore', 'Show git-ignored files', 'show-git-ignored'],
  ]) {
    await page.getByRole('textbox', { name: 'Search settings', exact: true }).click()
    const search = page.getByRole('dialog', { name: /Search settings/ })
    await search.getByRole('combobox').fill(query)
    await search.getByRole('option', { name: label, exact: true }).click()
    await page
      .locator(`[data-settings-anchor="${anchor}"] [data-settings-highlight]`)
      .waitFor({ state: 'attached' })
    await step(
      `${query} search reaches its appearance control`,
      (await page.getByRole('heading', { name: 'Appearance', exact: true }).count()) === 1,
    )
  }
  await page
    .locator('[data-settings-anchor="interface-scale"]')
    .getByRole('button', { name: 'Reset', exact: true })
    .click()
  await zoom(1)
  await back()
  await ignored.waitFor()
  // Change the real control in a second browser tab: the mounted tree must react
  // to storage without a reload or another explorer request.
  let treeRequests = 0
  const countTree = (request) => {
    if (request.url().includes('/api/explorer/tree')) treeRequests++
  }
  page.on('request', countTree)
  note('ignored live update', 'opening shared-storage browser popup')
  const [other] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate((url) => window.open(url, '_blank'), base),
  ])
  try {
    other.setDefaultTimeout(15_000)
    await other.waitForLoadState('domcontentloaded')
    note('ignored live update', 'popup loaded')
    await settings(other)
    note('ignored live update', 'appearance controls ready')
    await other.getByRole('switch', { name: 'Show git-ignored files', exact: true }).uncheck()
    await ignored.waitFor({ state: 'detached' })
    await step(
      'ignored toggle updates mounted explorer across tabs without refetch',
      treeRequests === 0,
      `explorer requests: ${treeRequests}`,
    )
    await other.getByRole('switch', { name: 'Show git-ignored files', exact: true }).check()
    await ignored.waitFor()
    await step('reenabling ignored files restores the cached nodes', treeRequests === 0)
    await other.getByRole('switch', { name: 'Show git-ignored files', exact: true }).uncheck()
    await ignored.waitFor({ state: 'detached' })
  } finally {
    page.off('request', countTree)
    await other.close()
  }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await openDev()
  await page.locator('[data-explorer-file="README.md"]').waitFor()
  await step('hidden git-ignored preference survives reload', (await ignored.count()) === 0)
  await page.getByRole('button', { name: 'Diff', exact: true }).click()
  await page.locator('[data-diff-file="README.md"]').click()
  const added = page.locator('[data-dev-diff-panel] [data-diff-added]').first()
  const removed = page.locator('[data-dev-diff-panel] [data-diff-removed]').first()
  await added.waitFor()
  const colors = async () => ({
    added: await added.evaluate((el) => getComputedStyle(el).color),
    removed: await removed.evaluate((el) => getComputedStyle(el).color),
    bg: await added.evaluate((el) => getComputedStyle(el).backgroundColor),
  })
  note('diff palette', 'diff fixture visible')
  const defaults = await colors()
  const channels = (color) => {
    // Chromium preserves Tailwind's OKLCH colors in computed styles. Canvas
    // converts them to sRGB so blue/green comparisons test the rendered color.
    return page.evaluate((color) => {
      const ctx = document.createElement('canvas').getContext('2d')
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 1, 1)
      return Array.from(ctx.getImageData(0, 0, 1, 1).data)
    }, color)
  }
  const green = await channels(defaults.added)
  await step(
    'default diff additions stay green',
    green[1] > green[0] && green[1] > green[2],
    JSON.stringify(defaults),
  )
  await settings()
  await page.getByRole('radio', { name: 'Color-blind friendly', exact: true }).click()
  await back()
  await added.waitFor()
  const accessible = await colors()
  const blue = await channels(accessible.added)
  const orange = await channels(accessible.removed)
  await step(
    'colorblind diff uses blue additions and orange deletions',
    blue[2] > blue[1] &&
      blue[2] > blue[0] &&
      orange[0] > orange[1] &&
      orange[1] > orange[2] &&
      accessible.bg !== defaults.bg,
    JSON.stringify(accessible),
  )
  await shot('colorblind-diff')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await step(
    'diff palette persists on html after reload',
    (await page.locator('html').getAttribute('data-diff-palette')) === 'colorblind',
  )
  await settings()
  await page.getByRole('radio', { name: 'Default', exact: true }).click()
  await back()
  await page.getByRole('button', { name: 'Diff', exact: true }).click()
  await page.locator('[data-diff-file="README.md"]').click()
  await added.waitFor()
  await step(
    'switching back restores default diff colors',
    JSON.stringify(await colors()) === JSON.stringify(defaults),
  )
  for (const value of ['1.25', '0.8']) {
    await settings()
    await scale.selectOption(value)
    await zoom(Number(value))
    await shot(`appearance-${value}`)
    await back()
    await page.locator(`[data-session-tab="${session.data.id}"]`).click()
    await step(
      `workspace fits viewport at scale ${value}`,
      await page.locator('[data-theme]').evaluate((el) => {
        const rect = el.getBoundingClientRect()
        return Math.abs(rect.width - innerWidth) < 2 && Math.abs(rect.height - innerHeight) < 2
      }),
      JSON.stringify(await page.locator('[data-theme]').boundingBox()),
    )
    const picker = page.getByTitle('Select model and reasoning effort', { exact: true })
    await picker.click()
    await shot(`picker-${value}`)
    await step(
      `composer picker stays inside viewport at ${value}`,
      await page
        .getByRole('dialog', { name: 'Model and effort selector', exact: true })
        .evaluate((el) => {
          const r = el.getBoundingClientRect()
          return (
            r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1
          )
        }),
    )
    await page.getByRole('button', { name: 'Files', exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Model and effort selector', exact: true })
      .waitFor({ state: 'detached' })
    await page.keyboard.press(`${primary}+KeyK`)
    const palette = page.getByRole('dialog', { name: 'Command palette', exact: true })
    await palette.waitFor()
    await step(
      `command palette centers inside viewport at ${value}`,
      await palette.evaluate((el) => {
        const r = el.firstElementChild.getBoundingClientRect()
        return (
          Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 2 &&
          r.top >= 0 &&
          r.bottom <= innerHeight
        )
      }),
    )
    await shot(`palette-${value}`)
    await page.keyboard.press('Escape')
  }
  await settings()
  await scale.selectOption('1')
  await page.getByRole('switch', { name: 'Show git-ignored files', exact: true }).check()
  await step(
    'dashboard loads without pageerrors',
    consoleErrors().length === 0,
    consoleErrors().join('; ') || 'none',
  )
}
