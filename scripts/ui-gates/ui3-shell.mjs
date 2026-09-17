/**
 * GATE EN VIVO de UI.3 (Mes 30) — shell React contra el dashboard real.
 *
 * Este gate mide las 4 reglas de diseño que el shell vanilla tuvo que aprender a golpes,
 * más la paridad funcional que no puede perderse durante la migración. Las medidas se hacen
 * contra el DOM y los estilos computados del navegador: no hay mocks ni números copiados del
 * CSS que puedan quedar mintiendo después de un cambio en `styles.css`.
 *
 * Cómo se corre (Playwright es una devDependency real):
 *   bun run src/cli.ts dashboard --port 4323 &
 *   BASE=http://localhost:4323 node scripts/ui-gates/ui3-shell.mjs
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:4323'
const out = []
const log = (ok, msg) => {
  out.push(`${ok ? 'PASS' : 'FAIL'} — ${msg}`)
  if (!ok) process.exitCode = 1
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.addInitScript(() => {
  localStorage.setItem('orchestos-shell-mode', 'dev')
})
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.locator('#sidebar').waitFor({ state: 'visible', timeout: 8000 })
await page.locator('.header').waitFor({ state: 'visible', timeout: 8000 })
await page.locator('#rightpanel').waitFor({ state: 'attached', timeout: 8000 })

// ── Inspector cerrado: cero píxeles y sin controles residuales ─────────────
await page.evaluate(() => {
  localStorage.setItem('orchestos-sidebar', 'collapsed')
  localStorage.removeItem('orchestos-rightpanel')
  localStorage.removeItem('orchestos-rightpanel-tab')
})
await page.reload({ waitUntil: 'networkidle' })
log(
  await page.evaluate(() => {
    const panel = document.querySelector('#rightpanel')
    const cs = panel && getComputedStyle(panel)
    return (
      panel &&
      cs.width === '0px' &&
      !document.querySelector('#rightpanel button, #rightpanel [role="button"]')
    )
  }),
  'inspector cerrado: ancho 0px y sin toggle/handle visible',
)

await page.evaluate(() => window.OrchestOS.openInspectorTool('terminal'))
await page.waitForTimeout(400)
log(
  await page.locator('#rightpanel').evaluate((el) => getComputedStyle(el).width !== '0px'),
  'inspector tool abre por API',
)
log(
  (await page.locator('#rpTabExplorer').count()) === 1 &&
    (await page.locator('#rpTabTerminal').count()) === 1 &&
    (await page.locator('#rpTabDiff').count()) === 1,
  'inspector tool muestra sus tres tabs',
)
await page.locator('#rpClose').click()
await page.waitForTimeout(300)
log(
  (await page.locator('#rightpanel').evaluate((el) => getComputedStyle(el).width)) === '0px',
  'inspector se cierra con el botón',
)

// ── REGLA 2 — una altura única y sin padding vertical accidental ───────────
// Se lee `--header-h` de `:root` y se compara con los tres rectángulos reales. El padding se
// revisa aparte porque un override de estado puede mantener la altura declarada y aun así
// alterar el contenido; esa combinación fue la regresión histórica.
const measureTopRows = () =>
  page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const rootHeight = root.getPropertyValue('--header-h').trim()
    const read = (selector) => {
      const el = document.querySelector(selector)
      if (!el) return null
      const cs = getComputedStyle(el)
      return {
        height: cs.height,
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
      }
    }
    return {
      rootHeight,
      sidebar: read('.sidebar-toprow'),
      right: read('.rp-toprow'),
      header: read('.header'),
    }
  })
const checkTopRows = async (state) => {
  const rows = await measureTopRows()
  const values = [rows.sidebar?.height, rows.right?.height, rows.header?.height]
  const sameHeight = values.every((value) => value === values[0]) && values[0] === rows.rootHeight
  const noVerticalPadding = [rows.sidebar, rows.right].every(
    (row) => row?.paddingTop === '0px' && row.paddingBottom === '0px',
  )
  log(
    sameHeight && noVerticalPadding,
    `regla 2 (${state}): sidebar/rp/header miden ${values.join(' / ')} frente a --header-h ${rows.rootHeight}, padding vertical ${rows.sidebar?.paddingTop}/${rows.sidebar?.paddingBottom} y ${rows.right?.paddingTop}/${rows.right?.paddingBottom}`,
  )
}

await checkTopRows('sidebar colapsado')
const collapseButton = page.locator('#navCollapseBtn')
await page.locator('.sidebar-toprow').hover()
await collapseButton.click()
await page.waitForTimeout(250)
await checkTopRows('sidebar expandido')

// Dejamos el riel expandido para medir persistencia explícitamente y luego lo devolvemos a
// colapsado, que es el estado necesario para la regla 4.
log(
  (await page.locator('.app').getAttribute('data-sidebar')) === 'expanded',
  'el click de panel-left cambia el estado del riel a expandido',
)
await page.reload({ waitUntil: 'networkidle' })
log(
  (await page.locator('.app').getAttribute('data-sidebar')) === 'expanded' &&
    (await page.evaluate(() => localStorage.getItem('orchestos-sidebar') === 'expanded')),
  'regla 9: colapsar/expandir el sidebar persiste tras location.reload()',
)
await page.locator('.sidebar-toprow').hover()
await page.locator('#navCollapseBtn').click()
await page.waitForTimeout(250)

// ── REGLA 3 — el tooltip escapa del overflow y entra al viewport ────────────
// Los tooltips son `::after`, por lo que no tienen un Element propio al que pedirle un rect.
// Calculamos su caja desde el rect del host y sus estilos computados. Así verificamos el
// resultado que ve el usuario, mientras recorremos los ancestros para encontrar el overflow
// que realmente podría recortarlo.
await page.locator('.nav-icon[data-nav]').first().hover()
const tooltip = await page
  .locator('.nav-icon[data-nav]')
  .first()
  .evaluate((el) => {
    const pseudo = getComputedStyle(el, '::after')
    const host = el.getBoundingClientRect()
    const px = (value) => Number.parseFloat(value) || 0
    const width =
      px(pseudo.width) +
      px(pseudo.paddingLeft) +
      px(pseudo.paddingRight) +
      px(pseudo.borderLeftWidth) +
      px(pseudo.borderRightWidth)
    const height =
      px(pseudo.height) +
      px(pseudo.paddingTop) +
      px(pseudo.paddingBottom) +
      px(pseudo.borderTopWidth) +
      px(pseudo.borderBottomWidth)
    const left = host.left + px(pseudo.left)
    const top = host.top + px(pseudo.top) - height / 2
    // La búsqueda se corta en `.app` A PROPÓSITO. `.app` es el contenedor de pantalla
    // completa (`height: 100vh; overflow: hidden`) y por definición no puede recortar algo
    // que queda dentro del viewport — la comprobación geométrica de acá abajo cubre ese caso
    // y es la que importa. Lo que la regla prohíbe es un `overflow` en el ASIDE o en el riel,
    // que sí recortaría un tooltip que por diseño se sale de su contenedor (el del nav abre
    // hacia la derecha del riel; el del aside, hacia la izquierda). Subir hasta `<body>`
    // marcaba `.app` y daba un falso positivo permanente.
    const clippingAncestors = []
    let parent = el.parentElement
    while (parent && !parent.classList.contains('app')) {
      const cs = getComputedStyle(parent)
      if (
        [cs.overflow, cs.overflowX, cs.overflowY].some((value) =>
          ['hidden', 'auto', 'scroll'].includes(value),
        )
      ) {
        clippingAncestors.push(parent.id || parent.className || parent.tagName)
      }
      parent = parent.parentElement
    }
    return {
      content: pseudo.content,
      display: pseudo.display,
      left,
      top,
      right: left + width,
      bottom: top + height,
      clippingAncestors,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }
  })
log(
  tooltip.content !== 'none' &&
    tooltip.display !== 'none' &&
    tooltip.clippingAncestors.length === 0,
  `regla 3: tooltip sin ancestros overflow hidden/auto/scroll (${tooltip.clippingAncestors.join(' → ') || 'ninguno'})`,
)
log(
  tooltip.left >= 0 &&
    tooltip.top >= 0 &&
    tooltip.right <= tooltip.viewportWidth &&
    tooltip.bottom <= tooltip.viewportHeight,
  `regla 3: rectángulo del tooltip entra completo en el viewport (${Math.round(tooltip.left)},${Math.round(tooltip.top)}–${Math.round(tooltip.right)},${Math.round(tooltip.bottom)})`,
)

// ── REGLA 4 — el hover-swap no toca el DOM ──────────────────────────────────
// Primero se fuerza el estado colapsado. Se comparan display/opacity/visibility antes y
// después de `.hover()` y, además, el `outerHTML` completo. Si un handler JS reemplazara la
// fila o cambiara clases/atributos, la comparación del markup lo denunciaría; un cambio de
// pseudo-estilo CSS deja el DOM idéntico.
const topRow = page.locator('.sidebar-toprow')
const beforeSwap = await topRow.evaluate((row) => {
  const read = (selector) => {
    const el = row.querySelector(selector)
    const cs = getComputedStyle(el)
    return {
      display: cs.display,
      opacity: cs.opacity,
      visibility: cs.visibility,
      hasRect: el.getClientRects().length > 0,
    }
  }
  return {
    logo: read('.sidebar-toprow-logo'),
    collapse: read('#navCollapseBtn'),
    html: row.outerHTML,
  }
})
await topRow.hover()
await page.waitForTimeout(150)
const afterSwap = await topRow.evaluate((row) => {
  const read = (selector) => {
    const el = row.querySelector(selector)
    const cs = getComputedStyle(el)
    return {
      display: cs.display,
      opacity: cs.opacity,
      visibility: cs.visibility,
      hasRect: el.getClientRects().length > 0,
    }
  }
  return {
    logo: read('.sidebar-toprow-logo'),
    collapse: read('#navCollapseBtn'),
    html: row.outerHTML,
  }
})
const visible = (value) =>
  value.hasRect &&
  value.display !== 'none' &&
  value.opacity !== '0' &&
  value.visibility !== 'hidden'
log(
  visible(beforeSwap.logo) &&
    !visible(beforeSwap.collapse) &&
    !visible(afterSwap.logo) &&
    visible(afterSwap.collapse),
  `regla 4: el hover intercambia logo y panel-left (${beforeSwap.logo.display}/${beforeSwap.collapse.display} → ${afterSwap.logo.display}/${afterSwap.collapse.display})`,
)
log(
  !(visible(beforeSwap.logo) && visible(beforeSwap.collapse)) &&
    !(visible(afterSwap.logo) && visible(afterSwap.collapse)),
  'regla 4: logo y panel-left nunca quedan visibles a la vez',
)
log(
  beforeSwap.html === afterSwap.html,
  'regla 4: el hover-swap es CSS puro, el outerHTML de la fila no cambia',
)

// ── PARIDAD FUNCIONAL DEL SHELL ─────────────────────────────────────────────
// Un click real sobre navegación debe mover la pantalla que el estado vanilla expone. Luego
// se comprueba la marca activa contra esa misma fuente, evitando aceptar un highlight fijo.
// El shell Dev vigente expone `activity` y proyectos; `skills` ya no es una entrada de
// navegación de este shell. La entrada de Activity debe conservar su estructura e icono.
const navItem = page.locator('.nav-icon[data-nav="activity"]')
await navItem.click()
await page.waitForTimeout(300)
const screenAfterNav = await page.evaluate(() => window.state.screen)
log(
  screenAfterNav === 'activity',
  `criterio 5: click en navegación cambia window.state.screen a ${screenAfterNav}`,
)
const activeNav = await page
  .locator('.nav-icon[data-nav].active')
  .evaluateAll((items) => items.map((item) => item.dataset.nav))
log(
  activeNav.length === 1 && activeNav[0] === screenAfterNav,
  `criterio 6: el único ítem activo coincide con window.state.screen (${activeNav.join(', ') || 'ninguno'} / ${screenAfterNav})`,
)

const activityStructure = await navItem.evaluate((item) => ({
  hasIconContainer: Boolean(item.querySelector('.nav-ic')),
  hasIcon: Boolean(item.querySelector('.nav-ic svg')),
}))
log(
  activityStructure.hasIconContainer && activityStructure.hasIcon,
  `criterio 7: activity existe con estructura e icono (${activityStructure.hasIcon ? 'icono presente' : 'icono ausente'})`,
)
const status = await page
  .locator('#statusBadge')
  .evaluate((el) => ({ state: el.dataset.state, text: el.textContent.trim() }))
log(
  ['idle', 'running'].includes(status.state) && status.text === status.state.toUpperCase(),
  `criterio 8: el pill del header dice ${status.text} y data-state=${status.state}`,
)

// Una tarea real, cuando existe, debe abrir el mismo inspector contextual.
const taskRow = page.locator('[data-task]').first()
if (await taskRow.count()) {
  await taskRow.click()
  await page.waitForTimeout(300)
  log((await page.locator('.inspector').count()) === 1, 'detalle de tarea real abre el inspector')
  log(
    (await page.locator('#rpToprow #rpClose').count()) === 1 &&
      (await page.locator('.inspector .insp-head .insp-close').count()) === 0,
    'cierre de tarea: solo existe rpClose en el toprow, sin botón duplicado en el encabezado interno',
  )
  await page.locator('#rpClose').click()
}

// `App.rerender()` es el camino que usa el poll de 30 segundos. El shell cuelga fuera de
// `#main`, pero el gate cuenta las tres piezas después del repintado para detectar roots
// duplicados o un shell que desaparece por accidente.
await page.evaluate(() => window.App.rerender())
await page.waitForTimeout(500)
const shellCounts = await page.evaluate(() => ({
  sidebar: document.querySelectorAll('#sidebar').length,
  header: document.querySelectorAll('.header').length,
  rightpanel: document.querySelectorAll('#rightpanel').length,
}))
log(
  shellCounts.sidebar === 1 && shellCounts.header === 1 && shellCounts.rightpanel === 1,
  `criterio 12: App.rerender() conserva un solo sidebar/header/rightpanel (${shellCounts.sidebar}/${shellCounts.header}/${shellCounts.rightpanel})`,
)

log(
  errors.length === 0,
  `criterio 11: sin errores de consola en toda la corrida (${errors.join(' | ') || 'ninguno'})`,
)

await browser.close()
console.log(out.join('\n'))
