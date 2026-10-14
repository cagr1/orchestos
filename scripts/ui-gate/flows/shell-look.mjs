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

export default async function shellLook({ page, step, shot, visible }) {
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
}
