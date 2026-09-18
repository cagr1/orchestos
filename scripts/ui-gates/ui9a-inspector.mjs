/**
 * GATE EN VIVO de UI.9.A — acceso persistente a Explorer, Diff y Terminal.
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
await page.addInitScript(() => localStorage.setItem('orchestos-shell-mode', 'dev'))
const errors = []
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
page.on('pageerror', (error) => errors.push(String(error)))

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.locator('#sidebar').waitFor({ state: 'visible', timeout: 8000 })
  const projects = page.locator('[data-project-id]')
  log((await projects.count()) > 0, 'arranque en Dev con un proyecto seleccionable')
  if ((await projects.count()) === 0) throw new Error('no hay proyecto para el gate')

  await projects.first().click()
  await page.locator('[data-inspector-tool]').first().waitFor({ state: 'visible', timeout: 8000 })

  const checkTools = async (sidebarState) => {
    for (const tool of ['explorer', 'diff', 'terminal']) {
      const button = page.locator(`[data-inspector-tool="${tool}"]`)
      const box = await button.boundingBox()
      let trial = true
      try { await button.click({ trial: true }) } catch { trial = false }
      log(Boolean(box && box.width > 0 && box.height > 0 && trial), `${sidebarState}: ${tool} visible y clickeable`)
    }
  }

  const collapse = page.locator('#navCollapseBtn')
  const setSidebar = async (expected) => {
    if ((await page.locator('.app').getAttribute('data-sidebar')) !== expected) {
      await page.locator('.sidebar-toprow').hover()
      await collapse.click()
      await page.waitForFunction((value) => document.querySelector('.app')?.dataset.sidebar === value, expected)
    }
  }
  await setSidebar('collapsed')
  await checkTools('sidebar colapsado')
  await setSidebar('expanded')
  await checkTools('sidebar expandido')

  await setSidebar('collapsed')
  await page.locator('[data-inspector-tool="explorer"]').click()
  await page.waitForFunction(() => document.querySelector('.app')?.dataset.rightpanel === 'expanded')
  await page.waitForFunction(() => document.querySelector('[data-inspector-tool="explorer"]')?.classList.contains('active'))
  log(
    await page.locator('[data-inspector-tool="explorer"]').evaluate((button) => button.classList.contains('active')) &&
      !(await page.locator('[data-inspector-tool="diff"]').evaluate((button) => button.classList.contains('active'))) &&
      !(await page.locator('[data-inspector-tool="terminal"]').evaluate((button) => button.classList.contains('active'))),
    'Explorer queda active y los otros tools no',
  )
  const openWidth = await page.locator('#rightpanel').evaluate((node) => getComputedStyle(node).width)
  log(Number.parseFloat(openWidth) > 0, 'Explorer abre el inspector con ancho positivo')

  await page.locator('[data-inspector-tool="terminal"]').click()
  await page.waitForFunction(() => document.querySelector('[data-inspector-tool="terminal"]')?.classList.contains('active'))
  log(
    await page.locator('[data-inspector-tool="terminal"]').evaluate((button) => button.classList.contains('active')) &&
      !(await page.locator('[data-inspector-tool="explorer"]').evaluate((button) => button.classList.contains('active'))),
    'Terminal mueve active y Explorer deja de estar active',
  )

  const count = await projects.count()
  if (count > 1) {
    await projects.nth(1).click()
    await page.waitForFunction(() => document.querySelector('.app')?.dataset.rightpanel === 'expanded')
    log(true, 'cambiar de proyecto conserva el inspector abierto')
  } else {
    log(false, 'cambiar de proyecto conserva el inspector abierto (se requieren dos proyectos)')
  }

  await page.locator('#rpClose').click()
  await page.waitForFunction(() => document.querySelector('.app')?.dataset.rightpanel === 'collapsed')
  await page.waitForTimeout(350)
  const closedWidth = await page.locator('#rightpanel').evaluate((node) => getComputedStyle(node).width)
  log(closedWidth === '0px', 'rpClose devuelve el inspector a 0px')
  log(
    !(await page.locator('[data-inspector-tool="explorer"]').evaluate((button) => button.classList.contains('active'))) &&
      !(await page.locator('[data-inspector-tool="diff"]').evaluate((button) => button.classList.contains('active'))) &&
      !(await page.locator('[data-inspector-tool="terminal"]').evaluate((button) => button.classList.contains('active'))),
    'rpClose deja todos los tools sin active',
  )
  await checkTools('tras cerrar el inspector')
} catch (error) {
  log(false, `gate abortado: ${error.message}`)
}

log(errors.length === 0, `sin errores de consola (${errors.length})`)
await browser.close()
for (const line of out) console.log(line)
if (failed) process.exitCode = 1
