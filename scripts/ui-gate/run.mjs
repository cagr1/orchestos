#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { formatResult, lintFlowSource } from './lib.mjs'

const flows = process.argv.slice(2)
const runDir = path.join(os.tmpdir(), `ui-gate-${process.pid}`)
const statuslineHome = path.join(runDir, 'claude-statusline-home')
const dashboardLog = path.join(runDir, 'dashboard.log')
let dashboard
let dashboardLogFd
let cleaning = false
const pendingCleanups = []

function stdout(line) {
  process.stdout.write(`${line}\n`)
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

async function killDashboard() {
  if (!dashboard || dashboard.killed) return
  try {
    process.kill(dashboard.pid, 'SIGTERM')
  } catch (error) {
    if (error.code !== 'ESRCH') throw error
    return
  }
  const deadline = Date.now() + 3000
  while (dashboard.exitCode === null && Date.now() < deadline) await delay(50)
  if (dashboard.exitCode === null) {
    try {
      process.kill(dashboard.pid, 'SIGKILL')
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  }
}

async function cleanup() {
  if (cleaning) return
  cleaning = true
  try {
    await killDashboard()
  } finally {
    if (dashboardLogFd !== undefined) {
      fs.closeSync(dashboardLogFd)
      dashboardLogFd = undefined
    }
  }
}

process.on('exit', () => {
  if (dashboard && dashboard.exitCode === null) {
    try {
      process.kill(dashboard.pid, 'SIGKILL')
    } catch {}
  }
  if (dashboardLogFd !== undefined) {
    try {
      fs.closeSync(dashboardLogFd)
    } catch {}
  }
})
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    for (const cleanupFn of pendingCleanups.splice(0).reverse()) {
      try {
        await cleanupFn()
      } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      }
    }
    await cleanup()
    process.exit(1)
  })
}

async function removeOrphanedUiProjects(base) {
  const response = await fetch(`${base}/api/projects`)
  if (!response.ok) return
  const projects = await response.json()
  const tempRoot = path.resolve(os.tmpdir())
  const prefix = `${tempRoot}${path.sep}orchestos-ui-`
  for (const project of Array.isArray(projects) ? projects : []) {
    const projectPath = typeof project.path === 'string' ? path.resolve(project.path) : ''
    if (!projectPath.startsWith(prefix)) continue
    await fetch(`${base}/api/projects/${encodeURIComponent(project.id)}`, { method: 'DELETE' })
    await fsp.rm(projectPath, { recursive: true, force: true })
  }
}

async function waitForHealth(base) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/health`)
      if (response.status === 200) return true
    } catch {}
    await delay(250)
  }
  return false
}

async function runFlow(name, base) {
  const result = { flujo: name, pass: false, steps: [], errores: [], capturas: [] }
  const sourcePath = path.resolve('scripts/ui-gate/flows', `${name}.mjs`)
  let browser
  let cleanups = []
  try {
    const source = await fsp.readFile(sourcePath, 'utf8')
    const lintError = lintFlowSource(source)
    if (lintError) {
      result.steps.push({ nombre: 'lint', ok: false, detalle: lintError })
      return result
    }

    const flow = await import(`${pathToFileURL(sourcePath).href}?run=${process.pid}-${Date.now()}`)
    browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const expectedHttpErrors = []
    const unexpectedErrors = []
    cleanups = []
    page.on('pageerror', (error) => unexpectedErrors.push(`pageerror: ${error.message}`))
    page.on('response', (response) => {
      if (response.status() < 400 || !response.url().includes('/api/')) return
      if (!expectedHttpErrors.some((pattern) => pattern.test(response.url()))) {
        unexpectedErrors.push(`HTTP ${response.status()}: ${response.url()}`)
      }
    })

    const ctx = {
      page,
      base,
      statuslineHome,
      api: async (apiPath, init = {}) => {
        const response = await fetch(`${base}${apiPath}`, {
          ...init,
          headers: { ...(init.headers || {}), Origin: base, Accept: 'application/json' },
        })
        const text = await response.text()
        let data = null
        try {
          data = text ? JSON.parse(text) : null
        } catch {
          data = text
        }
        return { ...data, data, ok: response.ok, status: response.status }
      },
      // Waits for a locator to become visible without letting a timeout fail the flow.
      visible: async (locator, timeoutMs = 15_000) => {
        try {
          await locator.first().waitFor({ state: 'visible', timeout: timeoutMs })
          return true
        } catch {
          return false
        }
      },
      // Waits for a locator to become hidden without letting a timeout fail the flow.
      hidden: async (locator, timeoutMs = 15_000) => {
        try {
          await locator.first().waitFor({ state: 'hidden', timeout: timeoutMs })
          return true
        } catch {
          return false
        }
      },
      step: async (stepName, condition, detail = '') => {
        const ok = Boolean(condition)
        result.steps.push({ nombre: stepName, ok, detalle: detail || (ok ? 'ok' : 'failed') })
        return ok
      },
      shot: async (shotName) => {
        const shotDir = path.join(runDir, name)
        await fsp.mkdir(shotDir, { recursive: true })
        const shotPath = path.join(shotDir, `${shotName}.png`)
        await page.screenshot({ path: shotPath })
        result.capturas.push(shotPath)
      },
      cleanup: (fn) => {
        cleanups.push(fn)
        pendingCleanups.push(fn)
      },
      consoleErrors: () => [...unexpectedErrors],
      expectHttpError: (pattern) =>
        expectedHttpErrors.push(pattern instanceof RegExp ? pattern : new RegExp(pattern)),
    }

    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
    await flow.default(ctx)
    result.errores.push(...unexpectedErrors)
    result.pass = result.steps.every((step) => step.ok) && result.errores.length === 0
  } catch (error) {
    result.errores.push(error instanceof Error ? error.message : String(error))
    result.pass = false
  } finally {
    for (const cleanupFn of cleanups.reverse()) {
      try {
        await cleanupFn()
      } catch (error) {
        result.errores.push(error instanceof Error ? error.message : String(error))
        result.pass = false
      }
      const index = pendingCleanups.indexOf(cleanupFn)
      if (index >= 0) pendingCleanups.splice(index, 1)
    }
    if (browser) await browser.close()
    result.pass = result.steps.every((step) => step.ok) && result.errores.length === 0
  }
  return result
}

async function main() {
  if (flows.length === 0) {
    process.stderr.write('Usage: node scripts/ui-gate/run.mjs <flujo> [<flujo>...]\n')
    process.exitCode = 2
    return
  }

  await fsp.mkdir(runDir, { recursive: true })
  await fsp.mkdir(statuslineHome, { recursive: true })
  const port = await freePort()
  dashboardLogFd = fs.openSync(dashboardLog, 'a')
  dashboard = spawn('bun', ['run', 'src/cli.ts', 'dashboard', '--port', String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, ORCHESTOS_CLAUDE_STATUSLINE_HOME: statuslineHome },
    stdio: ['ignore', dashboardLogFd, dashboardLogFd],
  })
  const base = `http://127.0.0.1:${port}`
  const results = []
  if (!(await waitForHealth(base))) {
    results.push({
      flujo: 'boot',
      pass: false,
      steps: [{ nombre: 'boot', ok: false, detalle: 'health timeout' }],
      errores: [],
      capturas: [],
    })
    stdout('FAIL boot: health timeout')
  } else {
    try {
      await removeOrphanedUiProjects(base)
    } catch (error) {
      stdout(`WARN orphan cleanup: ${error instanceof Error ? error.message : String(error)}`)
    }
    for (const name of flows) {
      const result = await runFlow(name, base)
      results.push(result)
      stdout(formatResult(result))
    }
  }
  await cleanup()
  const evidencePath = path.join(runDir, 'result.json')
  await fsp.writeFile(evidencePath, JSON.stringify(results, null, 2))
  stdout(`EVIDENCE ${evidencePath}`)
  process.exitCode =
    results.length === flows.length && results.every((result) => result.pass) ? 0 : 1
}

main().catch(async (error) => {
  await cleanup()
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
