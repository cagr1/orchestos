// Conductor del piloto ERP.4: una sola página de navegador viva; recibe órdenes por archivos
// en /tmp/erp4/cmd/<n>.json y deja el resultado en /tmp/erp4/out/<n>.json.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'

const require = createRequire('/Users/carlosgallardo/Projects/projects/orchestos/package.json')
const { chromium } = require('playwright')

const base = 'http://localhost:4242'
const projectId = 'cb53f7dd329bfc1c'
const root = '/tmp/erp4'
fs.mkdirSync(`${root}/cmd`, { recursive: true })
fs.mkdirSync(`${root}/out`, { recursive: true })
fs.mkdirSync(`${root}/shots`, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

async function tasks() {
  const response = await fetch(`${base}/api/tasks`, {
    headers: { 'x-orchestos-project-id': projectId, Origin: base, Accept: 'application/json' },
  })
  const body = await response.json()
  return Array.isArray(body.tasks) ? body.tasks : (body.data?.tasks ?? [])
}

async function openProject() {
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.getByRole('button', { name: 'erp-piloto', exact: true }).click()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
}

const handlers = {
  async open() {
    await openProject()
    return { url: page.url() }
  },
  async newChat({ agent }) {
    await page.getByRole('button', { name: 'New chat', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const options = await dialog.getByRole('button').allInnerTexts()
    await dialog
      .getByRole('button', { name: new RegExp(agent, 'i') })
      .first()
      .click()
    await dialog.getByRole('button', { name: 'Start Chat', exact: true }).click()
    const modelControl = page.locator('button[title="Select model and reasoning effort"]')
    await modelControl.waitFor({ state: 'visible', timeout: 30_000 })
    return { options, modelControl: await modelControl.innerText() }
  },
  async send({ text }) {
    const before = new Set((await tasks()).map((task) => task.id))
    const previous = await page.locator('div.prose').count()
    const composer = page.locator('textarea').last()
    const started = Date.now()
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/chat',
      { timeout: 600_000 },
    )
    await composer.fill(text)
    await composer.press('Enter')
    const response = await responsePromise
    const status = response.status()
    const reply = page.locator('div.prose').nth(previous)
    await reply.waitFor({ state: 'visible', timeout: 600_000 }).catch(() => undefined)
    await delay(3_000)
    const created = (await tasks()).filter((task) => !before.has(task.id))
    return {
      status,
      elapsedMs: Date.now() - started,
      reply: await reply.innerText().catch(() => null),
      created,
      taskCard: await page.getByText('Task ready to run', { exact: true }).count(),
      approve: await page.getByRole('button', { name: 'Approve & Run', exact: true }).count(),
    }
  },
  async approve() {
    await page.getByRole('button', { name: 'Approve & Run', exact: true }).last().click()
    await delay(2_000)
    return { tasks: await tasks() }
  },
  async tasks() {
    return { tasks: await tasks() }
  },
  async text() {
    return { body: (await page.locator('body').innerText()).slice(-6000) }
  },
  async reload() {
    await openProject()
    return { body: (await page.locator('body').innerText()).slice(-3000) }
  },
  async fill({ placeholder, text }) {
    await page.getByPlaceholder(placeholder, { exact: false }).first().fill(text)
    return {}
  },
  async clickLast({ name }) {
    await page.getByRole('button', { name, exact: true }).last().click()
    await delay(1_500)
    return { body: (await page.locator('body').innerText()).slice(-3000) }
  },
  async click({ name }) {
    await page.getByRole('button', { name, exact: true }).first().click()
    await delay(1_000)
    return { body: (await page.locator('body').innerText()).slice(-3000) }
  },
}

console.log('driver ready')
for (;;) {
  const pending = fs
    .readdirSync(`${root}/cmd`)
    .filter((name) => name.endsWith('.json'))
    .sort()
  for (const name of pending) {
    const file = `${root}/cmd/${name}`
    const command = JSON.parse(fs.readFileSync(file, 'utf8'))
    fs.renameSync(file, `${file}.taken`)
    let result
    try {
      if (command.op === 'quit') {
        await browser.close()
        fs.writeFileSync(`${root}/out/${name}`, JSON.stringify({ ok: true }))
        process.exit(0)
      }
      result = { ok: true, ...(await handlers[command.op](command)) }
    } catch (error) {
      result = { ok: false, error: String(error) }
    }
    await page
      .screenshot({ path: `${root}/shots/${name.replace('.json', '')}.png` })
      .catch(() => undefined)
    fs.writeFileSync(`${root}/out/${name}`, JSON.stringify(result, null, 2))
  }
  await delay(500)
}
