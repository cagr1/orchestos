import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

async function waitForTask(api, projectId, taskId, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let task
  while (Date.now() <= deadline) {
    task = (await tasksFor(api, projectId)).find((item) => item.id === taskId)
    if (task && predicate(task)) return task
    await delay(1_000)
  }
  return task
}

async function messagesFor(api, projectId, sessionId, taskId) {
  const response = await api(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
    headers: { 'x-orchestos-project-id': projectId },
  })
  return (Array.isArray(response.data) ? response.data : []).filter(
    (message) => message.taskId === taskId,
  )
}

export default async function chatRetryReport({ page, api, step, shot, visible, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-erp-4-9-'))
  writeFileSync(join(projectRoot, 'README.md'), '# ERP.4.9\n')
  writeFileSync(join(projectRoot, '.gitignore'), '.orchestos/\nnode_modules/\n')
  writeFileSync(join(projectRoot, 'nota.ts'), 'export const nota = 1\n')
  writeFileSync(
    join(projectRoot, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { noEmit: true, strict: true }, include: ['*.ts'] }),
  )
  writeFileSync(join(projectRoot, 'broken.ts'), "const n: number = 'x'\nexport default n\n")
  mkdirSync(join(projectRoot, 'node_modules'), { recursive: true })
  writeFileSync(join(projectRoot, 'node_modules', '.keep'), '')
  run('git', ['init', '-q'], projectRoot)
  run('git', ['config', 'user.name', 'ui-gate'], projectRoot)
  run('git', ['config', 'user.email', 'ui-gate@example.invalid'], projectRoot)
  run(
    'git',
    ['add', 'README.md', '.gitignore', 'nota.ts', 'tsconfig.json', 'broken.ts'],
    projectRoot,
  )
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
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  if (await visible(projectButton)) await projectButton.click()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const codex = dialog.getByRole('button', { name: /Codex/ }).first()
  await step('select Codex for new chat', await visible(codex), 'Codex option visible')
  if (!(await codex.isVisible())) return
  await codex.click()
  await page.getByRole('button', { name: 'Start Chat', exact: true }).click()

  const modelControl = page.locator('button[title="Select model and reasoning effort"]')
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
  await page.keyboard.press('Escape')

  const sessions = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
  const session = (Array.isArray(sessions.data) ? sessions.data : [])[0]
  if (!session) throw new Error('temporary chat session was not found')
  const composer = page.locator('textarea').last()
  const heldPrompt =
    'Modifica nota.ts para añadir al final la línea "export const gate = 1". La única ruta de salida es nota.ts.'
  const beforeIds = new Set((await tasksFor(api, project.id)).map((task) => task.id))
  await composer.fill(heldPrompt)
  await composer.press('Enter')
  const taskCard = page.getByText('Task ready to run', { exact: true })
  const heldCardVisible = await visible(taskCard, 180_000)
  await step('held task card visible', heldCardVisible, 'held task rendered')
  if (!heldCardVisible) return
  const task = (await tasksFor(api, project.id)).find(
    (item) => item.status === 'pending' && !beforeIds.has(item.id),
  )
  const taskId = task?.id
  await step('held task id obtained', Boolean(taskId), taskId || 'task id unavailable')
  if (!taskId) return
  await page.getByRole('button', { name: /^Approve & Run$/i }).click()
  const firstAttempt = await waitForTask(
    api,
    project.id,
    taskId,
    (item) => item.status === 'pending' && item.retryCount === 1,
    5 * 60_000,
  )
  const retryReason = firstAttempt?.retryReason ?? ''
  await step(
    'first attempt fails on a check',
    firstAttempt?.status === 'pending' &&
      firstAttempt.retryCount === 1 &&
      /check failed/i.test(retryReason),
    `status=${firstAttempt?.status ?? 'missing'} retryCount=${firstAttempt?.retryCount ?? 'missing'} retryReason=${retryReason}`,
  )
  const failedReport = page
    .getByText(new RegExp(`✗ Task\\s*${taskId}\\s*failed · attempt 1/3`))
    .first()
  const reportVisible = await visible(failedReport, 60_000)
  await step(
    'failed attempt report visible without reload',
    reportVisible,
    (await failedReport.innerText().catch(() => 'report not visible')).trim(),
  )

  run('git', ['rm', '-q', 'broken.ts', 'tsconfig.json'], projectRoot)
  run(
    'git',
    [
      '-c',
      'user.name=ui-gate',
      '-c',
      'user.email=ui-gate@example.invalid',
      'commit',
      '-qm',
      'remove failing check',
    ],
    projectRoot,
  )
  const cleanStatus = execFileSync('git', ['status', '--porcelain'], {
    cwd: projectRoot,
    encoding: 'utf8',
  }).trim()
  const unexpectedChanges = cleanStatus
    .split('\n')
    .filter((line) => line && !/^\s*[?MADRCU]{1,2}\s+tasks\.yaml$/.test(line))
  await step('project clean before retry', unexpectedChanges.length === 0, cleanStatus || 'clean')

  // ERP.4.13 — el reintento sale del último reporte del hilo, sin recargar la página.
  const retry = page.getByRole('button', { name: /^Retry$/ })
  await step(
    'Retry offered on the last report without reload',
    (await visible(retry)) && (await retry.count()) === 1,
    `Retry buttons=${await retry.count()}`,
  )
  if (!(await retry.first().isVisible())) return
  const before = (await messagesFor(api, project.id, session.id, taskId)).length
  await retry.first().click()
  const secondTask = await waitForTask(
    api,
    project.id,
    taskId,
    (item) => item.status === 'done',
    10 * 60_000,
  )
  await step('second attempt done', secondTask?.status === 'done', secondTask?.status ?? 'missing')
  if (secondTask?.status !== 'done') return
  const doneReport = page.getByText(new RegExp(`✓ Task\\s*${taskId}\\s*done`)).first()
  const doneVisible = await visible(doneReport, 90_000)
  const after = (await messagesFor(api, project.id, session.id, taskId)).length
  await step(
    'done report appears in the open thread without reload',
    doneVisible,
    `task messages before=${before}; after=${after}; ${await doneReport.innerText().catch(() => 'report not visible')}`,
  )
  await step(
    'previous report no longer shows Retry',
    (await retry.count()) === 0,
    `Retry buttons=${await retry.count()}`,
  )
  await shot('retry-report')

  // Tramo 2 — árbol sucio: la tarea queda pending y el hilo ofrece "Commit & Run".
  writeFileSync(join(projectRoot, 'sucio.txt'), 'sin commitear\n')
  const knownIds = new Set((await tasksFor(api, project.id)).map((item) => item.id))
  await composer.fill(
    'Modifica nota.ts para añadir al final la línea "export const sucio = 2". La única ruta de salida es nota.ts.',
  )
  await composer.press('Enter')
  const secondCard = page.getByText('Task ready to run', { exact: true }).last()
  const secondCardVisible = await visible(secondCard, 180_000)
  await step('second held task card visible', secondCardVisible, 'held task rendered')
  if (!secondCardVisible) return
  const dirtyTask = (await tasksFor(api, project.id)).find(
    (item) => item.status === 'pending' && !knownIds.has(item.id),
  )
  await step('second task id obtained', Boolean(dirtyTask), dirtyTask?.id ?? 'task id unavailable')
  if (!dirtyTask) return
  await page.getByRole('button', { name: /^Approve & Run$/i }).click()
  const blocked = await waitForTask(
    api,
    project.id,
    dirtyTask.id,
    (item) =>
      item.status === 'pending' &&
      String(item.retryReason ?? '').startsWith('uncommitted changes: '),
    2 * 60_000,
  )
  await step(
    'dirty tree leaves the task pending with the uncommitted-changes reason',
    blocked?.status === 'pending' &&
      String(blocked.retryReason ?? '').startsWith('uncommitted changes: '),
    `status=${blocked?.status ?? 'missing'} retryReason=${blocked?.retryReason ?? 'missing'}`,
  )
  if (!blocked) return
  const dirtyTitle = page.getByText('Uncommitted changes', { exact: true }).last()
  const dirtyShown = await visible(dirtyTitle, 60_000)
  const fileShown = await visible(page.getByText('sucio.txt', { exact: true }).last(), 10_000)
  await step(
    'thread lists the uncommitted file without reload',
    dirtyShown && fileShown,
    `title=${dirtyShown} sucio.txt=${fileShown}`,
  )
  const dirtyApprove = page.getByRole('button', { name: /^Approve & Run$/i })
  await step(
    'dirty task held card is hidden',
    (await dirtyApprove.count()) === 0,
    `Approve & Run buttons visible=${await dirtyApprove.count()}`,
  )
  await shot('dirty-tree-report')
  const commitRun = page.getByRole('button', { name: /^Commit & Run$/i })
  if (!(await visible(commitRun))) {
    await step('Commit & Run button visible', false, 'button missing')
    return
  }
  await commitRun.click()
  const finished = await waitForTask(
    api,
    project.id,
    dirtyTask.id,
    (item) => item.status === 'done',
    10 * 60_000,
  )
  const subject = execFileSync(
    'git',
    ['log', '--grep=chore: commit pending changes', '-1', '--format=%s'],
    { cwd: projectRoot, encoding: 'utf8' },
  ).trim()
  const porcelain = execFileSync('git', ['status', '--porcelain'], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
  await step(
    'Commit & Run commits the file with the dashboard message',
    subject.startsWith('chore: commit pending changes before '),
    subject || 'no matching commit',
  )
  await step(
    'sucio.txt is no longer listed as uncommitted',
    !porcelain.split('\n').some((line) => line.includes('sucio.txt')),
    porcelain.trim() || 'clean',
  )
  await step(
    'relaunched task finishes done',
    finished?.status === 'done',
    finished?.status ?? 'missing',
  )
  if (finished?.status !== 'done') return
  const secondDone = page.getByText(new RegExp(`✓ Task\\s*${dirtyTask.id}\\s*done`)).first()
  await step(
    'done report of the relaunched task appears without reload',
    await visible(secondDone, 90_000),
    (await secondDone.innerText().catch(() => 'report not visible')).trim(),
  )
  await shot('commit-run-report')
}
