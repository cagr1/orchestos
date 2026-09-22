/**
 * GATE EN VIVO de UI.10 — Specs, Skills y Plan por proyecto en Settings.
 * Requiere un dashboard real levantado en GATE_BASE (por defecto :4323).
 */
import { chromium } from 'playwright'

const BASE = process.env.GATE_BASE || 'http://localhost:4323'
const out = []
let failed = false
const log = (ok, message) => {
  out.push(`${ok ? 'PASS' : 'FAIL'} — ${message}`)
  if (!ok) failed = true
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.addInitScript(() => localStorage.setItem('orchestos-shell-mode', 'chat'))
const errors = []
const requests = []
page.on('request', (request) => requests.push(request))
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
page.on('pageerror', (error) => errors.push(String(error)))

const apiRequest = (path, projectId) =>
  requests.find(
    (request) =>
      new URL(request.url()).pathname === path &&
      request.headers()['x-orchestos-project-id'] === projectId,
  )

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.locator('[data-nav="settings"]').click()
  await page.locator('.settings-nav').waitFor({ state: 'visible', timeout: 8000 })
  try {
    await page
      .locator('[data-settings-project]')
      .first()
      .waitFor({ state: 'visible', timeout: 8000 })
  } catch {
    // Let the project-count assertion below report the useful failure message.
  }

  const projects = page.locator('[data-settings-project]')
  const projectCount = await projects.count()
  log(projectCount >= 2, `Settings muestra ${projectCount} proyectos registrados`)
  if (projectCount < 2) throw new Error('se requieren al menos dos proyectos registrados')

  const first = projects.first()
  const firstId = await first.getAttribute('data-settings-project')
  const firstName = (await first.innerText()).trim()
  await first.click()
  await page.locator('[data-project-title]').waitFor({ state: 'visible', timeout: 8000 })
  log(
    (await page.locator('[data-project-title]').innerText()) === firstName,
    'el primer proyecto muestra su nombre',
  )
  log(Boolean(apiRequest('/api/specs', firstId)), 'Specs usa el header del primer proyecto')

  for (const tab of ['specs', 'skills', 'plan']) {
    const button = page.locator(`[data-project-tab="${tab}"]`)
    await button.click()
    const island = page.locator(`[data-island="screen-${tab}"]`)
    await island.waitFor({ state: 'visible', timeout: 8000 })
    await page.waitForFunction(
      (selector) => (document.querySelector(selector)?.textContent || '').trim().length > 0,
      `[data-island="screen-${tab}"]`,
    )
    log(await island.isVisible(), `${tab} muestra su isla con contenido`)
    log(Boolean(apiRequest(`/api/${tab}`, firstId)), `${tab} usa el header del primer proyecto`)
  }

  await page.locator('[data-project-back]').click()
  await page.locator('[data-settings-project]').first().waitFor({ state: 'visible', timeout: 8000 })
  log(await page.locator('.settings-nav').isVisible(), '← Settings vuelve a la barra de Settings')

  const second = page.locator('[data-settings-project]').nth(1)
  const secondId = await second.getAttribute('data-settings-project')
  const secondName = (await second.innerText()).trim()
  await second.click()
  await page.locator('[data-project-title]').waitFor({ state: 'visible', timeout: 8000 })
  log(
    (await page.locator('[data-project-title]').innerText()) === secondName,
    'el segundo proyecto cambia el título',
  )
  log(Boolean(apiRequest('/api/specs', secondId)), 'Specs cambia al header del segundo proyecto')
} catch (error) {
  log(false, `gate abortado: ${error.message}`)
}

log(errors.length === 0, `sin errores de consola (${errors.length})`)
await browser.close()
for (const line of out) console.log(line)
if (failed) process.exitCode = 1
