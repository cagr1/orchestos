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
  await step('0 console errors', consoleErrors().length === 0, consoleErrors().join('; ') || 'none')
}
