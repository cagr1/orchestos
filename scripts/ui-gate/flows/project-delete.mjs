import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

function dbCounts(projectId, databasePath) {
  const script = `
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)})
    const tables = db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()
      .filter(({ name }) => db.query("PRAGMA table_info('" + name + "')").all().some((column) => column.name === 'project_id'))
    const counts = Object.fromEntries(tables.map(({ name }) => [name, db.query("SELECT COUNT(*) AS count FROM '" + name + "' WHERE project_id = ?").get(${JSON.stringify(projectId)}).count]))
    const chats = db.query('SELECT COUNT(*) AS count FROM chat_sessions WHERE project_id = ?').get(${JSON.stringify(projectId)}).count
    const runs = db.query('SELECT COUNT(*) AS count FROM runs WHERE project_id = ?').get(${JSON.stringify(projectId)}).count
    const project = db.query('SELECT COUNT(*) AS count FROM projects WHERE id = ?').get(${JSON.stringify(projectId)}).count
    console.log(JSON.stringify({ counts, chats, runs, project }))
    db.close()
  `
  return JSON.parse(execFileSync('bun', ['-e', script], { encoding: 'utf8' }))
}

function seedRun(projectId, databasePath) {
  const script = `
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)})
    const now = new Date().toISOString()
    db.run('INSERT INTO runs (id, project_id, prompt, task_class, model, provider, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), ${JSON.stringify(projectId)}, 'UI.9.9 fixture run', 'gate', 'fixture', 'fixture', 'done', now])
    db.close()
  `
  execFileSync('bun', ['-e', script], { stdio: 'ignore' })
}

export default async function projectDelete({
  page,
  api,
  step,
  visible,
  hidden,
  cleanup,
  consoleErrors,
  databasePath,
}) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-9-9-'))
  writeFileSync(join(projectRoot, 'README.md'), '# UI.9.9\n')
  writeFileSync(join(projectRoot, '.gitignore'), '.orchestos/\n')
  run('git', ['init', '-q'], projectRoot)
  run('git', ['add', 'README.md', '.gitignore'], projectRoot)
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
  const project = (await api('/api/projects')).data.find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)

  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    if (existsSync(projectRoot)) rmSync(projectRoot, { recursive: true, force: true })
  })

  const session = await api('/api/chat/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: project.id,
      agent: 'api',
      mode: 'chat',
      title: 'UI.9.9 kept chat',
    }),
  })
  if (session.status !== 201) throw new Error(`chat seed failed: ${JSON.stringify(session)}`)
  seedRun(project.id, databasePath)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step('temporary project visible', await visible(projectButton), 'project row')
  const projectRow = projectButton.locator('..')
  await projectRow.hover()
  const actions = projectRow.getByRole('button', { name: 'Project actions', exact: true })
  await step('project actions visible on hover', await visible(actions), 'ellipsis action')
  await actions.click()
  await step(
    'menu has exactly settings and delete',
    (await page.getByRole('button', { name: 'Project settings', exact: true }).count()) === 1 &&
      (await page.getByRole('button', { name: 'Delete project', exact: true }).count()) === 1,
    'two project actions',
  )
  await page.getByRole('button', { name: 'Delete project', exact: true }).click()
  await page.getByRole('button', { name: 'Delete Project', exact: true }).click()
  await step('soft delete removes project from sidebar', await hidden(projectButton), 'row hidden')
  const softDeleted = dbCounts(project.id, databasePath)
  await step(
    'soft delete preserves chat and run rows',
    softDeleted.chats === 1 && softDeleted.runs === 1 && softDeleted.project === 1,
    JSON.stringify(softDeleted),
  )

  // The native picker is not automatable by Playwright. This calls the same
  // ensureProject path used by + Add project, then verifies the visible result.
  const readdScript = `
    const { ensureProject } = await import('./src/projects/ensure.ts')
    await ensureProject(${JSON.stringify(projectRoot)})
  `
  execFileSync('bun', ['-e', readdScript], { cwd: process.cwd(), stdio: 'ignore' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const restoredButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step(
    're-adding the same path restores the project row',
    await visible(restoredButton),
    'restored project',
  )
  const restoredSessions = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
  await step(
    'restored project keeps its chat',
    restoredSessions.data?.some((item) => item.title === 'UI.9.9 kept chat') === true,
    'chat survives soft delete and re-add',
  )

  const restoredRow = restoredButton.locator('..')
  await restoredRow.hover()
  await restoredRow.getByRole('button', { name: 'Project actions', exact: true }).click()
  await page.getByRole('button', { name: 'Project settings', exact: true }).click()
  await step(
    'project settings opens from project menu',
    await visible(page.getByRole('heading', { name: basename(projectRoot), exact: true })),
    'project settings heading',
  )
  await page
    .getByRole('button', { name: 'Borrar definitivamente los datos del proyecto', exact: true })
    .click()
  const purgeResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/projects/${project.id}/purge`) &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Yes, Purge Permanently', exact: true }).click()
  await purgeResponse
  await page.waitForTimeout(250)
  await step(
    'purge exits project settings',
    await hidden(page.getByRole('heading', { name: basename(projectRoot), exact: true })),
    'settings closed',
  )
  const purged = dbCounts(project.id, databasePath)
  const projectListAfterPurge = await api('/api/projects')
  await step(
    'purge removes project and every project-scoped row',
    purged.project === 0 &&
      purged.chats === 0 &&
      purged.runs === 0 &&
      Object.values(purged.counts).every((count) => count === 0) &&
      !(projectListAfterPurge.data ?? []).some((item) => item.id === project.id),
    JSON.stringify({ purged, projectList: projectListAfterPurge.data }),
  )
  await step('0 console errors', consoleErrors().length === 0, consoleErrors().join('; ') || 'none')
}
