import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run, writeGateRoles } from '../lib.mjs'

export default async function keybindings({
  page,
  api,
  step,
  shot,
  cleanup,
  visible,
  hidden,
  consoleErrors,
}) {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-keybindings-'))
  mkdirSync(join(root, 'src'))
  writeFileSync(join(root, 'src/index.ts'), 'export const shortcutFixture = true\n')
  writeFileSync(join(root, 'package.json'), '{}\n')
  run('git', ['init', '-q'], root)
  run('git', ['add', 'src/index.ts', 'package.json'], root)
  run(
    'git',
    ['-c', 'user.name=Gate', '-c', 'user.email=gate@example.test', 'commit', '-qm', 'fixture'],
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
    if ((await api('/api/projects')).data.some((item) => item.id === project.id))
      throw new Error('fixture project remains after purge')
    rmSync(root, { recursive: true, force: true })
  })
  await page.evaluate((projectId) => {
    localStorage.setItem('orchestos-last-project', projectId)
    localStorage.removeItem('orchestos-last-dev')
    localStorage.removeItem('orchestos-dev-tabs')
  }, project.id)
  await page.reload()
  await page.getByRole('button', { name: 'Dev', exact: true }).waitFor()
  const primary = await page.evaluate(() => (/Mac/.test(navigator.platform) ? 'Meta' : 'Control'))
  const tabs = page.locator('[data-dev-session-tabs]')
  const fileTab = page.locator('[data-file-tab="src/index.ts"]')
  const dialog = page.locator('[data-go-to-file]')
  const press = (key) => page.keyboard.press(key)

  await press('Alt+2')
  await tabs.waitFor()
  await page
    .getByRole('heading', { name: `What should we work on in ${basename(root)}?`, exact: true })
    .waitFor()
  await step('Alt+2 enters Dev', await visible(tabs))
  await shot('mode-dev')
  await press(`${primary}+p`)
  await dialog.waitFor()
  await dialog.getByPlaceholder('Go to file…').fill('index')
  await dialog.getByRole('option', { name: /index\.ts/ }).waitFor()
  await step('primary P searches project files', await visible(dialog))
  await shot('go-to-file')
  // A modal owns its keys, so switching modes while it is open is ignored.
  await press('Alt+1')
  await step(
    'open modal blocks global mode shortcuts',
    (await visible(tabs)) && (await visible(dialog)),
  )
  await press('Enter')
  await fileTab.waitFor()
  await page.locator('[data-file-editor] .cm-content').waitFor()
  await step(
    'Enter opens src/index.ts in a tab',
    (await fileTab.getAttribute('aria-selected')) === 'true' && (await dialog.count()) === 0,
  )
  await shot('opened-file')
  const before = await fileTab.getAttribute('data-file-tab')
  await press('Alt+BracketRight')
  await step(
    'Alt+] selects the next tab circularly',
    (await fileTab.getAttribute('aria-selected')) === 'false',
  )
  await shot('next-tab')
  await press('Alt+BracketLeft')
  await step(
    'Alt+[ selects the previous tab',
    (await fileTab.getAttribute('aria-selected')) === 'true' && before === 'src/index.ts',
  )
  await shot('previous-tab')
  await press('Alt+w')
  await step('Alt+W closes the file tab', (await fileTab.count()) === 0)
  await shot('closed-tab')
  await press('Control+Backquote')
  const terminal = page.locator('[data-dev-terminal]:not([hidden]) .xterm')
  await terminal.waitFor()
  await terminal.locator('textarea').focus()
  await press('Alt+1')
  await step(
    'terminal focus keeps Alt+1 in Dev',
    (await visible(tabs)) && (await visible(terminal)),
  )
  await shot('terminal-focus')
  const sidebar = page.getByRole('button', { name: 'Dev', exact: true })
  if (primary === 'Control') {
    for (const key of ['k', 'p', 'b', ',']) {
      await press(`Control+${key}`)
      await step(
        `terminal keeps Ctrl+${key}`,
        (await visible(terminal)) &&
          (await visible(sidebar)) &&
          (await dialog.count()) === 0 &&
          (await page.getByRole('dialog').count()) === 0,
      )
    }
    await shot('terminal-control-shortcuts')
    await page.locator('[data-dev-session-tabs] [role="tab"][aria-selected="true"]').click()
  }
  await press(`${primary}+b`)
  await step('primary B hides sidebar with eligible focus', await hidden(sidebar))
  await shot('sidebar-hidden')
  await press(`${primary}+b`)
  await step('primary B restores sidebar', await visible(sidebar))
  await shot('sidebar-visible')
  const inspector = page.locator('[data-inspector-tabs]')
  await press(`${primary}+Alt+b`)
  await step('primary Alt B hides right panel', await hidden(inspector))
  await shot('right-panel-hidden')
  await press(`${primary}+Alt+b`)
  await step('primary Alt B restores right panel', await visible(inspector))
  await shot('right-panel-visible')
  await page.locator('[data-dev-session-tabs] [role="tab"][aria-selected="true"]').click()
  await press(`${primary}+,`)
  await page.getByRole('button', { name: 'Keybindings', exact: true }).click()
  await page.locator('[data-keybinding]').nth(16).waitFor()
  await step(
    'Settings lists all 17 commands with platform keys',
    (await page.locator('[data-keybinding]').count()) === 17 &&
      (await page.locator('[data-keybinding="go-to-file"] kbd').allTextContents()).join(' ') ===
        `${primary === 'Meta' ? '⌘' : 'Ctrl'} P`,
  )
  await shot('settings-keybindings')
  await press(`${primary}+k`)
  const settingsSearch = page.getByRole('dialog', { name: 'Search settings', exact: true })
  await step('primary K belongs to Settings in Settings', await visible(settingsSearch))
  const describeActiveElement = () =>
    page.evaluate(() => {
      const element = document.activeElement
      return element
        ? {
            tag: element.tagName,
            ariaLabel: element.getAttribute('aria-label'),
            data: Object.fromEntries(
              element
                .getAttributeNames()
                .filter((name) => name.startsWith('data-'))
                .map((name) => [name, element.getAttribute(name)]),
            ),
          }
        : null
    })
  const activeElementAtEscape = await describeActiveElement()
  await press('Escape')
  try {
    await settingsSearch.waitFor({ state: 'detached' })
  } catch (error) {
    const activeElement = await describeActiveElement()
    throw new Error(
      `Search settings Escape failed: document.activeElement=${JSON.stringify(activeElement)}; activeElementAtEscape=${JSON.stringify(activeElementAtEscape)}; ${error.message}`,
    )
  }
  await press('Alt+2')
  await tabs.waitFor()
  await press(`${primary}+k`)
  const palette = page.getByRole('dialog', { name: 'Command palette', exact: true })
  await palette.waitFor()
  const paletteText = await palette.innerText()
  await step(
    'palette uses real commands with shortcuts and no prototype models',
    !paletteText.includes('Claude 3.7') &&
      !paletteText.includes('Gemini') &&
      !paletteText.includes('36 Languages') &&
      (await palette.getByPlaceholder('Type a command…').count()) === 1 &&
      paletteText.includes('Esc to close') &&
      !paletteText.includes('OrchestOS CLI') &&
      (await palette.locator('kbd').count()) >= 12,
  )
  await shot('command-palette')
  // Open every navigation target retained in the palette, in the real UI.
  for (const title of ['Chat', 'Plan', 'Runs', 'Specs', 'Instincts', 'Memory', 'Skills', 'Graph']) {
    if (title !== 'Chat') {
      await press('Alt+2')
      await press(`${primary}+k`)
      await palette.waitFor()
    }
    await palette.getByRole('button', { name: `Go to ${title}`, exact: true }).click()
    if (title === 'Chat') {
      await step(
        'Go to Chat opens Chat',
        await visible(page.getByRole('button', { name: 'New chat', exact: true })),
      )
    } else {
      const target = page
        .locator('[data-project-tab]')
        .filter({ hasText: new RegExp(`^${title}$`) })
      const content = {
        Plan: '[data-plan-view]',
        Runs: 'input[placeholder="Search runs by ID, task or description..."]',
        Specs: '[data-view="specs"]',
        Instincts: '[data-instincts-view]',
        Memory: '[data-view="memory"]',
        Skills: '[data-view="skills"]',
        Graph: '[data-view="graph"]',
      }[title]
      await page.locator(content).waitFor()
      await step(
        `Go to ${title} opens its Settings view`,
        (await target.getAttribute('class')).includes('bg-app-elevated') &&
          (await visible(page.locator(content))),
      )
    }
    await shot(`navigation-${title.toLowerCase()}`)
  }
  await press('Alt+1')
  await press(`${primary}+p`)
  await dialog.getByPlaceholder('Go to file…').fill('index')
  await dialog.getByRole('option', { name: /index\.ts/ }).waitFor()
  await press('ArrowDown')
  await press('ArrowUp')
  await press('Enter')
  await fileTab.waitFor()
  await step(
    'Go to file from Chat enters Dev and opens file',
    (await fileTab.getAttribute('aria-selected')) === 'true',
  )
  await shot('file-from-chat')
  await press('Alt+n')
  const agentSelector = page.getByRole('dialog').filter({ has: page.locator('#new-agent-title') })
  await agentSelector.waitFor()
  await step(
    'Alt N leaves Dev and opens the New chat selector',
    await visible(page.getByRole('button', { name: 'New chat', exact: true })),
  )
  await shot('new-chat-selector')
  await press(`${primary}+p`)
  await step(
    'agent selector blocks global commands',
    (await dialog.count()) === 0 && (await visible(agentSelector)),
  )
  await agentSelector.getByRole('button', { name: 'Close modal', exact: true }).click()

  await press(`${primary}+,`)
  await page.getByRole('button', { name: 'Keybindings', exact: true }).click()
  const row = (id) => page.locator(`[data-keybinding="${id}"]`)
  const record = (id) => row(id).locator('[data-keybinding-record]')
  const reassign = `${primary}+Shift+e`
  await record('toggle-sidebar').click()
  await step(
    'click begins recording',
    (await record('toggle-sidebar').innerText()) === 'Press keys…',
  )
  await shot('recording')
  await press(reassign)
  const display = primary === 'Meta' ? '⌘ ⇧ E' : 'Ctrl Shift E'
  await step(
    'recorded chord displayed',
    (await row('toggle-sidebar').locator('kbd').allTextContents()).join(' ') === display,
  )
  await press('Alt+2')
  await tabs.waitFor()
  await press(reassign)
  await step('reassigned chord hides sidebar', await hidden(sidebar))
  await press(`${primary}+b`)
  await step('old chord no longer toggles sidebar', await hidden(sidebar))
  await press(reassign)
  await step('reassigned chord restores sidebar', await visible(sidebar))
  await press(`${primary}+,`)
  await page.getByRole('button', { name: 'Keybindings', exact: true }).click()
  await record('go-to-file').click()
  await press(reassign)
  await step(
    'overlapping chord reports conflict',
    (await row('go-to-file').innerText()).includes('Used by Toggle sidebar'),
  )
  await shot('conflict')
  const replace = row('go-to-file').getByRole('button', { name: 'Replace', exact: true })
  await step(
    'conflict focuses Replace',
    await replace.evaluate((el) => el === document.activeElement),
  )
  await press('Tab')
  await step(
    'Tab reaches Cancel during a conflict',
    await row('go-to-file')
      .getByRole('button', { name: 'Cancel', exact: true })
      .evaluate((el) => el === document.activeElement),
  )
  await press('Shift+Tab')
  await press('Enter')
  await step(
    'keyboard Replace applies the recorded chord',
    (await row('go-to-file').locator('kbd').allTextContents()).join(' ') === display &&
      (await replace.count()) === 0,
  )
  await step(
    'replace disables prior command',
    (await record('toggle-sidebar').innerText()) === 'Disabled',
  )
  await record('go-to-file').click()
  await press(`${primary}+w`)
  await step(
    'browser chord rejected while recording',
    (await row('go-to-file').getByRole('alert').innerText()) === 'Reserved by the browser' &&
      (await record('go-to-file').innerText()) === 'Press keys…',
  )
  await shot('reserved')
  await press('Escape')
  await record('new-chat').click()
  await press('Delete')
  await step('Delete disables new chat', (await record('new-chat').innerText()) === 'Disabled')
  await press('Alt+2')
  await press('Alt+n')
  await step(
    'disabled Alt N does nothing',
    (await agentSelector.count()) === 0 && (await visible(tabs)),
  )
  await press(`${primary}+,`)
  await page.getByRole('button', { name: 'Keybindings', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Dev', exact: true }).waitFor()
  await press(`${primary}+,`)
  await page.getByRole('button', { name: 'Keybindings', exact: true }).click()
  await record('go-to-file').waitFor()
  await step(
    'reload preserves overrides',
    (await record('new-chat').innerText()) === 'Disabled' &&
      (await record('toggle-sidebar').innerText()) === 'Disabled' &&
      (await row('go-to-file').locator('kbd').allTextContents()).join(' ') === display,
  )
  await page.getByRole('button', { name: 'Reset all', exact: true }).click()
  await step(
    'Reset all restores defaults and removes overrides',
    (await row('toggle-sidebar').locator('kbd').allTextContents()).join(' ') ===
      `${primary === 'Meta' ? '⌘' : 'Ctrl'} B` &&
      (await page.getByRole('button', { name: 'Reset all', exact: true }).count()) === 0 &&
      (await page.evaluate(
        () => Object.keys(JSON.parse(localStorage.getItem('orchestos-keybindings'))).length === 0,
      )),
  )
  await press('Alt+2')
  await press(`${primary}+b`)
  await step('default primary B works after Reset all', await hidden(sidebar))
  await press(`${primary}+b`)
  await shot('defaults-restored')
  await step('0 console errors', consoleErrors().length === 0, consoleErrors().join('; ') || 'none')
}
