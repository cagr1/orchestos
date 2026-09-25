import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { writeGateRoles } from '../lib.mjs'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

async function tasksFor(api, projectId) {
  const response = await api('/api/tasks', {
    headers: { 'x-orchestos-project-id': projectId },
  })
  return Array.isArray(response.data?.tasks) ? response.data.tasks : []
}

async function heldTaskFor(api, projectId, tasks, beforeIds) {
  const candidates = tasks.filter((task) => task.status === 'pending' && !beforeIds.has(task.id))
  const details = await Promise.all(
    candidates.map(async (task) => {
      const response = await api(`/api/tasks/${encodeURIComponent(task.id)}/explain`, {
        headers: { 'x-orchestos-project-id': projectId },
      })
      return { task, outputs: response.data?.outputs }
    }),
  )
  return details.find((item) => Array.isArray(item.outputs) && item.outputs.includes('README.md'))
    ?.task
}

async function waitForTaskExitPending(api, projectId, taskId) {
  const deadline = Date.now() + 60_000
  let task
  while (Date.now() <= deadline) {
    const tasks = await tasksFor(api, projectId)
    task = tasks.find((item) => item.id === taskId)
    if (task && task.status !== 'pending') return task
    if (Date.now() >= deadline) break
    await delay(2_000)
  }
  return task
}

function retryReasonFromTasksYaml(projectRoot, task) {
  if (!task?.id) return undefined
  const yaml = readFileSync(join(projectRoot, 'tasks.yaml'), 'utf8')
  const escapedId = task.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = yaml.match(
    new RegExp(`(?:^|\\n)\\s*- id:\\s*["']?${escapedId}["']?[\\s\\S]*?(?=\\n\\s*- id:|$)`, 'm'),
  )?.[0]
  const value = block?.match(/^\s+retry_reason:\s*(.+)$/m)?.[1]?.trim()
  return value?.replace(/^(['"])(.*)\1$/, '$2')
}

async function taskStatusDetail(projectRoot, task) {
  const status = task?.status ?? 'missing'
  const retryReason =
    task?.retryReason ?? task?.retry_reason ?? retryReasonFromTasksYaml(projectRoot, task)
  return retryReason ? `status=${status}; retry_reason=${retryReason}` : `status=${status}`
}

export default async function chatTurnDetails({ page, api, step, shot, visible, hidden, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-13-4c-'))
  writeFileSync(join(projectRoot, 'README.md'), '# UI.13.4c\n')
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
  const cleanBeforeReadme = execFileSync('git', ['status', '--porcelain'], {
    cwd: projectRoot,
    encoding: 'utf8',
  }).trim()
  await step(
    'temporary project clean before README task',
    cleanBeforeReadme === '',
    cleanBeforeReadme || 'clean',
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
      'task scaffold',
    ],
    projectRoot,
  )

  const projectList = await api('/api/projects')
  const project = (Array.isArray(projectList.data) ? projectList.data : []).find(
    (item) => item.path === projectRoot,
  )
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true })
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step('select temporary project', await visible(projectButton), 'project visible in sidebar')
  if (await projectButton.isVisible()) await projectButton.click()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const codex = dialog.getByRole('button', { name: /Codex/ }).first()
  await step('select Codex for new chat', await visible(codex), 'visible agent selector')
  if (!(await codex.isVisible())) return
  await codex.click()
  await page.getByRole('button', { name: 'Start Chat', exact: true }).click()

  const modelControl = page.locator('button[title="Select model and reasoning effort"]')
  await step(
    'model and effort controls visible',
    await visible(modelControl),
    'composer controls visible',
  )
  if (!(await modelControl.isVisible())) return
  await modelControl.click()
  const model = page.getByRole('button', { name: /gpt-6-luna/i }).first()
  await step('select gpt-6-luna', await visible(model), 'model option visible')
  if (!(await model.isVisible())) return
  await model.click()
  await modelControl.click()
  const medium = page.getByRole('button', { name: /^medium$/i }).first()
  await step('select medium effort', await visible(medium), 'effort option visible')
  if (!(await medium.isVisible())) return
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

  const composer = page.locator('textarea').last()
  await composer.fill('Ejecuta el comando ls en la raíz del proyecto y dime cuántas entradas hay.')
  await composer.press('Enter')
  const tools = page.getByText(/Tool executions/i).first()
  await step(
    'tool block with command success',
    await visible(tools, 180_000),
    'tool trace rendered',
  )
  await step(
    'command success row',
    await visible(page.getByText(/^success$/i).first()),
    'success visible',
  )
  const sessions = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
  const session = (Array.isArray(sessions.data) ? sessions.data : [])[0]
  if (!session) throw new Error('temporary chat session was not found')
  await step(
    'new chat is linked to temporary project',
    session.projectId === project.id && session.mode === 'code',
    `projectId=${session.projectId ?? 'null'}, mode=${session.mode ?? 'null'}`,
  )
  const timeline = await api(`/api/chat/sessions/${encodeURIComponent(session.id)}/timeline`)
  const reasoningSteps = (timeline.data?.turns ?? []).flatMap((turn) =>
    (turn.steps ?? []).filter((item) => item.type === 'reasoning' && item.detail),
  )
  if (reasoningSteps.length > 0) {
    const reasoning = page.getByText(/^Reasoning \(/i).first()
    await step('reasoning block exists', await visible(reasoning), 'reasoning rendered')
    const reasoningText = page.getByText(
      reasoningSteps[0].detail.replace(/^\*\*(.*?)\*\*$/s, '$1'),
      { exact: true },
    )
    if (!(await visible(reasoningText))) await reasoning.click()
    await step('reasoning text visible', await visible(reasoningText), 'reasoning expanded')
  } else {
    await step('reasoning optional', true, 'reasoning: 0 pasos del CLI')
  }
  await shot('tool-and-reasoning')

  const heldPrompt =
    'Modifica README.md para añadir al final la línea "gate UI.13.4c". La única ruta de salida es README.md.'
  const beforeHeldTaskIds = new Set((await tasksFor(api, project.id)).map((task) => task.id))
  await composer.fill(heldPrompt)
  await composer.press('Enter')
  const taskCard = page.getByText('Task ready to run', { exact: true })
  const heldCardVisible = await visible(taskCard, 180_000)
  if (!heldCardVisible) {
    await shot('held-task-missing')
    const botResponse = await page
      .locator('div.prose')
      .last()
      .innerText()
      .catch(() => '(no visible bot response)')
    await step('held task card visible', false, `bot response: ${botResponse}`)
    return
  } else {
    await step('held task card visible', true, 'held task rendered')
  }
  const pendingTasks = await tasksFor(api, project.id)
  const heldTask = await heldTaskFor(api, project.id, pendingTasks, beforeHeldTaskIds)
  await step(
    'held task id visible',
    Boolean(heldTask && (await visible(page.getByText(heldTask.id, { exact: true })))),
    heldTask?.id ?? 'no pending task',
  )
  await shot('held-task')

  const reject = page.getByRole('button', { name: /^Reject(?: task)?$/i }).first()
  await reject.click()
  await step('Reject removes card', await hidden(taskCard), 'card removed')
  const afterReject = await tasksFor(api, project.id)
  await step(
    'Reject removes task from API',
    !heldTask || !afterReject.some((task) => task.id === heldTask.id),
    'task absent',
  )
  await shot('after-reject')

  const beforeSecondHeldTaskIds = new Set((await tasksFor(api, project.id)).map((task) => task.id))
  await composer.fill(heldPrompt)
  await composer.press('Enter')
  const secondCardVisible = await visible(taskCard, 180_000)
  if (!secondCardVisible) {
    await shot('second-held-task-missing')
    const botResponse = await page
      .locator('div.prose')
      .last()
      .innerText()
      .catch(() => '(no visible bot response)')
    await step('second held task card visible', false, `bot response: ${botResponse}`)
    return
  }
  await step('second held task card visible', true, 'held task rendered again')
  const secondTasks = await tasksFor(api, project.id)
  const secondTask = await heldTaskFor(api, project.id, secondTasks, beforeSecondHeldTaskIds)
  const cleanBeforeApprove = execFileSync('git', ['status', '--porcelain'], {
    cwd: projectRoot,
    encoding: 'utf8',
  }).trim()
  await step(
    'temporary project clean before Approve',
    cleanBeforeApprove === '',
    cleanBeforeApprove || 'clean',
  )
  await page.getByRole('button', { name: /^Approve & Run$/i }).click()
  await step(
    'Approve & Run starts task',
    Boolean(secondTask && (await visible(page.getByText(secondTask.id, { exact: true })))),
    secondTask?.id ?? 'no pending task',
  )
  const approvedCardHidden = await hidden(taskCard)
  await step('Approve & Run removes card', approvedCardHidden, 'card removed')
  await shot('approved-task')
  const afterApprove = secondTask
    ? await waitForTaskExitPending(api, project.id, secondTask.id)
    : undefined
  await step(
    'approved task leaves pending',
    Boolean(afterApprove && afterApprove.status !== 'pending'),
    await taskStatusDetail(projectRoot, afterApprove),
  )

  await page.reload({ waitUntil: 'domcontentloaded' })
  await step('reload: approved card remains hidden', await hidden(taskCard), 'card remains hidden')
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const reloadedProjectButton = page.getByRole('button', {
    name: basename(projectRoot),
    exact: true,
  })
  await step(
    'reload: temporary project visible',
    await visible(reloadedProjectButton),
    'project visible after reload',
  )
  if (await reloadedProjectButton.isVisible()) await reloadedProjectButton.click()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  const reloadedMessages = await api(
    `/api/chat/sessions/${encodeURIComponent(session.id)}/messages`,
  )
  const reloadedTimeline = await api(
    `/api/chat/sessions/${encodeURIComponent(session.id)}/timeline`,
  )
  const timelineTurns = reloadedTimeline.data?.turns ?? []
  const timelineTurnIds = new Set(timelineTurns.map((turn) => turn.id))
  const assistantWithTurn = (
    Array.isArray(reloadedMessages.data) ? reloadedMessages.data : []
  ).find(
    (message) =>
      message.role === 'assistant' && message.turnId && timelineTurnIds.has(message.turnId),
  )
  await step(
    'reload API message keeps turnId',
    Boolean(assistantWithTurn),
    assistantWithTurn?.turnId ?? 'missing turn_id',
  )
  const timelineSteps = timelineTurns.flatMap((turn) => turn.steps ?? [])
  await step(
    'reload API timeline brings turn steps',
    timelineSteps.length > 0,
    `${timelineSteps.length} pasos en ${timelineTurns.length} turnos`,
  )
  await shot('after-final-reload')

  const sidebar = page.locator('aside')
  const sidebarText = await sidebar.innerText()
  const reloadedThread = sidebar.getByText(/^Codex: Ejecuta el comando ls/).first()
  await step(
    'reload: project chat reachable from Chat list',
    await visible(reloadedThread, 30_000),
    `chat title visible; sidebar=${JSON.stringify(sidebarText)}`,
  )
  if (await reloadedThread.isVisible()) {
    await reloadedThread.click()
    await step(
      'reload: tool block visible in selected chat',
      await visible(page.getByText(/Tool executions/i).first()),
      'tool trace rendered after selecting chat',
    )
  }
}
