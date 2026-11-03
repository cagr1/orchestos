import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run, writeGateRoles } from '../lib.mjs'

export default async function composerPicker({ page, api, step, shot, visible, cleanup, runDir }) {
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
  const network = []
  const responseBodies = new Set()
  let clickedAt
  const chatOrConfig = (url) => /^\/api\/(chat|config)/.test(new URL(url).pathname)
  const requestInfo = (request) => ({
    method: request.method(),
    path: new URL(request.url()).pathname + new URL(request.url()).search,
    at: Date.now(),
  })
  const observeRequest = (request) => {
    if (!chatOrConfig(request.url())) return
    network.push({
      type: 'request',
      ...requestInfo(request),
      status: null,
      body: (request.postData() ?? '').slice(0, 300),
    })
  }
  const observeResponse = (response) => {
    if (!chatOrConfig(response.url())) return
    const entry = {
      type: 'response',
      ...requestInfo(response.request()),
      status: response.status(),
      body: null,
    }
    network.push(entry)
    const pending = response
      .text()
      .then((body) => {
        entry.body = body.slice(0, 300)
      })
      .catch((error) => {
        entry.body = String(error).slice(0, 300)
      })
      .finally(() => responseBodies.delete(pending))
    responseBodies.add(pending)
  }
  page.on('request', observeRequest)
  page.on('response', observeResponse)
  cleanup(() => {
    page.off('request', observeRequest)
    page.off('response', observeResponse)
  })
  const sessionSnapshots = []
  let sessionId
  const snapshotSession = async (phase) => {
    const at = Date.now()
    try {
      const response = await api('/api/chat/sessions', {
        headers: { 'x-orchestos-project-id': projectId },
      })
      const session = (response.data ?? []).find((item) =>
        sessionId ? item.id === sessionId : item.agent === 'codex',
      )
      sessionId ??= session?.id
      sessionSnapshots.push({ phase, at, status: response.status, session: session ?? null })
    } catch (error) {
      sessionSnapshots.push({ phase, at, error: String(error) })
    }
  }
  await snapshotSession('before-click')
  const modelButton = codexModelList.getByRole('button', { name: codexModel.name, exact: true })
  const modelButtonState = {
    visible: await modelButton.isVisible(),
    enabled: await modelButton.isEnabled(),
  }
  clickedAt = Date.now()
  await modelButton.click()
  await snapshotSession('after-click')
  await codexControl.click()
  await snapshotSession('reopened')
  const codexEffortSection = selector.getByText('Effort', { exact: true }).locator('xpath=..')
  const codexEffortsVisible = await Promise.all(
    codexModel.efforts.map((effort) =>
      codexEffortSection.getByRole('button', { name: new RegExp(`^${effort}$`, 'i') }).isVisible(),
    ),
  )
  let effortDetail = JSON.stringify({ model: codexModel.id, efforts: codexModel.efforts })
  if (!codexEffortsVisible.every(Boolean)) {
    const modelButtons = await codexModelList.getByRole('button').evaluateAll((buttons) =>
      buttons.map((button) => ({
        name: button.textContent,
        model: button.title,
        ariaChecked: button.getAttribute('aria-checked'),
        checkVisible: [...button.querySelectorAll('svg.lucide-check')].some(
          (check) => check.getClientRects().length > 0,
        ),
      })),
    )
    const visibleEfforts = await codexEffortSection
      .getByRole('button')
      .evaluateAll((buttons) =>
        buttons
          .filter((button) => button.getClientRects().length > 0)
          .map((button) => button.textContent),
      )
    page.off('request', observeRequest)
    page.off('response', observeResponse)
    await Promise.allSettled([...responseBodies])
    const diagnosticPath = join(runDir, 'composer-picker-model-missing.json')
    const screenshot = join(runDir, 'composer-picker-model-missing.png')
    const diagnostics = {
      expectedModel: codexModel,
      clickedAt,
      modelButtonState,
      sessionSnapshots: sessionSnapshots.map(({ at, ...snapshot }) => ({
        ...snapshot,
        ms: at - clickedAt,
      })),
      modelButtons,
      visibleEfforts,
      codexEffortsVisible,
      network: network.map(({ at, ...entry }) => ({ ...entry, ms: at - clickedAt })),
      screenshot,
    }
    try {
      await page.screenshot({ path: screenshot })
    } catch (error) {
      diagnostics.screenshotError = String(error)
    }
    writeFileSync(diagnosticPath, JSON.stringify(diagnostics, null, 2))
    effortDetail = JSON.stringify({
      diagnosticPath,
      screenshot,
      modelButtonState,
      expectedModel: codexModel.id,
      visibleEfforts,
      markedModels: modelButtons.filter(
        (button) => button.ariaChecked === 'true' || button.checkVisible,
      ),
      sessionModels: diagnostics.sessionSnapshots.map(({ session, ...snapshot }) => ({
        ...snapshot,
        id: session?.id ?? null,
        model: session?.lastModel ?? null,
      })),
      networkSummary: JSON.stringify(diagnostics.network).slice(0, 600),
    })
  }
  page.off('request', observeRequest)
  page.off('response', observeResponse)
  await step(
    'Codex effort levels remain available',
    codexEffortsVisible.every(Boolean),
    effortDetail,
  )
  await shot('codex-efforts-preserved')
  await page.keyboard.press('Escape')
  const composer = page.locator('textarea').last()
  await composer.fill('@READ')
  const files = page.getByRole('listbox', { name: 'Project files' })
  await step(
    'project file matches @ query',
    await visible(files.getByRole('option', { name: 'README.md', exact: true })),
  )
  await composer.press('Enter')
  await step('Enter inserts plain file reference', (await composer.inputValue()) === '@README.md ')
  await composer.fill('Read @READ')
  await visible(files.getByRole('option', { name: 'README.md', exact: true }))
  await composer.press('Tab')
  await step(
    'Tab replaces reference after a space',
    (await composer.inputValue()) === 'Read @README.md ',
  )
  await composer.fill('@')
  await visible(files.getByRole('option', { name: 'README.md', exact: true }))
  await composer.press('ArrowDown')
  const selectedPath = await files.getByRole('option', { selected: true }).innerText()
  await composer.press('Enter')
  await step(
    'arrow navigation chooses the highlighted file',
    (await composer.inputValue()) === `@${selectedPath} `,
  )
  await composer.fill('@READ')
  await visible(files)
  await composer.press('Escape')
  await step('Escape closes file references', (await files.count()) === 0)
  await composer.fill('a@b')
  await step('email does not open file references', (await files.count()) === 0)
  await composer.fill('')
}
