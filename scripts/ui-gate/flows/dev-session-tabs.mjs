import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run, writeGateRoles } from '../lib.mjs'

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
  writeGateRoles(root)
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
  await page.evaluate(
    ({ projectId, sessionId }) => {
      localStorage.setItem('orchestos-last-dev', JSON.stringify({ projectId, sessionId }))
      localStorage.removeItem('orchestos-dev-tabs')
      localStorage.removeItem('orchestos-dev-session-tabs')
      localStorage.removeItem('orchestos-dev-file-tabs')
    },
    { projectId: project.id, sessionId: sessions[0].id },
  )
  const enterDev = () => page.getByRole('button', { name: 'Dev', exact: true }).click()
  const tab = (index) => page.locator(`[data-session-tab="${sessions[index].id}"]`)
  const sidebar = (index) => page.locator(`[data-thread-id="${sessions[index].id}"]`)
  const tabs = page.locator('[data-dev-session-tabs]')
  const fileTab = (path) => tabs.locator(`[data-file-tab="${path}"]`)
  const treeFile = (path) => page.locator(`[data-explorer-file="${path}"]`)
  const panel = page.locator('[data-dev-file-panel]')
  const reloadChat = async () => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Chat', exact: true }).waitFor()
    await page.locator('[data-thread-id]').first().waitFor()
    await step('reload starts in Chat', (await tabs.count()) === 0, 'Dev tabs absent after reload')
  }
  await reloadChat()
  await enterDev()
  await tab(0).waitFor()
  await step(
    'entering Dev restores last session without saved tabs',
    (await tab(0).getAttribute('aria-selected')) === 'true' &&
      (await page.locator('[data-dev-new-session]').count()) === 0,
    'remembered Alpha active, no New session',
  )
  await page.getByRole('button', { name: basename(root), exact: true }).click()
  await sidebar(1).click()
  await tab(0).click()
  await step(
    'sidebar opens ordered sessions and existing tabs do not duplicate',
    (await tabs.getByRole('tab').count()) === 2 &&
      (await tab(0).getAttribute('aria-selected')) === 'true',
    'Alpha, Beta',
  )
  await shot('session-tabs')
  await treeFile('README.md').click()
  await panel.getByRole('heading', { name: 'Dev session tabs' }).waitFor()
  await step(
    'file opens italic preview in the shared row and occupies full center',
    (await fileTab('README.md').evaluate((el) => getComputedStyle(el).fontStyle === 'italic')) &&
      (await tab(0).count()) === 1 &&
      (await page.locator('[data-composer-region]').count()) === 0 &&
      (await panel.evaluate(
        (el) =>
          Math.abs(
            el.getBoundingClientRect().width - el.parentElement.getBoundingClientRect().width,
          ) < 2,
      )),
    'session remains a tab; file only content at full width',
  )
  await shot('file-markdown-preview')
  await tab(0).click()
  await page.locator('[data-composer-region] textarea').waitFor()
  await step(
    'session tab restores full center chat',
    (await panel.count()) === 0 && (await visible(tab(0))),
    'file viewer absent, composer visible',
  )
  await treeFile('context.json').click()
  await panel.locator('.hljs-attr').first().waitFor()
  await step(
    'opening another file replaces only preview with numbered colored source',
    (await fileTab('README.md').count()) === 0 &&
      (await tabs.getByRole('tab').count()) === 3 &&
      (await visible(panel.locator('[data-line-numbers]'))) &&
      (await panel
        .locator('.hljs-attr')
        .first()
        .evaluate(
          (el) => getComputedStyle(el).color !== getComputedStyle(el.closest('pre')).color,
        )),
    'two sessions plus context.json preview; code colored',
  )
  await treeFile('context.json').dblclick()
  await step(
    'tree double click pins file',
    await fileTab('context.json').evaluate((el) => getComputedStyle(el).fontStyle !== 'italic'),
    'fixed code tab',
  )
  await shot('file-highlighted-code')
  await treeFile('README.md').click()
  await fileTab('README.md').dblclick()
  await panel.getByRole('heading', { name: 'Dev session tabs' }).waitFor()
  await panel.getByRole('button', { name: 'Source', exact: true }).click()
  await step(
    'Markdown Source keeps numbered literal source',
    (await panel.locator('[data-file-source] code').innerText()).includes('# Dev session tabs'),
    'literal Markdown source',
  )
  await shot('file-markdown-source')
  await panel.getByRole('button', { name: 'Preview', exact: true }).click()
  await panel.getByRole('heading', { name: 'Dev session tabs' }).waitFor()
  await reloadChat()
  await enterDev()
  await panel.getByRole('heading', { name: 'Dev session tabs' }).waitFor()
  await step(
    'reload restores mixed tab order and active fixed file',
    (await tabs.getByRole('tab').count()) === 4 &&
      (await fileTab('README.md').getAttribute('aria-selected')) === 'true' &&
      (
        await tabs
          .getByRole('tab')
          .evaluateAll((items) => items.map((el) => el.dataset.sessionTab || el.dataset.fileTab))
      ).join(',') === [sessions[0].id, sessions[1].id, 'context.json', 'README.md'].join(','),
    'Alpha, Beta, context.json, README.md active',
  )
  await fileTab('README.md').hover()
  await page.getByRole('button', { name: 'Close file tab README.md', exact: true }).click()
  await panel.locator('[data-file-source]').waitFor()
  await step(
    'closing active file selects its left neighbour',
    (await fileTab('context.json').getAttribute('aria-selected')) === 'true',
    'context.json active',
  )
  await tab(0).click()
  await tab(0).hover()
  await page.getByRole('button', { name: 'Close tab Dev tab Alpha', exact: true }).click()
  await step(
    'closing session selects right neighbour without deleting session',
    (await tab(1).getAttribute('aria-selected')) === 'true' &&
      (await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)).data.some(
        (item) => item.id === sessions[0].id,
      ),
    'Beta active; Alpha remains in API',
  )
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  const fresh = page.locator('[data-dev-new-session]')
  await fresh
    .getByRole('heading', { name: `What should we work on in ${basename(root)}?`, exact: true })
    .waitFor()
  await fresh.getByRole('button', { name: /medium/i }).waitFor()
  const centered = await fresh.evaluate((root) => {
    const composer = root.querySelector('[data-composer-region]').getBoundingClientRect()
    const area = root.getBoundingClientRect()
    return Math.abs(composer.y + composer.height / 2 - area.y - area.height / 2) < 2
  })
  const config = (await api(`/api/config?project=${encodeURIComponent(project.id)}`)).data
  await step(
    'plus appends centered New session using configured orchestrator model and effort',
    centered &&
      (await tabs.locator('[data-new-session-tab][aria-selected="true"]').count()) === 1 &&
      (await fresh.innerText()).includes('Luna') &&
      config.roleAssignments.orchestrator.agent === 'codex' &&
      config.roleAssignments.orchestrator.model === 'gpt-6-luna' &&
      config.roleAssignments.orchestrator.effort === 'medium',
    await fresh.innerText(),
  )
  await shot('new-session')
  await reloadChat()
  await enterDev()
  await fresh.waitFor()
  await step(
    'reload restores active New session alongside sessions and fixed files',
    (await tabs.getByRole('tab').count()) === 3 &&
      (await tab(1).count()) === 1 &&
      (await fileTab('context.json').count()) === 1,
    'Beta, context.json, New session',
  )
  await page.evaluate((projectId) => {
    const state = JSON.parse(localStorage.getItem('orchestos-dev-tabs'))
    state[projectId].tabs.push({ type: 'session', id: 'missing-session' })
    localStorage.setItem('orchestos-dev-tabs', JSON.stringify(state))
  }, project.id)
  await reloadChat()
  await enterDev()
  await fresh.waitFor()
  await step(
    'restoration removes dead session ids',
    await page.evaluate(
      (projectId) =>
        !JSON.parse(localStorage.getItem('orchestos-dev-tabs'))[projectId].tabs.some(
          (tab) => tab.id === 'missing-session',
        ),
      project.id,
    ),
    'dead id removed',
  )
  await step('0 console errors', consoleErrors().length === 0, consoleErrors().join('; ') || 'none')
}
