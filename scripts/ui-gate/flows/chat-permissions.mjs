import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { writeGateRoles } from '../lib.mjs'

const IDENT = ['-c', 'user.name=ui-gate', '-c', 'user.email=ui-gate@example.invalid']

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

async function tasksFor(api, projectId) {
  const response = await api('/api/tasks', { headers: { 'x-orchestos-project-id': projectId } })
  return Array.isArray(response.data?.tasks) ? response.data.tasks : []
}

export default async function chatPermissions({ page, api, step, shot, visible, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-8-6-'))
  writeFileSync(join(projectRoot, 'README.md'), '# UI.8.6\n')
  writeFileSync(join(projectRoot, '.gitignore'), '.orchestos/\nnode_modules/\n')
  run('git', ['init', '-q'], projectRoot)
  run('git', ['add', '-A'], projectRoot)
  run('git', [...IDENT, 'commit', '-qm', 'fixture'], projectRoot)
  const repoRoot = process.cwd()
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'init', projectRoot], repoRoot)
  writeGateRoles(projectRoot)
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'task', 'init'], projectRoot)
  run('git', ['add', '-A'], projectRoot)
  run('git', [...IDENT, 'commit', '-qm', 'task scaffold'], projectRoot)

  const projectList = await api('/api/projects')
  const project = (Array.isArray(projectList.data) ? projectList.data : []).find(
    (item) => item.path === projectRoot,
  )
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  if (await visible(projectButton)) await projectButton.click()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const codex = dialog.getByRole('button', { name: /Codex/ }).first()
  await step('select Codex for new chat', await visible(codex), 'Codex option visible')
  if (!(await codex.isVisible())) return
  await codex.click()
  await page.getByRole('button', { name: 'Start Chat', exact: true }).click()

  // 1 — Yolo por defecto
  const strip = page.locator('[data-permissions-strip]')
  const yoloText = (await visible(strip, 30_000)) ? ((await strip.innerText()) ?? '') : ''
  await step(
    'strip visible in yolo with Auto-run',
    (await strip.getAttribute('data-permission-mode')) === 'yolo' && /Auto-run/.test(yoloText),
    yoloText,
  )
  await shot('1-yolo')

  // 2 — Settings → Manual
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Model routing', exact: true }).click()
  const manual = page
    .locator('[data-permission-mode-control]')
    .getByRole('radio', { name: 'Manual', exact: true })
  await step('Manual control visible in Settings', await visible(manual), 'control rendered')
  if (!(await manual.isVisible())) return
  const [saved] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith('/api/config') && res.request().method() === 'PUT',
    ),
    manual.click(),
  ])
  await step('PUT /api/config accepted permissionMode', saved.ok(), `HTTP ${saved.status()}`)
  const yaml = readFileSync(join(projectRoot, 'orchestos.config.yaml'), 'utf8')
  await step(
    'project YAML has permissionMode: manual',
    /^permissionMode: manual$/m.test(yaml),
    yaml.split('\n').find((line) => line.includes('permissionMode')) ?? 'missing',
  )
  await page.getByRole('button', { name: /Back to app/ }).click()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  const manualText = (await visible(strip, 30_000)) ? ((await strip.innerText()) ?? '') : ''
  await step(
    'strip shows manual with Manual approval',
    (await strip.getAttribute('data-permission-mode')) === 'manual' &&
      /Manual approval/.test(manualText),
    manualText,
  )
  await shot('2-manual')

  // 3 — la tarea se retiene aunque el archivo no exista
  const beforeIds = new Set((await tasksFor(api, project.id)).map((task) => task.id))
  const composer = page.locator('textarea').last()
  await composer.fill(
    'Crea un archivo nuevo llamado gate-permisos.txt con el texto "ok". La única ruta de salida es gate-permisos.txt.',
  )
  await composer.press('Enter')
  const card = page.locator('[data-task-state="held"]').first()
  const held = await visible(card, 180_000)
  await step('held task card visible in Manual', held, 'held task rendered')
  await shot('3-held')
  if (!held) return
  await delay(5_000)
  const task = (await tasksFor(api, project.id)).find((item) => !beforeIds.has(item.id))
  await step(
    'task stays pending without a run after 5s',
    task?.status === 'pending' && !task.retryReason,
    `status=${task?.status ?? 'missing'}`,
  )
  if (!task) return

  // 4 — Approve & Run libera
  await page.getByRole('button', { name: /^Approve & Run$/i }).click()
  const deadline = Date.now() + 60_000
  let after = task
  while (Date.now() < deadline) {
    after = (await tasksFor(api, project.id)).find((item) => item.id === task.id)
    if (after && (after.status !== 'pending' || after.retryReason)) break
    await delay(1_000)
  }
  await step(
    'Approve & Run releases the task from held',
    Boolean(after) && (after.status !== 'pending' || Boolean(after.retryReason)),
    `status=${after?.status ?? 'missing'}`,
  )
}
