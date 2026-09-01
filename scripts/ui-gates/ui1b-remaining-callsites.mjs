/**
 * UI.1 — cierre de la brecha de evidencia declarada (Mes 30, 2026-08-29).
 *
 * Al cerrar UI.1 se dijo explícitamente en PLAN.md que 2 de los 5 call sites de
 * `buildModelSelect()` NO se habían podido verificar en vivo: `diagnose-model` (necesita un
 * run fallido con diagnóstico) y `draft-model` (necesita un draft natural activo). Este
 * script los pone en pantalla y los verifica. La honestidad de aquel párrafo era el punto:
 * lo que se declara sin verificar se cierra después, no se olvida.
 *
 * MÉTODO — sembrar el estado y repintar, sin producir un run real. No es un atajo inventado
 * acá: es la técnica que el propio repo ya usó para este mismo componente, documentada en
 * `screens-core.js:874` ("verificado en vivo (state.diagnoseCache inyectado + App.rerender(),
 * sin tarea real)"). Lo que se verifica es que el combo MONTA y respeta su contrato en el
 * contexto real de cada pantalla — no el pipeline de diagnóstico, que es otra cosa y ya
 * tiene sus propios tests.
 *
 * LÍMITE, dicho igual de explícito que el original: el estado está sembrado, así que esto NO
 * prueba que un run fallido real produzca ese diagnóstico. Prueba lo que UI.1 necesitaba
 * probar: que el combo React se monta en esos dos lugares y expone el hidden input que sus
 * consumidores leen.
 *
 * Cómo se corre:
 *   bun run src/cli.ts dashboard --port 4324 &
 *   cd <dir con playwright> && BASE=http://localhost:4324 node <repo>/scripts/ui-gates/ui1b-remaining-callsites.mjs
 *
 * Última corrida verde: 2026-08-29.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:4324'
const out = []
const log = (ok, msg) => {
  out.push(`${ok ? 'PASS' : 'FAIL'} — ${msg}`)
  if (!ok) process.exitCode = 1
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

// ── CALL SITE 4/5 — `diagnose-model`, en el panel de diagnóstico de Tasks ────
// El panel vive dentro de una fila de detalle que solo se despliega para una tarea fallida
// con diagnóstico cacheado. Se siembran las dos cosas: una tarea `failed` en la lista y su
// entrada en `diagnoseCache`, más `openDiagnose` para que la fila salga desplegada.
await page.evaluate(() => {
  const taskId = 'gate-ui1b-diagnose'
  window.state.tasks = [
    {
      id: taskId,
      description: 'tarea sembrada por el gate UI.1b',
      status: 'failed',
      retryCount: 1,
      model: 'deepseek/deepseek-v4-flash',
      qaVerdict: null,
    },
  ]
  window.state.diagnoseCache[taskId] = {
    taskId,
    pattern: 'deterministic_check',
    confidence: 'high',
    suggestion: 'sembrado por el gate',
    details: 'sembrado por el gate',
    lastErrorResult: 'error sembrado',
  }
  window.state.openDiagnose = taskId
  window.App.go('tasks')
})
await page.waitForTimeout(900)

const diagIsland = page.locator('.diag-actions [data-island="model-combo"]')
await diagIsland.waitFor({ state: 'visible', timeout: 8000 })
log(true, 'call site 4/5 `diagnose-model`: la isla React monta dentro del panel de diagnóstico')
log(
  await page.evaluate(() => document.getElementById('diagnose-model') instanceof HTMLInputElement),
  'diagnose-model: el hidden input existe con su id — el contrato que lee `screens-core.js:1454`',
)

// Se elige de verdad, con el panel real, y se comprueba que el valor queda donde el
// consumidor lo busca (`btn.closest('.diag-actions').querySelector('#diagnose-model')`).
await diagIsland.locator('button').first().click()
await page.locator('[cmdk-root]').waitFor({ state: 'visible', timeout: 5000 })
log(
  await page.locator('[cmdk-input]').isVisible(),
  'diagnose-model: abre el panel buscable, no un <select> nativo',
)
await page.locator('[cmdk-item]').nth(1).click()
await page.waitForTimeout(400)
const diagValue = await page.evaluate(() => {
  // Exactamente como lo lee el handler de "reintentar" en screens-core.js.
  const btn = document.querySelector('.diag-actions [data-act="retry"]')
  return btn?.closest('.diag-actions')?.querySelector('#diagnose-model')?.value ?? null
})
log(
  !!diagValue,
  `diagnose-model: elegir escribe el valor donde el handler de reintento lo busca ("${diagValue}")`,
)

// ── CALL SITE 5/5 — `draft-model`, en el composer de draft de Tasks ─────────
// Vive dentro del <details> "Ajustes avanzados" del preview de draft natural, en la
// pantalla TASKS (no en chat: el composer de draft es de `SCREENS.tasks`). Se siembra el
// draft y se abre el details con `draftAdvancedOpen`, que es el flag que el render lee.
await page.evaluate(() => {
  window.state.naturalDraft = {
    id: 'gate-ui1b-draft',
    description: 'draft sembrado por el gate UI.1b',
    output: [],
    executor: 'openrouter',
    executor_model: 'deepseek/deepseek-v4-flash',
  }
  window.state.draftAdvancedOpen = true
  window.state.openDiagnose = null
  window.App.go('tasks')
})
await page.waitForTimeout(900)

const draftIsland = page
  .locator('[data-island="model-combo"]')
  .filter({ has: page.locator('#draft-model') })
await draftIsland.first().waitFor({ state: 'attached', timeout: 8000 })
log(true, 'call site 5/5 `draft-model`: la isla React monta dentro del composer de draft')
const draftInitial = await page.evaluate(
  () => document.getElementById('draft-model')?.value ?? null,
)
log(
  draftInitial === 'deepseek/deepseek-v4-flash',
  `draft-model: arranca con el modelo del draft, no con un default fijo ("${draftInitial}")`,
)

// El combo puede estar dentro de un <details> colapsado ("Ajustes avanzados"): se abre.
await page.evaluate(() => {
  document.querySelectorAll('details').forEach((d) => {
    d.open = true
  })
})
await page.waitForTimeout(400)
await draftIsland.locator('button').first().click()
await page.locator('[cmdk-root]').waitFor({ state: 'visible', timeout: 5000 })
await page.locator('[cmdk-item]').nth(2).click()
await page.waitForTimeout(400)
const draftValue = await page.evaluate(() => document.getElementById('draft-model')?.value ?? null)
log(
  !!draftValue && draftValue !== draftInitial,
  `draft-model: elegir cambia el valor que leen las dos rutas de creación ("${draftInitial}" → "${draftValue}")`,
)

// La selección tiene que sobrevivir al poll de 30s, igual que en Settings.
await page.evaluate(() => window.App.rerender())
await page.waitForTimeout(600)
const draftAfter = await page.evaluate(() => document.getElementById('draft-model')?.value ?? null)
log(
  draftAfter === draftValue,
  `draft-model: la selección sobrevive a App.rerender() ("${draftValue}" → "${draftAfter}")`,
)

log(
  errors.length === 0,
  `sin errores de consola en toda la corrida (${errors.join(' | ') || 'ninguno'})`,
)

await page.screenshot({ path: 'ui1b-callsites.png' })
await browser.close()
console.log(out.join('\n'))
