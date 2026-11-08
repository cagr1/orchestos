import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run } from '../lib.mjs'

export default async function projectSettings({
  page,
  api,
  step,
  shot,
  cleanup,
  consoleErrors,
  expectHttpError,
  note,
}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'orchestos-ui-project-settings-')))
  let project
  cleanup(async () => {
    if (project) {
      const removed = await api(`/api/projects/${project.id}/purge`, { method: 'POST' })
      if (!removed.ok || (await api('/api/projects')).data.some((row) => row.id === project.id))
        throw new Error('project settings fixture was not purged')
    }
    rmSync(root, { recursive: true, force: true })
  })
  writeFileSync(join(root, 'README.md'), '# Project settings gate\n')
  run('git', ['init', '-b', 'main'], root)
  run('git', ['add', 'README.md'], root)
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
  run('git', ['branch', 'develop'], root)
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', root], process.cwd())
  project = (await api('/api/projects')).data.find((row) => row.path === root)
  if (!project) throw new Error('temporary project not registered')
  const original = basename(root)
  const renamed = `${original}-renamed`
  const open = async (name) => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await page.getByRole('button', { name, exact: true }).click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page
      .locator('[data-project-tab]')
      .filter({ hasText: /^General$/ })
      .click()
    await page.locator('[data-project-general]').waitFor()
  }
  const patch = async (action) => {
    const response = page.waitForResponse(
      (res) =>
        res.url().endsWith(`/api/projects/${project.id}`) && res.request().method() === 'PATCH',
    )
    await action()
    return await (await response).json()
  }
  const name = page.getByRole('textbox', { name: 'Name', exact: true })
  const branch = page.getByRole('combobox', { name: 'Base branch', exact: true })
  const script = page.getByRole('textbox', { name: 'Setup script', exact: true })
  await open(original)
  await name.fill(renamed)
  await patch(() => name.blur())
  await patch(() => page.getByRole('button', { name: 'Rocket', exact: true }).click())
  await patch(() => branch.selectOption('develop'))
  await script.fill('echo ok > .setup-ran')
  await patch(() => script.blur())
  await page.getByRole('button', { name: 'Back to app', exact: true }).click()
  const sidebar = page.getByRole('button', { name: renamed, exact: true })
  await step(
    'sidebar name and icon update without reload',
    (await sidebar.isVisible()) &&
      (await sidebar.locator('[data-project-icon="Rocket"]').count()) === 1,
  )
  await open(renamed)
  await step(
    'project fields persist after reload',
    (await name.inputValue()) === renamed &&
      (await branch.inputValue()) === 'develop' &&
      (await script.inputValue()) === 'echo ok > .setup-ran' &&
      (await page
        .getByRole('button', { name: 'Rocket', exact: true })
        .getAttribute('aria-pressed')) === 'true',
  )
  await shot('project-general')
  // Execution, cleanup and error propagation are integration-tested without a live model.
  note(
    'worktree execution coverage',
    'projects-settings.test.ts + sandbox-setup.test.ts: configured base, setup success/failure, cleanup and merge checkout preservation',
  )
  expectHttpError(new RegExp(`/api/projects/${project.id}$`))
  await name.fill('x'.repeat(81))
  const bad = await patch(() => name.blur())
  await page.getByRole('alert').filter({ hasText: '80 characters' }).waitFor()
  await step(
    'validation error is inline and previous value persists',
    Boolean(bad.error) &&
      (await api('/api/projects')).data.find((row) => row.id === project.id).displayName ===
        renamed,
  )
  await name.fill('')
  await patch(() => name.blur())
  await patch(() => branch.selectOption(''))
  await script.fill('')
  await patch(() => script.blur())
  await patch(() => page.getByRole('button', { name: 'FolderClosed', exact: true }).click())
  await page.getByRole('button', { name: 'Back to app', exact: true }).click()
  await step(
    'clearing name restores basename in sidebar',
    await page.getByRole('button', { name: original, exact: true }).isVisible(),
  )
  await open(original)
  await step(
    'cleared settings persist as null',
    (await api('/api/projects')).data.some(
      (row) =>
        row.id === project.id &&
        row.displayName === null &&
        row.icon === null &&
        row.baseBranch === null &&
        row.setupScript === null,
    ) &&
      (await name.inputValue()) === '' &&
      (await branch.inputValue()) === '' &&
      (await script.inputValue()) === '',
  )
  await step(
    'dashboard has no pageerrors',
    consoleErrors().length === 0,
    consoleErrors().join('; '),
  )
}
