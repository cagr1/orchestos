/** GATE EN VIVO de UI.9.A — inspector desde el nuevo toggle global de UI.12.2. */
import { chromium } from 'playwright'

const BASE = process.env.GATE_BASE || 'http://localhost:4323'
const out = []
let failed = false
const log = (ok, message) => { out.push(`${ok ? 'PASS' : 'FAIL'} — ${message}`); if (!ok) failed = true }
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.addInitScript(() => localStorage.setItem('orchestos-shell-mode', 'dev'))
const errors = []
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
page.on('pageerror', (error) => errors.push(String(error)))

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.locator('#rpToggle').waitFor({ state: 'visible', timeout: 8000 })
  await page.locator('#rpToggle').click()
  await page.waitForFunction(() => document.querySelector('.app')?.dataset.rightpanel === 'expanded')
  for (const tool of ['explorer', 'diff', 'terminal']) {
    const button = page.locator(`#rpTab${tool[0].toUpperCase()}${tool.slice(1)}`)
    log(await button.isVisible(), `${tool} visible en el inspector`)
  }
  await page.locator('#rpTabTerminal').click()
  await page.waitForFunction(() => document.querySelector('#rpTabTerminal')?.classList.contains('active'))
  log(await page.locator('#rpTabTerminal').evaluate((node) => node.classList.contains('active')), 'Terminal cambia la herramienta activa')
  const projects = page.locator('[data-project-id]')
  if (await projects.count() > 1) {
    await projects.nth(1).click()
    log(await page.locator('.app').evaluate((node) => node.dataset.rightpanel === 'expanded'), 'expandir otro proyecto conserva el inspector abierto')
  } else {
    log(false, 'expandir otro proyecto conserva el inspector abierto (se requieren dos proyectos)')
  }
  await page.locator('#rpClose').click()
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#rightpanel')).width === '0px')
  log(await page.locator('#rightpanel').evaluate((node) => getComputedStyle(node).width === '0px'), 'rpClose cierra el inspector')
  log(!(await page.locator('#rpToggle').evaluate((node) => node.classList.contains('active'))), 'el toggle queda inactivo al cerrar')
  await page.locator('#rpToggle').click()
  await page.waitForFunction(() => document.querySelector('#rpTabTerminal')?.classList.contains('active'))
  log(await page.locator('#rpTabTerminal').evaluate((node) => node.classList.contains('active')), 'reabre la última herramienta usada')
} catch (error) { log(false, `gate abortado: ${error.message}`) }

log(errors.length === 0, `sin errores de consola (${errors.length})`)
await browser.close()
for (const line of out) console.log(line)
if (failed) process.exitCode = 1
