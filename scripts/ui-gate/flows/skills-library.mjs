import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { run, writeGateRoles } from '../lib.mjs'

export default async function skillsLibrary({
  page,
  api,
  step,
  shot,
  note,
  visible,
  cleanup,
  restartDashboard,
  databasePath,
}) {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-skills-library-'))
  const libraryDir = join(dirname(databasePath), 'skills')
  const libraryFile = join(libraryDir, 'gate-library-skill.yaml')
  const liveFile = join(libraryDir, 'karpathy-guidelines.yaml')
  const fixture = createServer((_req, response) => {
    response.writeHead(200, { 'Content-Type': 'text/markdown' })
    response.end(
      '---\nname: Gate Library Skill\ndescription: Use when verifying skill activation.\n---\n# Fixture instructions\nRead [guide](references/guide.md).\n',
    )
  })
  await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve))
  const fixtureUrl = `http://127.0.0.1:${fixture.address().port}/SKILL.md`
  process.env.ORCHESTOS_GATE_SKILL_FIXTURE = fixtureUrl
  let project
  cleanup(async () => {
    if (project)
      await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    for (const path of [
      libraryFile,
      ...(process.env.ORCHESTOS_SKILLS_LIVE_IMPORT === '1' ? [liveFile] : []),
    ])
      if (existsSync(path)) rmSync(path)
    rmSync(root, { recursive: true, force: true })
    delete process.env.ORCHESTOS_GATE_SKILL_FIXTURE
    await new Promise((resolve, reject) =>
      fixture.close((error) => (error ? reject(error) : resolve())),
    )
    if (project) {
      const projects = (await api('/api/projects')).data ?? []
      if (projects.some((item) => item.id === project.id)) throw new Error('project cleanup failed')
    }
    if (existsSync(libraryFile) || existsSync(root))
      throw new Error('skills fixture cleanup failed')
  })
  await restartDashboard()
  writeFileSync(join(root, 'README.md'), '# Skills library gate\n')
  run('git', ['init', '-q'], root)
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
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', root], process.cwd())
  writeGateRoles(root)
  project = ((await api('/api/projects')).data ?? []).find((item) => item.path === root)
  if (!project) throw new Error('fixture project was not registered')
  const headers = { 'x-orchestos-project-id': project.id }
  const openSkills = async () => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await page.getByRole('button', { name: basename(root), exact: true }).click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: 'Skills', exact: true }).click()
  }
  await openSkills()
  await page.getByRole('button', { name: 'Add skill', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add skill', exact: true })
  await step('Add skill dialog visible', await visible(dialog))
  await dialog.getByRole('textbox').fill(fixtureUrl)
  await shot('skills-library-dialog')
  const importResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/skills/library') && response.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  const imported = await (await importResponse).json()
  await step(
    'library endpoint imports SKILL.md and reports omitted link',
    imported.ok && imported.warnings?.some((warning) => warning.includes('references/guide.md')),
    JSON.stringify(imported),
  )
  const row = page.locator('[data-skill-row]').filter({ hasText: 'ID: gate-library-skill' })
  await step('Library origin appears', await visible(row.getByText('Library', { exact: true })))
  const toggle = row.getByRole('switch')
  await step('library skill is initially off', !(await toggle.isChecked()))
  const rows = (await api('/api/skills', { headers })).data ?? []
  await step(
    'API reports library disabled',
    rows.some(
      (skill) =>
        skill.id === 'gate-library-skill' &&
        skill.origin === 'user-library' &&
        skill.enabled === false,
    ),
  )
  const enabledResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/skills/gate-library-skill/enabled') &&
      response.request().method() === 'PUT',
  )
  await toggle.check()
  const enabled = await (await enabledResponse).json()
  await step('toggle endpoint succeeds', enabled.ok && enabled.enabled === true)
  const statePath = join(root, '.orchestos', 'skills.json')
  await step(
    'activation persisted on disk',
    JSON.parse(readFileSync(statePath, 'utf8')).enabled.includes('gate-library-skill'),
  )
  await openSkills()
  await step('activation survives reload', await row.getByRole('switch').isChecked())
  await row.scrollIntoViewIfNeeded()
  await shot('skills-library-list')
  await row.getByRole('switch').uncheck()
  await page.waitForFunction(async (id) => {
    const response = await fetch('/api/skills', { headers: { 'x-orchestos-project-id': id } })
    return (await response.json()).some(
      (skill) => skill.id === 'gate-library-skill' && skill.enabled === false,
    )
  }, project.id)
  await step(
    'deactivation persisted',
    !JSON.parse(readFileSync(statePath, 'utf8')).enabled.includes('gate-library-skill'),
  )

  if (process.env.ORCHESTOS_SKILLS_LIVE_IMPORT === '1') {
    await page.getByRole('button', { name: 'Add skill', exact: true }).click()
    await dialog
      .getByRole('textbox')
      .fill(
        'https://github.com/multica-ai/andrej-karpathy-skills/tree/main/skills/karpathy-guidelines',
      )
    const liveResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/skills/library') && response.request().method() === 'POST',
    )
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    const live = await (await liveResponse).json()
    await step('live GitHub import succeeds', live.ok === true, JSON.stringify(live))
    if (live.ok) {
      const yaml = readFileSync(liveFile, 'utf8')
      note('karpathy-guidelines resulting YAML', yaml)
      await step(
        'live library row visible',
        await visible(
          page
            .locator('[data-skill-row]')
            .filter({ hasText: 'ID: karpathy-guidelines' })
            .getByText('Library', { exact: true }),
        ),
      )
      await page
        .locator('[data-skill-row]')
        .filter({ hasText: 'ID: karpathy-guidelines' })
        .scrollIntoViewIfNeeded()
      await shot('skills-library-live')
    }
  }
}
