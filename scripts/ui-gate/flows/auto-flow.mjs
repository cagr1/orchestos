import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { writeGateRoles } from '../lib.mjs'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

function runJson(source) {
  return JSON.parse(execFileSync('bun', ['-e', source], { encoding: 'utf8' }))
}

function projectHeaders(projectId) {
  return { 'x-orchestos-project-id': projectId }
}

async function tasksFor(api, projectId) {
  const response = await api('/api/tasks', { headers: projectHeaders(projectId) })
  return Array.isArray(response.data?.tasks) ? response.data.tasks : []
}

async function waitForTaskFinished(api, projectId, taskId, initialTask) {
  const deadline = Date.now() + 10 * 60_000
  let task
  while (Date.now() <= deadline) {
    task = (await tasksFor(api, projectId)).find((item) => item.id === taskId)
    if (
      task &&
      ((task.status !== 'pending' && task.status !== 'running') ||
        (task.status === 'pending' &&
          (task.retryCount !== initialTask.retryCount || task.runId !== initialTask.runId)))
    )
      return task
    await delay(2_000)
  }
  return task
}

async function sendMessage({ page, composer, text, step, shot }) {
  const previousReplyCount = await page.locator('div.prose').count()
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/chat',
    { timeout: 180_000 },
  )
  await composer.fill(text)
  await composer.press('Enter')
  let response
  try {
    response = await responsePromise
  } catch {
    await shot('send-timeout')
    await step(
      'chat request sent',
      false,
      await composer.inputValue().catch(() => 'composer text unavailable'),
    )
    return null
  }
  if (!response.ok())
    throw new Error(
      `/api/chat returned HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`,
    )
  const reply = page.locator('div.prose').nth(previousReplyCount)
  await reply.waitFor({ state: 'visible', timeout: 180_000 })
  await step(
    `chat response: ${text.slice(0, 45)}`,
    Boolean((await reply.innerText()).trim()),
    'assistant reply visible',
  )
  return reply
}

async function startChat(page, agentName, step, visible) {
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const agent = dialog.getByRole('button', { name: new RegExp(agentName, 'i') }).first()
  await step(`select ${agentName} for new chat`, await visible(agent), 'agent option visible')
  if (!(await agent.isVisible())) return false
  await agent.click()
  await dialog.getByRole('button', { name: 'Start Chat', exact: true }).click()

  const modelControl = page.locator('button[title="Select model and reasoning effort"]')
  await step(
    'model and effort controls visible',
    await visible(modelControl),
    'composer controls visible',
  )
  if (!(await modelControl.isVisible())) return false
  await modelControl.click()
  const model = page.getByRole('button', { name: /gpt-6-luna/i }).first()
  await step('select gpt-6-luna', await visible(model), 'model option visible')
  if (!(await model.isVisible())) return false
  await model.click()
  await modelControl.click()
  const medium = page.getByRole('button', { name: /^medium$/i }).first()
  await step('select medium effort', await visible(medium), 'effort option visible')
  if (!(await medium.isVisible())) return false
  await medium.click()

  const effortLabel = page.getByText(/^Effort$/i).first()
  await page.keyboard.press('Escape')
  if (await effortLabel.isVisible()) {
    await page.locator('body').click({ position: { x: 8, y: 8 } })
  }
  await step(
    'model popover closes',
    !(await effortLabel.isVisible()),
    'popover closed after Escape/click outside',
  )
  return true
}

async function inspectManualDoor({ page, step, shot, visible, surface, projectRoot }) {
  if (surface === 'Chat') {
    await page.getByRole('button', { name: 'Chat', exact: true }).click()
  } else if (surface === 'Dev') {
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
  } else {
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
  }

  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  if (await projectButton.isVisible()) await projectButton.click()

  if (surface === 'Chat') {
    const taskFields = page.locator('form textarea, form input')
    const forbiddenButtons = page.getByRole('button').filter({
      hasText: /Append to tasks\.yaml|Create task|New task/i,
    })
    const fieldCount = await taskFields.count()
    const visibleForbidden = []
    for (let i = 0; i < (await forbiddenButtons.count()); i += 1) {
      if (await forbiddenButtons.nth(i).isVisible())
        visibleForbidden.push(await forbiddenButtons.nth(i).innerText())
    }
    await step(
      `${surface}: no manual task creation door`,
      fieldCount === 0 && visibleForbidden.length === 0,
      `task form fields=${fieldCount}; forbidden buttons=${JSON.stringify(visibleForbidden)}`,
    )
    return
  }

  if (surface === 'Dev') {
    const taskFields = page.locator('form textarea, form input')
    const forbiddenButtons = page.getByRole('button').filter({
      hasText: /Append to tasks\.yaml|Create task|New task/i,
    })
    const fieldCount = await taskFields.count()
    const visibleForbidden = []
    for (let i = 0; i < (await forbiddenButtons.count()); i += 1) {
      if (await forbiddenButtons.nth(i).isVisible())
        visibleForbidden.push(await forbiddenButtons.nth(i).innerText())
    }
    await step(
      `${surface}: no manual task creation door`,
      fieldCount === 0 && visibleForbidden.length === 0,
      `task form fields=${fieldCount}; forbidden buttons=${JSON.stringify(visibleForbidden)}`,
    )
    return
  }

  for (const tabName of ['Tasks', 'Plan']) {
    await page.getByRole('button', { name: tabName, exact: true }).click()
    const taskFields = page.locator('form textarea, form input')
    const forbiddenButtons = page.getByRole('button').filter({
      hasText: /Append to tasks\.yaml|Create task|New task/i,
    })
    const fieldCount = await taskFields.count()
    const visibleForbidden = []
    for (let i = 0; i < (await forbiddenButtons.count()); i += 1) {
      if (await forbiddenButtons.nth(i).isVisible())
        visibleForbidden.push(await forbiddenButtons.nth(i).innerText())
    }
    await step(
      `Settings ${tabName}: no manual task creation door`,
      fieldCount === 0 && visibleForbidden.length === 0,
      `task form fields=${fieldCount}; forbidden buttons=${JSON.stringify(visibleForbidden)}`,
    )
    const launchButton =
      tabName === 'Tasks'
        ? page.getByRole('button', { name: 'Create First Task', exact: true })
        : page.getByRole('button', { name: 'Add task', exact: true })
    if (await visible(launchButton, 2_000)) {
      await launchButton.click()
      const composer = page.locator('textarea').last()
      const composerVisible = await visible(composer)
      const dialogCount = await page.getByRole('dialog').count()
      await step(
        `${tabName} action opens only Chat composer`,
        composerVisible && dialogCount === 0,
        `composer visible=${composerVisible}; dialogs=${dialogCount}`,
      )
      await page.getByRole('button', { name: 'Settings', exact: true }).click()
      await projectButton.waitFor({ state: 'visible' }).catch(() => undefined)
      await projectButton.click().catch(() => undefined)
    }
  }
  await shot('no-manual-door')
}

function taskYamlBlock(projectRoot, taskId) {
  const tasks = yamlParse(readFileSync(join(projectRoot, 'tasks.yaml'), 'utf8'))?.tasks ?? []
  return tasks.find((task) => task.id === taskId)
}

function databaseSnapshot(databasePath, sessionId, taskId) {
  return runJson(`
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)}, { readonly: true })
    const messages = db.query('SELECT role, content, task_id FROM chat_messages WHERE session_id = ? ORDER BY id').all(${JSON.stringify(sessionId)})
    const run = db.query('SELECT status, provider, model, result FROM runs WHERE task_id = ? ORDER BY created_at DESC LIMIT 1').get(${JSON.stringify(taskId)})
    console.log(JSON.stringify({ messages, run: run ?? null }))
    db.close()
  `)
}

export default async function autoFlow({ page, api, step, shot, visible, cleanup, databasePath }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-i7-'))
  let projectId
  cleanup(async () => {
    if (projectId)
      await api(`/api/projects/${encodeURIComponent(projectId)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })

  writeFileSync(join(projectRoot, 'README.md'), '# I.7 automatic task flow\n')
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
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'task', 'init'], projectRoot)
  const configPath = join(projectRoot, 'orchestos.config.yaml')
  const config = yamlParse(readFileSync(configPath, 'utf8')) ?? {}
  config.taskAgentRules = [
    { match: { output: ['claude-*.md'] }, agent: 'claude' },
    { match: { output: ['codex-*.md'] }, agent: 'codex' },
  ]
  writeFileSync(configPath, yamlStringify(config))
  run('git', ['add', '-A'], projectRoot)
  run(
    'git',
    [
      '-c',
      'user.name=ui-gate',
      '-c',
      'user.email=ui-gate@example.invalid',
      'commit',
      '-qm',
      'task scaffold',
    ],
    projectRoot,
  )

  const projectsResponse = await api('/api/projects')
  const project = (projectsResponse.data ?? []).find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  projectId = project.id
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step(
    'temporary project visible',
    await visible(projectButton),
    'project appears in Dev sidebar',
  )
  if (!(await projectButton.isVisible())) return
  await projectButton.click()

  await inspectManualDoor({ page, step, shot, visible, surface: 'Chat', projectRoot })
  await inspectManualDoor({ page, step, shot, visible, surface: 'Dev', projectRoot })
  await inspectManualDoor({ page, step, shot, visible, surface: 'Settings', projectRoot })

  await page.getByRole('button', { name: 'Back to app', exact: true }).click()
  await page.getByRole('button', { name: 'Chat', exact: true }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  const beforeQuestionTasks = new Set((await tasksFor(api, projectId)).map((task) => task.id))
  if (!(await startChat(page, 'Codex', step, visible))) return
  const questionSessionResponse = await api(
    `/api/chat/sessions?project=${encodeURIComponent(projectId)}`,
  )
  const questionSession = (questionSessionResponse.data ?? [])[0]
  if (!questionSession) throw new Error('Codex chat session was not created')
  const composer = page.locator('textarea').last()
  await sendMessage({
    page,
    composer,
    text: '¿Qué es un DAG? Responde en una frase, sin crear ni modificar archivos.',
    step,
    shot,
  })
  const afterQuestionTasks = new Set((await tasksFor(api, projectId)).map((task) => task.id))
  const taskDelta = [...afterQuestionTasks].filter((id) => !beforeQuestionTasks.has(id))
  const taskReady = page.getByText('Task ready to run', { exact: true })
  const approve = page.getByRole('button', { name: 'Approve & Run', exact: true })
  const questionTree = execFileSync('git', ['status', '--porcelain'], {
    cwd: projectRoot,
    encoding: 'utf8',
  }).trim()
  await step(
    'non-task message does not create task',
    taskDelta.length === 0 &&
      !(await taskReady.isVisible().catch(() => false)) &&
      !(await approve.isVisible().catch(() => false)),
    `new task ids=${JSON.stringify(taskDelta)}; task card=${await taskReady.isVisible().catch(() => false)}; approve=${await approve.isVisible().catch(() => false)}`,
  )
  await step('non-task message leaves project clean', questionTree === '', questionTree || 'clean')

  const createTask = async (filename, agentName) => {
    const text = `Crea el archivo ${filename} con una sola línea: "nota de ${agentName.toLowerCase()}".`
    const initialTasks = await tasksFor(api, projectId)
    const initialIds = new Set(initialTasks.map((task) => task.id))
    const reply = await sendMessage({
      page,
      composer,
      text,
      step,
      shot,
    })
    if (!reply) return null
    const deadline = Date.now() + 180_000
    let task
    while (Date.now() < deadline && !task) {
      task = (await tasksFor(api, projectId)).find((item) => !initialIds.has(item.id))
      if (!task) await delay(1_000)
    }
    if (!task) {
      await step(`${filename}: task created`, false, 'no new task appeared in /api/tasks')
      return null
    }
    const taskCard = page.getByText('Task ready to run', { exact: true }).last()
    const approveButton = page.getByRole('button', { name: 'Approve & Run', exact: true }).last()
    const held = await visible(approveButton, 5_000)
    if (held) {
      await approveButton.click()
      await step(`${filename}: approval path`, true, `held task approved: ${task.id}`)
    } else {
      await step(
        `${filename}: approval path`,
        true,
        `task started automatically: ${task.id}; card visible=${await taskCard.isVisible().catch(() => false)}`,
      )
    }
    const finished = await waitForTaskFinished(api, projectId, task.id, task)
    await step(
      `${filename}: task finished`,
      Boolean(finished && finished.status !== 'pending' && finished.status !== 'running'),
      JSON.stringify(finished ?? { id: task.id, status: 'missing' }),
    )
    const snapshot = databaseSnapshot(databasePath, questionSession.id, task.id)
    const inlineText = await page
      .locator('body')
      .innerText()
      .catch(() => '')
    const normalizedInlineText = inlineText.toLowerCase()
    const taskIdVisible = normalizedInlineText.includes(task.id.toLowerCase())
    const finalStatus = finished?.status ?? ''
    const finalStatusVisible = Boolean(
      finalStatus && normalizedInlineText.includes(finalStatus.toLowerCase()),
    )
    const inline = taskIdVisible && finalStatusVisible
    await step(
      `${filename}: inline report`,
      inline,
      `task id visible=${taskIdVisible}; final status "${finalStatus}" visible=${finalStatusVisible}`,
    )
    const persistedUser = snapshot.messages.some(
      (message) => message.role === 'user' && message.content.includes(filename),
    )
    const persistedAssistant = snapshot.messages.some((message) => message.role === 'assistant')
    await step(
      `${filename}: chat and run persistence`,
      persistedUser && persistedAssistant && Boolean(snapshot.run?.result?.trim()),
      JSON.stringify({
        status: snapshot.run?.status ?? 'missing',
        provider: snapshot.run?.provider ?? null,
        model: snapshot.run?.model ?? null,
        resultLength: snapshot.run?.result?.length ?? 0,
        userMessage: persistedUser,
        assistantMessage: persistedAssistant,
      }),
    )
    await shot(filename === 'claude-nota.md' ? 'task-inline-report' : 'codex-task-inline-report')
    return { task, finished, snapshot }
  }

  const claudeTask = await createTask('claude-nota.md', 'Claude')
  const codexTask = await createTask('codex-nota.md', 'Codex')

  if (claudeTask && codexTask) {
    const claudeDefinition = taskYamlBlock(projectRoot, claudeTask.task.id)
    const codexDefinition = taskYamlBlock(projectRoot, codexTask.task.id)
    const claudeRun = claudeTask.snapshot.run
    const codexRun = codexTask.snapshot.run
    const distinctAndPresent =
      Boolean(claudeRun?.provider && claudeRun?.model && codexRun?.provider && codexRun?.model) &&
      claudeRun.provider === 'claude' &&
      codexRun.provider === 'codex' &&
      `${claudeRun.provider}/${claudeRun.model}` !== `${codexRun.provider}/${codexRun.model}`
    await step(
      'DAG routes Claude and Codex to distinct recorded engines',
      claudeDefinition?.engine === 'external' &&
        codexDefinition?.engine === 'codex' &&
        distinctAndPresent,
      JSON.stringify({
        claude: {
          engine: claudeDefinition?.engine ?? null,
          provider: claudeRun?.provider ?? null,
          model: claudeRun?.model ?? null,
          status: claudeTask.finished?.status ?? 'missing',
          result: claudeRun?.result ?? null,
          retry_reason: claudeDefinition?.retry_reason ?? null,
        },
        codex: {
          engine: codexDefinition?.engine ?? null,
          provider: codexRun?.provider ?? null,
          model: codexRun?.model ?? null,
        },
      }),
    )
  }

  const chatText = await page
    .locator('body')
    .innerText()
    .catch(() => '')
  const proseTexts = await page
    .locator('div.prose')
    .allInnerTexts()
    .catch(() => [])
  const nonModelText = proseTexts.reduce((text, prose) => text.replace(prose, ''), chatText)
  const implementationLeaks = [
    'tasks.yaml',
    'engine:',
    'executor_model',
    '[[orchestos:task]]',
  ].filter((needle) => nonModelText.includes(needle))
  const absoluteProjectPath = nonModelText.includes(projectRoot)
  const sourcePathError = /Error:\s*[^\n]*src\//.test(nonModelText)
  const markerInProse = proseTexts.some((text) => text.includes('[[orchestos:task]]'))
  await step(
    'no implementation text visible',
    chatText.trim().length > 0 &&
      implementationLeaks.length === 0 &&
      !absoluteProjectPath &&
      !sourcePathError &&
      !markerInProse,
    JSON.stringify({ implementationLeaks, absoluteProjectPath, sourcePathError, markerInProse }),
  )
  await shot('final-chat')
}
