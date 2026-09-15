import { writeFileSync } from 'node:fs'

import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:4391'
const screens = ['chat', 'tasks', 'settings']
const results = []
const browser = await chromium.launch()

try {
  for (const screen of screens) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console.error: ${message.text()}`)
    })

    let response
    try {
      response = await page.goto(`${BASE}/?screen=${encodeURIComponent(screen)}`, {
        waitUntil: 'networkidle',
      })
      await page.locator('#main').waitFor({ state: 'visible', timeout: 8000 })
      await page.waitForTimeout(800)
    } catch (error) {
      errors.push(`navigation: ${error.message}`)
    }

    const metrics = await page.evaluate(() => ({
      scriptLoaded: [...document.scripts].some((script) => script.src.includes('screens-core.js')),
      mainText: document.querySelector('#main')?.innerText.length ?? 0,
    }))
    results.push({
      screen,
      status: response?.status() ?? null,
      ...metrics,
      errors,
    })
    await page.close()
  }
} finally {
  await browser.close()
}

const verdict = results.every(
  ({ status, scriptLoaded, mainText, errors }) =>
    status === 200 && scriptLoaded && mainText > 0 && errors.length === 0,
)
  ? 'PASS'
  : 'FAIL'
const evidence = {
  item: 'AT.9.1',
  base: BASE,
  date: new Date().toISOString(),
  screens: results,
  verdict,
}
const evidencePath = 'docs/done/evidence/AT.9.1-live.json'
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`)
console.log(JSON.stringify(evidence, null, 2))
if (verdict === 'FAIL') process.exitCode = 1
