import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const OUT = '/tmp/ui135'
const WIDTH = 1440
const HEIGHT = 900
const WAIT = 400
const TARGETS = [
  { name: 'tpl', url: 'http://localhost:3000' },
  { name: 'app', url: 'http://localhost:4330' },
]

await fs.rm(OUT, { recursive: true, force: true })
await fs.mkdir(OUT, { recursive: true })

const sleep = (ms = WAIT) => new Promise((resolve) => setTimeout(resolve, ms))

function makeRecorder(page) {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      errors.push(`HTTP ${response.status()}: ${response.request().method()} ${response.url()}`)
    }
  })
  return errors
}

async function settle(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 })
  } catch {
    // A live API or dev server can keep the network busy; the screenshot is still useful.
  }
  await sleep()
}

async function clickOne(page, label, selectors = []) {
  const candidates = [
    page.getByRole('button', { name: label, exact: true }),
    page.getByLabel(label, { exact: true }),
    page.getByTitle(label, { exact: true }),
    ...selectors.map((selector) => page.locator(selector)),
  ]
  for (const candidate of candidates) {
    try {
      const item = candidate.first()
      if (await item.isVisible({ timeout: 700 })) {
        await item.click()
        await settle(page)
        return true
      }
    } catch {
      // Try the next equivalent accessible selector.
    }
  }
  return false
}

async function clickText(page, text) {
  try {
    const item = page.getByText(text, { exact: true }).first()
    if (await item.isVisible({ timeout: 700 })) {
      await item.click()
      await settle(page)
      return true
    }
  } catch {
    // Missing text is recorded by the caller.
  }
  return false
}

async function clickGlobalSettings(page) {
  const item = page.locator('aside button').filter({ hasText: 'Settings' }).last()
  if (!(await item.isVisible({ timeout: 700 }).catch(() => false))) return false
  await item.click()
  await settle(page)
  return true
}

async function visible(page, selector, description) {
  const item = typeof selector === 'string' ? page.locator(selector) : selector
  return (await item.isVisible({ timeout: 700 }).catch(() => false)) ? null : description
}

async function clickMode(page, mode) {
  return clickOne(page, mode)
}

async function resetGroup(page, mode) {
  await page.reload({ waitUntil: 'domcontentloaded' })
  await settle(page)
  return (await clickMode(page, mode)) ? null : `mode ${mode}`
}

async function capture(page, errors, report, id) {
  const entry = { ok: true }
  await page.screenshot({ path: path.join(OUT, `${id}--${report.target}.png`), fullPage: false })
  if (errors.length) entry.errors = [...new Set(errors)]
  report.steps[id] = entry
}

async function step(page, errors, report, id, action) {
  let missing
  try {
    missing = await action()
  } catch (error) {
    report.steps[id] = { ok: false, errors: [`step: ${error.message}`] }
    await page.screenshot({ path: path.join(OUT, `${id}--${report.target}.png`), fullPage: false })
    return
  }
  if (missing) report.steps[id] = { ok: true, missing }
  await capture(page, errors, report, id)
  if (missing) report.steps[id].missing = missing
}

async function openProjectMenu(page) {
  const project = page.locator('aside').getByText('orchestos', { exact: true }).first()
  if (!(await project.isVisible({ timeout: 700 }).catch(() => false))) return false
  if (
    !(await project
      .hover({ timeout: 1500 })
      .then(() => true)
      .catch(() => false))
  )
    return false
  return await clickOne(page, 'Project actions')
}

async function openFirstAgent(page) {
  const project = page.locator('aside').getByText('orchestos', { exact: true }).first()
  if (!(await project.isVisible({ timeout: 700 }).catch(() => false))) return false
  await project.click().catch(() => {})
  await settle(page)
  const rows = page
    .locator('aside')
    .locator('button')
    .filter({ hasText: /Agent|Orchestrator|Reviewer/i })
  const first = rows.first()
  if (!(await first.isVisible({ timeout: 700 }).catch(() => false))) return false
  await first.click()
  await settle(page)
  return true
}

async function openLaunchAgent(page) {
  const project = page.locator('aside').getByText('orchestos', { exact: true }).first()
  if (!(await project.isVisible({ timeout: 700 }).catch(() => false))) return false
  await project.hover({ timeout: 1500 }).catch(() => {})
  return clickOne(page, 'Launch new agent')
}

async function reportSettingsButton(page, report) {
  const item = page.locator('aside button').filter({ hasText: 'Settings' }).last()
  if (await item.isVisible({ timeout: 700 }).catch(() => false)) return null
  report.settingsButton = await item
    .first()
    .evaluate((node) => node.outerHTML)
    .catch(() => null)
  return 'sidebar Settings button'
}

async function runTarget(target) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const errors = makeRecorder(page)
  const report = { target: target.name, steps: {} }

  try {
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await settle(page)
  } catch (error) {
    report.steps['chat-home'] = { ok: false, errors: [`navigation: ${error.message}`] }
    await page
      .screenshot({ path: path.join(OUT, `chat-home--${target.name}.png`), fullPage: false })
      .catch(() => {})
    await browser.close()
    return report
  }

  await resetGroup(page, 'Chat')
  await step(
    page,
    errors,
    report,
    'chat-home',
    async () =>
      await visible(page, page.getByRole('heading', { name: 'Chat', exact: true }), 'Chat heading'),
  )
  await step(page, errors, report, 'chat-model-selector', async () =>
    (await clickOne(page, 'Select agent/model', [
      'button[title*="agent"]',
      'button[aria-label*="agent"]',
    ]))
      ? await visible(
          page,
          page.getByRole('dialog').or(page.getByText(/Claude|Codex|OpenCode/i).first()),
          'open model/CLI list',
        )
      : 'chat model/CLI selector',
  )
  await resetGroup(page, 'Dev')
  await step(
    page,
    errors,
    report,
    'dev-home',
    async () =>
      await visible(page, page.getByRole('heading', { name: /Dev$/, exact: false }), 'Dev heading'),
  )

  await step(page, errors, report, 'dev-agent', async () =>
    (await openFirstAgent(page))
      ? await visible(
          page,
          page.getByRole('heading', { name: /Dev$/, exact: false }),
          'first agent workspace',
        )
      : 'first agent of first project',
  )

  for (const tab of ['Files', 'Diff', 'History']) {
    const id = `dev-inspector-${tab.toLowerCase()}`
    await step(page, errors, report, id, async () => {
      if (!(await clickText(page, tab))) return `Inspector tab ${tab}`
      return await visible(
        page,
        page.getByText(tab, { exact: true }).first(),
        `active Inspector tab ${tab}`,
      )
    })
  }

  await resetGroup(page, 'Dev')
  await step(page, errors, report, 'dev-project-menu', async () =>
    (await openProjectMenu(page)) ? null : 'Project actions for first project',
  )
  await page.keyboard.press('Escape')
  await settle(page)
  await step(page, errors, report, 'modal-new-agent', async () =>
    (await openLaunchAgent(page))
      ? await visible(page, page.getByRole('dialog'), 'new agent dialog')
      : 'Launch new agent',
  )
  await clickOne(page, 'Cancel')
  await page.keyboard.press('Escape')
  await settle(page)
  await step(page, errors, report, 'modal-add-project', async () =>
    (await clickOne(page, 'Add or Upload Project'))
      ? await visible(page, page.getByRole('dialog'), 'add project dialog')
      : 'Add or Upload Project',
  )
  await clickOne(page, 'Cancel')
  await page.keyboard.press('Escape')
  await settle(page)
  await step(page, errors, report, 'modal-delete-project', async () => {
    const opened = await openProjectMenu(page)
    if (!opened) return 'Project actions for delete'
    if (!(await clickText(page, 'Delete'))) return 'Delete project action'
    const missing = await visible(page, page.getByRole('dialog'), 'delete project dialog')
    await clickOne(page, 'Cancel')
    return missing
  })
  await step(page, errors, report, 'palette', async () =>
    (await clickOne(page, 'Open Command Palette')) ? null : 'Open Command Palette',
  )
  await page.keyboard.press('Escape')
  await settle(page)
  await step(page, errors, report, 'statusbar-usage', async () => {
    const usage = page.getByText(/usage|5h|weekly/i).first()
    if (!(await usage.isVisible({ timeout: 700 }).catch(() => false)))
      return 'usage in bottom status bar'
    await usage.click()
    await settle(page)
    return null
  })
  await page.keyboard.press('Escape')
  await settle(page)

  await resetGroup(page, 'Chat')
  const settingsOpened = await clickGlobalSettings(page)
  let settingsFailure = null
  if (!settingsOpened) {
    const button = page.locator('aside button').filter({ hasText: 'Settings' }).last()
    const outerHTML = await button.evaluate((node) => node.outerHTML).catch(() => null)
    settingsFailure = outerHTML
      ? `sidebar Settings button; outerHTML: ${outerHTML}`
      : 'sidebar Settings button; outerHTML unavailable'
  }
  for (const section of [
    'General',
    'Health',
    'API & Models',
    'Model routing',
    'Executor',
    'Usage',
    'Danger zone',
    'Language',
  ]) {
    const id = `settings-${section.toLowerCase().replaceAll(' ', '-').replaceAll('&', 'and')}`
    await step(page, errors, report, id, async () => {
      if (settingsFailure) return settingsFailure
      if (!(await clickOne(page, section))) return `Settings section ${section}`
      return (
        (await visible(page, page.getByText('Back to app').first(), 'Back to app')) ||
        (await visible(
          page,
          page.getByRole('heading', { name: new RegExp(section.split(' ')[0], 'i') }).first(),
          `Settings heading ${section}`,
        ))
      )
    })
  }

  await resetGroup(page, 'Chat')
  await clickGlobalSettings(page)
  const projects = page.getByText('PROJECTS', { exact: true }).first()
  if (!(await projects.isVisible({ timeout: 700 }).catch(() => false)))
    report.steps['project-tasks'] = { ok: true, missing: 'PROJECTS in Settings' }
  const firstProject = page.getByText('orchestos', { exact: true }).last()
  if (await firstProject.isVisible({ timeout: 700 }).catch(() => false)) {
    await firstProject.click({ timeout: 1500 }).catch(() => {})
    await settle(page)
  } else {
    report.steps['project-tasks'] = { ok: true, missing: 'first project in PROJECTS' }
  }
  for (const tab of ['Tasks', 'Runs', 'Graph', 'Memory', 'Specs', 'Skills', 'Instincts', 'Plan']) {
    const id = `project-${tab.toLowerCase()}`
    await step(page, errors, report, id, async () => {
      if (!(await clickOne(page, tab))) return `project tab ${tab}`
      return await visible(
        page,
        page.locator('button.app-tab-btn-active').filter({ hasText: tab }),
        `active project tab ${tab}`,
      )
    })
  }

  await browser.close()
  return report
}

const reports = {}
for (const target of TARGETS) reports[target.name] = await runTarget(target)

const sideBrowser = await chromium.launch({ headless: true })
const sideContext = await sideBrowser.newContext({
  viewport: { width: WIDTH * 2, height: HEIGHT },
  deviceScaleFactor: 1,
})
const sidePage = await sideContext.newPage()
for (const id of Object.keys(reports.tpl.steps)) {
  const tpl = path.join(OUT, `${id}--tpl.png`)
  const app = path.join(OUT, `${id}--app.png`)
  const side = path.join(OUT, `${id}--side.png`)
  const [tplData, appData] = await Promise.all([fs.readFile(tpl), fs.readFile(app)])
  const html = `<!doctype html><style>html,body{margin:0;background:#111}main{display:flex;width:${WIDTH * 2}px;height:${HEIGHT}px}img{width:${WIDTH}px;height:${HEIGHT}px;object-fit:contain;background:#111}</style><main><img src="data:image/png;base64,${tplData.toString('base64')}"><img src="data:image/png;base64,${appData.toString('base64')}"></main>`
  await sidePage.setContent(html)
  await sidePage.screenshot({ path: side, fullPage: false })
}
await sideBrowser.close()

const output = {}
for (const id of Object.keys(reports.tpl.steps)) {
  output[id] = {
    tpl: reports.tpl.steps[id],
    app: reports.app.steps[id] ?? { ok: false, missing: 'step not reached' },
  }
}
await fs.writeFile(path.join(OUT, 'report.json'), `${JSON.stringify(output, null, 2)}\n`)
console.log(`Captured ${Object.keys(output).length} states in ${OUT}`)
