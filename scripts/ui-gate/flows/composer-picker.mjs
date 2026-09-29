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
    rmSync(projectRoot, { recursive: true, force: true })
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
  const openCodeOption = dialog.getByRole('button', { name: /OpenCode/i }).first()
  const openCodeAvailable = await visible(openCodeOption, 15_000)
  const executorModes = await api('/api/system/executor-modes')
  await step(
    'OpenCode available for new chat',
    openCodeAvailable,
    JSON.stringify({
      project: basename(projectRoot),
      modes: (executorModes.data?.modes ?? []).map(({ id, detected }) => ({ id, detected })),
      dialog: await dialog.innerText().catch(() => ''),
    }),
  )
  if (!(await openCodeOption.isVisible())) return
  await openCodeOption.click()
  await shot('opencode-selected-for-new-chat')
  await dialog.getByRole('button', { name: 'Start Chat', exact: true }).click()
  await shot('opencode-composer')

  const catalogsResponse = await api('/api/chat/cli-models')
  const catalogs = catalogsResponse.data
  const opencode = catalogs?.find((catalog) => catalog.id === 'opencode')
  const codex = catalogs?.find((catalog) => catalog.id === 'codex')
  const variantModel = opencode?.models.find((model) => model.efforts?.length)
  const plainModel = opencode?.models.find((model) => !model.efforts?.length)
  if (!variantModel || !plainModel || !codex?.models.some((model) => model.efforts?.length))
    throw new Error(
      'CLI model catalog must provide OpenCode variant/plain models and Codex efforts',
    )

  const modelControl = page.locator('button[title="Select model and reasoning effort"]').last()
  await modelControl.click()
  const selector = page.getByRole('dialog', { name: 'Model and effort selector' })
  const search = selector.getByLabel('Search models')
  const openCodeModelButtons = selector.locator('.overflow-y-auto').getByRole('button')
  const prefixedOpenCodeModels = (await openCodeModelButtons.allInnerTexts()).filter((text) =>
    text.trim().startsWith('opencode/'),
  )
  await step(
    'OpenCode model labels omit the opencode/ prefix',
    prefixedOpenCodeModels.length === 0,
    JSON.stringify(prefixedOpenCodeModels),
  )
  await step(
    'composer model search receives focus',
    await search.evaluate((el) => el === document.activeElement),
  )
  const modelList = selector.locator('.overflow-y-auto')
  const listMetrics = await selector.evaluate((menu) => ({
    height: menu.getBoundingClientRect().height,
    viewport: window.innerHeight,
    scrolls:
      Boolean(menu.querySelector('.overflow-y-auto')) &&
      menu.querySelector('.overflow-y-auto').scrollHeight >
        menu.querySelector('.overflow-y-auto').clientHeight,
  }))
  await step(
    'composer model menu is under 60 percent of viewport and scrolls',
    listMetrics.height < listMetrics.viewport * 0.6 && listMetrics.scrolls,
    JSON.stringify(listMetrics),
  )
  const initialCount = await modelList.getByRole('button').count()
  await search.fill(variantModel.id)
  await step(
    'composer search filters and retains matching model',
    (await modelList.getByRole('button').count()) < initialCount &&
      (await modelList.getByRole('button', { name: variantModel.name, exact: true }).count()) === 1,
    variantModel.id,
  )
  await search.fill('no-model-can-match')
  await step(
    'composer search shows empty state',
    await selector.getByText('No models match').isVisible(),
  )
  await search.fill(variantModel.id)
  await modelList.getByRole('button', { name: variantModel.name, exact: true }).click()
  await step(
    'composer label omits the OpenCode provider prefix',
    !(await modelControl.innerText()).trim().startsWith('opencode/'),
    await modelControl.innerText(),
  )
  await modelControl.click()
  const effortButtons = selector.getByRole('button').filter({ hasText: /^\w+$/ })
  const visibleEfforts = await effortButtons.allInnerTexts()
  const normalizedEfforts = visibleEfforts.map((effort) => effort.trim().toLowerCase())
  await step(
    'OpenCode variant model shows exactly its catalog effort levels',
    JSON.stringify([...normalizedEfforts].sort()) ===
      JSON.stringify(variantModel.efforts.map((effort) => effort.toLowerCase()).sort()),
    JSON.stringify({
      model: variantModel.id,
      expected: variantModel.efforts,
      actual: visibleEfforts,
    }),
  )
  const menuBox = await selector.boundingBox()
  const searchBox = await search.boundingBox()
  const effortSection = selector.getByText('Effort', { exact: true }).locator('../..')
  const effortBox = await effortSection.boundingBox()
  const insideMenuWithHorizontalInset = (box) =>
    Boolean(
      menuBox &&
        box &&
        box.x >= menuBox.x + 4 &&
        box.x + box.width <= menuBox.x + menuBox.width - 4 &&
        box.y >= menuBox.y &&
        box.y + box.height <= menuBox.y + menuBox.height,
    )
  await step(
    'composer search and effort section fit inside menu with horizontal inset',
    insideMenuWithHorizontalInset(searchBox) &&
      insideMenuWithHorizontalInset(effortBox) &&
      (await effortSection.isVisible()),
    JSON.stringify({ menuBox, searchBox, effortBox }),
  )
  await shot('opencode-variant-efforts')

  await search.fill(plainModel.id)
  await modelList.getByRole('button', { name: plainModel.name, exact: true }).click()
  await modelControl.click()
  await step(
    'OpenCode model without variants hides effort levels',
    !(await selector.getByText(/^Effort$/).count()),
  )
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const codexDialog = page.getByRole('dialog')
  const codexOption = codexDialog.getByRole('button', { name: /Codex/ }).first()
  await step('Codex available for new chat', await visible(codexOption))
  if (!(await codexOption.isVisible())) return
  await codexOption.click()
  await codexDialog.getByRole('button', { name: 'Start Chat', exact: true }).click()
  const codexControl = page.locator('button[title="Select model and reasoning effort"]').last()
  await codexControl.click()
  const codexModel = codex.models.find((model) => model.efforts?.length)
  const codexSearch = selector.getByLabel('Search models')
  await step('Codex model selector has no search input', (await codexSearch.count()) === 0)
  const codexModelList = selector.locator('.overflow-y-auto')
  await codexModelList.getByRole('button', { name: codexModel.name, exact: true }).click()
  await codexControl.click()
  const codexEffortsVisible = await Promise.all(
    codexModel.efforts.map((effort) =>
      selector.getByRole('button', { name: new RegExp(`^${effort}$`, 'i') }).isVisible(),
    ),
  )
  await step(
    'Codex effort levels remain available',
    codexEffortsVisible.every(Boolean),
    JSON.stringify({ model: codexModel.id, efforts: codexModel.efforts }),
  )
  await shot('codex-efforts-preserved')
}
