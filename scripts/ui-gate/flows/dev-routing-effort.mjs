import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run } from '../lib.mjs'

export default async function devRoutingEffort({ page, api, step, shot, cleanup, databasePath }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-uso44-'))
  let projectId
  cleanup(async () => {
    if (projectId) {
      const purged = await api(`/api/projects/${encodeURIComponent(projectId)}/purge`, {
        method: 'POST',
      })
      if (!purged.ok) throw new Error('USO.44 fixture purge failed')
      const sessions = await api(`/api/chat/sessions?project=${encodeURIComponent(projectId)}`)
      const projects = await api('/api/projects')
      if (sessions.data.length || projects.data.some((row) => row.id === projectId))
        throw new Error('USO.44 fixture residue')
    }
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })
  writeFileSync(join(projectRoot, 'README.md'), '# USO.44\n')
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
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', projectRoot], process.cwd())
  writeFileSync(
    join(projectRoot, 'orchestos.config.yaml'),
    [
      'config_version: 1',
      'roles:',
      ...['orchestrator', 'executor', 'reviewer', 'auxiliary'].flatMap((role) => [
        `  ${role}:`,
        '    agent: claude',
        '    model: claude-opus-5-5',
        '    effort: medium',
      ]),
      'models: {}',
      '',
    ].join('\n'),
  )
  const project = (await api('/api/projects')).data.find((row) => row.path === projectRoot)
  if (!project) throw new Error('USO.44 fixture not registered')
  projectId = project.id
  const session = await api('/api/chat/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-orchestos-project-id': projectId },
    body: JSON.stringify({ projectId, agent: 'claude', mode: 'code', title: 'USO44 existing' }),
  })
  if (!session.ok) throw new Error('USO.44 session not created')
  const sessionId = session.data.id
  execFileSync(
    'bun',
    [
      '-e',
      `import { Database } from 'bun:sqlite'
      const db = new Database(process.argv[1])
      const [sessionId, projectId] = process.argv.slice(2)
      const now = new Date().toISOString(), turn = crypto.randomUUID()
      db.run("INSERT INTO chat_turns (id, session_id, project_id, request_key, input_fingerprint, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)", [turn, sessionId, projectId, turn, 'fixture', now, now])
      db.run('INSERT INTO chat_messages (session_id, role, content, turn_id, model, created_at) VALUES (?, ?, ?, ?, ?, ?)', [sessionId, 'assistant', 'USO44 previous high turn', turn, 'claude-opus-5-5 via Claude Code CLI (effort: high)', now])
      db.close()`,
      databasePath,
      sessionId,
      projectId,
    ],
    { stdio: 'pipe' },
  )
  const sessions = (await api(`/api/chat/sessions?project=${projectId}`)).data
  const existing = sessions.find((row) => row.id === sessionId)
  await step(
    'existing Dev session has a previous high turn',
    existing?.lastEffort === 'high',
    JSON.stringify(existing),
  )
  await page.evaluate(
    ({ projectId, sessionId }) => {
      localStorage.setItem('orchestos-last-dev', JSON.stringify({ projectId, sessionId }))
      localStorage.removeItem('orchestos-dev-session-tabs')
    },
    { projectId, sessionId },
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await projectButton.click()
  await page.getByText('USO44 previous high turn', { exact: true }).waitFor()
  const control = page.locator('[data-composer-region] button.font-mono:not([aria-label])').last()
  await page.waitForFunction(() =>
    [
      ...document.querySelectorAll('[data-composer-region] button.font-mono:not([aria-label])'),
    ].some((button) => button.textContent.trim().endsWith('· medium')),
  )
  await step(
    'existing session starts with routing medium',
    (await control.innerText()).trim().endsWith('· medium'),
  )
  await shot('existing-routing-medium')
  await page.getByText('USO44 previous high turn', { exact: true }).click()
  await projectButton.click()
  await page.waitForTimeout(1000)
  await step(
    'thread and sidebar clicks preserve medium',
    (await control.innerText()).trim().endsWith('· medium'),
  )
  await shot('clicks-preserve-medium')
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/chat',
    { timeout: 240_000 },
  )
  const box = page.locator('[data-composer-region] textarea').last()
  await box.fill('responde solo: ok')
  await box.press('Enter')
  const completed = await response
  await completed.finished()
  const body = completed.request().postDataJSON()
  const after = (await api(`/api/chat/sessions?project=${projectId}`)).data.find(
    (row) => row.id === sessionId,
  )
  await step(
    'POST sends medium and completed session persists medium',
    completed.ok() && body.effort === 'medium' && after?.lastEffort === 'medium',
    JSON.stringify({ status: completed.status(), body, session: after }),
  )
  await shot('completed-medium-turn')
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Launch agent' })
    .getByRole('option', { name: 'Claude', exact: true })
    .click()
  await page.locator('[data-new-session-tab][aria-selected="true"]').waitFor()
  await control.filter({ hasText: /· medium\s*$/ }).waitFor()
  await step(
    'new session tab starts with routing medium',
    (await control.innerText()).trim().endsWith('· medium'),
  )
}
