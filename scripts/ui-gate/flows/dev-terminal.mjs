import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run } from '../lib.mjs'

export default async function devTerminal({ page, api, step, visible, cleanup, shot }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-devterm-'))
  writeFileSync(join(projectRoot, 'README.md'), '# Dev terminal gate\n')
  run('git', ['init', '-q'], projectRoot)
  run('git', ['add', 'README.md'], projectRoot)
  run(
    'git',
    [
      '-c',
      'user.name=ui-gate',
      '-c',
      'user.email=ui-gate@example.invalid',
      'commit',
      '-qm',
      'fixture',
    ],
    projectRoot,
  )
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', projectRoot], process.cwd())
  const projects = await api('/api/projects')
  const project = (projects.data ?? []).find(
    (item) => item.path === projectRoot || item.path === realpathSync(projectRoot),
  )
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  const toggle = page.locator('[data-terminal-toggle]')
  await step('Chat no muestra el botón Terminal', (await toggle.count()) === 0)
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const escaped = basename(projectRoot).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await page
    .getByRole('button', { name: new RegExp(`^${escaped}(?:\\s|$)`) })
    .first()
    .click()
  await step('Dev muestra el botón Terminal', await visible(toggle))
  const sockets = []
  page.on('websocket', (socket) => {
    if (socket.url().includes('/api/terminal')) {
      const tracked = { socket, closed: false }
      socket.on('close', () => {
        tracked.closed = true
      })
      sockets.push(tracked)
    }
  })
  await toggle.click()
  const panel = page.getByRole('region', { name: 'Project terminal', includeHidden: true })
  const tab = page.getByRole('tab', { name: 'Terminal', exact: true })
  await step(
    'Terminal abre como pestaña activa central',
    (await visible(panel)) && (await tab.getAttribute('aria-selected')) === 'true',
  )
  await step(
    'Terminal ocupa todo el espacio bajo las pestañas',
    await panel.evaluate((el) => {
      const area = el.parentElement.parentElement
      const rect = el.getBoundingClientRect()
      const tabs = area.querySelector('[data-dev-session-tabs]').getBoundingClientRect()
      const center = area.getBoundingClientRect()
      return (
        Math.abs(rect.width - center.width) < 2 &&
        Math.abs(rect.height - (center.height - tabs.height)) < 2
      )
    }),
  )
  await page.waitForTimeout(2_000)
  const rows = panel.locator('.xterm-rows')
  const waitEcho = async (needle) => {
    for (let i = 0; i < 20; i++) {
      if (
        ((await rows.innerText().catch(() => '')).match(new RegExp(needle, 'g')) ?? []).length >= 2
      )
        return true
      await page.waitForTimeout(250)
    }
    return false
  }
  await page.keyboard.type('echo ui58-focus')
  await page.keyboard.press('Enter')
  await step('al abrir, el foco está en el PTY y echo produce salida', await waitEcho('ui58-focus'))
  await shot('dev-terminal')
  const terminalId = await tab.getAttribute('data-terminal-tab')
  const initialSocket = sockets.at(-1)
  const initialSocketCount = sockets.length
  await page.keyboard.press('Control+`')
  await step(
    'Ctrl+` mantiene la misma pestaña activa sin duplicarla',
    (await tab.count()) === 1 &&
      (await tab.getAttribute('data-terminal-tab')) === terminalId &&
      (await tab.getAttribute('aria-selected')) === 'true',
  )
  await page.locator('[data-explorer-file="README.md"]').click()
  await page.locator('[data-dev-file-panel]').waitFor()
  await step(
    'otra pestaña oculta la terminal sin desmontarla',
    (await panel.count()) === 1 && !(await panel.isVisible()),
  )
  await page.keyboard.press('Control+`')
  await step(
    'Ctrl+` reactiva la misma terminal y conserva la salida',
    (await visible(panel)) &&
      (await tab.getAttribute('data-terminal-tab')) === terminalId &&
      (await waitEcho('ui58-focus')),
  )
  await shot('dev-terminal-return')
  await panel.locator('.xterm-helper-textarea').focus()
  await page.keyboard.type('echo ui58-alive')
  await page.keyboard.press('Enter')
  await step('el PTY sigue vivo después de cambiar de pestaña', await waitEcho('ui58-alive'))
  await step(
    'cambiar de pestaña conserva el mismo socket',
    sockets.length === initialSocketCount && !!initialSocket && !initialSocket.closed,
    JSON.stringify({
      before: initialSocketCount,
      after: sockets.length,
      closed: initialSocket?.closed,
    }),
  )
  await page.keyboard.type('exit')
  await page.keyboard.press('Enter')
  const reopen = panel.getByRole('button', { name: 'Reabrir', exact: true })
  await step('exit ofrece el icono Reabrir', await visible(reopen))
  await reopen.click()
  await page.waitForTimeout(2_000)
  await page.keyboard.type('echo ui58-again')
  await page.keyboard.press('Enter')
  await step('tras Reabrir, el PTY vuelve a responder', await waitEcho('ui58-again'))
  await page.keyboard.type('exit')
  await page.keyboard.press('Enter')
  await step('otra salida ofrece Reabrir', await visible(reopen))
  await panel.locator('.xterm-helper-textarea').focus()
  await page.keyboard.press('Enter')
  await reopen.waitFor({ state: 'hidden' })
  await page.waitForTimeout(2_000)
  const marker = `UI61-${Date.now()}`
  await page.keyboard.type(`echo ${marker}`)
  await page.keyboard.press('Enter')
  await step(
    'Enter reabre la terminal y el PTY vuelve a responder',
    !(await reopen.isVisible()) && (await waitEcho(marker)),
  )
  const liveSocket = sockets.at(-1)
  await tab.hover()
  await page.getByRole('button', { name: 'Close tab Terminal', exact: true }).click()
  for (let i = 0; i < 20 && !liveSocket?.closed; i++) await page.waitForTimeout(100)
  await step('cerrar la pestaña cierra el socket del PTY', !!liveSocket?.closed)
  await step(
    'cerrar la pestaña desmonta la terminal',
    (await panel.count()) === 0 && (await tab.count()) === 0,
  )
}
