import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run, writeGateRoles } from '../lib.mjs'

export default async function diffView({ page, base, api, step, shot, cleanup, consoleErrors }) {
  page.setDefaultTimeout(15_000)
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'orchestos-ui-diff-view-')))
  mkdirSync(join(root, 'src/dashboard/app'), { recursive: true })
  const content = 'src/dashboard/app/content.txt'
  const spaces = 'src/dashboard/app/spaces.txt'
  writeFileSync(join(root, '.gitignore'), '.orchestos/\n')
  writeFileSync(join(root, content), 'before\ncontext\n')
  writeFileSync(join(root, spaces), 'hello world\n')
  run('git', ['init', '-q'], root)
  run('git', ['add', '.'], root)
  run(
    'git',
    ['-c', 'user.name=Gate', '-c', 'user.email=gate@example.test', 'commit', '-qm', 'fixture'],
    root,
  )
  writeFileSync(join(root, content), 'after\ncontext\n')
  writeFileSync(join(root, spaces), 'hello   world   \n')
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', root], process.cwd())
  writeGateRoles(root)
  const project = (await api('/api/projects')).data.find((item) => item.path === root)
  if (!project) throw new Error('diff fixture missing')
  cleanup(async () => {
    const purged = await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, {
      method: 'POST',
    })
    if (!purged.ok) throw new Error('diff fixture purge failed')
    if ((await api('/api/projects')).data.some((item) => item.id === project.id))
      throw new Error('diff fixture remains')
    const sessions = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
    if (sessions.data.length) throw new Error('diff sessions remain')
    rmSync(root, { recursive: true, force: true })
  })
  const session = await api('/api/chat/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-orchestos-project-id': project.id },
    body: JSON.stringify({ projectId: project.id, agent: 'codex', title: 'Diff fixture' }),
  })
  if (!session.ok) throw new Error('diff session missing')
  await page.evaluate(
    ({ projectId, sessionId }) => {
      localStorage.removeItem('orchestos-diff')
      localStorage.removeItem('orchestos-appearance')
      localStorage.setItem('orchestos-last-dev', JSON.stringify({ projectId, sessionId }))
    },
    { projectId: project.id, sessionId: session.data.id },
  )
  const openDev = async () => {
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await page.getByRole('button', { name: basename(root), exact: true }).click()
    await page.getByRole('button', { name: 'Diff', exact: true }).click()
  }
  const file = (path) => page.locator(`[data-diff-file="${path}"]`)
  const panel = page.locator('[data-dev-diff-panel]')
  const added = panel.locator('[data-diff-added]').first()
  const removed = panel.locator('[data-diff-removed]').first()
  const split = panel.locator('[data-diff-split]')
  const folder = page.locator('[data-changes-folder="src/dashboard/app"]')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await openDev()
  await file(content).dblclick()
  await added.waitFor()
  await step(
    'default diff stays unified and Changes stays flat',
    (await panel.getAttribute('data-diff-view')) === 'unified' && (await folder.count()) === 0,
  )
  await panel.getByRole('button', { name: 'Split', exact: true }).click()
  await split.waitFor()
  const replacement = panel
    .locator('[data-diff-split-row]')
    .filter({ has: page.locator('[data-diff-removed]') })
  await step(
    'split pairs deletion left and addition right with correct numbers',
    (await replacement.locator('[data-diff-side="left"]').innerText()) === '1\n-before' &&
      (await replacement.locator('[data-diff-side="right"]').innerText()) === '1\n+after',
  )
  await step(
    'panel controls do not persist defaults',
    await page.evaluate(() => localStorage.getItem('orchestos-diff') === null),
  )
  await shot('split-default')

  const settings = async (target, section = 'Editor') => {
    if ((await target.getByRole('button', { name: 'Back to app', exact: true }).count()) === 0) {
      await target.getByRole('button', { name: 'Settings', exact: true }).click()
      await target.getByText('Loading live settings…', { exact: true }).waitFor({ state: 'hidden' })
    }
    const sidebar = target
      .locator('aside')
      .filter({ has: target.getByRole('button', { name: 'Back to app', exact: true }) })
    await sidebar.getByRole('button', { name: section, exact: true }).click()
  }
  const [other] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate((url) => window.open(url, '_blank'), base),
  ])
  try {
    await other.waitForLoadState('domcontentloaded')
    await settings(other)
    await step(
      'Expand folders disabled for List',
      await other.getByRole('switch', { name: 'Expand folders', exact: true }).isDisabled(),
    )
    // Change defaults in another tab to exercise updates on the still mounted panel.
    await other.getByRole('radio', { name: 'Split', exact: true }).click()
    await other.getByRole('radio', { name: 'Unified', exact: true }).click()
    await split.waitFor({ state: 'detached' })
    await step(
      'mounted panel reflects defaults changed in Settings',
      (await panel.getAttribute('data-diff-view')) === 'unified',
    )
    await other.getByRole('radio', { name: 'Split', exact: true }).click()
    await split.waitFor()
    await file(spaces).click()
    await added.filter({ hasText: '+hello' }).waitFor()
    await panel.getByRole('button', { name: 'Ignore whitespace', exact: true }).click()
    await added.waitFor({ state: 'detached' })
    await step(
      'local whitespace toggle refetches an empty patch',
      (await panel.getAttribute('data-diff-view')) === 'split',
    )
    await panel.getByRole('button', { name: 'Ignore whitespace', exact: true }).click()
    await added.filter({ hasText: '+hello' }).waitFor()
    await other.getByRole('switch', { name: 'Ignore whitespace', exact: true }).check()
    await added.waitFor({ state: 'detached' })
    await page.waitForFunction(
      (path) => document.querySelector(`[data-diff-file="${path}"]`)?.textContent.includes('+0'),
      spaces,
    )
    const response = await api('/api/git/changes?ignoreWhitespace=1', {
      headers: { 'x-orchestos-project-id': project.id },
    })
    const whitespace = response.data.files.find((entry) => entry.path === spaces)
    await step(
      'whitespace default empties patch and yields visible plus/minus zero',
      whitespace.additions === 0 &&
        whitespace.deletions === 0 &&
        (await file(spaces).innerText()).includes('−0'),
    )
    await other.getByRole('switch', { name: 'Ignore whitespace', exact: true }).uncheck()
    await added.filter({ hasText: '+hello' }).waitFor()
    await step('disabling whitespace filter restores patch', (await removed.count()) === 1)
    await other.getByRole('radio', { name: 'Tree', exact: true }).click()
    await other.getByRole('switch', { name: 'Expand folders', exact: true }).uncheck()
    await folder.waitFor()
    await page.waitForFunction(
      () =>
        document.querySelector('[data-changes-folder]')?.getAttribute('aria-expanded') === 'false',
    )
    await step(
      'tree compacts nested folders and starts collapsed',
      (await file(content).count()) === 0 && (await folder.innerText()) === 'src/dashboard/app',
    )
    await folder.click()
    await file(content).waitFor()
    await step(
      'folder click reveals changes',
      (await folder.getAttribute('aria-expanded')) === 'true',
    )
    await file(content).click()
    await added.filter({ hasText: '+after' }).waitFor()
    await split.waitFor()
    await settings(other, 'Appearance')
    await other.getByRole('radio', { name: 'Color-blind friendly', exact: true }).click()
    await page.waitForFunction(() => document.documentElement.dataset.diffPalette === 'colorblind')
    const channels = async (locator) =>
      locator.evaluate((element) => {
        const ctx = document.createElement('canvas').getContext('2d')
        ctx.fillStyle = getComputedStyle(element).color
        ctx.fillRect(0, 0, 1, 1)
        return Array.from(ctx.getImageData(0, 0, 1, 1).data)
      })
    const blue = await channels(added)
    const orange = await channels(removed)
    await step(
      'split honors colorblind palette',
      blue[2] > blue[1] && blue[2] > blue[0] && orange[0] > orange[1] && orange[1] > orange[2],
    )
    await shot('split-colorblind-tree')
  } finally {
    await other.close()
  }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await openDev()
  await folder.waitFor()
  await step(
    'tree and collapsed defaults survive reload',
    (await folder.getAttribute('aria-expanded')) === 'false' && (await file(content).count()) === 0,
  )
  await folder.click()
  await file(spaces).click()
  await split.waitFor()
  await added.waitFor()
  await step(
    'new diff opens Split after reload',
    (await panel.getAttribute('data-diff-view')) === 'split',
  )
  await page.getByRole('button', { name: 'Changes layout', exact: true }).click()
  await folder.waitFor({ state: 'detached' })
  await step(
    'local List toggle restores flat list without changing default',
    (await file(content).count()) === 1 &&
      (await page.evaluate(
        () => JSON.parse(localStorage.getItem('orchestos-diff')).changesLayout === 'tree',
      )),
  )
  await settings(page)
  for (const [query, label, anchor] of [
    ['side by side', 'Diff view', 'diff-view'],
    ['espacios', 'Ignore whitespace', 'diff-ignore-whitespace'],
    ['árbol', 'Changes layout', 'changes-layout'],
    ['carpetas', 'Expand folders', 'diff-expand-folders'],
  ]) {
    await page.getByRole('textbox', { name: 'Search settings', exact: true }).click()
    const search = page.getByRole('dialog', { name: /Search settings/ })
    await search.getByRole('combobox').fill(query)
    await search.getByRole('option', { name: label, exact: true }).click()
    await page
      .locator(`[data-settings-anchor="${anchor}"] [data-settings-highlight]`)
      .waitFor({ state: 'attached' })
    await step(
      `${query} search reaches ${label}`,
      (await page.getByRole('heading', { name: 'Editor', exact: true }).count()) === 1,
    )
  }
  await page.getByRole('radio', { name: 'Unified', exact: true }).click()
  await page.getByRole('radio', { name: 'List', exact: true }).click()
  await page.getByRole('switch', { name: 'Expand folders', exact: true }).isDisabled()
  await step(
    'dashboard loads without pageerrors',
    consoleErrors().length === 0,
    consoleErrors().join('; ') || 'none',
  )
  await page.evaluate(() => {
    localStorage.removeItem('orchestos-diff')
    localStorage.removeItem('orchestos-appearance')
  })
}
