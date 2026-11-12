import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { stringify } from 'yaml'
import { run, writeGateRoles } from '../lib.mjs'

// Deterministic persisted fixtures; no model is invoked by this flow.
export default async function aud25Ui({
  page,
  api,
  step,
  shot,
  cleanup,
  databasePath,
  expectHttpError,
}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'orchestos-aud25-')))
  mkdirSync(join(root, 'parent'))
  writeFileSync(join(root, 'parent/needle.txt'), 'AUD25_CONTENT_SENTINEL\n')
  writeFileSync(join(root, 'README.md'), '# AUD.25\n')
  writeFileSync(join(root, '.gitignore'), '.orchestos/\n')
  run('git', ['init', '-q'], root)
  run('git', ['add', '.'], root)
  run(
    'git',
    ['-c', 'user.name=Gate', '-c', 'user.email=gate@example.invalid', 'commit', '-qm', 'fixture'],
    root,
  )
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', root], process.cwd())
  writeGateRoles(root)
  writeFileSync(
    join(root, 'tasks.yaml'),
    stringify({
      version: 1,
      project: basename(root),
      tasks: ['failed', 'pending'].map((status) => ({
        id: `aud25-${status}`,
        description: `AUD25 ${status}`,
        status,
        input: [],
        output: ['README.md'],
        depends_on: [],
        retry_count: 0,
        acceptance_criteria: [`README.md exists (${status})`],
      })),
    }),
  )
  const project = (await api('/api/projects')).data.find((row) => row.path === root)
  if (!project) throw new Error('AUD25 fixture not registered')
  let purgedInFlow = false
  cleanup(async () => {
    if (!purgedInFlow) {
      const purged = await api(`/api/projects/${project.id}/purge`, { method: 'POST' })
      if (!purged.ok) throw new Error('AUD25 fixture purge failed')
    }
    const sessions = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
    if (
      sessions.data.length ||
      (await api('/api/projects')).data.some((row) => row.id === project.id)
    )
      throw new Error('AUD25 fixture residue')
    rmSync(root, { recursive: true, force: true })
  })
  const headers = () => ({
    'content-type': 'application/json',
    'x-orchestos-project-id': project.id,
  })
  const session = await api('/api/chat/sessions', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      projectId: project.id,
      agent: 'codex',
      mode: 'code',
      title: 'AUD25 tools',
    }),
  })
  if (!session.ok) throw new Error('AUD25 session not created')
  // Store more than the previous three reads, one edit and one command per exit state.
  execFileSync(
    'bun',
    [
      '-e',
      `
    import { Database } from 'bun:sqlite'
    const db = new Database(process.argv[1])
    const [sessionId, projectId] = process.argv.slice(2)
    const now = new Date().toISOString(), turn = crypto.randomUUID()
    db.run("INSERT INTO chat_turns (id, session_id, project_id, request_key, input_fingerprint, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)", [turn, sessionId, projectId, turn, 'fixture', now, now])
    for (const [role, content] of [['user', 'AUD25 tools'], ['assistant', 'AUD25 completed']])
      db.run('INSERT INTO chat_messages (session_id, role, content, turn_id, created_at) VALUES (?, ?, ?, ?, ?)', [sessionId, role, content, turn, now])
    const tools = [
      ...Array.from({ length: 5 }, (_, i) => ['read', 'aud25-read-' + i, null, null]),
      ...Array.from({ length: 3 }, (_, i) => ['edit', 'aud25-edit-' + i, null, null]),
      ...Array.from({ length: 4 }, (_, i) => ['command', null, 'echo aud25-command-' + i, i % 2]),
    ]
    tools.forEach(([tool, target, detail, exit], seq) => db.run('INSERT INTO chat_turn_steps (session_id, turn_id, seq, type, tool, target, detail, exit_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [sessionId, turn, seq, 'tool_use', tool, target, detail, exit, now]))
    const a = crypto.randomUUID(), b = crypto.randomUUID()
    for (const [id, content] of [[a, 'AUD25 original'], [b, 'AUD25 conflicting']])
      db.run('INSERT INTO memory_entries (id, project_id, topic_key, scope, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, projectId, id, 'project', content, now, now])
    db.run('INSERT INTO memory_conflicts (id, entry_a_id, entry_b_id, relation, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), a, b, 'contradiction', 'high', now])
    db.close()
  `,
      databasePath,
      session.data.id,
      project.id,
    ],
    { stdio: 'pipe' },
  )
  await page.evaluate(
    ({ projectId, sessionId }) => {
      localStorage.setItem('orchestos-last-dev', JSON.stringify({ projectId, sessionId }))
      localStorage.setItem('orchestos-chat', JSON.stringify({ confirmArchive: true }))
    },
    { projectId: project.id, sessionId: session.data.id },
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  const dev = async () => {
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await page.getByRole('button', { name: basename(root), exact: true }).click()
  }
  const settings = async (tab) => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page
      .locator('[data-project-tab]')
      .filter({ hasText: new RegExp(`^${tab}$`) })
      .click()
  }
  await dev()
  await page.getByText('AUD25 completed', { exact: true }).waitFor()
  const read = page.getByRole('button').filter({ hasText: /Read\s*5 files/ })
  await read.click()
  await step(
    '8: Dev shows every read, edit and command',
    (await page.getByText('aud25-read-4', { exact: true }).isVisible()) &&
      (await page.getByText('aud25-edit-2', { exact: true }).isVisible()) &&
      (await page.getByText('echo aud25-command-2', { exact: true }).isVisible()) &&
      (await page.getByText('echo aud25-command-3', { exact: true }).isVisible()),
  )

  // 1: typing the prefix through the keyboard exercises the actual shell-mode transition.
  const composer = page.locator('[data-composer-region] textarea')
  await composer.fill('')
  await composer.pressSequentially('!')
  await composer.pressSequentially('echo AUD25_PTY_SENTINEL')
  await page.getByRole('button', { name: 'Send message', exact: true }).click()
  const terminal = page.getByRole('region', { name: 'Project terminal' })
  await terminal.waitFor()
  await page.waitForFunction(
    () =>
      (document.querySelector('.xterm-rows')?.textContent.match(/AUD25_PTY_SENTINEL/g) ?? [])
        .length >= 2,
  )
  await step(
    '1: !command opens the terminal and executes through PTY',
    (await terminal.innerText()).includes('AUD25_PTY_SENTINEL'),
  )
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  const chatComposer = page.locator('[data-composer-region] textarea').last()
  await chatComposer.fill('')
  await chatComposer.pressSequentially('!echo literal')
  await step(
    '1: Chat keeps ! as ordinary text',
    (await chatComposer.inputValue()) === '!echo literal',
  )
  await chatComposer.fill('')
  await dev()

  // 7: the ancestor does not match the name; content mode matches text absent from the name.
  const search = page.getByPlaceholder('Find files', { exact: true })
  await search.fill('needle')
  const needle = page.locator('[data-explorer-file="parent/needle.txt"]')
  await needle.waitFor()
  await step(
    '7: name search reveals a matching descendant under a nonmatching parent',
    await needle.isVisible(),
  )
  await page.getByRole('button', { name: 'Search file contents', exact: true }).click()
  const searched = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === '/api/explorer/search' &&
      new URL(res.url()).searchParams.get('q') === 'AUD25_CONTENT_SENTINEL',
  )
  await search.fill('AUD25_CONTENT_SENTINEL')
  const matches = await (await searched).json()
  await needle.waitFor()
  await step(
    '7: content search uses scoped endpoint and renders matching files',
    matches.paths.includes('parent/needle.txt') && (await needle.isVisible()),
  )
  await search.fill('')

  await settings('Plan')
  const failed = page.getByText('aud25-failed', { exact: true })
  await failed.waitFor()
  await step(
    '2: failed task appears in the Failed lane',
    (await failed.isVisible()) && (await page.getByText('Failed', { exact: true }).isVisible()),
  )
  for (const id of ['aud25-failed', 'aud25-pending']) {
    const card = page.getByText(id, { exact: true }).locator('..').locator('..')
    const response = page.waitForResponse(
      (res) => new URL(res.url()).pathname === `/api/tasks/${id}/explain`,
    )
    await card.getByRole('button', { name: 'Plan', exact: true }).click()
    const result = await response
    await page.getByText('Dry-Run Verification', { exact: true }).waitFor()
    await step(
      `3: Plan loads the current task ${id}`,
      result.ok() && (await page.getByText(`Task ID: ${id}`, { exact: true }).isVisible()),
    )
    await page.getByRole('button', { name: 'Close', exact: true }).click()
  }

  // 9: explicit HTTP failure; assert the draft remains, then let the real endpoint save it.
  await page
    .locator('[data-project-tab]')
    .filter({ hasText: /^Instincts$/ })
    .click()
  await page.getByRole('button', { name: 'Add Manual Instinct', exact: true }).click()
  await page.getByLabel('Trigger Pattern', { exact: true }).fill('AUD25 trigger')
  await page
    .getByLabel('Learned Action / Behavior to Enforce', { exact: true })
    .fill('AUD25 action')
  expectHttpError(/\/api\/instincts$/)
  const rejectInstinct = async (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 500, json: { error: 'AUD25 save rejected' } })
      : route.continue()
  await page.route('**/api/instincts', rejectInstinct)
  await page.getByRole('button', { name: 'Register Instinct', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'AUD25 save rejected' }).waitFor()
  await step(
    '9: failed instinct save keeps the form, text and error',
    (await page.getByLabel('Trigger Pattern').inputValue()) === 'AUD25 trigger',
  )
  await page.unroute('**/api/instincts', rejectInstinct)
  await page.getByRole('button', { name: 'Register Instinct', exact: true }).click()
  await page.getByLabel('Trigger Pattern').waitFor({ state: 'hidden' })
  await step(
    '9: successful instinct save persists before closing',
    (await api('/api/instincts', { headers: headers() })).data.some(
      (row) => row.trigger === 'AUD25 trigger',
    ),
  )
  await page
    .locator('[data-project-tab]')
    .filter({ hasText: /^Memory$/ })
    .click()
  await page
    .getByRole('button', { name: 'Open Synthesis & Resolution Wizard', exact: true })
    .first()
    .click()
  const resolution = page.locator('form textarea')
  await resolution.fill('AUD25 resolution')
  expectHttpError(/\/api\/memory\/conflicts\/[^/]+\/resolve$/)
  const rejectMemory = async (route) =>
    route.fulfill({ status: 500, json: { error: 'AUD25 resolution rejected' } })
  await page.route('**/api/memory/conflicts/*/resolve', rejectMemory)
  await page.getByRole('button', { name: 'Commit Authoritative Resolution', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'AUD25 resolution rejected' }).waitFor()
  await step(
    '9: failed memory save keeps the resolution and error',
    (await resolution.inputValue()) === 'AUD25 resolution',
  )
  await page.unroute('**/api/memory/conflicts/*/resolve', rejectMemory)
  await page.getByRole('button', { name: 'Commit Authoritative Resolution', exact: true }).click()
  await resolution.waitFor({ state: 'hidden' })

  await page.getByRole('button', { name: 'Model routing', exact: true }).click()
  await page.getByText('Loading live settings…', { exact: true }).waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: /Task rules/ }).click()
  await page.getByRole('button', { name: 'Add rule', exact: true }).click()
  await page.getByLabel('rule agent', { exact: true }).click()
  await page.getByRole('button', { name: 'Codex', exact: true }).last().click()
  await page.getByLabel('rule model', { exact: true }).click()
  // El disparador ya muestra "Executor model" (modelo vacío); la opción del desplegable es la última.
  await page.getByRole('button', { name: 'Executor model', exact: true }).last().click()
  const saved = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/config' && res.request().method() === 'PUT',
  )
  await page.getByLabel('output globs', { exact: true }).fill('README.md')
  await page.getByLabel('output globs', { exact: true }).blur()
  await saved
  const config = (await api('/api/config', { headers: headers() })).data
  await step(
    '5: Executor model rule saves an empty model for the executor agent',
    config.taskAgentRules.some(
      (rule) => rule.agent === 'codex' && !rule.model && rule.match.output.includes('README.md'),
    ),
  )

  await page.getByRole('button', { name: 'Back to app', exact: true }).click()
  // Exercise the shared ConfirmDialog through the archive action, not the separate purge modal.
  await dev()
  const sessionRow = page.locator(`[data-thread-id="${session.data.id}"]`).locator('..')
  await sessionRow.hover()
  const agentRow = sessionRow.getByRole('button', { name: 'Close agent', exact: true })
  await agentRow.click()
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true })
  await cancel.focus()
  await cancel.press('Enter')
  await cancel.waitFor({ state: 'hidden' })
  const kept = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
  await step(
    '6: Enter on Cancel cancels archive without confirming',
    kept.data.some((row) => row.id === session.data.id),
  )
  await settings('General')
  await page
    .getByRole('button', { name: 'Borrar definitivamente los datos del proyecto', exact: true })
    .click()
  const purged = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === `/api/projects/${project.id}/purge` &&
      res.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Yes, Purge Permanently', exact: true }).click()
  await purged
  await page.getByRole('button', { name: 'Back to app', exact: true }).waitFor({ state: 'hidden' })
  // La purga quita el registro; volver a añadirlo desde la UI exige el selector de carpetas nativo, así que
  // que el set `purgingProjectIds` se limpie lo prueba el test unitario. Aquí: la purga termina bien en vivo.
  purgedInFlow = true
  await step(
    '4: successful purge leaves the app usable and the project out of the sidebar',
    !(await api('/api/projects')).data.some((row) => row.id === project.id) &&
      (await page.getByRole('button', { name: basename(root), exact: true }).count()) === 0,
  )
  await shot('aud25-after-purge')
}
