import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

function makeProject(name, plan) {
  const root = mkdtempSync(join(tmpdir(), `orchestos-ui-10-a-${name}-`))
  writeFileSync(join(root, 'README.md'), `# ${name}\n`)
  if (plan !== null) writeFileSync(join(root, 'PLAN.md'), plan)
  run('git', ['init', '-q'], root)
  run('git', ['add', '-A'], root)
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
    root,
  )
  const repoRoot = process.cwd()
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'init', root], repoRoot)
  return root
}

export default async function planDoc({ page, api, step, visible, cleanup, consoleErrors }) {
  const registerRepo = `
    const { ensureProject } = await import(${JSON.stringify(join(process.cwd(), 'src/projects/ensure.ts'))})
    await ensureProject(${JSON.stringify(process.cwd())})
  `
  run('bun', ['-e', registerRepo], process.cwd())
  const checklistRoot = makeProject(
    'UI.10.A checklist',
    '# SalaDespecho\n\n## Fase 1\nPreparación del proyecto.\n- [ ] Auditar login\n- [x] Migrar DB\n  - [ ] Verificar índices\n',
  )
  const emptyRoot = makeProject('UI.10.A empty', null)
  const projects = await api('/api/projects')
  const checklist = (projects.data ?? []).find((item) => item.path === checklistRoot)
  const empty = (projects.data ?? []).find((item) => item.path === emptyRoot)
  if (!checklist || !empty) throw new Error('temporary projects were not registered')

  cleanup(async () => {
    for (const project of [checklist, empty]) {
      await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    }
    for (const root of [checklistRoot, emptyRoot]) {
      if (existsSync(root)) rmSync(root, { recursive: true, force: true })
      if (existsSync(root)) throw new Error(`temporary project remains: ${root}`)
    }
  })

  await page.reload({ waitUntil: 'domcontentloaded' })

  const openProjectPlan = async (root) => {
    const backToApp = page.getByRole('button', { name: 'Back to app', exact: true })
    if (await backToApp.isVisible().catch(() => false)) await backToApp.click()
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    const projectButton = page.getByRole('button', { name: basename(root), exact: true })
    await step(
      `${basename(root)} visible`,
      await visible(projectButton),
      'project visible in sidebar',
    )
    await projectButton.click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await step(
      `${basename(root)} settings visible`,
      await visible(page.getByRole('heading', { name: basename(root), exact: true })),
      'project settings heading',
    )
    await page.getByRole('button', { name: 'Plan', exact: true }).click()
    await page.getByRole('button', { name: 'PLAN.md', exact: true }).click()
  }

  await openProjectPlan(checklistRoot)
  await step(
    'PLAN.md section visible',
    await visible(page.getByRole('heading', { name: 'Fase 1', exact: true })),
    'parsed section',
  )
  await step(
    'three checklist items visible',
    (await page.locator('input[type="checkbox"]').count()) === 3,
    'three read-only checkboxes',
  )
  await step(
    'completed item checked',
    await page.getByText('Migrar DB', { exact: true }).locator('..').locator('input').isChecked(),
    'Migrar DB is checked',
  )
  await step(
    'checkboxes disabled',
    await page
      .locator('input[type="checkbox"]')
      .evaluateAll((inputs) => inputs.every((input) => input.disabled)),
    'PLAN.md is read-only',
  )
  await step(
    'nested item visible',
    await visible(page.getByText('Verificar índices', { exact: true })),
    'indented checklist item',
  )
  await page.getByRole('button', { name: 'Kanban', exact: true }).click()
  await step(
    'Kanban still works',
    await visible(page.getByText('tasks declared in tasks.yaml', { exact: false })),
    'board restored',
  )

  await openProjectPlan(emptyRoot)
  await step(
    'missing PLAN.md state',
    await visible(page.getByText('No PLAN.md in this project', { exact: true })),
    'empty state',
  )

  const repoProject = (projects.data ?? []).find((item) => item.path === process.cwd())
  if (!repoProject) throw new Error('repository project was not registered')
  await openProjectPlan(process.cwd())
  await step(
    'repository PLAN.md item visible',
    await visible(page.getByText('UI.10.A', { exact: false })),
    'real repository plan item',
  )
  await step('no browser console errors', consoleErrors().length === 0, consoleErrors().join('; '))
}
