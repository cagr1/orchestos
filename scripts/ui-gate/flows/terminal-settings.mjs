import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run } from '../lib.mjs'

export default async function terminalSettings({
  page,
  base,
  api,
  step,
  visible,
  cleanup,
  shot,
  consoleErrors,
}) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-termsettings-'))
  writeFileSync(join(projectRoot, 'README.md'), '# Dev terminal gate\n')
  run('git', ['init', '-q'], projectRoot)
  run('git', ['add', 'README.md'], projectRoot)
  run(
    'git',
    [
      '-c',
      'user.name=ui-gate',
      '-c',
      'user.email=ui-gate@example.invalid',
      'commit',
      '-qm',
      'fixture',
    ],
    projectRoot,
  )
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', projectRoot], process.cwd())
  const projects = await api('/api/projects')
  const project = (projects.data ?? []).find(
    (item) => item.path === projectRoot || item.path === realpathSync(projectRoot),
  )
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })

  await page.evaluate(() => {
    localStorage.removeItem('orchestos-terminal')
    localStorage.removeItem('orchestos-appearance')
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  const toggle = page.locator('[data-terminal-toggle]')
  await step('Chat no muestra el botón Terminal', (await toggle.count()) === 0)
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const escaped = basename(projectRoot).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await page
    .getByRole('button', { name: new RegExp(`^${escaped}(?:\\s|$)`) })
    .first()
    .click()
  await step('Dev muestra el botón Terminal', await visible(toggle))
  const sockets = []
  page.on('websocket', (socket) => {
    if (socket.url().includes('/api/terminal')) {
      const tracked = { socket, closed: false }
      socket.on('close', () => {
        tracked.closed = true
      })
      sockets.push(tracked)
    }
  })
  await toggle.click()
  const panel = page.getByRole('region', { name: 'Project terminal', includeHidden: true })
  const tab = page.getByRole('tab', { name: 'Terminal', exact: true })
  await step(
    'Terminal abre como pestaña activa central',
    (await visible(panel)) && (await tab.getAttribute('aria-selected')) === 'true',
  )
  await step(
    'Terminal ocupa todo el espacio bajo las pestañas',
    await panel.evaluate((el) => {
      const area = el.parentElement.parentElement
      const rect = el.getBoundingClientRect()
      const tabs = area.querySelector('[data-dev-session-tabs]').getBoundingClientRect()
      const center = area.getBoundingClientRect()
      return (
        Math.abs(rect.width - center.width) < 2 &&
        Math.abs(rect.height - (center.height - tabs.height)) < 2
      )
    }),
  )
  await page.waitForTimeout(2_000)
  const rows = panel.locator('.xterm-rows')
  const waitEcho = async (needle) => {
    for (let i = 0; i < 20; i++) {
      if (
        ((await rows.innerText().catch(() => '')).match(new RegExp(needle, 'g')) ?? []).length >= 2
      )
        return true
      await page.waitForTimeout(250)
    }
    return false
  }
  const waitOutputLine = async (needle) => {
    for (let i = 0; i < 20; i++) {
      const lines = (await rows.innerText().catch(() => '')).split('\n')
      if (lines.some((line) => line.trim() === needle)) return true
      await page.waitForTimeout(250)
    }
    return false
  }
  await page.keyboard.type('echo ui58-focus')
  await page.keyboard.press('Enter')
  await step('al abrir, el foco está en el PTY y echo produce salida', await waitEcho('ui58-focus'))
  const checkScreenBounds = async (scale) => {
    const bounds = await panel.evaluate((el) => {
      const panel = el.getBoundingClientRect().toJSON()
      const screen = el.querySelector('.xterm-screen').getBoundingClientRect().toJSON()
      return { panel, screen }
    })
    const { panel: area, screen } = bounds
    await step(
      `terminal screen fits panel at ${scale} percent`,
      screen.width > 0 &&
        screen.height > 0 &&
        screen.left >= area.left - 2 &&
        screen.top >= area.top - 2 &&
        screen.right <= area.right + 2 &&
        screen.bottom <= area.bottom + 2,
      JSON.stringify(bounds),
    )
  }
  await checkScreenBounds(100)
  await shot('dev-terminal')
  const selectedText = () =>
    panel.locator('.xterm').evaluate((el) => {
      const clipboardData = new DataTransfer()
      el.dispatchEvent(
        new ClipboardEvent('copy', { clipboardData, bubbles: true, cancelable: true }),
      )
      return clipboardData.getData('text/plain')
    })
  const initialSockets = sockets.length
  const measure = () =>
    rows.evaluate((el) => {
      const row = el.firstElementChild
      return {
        height: row.getBoundingClientRect().height,
        count: el.childElementCount,
        width: row.getBoundingClientRect().width,
        font: getComputedStyle(el).fontFamily,
      }
    })
  const before = await measure()
  const [other] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate((url) => window.open(url, '_blank'), base),
  ])
  try {
    await other.waitForLoadState('domcontentloaded')
    await other.getByRole('button', { name: 'Settings', exact: true }).click()
    await other.getByText('Loading live settings…', { exact: true }).waitFor({ state: 'hidden' })
    const sidebar = other
      .locator('aside')
      .filter({ has: other.getByRole('button', { name: 'Back to app', exact: true }) })
    await sidebar.getByRole('button', { name: 'Terminal', exact: true }).click()
    await other.getByRole('spinbutton', { name: 'Font size', exact: true }).fill('16')
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('.xterm-rows')).fontSize === '16px',
    )
    await page.waitForTimeout(300)
    const after = await measure()
    await step(
      'font size updates live, refits rows and preserves socket and output',
      after.height > before.height &&
        after.count < before.count &&
        sockets.length === initialSockets &&
        !sockets.at(-1).closed &&
        (await waitOutputLine('ui58-focus')),
      JSON.stringify({ before, after }),
    )
    await other.getByRole('radio', { name: 'Bar', exact: true }).click()
    await other.getByRole('switch', { name: 'Cursor blink', exact: true }).uncheck()
    await panel.locator('.xterm-helper-textarea').focus()
    await panel.locator('.xterm-cursor-bar:not(.xterm-cursor-blink)').waitFor()
    await step(
      'bar cursor stops blinking',
      await panel
        .locator('.xterm-cursor-bar')
        .evaluate((el) => !el.classList.contains('xterm-cursor-blink')),
    )
    await other.getByRole('spinbutton', { name: 'Line height', exact: true }).fill('1.5')
    await page.waitForFunction(
      (height) =>
        document.querySelector('.xterm-rows > div').getBoundingClientRect().height > height,
      after.height,
    )
    await step('line height updates mounted terminal', (await measure()).height > after.height)
    await other.getByRole('spinbutton', { name: 'Scrollback', exact: true }).fill('100')
    await other
      .getByRole('textbox', { name: 'Font family', exact: true })
      .fill('Courier New, monospace')
    await other.getByRole('textbox', { name: 'Font family', exact: true }).press('Enter')
    await page.waitForFunction(() =>
      getComputedStyle(document.querySelector('.xterm-rows')).fontFamily.includes('Courier New'),
    )
    await step(
      'font family reaches the mounted xterm',
      (await measure()).font.includes('Courier New'),
    )
    await panel.locator('.xterm-helper-textarea').focus()
    await page.keyboard.type("printf 'ADE9-%s\\n' $(seq 1 300)")
    await page.keyboard.press('Enter')
    await page.waitForFunction(() =>
      document.querySelector('.xterm-rows').textContent.includes('ADE9-300'),
    )
    await panel.locator('.xterm-helper-textarea').focus()
    const primary = await page.evaluate(() => (/Mac/.test(navigator.platform) ? 'Meta' : 'Control'))
    await page.keyboard.press(`${primary}+a`)
    const bufferText = await selectedText()
    await step(
      'scrollback discards line 1 after 300 lines',
      bufferText.includes('ADE9-300') && !/(?:^|\n)ADE9-(?:1|100)\r?\n/.test(bufferText),
      bufferText,
    )
    await other.getByRole('textbox', { name: 'Search settings', exact: true }).click()
    const search = other.getByRole('dialog', { name: /Search settings/ })
    await search.getByRole('combobox').fill('scrollback')
    await search.getByRole('option', { name: 'Scrollback', exact: true }).click()
    await other
      .locator('[data-settings-anchor="terminal-scrollback"] [data-settings-highlight]')
      .waitFor({ state: 'attached' })
    await step(
      'search reaches scrollback row',
      (await other
        .locator('[data-settings-anchor="terminal-scrollback"] [data-settings-highlight]')
        .count()) === 1,
    )
    const beforeScale = await measure()
    await sidebar.getByRole('button', { name: 'Appearance', exact: true }).click()
    await other.getByRole('combobox', { name: 'Interface scale', exact: true }).selectOption('1.25')
    await page.waitForFunction(() => document.documentElement.style.zoom === '1.25')
    await page.waitForFunction(
      (height) =>
        document.querySelector('.xterm-rows > div').getBoundingClientRect().height > height,
      beforeScale.height,
    )
    const afterScale = await measure()
    await checkScreenBounds(125)
    await step(
      '125 percent UI scale increases terminal row height without reconnecting',
      afterScale.height > beforeScale.height &&
        sockets.length === initialSockets &&
        !sockets.at(-1).closed,
      JSON.stringify({ beforeScale, afterScale }),
    )
    await sidebar.getByRole('button', { name: 'Terminal', exact: true }).click()
    await step(
      'Terminal settings retain the chosen font size at 125 percent',
      (await other.getByRole('spinbutton', { name: 'Font size', exact: true }).inputValue()) ===
        '16',
    )
    await panel.locator('.xterm-helper-textarea').focus()
    await page.keyboard.type("printf '\\033[2J\\033[HADE9-selection-0123456789'")
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    const line = rows
      .locator(':scope > div')
      .filter({ hasText: 'ADE9-selection-0123456789' })
      .first()
    const box = await line.boundingBox()
    const cell = await line.evaluate((el) => {
      const range = document.createRange()
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      const node = walker.nextNode()
      range.setStart(node, 0)
      range.setEnd(node, 1)
      return range.getBoundingClientRect().width
    })
    const points = {
      start: { x: box.x + cell * 0.1, y: box.y + box.height / 2 },
      end: { x: box.x + cell * 14.1, y: box.y + box.height / 2 },
    }
    const hits = await panel.locator('.xterm').evaluate(
      (el, points) =>
        Object.fromEntries(
          Object.entries(points).map(([name, point]) => {
            const hit = document.elementFromPoint(point.x, point.y)
            return [
              name,
              { inside: hit !== null && el.contains(hit), target: hit?.className ?? null },
            ]
          }),
        ),
      points,
    )
    const inside = hits.start.inside && hits.end.inside
    await step(
      'mouse drag endpoints hit xterm at 125 percent',
      inside,
      JSON.stringify({ points, hits }),
    )
    if (inside) {
      await page.mouse.move(points.start.x, points.start.y)
      await page.mouse.down()
      await page.mouse.move(points.end.x, points.end.y, { steps: 15 })
      await page.mouse.up()
    }
    const selection = await selectedText()
    await step(
      'mouse selects correct cells at 125 percent',
      inside && selection === 'ADE9-selection',
      JSON.stringify({ selection, points, hits }),
    )
    await shot('terminal-settings-125')
    await sidebar.getByRole('button', { name: 'Terminal', exact: true }).click()
    await other.reload({ waitUntil: 'domcontentloaded' })
    await other
      .getByRole('button', { name: 'Settings', exact: true })
      .click()
      .catch(() => {})
    await other.getByText('Loading live settings…', { exact: true }).waitFor({ state: 'hidden' })
    await sidebar.getByRole('button', { name: 'Terminal', exact: true }).click()
    await step(
      'font family persists after reload',
      (await other.getByRole('textbox', { name: 'Font family', exact: true }).inputValue()) ===
        'Courier New, monospace',
    )
    await step(
      'dashboard has no pageerrors',
      consoleErrors().length === 0,
      consoleErrors().join('; '),
    )
  } finally {
    await other.close()
    await page.evaluate(() => {
      localStorage.removeItem('orchestos-terminal')
      localStorage.removeItem('orchestos-appearance')
    })
    await tab.hover()
    await page.getByRole('button', { name: 'Close tab Terminal', exact: true }).click()
  }
}
