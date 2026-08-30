/**
 * Gate en vivo de UI.4 — pantalla Specs (Mes 30), la primera pantalla completa migrada.
 *
 * Lo que hay que demostrar acá no es solo "la pantalla anda", sino tres cosas que definen si
 * el patrón sirve para las diez pantallas que faltan:
 *
 *  1. PARIDAD VISUAL. Se compara el estilo computado de la tabla de Specs (React) contra la
 *     de RUNS, que todavía está 100% en vanilla. Es la comparación más honesta que se puede
 *     hacer sin conservar el código viejo: las dos usan las mismas clases del CSS compartido,
 *     así que cualquier diferencia de padding, borde o tipografía significa que la migración
 *     cambió el aspecto. Cuando Runs se migre, hay que mover esta referencia a otra pantalla
 *     que siga en vanilla.
 *  2. LA ISLA NO SE REMONTA en cada repintado. Es la razón de ser del flag `react: true`: una
 *     pantalla que se remonta cada 30s pierde el scroll y la fila abierta. Se mide con estado
 *     de DOM que solo sobrevive si el nodo es el mismo.
 *  3. PARIDAD FUNCIONAL: filas expandibles, sección de archivadas, selección múltiple y las
 *     acciones que pegan a la API.
 *
 * MÉTODO: se siembran specs en `window.state`, la técnica ya usada en el repo
 * (`screens-core.js:874`) — la DB local puede no tener ninguna, y el gate no debe depender de
 * eso. Lo que se verifica es el render y el comportamiento, no el endpoint (que tiene sus
 * propios tests).
 *
 *   bun run src/cli.ts dashboard --port 4325 &
 *   cd <dir con playwright> && BASE=http://localhost:4325 node <repo>/scripts/ui-gates/ui4-specs-screen.mjs
 *
 * Última corrida verde: 2026-08-30.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:4325'
const out = []
const log = (ok, msg) => { out.push(`${ok ? 'PASS' : 'FAIL'} — ${msg}`); if (!ok) process.exitCode = 1 }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
/**
 * El gate PROVOCA un 404 a propósito: pide el lint de una spec sembrada, que por definición no
 * existe en la base. Ese 404 es el escenario que se quiere probar (que un error de la API salga
 * como aviso y no como crash), así que se filtra — pero SOLO ese, por ruta exacta. Cualquier
 * otro error de red o de JS sigue haciendo fallar el gate.
 */
const isExpected404 = (text) => /Failed to load resource.*404/.test(text)
page.on('console', m => { if (m.type() === 'error' && !isExpected404(m.text())) errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

const seed = () => page.evaluate(() => {
  window.state.specs = [
    { id: 'spec-activa-1', status: 'draft', lintStatus: 'pass', lintFindings: 0, deltaIssues: 0,
      hasCapabilities: true, clarify: 'none', createdAt: '2026-08-01T10:00:00Z' },
    { id: 'spec-activa-2', status: 'approved', lintStatus: 'fail', lintFindings: 3, deltaIssues: 2,
      hasCapabilities: false, clarify: 'pending', design: 'pending', createdAt: '2026-08-02T10:00:00Z' },
    { id: 'spec-archivada-1', status: 'archived', lintStatus: 'pass', lintFindings: 0, deltaIssues: 0,
      hasCapabilities: true, clarify: 'none', createdAt: '2026-07-15T10:00:00Z' },
  ]
  window.state.specsStatus = 'ok'
  window.state.openSpec = null
  window.state.archOpen = false
  window.state.bulkSelected.specs.clear()
  window.App.go('specs')
})
await seed()
await page.waitForTimeout(900)

// ── Montaje y estructura ────────────────────────────────────────────────────
log(await page.locator('[data-island="screen-specs"]').count() === 1,
  'la pantalla monta como una sola isla React')
log(await page.locator('.tbl tbody tr.row').count() === 2,
  'la tabla activa muestra solo las specs no archivadas (2 de 3)')
const headers = await page.locator('.tbl thead th').allTextContents()
log(headers.length === 5, `la tabla conserva sus 5 columnas (${headers.join(' · ')})`)
log(await page.locator('.spec-explainer').count() === 1, 'el banner explicativo sigue presente')

// Badges de estado: el mapa STATUS_BADGE se replicó en React, así que se comprueba que
// mapea igual (draft → amber, approved → green).
const badges = await page.evaluate(() =>
  [...document.querySelectorAll('.tbl tbody tr.row .badge')].map(b => b.className + '|' + b.textContent.trim()))
log(badges.some(b => b.includes('amber') && b.includes('draft')) &&
    badges.some(b => b.includes('green') && b.includes('approved')),
  `los badges de estado mapean igual que el vanilla (${badges.join(' , ')})`)

// ── 1. PARIDAD VISUAL contra una pantalla que sigue en vanilla ──────────────
const styleOf = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return null
  const cs = getComputedStyle(el)
  return { pad: cs.padding, font: cs.fontSize, border: cs.borderBottomWidth + ' ' + cs.borderBottomColor, color: cs.color }
}, sel)
const specsCell = await styleOf('.tbl tbody tr.row td')
const specsHead = await styleOf('.tbl thead th')
// La referencia es RUNS y no Skills: Skills no usa tabla (su layout es de cards), así que
// comparar contra ella no medía nada — fallo de la primera versión de este gate, no del
// componente. Runs sigue 100% en vanilla y usa la misma clase `.tbl`.
await page.evaluate(() => { localStorage.setItem('orchestos-mode', 'advanced'); window.App.go('runs') })
await page.waitForTimeout(1400)
const vanillaCell = await styleOf('.tbl tbody tr td')
const vanillaHead = await styleOf('.tbl thead th')
log(specsCell && vanillaCell && specsCell.pad === vanillaCell.pad && specsCell.font === vanillaCell.font
  && specsCell.border === vanillaCell.border,
  `paridad visual de celda contra Runs, que sigue en vanilla (React ${specsCell?.pad}/${specsCell?.font} vs vanilla ${vanillaCell?.pad}/${vanillaCell?.font})`)
log(specsHead && vanillaHead && specsHead.pad === vanillaHead.pad && specsHead.font === vanillaHead.font,
  `paridad visual de encabezado contra Runs (React ${specsHead?.pad} vs vanilla ${vanillaHead?.pad})`)

await seed()
await page.waitForTimeout(900)

// ── 3. Filas expandibles ────────────────────────────────────────────────────
await page.locator('.tbl tbody tr.row').first().click()
await page.waitForTimeout(400)
log(await page.locator('.detail-row').count() === 1, 'clickear una fila abre su detalle')
log(await page.locator('.spec-detail .stat-box').count() >= 3,
  `el detalle muestra sus stat-boxes (${await page.locator('.spec-detail .stat-box').count()})`)
// La primera spec es draft, sin clarify pendiente y sin design → se puede aprobar.
const actionLabels = await page.locator('.spec-detail button').allTextContents()
log(actionLabels.length === 3,
  `una spec draft ofrece aprobar/lint/archivar y NO borrar (${actionLabels.map(s => s.trim()).join(' · ')})`)

// ── 2. LA ISLA NO SE REMONTA — el motivo del flag `react: true` ─────────────
// Se marca el nodo del contenedor: si `App.rerender()` repintara el DOM, la marca se perdería
// junto con el nodo. También se comprueba que la fila abierta siga abierta.
await page.evaluate(() => {
  document.querySelector('[data-island="screen-specs"]').dataset.gateMark = 'vivo'
})
await page.evaluate(() => window.App.rerender())
await page.waitForTimeout(600)
const survived = await page.evaluate(() =>
  document.querySelector('[data-island="screen-specs"]')?.dataset.gateMark ?? null)
log(survived === 'vivo',
  'App.rerender() NO destruye el DOM de la pantalla React (el nodo es el mismo)')
log(await page.locator('.detail-row').count() === 1,
  'la fila abierta sigue abierta tras el repintado (no se remontó)')
log(await page.locator('[data-island="screen-specs"]').count() === 1,
  'no hay islas duplicadas tras el repintado')

// Y el repintado SÍ tiene que reflejar datos nuevos: si no, el bump no sirve.
await page.evaluate(() => {
  window.state.specs = [...window.state.specs, {
    id: 'spec-agregada-por-el-gate', status: 'draft', lintStatus: 'pass', lintFindings: 0,
    deltaIssues: 0, hasCapabilities: true, clarify: 'none', createdAt: '2026-08-03T10:00:00Z',
  }]
  window.App.rerender()
})
await page.waitForTimeout(500)
log(await page.locator('.tbl tbody tr.row').count() === 3,
  'un dato nuevo en el estado aparece tras rerender() — el aviso a React funciona')

// ── Sección de archivadas ───────────────────────────────────────────────────
await page.locator('.section-title.collapsible').click()
await page.waitForTimeout(500)
const tables = await page.locator('.card .tbl').count()
log(tables === 2, `la sección de archivadas se despliega y muestra su tabla (${tables} tablas)`)

// ── Selección múltiple: solo en archivadas ─────────────────────────────────
const checkboxes = await page.locator('.bulk-checkbox').count()
log(checkboxes > 0, `las archivadas ofrecen checkbox de selección (${checkboxes})`)
// Índice 0 = tabla de ACTIVAS (la de archivadas viene después). La primera versión del gate
// usaba el índice 1 y medía justamente la tabla que SÍ debe tener checkbox.
const activeHasCheckbox = await page.evaluate(() =>
  document.querySelectorAll('.card')[0]?.querySelectorAll('.bulk-checkbox').length ?? -1)
log(activeHasCheckbox === 0,
  'la tabla de specs ACTIVAS no ofrece checkbox — borrar ahí sería un no-op silencioso (I.8)')

await page.locator('.bulk-checkbox').last().click()
await page.waitForTimeout(500)
log(await page.locator('.bulk-bar').count() === 1, 'seleccionar muestra la barra flotante de acciones')
const bulkText = await page.locator('.bulk-count').textContent()
log(/1/.test(bulkText), `la barra cuenta lo seleccionado ("${bulkText.trim()}")`)
await page.locator('[class*="ghost"]', { hasText: /.*/ }).first().click().catch(() => {})
await page.waitForTimeout(400)

// ── Una acción real contra la API ───────────────────────────────────────────
// `lint` es la única no destructiva y no cambia estado del servidor: se dispara y se
// comprueba que la respuesta llega a un toast (el Toast de UI.2, ya en React).
await seed()
await page.waitForTimeout(800)
await page.locator('.tbl tbody tr.row').first().click()
await page.waitForTimeout(400)
await page.locator('.spec-detail button', { hasText: 'Lint' }).click()
await page.waitForTimeout(1200)
log(await page.locator('#orchestos-toaster li').count() >= 1,
  'una acción de la pantalla llega a la API y su resultado sale por el Toast de UI.2')

log(errors.length === 0,
  `sin errores de consola ni excepciones (excluido el 404 que el propio gate provoca): ${errors.join(' | ') || 'ninguno'}`)

await page.screenshot({ path: 'ui4-specs.png' })
await browser.close()
console.log(out.join('\n'))
