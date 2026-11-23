import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run } from '../lib.mjs'

// USO.44/45/46 — turno con la forma real del mensaje 735 (informe largo → herramienta → cierre):
// Copy entrega el markdown entero, el informe se selecciona con el mouse en Chat y Dev, y el effort
// elegido sobrevive a clics fuera del selector.
const REPORT = [
  '# Informe de cierre',
  '',
  'Primer párrafo con **negrita** y `código`.',
  '',
  '## Pasos',
  '',
  '1. Leer el plan',
  '2. Escribir el test',
  '3. Correr el gate',
  '',
  '- punto uno',
  '- punto dos',
  '',
  '```ts',
  'const answer = 42',
  '```',
  '',
  ...Array.from({ length: 30 }, (_, i) => `${i + 4}. Línea número ${i + 4} del informe.`),
].join('\n')
const CLOSING =
  'Dejé la lección propuesta.\n\n## Qué haría ahora\n\n1. Revisar el log\n2. Reintentar'
const CONTENT = `${REPORT}\n\n${CLOSING}`

function seed(databasePath, sessionId, projectId) {
  execFileSync(
    'bun',
    [
      '-e',
      `
    import { Database } from 'bun:sqlite'
    const db = new Database(process.argv[1])
    const [sessionId, projectId, report, closing, content] = process.argv.slice(2)
    const now = new Date().toISOString(), turn = crypto.randomUUID()
    db.run("INSERT INTO chat_turns (id, session_id, project_id, request_key, input_fingerprint, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)", [turn, sessionId, projectId || null, turn, 'fixture', now, now])
    for (const [role, body] of [['user', 'Dame el informe'], ['assistant', content]])
      db.run('INSERT INTO chat_messages (session_id, role, content, turn_id, created_at) VALUES (?, ?, ?, ?, ?)', [sessionId, role, body, turn, now])
    const steps = [['text', null, report], ['tool_use', 'mcp__orchestos__propose_lesson', null], ['text', null, closing], ['step_finish', 'step_finish', null]]
    steps.forEach(([type, tool, detail], seq) => db.run('INSERT INTO chat_turn_steps (session_id, turn_id, seq, type, tool, detail, ok, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [sessionId, turn, seq, type, tool, detail, type === 'tool_use' ? 1 : null, now]))
    db.close()
  `,
      databasePath,
      sessionId,
      projectId ?? '',
      REPORT,
      CLOSING,
      CONTENT,
    ],
    { stdio: 'pipe' },
  )
}

async function dragSelect(page, from, to) {
  await from.scrollIntoViewIfNeeded()
  const a = await from.boundingBox()
  const b = await to.boundingBox()
  if (!a || !b) return ''
  await page.mouse.move(a.x + 1, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width - 1, b.y + b.height / 2, { steps: 15 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  return await page.evaluate(() => String(window.getSelection() ?? ''))
}

async function checkAnswer(page, step, shot, view, root) {
  const message = root
    .locator('[data-entered], [data-dev-assistant-message]')
    .filter({ hasText: 'Qué haría ahora' })
    .last()
  await message.waitFor({ timeout: 15_000 })
  await shot(`${view}-answer`)

  // USO.45 — Copy entrega el turno entero en markdown, también la parte plegada en la actividad.
  await message.scrollIntoViewIfNeeded()
  await message.hover()
  await page.evaluate(() => navigator.clipboard.writeText(''))
  await message.getByRole('button', { name: 'Copy', exact: true }).last().click()
  await page.waitForTimeout(300)
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  await step(
    `USO.45 ${view}: Copy delivers the full markdown`,
    copied === CONTENT,
    `copied ${copied.length}/${CONTENT.length} chars; head ${JSON.stringify(copied.slice(0, 40))}`,
  )

  // USO.46 — arrastrar sobre el informe (título → lista) lo selecciona sin abrir ni plegar nada.
  const heading = root.getByText('Informe de cierre', { exact: true }).first()
  const item = root.getByText('Escribir el test', { exact: true }).first()
  const url = page.url()
  const selected = await dragSelect(page, heading, item)
  await shot(`${view}-selected`)
  await step(
    `USO.46 ${view}: dragging over the answer selects heading to list`,
    selected.includes('Informe de cierre') &&
      selected.includes('Escribir el test') &&
      page.url() === url &&
      (await heading.isVisible()),
    `selection ${JSON.stringify(selected.slice(0, 80))}`,
  )
}

async function checkEffort(page, step, shot, view) {
  // USO.44 — el effort elegido sobrevive al cerrar el selector con clics fuera.
  const control = page.locator('[data-composer-region] button.font-mono:not([aria-label])').last()
  await control.click()
  const selector = page.getByRole('dialog', { name: 'Model and effort selector' })
  await selector.waitFor({ timeout: 10_000 })
  const buttons = selector
    .locator('button')
    .filter({ hasText: /^(minimal|low|medium|high|xhigh|max)$/i })
  const efforts = (await buttons.allInnerTexts()).map((e) => e.trim())
  const before = await control.innerText()
  const target = efforts.find((e) => !before.toLowerCase().endsWith(`· ${e.toLowerCase()}`))
  if (!target) throw new Error(`no alternate effort: ${JSON.stringify({ efforts, before })}`)
  await buttons.filter({ hasText: new RegExp(`^${target}$`, 'i') }).click()
  const chosen = await control.innerText()
  await page.getByText('Escribir el test', { exact: true }).first().click()
  await page.waitForTimeout(500)
  const afterAnswer = await control.innerText()
  await page.mouse.click(5, 500)
  await page.waitForTimeout(500)
  const afterSide = await control.innerText()
  await shot(`${view}-effort-after-outside-click`)
  await step(
    `USO.44 ${view}: chosen effort survives outside clicks`,
    chosen.toLowerCase().endsWith(target.toLowerCase()) &&
      afterAnswer === chosen &&
      afterSide === chosen,
    JSON.stringify({ efforts, target, before, chosen, afterAnswer, afterSide }),
  )
}

export default async function chatAnswerActions({ page, api, step, shot, databasePath, cleanup }) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

  const chatTitle = 'USO45 chat answer'
  const chat = await api('/api/chat/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ agent: 'codex', mode: 'chat', title: chatTitle }),
  })
  if (!chat.ok) throw new Error(`chat session not created: ${JSON.stringify(chat.data)}`)
  cleanup(() =>
    api(`/api/chat/sessions/${encodeURIComponent(chat.data.id)}?project=none`, {
      method: 'DELETE',
    }),
  )
  seed(databasePath, chat.data.id, null)

  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-uso45-'))
  let projectId
  cleanup(async () => {
    if (projectId)
      await api(`/api/projects/${encodeURIComponent(projectId)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })
  writeFileSync(join(projectRoot, 'README.md'), '# USO.45\n')
  run('git', ['init', '-q'], projectRoot)
  run('git', ['add', 'README.md'], projectRoot)
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
  const project = ((await api('/api/projects')).data ?? []).find(
    (item) => item.path === projectRoot,
  )
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  projectId = project.id
  const dev = await api('/api/chat/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-orchestos-project-id': projectId },
    body: JSON.stringify({ projectId, agent: 'codex', mode: 'code', title: 'USO45 dev answer' }),
  })
  if (!dev.ok) throw new Error(`dev session not created: ${JSON.stringify(dev.data)}`)
  seed(databasePath, dev.data.id, projectId)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByText(chatTitle, { exact: true }).first().click()
  await checkAnswer(page, step, shot, 'chat', page.locator('body'))
  await checkEffort(page, step, shot, 'chat')

  await page.evaluate(
    ({ projectId: p, sessionId }) =>
      localStorage.setItem('orchestos-last-dev', JSON.stringify({ projectId: p, sessionId })),
    { projectId, sessionId: dev.data.id },
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.getByRole('button', { name: basename(projectRoot), exact: true }).click()
  await checkAnswer(page, step, shot, 'dev', page.locator('main'))
  await checkEffort(page, step, shot, 'dev')
}
