import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { run, writeGateRoles } from '../lib.mjs'

async function waitForComposerReady(page) {
  const button = page.getByRole('button', { name: 'Send message', exact: true }).last()
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (await button.isEnabled().catch(() => false)) return
    await page.waitForTimeout(100)
  }
  throw new Error('composer stayed busy')
}

async function sendMessage({ page, composer, text, step }) {
  const previousReplyCount = await page.locator('div.prose').count()
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/chat',
    { timeout: 180_000 },
  )
  await composer.fill(text)
  await waitForComposerReady(page)
  await composer.press('Enter')
  const response = await responsePromise
  if (!response.ok())
    throw new Error(
      `/api/chat returned HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`,
    )
  const reply = page.locator('div.prose').nth(previousReplyCount)
  await reply.waitFor({ state: 'visible', timeout: 180_000 })
  const replyText = (await reply.innerText()).trim()
  await step(
    'chat request sent and assistant reply visible',
    replyText.length > 0,
    replyText.slice(0, 200),
  )
  return reply
}

async function instinctsFor(api, projectId) {
  return api(`/api/instincts?project=${encodeURIComponent(projectId)}`)
}

export default async function lessons({
  page,
  api,
  step,
  shot,
  visible,
  cleanup,
  restartDashboard,
  expectHttpError,
  databasePath,
}) {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-ui-lessons-'))
  const claude = join(root, 'claude')
  writeFileSync(
    claude,
    `#!/bin/sh
case "$1" in
--version) echo "Claude fixture 1.2.3"; exit 0;;
--help) printf '  --restricted  Restrict file access to the project\\n'; exit 0;;
auth) echo '{"loggedIn":true,"authMethod":"fixture"}'; exit 0;;
esac
turn=1
while [ -f ${JSON.stringify(join(root, 'turn-'))}"$turn".args ]; do turn=$((turn + 1)); done
printf '%s\\n' "$@" > ${JSON.stringify(join(root, 'turn-'))}"$turn".args
cat > ${JSON.stringify(join(root, 'turn-'))}"$turn".stdin
if [ "$turn" = 1 ]; then
cat <<'EVENTS'
{"type":"assistant","message":{"content":[{"type":"tool_use","id":"l1","name":"mcp__orchestos__propose_lesson","input":{"trigger":"gate trigger auto","action":"gate action auto","why":"gate why"}}]}}
{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"l1","content":"Lesson proposal recorded."}]}}
EVENTS
fi
cat <<'EVENTS'
{"type":"assistant","message":{"content":[{"type":"text","text":"Lesson noted."}]}}
{"type":"result","subtype":"success","is_error":false,"duration_ms":1,"num_turns":1,"total_cost_usd":0,"usage":{"input_tokens":10,"output_tokens":4}}
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
  writeFileSync(join(projectRoot, 'README.md'), '# Lessons gate\n')
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
  const configPath = join(projectRoot, 'orchestos.config.yaml')
  const config = yamlParse(readFileSync(configPath, 'utf8'))
  config.roles.orchestrator = { agent: 'claude', model: 'claude-opus-5-5', effort: 'medium' }
  writeFileSync(configPath, yamlStringify(config))
  const projects = await api('/api/projects')
  const project = (projects.data ?? []).find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    const purged = await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, {
      method: 'POST',
    })
    if (!purged.ok) throw new Error(`purge failed: ${JSON.stringify(purged)}`)
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step('temporary project visible', await visible(projectButton), 'project in Dev sidebar')
  await projectButton.click()
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const newChat = page.getByRole('dialog')
  await newChat
    .getByRole('button', { name: /Claude/i })
    .first()
    .click()
  await newChat.getByRole('button', { name: 'Start Chat', exact: true }).click()
  const composer = page.locator('textarea').last()
  await step('chat composer visible', await visible(composer), 'composer after Start Chat')

  await sendMessage({ page, composer, text: 'Please note the lesson.', step })
  const autoResponse = await instinctsFor(api, project.id)
  const autoLesson = (autoResponse.data ?? []).find((item) => item.trigger === 'gate trigger auto')
  await step(
    'chat tool call stores an unverified auto lesson with turn evidence',
    autoResponse.ok &&
      autoLesson?.source === 'auto' &&
      autoLesson?.verified === false &&
      typeof autoLesson?.evidence?.turnId === 'string',
    JSON.stringify(autoLesson ?? autoResponse),
  )

  await page.locator('div.group').filter({ hasText: 'Lesson noted.' }).last().hover()
  await page.getByRole('button', { name: 'Remember', exact: true }).last().click()
  const remember = page.getByRole('dialog')
  const doField = remember.getByLabel('Do')
  await step(
    'Remember opens with assistant text prefilled in Do',
    (await doField.inputValue()) === 'Lesson noted.',
    await doField.inputValue(),
  )
  await remember.getByLabel('When').fill('gate trigger manual')
  await remember.getByRole('button', { name: 'Save', exact: true }).click()
  await remember.waitFor({ state: 'detached' })
  let response = await instinctsFor(api, project.id)
  const manualLesson = (response.data ?? []).find((item) => item.trigger === 'gate trigger manual')
  await step(
    'manual lesson is verified and persisted',
    response.ok && manualLesson?.source === 'manual' && manualLesson?.verified === true,
    JSON.stringify(manualLesson ?? response),
  )

  await page.locator('div.group').filter({ hasText: 'Lesson noted.' }).last().hover()
  await page.getByRole('button', { name: 'Remember', exact: true }).last().click()
  const duplicateDialog = page.getByRole('dialog')
  await duplicateDialog.getByLabel('When').fill('gate trigger manual')
  expectHttpError(/\/api\/instincts$/)
  await duplicateDialog.getByRole('button', { name: 'Save', exact: true }).click()
  const duplicateError = duplicateDialog.getByRole('alert')
  await duplicateError.waitFor({ state: 'visible' })
  await step(
    'duplicate trigger reports error and keeps Remember dialog open',
    (await duplicateError.innerText()).includes('A lesson with this trigger already exists') &&
      (await duplicateDialog.isVisible()),
    await duplicateError.innerText(),
  )
  await duplicateDialog.getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Instincts', exact: true }).click()
  const autoCard = page
    .locator('[data-instincts-view] .max-w-5xl > div')
    .filter({ hasText: 'gate trigger auto' })
  const cardText = await autoCard.innerText()
  await step(
    'auto lesson card shows why, evidence citation and injected status',
    cardText.includes('gate why') && cardText.includes('turnId:') && cardText.includes('Injected'),
    cardText.slice(0, 500),
  )
  await shot('lessons-instinct-card')
  await autoCard.getByRole('button', { name: 'Edit', exact: true }).click()
  await autoCard.getByLabel('Learned Action').fill('gate action edited')
  await autoCard.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByText('gate action edited', { exact: true }).waitFor({ state: 'visible' })
  response = await instinctsFor(api, project.id)
  const edited = (response.data ?? []).find((item) => item.id === autoLesson.id)
  await step(
    'edited action is visible and confirmed by API',
    response.ok && edited?.action === 'gate action edited',
    JSON.stringify(edited ?? response),
  )

  await page.keyboard.press('Alt+1')
  await composer.waitFor({ state: 'visible', timeout: 15_000 })
  await sendMessage({ page, composer, text: 'Use the saved lesson.', step })
  const secondArgsPath = join(root, 'turn-2.args')
  const secondTurnDeadline = Date.now() + 180_000
  while (!existsSync(secondArgsPath) && Date.now() < secondTurnDeadline)
    await page.waitForTimeout(100)
  const capturedArgs = existsSync(secondArgsPath) ? readFileSync(secondArgsPath, 'utf8') : ''
  await step(
    'second turn receives saved lesson in Claude system prompt',
    capturedArgs.includes('## Lessons') && capturedArgs.includes('When gate trigger manual'),
    capturedArgs.includes('## Lessons')
      ? capturedArgs.slice(
          capturedArgs.indexOf('## Lessons'),
          capturedArgs.indexOf('## Lessons') + 180,
        )
      : capturedArgs.slice(0, 500),
  )

  const staleResponse = await api(`/api/instincts?project=${encodeURIComponent(project.id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger: 'gate stale lesson', action: 'gate stale action' }),
  })
  if (!staleResponse.ok)
    throw new Error(`stale lesson seed failed: ${JSON.stringify(staleResponse)}`)
  const staleId = staleResponse.data.id
  const old = new Date(Date.now() - 61 * 86400000).toISOString()
  execFileSync(
    'bun',
    [
      '-e',
      `
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)})
    db.run('UPDATE instincts SET created_at = ?, last_injected_at = ? WHERE id = ?',
      [${JSON.stringify(old)}, ${JSON.stringify(old)}, ${JSON.stringify(staleId)}])
    db.close()
  `,
    ],
    { encoding: 'utf8' },
  )
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Instincts', exact: true }).click()
  await page.getByRole('button', { name: 'Review Proposals', exact: true }).click()
  const staleCard = page
    .locator('[data-instincts-view] .max-w-5xl > div')
    .filter({ hasText: 'gate stale lesson' })
  await step(
    'stale lesson appears in Review with Keep and Retire',
    (await visible(staleCard.getByText('Unused for 60 days', { exact: true }))) &&
      (await visible(staleCard.getByRole('button', { name: 'Keep', exact: true }))) &&
      (await visible(staleCard.getByRole('button', { name: 'Retire', exact: true }))),
    await staleCard.innerText(),
  )
  await shot('lessons-stale-review')
  await staleCard.getByRole('button', { name: 'Keep', exact: true }).click()
  await staleCard.waitFor({ state: 'detached' })
  response = await instinctsFor(api, project.id)
  await step(
    'Keep removes lesson from Review and persists active status',
    (response.data ?? []).find((item) => item.id === staleId)?.status === 'active',
    JSON.stringify(response.data),
  )
  await page.getByRole('button', { name: /^Active Instincts/ }).click()
  const manualCard = page
    .locator('[data-instincts-view] .max-w-5xl > div')
    .filter({ hasText: 'gate trigger manual' })
  await manualCard.getByRole('button', { name: 'Add to AGENTS.md', exact: true }).click()
  const graduation = page.getByRole('dialog', { name: 'Add to AGENTS.md', exact: true })
  const agentsPath = join(projectRoot, 'AGENTS.md')
  const beforeGraduation = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : null
  const diffLine = '+ - When gate trigger manual: Lesson noted.'
  const previewText = await graduation.innerText()
  await step(
    'graduation dialog previews path and added line',
    previewText.includes(agentsPath) && previewText.includes(diffLine),
    previewText,
  )
  await shot('lessons-graduation-preview')
  await graduation.getByRole('button', { name: 'Cancel', exact: true }).click()
  await step(
    'Cancel leaves AGENTS.md unchanged',
    (existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : null) === beforeGraduation,
    agentsPath,
  )
  await manualCard.getByRole('button', { name: 'Add to AGENTS.md', exact: true }).click()
  await graduation.getByRole('button', { name: 'Add', exact: true }).click()
  await graduation.waitFor({ state: 'detached' })
  await manualCard.getByText('Retired', { exact: true }).waitFor({ state: 'visible' })
  const agents = readFileSync(agentsPath, 'utf8')
  response = await instinctsFor(api, project.id)
  await step(
    'Add writes delimited block and retires the persisted lesson',
    agents.includes(
      '<!-- orchestos:lessons:start -->\n## Lessons learned\n- When gate trigger manual: Lesson noted.\n<!-- orchestos:lessons:end -->',
    ) &&
      (response.data ?? []).find((item) => item.id === manualLesson.id)?.status === 'retired' &&
      (await manualCard.getByRole('button').count()) === 0,
    agents,
  )
  await shot('lessons-retired')
  await page.keyboard.press('Alt+1')
  await composer.waitFor({ state: 'visible', timeout: 15_000 })
  await sendMessage({ page, composer, text: 'Check lessons after graduation.', step })
  const thirdArgs = readFileSync(join(root, 'turn-3.args'), 'utf8')
  const lessonsSection = thirdArgs.match(/## Lessons\n([\s\S]*?)(?=\n## |$)/)?.[1] ?? ''
  await step(
    'next turn injects active lesson and excludes the retired lesson',
    lessonsSection.includes('When gate stale lesson') &&
      !lessonsSection.includes('When gate trigger manual'),
    lessonsSection,
  )
}
