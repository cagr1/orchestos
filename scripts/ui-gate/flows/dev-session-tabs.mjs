import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run } from '../lib.mjs'

export default async function devSessionTabs({
  page,
  api,
  step,
  shot,
  cleanup,
  visible,
  consoleErrors,
}) {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-dev-tabs-'))
  writeFileSync(join(root, 'README.md'), '# Dev session tabs\n')
  writeFileSync(join(root, 'notes.txt'), 'Preview only\n')
  run('git', ['init', '-q'], root)
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', root], process.cwd())
  const project = (await api('/api/projects')).data.find((item) => item.path === root)
  if (!project) throw new Error('fixture project missing')
  cleanup(async () => {
    const purged = await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, {
      method: 'POST',
    })
    if (!purged.ok) throw new Error(`purge failed: ${JSON.stringify(purged)}`)
    const remaining = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
    if (remaining.data.length) throw new Error('fixture sessions remain after purge')
    rmSync(root, { recursive: true, force: true })
  })
  const sessions = []
  for (const title of ['Dev tab Alpha', 'Dev tab Beta', 'Dev tab Gamma']) {
    const response = await api('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-orchestos-project-id': project.id },
      body: JSON.stringify({ agent: 'claude', projectId: project.id, title }),
    })
    if (!response.ok || !response.data.id)
      throw new Error(`create session: ${JSON.stringify(response)}`)
    sessions.push(response.data)
  }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.getByRole('button', { name: basename(root), exact: true }).click()
  const sidebar = (index) => page.locator(`[data-thread-id="${sessions[index].id}"]`)
  const tab = (index) => page.locator(`[data-session-tab="${sessions[index].id}"]`)
  await sidebar(0).click()
  await sidebar(1).click()
  await step(
    'sidebar opens two sessions as ordered tabs',
    (await page.getByRole('tab').count()) === 2 &&
      (
        await page.getByRole('tab').evaluateAll((tabs) => tabs.map((el) => el.dataset.sessionTab))
      ).join(',') ===
        sessions
          .slice(0, 2)
          .map((session) => session.id)
          .join(','),
    'Alpha, Beta; Gamma stays only in sidebar',
  )
  await tab(0).click()
  await step(
    'tab click activates session',
    (await tab(0).getAttribute('aria-selected')) === 'true',
    'Alpha active',
  )
  await sidebar(0).click()
  await step(
    'reopening existing tab does not duplicate it',
    (await page.getByRole('tab').count()) === 2,
    'two tabs',
  )
  await shot('session-tabs')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await tab(0).waitFor()
  await step(
    'reload restores open tabs order and active id',
    (await page.getByRole('tab').count()) === 2 &&
      (await tab(0).getAttribute('aria-selected')) === 'true' &&
      (
        await page.getByRole('tab').evaluateAll((tabs) => tabs.map((el) => el.dataset.sessionTab))
      ).join(',') ===
        sessions
          .slice(0, 2)
          .map((session) => session.id)
          .join(','),
    'Alpha active; Alpha, Beta restored',
  )
  // Reload collapses project rows; expand before checking the sidebar contents.
  await page.getByRole('button', { name: basename(root), exact: true }).click()
  await sidebar(0).waitFor()
  await tab(0).hover()
  await page.getByRole('button', { name: 'Close tab Dev tab Alpha', exact: true }).click()
  await tab(0).waitFor({ state: 'detached' })
  await page.locator(`[data-session-tab="${sessions[1].id}"][aria-selected="true"]`).waitFor()
  await step(
    'closing active tab selects right neighbour and keeps sidebar session',
    (await tab(0).count()) === 0 &&
      (await tab(1).getAttribute('aria-selected')) === 'true' &&
      (await visible(sidebar(0))),
    'Beta active; Alpha remains in sidebar',
  )
  const persisted = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
  await step(
    'closing tab does not archive or delete session',
    persisted.data.some((session) => session.id === sessions[0].id),
    'Alpha remains in unarchived sessions API',
  )
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  await page.locator('[data-dev-new-session]').waitFor()
  const centered = await page.locator('[data-dev-new-session]').evaluate((root) => {
    const composer = root.querySelector('[data-composer-region]').getBoundingClientRect()
    const area = root.getBoundingClientRect()
    return Math.abs(composer.y + composer.height / 2 - area.y - area.height / 2) < 2
  })
  await step(
    'plus opens centered New session composer',
    centered && (await visible(page.locator('[data-dev-new-session] textarea'))),
    'composer vertical center within 2px of available area',
  )
  await shot('new-session')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('[data-dev-new-session]').waitFor()
  await step(
    'New session selection persists with other tabs still open',
    (await page.getByRole('tab').count()) === 1 && (await visible(tab(1))),
    'Beta open, New session selected',
  )
  await page.evaluate((projectId) => {
    const state = JSON.parse(localStorage.getItem('orchestos-dev-session-tabs'))
    state[projectId].ids.push('missing-session')
    localStorage.setItem('orchestos-dev-session-tabs', JSON.stringify(state))
  }, project.id)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await tab(1).waitFor()
  await step(
    'reload silently drops dead persisted ids',
    await page.evaluate(
      (projectId) =>
        !JSON.parse(localStorage.getItem('orchestos-dev-session-tabs'))[projectId].ids.includes(
          'missing-session',
        ),
      project.id,
    ),
    'missing id pruned from storage',
  )
  await tab(1).hover()
  await page.getByRole('button', { name: 'Close tab Dev tab Beta', exact: true }).click()
  await step(
    'closing final tab shows New session',
    (await page.getByRole('tab').count()) === 0 &&
      (await visible(page.locator('[data-dev-new-session] textarea'))),
    'no open tabs',
  )
  const fileTab = (path) => page.locator(`[data-file-tab="${path}"]`)
  const treeFile = (path) => page.locator(`[data-explorer-file="${path}"]`)
  const filePanel = page.locator('[data-dev-file-panel]')
  await treeFile('README.md').click()
  await filePanel.getByRole('heading', { name: 'Dev session tabs' }).waitFor()
  await step(
    'README single click opens italic Markdown Preview',
    (await fileTab('README.md').evaluate((el) => getComputedStyle(el).fontStyle === 'italic')) &&
      (await visible(filePanel.locator('[data-file-markdown]'))),
    'rendered heading; preview tab italic',
  )
  await shot('file-markdown-preview')
  await treeFile('context.json').click()
  await filePanel.locator('.hljs-attr').first().waitFor()
  const tokenColored = await filePanel
    .locator('.hljs-attr')
    .first()
    .evaluate((el) => getComputedStyle(el).color !== getComputedStyle(el.closest('pre')).color)
  await step(
    'next file replaces preview with numbered highlighted code',
    (await fileTab('README.md').count()) === 0 &&
      (await filePanel.getByRole('tab').count()) === 1 &&
      (await visible(filePanel.locator('[data-line-numbers]'))) &&
      tokenColored,
    'context.json only; line numbers and computed token color differ from base text',
  )
  await treeFile('context.json').dblclick()
  await step(
    'tree double click pins the preview',
    await fileTab('context.json').evaluate((el) => getComputedStyle(el).fontStyle !== 'italic'),
    'context.json fixed',
  )
  await shot('file-highlighted-code')
  await treeFile('README.md').click()
  await filePanel.getByRole('heading', { name: 'Dev session tabs' }).waitFor()
  await fileTab('README.md').dblclick()
  await step(
    'tab double click fixes Markdown alongside pinned code',
    (await filePanel.getByRole('tab').count()) === 2 &&
      (await fileTab('README.md').evaluate((el) => getComputedStyle(el).fontStyle !== 'italic')),
    'two fixed file tabs',
  )
  await filePanel.getByRole('button', { name: 'Source', exact: true }).click()
  await filePanel.locator('[data-file-source]').waitFor()
  await step(
    'Markdown Source shows literal source and line numbers',
    (await filePanel.locator('[data-file-source] code').innerText()).includes(
      '# Dev session tabs',
    ) && (await filePanel.locator('[data-line-numbers]').innerText()).startsWith('1'),
    'literal Markdown source, numbered',
  )
  await shot('file-markdown-source')
  // A third file stays preview-only and must not survive reload.
  await treeFile('notes.txt').click()
  await fileTab('notes.txt').waitFor()
  await filePanel.locator('[data-file-source] code').waitFor()
  await step(
    'unknown extension uses plain numbered text',
    (await filePanel.locator('[data-file-source] code').innerText()).includes('Preview only') &&
      (await filePanel.locator('[data-file-source] code span').count()) === 0 &&
      (await visible(filePanel.locator('[data-line-numbers]'))),
    'notes.txt: plain text with line numbers',
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await fileTab('README.md').waitFor()
  await step(
    'reload restores fixed tabs only',
    (await filePanel.getByRole('tab').count()) === 2 &&
      (await fileTab('notes.txt').count()) === 0 &&
      (await visible(fileTab('context.json'))),
    'context.json and README.md restored; preview notes.txt omitted',
  )
  await fileTab('README.md').click()
  await filePanel.getByRole('heading', { name: 'Dev session tabs' }).waitFor()
  await step(
    'Markdown defaults to Preview after reload',
    await visible(filePanel.locator('[data-file-markdown]')),
    'rendered Markdown',
  )
  await fileTab('context.json').hover()
  await page.getByRole('button', { name: 'Close file tab context.json', exact: true }).click()
  await fileTab('context.json').waitFor({ state: 'detached' })
  await fileTab('README.md').hover()
  await page.getByRole('button', { name: 'Close file tab README.md', exact: true }).click()
  await filePanel.waitFor({ state: 'detached' })
  await step(
    'closing last file tab removes panel',
    (await filePanel.count()) === 0,
    'center returned to workspace',
  )
  await shot('file-panel-closed')
  await treeFile('README.md').click()
  await filePanel.waitFor()
  await page.getByRole('button', { name: 'Close file panel', exact: true }).click()
  await filePanel.waitFor({ state: 'detached' })
  await step('panel close clears all file tabs', (await filePanel.count()) === 0, 'panel closed')
  await step('0 console errors', consoleErrors().length === 0, consoleErrors().join('; ') || 'none')
}
