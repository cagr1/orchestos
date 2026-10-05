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
    { match: { output: ['claude-*.md'] }, agent: 'claude', model: 'haiku' },
    { match: { output: ['codex-*.md'] }, agent: 'codex' },
  ]
  writeFileSync(configPath, yamlStringify(config))
  writeFileSync(join(projectRoot, 'codex-nota.md'), 'borrador viejo\n')
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

  const taskIds = []
  const createTask = async (filename, agentName, expectHeld) => {
    const text = `Crea el archivo ${filename} con una sola línea: nota de ${agentName.toLowerCase()}`
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
      const replyText = (await reply.innerText().catch(() => 'reply unavailable')).slice(0, 400)
      const projectStatus = execFileSync('git', ['status', '--porcelain'], {
        cwd: projectRoot,
        encoding: 'utf8',
      }).trim()
      await step(
        `${filename}: task created`,
        false,
        JSON.stringify({
          reason: 'no new task appeared in /api/tasks',
          reply: replyText,
          projectStatus,
        }),
      )
      return null
    }
    taskIds.push(task.id)
    const taskCard = page.getByText('Task ready to run', { exact: true }).last()
    const approveButton = page.getByRole('button', { name: 'Approve & Run', exact: true }).last()
    if (expectHeld) {
      const buttonVisible = await visible(approveButton, 30_000)
      let heldState = (await tasksFor(api, projectId)).find((item) => item.id === task.id)
      let oldContent = readFileSync(join(projectRoot, filename), 'utf8')
      await step(
        `${filename}: held for approval`,
        buttonVisible &&
          heldState?.status === 'pending' &&
          !heldState.runId &&
          oldContent === 'borrador viejo\n',
        JSON.stringify({
          buttonVisible,
          status: heldState?.status ?? 'missing',
          runId: heldState?.runId ?? null,
          content: oldContent,
        }),
      )
      if (
        !buttonVisible ||
        heldState?.status !== 'pending' ||
        heldState.runId ||
        oldContent !== 'borrador viejo\n'
      )
        return null
      await delay(3_000)
      heldState = (await tasksFor(api, projectId)).find((item) => item.id === task.id)
      oldContent = readFileSync(join(projectRoot, filename), 'utf8')
      const stayedHeld =
        heldState?.status === 'pending' && !heldState.runId && oldContent === 'borrador viejo\n'
      await step(
        `${filename}: remains pending before approval`,
        stayedHeld,
        JSON.stringify({
          status: heldState?.status ?? 'missing',
          runId: heldState?.runId ?? null,
          content: oldContent,
        }),
      )
      if (!stayedHeld) return null
      await approveButton.click()
      const startsDeadline = Date.now() + 60_000
      let started
      while (Date.now() < startsDeadline) {
        started = (await tasksFor(api, projectId)).find((item) => item.id === task.id)
        if (started?.runId || started?.status === 'running' || started?.status === 'done') break
        await delay(1_000)
      }
      const buttonHidden = !(await visible(approveButton, 1_000))
      const didStart = Boolean(
        started?.runId || started?.status === 'running' || started?.status === 'done',
      )
      await step(
        `${filename}: starts after approval`,
        didStart && buttonHidden,
        JSON.stringify({
          taskId: task.id,
          status: started?.status ?? 'missing',
          runId: started?.runId ?? null,
          buttonHidden,
        }),
      )
      if (!didStart || !buttonHidden) return null
    } else {
      const buttonVisible = await visible(approveButton, 1_000)
      const current = (await tasksFor(api, projectId)).find((item) => item.id === task.id)
      const didStart = Boolean(
        current?.runId || current?.status === 'running' || current?.status === 'done',
      )
      await step(
        `${filename}: starts without approval`,
        !buttonVisible && didStart,
        JSON.stringify({
          taskId: task.id,
          buttonVisible,
          status: current?.status ?? 'missing',
          runId: current?.runId ?? null,
          cardVisible: await taskCard.isVisible().catch(() => false),
        }),
      )
      if (buttonVisible || !didStart) return null
    }
    const finished = await waitForTaskFinished(api, projectId, task.id, task)
    const done = finished?.status === 'done'
    await step(
      `${filename}: task finished`,
      done,
      JSON.stringify(finished ?? { id: task.id, status: 'missing' }),
    )
    if (!done) return null
    const outputPath = join(projectRoot, filename)
    let outputContent
    try {
      outputContent = readFileSync(outputPath, 'utf8')
    } catch {
      outputContent = null
    }
    const exactContent =
      outputContent !== null &&
      outputContent.replace(/\r?\n$/, '') === `nota de ${agentName.toLowerCase()}`
    await step(
      `${filename}: exact content`,
      exactContent,
      outputContent === null ? 'missing' : JSON.stringify(outputContent),
    )
    const reportDeadline = Date.now() + 30_000
    let dom = false
    while (Date.now() < reportDeadline && !dom) {
      const prose = page.locator('div.prose')
      const count = await prose.count().catch(() => 0)
      for (let index = 0; index < count; index += 1) {
        const content = (
          await prose
            .nth(index)
            .innerText()
            .catch(() => '')
        ).toLowerCase()
        if (content.includes(task.id.toLowerCase()) && content.includes('done')) {
          dom = true
          break
        }
      }
      if (!dom) await new Promise((resolve) => setTimeout(resolve, 1_000))
    }
    const snapshot = databaseSnapshot(databasePath, questionSession.id, task.id)
    const persisted = snapshot.messages.some(
      (message) =>
        message.role === 'assistant' &&
        message.task_id === task.id &&
        message.content.toLowerCase().includes('done'),
    )
    await step(`${filename}: inline report`, dom && persisted, `dom=${dom}; persisted=${persisted}`)
    const persistedUser = snapshot.messages.some(
      (message) => message.role === 'user' && message.content.includes(filename),
    )
    const persistedAssistant = snapshot.messages.some((message) => message.role === 'assistant')
    await step(
      `${filename}: chat and run persistence`,
      persistedUser &&
        persistedAssistant &&
        Boolean(snapshot.run?.result?.trim()) &&
        snapshot.run?.status === 'done',
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

  const claudeTask = await createTask('claude-nota.md', 'Claude', false)
  const codexTask = await createTask('codex-nota.md', 'Codex', true)

  if (claudeTask && codexTask) {
    const claudeDefinition = taskYamlBlock(projectRoot, claudeTask.task.id)
    const codexDefinition = taskYamlBlock(projectRoot, codexTask.task.id)
    const claudeRun = claudeTask.snapshot.run
    const codexRun = codexTask.snapshot.run
    const distinctAndPresent =
      Boolean(claudeRun?.provider && claudeRun?.model && codexRun?.provider && codexRun?.model) &&
      claudeRun.provider === 'claude' &&
      claudeRun.model === 'haiku' &&
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

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const reloadedProjectButton = page.getByRole('button', {
    name: basename(projectRoot),
    exact: true,
  })
  await reloadedProjectButton.waitFor({ state: 'visible', timeout: 30_000 })
  await reloadedProjectButton.click()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  const questionThread = page
    .locator('aside')
    .getByText(/¿Qué es un DAG\?/i)
    .first()
  await questionThread.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => undefined)
  if (await questionThread.isVisible().catch(() => false)) await questionThread.click()
  let recoveredTaskIds = []
  if (taskIds.length === 0) {
    await step('reload recovers task reports', false, 'no tasks to recover')
  } else {
    const prose = page.locator('div.prose').first()
    await prose.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => undefined)
    const reloadDeadline = Date.now() + 30_000
    while (Date.now() < reloadDeadline) {
      const proseTexts = await page
        .locator('div.prose')
        .allInnerTexts()
        .catch(() => [])
      recoveredTaskIds = taskIds.filter((taskId) =>
        proseTexts.some(
          (text) =>
            text.toLowerCase().includes(taskId.toLowerCase()) &&
            text.toLowerCase().includes('done'),
        ),
      )
      if (recoveredTaskIds.length === taskIds.length) break
      await delay(1_000)
    }
    const missingTaskIds = taskIds.filter((taskId) => !recoveredTaskIds.includes(taskId))
    await step(
      'reload recovers task reports',
      missingTaskIds.length === 0,
      JSON.stringify({ found: recoveredTaskIds, missing: missingTaskIds }),
    )
  }
  await shot('after-reload')

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
