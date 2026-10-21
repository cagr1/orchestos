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
          c.contains('text-app') && (c.contains('bg-app-surface') || c.contains('bg-app-elevated'))
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

export default async function shellLook({ page, api, step, shot, visible, hidden, cleanup }) {
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
      `${view}: no line between sidebar and panel`,
      facts.sidebarBorderRight.every((w) => w === 0) && facts.headerBorderBottom === 0,
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
  await page.locator('[data-chat-header]').first().waitFor({ state: 'visible' })
  const chatHeader = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('[data-chat-header]'))
    return { border: Number.parseFloat(cs.borderBottomWidth) || 0, bg: cs.backgroundColor }
  })
  await step(
    'chat header no band',
    chatHeader.border === 0 && chatHeader.bg === 'rgba(0, 0, 0, 0)',
    JSON.stringify(chatHeader),
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
  await sessionResponse
  await page.locator('[data-composer-region]').waitFor({ state: 'visible' })
  const devComposerBorder = await page
    .locator('[data-composer-region]')
    .evaluate((el) => getComputedStyle(el).borderTopWidth)
  await step('composer no top line (Dev)', devComposerBorder === '0px', devComposerBorder)
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
}
