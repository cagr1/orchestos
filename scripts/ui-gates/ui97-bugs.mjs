/**
 * GATE EN VIVO de UI.9.7 — regresiones de la pasada de bugs contra el dashboard real.
 * Requiere un dashboard ya levantado en GATE_BASE (por defecto :4323).
 */
import { chromium } from 'playwright'

const BASE = process.env.GATE_BASE || 'http://localhost:4323'
const out = []
let total = 0
let passed = 0
const log = (ok, msg) => {
  total += 1
  if (ok) passed += 1
  out.push(`${ok ? 'PASS' : 'FAIL'} — ${msg}`)
}
const visibleErrorToast = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.toast, [role="alert"]')].some((el) => {
      const style = getComputedStyle(el)
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        (el.className.toString().includes('error') || el.getAttribute('data-tone') === 'error')
      )
    }),
  )

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.addInitScript(() => {
  localStorage.setItem('orchestos-shell-mode', 'dev')
})
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', (error) => errors.push(String(error)))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.locator('#sidebar').waitFor({ state: 'visible', timeout: 8000 })

// Punto 5: Activity está borrada del riel Dev, pero Runs sigue siendo una pantalla real.
log(
  (await page.locator('.nav-icon[data-nav="activity"]').count()) === 0,
  'punto 5: Activity cuenta 0 en modo Dev',
)
log(
  await page.evaluate(() => window.SCREENS.activity === undefined),
  'punto 5: window.SCREENS.activity está borrada',
)
log(
  await page.evaluate(() => typeof window.SCREENS.runs?.render === 'function'),
  'punto 5: window.SCREENS.runs.render sigue siendo función',
)
const project = page.locator('[data-project-id]').first()
if (await project.count()) {
  await project.locator('[role="button"]').first().click()
  await page.waitForTimeout(250)
}
log(
  (await page.locator('[data-workspace-tab="runs"]').count()) === 1,
  'punto 5: un proyecto real muestra la pestaña Runs del workspace',
)
log(
  await page.evaluate(() => typeof window.SCREENS.runs?.render === 'function'),
  'punto 5: la pestaña Runs puede renderizarse tras seleccionar el proyecto',
)

// Punto 1: el picker nativo se prueba en el borde HTTP, sin abrir osascript.
const projectsBefore = await page.locator('[data-project-id]').count()
let chooseRequests = 0
await page.route('**/api/projects/choose', async (route) => {
  chooseRequests += 1
  await route.fulfill({ json: { cancelled: true } })
})
const sidebarStates = ['collapsed', 'expanded']
const collapseButton = page.locator('#navCollapseBtn')
for (const sidebarState of sidebarStates) {
  const currentSidebarState = await page.locator('.app').getAttribute('data-sidebar')
  if (currentSidebarState !== sidebarState) {
    await page.locator('.sidebar-toprow').hover()
    await collapseButton.click()
    await page.waitForFunction(
      (expected) => document.querySelector('.app')?.dataset.sidebar === expected,
      sidebarState,
    )
  }
  const addProject = page.locator('#addProjectBtn')
  const buttonWidth = await addProject.evaluate((element) => element.getBoundingClientRect().width)
  log(buttonWidth > 0, `punto 1 (${sidebarState}): Add project tiene ancho visible`)
  await addProject.click()
  await page.waitForTimeout(250)
  log(
    chooseRequests === sidebarStates.indexOf(sidebarState) + 1,
    `punto 1 (${sidebarState}): Add project dispara POST /api/projects/choose`,
  )
  log(
    (await page.locator('[data-project-id]').count()) === projectsBefore &&
      !(await visibleErrorToast(page)),
    `punto 1 (${sidebarState}): respuesta cancelled no agrega proyecto ni muestra toast de error`,
  )
}
await page.unroute('**/api/projects/choose')

const fakeProject = {
  id: 'ui97-gate-project',
  path: '/tmp/ui97-gate-project',
  stackProfile: 'unknown',
  lastUpdated: new Date().toISOString(),
}
let projectListRoute = false
await page.route('**/api/projects/choose', async (route) => {
  await route.fulfill({ json: fakeProject })
})
await page.route('**/api/projects', async (route) => {
  projectListRoute = true
  const response = await route.fetch()
  const projects = await response.json()
  await route.fulfill({
    status: response.status(),
    headers: response.headers(),
    json: [...projects, fakeProject],
  })
})
await page.locator('#addProjectBtn').click()
await page.waitForTimeout(350)
log(projectListRoute, 'punto 1: la respuesta del picker actualiza la lista del sidebar')
log(
  (await page.locator('[data-project-id]').count()) === projectsBefore + 1,
  'punto 1: un proyecto de respuesta crece la lista sin recargar la página',
)
await page.unroute('**/api/projects/choose')
await page.unroute('**/api/projects')

// Punto 2: la marca Codex debe ser el mismo SVG en los dos lugares visibles.
const statusCodex = page.locator(
  '.session-statusbar-cli[aria-label*="codex" i] .session-statusbar-cli-icon svg',
)
const menuCodex = page.locator('.sidebar-cli-menu [data-agent="codex"] svg')
if ((await menuCodex.count()) === 0) {
  await page.evaluate(() => window.App.setShellMode('chat'))
  const menuTrigger = page.locator('#sidebarNewChat')
  await menuTrigger.waitFor({ state: 'visible' })
  await menuTrigger.click()
}
const statusMarkup = (await statusCodex.count())
  ? await statusCodex.evaluate((node) => node.outerHTML)
  : null
const menuMarkup = (await menuCodex.count())
  ? await menuCodex.evaluate((node) => node.outerHTML)
  : null
log(statusMarkup !== null, 'punto 2: se pudo observar el SVG Codex de la barra de uso')
log(menuMarkup !== null, 'punto 2: se pudo observar el SVG Codex del menú Nuevo chat')
log(
  statusMarkup !== null && menuMarkup !== null && statusMarkup === menuMarkup,
  'punto 2: ambos SVG Codex tienen markup idéntico',
)

async function createSession(agent) {
  return page.evaluate(async (name) => {
    const response = await fetch('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: name }),
    })
    return { ok: response.ok, body: await response.json() }
  }, agent)
}

// Puntos 3 y 4: sesión Codex real, pill, panel y persistencia del esfuerzo.
const codex = await createSession('codex')
log(codex.ok && typeof codex.body?.id === 'string', 'punto 3: POST crea una sesión Codex')
if (codex.ok && codex.body?.id) {
  await page.evaluate(
    async (session) => {
      localStorage.setItem('orchestos-shell-mode', 'chat')
      localStorage.setItem('orchestos-last-chat-session', session.id)
      state.shellMode = 'chat'
      state.chatSessions = [session]
      state.chatSessionId = session.id
      state.chatSessionsStatus = 'ok'
      App.go('chat')
      App.rerender()
    },
    { ...codex.body, agent: 'codex', projectId: null },
  )
  await page.waitForTimeout(350)
}
const pill = page.locator('[data-modelfx-trigger]')
log(
  (await pill.count()) === 1 && !/subscription|suscripción/i.test((await pill.textContent()) || ''),
  'punto 3: la pastilla existe y no muestra texto de suscripción',
)
if (await pill.count()) await pill.click()
const panelText = (await page.locator('[data-modelfx-panel]').textContent()) || ''
log(!/decided by|lo decide/i.test(panelText), 'punto 3: el panel no muestra “decided by”')
log(
  ![...(await page.locator('[data-modelfx-panel] *').allTextContents())].some((text) =>
    /^(Agent|Agente)$/.test(text.trim()),
  ),
  'punto 3: el panel no tiene una fila aislada Agent/Agente',
)
log(
  (await page.locator('[data-modelfx-nav="effort"]').count()) === 1,
  'punto 4: Codex muestra navegación de esfuerzo',
)
await page.locator('[data-modelfx-nav="effort"]').click()
const effortValues = await page
  .locator('[data-modelfx-effort]')
  .evaluateAll((items) => items.map((item) => item.dataset.modelfxEffort))
log(
  JSON.stringify(effortValues) === JSON.stringify(['minimal', 'low', 'medium', 'high', 'xhigh']),
  'punto 4: niveles de esfuerzo exactos y en orden',
)
await page.locator('[data-modelfx-effort="high"]').click()
await page.reload({ waitUntil: 'networkidle' })
log(
  await page.evaluate(() => window.state.chatEffort === 'high'),
  'punto 4: elegir high persiste tras reload',
)

// Defecto A: observar por DOM que OpenCode no renderiza selector data-modelfx.
const opencode = await createSession('opencode')
if (opencode.ok && opencode.body?.id) {
  await page.evaluate(
    (session) => {
      state.shellMode = 'chat'
      state.chatSessions = [session]
      state.chatSessionId = session.id
      state.chatSessionsStatus = 'ok'
      App.go('chat')
      App.rerender()
    },
    { ...opencode.body, agent: 'opencode', projectId: null },
  )
  await page.waitForTimeout(250)
  log(
    (await page.locator('[data-modelfx]').count()) === 0,
    'defecto A: OpenCode no renderiza selector data-modelfx',
  )
} else {
  out.push(
    `NO OBSERVABLE — defecto A: no se pudo crear sesión OpenCode (${JSON.stringify(opencode.body)})`,
  )
}

log(
  errors.length === 0,
  `punto 6: cero errores de consola${errors.length ? ` (${errors.slice(0, 5).join(' | ')})` : ''}`,
)
await browser.close()
console.log(`${out.join('\n')}\n${passed}/${total} PASS`)
if (passed !== total) process.exit(1)
