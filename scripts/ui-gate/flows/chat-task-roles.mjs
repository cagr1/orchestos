import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { parse as yamlParse } from 'yaml'
import { run, writeGateRoles } from '../lib.mjs'

const FILE = 'notas/hola.md'

async function waitForComposerReady(page) {
  const button = page.locator('button[aria-label="Send message"]:visible').last()
  const startedAt = Date.now()
  const deadline = startedAt + 30_000
  while (Date.now() < deadline) {
    if (await button.isEnabled().catch(() => false)) return
    await page.waitForTimeout(100)
  }
  throw new Error(`composer stayed busy ${Date.now() - startedAt} ms`)
}

async function tasksFor(api, projectId) {
  const response = await api('/api/tasks', { headers: { 'x-orchestos-project-id': projectId } })
  return Array.isArray(response.data?.tasks) ? response.data.tasks : []
}

async function sendMessage({ page, composer, text, step, shot }) {
  const previousReplyCount = await page.locator('div.prose').count()
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/chat',
    { timeout: 180_000 },
  )
  await composer.fill(text)
  await waitForComposerReady(page)
  await composer.press('Enter')
  let response
  try {
    response = await responsePromise
  } catch {
    await shot('send-timeout')
    await step('chat request sent', false, `no /api/chat response for: ${text.slice(0, 60)}`)
    return null
  }
  if (!response.ok())
    throw new Error(
      `/api/chat returned HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`,
    )
  const reply = page.locator('div.prose').nth(previousReplyCount)
  await reply.waitFor({ state: 'visible', timeout: 180_000 })
  return reply
}

async function startChat(page, agent, projectName) {
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectRow = page.getByRole('button', { name: projectName, exact: true })
  await projectRow.hover()
  await projectRow
    .locator('..')
    .getByRole('button', { name: 'Launch new agent', exact: true })
    .click()
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat/sessions',
  )
  await page
    .getByRole('dialog', { name: 'Launch agent' })
    .getByRole('option', { name: new RegExp(agent, 'i') })
    .first()
    .click()
  const session = await (await responsePromise).json()
  if (session.agent !== agent.toLowerCase())
    throw new Error(`Expected ${agent} session, received ${session.agent}`)
  // The POST opens a tab before /api/projects hydrates its agent and composer.
  await page.locator(`[data-thread-id="${session.id}"]`).waitFor()
  await page.locator(`[data-session-tab="${session.id}"][aria-selected="true"]`).waitFor()
  return session
}

export default async function chatTaskRolesFlow({ page, api, step, shot, visible, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-uso44-'))
  let projectId
  cleanup(async () => {
    if (projectId)
      await api(`/api/projects/${encodeURIComponent(projectId)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })

  writeFileSync(join(projectRoot, 'README.md'), '# USO.44 task roles\n')
  const repoRoot = process.cwd()
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'init', projectRoot], repoRoot)
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'task', 'init'], projectRoot)
  const configPath = join(projectRoot, 'orchestos.config.yaml')
  if (existsSync(configPath)) {
    const config = yamlParse(readFileSync(configPath, 'utf8')) ?? {}
    if (config.roles) {
      delete config.roles
      const { stringify: yamlStringify } = await import('yaml')
      writeFileSync(configPath, yamlStringify(config))
    }
  }

  const projectsResponse = await api('/api/projects')
  const project = (projectsResponse.data ?? []).find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  projectId = project.id
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step('temporary project visible', await visible(projectButton), 'project in Dev sidebar')
  if (!(await projectButton.isVisible())) return
  await projectButton.click()

  const session = await startChat(page, 'Claude', basename(projectRoot))
  const composer = page.locator('textarea:visible').last()
  await step(
    'composer visible',
    await visible(composer),
    'chat composer visible after session hydration',
  )
  if (!(await composer.isVisible())) return
  const before = new Set((await tasksFor(api, projectId)).map((task) => task.id))
  const first = await sendMessage({
    page,
    composer,
    text: 'Crea una tarea para escribir `notas/hola.md` con una sola línea: hola. Créala ya, sin preguntar.',
    step,
    shot,
  })
  if (!first) return
  let firstText = await first.innerText()
  let created = (await tasksFor(api, projectId)).find((task) => !before.has(task.id))
  const noRoleDeadline = Date.now() + 20_000
  while (Date.now() < noRoleDeadline && !created) {
    await delay(1_000)
    firstText = await first.innerText()
    created = (await tasksFor(api, projectId)).find((task) => !before.has(task.id))
  }
  await step('no roles: no task created', !created, created?.id ?? 'no new task in /api/tasks')
  await step(
    'no roles: error visible in chat',
    /no model assigned/i.test(firstText) && /Model routing/i.test(firstText),
    firstText.slice(0, 500),
  )
  await shot('no-roles-error')

  writeGateRoles(projectRoot)
  const initialize = page.getByRole('button', { name: 'Initialize git', exact: true })
  await step('git initialization offered', await visible(initialize), 'git offer above composer')
  await shot('git-offer')
  const blocked = await sendMessage({
    page,
    composer,
    text: 'Ya asigné los modelos. Crea la tarea otra vez.',
    step,
    shot,
  })
  if (!blocked) return
  const blockedText = await blocked.innerText()
  await step(
    'no git: real blocker and no task',
    /not a git repository/i.test(blockedText) &&
      !(await tasksFor(api, projectId)).some((task) => !before.has(task.id)),
    blockedText.slice(0, 500),
  )
  const initResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/git-init'),
  )
  await initialize.click()
  const initialized = await initResponse
  if (initialized.status() === 422) {
    run('git', ['-C', projectRoot, 'config', 'user.name', 'ui-gate'], projectRoot)
    run('git', ['-C', projectRoot, 'config', 'user.email', 'ui-gate@example.invalid'], projectRoot)
    const retry = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/git-init'),
    )
    await initialize.click()
    if (!(await retry).ok()) throw new Error('git initialization retry failed')
  } else if (!initialized.ok())
    throw new Error(`git initialization failed: ${await initialized.text()}`)
  await initialize.waitFor({ state: 'hidden' })
  await step(
    'git initialized',
    existsSync(join(projectRoot, '.git')),
    '.git exists and offer disappeared',
  )
  const second = await sendMessage({
    page,
    composer,
    text: 'Ya inicialicé git. Crea la tarea otra vez.',
    step,
    shot,
  })
  if (!second) return
  let secondText = await second.innerText()
  const taskDeadline = Date.now() + 60_000
  created = undefined
  let started = false
  while (Date.now() < taskDeadline) {
    const newTasks = (await tasksFor(api, projectId)).filter((task) => !before.has(task.id))
    created = newTasks[0]
    secondText = await second.innerText()
    if (created && ['running', 'done'].includes(created.status)) {
      started = true
      break
    }
    await delay(1_000)
  }
  // El arranque aparece como tarjeta de tarea en el hilo, no como texto de respuesta.
  await step(
    'roles: task created and started',
    Boolean(created) &&
      started &&
      (await visible(page.locator(`[data-task-id="${created.id}"]`).first())),
    JSON.stringify({
      taskId: created?.id ?? null,
      status: created?.status ?? null,
      reply: secondText.slice(0, 400),
    }),
  )
  if (!created) return
  await shot('roles-task-started')

  const finishDeadline = Date.now() + 10 * 60_000
  let finished
  while (Date.now() <= finishDeadline) {
    finished = (await tasksFor(api, projectId)).find((task) => task.id === created.id)
    if (
      finished?.status === 'done' ||
      (finished && !['pending', 'running'].includes(finished.status))
    )
      break
    await delay(2_000)
  }
  await step(
    'roles: task finishes after git initialization',
    finished?.status === 'done' && existsSync(join(projectRoot, FILE)),
    JSON.stringify({
      status: finished?.status ?? 'missing',
      fileExists: existsSync(join(projectRoot, FILE)),
    }),
  )

  const third = await sendMessage({
    page,
    composer,
    text: '¿La tarea terminó? Compruébalo.',
    step,
    shot,
  })
  if (!third) return
  const thirdText = await third.innerText()
  const sessionId = session.id
  let toolRecorded = false
  if (sessionId) {
    const timeline = await api(`/api/chat/sessions/${encodeURIComponent(sessionId)}/timeline`, {
      headers: { 'x-orchestos-project-id': projectId },
    })
    // Solo el turno de la pregunta: una consulta de un turno anterior no verifica esta respuesta (qa USO.44).
    const steps = (timeline.data?.turns ?? []).at(-1)?.steps ?? []
    toolRecorded = steps.some(
      (item) => item.type === 'tool_use' && /get_task_status|list_tasks/.test(item.tool ?? ''),
    )
  }
  await step(
    'agent verifies with get_task_status',
    // La respuesta natural confirma el estado; el ID ya no tiene que repetirse en el texto.
    Boolean(created) && /done/i.test(thirdText) && toolRecorded,
    JSON.stringify({ taskId: created.id, reply: thirdText.slice(0, 400), toolRecorded, sessionId }),
  )
  await shot('task-status-verified')
}
