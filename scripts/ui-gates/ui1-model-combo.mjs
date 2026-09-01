/**
 * GATE DE ABORTAR de UI.1 (Mes 30) — navegador real contra el dashboard real.
 *
 * Este script no es "unos tests más": es el instrumento que decide si el Mes 30 sigue
 * o se aborta. Cada bloque corresponde 1:1 a un criterio de aprobación de PLAN.md, más
 * dos que salieron al implementar (el contrato del hidden input y la selección sin
 * guardar), y todos se miden — nada de "se ve bien".
 *
 * Cómo se corre (Playwright NO está en devDependencies, es un gate manual):
 *   bun run src/cli.ts dashboard --port 4321 &
 *   cd <dir con playwright> && BASE=http://localhost:4321 node <repo>/scripts/ui-gates/ui1-model-combo.mjs
 *
 * Última corrida verde: 2026-08-28.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:4321'
const out = []
const log = (ok, msg) => {
  out.push(`${ok ? 'PASS' : 'FAIL'} — ${msg}`)
  if (!ok) process.exitCode = 1
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.evaluate(() => window.App.go('settings'))
await page.waitForTimeout(1200)
// Model routing es una pestaña de Settings; el resto de los paneles están en display:none.
await page.evaluate(() => {
  window.state.settingsSection = 'routing'
  window.App.rerender()
})
await page.waitForTimeout(1200)

// Settings → Model routing: 5 combos a la vez, el caso más denso que existe.
const combos = page.locator('[data-island="model-combo"]')
await combos.first().waitFor({ state: 'visible', timeout: 8000 })
const comboCount = await combos.count()
log(comboCount === 5, `los 5 combos de Model routing montan como isla React (${comboCount})`)

// ── CRITERIO 2 — buscable, nunca un <select> nativo ──────────────────────────
const nativeSelects = await page.evaluate(
  () => [...document.querySelectorAll('#main select')].filter((s) => s.options.length > 20).length,
)
log(nativeSelects === 0, `sin <select> nativo con lista larga en pantalla (${nativeSelects})`)

const planner = page
  .locator('[data-island="model-combo"]')
  .filter({ has: page.locator('#role-planner') })
const trigger = planner.locator('button').first()
await trigger.click()
const dialog = page.locator('[cmdk-root]')
await dialog.waitFor({ state: 'visible', timeout: 5000 })
const search = page.locator('[cmdk-input]')
log(await search.isVisible(), 'el panel abre con un input de búsqueda visible')

const totalItems = await page.locator('[cmdk-item]').count()
await search.fill('claude')
await page.waitForTimeout(250)
const filtered = await page.locator('[cmdk-item]').count()
log(
  filtered > 0 && filtered < totalItems,
  `la búsqueda filtra de verdad (${totalItems} → ${filtered})`,
)
// Regla del combo vanilla: matchea por id O por nombre visible.
const byId = await page.evaluate(() =>
  [...document.querySelectorAll('[cmdk-item]')].every((i) =>
    i.getAttribute('data-value')?.toLowerCase().includes('claude'),
  ),
)
log(byId, 'el filtro matchea por id o nombre, igual que el combo vanilla')
await search.fill('')
await page.waitForTimeout(200)

// ── CRITERIO 3 — navegación completa por teclado + foco de vuelta al trigger ──
await page.keyboard.press('ArrowDown')
await page.keyboard.press('ArrowDown')
const highlighted = await page.evaluate(
  () =>
    document.querySelector('[cmdk-item][data-selected="true"]')?.getAttribute('data-value') ?? null,
)
log(!!highlighted, `las flechas mueven el ítem resaltado (${highlighted})`)

// Esc cierra y devuelve el foco al trigger — lo que Radix debería resolver de fábrica.
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
const closedOnEsc = await page.locator('[cmdk-root]').count()
const focusBackEsc = await page.evaluate(
  () =>
    document.activeElement?.closest('[data-island="model-combo"]') !== null &&
    document.activeElement?.tagName === 'BUTTON',
)
log(closedOnEsc === 0, 'Esc cierra el panel')
log(focusBackEsc, 'Esc devuelve el foco al trigger')

// Enter elige el ítem resaltado y escribe el valor en el hidden input.
await trigger.press('Enter')
await page.locator('[cmdk-root]').waitFor({ state: 'visible', timeout: 5000 })
log(true, 'Enter sobre el trigger abre el panel')
await page.keyboard.press('ArrowDown')
const willPick = await page.evaluate(
  () =>
    document
      .querySelector('[cmdk-item][data-selected="true"]')
      ?.getAttribute('data-value')
      ?.split(' ')[0] ?? null,
)
await page.keyboard.press('Enter')
await page.waitForTimeout(400)
const picked = await page.evaluate(() => document.getElementById('role-planner')?.value ?? null)
log(
  picked === willPick,
  `Enter elige el ítem resaltado y lo escribe en el hidden input (${picked})`,
)
const focusBackEnter = await page.evaluate(() => document.activeElement?.tagName === 'BUTTON')
log(focusBackEnter, 'tras elegir con Enter el foco vuelve al trigger')

// ── CONTRATO — el valor sigue siendo legible como siempre ────────────────────
const label = (await trigger.textContent()).trim()
log(
  label.length > 0 && !label.includes('undefined'),
  `el trigger muestra el label del modelo elegido ("${label}")`,
)
const readable = await page.evaluate(() =>
  ['role-planner', 'role-executor_heavy', 'role-executor_light', 'role-default', 'role-qa'].every(
    (id) => document.getElementById(id) instanceof HTMLInputElement,
  ),
)
log(readable, 'los 5 hidden inputs existen con su id — contrato de reference-model-combo-pattern')

// ── HALLAZGO — la selección sin guardar sobrevive a App.rerender() ───────────
// `pendingVal()` (screens-ops.js) lee el hidden input del DOM VIEJO durante el render.
// El poll de 30s dispara rerender(): si la isla se desmontara antes de repintar, la
// elección se perdería en silencio. Es el bug que ya ocurrió en vanilla el 2026-08-10.
const beforeRerender = await page.evaluate(() => document.getElementById('role-planner').value)
await page.evaluate(() => window.App.rerender())
await page.waitForTimeout(500)
const afterRerender = await page.evaluate(
  () => document.getElementById('role-planner')?.value ?? null,
)
log(
  afterRerender === beforeRerender && !!afterRerender,
  `la selección sin guardar sobrevive a rerender() ("${beforeRerender}" → "${afterRerender}")`,
)
const combosAfter = await page.locator('[data-island="model-combo"]').count()
log(combosAfter === 5, `sin islas duplicadas ni perdidas tras rerender() (${combosAfter})`)

// ── CRITERIO 1 y 4 — reglas de diseño de v0.12 contra Radix, medidas ─────────
// (1) anclaje: el panel se ancla al trigger y sigue anclado aunque cambie el ancho del
//     contenedor — no se posiciona por orden-en-el-DOM.
await trigger.click()
await page.locator('[cmdk-root]').waitFor({ state: 'visible' })
const anchored = async () =>
  await page.evaluate(() => {
    const t = document.querySelector('[data-island="model-combo"] button')
    const p = document.querySelector('[cmdk-root]')?.closest('[data-radix-popper-content-wrapper]')
    if (!t || !p) return null
    const tr = t.getBoundingClientRect(),
      pr = p.getBoundingClientRect()
    return { dx: Math.round(pr.left - tr.left), below: pr.top >= tr.bottom - 1 }
  })
const a1 = await anchored()
await page.evaluate(() => {
  document.querySelector('.app').style.setProperty('--sidebar-w-exp', '280px')
})
await page.waitForTimeout(250)
const a2 = await anchored()
log(
  a1 && a2 && a1.dx === a2.dx && a2.below,
  `regla 1 (anclaje al trigger, no al DOM): dx estable ${a1?.dx} → ${a2?.dx}, abre hacia abajo`,
)
await page.evaluate(() => {
  document.querySelector('.app').style.removeProperty('--sidebar-w-exp')
})

// (3) el panel NO queda recortado por ningún overflow de un ancestro — Radix lo
//     portalea a body, que es la solución estructural a la regla del tooltip.
const portaled = await page.evaluate(() => {
  const p = document.querySelector('[data-radix-popper-content-wrapper]')
  if (!p) return null
  let n = p.parentElement,
    clipping = null
  while (n && n !== document.body) {
    const ov = getComputedStyle(n).overflow
    if (ov.includes('hidden') || ov.includes('auto') || ov.includes('scroll')) {
      clipping = n.className || n.tagName
      break
    }
    n = n.parentElement
  }
  return { parentIsBody: p.parentElement === document.body, clipping }
})
log(
  portaled?.parentIsBody && !portaled.clipping,
  `regla 3 (nada lo recorta): el panel se portalea a <body>, sin ancestro con overflow (${portaled?.clipping ?? 'ninguno'})`,
)

// (2)+(4) la fila que lo contiene no se rompe: sin scroll horizontal en la página ni
//     en el contenedor, y el panel entra en el viewport.
const layout = await page.evaluate(() => {
  const main = document.getElementById('main')
  const p = document.querySelector('[data-radix-popper-content-wrapper]').getBoundingClientRect()
  return {
    bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    mainOverflow: main.scrollWidth - main.clientWidth,
    inViewport: p.left >= 0 && p.right <= window.innerWidth && p.bottom <= window.innerHeight + 1,
  }
})
log(
  layout.bodyOverflow <= 0,
  `regla 4 (sin scroll horizontal en la página): overflow ${layout.bodyOverflow}px`,
)
log(
  layout.mainOverflow <= 0,
  `regla 4 (sin scroll horizontal en #main): overflow ${layout.mainOverflow}px`,
)
log(layout.inViewport, 'el panel entra completo en el viewport (Radix lo reubica solo)')

// (4bis) el trigger no desborda su celda: el label largo se recorta con ellipsis.
const fits = await page.evaluate(() => {
  const b = document.querySelector('[data-island="model-combo"] button')
  const span = b.querySelector('span')
  return { overflows: b.scrollWidth - b.clientWidth, ellipsis: getComputedStyle(span).textOverflow }
})
log(
  fits.overflows <= 0 && fits.ellipsis === 'ellipsis',
  `el label largo se recorta con ellipsis en vez de desbordar (overflow ${fits.overflows}px)`,
)
await page.keyboard.press('Escape')

// ── CRITERIO 5 — el cambio de idioma en vivo repinta el combo ────────────────
await page.evaluate(() => window.setLang('en'))
await page.waitForTimeout(300)
await trigger.click()
await page.locator('[cmdk-input]').waitFor({ state: 'visible' })
const phEn = await page.locator('[cmdk-input]').getAttribute('placeholder')
await page.evaluate(() => window.setLang('es'))
await page.waitForTimeout(400)
const phEs = await page.locator('[cmdk-input]').getAttribute('placeholder')
log(
  phEn !== phEs && !!phEn && !!phEs,
  `criterio 5: el idioma cambia en vivo dentro del panel abierto ("${phEn}" → "${phEs}")`,
)
await page.keyboard.press('Escape')
await page.evaluate(() => window.setLang('en'))

// ── allowEmpty — el QA judge debe poder volver a "(auto)" ───────────────────
const qa = page.locator('[data-island="model-combo"]').filter({ has: page.locator('#role-qa') })
await qa.locator('button').first().click()
await page.locator('[cmdk-root]').waitFor({ state: 'visible' })
await page.locator('[cmdk-item]').nth(1).click()
await page.waitForTimeout(300)
const qaPicked = await page.evaluate(() => document.getElementById('role-qa').value)
await qa.locator('button').first().click()
await page.locator('[cmdk-root]').waitFor({ state: 'visible' })
await page.locator('[cmdk-item]').first().click()
await page.waitForTimeout(300)
const qaEmpty = await page.evaluate(() => document.getElementById('role-qa').value)
log(
  qaPicked !== '' && qaEmpty === '',
  `allowEmpty: el QA judge vuelve a "(auto)" de verdad ("${qaPicked}" → "${qaEmpty || 'vacío'}")`,
)

// ── El modal: DOM que se repinta FUERA de App.rerender() ────────────────────
await page.evaluate(() => window.App.go('tasks'))
await page.waitForTimeout(600)
await page.evaluate(() => window.Modal.openTask())
await page.waitForTimeout(800)
const inModal = await page.evaluate(
  () =>
    document.querySelector('.modal-scrim [data-island="model-combo"]') !== null &&
    document.getElementById('t-model') !== null,
)
log(inModal, 'la isla monta dentro del modal, que redibuja con innerHTML fuera de rerender()')
const modalTrigger = page.locator('.modal-scrim [data-island="model-combo"] button').first()
await modalTrigger.click()
await page.locator('[cmdk-root]').waitFor({ state: 'visible', timeout: 5000 })
await page.locator('[cmdk-item]').nth(1).click()
await page.waitForTimeout(300)
const modalVal = await page.evaluate(() => document.getElementById('t-model').value)
log(
  !!modalVal,
  `elegir dentro del modal escribe el hidden input que lee openTask() ("${modalVal}")`,
)

await page.screenshot({ path: 'ui1-modal.png' })
// `Modal.close()` solo quita la clase `.show` y CONSERVA su DOM — así funciona el modal
// vanilla desde siempre, no es un leak. El riesgo real es otro: que abrir y cerrar el
// modal varias veces acumule contenedores o roots de React, ya que cada `openTask()`
// reemplaza el `innerHTML` completo.
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => window.Modal.close())
  await page.waitForTimeout(200)
  await page.evaluate(() => window.Modal.openTask())
  await page.waitForTimeout(400)
}
const modalIslands = await page.evaluate(
  () => document.querySelectorAll('.modal-scrim [data-island="model-combo"]').length,
)
const modalInputs = await page.evaluate(() => document.querySelectorAll('#t-model').length)
log(
  modalIslands === 1 && modalInputs === 1,
  `abrir/cerrar el modal 3 veces no acumula islas ni hidden inputs (${modalIslands}/${modalInputs})`,
)
await page.evaluate(() => window.Modal.close())
await page.waitForTimeout(300)

log(
  errors.length === 0,
  `sin errores de consola en toda la corrida (${errors.join(' | ') || 'ninguno'})`,
)

await browser.close()
console.log(out.join('\n'))
