import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run } from '../lib.mjs'

function opencodePids() {
  try {
    const output = execFileSync('pgrep', ['-x', 'opencode'], { encoding: 'utf8' })
    return new Set(output.trim().split(/\s+/).filter(Boolean).map(Number))
  } catch {
    return new Set()
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export default async function opencodeTerminal({ page, api, step, visible, cleanup, shot }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-opencode-'))
  const title = `AT.15 OpenCode ${Date.now()}`
  writeFileSync(join(projectRoot, 'README.md'), '# OpenCode terminal gate\n')
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

  const created = await api('/api/chat/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: project.id, agent: 'opencode', mode: 'code', title }),
  })
  if (!created.data?.id)
    throw new Error(`Could not create OpenCode session: ${JSON.stringify(created)}`)
  const before = opencodePids()
  await page.evaluate(() => localStorage.setItem('orchestos-theme', 'carbon'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectName = basename(projectRoot)
  const escapedProjectName = projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const projectButton = page
    .getByRole('button', {
      name: new RegExp(`^${escapedProjectName}(?:\\s|$)`),
    })
    .first()
  const sessionLabel = page.getByText(title, { exact: true })
  if (!(await sessionLabel.isVisible().catch(() => false))) {
    await projectButton.click()
  }
  const launchAgentButton = page.getByRole('button', { name: 'Launch new agent', exact: true })
  if (await launchAgentButton.isVisible().catch(() => false)) {
    await launchAgentButton.click()
    const agentDialog = page.getByRole('dialog')
    const opencodeOption = agentDialog.getByRole('button', { name: /opencode/i })
    await step('Dev agent modal still offers OpenCode', await visible(opencodeOption))
    await agentDialog.getByRole('button', { name: 'Close modal', exact: true }).click()
  } else {
    await step(
      'Dev agent modal still offers OpenCode',
      false,
      'Launch new agent button not visible',
    )
  }
  await step('OpenCode session appears in Dev sidebar', await visible(sessionLabel), title)
  if (await sessionLabel.isVisible().catch(() => false)) await sessionLabel.click()
  const terminal = page.getByRole('region', { name: 'OpenCode terminal' })
  await step(
    'OpenCode terminal is mounted',
    await visible(terminal),
    'OpenCode terminal region visible',
  )
  await shot('opencode-terminal-starting')
  await page.waitForTimeout(4_000)
  const rows = page.locator('.xterm-rows')
  const hasText = await rows
    .evaluate((element) => Boolean(element.textContent?.trim()))
    .catch(() => false)
  await step(
    'OpenCode TUI rendered text',
    hasText,
    await rows.innerText().catch(() => 'No xterm rows'),
  )
  const xterm = terminal.locator('.xterm')
  const carbonBackground = await xterm
    .locator('.xterm-viewport')
    .evaluate((element) => getComputedStyle(element).backgroundColor)
  await step(
    'OpenCode terminal inherits Carbon background',
    carbonBackground === 'rgb(9, 9, 11)',
    carbonBackground,
  )
  await page
    .locator('[data-theme]')
    .evaluate((element) => element.setAttribute('data-theme', 'graphite'))
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('.xterm-viewport')).backgroundColor ===
      'rgb(15, 17, 21)',
  )
  const graphiteBackground = await xterm
    .locator('.xterm-viewport')
    .evaluate((element) => getComputedStyle(element).backgroundColor)
  await step(
    'OpenCode terminal inherits theme changes while mounted',
    graphiteBackground === 'rgb(15, 17, 21)',
    graphiteBackground,
  )
  const spawned = [...opencodePids()].filter((pid) => !before.has(pid))
  await step(
    'dashboard spawned an opencode process',
    spawned.length > 0,
    `New OpenCode PIDs: ${spawned.join(', ') || '(none)'}`,
  )
  await shot('opencode-terminal')
  await page.setViewportSize({ width: 1180, height: 720 })
  await page.waitForTimeout(250)
  await step(
    'terminal remains visible after viewport resize',
    await visible(terminal),
    'Terminal region survived resize',
  )
  const closeButton = page.getByRole('button', { name: `Close tab ${title}`, exact: true })
  await step(
    'OpenCode tab has no duplicate terminal header or close button',
    (await terminal.getByText(title, { exact: true }).count()) === 0 &&
      (await terminal.getByRole('button', { name: 'Cerrar terminal', exact: true }).count()) === 0,
  )
  await step(
    'OpenCode tab close button is available',
    await visible(closeButton),
    'Close button belongs to the session tab',
  )
  await closeButton.click()
  await page.waitForTimeout(3_000)
  const survivors = spawned.filter(isProcessAlive)
  await step(
    'no spawned OpenCode process survives close',
    survivors.length === 0,
    survivors.length ? `Still alive: ${survivors.join(', ')}` : `Exited: ${spawned.join(', ')}`,
  )
}
