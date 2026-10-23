import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { parse as yamlParse } from 'yaml'
import { writeGateRoles } from '../lib.mjs'

const FILE = 'notas/undo-check.md'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
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

async function startChat(page, agentName, step, visible) {
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const agent = dialog.getByRole('button', { name: new RegExp(agentName, 'i') }).first()
  await step(`select ${agentName} for new chat`, await visible(agent), 'agent option visible')
  if (!(await agent.isVisible())) return false
  await agent.click()
  await dialog.getByRole('button', { name: 'Start Chat', exact: true }).click()
  const composer = page.locator('textarea').last()
  await step('composer visible', await visible(composer), 'chat composer visible after Start Chat')
  return composer
}

export default async function chatTaskUndoFlow({ page, api, step, shot, visible, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-erp72-'))
  let projectId
  cleanup(async () => {
    if (projectId)
      await api(`/api/projects/${encodeURIComponent(projectId)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })

  writeFileSync(join(projectRoot, 'README.md'), '# ERP.7.2 undo task\n')
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
      'scaffold',
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
  await step('temporary project visible', await visible(projectButton), 'project in Dev sidebar')
  if (!(await projectButton.isVisible())) return
  await projectButton.click()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()

  const composer = await startChat(page, 'Codex', step, visible)
  if (!composer) return

  const before = new Set((await tasksFor(api, projectId)).map((task) => task.id))
  const first = await sendMessage({
    page,
    composer,
    text: `Quiero una tarea que cree el archivo \`${FILE}\` con una sola línea: hola. Todavía no crees la tarea; dime solo qué harías.`,
    step,
    shot,
  })
  if (!first) return
  const firstText = await first.innerText()
  const firstTasks = (await tasksFor(api, projectId)).filter((task) => !before.has(task.id))
  await step(
    'message 1 plans without creating the task',
    !/Run requested for task|Created task/.test(firstText) && firstTasks.length === 0,
    JSON.stringify({ reply: firstText.slice(0, 300), newTasks: firstTasks.map((t) => t.id) }),
  )

  const second = await sendMessage({
    page,
    composer,
    text: 'Crea la tarea tal como la describiste.',
    step,
    shot,
  })
  if (!second) return
  let secondText = await second.innerText()
  let created = (await tasksFor(api, projectId)).find((task) => !before.has(task.id))
  const noteDeadline = Date.now() + 60_000
  while (
    Date.now() < noteDeadline &&
    !created &&
    !/No task created|Could not auto-create/.test(secondText)
  ) {
    await delay(1_000)
    secondText = await second.innerText()
    created = (await tasksFor(api, projectId)).find((task) => !before.has(task.id))
  }
  await step(
    'message 2 creates the task from the thread',
    Boolean(created) && !/No task created|Could not auto-create/.test(secondText),
    JSON.stringify({ reply: secondText.slice(0, 400), newTask: created?.id ?? null }),
  )

  if (created) {
    await step(
      'task card visible in the thread',
      await visible(
        page
          .locator(`[data-task-row][data-task-id="${created.id}"]`)
          .or(page.locator(`[data-task-id="${created.id}"]`))
          .first(),
      ),
      `task ${created.id} visible`,
    )
  }
  await step(
    'task exists in tasks.yaml',
    Boolean(created),
    created ? `task ${created.id}` : 'no new task in /api/tasks',
  )
  if (!created) return
  const definition = (
    yamlParse(readFileSync(join(projectRoot, 'tasks.yaml'), 'utf8'))?.tasks ?? []
  ).find((task) => task.id === created.id)
  const output = Array.isArray(definition?.output) ? definition.output : []
  await step(
    'task declares the thread file and class implement',
    output.includes(FILE) && definition?.task_class === 'implement',
    JSON.stringify({ output, task_class: definition?.task_class ?? null }),
  )

  const deadline = Date.now() + 10 * 60_000
  let finished
  while (Date.now() <= deadline) {
    finished = (await tasksFor(api, projectId)).find((task) => task.id === created.id)
    if (finished && finished.status !== 'pending' && finished.status !== 'running') break
    await delay(2_000)
  }
  const exists = existsSync(join(projectRoot, FILE))
  await step(
    'task finishes done and the file exists',
    finished?.status === 'done' && exists,
    JSON.stringify({ status: finished?.status ?? 'missing', fileExists: exists }),
  )
  const taskCard = page.locator(`[data-task-id="${created.id}"]`)
  const diffToggle = taskCard.locator('[data-task-diff] summary')
  await step('task card exposes diff summary', await visible(diffToggle), 'diff summary visible')
  if (!(await diffToggle.isVisible())) return
  await step(
    'diff summary counts the added line',
    /\+1/.test(await diffToggle.innerText()),
    await diffToggle.innerText(),
  )
  await shot('task-diff-closed')
  await diffToggle.click()
  await step(
    'diff shows created file',
    await visible(taskCard.getByText(FILE, { exact: true })),
    FILE,
  )
  await shot('task-diff-open')

  const undoButton = taskCard.getByRole('button', { name: 'Undo', exact: true })
  await step('undo button visible', await visible(undoButton), 'committed run can be reverted')
  if (!(await undoButton.isVisible())) return
  await undoButton.click()
  await shot('undo-confirmation')
  await taskCard.getByRole('button', { name: 'Confirm undo', exact: true }).click()
  const undone = taskCard.locator('[data-task-undone]')
  await undone.waitFor({ state: 'visible', timeout: 30_000 })
  await step(
    'undo completes and shows reverted sha',
    await visible(undone),
    await undone.innerText(),
  )
  await shot('task-undone')

  const fileExistsAfterUndo = existsSync(join(projectRoot, FILE))
  const latestSubject = execFileSync('git', ['log', '-1', '--format=%s'], {
    cwd: projectRoot,
    encoding: 'utf8',
  }).trim()
  const revertHeadExists = existsSync(join(projectRoot, '.git/REVERT_HEAD'))
  await step(
    'file returned to prior state',
    !fileExistsAfterUndo,
    JSON.stringify({ fileExistsAfterUndo }),
  )
  await step(
    'revert commit subject is correct',
    latestSubject === `orchestos(${created.id}): deshacer`,
    latestSubject,
  )
  await step('REVERT_HEAD does not remain', !revertHeadExists, JSON.stringify({ revertHeadExists }))
}
