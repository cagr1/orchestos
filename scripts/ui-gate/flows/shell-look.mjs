import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { writeGateRoles } from '../lib.mjs'

// UI.26.1 — forma del marco: filas planas, iconos de un tono, sin líneas entre barra y panel.
const PALETTE =
  '\\b(?:emerald|zinc|rose|sky|amber|teal|purple|indigo|blue|red|green|slate|gray|violet|pink|cyan|orange|yellow)-\\d+\\b'

async function inspect(page, panelSelector) {
  return page.evaluate(
    ({ palette, panelSelector }) => {
      const re = new RegExp(palette)
      const visible = (el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
      }
      const sidebars = [...document.querySelectorAll('aside')].filter(visible)
      const header = document.querySelector('header')
      const panel =
        panelSelector === 'main' ? document.querySelector('main') : sidebars[0]?.nextElementSibling
      const isActive = (row) => {
        const c = row.classList
        return (
          row.getAttribute('aria-current') === 'page' ||
          (c.contains('text-app') &&
            (c.contains('bg-app-surface') || c.contains('bg-app-elevated')))
        )
      }
      const rows = sidebars.flatMap((aside) =>
        [...aside.querySelectorAll('button, [role="button"]')].filter(visible),
      )
      const rowFacts = rows.map((row) => {
        const cs = getComputedStyle(row)
        return {
          label: (row.textContent || row.getAttribute('aria-label') || '').trim().slice(0, 30),
          borderTop: Number.parseFloat(cs.borderTopWidth) || 0,
          shadow: cs.boxShadow,
        }
      })
      const iconColors = [
        ...new Set(
          rows
            .filter((row) => !isActive(row))
            .flatMap((row) => [...row.querySelectorAll('svg')])
            .map((svg) => getComputedStyle(svg).color),
        ),
      ]
      const chrome = [...sidebars, ...(header ? [header] : [])]
      const paletteHits = chrome
        .flatMap((root) => [root, ...root.querySelectorAll('*')])
        .map((el) => el.getAttribute('class') || '')
        .filter((cls) => re.test(cls))
      return {
        sidebars: sidebars.length,
        flatViolations: rowFacts.filter((f) => f.borderTop > 0 || f.shadow !== 'none'),
        iconColors,
        sidebarBorderRight: sidebars.map(
          (a) => Number.parseFloat(getComputedStyle(a).borderRightWidth) || 0,
        ),
        headerBorderBottom: header
          ? Number.parseFloat(getComputedStyle(header).borderBottomWidth) || 0
          : -1,
        panelBg: panel ? getComputedStyle(panel).backgroundColor : null,
        sidebarBg: sidebars[0] ? getComputedStyle(sidebars[0]).backgroundColor : null,
        paletteHits: paletteHits.slice(0, 5),
      }
    },
    { palette: PALETTE, panelSelector },
  )
}

export default async function shellLook({
  page,
  api,
  step,
  shot,
  visible,
  hidden,
  cleanup,
  databasePath,
}) {
  const settle = () => page.waitForTimeout(700)
  await visible(page.getByRole('button', { name: 'Settings', exact: true }))

  for (const [view, panelSelector] of [
    ['chat', 'sibling'],
    ['settings', 'main'],
  ]) {
    if (view === 'settings') {
      await page.getByRole('button', { name: 'Settings', exact: true }).click()
      await page.getByRole('button', { name: 'General', exact: true }).click()
      await visible(page.getByRole('heading', { name: 'Appearance', exact: true }))
    }
    await shot(`shell-${view}`)
    const facts = await inspect(page, panelSelector)
    await step(`${view}: sidebar present`, facts.sidebars > 0, `${facts.sidebars} aside`)
    await step(
      `${view}: sidebar rows flat`,
      facts.flatViolations.length === 0,
      facts.flatViolations.length === 0
        ? 'sin borde ni sombra'
        : JSON.stringify(facts.flatViolations.slice(0, 3)),
    )
    await step(
      `${view}: nav icons one tone`,
      facts.iconColors.length === 1,
      facts.iconColors.join(' | ') || 'sin iconos',
    )
    await step(
      `${view}: sidebar divider and flat header`,
      facts.sidebarBorderRight.every((w) => (view === 'chat' ? w > 0 : w === 0)) &&
        facts.headerBorderBottom === 0,
      `aside border-right=${facts.sidebarBorderRight.join(',')} header border-bottom=${facts.headerBorderBottom}`,
    )
    await step(
      `${view}: panel lighter than chrome`,
      Boolean(facts.panelBg) && facts.panelBg !== facts.sidebarBg,
      `panel=${facts.panelBg} sidebar=${facts.sidebarBg}`,
    )
    await step(
      `${view}: no palette classes in chrome`,
      facts.paletteHits.length === 0,
      facts.paletteHits.join(' || ') || 'ninguna',
    )
  }
  // UI.26.6b.3 — search grows into a palette and takes the user to a setting row.
  const search = page.getByRole('textbox', { name: 'Search settings', exact: true })
  const searchBox = await search.boundingBox()
  const sidebarNavigation = await search
    .locator('xpath=ancestor::aside')
    .getByRole('button')
    .count()
  const palette = page.getByRole('dialog', { name: 'Search settings', exact: true })
  // Sample in the browser from the opening focus event, without locator polling delays.
  await search.evaluate((input) => {
    window.__settingsPaletteHeights = []
    input.addEventListener(
      'focus',
      () => {
        for (const ms of [60, 120, 200]) {
          setTimeout(() => {
            const dialog = document.querySelector('[role="dialog"][aria-label="Search settings"]')
            window.__settingsPaletteHeights.push({
              ms,
              input: dialog?.querySelector('input')?.getBoundingClientRect().height ?? 0,
              option: dialog?.querySelector('[role="option"]')?.getBoundingClientRect().height ?? 0,
            })
          }, ms)
        }
      },
      { once: true },
    )
  })
  await search.click()
  await visible(palette)
  const paletteInput = palette.getByRole('combobox')
  await page.waitForFunction(() => {
    const dialog = document.querySelector('[role="dialog"]')
    return (
      dialog?.querySelector('input') === document.activeElement &&
      dialog.getBoundingClientRect().width > 300
    )
  })
  await settle()
  const textHeights = await palette.evaluate((dialog) => {
    const settled = {
      input: dialog.querySelector('input').getBoundingClientRect().height,
      option: dialog.querySelector('[role="option"]').getBoundingClientRect().height,
    }
    const samples = window.__settingsPaletteHeights
    delete window.__settingsPaletteHeights
    return { settled, samples }
  })
  await step(
    'settings palette text not stretched',
    textHeights.samples.length === 3 &&
      ['input', 'option'].every(
        (key) =>
          textHeights.settled[key] > 0 &&
          textHeights.samples.every(
            (sample) =>
              Math.abs(sample[key] - textHeights.settled[key]) <= textHeights.settled[key] * 0.15,
          ),
      ),
    JSON.stringify(textHeights),
  )
  const surfaceColor = await palette
    .locator('[data-settings-search-surface]')
    .evaluate((surface) => getComputedStyle(surface).backgroundColor)
  const surfaceAlpha = await palette
    .locator('[data-settings-search-surface]')
    .evaluate((surface) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const context = canvas.getContext('2d')
      context.fillStyle = getComputedStyle(surface).backgroundColor
      context.fillRect(0, 0, 1, 1)
      return context.getImageData(0, 0, 1, 1).data[3] / 255
    })
  await step(
    'settings palette opaque',
    surfaceAlpha === 1,
    `${surfaceColor}; alpha=${surfaceAlpha}`,
  )
  const paletteBox = await palette.boundingBox()
  await step(
    'settings palette opens',
    Boolean(searchBox && paletteBox && paletteBox.width > searchBox.width) &&
      (await paletteInput.evaluate((input) => input === document.activeElement)),
    JSON.stringify({ searchBox, paletteBox }),
  )
  await paletteInput.fill('ollama')
  const results = palette.locator('[data-settings-result]')
  await visible(results.first())
  const ollamaText = await results.first().innerText()
  await settle()
  await shot('settings-palette')
  await paletteInput.fill('zzzz')
  await step(
    'settings palette finds',
    /ollama/i.test(ollamaText) &&
      (await palette.getByText('No results', { exact: true }).isVisible()) &&
      (await results.count()) === 0,
    `first=${ollamaText}; no results for zzzz`,
  )
  await paletteInput.fill('executor')
  await paletteInput.press('Enter')
  const highlight = page.locator(
    '[data-settings-anchor="executor-timeout"] [data-settings-highlight]',
  )
  await visible(highlight)
  await settle()
  await shot('settings-highlight')
  const restoredBox = await search.boundingBox()
  const navigationVisibility = await search
    .locator('xpath=ancestor::aside')
    .getByRole('button')
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const box = button.getBoundingClientRect()
        const style = getComputedStyle(button)
        return (
          box.width > 0 &&
          box.height > 0 &&
          style.visibility === 'visible' &&
          Number(style.opacity) > 0
        )
      }),
    )
  const remainingDialogs = await palette.count()
  const remainingBackdrops = await page.locator('[data-settings-search-backdrop]').count()
  await step(
    'settings palette closes clean',
    (await search.isVisible()) &&
      searchBox !== null &&
      restoredBox !== null &&
      ['x', 'y', 'width', 'height'].every(
        (key) => Math.abs(searchBox[key] - restoredBox[key]) <= 2,
      ) &&
      remainingDialogs === 0 &&
      remainingBackdrops === 0 &&
      navigationVisibility.length === sidebarNavigation &&
      sidebarNavigation > 0 &&
      navigationVisibility.every(Boolean),
    JSON.stringify({
      searchBox,
      restoredBox,
      remainingDialogs,
      remainingBackdrops,
      sidebarNavigation,
      navigationVisibility,
    }),
  )
  const row = await highlight.locator('..').boundingBox()
  await step(
    'settings palette navigates',
    (await hidden(palette)) &&
      (await page.getByRole('heading', { name: 'Executor', exact: true }).isVisible()) &&
      row !== null &&
      row.y >= 0 &&
      row.y + row.height <= page.viewportSize().height,
    JSON.stringify({ row, viewport: page.viewportSize() }),
  )
  const shortcut = process.platform === 'darwin' ? 'Meta+k' : 'Control+k'
  await page.keyboard.press(shortcut)
  const shortcutOpens = await visible(palette)
  const generalCommandPalette = page.getByRole('textbox', {
    name: 'Type a command, search screen, or execute task...',
    exact: true,
  })
  const generalCountWhileOpen = await generalCommandPalette.count()
  await paletteInput.press('Escape')
  await step('settings palette shortcut', shortcutOpens && (await hidden(palette)), shortcut)
  await step(
    'settings shortcut does not open the general command palette',
    generalCountWhileOpen === 0,
    `general palette count while settings shortcut is open=${generalCountWhileOpen}`,
  )
  await page.getByRole('button', { name: 'General', exact: true }).click()
  await step(
    'settings nav slides',
    (await page.locator('[data-settings-nav-active]').count()) === 1 &&
      (await page
        .getByRole('button', { name: 'General', exact: true })
        .locator('[data-settings-nav-active]')
        .count()) === 1,
    'one shared highlight inside General after switching from Executor',
  )

  // UI.26.6 — resto de Settings con los primitivos y a todo el ancho.
  for (const [name, key] of [
    ['Health', 'health'],
    ['API & Models', 'api'],
    ['Model routing', 'model routing'],
    ['Usage', 'usage'],
    ['Danger zone', 'danger zone'],
    [/^Language/, 'language'],
  ]) {
    await page
      .getByRole('button', typeof name === 'string' ? { name, exact: true } : { name })
      .click()
    await page.waitForTimeout(200)
    const section = await page.evaluate((palette) => {
      const re = new RegExp(palette)
      const main = document.querySelector('main')
      const root =
        document.querySelector('[data-settings-page]') ?? main?.querySelector('div.overflow-y-auto')
      const content = root?.hasAttribute('data-settings-page') ? root.firstElementChild : root
      return {
        hits: root
          ? [root, ...root.querySelectorAll('*')]
              .map((el) => el.getAttribute('class') || '')
              .filter((cls) => re.test(cls))
              .slice(0, 3)
          : ['sin contenedor de sección'],
        content: content ? content.getBoundingClientRect().width : 0,
        main: main ? main.getBoundingClientRect().width : 0,
      }
    }, PALETTE)
    await step(
      `settings ${key} no palette`,
      section.hits.length === 0,
      section.hits.join(' || ') || 'ninguna',
    )
    if (key === 'api') {
      const openrouter = page.locator('[data-api-key-row="openrouter"]')
      const form = openrouter.locator('[data-api-key-form]')
      await openrouter.getByRole('button', { name: /^(Save|Replace) key$/ }).click()
      const unfolded = await visible(form)
      await step(
        'api key form unfolds',
        unfolded &&
          (await form.locator('input').evaluate((input) => input === document.activeElement)) &&
          (await page.getByRole('dialog').count()) === 0,
        'inline password input focused; no dialog',
      )
      // run.mjs starts the dashboard with an isolated, temporary ORCHESTOS_HOME.
      const testKey = 'ui-gate-not-a-real-key'
      await form.locator('input').fill(testKey)
      await form.locator('input').press('Enter')
      const toast = page.locator('.fixed.bottom-5.right-5 span.font-semibold')
      await toast.waitFor({ state: 'visible', timeout: 15_000 })
      await shot('api-keys')
      const toastText = await toast.innerText()
      const inputValue = await form.locator('input').inputValue()
      const masked = openrouter.locator('[data-api-key-masked]')
      const maskedVisible = (await masked.count()) > 0
      const notSet = await openrouter.getByText('Not set', { exact: true }).isVisible()
      await step(
        'api key rejected',
        toastText.length > 0 &&
          toastText !== 'Saved API keys' &&
          (await page.locator('.fixed.bottom-5.right-5 .bg-app-error').count()) === 1 &&
          (await visible(form)) &&
          inputValue === testKey &&
          notSet &&
          !maskedVisible,
        `toast=${toastText}; form visible=${await visible(form)}; input preserved=${inputValue === testKey}; not set=${notSet}; masked=${maskedVisible}`,
      )
      await page.waitForTimeout(6000)
      const inputPreservedAfterLoad = (await form.locator('input').inputValue()) === testKey
      await step(
        'api key survives initial settings load',
        inputPreservedAfterLoad,
        `input preserved after 6s=${inputPreservedAfterLoad}`,
      )
      const anthropic = page.locator('[data-api-key-row="anthropic"]')
      const anthropicForm = anthropic.locator('[data-api-key-form]')
      await anthropic.getByRole('button', { name: 'Save key', exact: true }).click()
      await visible(anthropicForm)
      await anthropicForm.locator('input').press('Escape')
      await step(
        'api key cancel',
        (await hidden(anthropicForm)) &&
          (await anthropic.getByText('Not set', { exact: true }).isVisible()),
        'Escape closes the form without setting a key',
      )
    }
    if (key === 'usage' || key === 'model routing') {
      await step(
        'settings fills width',
        section.main > 0 && section.content >= section.main * 0.9 - 48,
        `${key}: contenido ${Math.round(section.content)} px de ${Math.round(section.main)} px`,
      )
    }
    if (key === 'usage') {
      const viewport = page.viewportSize()
      await page.setViewportSize({ width: 1440, height: 900 })
      try {
        const grid = page.locator('[data-heatmap-grid]')
        await visible(grid)
        const widths = await grid.evaluate((element) => {
          const card = element.parentElement.parentElement.parentElement
          const cs = getComputedStyle(card)
          return {
            grid: element.getBoundingClientRect().width,
            inner:
              card.clientWidth -
              Number.parseFloat(cs.paddingLeft) -
              Number.parseFloat(cs.paddingRight),
          }
        })
        await step(
          'heatmap fills width',
          widths.inner > 0 && widths.grid >= widths.inner * 0.95,
          JSON.stringify(widths),
        )
        // Let the entry wave settle before measuring pointer targets.
        await page.waitForTimeout(600)
        const cells = grid.locator('[data-heatmap-cell]')
        const first = cells.nth(21)
        const second = cells.nth(350)
        const tooltip = page.locator('[data-heatmap-tooltip]')
        const dateMatches = async (cell) => {
          const iso = await cell.getAttribute('data-date')
          const text = await tooltip.textContent()
          return ['en-US', 'es-ES'].some((locale) =>
            text.includes(
              new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
            ),
          )
        }
        await first.hover()
        await visible(tooltip)
        await page.waitForTimeout(200)
        const firstText = await tooltip.textContent()
        const firstDateMatches = await dateMatches(first)
        const handle = await tooltip.elementHandle()
        const firstBox = await tooltip.boundingBox()
        await second.hover()
        await page.waitForTimeout(200)
        const secondBox = await tooltip.boundingBox()
        const sameNode = await tooltip.evaluate((node, original) => node === original, handle)
        const secondText = await tooltip.textContent()
        await step(
          'heatmap tooltip slides',
          sameNode &&
            firstDateMatches &&
            (await dateMatches(second)) &&
            firstText !== secondText &&
            firstBox !== null &&
            secondBox !== null &&
            (Math.abs(firstBox.x - secondBox.x) > 1 || Math.abs(firstBox.y - secondBox.y) > 1),
          JSON.stringify({ sameNode, firstText, secondText, firstBox, secondBox }),
        )
        await handle.dispose()
        const usage = await api('/api/usage')
        const dates = new Set(
          await cells.evaluateAll((nodes) => nodes.map((node) => node.dataset.date)),
        )
        const total = (usage.byDayModel ?? [])
          .filter((row) => dates.has(row.date))
          .reduce((sum, row) => sum + row.runs, 0)
        const totalSettled = await page
          .waitForFunction(
            (expected) => {
              const text = document.querySelector('[data-heatmap-total]')?.textContent?.trim() ?? ''
              return (
                /^(\d+) (runs|ejecuciones)$/.test(text) && Number.parseInt(text, 10) === expected
              )
            },
            total,
            { timeout: 5000 },
          )
          .then(
            () => true,
            () => false,
          )
        await step(
          'heatmap total',
          totalSettled && (await cells.count()) === 371,
          `expected=${total}, actual=${await page.locator('[data-heatmap-total]').textContent()}, cells=${await cells.count()}`,
        )
        await shot('heatmap-usage')
        await page.emulateMedia({ reducedMotion: 'reduce' })
        try {
          await page.getByRole('button', { name: 'General', exact: true }).click()
          await page.getByRole('button', { name: 'Usage', exact: true }).click()
          const opacities = await page
            .locator('[data-heatmap-cell]')
            .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).opacity))
          await step(
            'heatmap reduced motion',
            opacities.length === 371 && opacities.every((value) => value === '1'),
            `cells=${opacities.length}, opacities=${[...new Set(opacities)].join(',')}`,
          )
          await shot('heatmap-reduced-motion')
        } finally {
          await page.emulateMedia({ reducedMotion: 'no-preference' })
        }
      } finally {
        if (viewport) await page.setViewportSize(viewport)
      }
    }
  }
  // UI.26.2 — plantilla de página: cabecera de proyecto, pestañas, franja de cifras, cabecera del chat.
  const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: 'ignore' })
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-26-2-'))
  writeFileSync(join(projectRoot, 'README.md'), '# UI.26.2\n')
  writeFileSync(join(projectRoot, '.gitignore'), '.orchestos/\n')
  run('git', ['init', '-q'], projectRoot)
  run('git', ['add', '-A'], projectRoot)
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
  const repoRoot = process.cwd()
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'init', projectRoot], repoRoot)
  writeGateRoles(projectRoot)
  const projects = await api('/api/projects')
  const project = (projects.data ?? []).find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.getByRole('button', { name: basename(projectRoot), exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  // UI.26.6b.3 B — use the disposable project's config for persistence checks.
  const configHeaders = { 'x-orchestos-project-id': project.id }
  const beforeExecutor = (await api('/api/config', { headers: configHeaders })).data
  await page.getByRole('button', { name: 'Executor', exact: true }).click()
  await hidden(page.getByText('Loading live settings…', { exact: true }))
  const timeoutControl = page.getByRole('group', { name: 'timeout', exact: true })
  const timeoutBefore = await timeoutControl.innerText()
  const bar = page.locator('[data-unsaved-bar]')
  await timeoutControl.getByRole('button', { name: 'Increase timeout', exact: true }).click()
  await visible(bar)
  const oneChange = await bar.locator('[data-unsaved-count]').innerText()
  const timeoutToastCount = await page.locator('.fixed.bottom-5.right-5').count()
  await page
    .getByRole('radio', {
      name: beforeExecutor.apiMode === 'agentic' ? 'Single-shot' : 'Agentic',
      exact: true,
    })
    .click()
  await settle()
  const modeToastCount = await page.locator('.fixed.bottom-5.right-5').count()
  await step(
    'unsaved bar appears',
    oneChange === '1' &&
      (await bar.locator('[data-unsaved-count]').innerText()) === '2' &&
      timeoutToastCount === 0 &&
      modeToastCount === 0,
    `first=${oneChange}, current=${await bar.locator('[data-unsaved-count]').innerText()}, toasts=${timeoutToastCount}/${modeToastCount}`,
  )
  await shot('unsaved-bar')
  await bar.getByRole('button', { name: 'Discard', exact: true }).click()
  await step(
    'unsaved discard',
    (await hidden(bar)) && (await timeoutControl.innerText()) === timeoutBefore,
    await timeoutControl.innerText(),
  )
  await timeoutControl.getByRole('button', { name: 'Increase timeout', exact: true }).click()
  await bar.getByRole('button', { name: 'Save', exact: true }).click()
  const savedPill = page.locator('[data-unsaved-saved]')
  const savedVisible = await visible(savedPill)
  await shot('unsaved-saved')
  const disappeared = await hidden(bar)
  const afterExecutor = (await api('/api/config', { headers: configHeaders })).data
  await step(
    'unsaved save persists',
    savedVisible &&
      disappeared &&
      afterExecutor.externalTimeoutMinutes === beforeExecutor.externalTimeoutMinutes + 5,
    JSON.stringify({
      before: beforeExecutor.externalTimeoutMinutes,
      after: afterExecutor.externalTimeoutMinutes,
    }),
  )
  await step('no saved banner', (await page.getByText(/configuration successfully/i).count()) === 0)
  await page.getByRole('button', { name: basename(projectRoot), exact: true }).click()
  await visible(page.getByRole('heading', { name: basename(projectRoot), exact: true }))
  await shot('shell-project')
  const header = await page.evaluate(() => {
    const el = document.querySelector('[data-project-header]')
    if (!el) return null
    const cs = getComputedStyle(el)
    return { border: Number.parseFloat(cs.borderBottomWidth) || 0, bg: cs.backgroundColor }
  })
  await step(
    'project header flat',
    header !== null && header.border === 0 && header.bg === 'rgba(0, 0, 0, 0)',
    JSON.stringify(header),
  )
  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll('[data-project-tab]')].map((el) => {
      const cs = getComputedStyle(el)
      return {
        label: el.textContent,
        border: ['Top', 'Right', 'Bottom', 'Left'].map(
          (side) => Number.parseFloat(cs[`border${side}Width`]) || 0,
        ),
        shadow: cs.boxShadow,
        height: el.getBoundingClientRect().height,
      }
    }),
  )
  const tabViolations = tabs.filter(
    (t) => t.border.some((w) => w !== 0) || t.shadow !== 'none' || Math.round(t.height) !== 28,
  )
  await step(
    'project tabs flat',
    tabs.length > 0 && tabViolations.length === 0,
    tabViolations.length === 0
      ? `${tabs.length} pestañas, 28 px`
      : JSON.stringify(tabViolations.slice(0, 3)),
  )
  await page.getByRole('button', { name: 'Runs', exact: true }).click()
  await page.locator('[data-stat-strip]').first().waitFor({ state: 'visible' })
  const strip = await page.evaluate((palette) => {
    const re = new RegExp(palette)
    const el = document.querySelector('[data-stat-strip]')
    const root = el?.parentElement?.parentElement
    const hits = root
      ? [root, ...root.querySelectorAll('*')]
          .map((n) => n.getAttribute('class') || '')
          .filter((cls) => re.test(cls))
      : []
    return {
      cells: el ? el.querySelectorAll('[data-stat-cell]').length : 0,
      hits: hits.slice(0, 5),
    }
  }, PALETTE)
  await step(
    'runs stat strip',
    strip.cells === 4 && strip.hits.length === 0,
    `${strip.cells} celdas; paleta: ${strip.hits.join(' || ') || 'ninguna'}`,
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('[data-composer-region]').waitFor({ state: 'visible' })
  await settle()
  await step(
    'chat without telemetry reserves no header space',
    (await page.locator('[data-chat-header]').count()) === 0,
    'no header when context is unavailable',
  )

  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.getByRole('button', { name: basename(projectRoot), exact: true }).click()
  await page.getByRole('button', { name: 'Launch new agent', exact: true }).click()
  const launchDialog = page.getByRole('dialog')
  await launchDialog.getByRole('button', { name: /Codex/ }).first().click()
  const sessionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat/sessions',
  )
  await launchDialog.getByRole('button', { name: 'Launch Agent', exact: true }).click()
  const devSession = await (await sessionResponse).json()
  const gptModel = 'gpt-6.1-sol'
  execFileSync(
    'bun',
    [
      '-e',
      `import { Database } from 'bun:sqlite'
       const db = new Database(process.argv[1])
       try {
         db.run('INSERT INTO chat_messages (session_id, role, content, model, created_at) VALUES (?, ?, ?, ?, ?)',
           [process.argv[2], 'assistant', 'UI.27.1 provider logo fixture', process.argv[3], new Date().toISOString()])
       } finally { db.close() }`,
      databasePath,
      devSession.id,
      gptModel,
    ],
    { stdio: 'pipe' },
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: basename(projectRoot), exact: true }).click()
  await page.locator('[data-composer-region]').waitFor({ state: 'visible' })
  const devComposerBorder = await page
    .locator('[data-composer-region]')
    .evaluate((el) => getComputedStyle(el).borderTopWidth)
  await step('composer no top line (Dev)', devComposerBorder === '0px', devComposerBorder)
  const sharedBody = async (mode) => {
    const body = await page.locator('[data-composer-region]').evaluate((composer) => {
      const panel = composer.parentElement
      const scroll = panel?.querySelector(':scope > .overflow-y-auto')
      const background = (element) => {
        while (element) {
          const color = getComputedStyle(element).backgroundColor
          if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color
          element = element.parentElement
        }
        return null
      }
      return {
        sameParent: Boolean(scroll && scroll.parentElement === panel),
        composerBg: background(composer),
        scrollBg: background(scroll),
        gap: scroll
          ? composer.getBoundingClientRect().top - scroll.getBoundingClientRect().bottom
          : null,
      }
    })
    await step(
      `${mode}: thread and composer share one body`,
      body.sameParent &&
        body.composerBg !== null &&
        body.composerBg === body.scrollBg &&
        Math.abs(body.gap) <= 1,
      JSON.stringify(body),
    )
  }
  await sharedBody('Dev')
  const devAgentButton = page.getByRole('button', {
    name: `Agent: Codex on ${basename(projectRoot)}`,
    exact: true,
  })
  await step(
    'Dev agent row retains provider logo',
    (await devAgentButton.locator('[style*="mask-image"], img[aria-hidden="true"]').count()) > 0,
    'provider logo alongside agent name',
  )
  const persistedDevSessions = await api('/api/chat/sessions', { headers: configHeaders })
  const persistedDevSession = persistedDevSessions.data?.find(
    (session) => session.id === devSession.id,
  )
  const devLogo = await devAgentButton.evaluate((button) => {
    const logo = button.querySelector('span[aria-hidden="true"]')
    const box = logo?.getBoundingClientRect()
    return {
      mask: logo ? getComputedStyle(logo).maskImage : null,
      inlineSvg: button.querySelectorAll('svg').length,
      visible: Boolean(box && box.width > 0 && box.height > 0),
    }
  })
  await step(
    'Dev gpt model uses ChatGPT asset mask without inline SVG',
    persistedDevSession?.lastModel === gptModel &&
      devLogo.visible &&
      /chatgpt[^/]*\.svg/.test(devLogo.mask ?? '') &&
      devLogo.inlineSvg === 0,
    JSON.stringify({ model: persistedDevSession?.lastModel, ...devLogo }),
  )
  const toggleInspector = page.getByRole('button', { name: 'Toggle Right Workspace Panel' })
  if (!(await visible(page.locator('[data-inspector-tabs]')))) await toggleInspector.click()
  const inspectorAlignment = await page.evaluate(() => {
    const inspector = document.querySelector('[data-inspector-tabs]')
    const devHeader = document.querySelector('[data-dev-header]')
    if (!inspector || !devHeader) return null
    return {
      inspectorBottom: inspector.getBoundingClientRect().bottom,
      devHeaderBottom: devHeader.getBoundingClientRect().bottom,
    }
  })
  await step(
    'inspector line aligned',
    inspectorAlignment !== null &&
      Math.abs(inspectorAlignment.inspectorBottom - inspectorAlignment.devHeaderBottom) <= 1,
    JSON.stringify(inspectorAlignment),
  )
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.locator('[data-composer-region]').waitFor({ state: 'visible' })
  const chatComposerBorder = await page
    .locator('[data-composer-region]')
    .evaluate((el) => getComputedStyle(el).borderTopWidth)
  await step('composer no top line (Chat)', chatComposerBorder === '0px', chatComposerBorder)

  await sharedBody('Chat')
  const chatRows = await page.locator('aside [role="button"]').evaluateAll((rows) =>
    rows.map((row) => ({
      messageSquare: row.querySelectorAll('.lucide-message-square').length,
      logo: [
        ...row.querySelectorAll('img[aria-hidden="true"], [style*="mask-image"], svg:not(.lucide)'),
      ].some((icon) => {
        const box = icon.getBoundingClientRect()
        return Math.round(box.width) === 16 && Math.round(box.height) === 16
      }),
    })),
  )
  await step(
    'Chat rows show agent logos',
    chatRows.length > 0 && chatRows.every((row) => row.logo && row.messageSquare === 0),
    JSON.stringify(chatRows),
  )
  await step(
    'Chat permissions strip removed',
    (await page.locator('[data-permissions-strip]').count()) === 0 &&
      !(await page.locator('[data-composer-region]').innerText()).includes('Chat: read-only'),
    'no permissions text or strip below the thread',
  )
  await shot('chat-unified-body')

  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const chatDialog = page.getByRole('dialog')
  const openRouterOption = chatDialog.getByRole('button', { name: 'OpenRouter API', exact: true })
  await openRouterOption.waitFor({ state: 'visible' })
  const openRouterLogo = await openRouterOption.evaluate((button) => ({
    generic: button.querySelector('svg rect') !== null,
    chatgpt: [...button.querySelectorAll('*')].some((el) =>
      /chatgpt[^/]*\.svg/.test(`${el.getAttribute('src') ?? ''} ${getComputedStyle(el).maskImage}`),
    ),
  }))
  await step(
    'OpenRouter option uses generic logo without ChatGPT asset',
    openRouterLogo.generic && !openRouterLogo.chatgpt,
    JSON.stringify(openRouterLogo),
  )
  await chatDialog.getByRole('button', { name: basename(projectRoot), exact: true }).click()
  await chatDialog.getByRole('button', { name: /Codex/ }).first().click()
  const contextSessionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat/sessions',
  )
  await chatDialog.getByRole('button', { name: 'Start Chat', exact: true }).click()
  const contextSession = await (await contextSessionResponse).json()
  execFileSync(
    'bun',
    [
      '-e',
      `import { Database } from 'bun:sqlite'
       const db = new Database(process.argv[1])
       try {
         const now = new Date().toISOString()
         const runId = crypto.randomUUID()
         db.run('INSERT INTO runs (id, project_id, prompt, task_class, model, provider, status, context_used_tokens, context_window_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
           [runId, process.argv[3], 'UI.27.2 context fixture', 'chat', 'gpt-6-luna', 'codex', 'done', 14661, 1000000, now])
         db.run('INSERT INTO chat_turns (id, session_id, project_id, request_key, input_fingerprint, status, run_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
           [crypto.randomUUID(), process.argv[2], process.argv[3], runId, runId, 'completed', runId, now, now])
       } finally { db.close() }`,
      databasePath,
      contextSession.id,
      project.id,
    ],
    { stdio: 'pipe' },
  )
  const context = await api(`/api/chat/sessions/${contextSession.id}/context`, {
    headers: configHeaders,
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('[data-dev-header]').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.locator('aside [role="button"]').filter({ hasText: 'Chat with Codex' }).click()
  const ring = page.locator('[data-chat-header] [aria-label^="Context window usage:"]')
  await ring.waitFor({ state: 'visible' })
  await ring.focus()
  const tooltip = page.locator('[data-chat-header] [role="tooltip"]')
  await tooltip.waitFor({ state: 'visible' })
  const tooltipText = await tooltip.innerText()
  await step(
    'context popover shows only compact window and percent',
    context.data?.used === 14661 &&
      context.data?.window === 1000000 &&
      tooltipText.replace(/\s+/g, ' ').trim() === '15K / 1M 1%' &&
      !/gpt|claude|codex|medido|estimado/i.test(tooltipText) &&
      (await ring.getAttribute('title')) === null,
    JSON.stringify({ context: context.data, tooltipText }),
  )
  const chatHeader = await page.locator('[data-chat-header]').evaluate((header) => ({
    position: getComputedStyle(header).position,
    images: header.querySelectorAll('img, [style*="mask-image"], svg rect').length,
    gauges: header.querySelectorAll('svg circle').length,
  }))
  await step(
    'Chat header contains only the context ring without provider logo',
    chatHeader.position === 'absolute' && chatHeader.images === 0 && chatHeader.gauges === 2,
    JSON.stringify(chatHeader),
  )
  await shot('chat-context-window')
  await page.keyboard.press('Tab')

  const commandPalette = page.getByRole('textbox', {
    name: 'Type a command, search screen, or execute task...',
    exact: true,
  })
  const commandPaletteShortcut = process.platform === 'darwin' ? 'Meta+k' : 'Control+k'
  await page.keyboard.press(commandPaletteShortcut)
  const commandPaletteOpens = await visible(commandPalette)
  await page.keyboard.press('Escape')
  const commandPaletteCloses = await hidden(commandPalette)
  await step(
    'command palette shortcut opens and Escape closes in Chat',
    commandPaletteOpens && commandPaletteCloses,
    `${commandPaletteShortcut}; opened=${commandPaletteOpens}; closed=${commandPaletteCloses}`,
  )
}
