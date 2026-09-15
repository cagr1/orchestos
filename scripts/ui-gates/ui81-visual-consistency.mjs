/**
 * Gate en vivo de UI.8.1 — consistencia visual contra el dashboard real.
 *
 * Se mide el estilo COMPUTADO de la pantalla auditada con Playwright real. El
 * baseline de style= es un trinquete: solo una reducción lo mueve hacia abajo.
 * El pill del header (`#statusBadge`) es la única excepción documentada al
 * límite global de radios.
 *
 * Cómo se corre:
 *   bun run src/cli.ts dashboard --port 4321 &
 *   BASE=http://localhost:4321 node scripts/ui-gates/ui81-visual-consistency.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:4321'
const SCREEN = process.argv[2] || 'chat'
const baselinePath = resolve('scripts/ui-gates/ui81-inline-style-baseline.json')
const out = []
const log = (ok, message) => {
  out.push(`${ok ? 'PASS' : 'FAIL'} — ${message}`)
  if (!ok) process.exitCode = 1
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
try {
  await page.goto(`${BASE}/?screen=${encodeURIComponent(SCREEN)}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.locator('#main').waitFor({ state: 'visible', timeout: 8000 })

  const metrics = await page.evaluate(() => {
    const visible = (el) => {
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0
      )
    }
    const nodes = [...document.querySelectorAll('body *')].filter(visible)
    const textNodes = nodes.filter((el) =>
      [...el.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
      ),
    )
    const fontSizes = [...new Set(textNodes.map((el) => getComputedStyle(el).fontSize))].sort()
    const radiusNodes = nodes.filter((el) => el.id !== 'statusBadge' && !el.closest('#statusBadge'))
    const radii = [...new Set(radiusNodes.map((el) => getComputedStyle(el).borderRadius))].sort()
    const selects = nodes
      .filter((el) => el.tagName === 'SELECT')
      .map((el) => el.outerHTML.slice(0, 160))
    const inlineStyleAttributes = document.querySelectorAll('[style]').length
    return { fontSizes, radii, selects, inlineStyleAttributes }
  })

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
  log(
    metrics.fontSizes.length <= 5,
    `font-size computados: ${metrics.fontSizes.length} (${metrics.fontSizes.join(', ')})`,
  )
  log(
    metrics.radii.length <= 2,
    `border-radius computados sin #statusBadge: ${metrics.radii.length} (${metrics.radii.join(', ')})`,
  )
  log(
    metrics.selects.length === 0,
    `select nativo visible: ${metrics.selects.length}${metrics.selects.length ? ` (${metrics.selects.join(' | ')})` : ''}`,
  )
  log(
    metrics.inlineStyleAttributes <= baseline.inlineStyleAttributes,
    `atributos style= inline: ${metrics.inlineStyleAttributes} (baseline ${baseline.inlineStyleAttributes})`,
  )
  if (metrics.inlineStyleAttributes < baseline.inlineStyleAttributes) {
    writeFileSync(
      baselinePath,
      `${JSON.stringify({ inlineStyleAttributes: metrics.inlineStyleAttributes }, null, 2)}\n`,
    )
    out.push(`INFO — baseline actualizado a ${metrics.inlineStyleAttributes}`)
  }
} finally {
  await browser.close()
}

console.log(out.join('\n'))
