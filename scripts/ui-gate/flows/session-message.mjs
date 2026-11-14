import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { run, writeGateRoles } from '../lib.mjs'

export default async function sessionMessage({ page, api, step, shot, cleanup, restartDashboard }) {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-session-message-'))
  const claude = join(root, 'claude')
  const targetFile = join(root, 'target.txt')
  writeFileSync(
    claude,
    `#!/bin/sh
case "$1" in
--version) echo "Claude fixture 1.2.3"; exit 0;;
--help) printf '  --restricted  Restrict file access to the project\\n'; exit 0;;
auth) echo '{"loggedIn":true,"authMethod":"fixture"}'; exit 0;;
esac
cat > ${JSON.stringify(join(root, 'last-stdin.txt'))}
target=$(cat ${JSON.stringify(targetFile)})
printf '%s\\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"msg1","name":"mcp__orchestos__message_session","input":{"session_id":"'"$target"'","content":"Please review the last commit."}}]}}'
cat <<'EVENTS'
{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"msg1","content":"Message proposed."}]}}
{"type":"assistant","message":{"content":[{"type":"text","text":"Review message proposed."}]}}
{"type":"result","subtype":"success","is_error":false,"session_id":"session-message-fixture","duration_ms":1,"num_turns":1,"total_cost_usd":0,"usage":{"input_tokens":10,"output_tokens":4}}
EVENTS
`,
    { mode: 0o755 },
  )
  const preload = join(root, 'probe.ts')
  writeFileSync(
    preload,
    `
import { systemCliDiscoveryProbe } from ${JSON.stringify(resolve('src/run/executors/cli-discovery.ts'))}
import { systemCliHealthProbe } from ${JSON.stringify(resolve('src/run/executors/cli-health.ts'))}
process.env.PATH = ${JSON.stringify(root)} + ':' + process.env.PATH
for (const probe of [systemCliDiscoveryProbe, systemCliHealthProbe]) {
  const original = probe.which
  probe.which = (binary, path) => binary === 'claude' ? ${JSON.stringify(claude)} : original(binary, path)
}
`,
  )
  const previousOptions = process.env.BUN_OPTIONS
  cleanup(async () => {
    if (previousOptions === undefined) delete process.env.BUN_OPTIONS
    else process.env.BUN_OPTIONS = previousOptions
    await restartDashboard()
    rmSync(root, { recursive: true, force: true })
  })
  process.env.BUN_OPTIONS = `${previousOptions ?? ''} --preload=${preload}`.trim()
  await restartDashboard()
  const projectRoot = join(root, 'project')
  mkdirSync(projectRoot)
  writeFileSync(join(projectRoot, 'README.md'), '# Session message gate\n')
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
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', projectRoot], process.cwd())
  writeGateRoles(projectRoot)
  const project = (await api('/api/projects')).data.find((row) => row.path === projectRoot)
  if (!project) throw new Error('fixture project missing')
  cleanup(async () => {
    const purged = await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, {
      method: 'POST',
    })
    if (!purged.ok) throw new Error(`purge failed: ${JSON.stringify(purged)}`)
    const remaining = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
    if (!remaining.ok || remaining.data.length)
      throw new Error('fixture sessions remain after purge')
  })
  const sessions = []
  for (const title of ['Message source A', 'Message destination B']) {
    const created = await api('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-orchestos-project-id': project.id },
      body: JSON.stringify({ agent: 'claude', mode: 'code', projectId: project.id, title }),
    })
    if (!created.ok) throw new Error(JSON.stringify(created))
    sessions.push(created.data)
  }
  writeFileSync(targetFile, sessions[1].id)
  const timeline = async (index) => {
    const response = await api(
      `/api/chat/sessions/${sessions[index].id}/timeline?project=${encodeURIComponent(project.id)}`,
    )
    if (!response.ok) throw new Error(JSON.stringify(response))
    return response.data
  }
  const open = async (index) => {
    await page.evaluate(
      ({ projectId, sessionId }) => {
        localStorage.setItem('orchestos-last-dev', JSON.stringify({ projectId, sessionId }))
        localStorage.removeItem('orchestos-dev-tabs')
        localStorage.removeItem('orchestos-dev-session-tabs')
        localStorage.removeItem('orchestos-dev-file-tabs')
      },
      { projectId: project.id, sessionId: sessions[index].id },
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await page.locator(`[data-session-tab="${sessions[index].id}"]`).waitFor()
  }
  const send = async () => {
    const composer = page.locator('textarea').last()
    const sendButton = page.getByRole('button', { name: 'Send message', exact: true }).last()
    await composer.fill('Pass a review request to the other session.')
    await sendButton.waitFor()
    const deadline = Date.now() + 30000
    while (!(await sendButton.isEnabled()) && Date.now() < deadline) await page.waitForTimeout(100)
    const completed = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/chat',
      { timeout: 180000 },
    )
    await composer.press('Enter')
    const response = await completed
    if (!response.ok()) throw new Error(`/api/chat ${response.status()}: ${await response.text()}`)
  }
  const before = await timeline(1)
  await open(0)
  await send()
  const card = page.locator('[data-session-message-card]').last()
  await card.getByRole('button', { name: 'Approve', exact: true }).waitFor()
  await step(
    'source shows explicit approval card',
    (await card.innerText()).includes('Message to «Message destination B»'),
    await card.innerText(),
  )
  await shot('session-message-pending')
  await card.getByRole('button', { name: 'Approve', exact: true }).click()
  await card.getByText('Sent', { exact: true }).waitFor()
  await open(1)
  const inbound = page.locator('[data-inbound-session-message]')
  await inbound.waitFor()
  const delivered = await timeline(1)
  await step(
    'approval delivers visible data without starting a destination turn',
    // La sesión de origen toma como título su primer mensaje: se compara con el que guarda el servidor.
    delivered.events.some((event) => event.kind === 'session-message' && !!event.fromTitle) &&
      (await inbound.innerText()).includes(
        `Message from «${delivered.events.find((event) => event.kind === 'session-message').fromTitle}»`,
      ) &&
      delivered.turns.length === before.turns.length &&
      delivered.messages.length === before.messages.length &&
      !delivered.pending,
    JSON.stringify(delivered),
  )
  await shot('session-message-delivered')
  await open(0)
  await send()
  const discarded = page.locator('[data-session-message-card]').last()
  await discarded.getByRole('button', { name: 'Discard', exact: true }).click()
  await discarded.getByText('Discarded', { exact: true }).waitFor()
  const afterDiscard = await timeline(1)
  await step(
    'discard keeps message out of destination',
    afterDiscard.events.filter((row) => row.kind === 'session-message').length === 1 &&
      (await discarded.getByRole('button').count()) === 0,
    await discarded.innerText(),
  )
  await shot('session-message-discarded')
}
