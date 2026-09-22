/** GATE EN VIVO de UI.3 — contrato base del shell React, actualizado por UI.12.2. */
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
await page.addInitScript(() => localStorage.setItem('orchestos-shell-mode', 'dev'))
const errors = []
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
page.on('pageerror', (error) => errors.push(String(error)))

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.locator('#navCollapseBtn').waitFor({ state: 'visible', timeout: 8000 })
  log(
    await page.locator('.header').evaluate((node) => node.getBoundingClientRect().height === 44),
    'header mide 44px',
  )
  log((await page.locator('#statusBadge').count()) === 0, 'el header no contiene statusBadge')
  await page.locator('#navCollapseBtn').click()
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('#sidebar')).width === '0px',
  )
  log(true, 'navCollapseBtn colapsa el sidebar a 0px')
  await page.locator('#navCollapseBtn').click()
  await page.waitForFunction(
    () => Math.abs(document.querySelector('#sidebar').getBoundingClientRect().width - 256) <= 1,
  )
  log(true, 'navCollapseBtn restaura el sidebar de 256px')
  await page.locator('#rpToggle').click()
  await page.waitForFunction(
    () => document.querySelector('.app')?.dataset.rightpanel === 'expanded',
  )
  log(
    await page.locator('#rightpanel').evaluate((node) => node.getBoundingClientRect().width > 0),
    'rpToggle abre el inspector',
  )
  await page.locator('#rpToggle').click()
  await page.waitForFunction(
    () => document.querySelector('.app')?.dataset.rightpanel === 'collapsed',
  )
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('#rightpanel')).width === '0px',
  )
  log(true, 'rpToggle cierra el inspector')
} catch (error) {
  log(false, `gate abortado: ${error.message}`)
}

log(errors.length === 0, `sin errores de consola (${errors.length})`)
await browser.close()
for (const line of out) console.log(line)
if (failed) process.exitCode = 1
