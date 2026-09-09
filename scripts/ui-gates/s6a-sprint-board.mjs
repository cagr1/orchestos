// S.6a — same fixture shape as scripts/ui-gates/s6-sprint-board.mjs (S.6), extended to cover
// the commitPending lifecycle: the "close prepared" banner must survive a reload and an
// unrelated mutation, and clear only once a real commit + reconcile confirm the transition
// in Git. Does not touch S.6's own evidence files.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const sourceRoot = resolve(import.meta.dirname, '../..')
const fixture = mkdtempSync(join(tmpdir(), 'orchestos-s6a-board-'))
const evidencePath = join(sourceRoot, 'scripts/s6a-live-evidence.json')
const screenshotPath = join(sourceRoot, 'scripts/s6a-sprint-board.png')
const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'S6a fixture',
  GIT_AUTHOR_EMAIL: 's6a-fixture@example.invalid',
  GIT_COMMITTER_NAME: 'S6a fixture',
  GIT_COMMITTER_EMAIL: 's6a-fixture@example.invalid',
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: fixture,
    env: gitEnv,
    encoding: 'utf-8',
    ...options,
  }).trim()
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function freePort() {
  return await new Promise((resolvePort, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (!address || typeof address === 'string')
        return reject(new Error('Could not allocate test port'))
      probe.close((error) => (error ? reject(error) : resolvePort(address.port)))
    })
  })
}

let server
let browser
const evidence = {
  dom: {},
  api: {},
  database: {},
  sha: null,
  byteExact: false,
  consoleErrors: [],
  failedResponses: [],
}

try {
  const plan = `# S.6a fixture\n\n## Sprint Alpha\n### Block Alpha\n- [ ] **A — ⚡ First item.**\n  Fixture evidence for A.\n\n- [ ] **B — ⚡ Second item.**\n  Fixture evidence for B.\n\n## Sprint Beta\n### Block Beta\n- [ ] **C — 🔍 Third item.**\n  Fixture evidence for C.\n`
  writeFileSync(join(fixture, 'PLAN.md'), plan, 'utf-8')
  run('git', ['init'])
  run('git', ['add', 'PLAN.md'])
  run('git', [
    '-c',
    'commit.gpgsign=false',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '-m',
    'fixture',
  ])

  const { runMigrations } = await import('../../src/db/migrate.ts')
  const { importPlan } = await import('../plan-import.ts')
  const { db } = await import('../../src/db/sqlite.ts')
  const { renderPlan } = await import('../../src/db/plan-doc.ts')
  const { startServer } = await import('../../src/dashboard/server.ts')
  runMigrations()
  importPlan(fixture, true)
  process.chdir(fixture)
  server = startServer(await freePort())
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') evidence.consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => evidence.consoleErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 400)
      evidence.failedResponses.push(`${response.status()} ${response.url()}`)
  })
  // Chat is the dashboard's default screen and opportunistically loads the external model
  // catalog. It is outside S.6/S.6a and requires a real key; keep that unrelated network call
  // from creating console noise before the gate opens Plan through the sidebar.
  await page.route('**/api/chat/models', (route) => route.fulfill({ status: 200, body: '[]' }))

  await page.goto(server.url, { waitUntil: 'networkidle' })
  await page.locator('#navModeBtn').click()
  await page.locator('[data-nav="plan"]').click()
  await page.locator('[data-plan-sprint="Sprint Alpha"]').waitFor()
  assert((await page.locator('[data-plan-sprint]').count()) === 2, 'Expected two sprint sections')
  assert((await page.locator('[data-plan-item="A"]').count()) === 1, 'Missing A card')
  assert((await page.locator('[data-plan-item="B"]').count()) === 1, 'Missing B card')
  assert((await page.locator('[data-plan-item="C"]').count()) === 1, 'Missing C card')
  evidence.dom.initial = { sprints: 2, ids: ['A', 'B', 'C'] }

  const bCard = page.locator('[data-plan-item="B"]')
  await bCard.getByRole('button', { name: 'Edit dependencies' }).click()
  await bCard.locator('input[type="checkbox"]').filter({ hasText: '' }).first().check()
  await bCard.getByRole('button', { name: 'Save' }).click()
  await page.waitForTimeout(250)
  const errorLocator = page.locator('.plan-message.error')
  const mutationError = (await errorLocator.count()) ? await errorLocator.textContent() : null
  if (mutationError) throw new Error(`Dependency mutation failed: ${mutationError}`)
  await page.locator('[data-plan-item="B"].blocked').waitFor()
  assert(
    (await page.locator('[data-plan-item="B"] .plan-edge').textContent())?.includes('A → B'),
    'Missing A → B edge',
  )
  const afterDeps = await page.evaluate(async () => await (await fetch('/api/plan')).json())
  const bApi = afterDeps.items.find((item) => item.id === 'B')
  assert(bApi.blockedBy.includes('A'), 'B must be blocked by A in API')
  evidence.api.afterDependencies = bApi

  // Negative server checks: same as S.6, run before A is closed so B is still blocked.
  const consoleBeforeNegativeChecks = evidence.consoleErrors.length
  const negative = await page.evaluate(async () => {
    const headers = { 'Content-Type': 'application/json' }
    const cycle = await fetch('/api/plan/items/A/dependencies', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ dependsOn: ['B'] }),
    })
    const blockedClose = await fetch('/api/plan/items/B/prepare-close', { method: 'POST' })
    return {
      cycle: { status: cycle.status, body: await cycle.json() },
      blockedClose: { status: blockedClose.status, body: await blockedClose.json() },
    }
  })
  assert(negative.cycle.status === 409, 'Transitive cycle must return 409')
  assert(negative.blockedClose.status === 409, 'Blocked item close must return 409')
  const negativeConsole = evidence.consoleErrors.splice(consoleBeforeNegativeChecks)
  assert(
    negativeConsole.every((message) => message.includes('409')),
    `Unexpected console error during expected negative checks: ${negativeConsole.join('; ')}`,
  )
  evidence.api.negative = {
    cycle: negative.cycle.status,
    blockedClose: negative.blockedClose.status,
  }

  await page.reload({ waitUntil: 'networkidle' })
  if (!(await page.locator('[data-nav="plan"]').count())) await page.locator('#navModeBtn').click()
  await page.locator('[data-nav="plan"]').click()
  await page.locator('[data-plan-item="B"] .plan-edge').waitFor()
  evidence.dom.persistedEdge = await page.locator('[data-plan-item="B"] .plan-edge').textContent()

  const aCard = page.locator('[data-plan-item="A"]')
  await aCard.getByRole('button', { name: 'Prepare close' }).click()
  await aCard.locator('[data-plan-confirm="A"] button.btn.primary').click()
  const commitPendingText =
    'Close prepared; commit and run `bun run plan:reconcile` are still required.'
  // The one-time toast and the persistent per-card banner now share this text; scope to the
  // toast's own element so this wait can't match the banner instead.
  await page.locator('.plan-message.success').getByText(commitPendingText).waitFor()
  await page.locator('[data-plan-item="A"].done').waitFor()
  await page.locator('[data-plan-item="B"].ready').waitFor()
  evidence.dom.afterClose = { aDone: true, bReady: true, pending: true }

  // S.6a part C — the banner must be a durable property of the row, not client memory of the
  // prepare-close response: reload the page and confirm both the DOM banner and the API field
  // survive independently of the toast that triggered them.
  await page.reload({ waitUntil: 'networkidle' })
  if (!(await page.locator('[data-nav="plan"]').count())) await page.locator('#navModeBtn').click()
  await page.locator('[data-nav="plan"]').click()
  await page.locator('[data-plan-item="A"].done').waitFor()
  const pendingBannerAfterReload = page.locator('[data-plan-commit-pending="A"]')
  await pendingBannerAfterReload.waitFor()
  assert(
    (await pendingBannerAfterReload.textContent())?.includes('plan:reconcile'),
    'Reload lost the commit-pending banner for A',
  )
  const planAfterReload = await page.evaluate(async () => await (await fetch('/api/plan')).json())
  assert(
    planAfterReload.items.find((item) => item.id === 'A')?.commitPending === true,
    'API must still report commitPending after a fresh reload',
  )
  evidence.dom.pendingAfterReload = true
  evidence.api.commitPendingAfterReload = true

  // Mutating an unrelated item (B) through the real server must not touch A's pending state.
  const unrelatedMutation = await page.evaluate(async () => {
    const response = await fetch('/api/plan/items/B/dependencies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dependsOn: [] }),
    })
    return { status: response.status, body: await response.json() }
  })
  assert(unrelatedMutation.status === 200, 'Unrelated mutation on B must succeed')
  const planAfterUnrelated = await page.evaluate(
    async () => await (await fetch('/api/plan')).json(),
  )
  assert(
    planAfterUnrelated.items.find((item) => item.id === 'A')?.commitPending === true,
    'Mutating B must not clear A pending state',
  )
  await page.reload({ waitUntil: 'networkidle' })
  if (!(await page.locator('[data-nav="plan"]').count())) await page.locator('#navModeBtn').click()
  await page.locator('[data-nav="plan"]').click()
  await page.locator('[data-plan-commit-pending="A"]').waitFor()
  evidence.api.commitPendingAfterUnrelatedMutation = true

  await page.screenshot({ path: screenshotPath, fullPage: true })

  run('git', ['add', 'PLAN.md'])
  run('git', [
    '-c',
    'commit.gpgsign=false',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '-m',
    'close A',
  ])
  const sha = run('git', ['rev-parse', 'HEAD'])
  execFileSync(
    process.execPath,
    ['run', join(sourceRoot, 'scripts/plan-import.ts'), '--reconcile'],
    {
      cwd: fixture,
      env: process.env,
      stdio: 'pipe',
    },
  )
  const aDb = db.query('SELECT status, commit_sha FROM plan_items WHERE id = ?').get('A')
  const stat = run('git', ['show', '--stat', '--oneline', sha])
  assert(aDb.status === 'done' && aDb.commit_sha === sha, 'Durable SHA did not reconcile')
  assert(stat.includes('PLAN.md'), 'Closing commit must include PLAN.md')
  const rendered = renderPlan(db)
  const onDisk = await Bun.file(join(fixture, 'PLAN.md')).text()
  assert(rendered === onDisk, 'Rendered PLAN.md differs from fixture')
  evidence.database.a = aDb
  evidence.sha = sha
  evidence.byteExact = true

  // S.6a part C, closing the loop — after the real commit is proven, the banner must disappear
  // and the API must report commitPending:false, without depending on planMutation memory.
  await page.reload({ waitUntil: 'networkidle' })
  if (!(await page.locator('[data-nav="plan"]').count())) await page.locator('#navModeBtn').click()
  await page.locator('[data-nav="plan"]').click()
  await page.locator('[data-plan-item="A"].done').waitFor()
  assert(
    (await page.locator('[data-plan-commit-pending="A"]').count()) === 0,
    'Banner must disappear once the closing commit is confirmed by Git',
  )
  const planAfterRealCommit = await page.evaluate(
    async () => await (await fetch('/api/plan')).json(),
  )
  assert(
    planAfterRealCommit.items.find((item) => item.id === 'A')?.commitPending === false,
    'API must report commitPending:false once the real commit is confirmed',
  )
  evidence.dom.pendingClearedAfterCommit = true
  evidence.api.commitPendingAfterRealCommit = false

  assert(
    evidence.consoleErrors.length === 0,
    `Browser errors: ${evidence.consoleErrors.join('; ')}; responses: ${evidence.failedResponses.join('; ')}`,
  )
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf-8')
  const format = Bun.spawnSync(
    ['bunx', 'biome', 'check', '--write', '--formatter-enabled=true', evidencePath],
    { cwd: sourceRoot, stdout: 'pipe', stderr: 'pipe' },
  )
  if (format.exitCode !== 0) {
    const output = `${new TextDecoder().decode(format.stdout)}${new TextDecoder().decode(format.stderr)}`
    throw new Error(`Could not format S.6a live evidence with Biome: ${output.trim()}`)
  }
  console.log(`✓ S.6a sprint board gate passed (${sha})`)
} finally {
  await browser?.close()
  server?.server?.stop(true)
  rmSync(fixture, { recursive: true, force: true })
}
