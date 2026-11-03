import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { run, writeGateRoles } from '../lib.mjs'

export default async function devSessionTabs({
  page,
  api,
  step,
  shot,
  cleanup,
  visible,
  consoleErrors,
  expectHttpError,
  restartDashboard,
}) {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-dev-tabs-'))
  const opencode = join(root, 'opencode')
  writeFileSync(
    opencode,
    `#!/bin/sh
case "$1" in
--version) echo "OpenCode fixture 1.2.3"; exit 0;;
auth) echo "1 credential"; exit 0;;
models) exit 0;;
esac
echo "OpenCode terminal fixture ready"
while IFS= read -r line; do echo "$line"; done
`,
    { mode: 0o755 },
  )
  const preload = join(root, 'probe.ts')
  writeFileSync(
    preload,
    `
import { systemCliDiscoveryProbe } from ${JSON.stringify(resolve('src/run/executors/cli-discovery.ts'))}
import { systemCliHealthProbe } from ${JSON.stringify(resolve('src/run/executors/cli-health.ts'))}
process.env.PATH = ${JSON.stringify(root)} + ':' + process.env.PATH
for (const probe of [systemCliDiscoveryProbe, systemCliHealthProbe]) {
  const original = probe.which
  probe.which = (binary, path) => binary === 'opencode' ? ${JSON.stringify(opencode)} : original(binary, path)
}
`,
  )
  const previousOptions = process.env.BUN_OPTIONS
  cleanup(async () => {
    if (previousOptions === undefined) delete process.env.BUN_OPTIONS
    else process.env.BUN_OPTIONS = previousOptions
    await restartDashboard()
  })
  process.env.BUN_OPTIONS = `${previousOptions ?? ''} --preload=${preload}`.trim()
  await restartDashboard()
  writeFileSync(join(root, 'README.md'), '# Dev session tabs\n')
  writeFileSync(join(root, 'notes.txt'), 'Preview only\n')
  writeFileSync(join(root, '.gitignore'), 'ignored.txt\n')
  writeFileSync(join(root, 'ignored.txt'), 'Ignored but visible\n')
  run('git', ['init', '-q'], root)
  run('git', ['add', 'README.md', 'notes.txt', '.gitignore'], root)
  run(
    'git',
    [
      '-c',
      'user.name=Gate',
      '-c',
      'user.email=gate@example.test',
      'commit',
      '-qm',
      'fixture baseline',
    ],
    root,
  )
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
  let fixtureRunning = true
  await page.route('**/api/chat/sessions?*', async (route) => {
    const response = await route.fetch()
    const rows = await response.json()
    await route.fulfill({
      response,
      json: rows.map((row) =>
        row.id === sessions[0].id ? { ...row, running: fixtureRunning } : row,
      ),
    })
  })
  await page.route('**/api/chat/sessions/*/timeline*', async (route) => {
    const response = await route.fetch()
    const timeline = await response.json()
    if (route.request().url().includes(sessions[0].id)) {
      timeline.pending = fixtureRunning
      timeline.messages = ['user', 'assistant'].map((role, index) => ({
        id: index + 1,
        sessionId: sessions[0].id,
        role,
        content:
          role === 'user'
            ? 'Show a title, a list and TypeScript code.'
            : '## Shared response style\n\n- Same renderer as Chat\n- Highlighted code\n\n```ts\nconst answer: number = 42\nconsole.log(answer)\n```',
        model: null,
        taskId: null,
        ocrUsed: [],
        taskHeld: false,
        existingFiles: [],
        createdAt: '2026-11-02T12:00:00Z',
      }))
    }
    await route.fulfill({ response, json: timeline })
  })
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
  await step(
    'running session tab shows the accent spinner',
    (await tab(0).locator('[aria-label="Running"]').count()) === 1,
    'Alpha spinner is visible while its session is running',
  )
  fixtureRunning = false
  await tab(0).locator('[aria-label="Running"]').waitFor({ state: 'detached' })
  await step(
    'finished session timeline clears its tab spinner',
    (await tab(0).locator('[aria-label="Running"]').count()) === 0,
    'Alpha spinner clears when its active timeline reports pending false',
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
  const assistantResponse = page.locator('[data-dev-assistant-message]')
  await assistantResponse.getByRole('heading', { name: 'Shared response style' }).waitFor()
  await step(
    'Dev response shares Chat markdown and highlights code',
    (await assistantResponse.locator('ul > li').count()) === 2 &&
      (await assistantResponse.locator('[data-streamdown="code-block"] .hljs-keyword').count()) > 0,
    'heading, two list items and highlighted TypeScript tokens',
  )
  await shot('session-tabs')
  await page.screenshot({ path: '/tmp/UI.52-dev-markdown.png' })
  await treeFile('README.md').click()
  await step(
    'Files dims and italicizes git ignored entries but keeps tracked files unmarked',
    (await treeFile('ignored.txt').evaluate((el) => {
      const style = getComputedStyle(el)
      return style.opacity === '0.5' && style.fontStyle === 'italic'
    })) &&
      (await treeFile('README.md').evaluate((el) => {
        const style = getComputedStyle(el)
        return style.opacity === '1' && style.fontStyle !== 'italic'
      })),
    'ignored.txt visible at opacity 0.5 and italic; tracked README.md normal',
  )
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
  const permissionMode = page.getByRole('button', { name: 'Task approval mode' })
  await step(
    'Dev composer shows its task approval mode',
    await visible(permissionMode),
    'selector visible',
  )
  await permissionMode.click()
  await page.getByRole('menuitemradio', { name: /^Supervised/ }).click()
  await step(
    'changing Dev approval mode updates the composer button',
    (await permissionMode.innerText()).includes('Supervised'),
    await permissionMode.innerText(),
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
  const agentMenu = page.getByRole('menu', { name: 'New session agent', exact: true })
  await agentMenu.waitFor()
  await step(
    'plus opens usable agents including OpenCode with last used agent preselected',
    (await agentMenu.getByRole('menuitemradio').first().innerText()) === 'Claude' &&
      (await agentMenu.getByRole('menuitemradio').first().getAttribute('aria-checked')) ===
        'true' &&
      (await agentMenu.getByRole('menuitemradio', { name: 'OpenCode', exact: true }).count()) ===
        1 &&
      (await agentMenu
        .getByRole('menuitemradio', { name: 'OpenCode', exact: true })
        .innerText()) === 'OpenCode',
    await agentMenu.innerText(),
  )
  await shot('new-session-agent-menu')
  const beforeNew = await tabs.getByRole('tab').count()
  await page.keyboard.press('Escape')
  await step(
    'Escape closes menu without creating a tab',
    (await agentMenu.count()) === 0 && (await tabs.getByRole('tab').count()) === beforeNew,
    'tab count unchanged',
  )
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  await agentMenu.waitFor()
  await page.keyboard.press('Enter')
  const fresh = page.locator('[data-dev-new-session]')
  await fresh.getByText('CLI default', { exact: true }).waitFor()
  await step(
    'Enter creates with last used Claude and its unassigned CLI default',
    (await tabs.locator('[data-new-session-tab][aria-selected="true"]').count()) === 1 &&
      (await fresh.locator('textarea').getAttribute('placeholder')) ===
        'Message Claude… / for commands, @ for files',
    await fresh.innerText(),
  )
  await step(
    'New session exposes the task approval mode selector',
    await visible(fresh.getByRole('button', { name: 'Task approval mode', exact: true })),
  )
  await page.getByRole('button', { name: 'Close tab New session', exact: true }).click()
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  await agentMenu.waitFor()
  await page.keyboard.press('ArrowDown')
  await step(
    'arrow keys move the preselected agent',
    (await agentMenu
      .getByRole('menuitemradio', { name: 'Codex', exact: true })
      .getAttribute('aria-checked')) === 'true',
    'Codex selected',
  )
  await agentMenu.getByRole('menuitemradio', { name: 'Codex', exact: true }).click()
  await fresh
    .getByRole('heading', { name: `What should we work on in ${basename(root)}?`, exact: true })
    .waitFor()
  await fresh.getByRole('button', { name: /Luna.*medium/i }).waitFor()
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
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  await agentMenu.waitFor()
  await step(
    'chosen Codex becomes first and preselected',
    (await agentMenu.getByRole('menuitemradio').first().innerText()) === 'Codex' &&
      (await agentMenu.getByRole('menuitemradio').first().getAttribute('aria-checked')) === 'true',
    await agentMenu.innerText(),
  )
  await fresh.getByRole('heading').click()
  await step(
    'click outside closes without creating',
    (await agentMenu.count()) === 0 && (await tabs.getByRole('tab').count()) === 3,
    'three tabs remain',
  )
  await reloadChat()
  await enterDev()
  await fresh.waitFor()
  await fresh
    .locator('textarea[placeholder="Message Codex… / for commands, @ for files"]')
    .waitFor()
  await step(
    'reload restores active New session alongside sessions and fixed files',
    (await tabs.getByRole('tab').count()) === 3 &&
      (await tab(1).count()) === 1 &&
      (await fileTab('context.json').count()) === 1 &&
      (await fresh.locator('textarea').getAttribute('placeholder')) ===
        'Message Codex… / for commands, @ for files',
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
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  await agentMenu.waitFor()
  await page.screenshot({ path: '/tmp/UI.47-menu.png' })
  const [createdTerminal] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/chat/sessions' &&
        response.request().method() === 'POST',
    ),
    agentMenu.getByRole('menuitemradio', { name: 'OpenCode', exact: true }).click(),
  ])
  const terminalSession = await createdTerminal.json()
  const terminalTab = tabs.locator(`[data-session-tab="${terminalSession.id}"]`)
  const terminal = page.getByRole('region', { name: 'OpenCode terminal' })
  await terminal.waitFor()
  await shot('opencode-terminal-starting')
  await terminal
    .locator('.xterm-rows')
    .getByText('OpenCode terminal fixture ready', { exact: false })
    .waitFor()
  await step(
    'OpenCode creates a session directly and mounts a live terminal',
    terminalSession.agent === 'opencode' &&
      !terminalSession.lastModel &&
      !terminalSession.lastEffort &&
      (await terminalTab.getAttribute('aria-selected')) === 'true' &&
      (await terminalTab.locator('[aria-hidden="true"]').count()) === 1 &&
      (await fresh.count()) === 0 &&
      (await visible(terminal.locator('.xterm'))),
    JSON.stringify(terminalSession),
  )
  await shot('opencode-terminal-tab')
  await page.screenshot({ path: '/tmp/UI.47-opencode.png' })
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  await agentMenu.waitFor()
  await step(
    'OpenCode counts as last used agent',
    (await agentMenu.getByRole('menuitemradio').first().getAttribute('aria-label')) ===
      'OpenCode' &&
      (await agentMenu.getByRole('menuitemradio').first().getAttribute('aria-checked')) === 'true',
    await agentMenu.innerText(),
  )
  await page.keyboard.press('Escape')
  await terminalTab.hover()
  await page.getByRole('button', { name: 'Close tab OpenCode', exact: true }).click()
  // UI.48: git patches share the center tab row with files and sessions.
  writeFileSync(join(root, 'README.md'), '# Updated diff heading\n')
  writeFileSync(join(root, 'notes.txt'), 'Updated preview\n')
  await page.getByRole('button', { name: 'Diff', exact: true }).click()
  const diffFile = (path) => page.locator(`[data-diff-file="${path}"]`)
  const diffTab = (path) => tabs.locator(`[data-diff-tab="${path}"]`)
  const diffPanel = page.locator('[data-dev-diff-panel]')
  await diffFile('README.md').click()
  await diffPanel
    .locator('[data-diff-added]')
    .filter({ hasText: '+# Updated diff heading' })
    .waitFor()
  await diffPanel
    .locator('[data-diff-removed]')
    .filter({ hasText: '-# Dev session tabs' })
    .waitFor()
  await step(
    'Diff click opens an italic selected patch at full center with colored numbered lines',
    (await diffTab('README.md').evaluate((el) => getComputedStyle(el).fontStyle === 'italic')) &&
      (await diffFile('README.md').getAttribute('aria-pressed')) === 'true' &&
      (await diffFile('README.md').getAttribute('aria-expanded')) === null &&
      (await diffPanel.evaluate(
        (el) =>
          Math.abs(
            el.getBoundingClientRect().width - el.parentElement.getBoundingClientRect().width,
          ) < 2,
      )) &&
      (await diffPanel
        .locator('[data-diff-added]')
        .first()
        .evaluate(
          (el) =>
            getComputedStyle(el).color !== getComputedStyle(el.parentElement).color &&
            el.children[1].textContent === '1',
        )),
    await diffPanel.innerText(),
  )
  await shot('diff-center-preview')
  await diffFile('notes.txt').click()
  await diffPanel.getByText('+Updated preview', { exact: true }).waitFor()
  await step(
    'another diff replaces the preview',
    (await diffTab('README.md').count()) === 0,
    'notes.txt preview replaces README.md',
  )
  await diffFile('README.md').dblclick()
  await diffPanel.getByText('+# Updated diff heading', { exact: true }).waitFor()
  await step(
    'Diff double click pins the patch',
    await diffTab('README.md').evaluate((el) => getComputedStyle(el).fontStyle !== 'italic'),
    'fixed README.md diff',
  )
  await diffPanel.getByRole('button', { name: 'Open file', exact: true }).click()
  await panel.getByRole('heading', { name: 'Updated diff heading', exact: true }).waitFor()
  await step(
    'Open file opens a distinct fixed normal file tab',
    (await diffTab('README.md').count()) === 1 &&
      (await fileTab('README.md').getAttribute('aria-selected')) === 'true' &&
      (await fileTab('README.md').evaluate((el) => getComputedStyle(el).fontStyle !== 'italic')),
    'file:README.md and diff:README.md coexist',
  )
  writeFileSync(join(root, 'README.md'), '# Refreshed working tree\n')
  await page.getByRole('button', { name: 'Refresh git changes', exact: true }).click()
  await diffTab('README.md').click()
  await diffPanel.getByText('+# Refreshed working tree', { exact: true }).waitFor()
  await step(
    'reactivating diff reloads changed working tree',
    (await diffFile('README.md').getAttribute('aria-pressed')) === 'true',
    await diffPanel.innerText(),
  )
  await shot('diff-center-pinned')
  await reloadChat()
  await enterDev()
  await diffPanel.getByText('+# Refreshed working tree', { exact: true }).waitFor()
  await step(
    'reload restores active fixed diff beside the normal file',
    (await diffTab('README.md').getAttribute('aria-selected')) === 'true' &&
      (await fileTab('README.md').count()) === 1,
    'fixed diff restored',
  )
  // Deleted files keep their diff but cannot open a normal file.
  unlinkSync(join(root, 'notes.txt'))
  await page.getByRole('button', { name: 'Diff', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh git changes', exact: true }).click()
  await diffFile('notes.txt').click()
  await diffPanel.getByText('-Preview only', { exact: true }).waitFor()
  await step(
    'deleted file diff disables Open file',
    await diffPanel.getByRole('button', { name: 'Open file', exact: true }).isDisabled(),
    'deleted notes.txt',
  )
  // A failed patch request must render the same message as the old panel.
  expectHttpError(/\/api\/git\/diff\?/)
  await page.route('**/api/git/diff?*', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  )
  await fileTab('README.md').click()
  await diffTab('README.md').click()
  await diffPanel.getByRole('alert').waitFor()
  await step(
    'patch failure is visible inside the center tab',
    (await diffPanel.getByRole('alert').innerText()) === 'Could not read git changes',
    'same error as inspector',
  )
  await page.unroute('**/api/git/diff?*')
  await step('0 console errors', consoleErrors().length === 0, consoleErrors().join('; ') || 'none')
}
