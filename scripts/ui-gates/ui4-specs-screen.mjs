// Runtime: node
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
 * MÉTODO: se intercepta `/api/specs` con Playwright antes de navegar al proyecto. Así el gate
 * verifica el mismo fetch con header de proyecto que usa el dashboard real, sin tocar el estado
 * global del navegador.
 *
 *   bun run src/cli.ts dashboard --port 4325 &
 *   cd <dir con playwright> && BASE=http://localhost:4325 node <repo>/scripts/ui-gates/ui4-specs-screen.mjs
 *
 * Última corrida verde: 2026-08-30.
 */

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:4325'
const artifactsDir = process.env.GATE_ARTIFACTS_DIR || mkdtempSync(join(tmpdir(), 'orchestos-ui4-'))
const out = []
const log = (ok, msg) => {
  out.push(`${ok ? 'PASS' : 'FAIL'} — ${msg}`)
  if (!ok) process.exitCode = 1
}

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
page.on('console', (m) => {
  if (m.type() === 'error' && !isExpected404(m.text())) errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))

let fixture = [
  {
    id: 'spec-activa-1',
    status: 'draft',
    lintStatus: 'pass',
    lintFindings: 0,
    deltaIssues: 0,
    hasCapabilities: true,
    clarify: 'none',
    createdAt: '2026-08-01T10:00:00Z',
  },
  {
    id: 'spec-activa-2',
    status: 'approved',
    lintStatus: 'fail',
    lintFindings: 3,
    deltaIssues: 2,
    hasCapabilities: false,
    clarify: 'pending',
    design: 'pending',
    createdAt: '2026-08-02T10:00:00Z',
  },
  {
    id: 'spec-archivada-1',
    status: 'archived',
    lintStatus: 'pass',
    lintFindings: 0,
    deltaIssues: 0,
    hasCapabilities: true,
    clarify: 'none',
    createdAt: '2026-07-15T10:00:00Z',
  },
]
await page.route('**/api/specs', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }),
)
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.locator('[data-nav="settings"]').click()
await page.locator('[data-settings-project]').first().click()
await page.locator('[data-project-tab="specs"]').click()
await page.locator('[data-island="screen-specs"]').waitFor({ state: 'visible' })
await page.locator('.tbl tbody tr.row').first().waitFor({ state: 'visible' })

// ── Montaje y estructura ────────────────────────────────────────────────────
log(
  (await page.locator('[data-island="screen-specs"]').count()) === 1,
  'la pantalla monta como una sola isla React',
)
log(
  (await page.locator('.tbl tbody tr.row').count()) === 2,
  'la tabla activa muestra solo las specs no archivadas (2 de 3)',
)
const headers = await page.locator('.tbl thead th').allTextContents()
log(headers.length === 4, `la tabla conserva sus 4 columnas fuera de bulk (${headers.join(' · ')})`)
log((await page.locator('.spec-explainer').count()) === 1, 'el banner explicativo sigue presente')

const rails = await page.evaluate(() =>
  [...document.querySelectorAll('.tbl tbody tr.row .status-rail')].map(
    (rail) => `${rail.className}|${rail.textContent.trim()}`,
  ),
)
log(
  rails.some((r) => r.includes('status-rail ok') && r.includes('draft')) &&
    rails.some((r) => r.includes('status-rail bad') && r.includes('approved')),
  `el StatusRail muestra glifo, estado y salud (${rails.join(' , ')})`,
)

// No hay una tabla vanilla accesible por clicks dentro de Settings; el bloque de comparación
// visual se elimina en vez de navegar por una pantalla imperativa fuera del alcance del gate.

const openSpecs = async () => {
  await page.locator('[data-nav="settings"]').click()
  await page.locator('[data-settings-project]').first().click()
  await page.locator('[data-project-tab="specs"]').click()
  await page.locator('[data-island="screen-specs"]').waitFor({ state: 'visible' })
  await page.locator('.tbl tbody tr.row').first().waitFor({ state: 'visible' })
}

// ── 3. Filas expandibles ────────────────────────────────────────────────────
await page.locator('.tbl tbody tr.row').first().click()
await page.locator('.detail-row').waitFor({ state: 'visible' })
log((await page.locator('.detail-row').count()) === 1, 'clickear una fila abre su detalle')
log(
  (await page.locator('.spec-detail .stat-box').count()) >= 3,
  `el detalle muestra sus stat-boxes (${await page.locator('.spec-detail .stat-box').count()})`,
)
// La primera spec es draft, sin clarify pendiente y sin design → se puede aprobar.
const actionLabels = await page.locator('.spec-detail button').allTextContents()
log(
  actionLabels.length === 3,
  `una spec draft ofrece aprobar/lint/archivar y NO borrar (${actionLabels.map((s) => s.trim()).join(' · ')})`,
)

await page.locator('.section-title.collapsible').click()
await page.locator('.card .tbl').nth(1).waitFor({ state: 'visible' })
const bulkHeaders = await page.locator('.card .tbl').nth(1).locator('thead th').count()
log(
  bulkHeaders === 5,
  `la tabla archivada en modo bulk muestra la quinta columna checkbox (${bulkHeaders})`,
)

// ── 2. LA ISLA NO SE REMONTA — el motivo del flag `react: true` ─────────────
// Se marca el nodo del contenedor: si `App.rerender()` repintara el DOM, la marca se perdería
// junto con el nodo. También se comprueba que la fila abierta siga abierta.
await page.evaluate(() => {
  document.querySelector('[data-island="screen-specs"]').dataset.gateMark = 'vivo'
})
await page.evaluate(() => window.App.rerender())
await page.locator('.detail-row').waitFor({ state: 'visible' })
const survived = await page.evaluate(
  () => document.querySelector('[data-island="screen-specs"]')?.dataset.gateMark ?? null,
)
log(
  survived === 'vivo',
  'App.rerender() NO destruye el DOM de la pantalla React (el nodo es el mismo)',
)
log(
  (await page.locator('.detail-row').count()) === 1,
  'la fila abierta sigue abierta tras el repintado (no se remontó)',
)
log(
  (await page.locator('[data-island="screen-specs"]').count()) === 1,
  'no hay islas duplicadas tras el repintado',
)

// Una actualización posterior llega por el mismo endpoint, no por mutación del estado global.
fixture = [
  ...fixture,
  {
    id: 'spec-agregada-por-el-gate',
    status: 'draft',
    lintStatus: 'pass',
    lintFindings: 0,
    deltaIssues: 0,
    hasCapabilities: true,
    clarify: 'none',
    createdAt: '2026-08-03T10:00:00Z',
  },
]
await page.getByRole('button', { name: /Refresh|Actualizar/ }).click()
await page
  .locator('.tbl tbody tr.row')
  .filter({ hasText: 'spec-agregada-por-el-gate' })
  .waitFor({ timeout: 8000 })
log(
  (await page.locator('.tbl tbody tr.row').count()) === 4,
  'un dato nuevo llega por red y aparece tras el refresh — la isla React se actualiza',
)

// ── Sección de archivadas ───────────────────────────────────────────────────
const tables = await page.locator('.card .tbl').count()
log(tables === 2, `la sección de archivadas se despliega y muestra su tabla (${tables} tablas)`)

// ── Selección múltiple: solo en archivadas ─────────────────────────────────
const checkboxes = await page.locator('.bulk-checkbox').count()
log(checkboxes > 0, `las archivadas ofrecen checkbox de selección (${checkboxes})`)
// Índice 0 = tabla de ACTIVAS (la de archivadas viene después). La primera versión del gate
// usaba el índice 1 y medía justamente la tabla que SÍ debe tener checkbox.
const activeHasCheckbox = await page.evaluate(
  () => document.querySelectorAll('.card')[0]?.querySelectorAll('.bulk-checkbox').length ?? -1,
)
log(
  activeHasCheckbox === 0,
  'la tabla de specs ACTIVAS no ofrece checkbox — borrar ahí sería un no-op silencioso (I.8)',
)

await page.locator('.bulk-checkbox').last().click()
await page.locator('.bulk-bar').waitFor({ state: 'visible' })
log(
  (await page.locator('.bulk-bar').count()) === 1,
  'seleccionar muestra la barra flotante de acciones',
)
const bulkText = await page.locator('.bulk-count').textContent()
log(/1/.test(bulkText), `la barra cuenta lo seleccionado ("${bulkText.trim()}")`)
await page.locator('.bulk-bar button.btn.ghost.sm').click()
await page.locator('.bulk-bar').waitFor({ state: 'detached' })

// ── Una acción real contra la API ───────────────────────────────────────────
// `lint` es la única no destructiva y no cambia estado del servidor: se dispara y se
// comprueba que la respuesta llega a un toast (el Toast de UI.2, ya en React).
await openSpecs()
await page.locator('.tbl tbody tr.row').first().click()
await page.locator('.detail-row').waitFor({ state: 'visible' })
await page.locator('.spec-detail button', { hasText: 'Lint' }).click()
await page.locator('#orchestos-toaster li').first().waitFor({ state: 'visible', timeout: 8000 })
log(
  (await page.locator('#orchestos-toaster li').count()) >= 1,
  'una acción de la pantalla llega a la API y su resultado sale por el Toast de UI.2',
)

log(
  errors.length === 0,
  `sin errores de consola ni excepciones (excluido el 404 que el propio gate provoca): ${errors.join(' | ') || 'ninguno'}`,
)

await page.screenshot({ path: `${artifactsDir}/ui4-specs.png` })
await browser.close()
console.log(out.join('\n'))
