import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { writeGateRoles } from '../lib.mjs'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

export default async function composerPicker({ page, api, step, shot, visible, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-21-'))
  let projectId
  cleanup(async () => {
    if (projectId)
      await api(`/api/projects/${encodeURIComponent(projectId)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })
  writeFileSync(join(projectRoot, 'README.md'), '# UI.21 composer picker\n')
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
  const repoRoot = process.cwd()
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'init', projectRoot], repoRoot)
  writeGateRoles(projectRoot)
  const projectsResponse = await api('/api/projects')
  const project = (projectsResponse.data ?? []).find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  projectId = project.id

  await page.reload({ waitUntil: 'domcontentloaded' })
  await shot('project-registered')
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await shot('dev-mode')
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step('temporary project visible in Dev', await visible(projectButton, 15_000))
  if (!(await projectButton.isVisible())) return
  await projectButton.click()
  await shot('temporary-project-selected')

  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await shot('chat-mode')
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await shot('new-chat-agent-selector')
  const openCodeOptions = dialog.getByRole('button', { name: /OpenCode/i })
  await step('OpenCode not offered for new chat', (await openCodeOptions.count()) === 0)
  await dialog.getByRole('button', { name: 'Close modal', exact: true }).click()

  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const codexDialog = page.getByRole('dialog')
  const codexOption = codexDialog.getByRole('button', { name: /Codex/ }).first()
  await step('Codex available for new chat', await visible(codexOption))
  if (!(await codexOption.isVisible())) return
  await codexOption.click()
  await codexDialog.getByRole('button', { name: 'Start Chat', exact: true }).click()
  const catalogs = (await api('/api/chat/cli-models')).data
  const codex = catalogs?.find((catalog) => catalog.id === 'codex')
  const codexModel = codex?.models.find((model) => model.efforts?.length)
  if (!codexModel) throw new Error('Codex catalog must provide a model with effort levels')
  const codexControl = page.locator('button[title="Select model and reasoning effort"]').last()
  await codexControl.click()
  const selector = page.getByRole('dialog', { name: 'Model and effort selector' })
  const codexSearch = selector.getByLabel('Search models')
  await step('Codex model selector has no search input', (await codexSearch.count()) === 0)
  const codexModelList = selector.locator('.overflow-y-auto')
  await codexModelList.getByRole('button', { name: codexModel.name, exact: true }).click()
  await codexControl.click()
  const codexEffortSection = selector.getByText('Effort', { exact: true }).locator('xpath=..')
  const codexEffortsVisible = await Promise.all(
    codexModel.efforts.map((effort) =>
      codexEffortSection.getByRole('button', { name: new RegExp(`^${effort}$`, 'i') }).isVisible(),
    ),
  )
  await step(
    'Codex effort levels remain available',
    codexEffortsVisible.every(Boolean),
    JSON.stringify({ model: codexModel.id, efforts: codexModel.efforts }),
  )
  await shot('codex-efforts-preserved')
}
