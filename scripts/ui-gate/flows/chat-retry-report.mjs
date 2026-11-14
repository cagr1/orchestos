import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { run, writeGateRoles } from '../lib.mjs'

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

export default async function chatRetryReport({ page, api, step, shot, visible, cleanup, runDir }) {
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
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const launchProject = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await launchProject.hover()
  await launchProject
    .locator('..')
    .getByRole('button', { name: 'Launch new agent', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  const codex = dialog.getByRole('button', { name: /Codex/ }).first()
  await step('select Codex for new chat', await visible(codex), 'Codex option visible')
  if (!(await codex.isVisible())) return
  await codex.click()
  await page.getByRole('button', { name: 'Launch Agent', exact: true }).click()

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
  async function checkAssistantParagraphs(turn) {
    const bubble = page.locator('div.prose').last()
    const text = await bubble.innerText()
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length >= 40)
    const duplicates = paragraphs.filter(
      (paragraph, index) => paragraphs.indexOf(paragraph) < index,
    )
    let evidencePath
    if (duplicates.length > 0) {
      evidencePath = join(runDir, `assistant-duplicate-paragraph-turn${turn}.json`)
      const messages = await api(`/api/chat/sessions/${encodeURIComponent(session.id)}/messages`, {
        headers: { 'x-orchestos-project-id': project.id },
      })
      writeFileSync(
        evidencePath,
        JSON.stringify(
          {
            turn,
            text,
            innerHTML: await bubble.innerHTML(),
            duplicates,
            messages,
            chatTurnLines: readFileSync(join(runDir, 'dashboard.log'), 'utf8')
              .split('\n')
              .filter((line) => line.includes('[chat-turn]')),
          },
          null,
          2,
        ),
      )
    }
    await step(
      'assistant reply has no duplicated paragraph',
      duplicates.length === 0,
      `turn=${turn} paragraphs=${paragraphs.length} duplicates=${duplicates.length}${evidencePath ? ` evidence=${evidencePath}` : ''}`,
    )
  }
  const composer = page.locator('textarea').last()
  const heldPrompt =
    'Modifica nota.ts para añadir al final la línea "export const gate = 1". La única ruta de salida es nota.ts.'
  const beforeIds = new Set((await tasksFor(api, project.id)).map((task) => task.id))
  const firstTurn = page.waitForResponse(
    (response) => response.request().method() === 'POST' && /\/api\/chat$/.test(response.url()),
    { timeout: 180_000 },
  )
  await composer.fill(heldPrompt)
  await page.getByRole('button', { name: 'Send message', exact: true }).click()
  await (await firstTurn).finished()
  await checkAssistantParagraphs(1)
  const taskCard = page.locator('[data-task-state="held"]').first()
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
  const failedReport = page.locator(`[data-task-id="${taskId}"][data-task-state="failed"]`)
  const reportVisible = await visible(failedReport, 60_000)
  const failedText = (await failedReport.innerText().catch(() => 'report not visible')).trim()
  await step(
    'failed attempt report visible without reload',
    reportVisible && /Attempt 1\/3/.test(failedText),
    failedText,
  )
  const failedMessage = (await messagesFor(api, project.id, session.id, taskId)).at(-1)
  const failedDiagnosis = failedReport.locator('[data-task-diagnosis]')
  const plainSummary = failedReport.getByText(failedMessage?.taskReport?.summary ?? '', {
    exact: true,
  })
  const showsDiagnosis =
    (await visible(failedDiagnosis)) &&
    (await plainSummary.evaluateAll((nodes) =>
      nodes.every((node) => node.closest('[data-task-diagnosis]')),
    ))
  await step('failed attempt shows diagnosis', showsDiagnosis, JSON.stringify(failedMessage))
  await shot('failed-attempt-diagnosis')
  if (!showsDiagnosis) {
    writeFileSync(
      join(runDir, 'failed-attempt-message.json'),
      JSON.stringify(failedMessage, null, 2),
    )
    return
  }
  await step(
    'no uuid text',
    reportVisible && !failedText.includes(taskId),
    `card innerText contains id=${failedText.includes(taskId)}`,
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
  await step(
    'project clean before dirty-tree scenario',
    unexpectedChanges.length === 0,
    cleanStatus || 'clean',
  )

  const latestReport = (await messagesFor(api, project.id, session.id, taskId)).at(-1)?.taskReport
  const diagnosis = latestReport?.diagnosis
  const diagnosisBlock = failedReport.locator('[data-task-diagnosis]')
  await step(
    'failed attempt shows its recorded cause and failed check output',
    Boolean(
      diagnosis?.cause && diagnosis?.failedCheck?.command && diagnosis?.failedCheck?.output,
    ) &&
      (await visible(diagnosisBlock)) &&
      (await diagnosisBlock.innerText()).includes(diagnosis.cause.split('\n')[0]) &&
      (await diagnosisBlock.innerText()).includes(diagnosis.failedCheck.command) &&
      (await diagnosisBlock.locator('pre').first().textContent()).includes(
        diagnosis.failedCheck.output,
      ),
    JSON.stringify(diagnosis),
  )
  const classifiedCause = diagnosisBlock.locator('[data-failure-kind="check"]')
  await step(
    'failed attempt shows its classified cause (AUD.4)',
    diagnosis?.kind === 'check' &&
      (await visible(classifiedCause)) &&
      /check failed/i.test(await classifiedCause.innerText()),
    JSON.stringify({ kind: diagnosis?.kind, classifiedCause: await classifiedCause.innerText() }),
  )
  await step(
    'failed attempt has no Retry or Resume action',
    (await failedReport.getByRole('button', { name: /^(Retry|Resume)$/ }).count()) === 0,
    await failedReport.innerText(),
  )
  const diagnosisText = await diagnosisBlock.innerText()
  await step(
    'diagnosis shows the cause once and removes worktree prefixes',
    (await diagnosisBlock.locator('p.text-app-error').textContent()).trim() ===
      diagnosis?.cause?.split('\n')[0] &&
      (await diagnosisBlock.locator('div.font-mono').count()) === 0 &&
      (await failedReport.getByRole('alert').count()) === 0 &&
      !diagnosisText.includes('/.orchestos/worktrees/') &&
      !diagnosisText.includes('QA:'),
    diagnosisText,
  )
  await shot('failed-task-diagnosis')
  const evidence = failedReport.getByRole('button', { name: 'View evidence', exact: true })
  await step(
    'View evidence offered for the recorded run',
    await visible(evidence),
    diagnosis?.runId ?? 'missing run',
  )
  await evidence.click()
  await step(
    'View evidence opens the selected run in Runs',
    Boolean(diagnosis?.runId) &&
      (await visible(page.getByText(diagnosis.runId, { exact: true }))) &&
      (await visible(page.getByRole('button', { name: 'Back to Runs', exact: true }))),
    diagnosis?.runId ?? 'missing run',
  )
  await page.getByRole('button', { name: 'Back to app', exact: true }).click()

  // Tramo 2 — árbol sucio: la tarea queda pending y el hilo ofrece "Commit & Run".
  writeFileSync(join(projectRoot, 'sucio.txt'), 'sin commitear\n')
  const knownIds = new Set((await tasksFor(api, project.id)).map((item) => item.id))
  const secondTurn = page.waitForResponse(
    (response) => response.request().method() === 'POST' && /\/api\/chat$/.test(response.url()),
    { timeout: 180_000 },
  )
  await composer.fill(
    'Modifica nota.ts para añadir al final la línea "export const sucio = 2". La única ruta de salida es nota.ts.',
  )
  await page.getByRole('button', { name: 'Send message', exact: true }).click()
  await (await secondTurn).finished()
  await checkAssistantParagraphs(2)
  const secondCard = page.locator('[data-task-state="held"]').last()
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
  const dirtyCard = page.locator(`[data-task-id="${dirtyTask.id}"][data-task-state="blocked"]`)
  const dirtyShown = await visible(dirtyCard, 60_000)
  const fileShown = await visible(dirtyCard.getByText('sucio.txt', { exact: true }), 10_000)
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
  const secondDone = page.locator(`[data-task-id="${dirtyTask.id}"][data-task-state="done"]`)
  await step(
    'done report of the relaunched task appears without reload',
    await visible(secondDone, 90_000),
    (await secondDone.innerText().catch(() => 'report not visible')).trim(),
  )
  await shot('commit-run-report')
}
