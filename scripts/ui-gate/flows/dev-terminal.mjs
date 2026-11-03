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
  await toggle.click()
  const panel = page.getByRole('region', { name: 'Project terminal' })
  await step('el panel de terminal se abre', await visible(panel))
  await page.waitForTimeout(2_000)
  const rows = page.locator('[data-dev-terminal] .xterm-rows')
  const count = async (needle) =>
    ((await rows.innerText().catch(() => '')).match(new RegExp(needle, 'g')) ?? []).length
  const waitEcho = async (needle) => {
    for (let i = 0; i < 20; i++) {
      if ((await count(needle)) >= 2) return true
      await page.waitForTimeout(250)
    }
    return false
  }
  // Sin clic previo ni focus() manual: el foco debe estar ya en el xterm.
  await page.keyboard.type('echo ui55-focus')
  await page.keyboard.press('Enter')
  await step('al abrir, el foco está en el xterm (ui55-focus)', await waitEcho('ui55-focus'))
  await page.keyboard.type('echo ui55-ok')
  await page.keyboard.press('Enter')
  const seen = await rows.innerText().catch(() => '')
  await step('xterm muestra la salida ui55-ok', await waitEcho('ui55-ok'), seen.slice(0, 200))
  await shot('dev-terminal')
  await page.keyboard.press('Control+`')
  await page.waitForTimeout(500)
  await step('Ctrl+` cierra el panel', (await panel.count()) === 0)
  await page.keyboard.press('Control+`')
  await step('Ctrl+` lo reabre', await visible(panel))
  await page.waitForTimeout(2_000)
  await page.keyboard.type('exit')
  await page.keyboard.press('Enter')
  const exited = page.getByText('Process exited', { exact: true })
  await step('exit muestra "Process exited"', await visible(exited))
  await page.getByRole('button', { name: 'Reopen', exact: true }).click()
  await page.waitForTimeout(2_000)
  await page.keyboard.type('echo ui55-again')
  await page.keyboard.press('Enter')
  await step('tras Reopen, ui55-again aparece', await waitEcho('ui55-again'))
  await page.getByRole('button', { name: 'Close terminal', exact: true }).click()
  await step('el botón cerrar quita el panel', (await panel.count()) === 0)
}
