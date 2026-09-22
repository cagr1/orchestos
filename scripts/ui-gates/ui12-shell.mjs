/**
 * GATE EN VIVO de UI.12.2 — shell del prototipo sobre el dashboard real.
 * Requiere un dashboard levantado en GATE_BASE (por defecto :4323).
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
await page.addInitScript(() => {
  localStorage.setItem('orchestos-shell-mode', 'dev')
  localStorage.setItem('orchestos-sidebar', 'expanded')
})
const errors = []
const requests = []
page.on('request', (request) => requests.push(request))
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
page.on('pageerror', (error) => errors.push(String(error)))

const projectRequest = (path, projectId) => requests.some((request) => {
  try {
    return new URL(request.url()).pathname === path && request.headers()['x-orchestos-project-id'] === projectId
  } catch { return false }
})

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.locator('#navSearchBtn').waitFor({ state: 'visible', timeout: 8000 })
  await page.waitForFunction(() => {
    const rect = document.querySelector('.header')?.getBoundingClientRect()
    return Boolean(rect && rect.x === 0 && rect.width === window.innerWidth && rect.height === 44)
  })
  const cold = await page.evaluate(() => {
    const header = document.querySelector('.header')
    const rect = header?.getBoundingClientRect()
    return {
      header: rect ? { x: rect.x, width: rect.width, height: rect.height } : null,
      wordmark: document.querySelector('.shell-wordmark')?.textContent,
      controls: ['#navSearchBtn', '#navCollapseBtn', '#rpToggle'].every((id) => document.querySelector(id)),
      status: Boolean(document.querySelector('#statusBadge')),
    }
  })
  log(Boolean(cold.header && cold.header.x === 0 && cold.header.width === 1280 && cold.header.height === 44), 'header cruza el viewport y mide 44px')
  log(cold.wordmark?.replace(/\s/g, '') === 'OrchestOS' && cold.controls && !cold.status, 'wordmark y controles del shell presentes, sin statusBadge')

  await page.locator('#navCollapseBtn').click()
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#sidebar')).width === '0px')
  log(await page.locator('#sidebar').evaluate((node) => getComputedStyle(node).width === '0px'), 'navCollapseBtn oculta completamente el sidebar')
  await page.locator('#navCollapseBtn').click()
  await page.waitForFunction(() => Math.abs(document.querySelector('#sidebar').getBoundingClientRect().width - 256) <= 1)
  log(await page.locator('#sidebar').evaluate((node) => Math.abs(node.getBoundingClientRect().width - 256) <= 1), 'navCollapseBtn restaura el sidebar de 256px')

  await page.locator('#shellModeDev').click()
  await page.locator('.dev-empty-logo img').waitFor({ state: 'visible' })
  log(await page.locator('.dev-empty-logo img').isVisible() && (await page.locator('[data-workspace-project]').count()) === 0, 'Dev vacío muestra logo y no abre un workspace')
  const emptyLogoBox = await page.locator('.dev-empty-logo').evaluate((node) => {
    const box = node.getBoundingClientRect()
    const image = node.querySelector('img')?.getBoundingClientRect()
    return { box, image }
  })
  log(Math.abs(emptyLogoBox.box.width - 96) <= 1 && Math.abs(emptyLogoBox.box.height - 96) <= 1 && Boolean(emptyLogoBox.image && emptyLogoBox.image.width <= emptyLogoBox.box.width && emptyLogoBox.image.height <= emptyLogoBox.box.height), 'el logo de Dev vacío cabe en un cuadro de 96px')

  const projects = page.locator('[data-project-id]')
  const projectCount = await projects.count()
  log(projectCount >= 2, `Dev muestra ${projectCount} proyectos`)
  if (projectCount < 2) throw new Error('se requieren al menos dos proyectos registrados')

  const first = projects.first()
  const firstId = await first.getAttribute('data-project-id')
  const firstName = await page.evaluate(async (id) => {
    const projects = await (await fetch('/api/projects')).json()
    const project = projects.find((item) => item.id === id)
    return project?.path.split('/').pop() || project?.path || ''
  }, firstId)
  const firstRow = first.locator('.sidebar-project-row').first()
  const projectNamesFit = await projects.locator('.sidebar-project-name').evaluateAll((nodes) => nodes.every((node) => node.scrollWidth <= node.clientWidth))
  log(projectNamesFit, 'los nombres de proyecto caben sin truncamiento en el sidebar')
  const folder = first.locator('.sidebar-project-folder').first()
  const folderMetrics = await folder.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    const svg = node.querySelector('svg')
    return { width: rect.width, height: rect.height, color: getComputedStyle(node).color, svgWidth: svg?.getBoundingClientRect().width ?? 0, svgHeight: svg?.getBoundingClientRect().height ?? 0 }
  })
  const accent = await page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--accent)'
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  })
  log(Math.abs(folderMetrics.width - 16) <= 1 && Math.abs(folderMetrics.height - 16) <= 1 && Math.abs(folderMetrics.svgWidth - 16) <= 1 && Math.abs(folderMetrics.svgHeight - 16) <= 1 && folderMetrics.color === accent, 'cada proyecto muestra una carpeta de 16px en color accent')
  const sessionCount = await page.evaluate(async (id) => (await (await fetch(`/api/chat/sessions?project=${encodeURIComponent(id)}`)).json()).length, firstId)
  await page.waitForFunction(({ id, count }) => document.querySelector(`[data-project-id="${CSS.escape(id)}"] .sidebar-project-count`)?.textContent === String(count), { id: firstId, count: sessionCount })
  log((await first.locator('.sidebar-project-count').innerText()) === String(sessionCount), 'el chip de proyecto coincide con /api/chat/sessions')
  const chip = first.locator('.sidebar-project-count')
  const rowCenter = await firstRow.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return rect.top + rect.height / 2
  })
  const chipCenter = await chip.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return rect.top + rect.height / 2
  })
  const hiddenActions = await first.locator('[data-project-action]').evaluateAll((nodes) => nodes.every((node) => {
    const style = getComputedStyle(node)
    return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0'
  }))
  await firstRow.hover()
  await page.waitForFunction((projectId) => {
    const row = document.querySelector(`[data-project-id="${CSS.escape(projectId)}"]`)
    const chip = row?.querySelector('.sidebar-project-count')
    return chip && getComputedStyle(chip).display === 'none'
  }, firstId)
  const hoverState = await first.locator('[data-project-action]').evaluateAll((nodes) => ({ visible: nodes.every((node) => getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).opacity !== '0'), chipHidden: getComputedStyle(nodes[0].closest('.sidebar-project-row')?.querySelector('.sidebar-project-count')).display === 'none' }))
  const actionCenters = await first.locator('[data-project-action]').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return rect.top + rect.height / 2
  }))
  const aligned = Math.abs(chipCenter - rowCenter) <= 1 && actionCenters.every((center) => Math.abs(center - rowCenter) <= 1)
  log(hiddenActions && hoverState.visible && hoverState.chipHidden && aligned, 'acciones ocultas sin hover, visibles al pasar y centradas en la fila')

  const beforeScreen = await page.evaluate(() => window.state.screen)
  await firstRow.locator('[data-project-action="toggle"]').click()
  await page.waitForFunction((screen) => window.state.screen === screen, beforeScreen)
  log((await first.locator('.sidebar-agent-row').count()) === sessionCount && (await page.evaluate(() => window.state.screen)) === beforeScreen, 'clic en la fila solo expande sus agentes')

  await firstRow.hover()
  await firstRow.locator('[data-project-action="menu"]').click()
  await page.locator('[data-project-menu-item="settings"]').click()
  await page.locator('[data-project-title]').waitFor({ state: 'visible', timeout: 8000 })
  log((await page.locator('[data-project-title]').innerText()).trim() === firstName, 'Project settings abre desde el menú del proyecto')
  log((await page.locator('[data-project-tab]').count()) === 8, 'Project settings muestra las ocho pestañas')
  await page.locator('[data-project-tab="tasks"]').click()
  await page.locator('.project-settings-head').waitFor({ state: 'visible' })
  await page.locator('[data-project-tab="runs"]').click()
  await page.locator('.project-settings-head').waitFor({ state: 'visible' })
  log(projectRequest('/api/tasks', firstId) && projectRequest('/api/runs', firstId), 'Tasks y Runs usan el header del proyecto')

  await page.locator('#shellModeChat').click()
  const newChat = page.locator('#sidebarNewChat')
  const newChatMetrics = await newChat.evaluate((node) => {
    const button = node.getBoundingClientRect()
    const icon = node.querySelector('.nav-ic')?.getBoundingClientRect()
    const label = node.querySelector('.nav-label')?.getBoundingClientRect()
    return { height: button.height, iconCenter: icon ? icon.top + icon.height / 2 : NaN, labelCenter: label ? label.top + label.height / 2 : NaN }
  })
  log(newChatMetrics.height <= 36 && Math.abs(newChatMetrics.iconCenter - newChatMetrics.labelCenter) <= 1, 'New chat mide hasta 36px y centra el + con el texto')
  await page.locator('#shellModeDev').click()

  await page.locator('#rpToggle').click()
  await page.waitForFunction(() => document.querySelector('.app')?.dataset.rightpanel === 'expanded')
  await page.waitForFunction(() => Math.abs(document.querySelector('#rightpanel').getBoundingClientRect().width - 384) <= 1)
  log(await page.locator('#rightpanel').evaluate((node) => Math.abs(node.getBoundingClientRect().width - 384) <= 1), 'rpToggle abre el panel derecho de 384px')
  await page.locator('#rpToggle').click()
  await page.waitForFunction(() => document.querySelector('.app')?.dataset.rightpanel === 'collapsed')
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#rightpanel')).width === '0px')
  log(await page.locator('#rightpanel').evaluate((node) => getComputedStyle(node).width === '0px'), 'rpToggle cierra el panel derecho')
} catch (error) {
  log(false, `gate abortado: ${error.message}`)
}

log(errors.length === 0, `sin errores de consola (${errors.length})`)
await browser.close()
for (const line of out) console.log(line)
if (failed) process.exitCode = 1
