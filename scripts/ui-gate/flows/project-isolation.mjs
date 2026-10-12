import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { writeGateRoles } from '../lib.mjs'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

async function startChat(page, projectName, agent) {
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: projectName, exact: true })
  await projectButton.hover()
  await page.getByRole('button', { name: 'Launch new agent', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const option = dialog.getByRole('button', { name: new RegExp(agent, 'i') }).first()
  await option.waitFor({ state: 'visible', timeout: 15_000 })
  await option.click()
  const started = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat/sessions',
  )
  await dialog.getByRole('button', { name: 'Launch Agent', exact: true }).click()
  const response = await started
  if (!response.ok()) throw new Error(`Starting ${agent} chat failed: HTTP ${response.status()}`)
  const session = await response.json()
  if (session.agent !== agent.toLowerCase())
    throw new Error(`Expected ${agent} session, received ${session.agent}`)
  return session
}

async function selectClaudeHaiku(page) {
  const modelControl = page.locator('button[title="Select model and reasoning effort"]').last()
  await modelControl.waitFor({ state: 'visible', timeout: 15_000 })
  await modelControl.click()
  await page.getByRole('button', { name: /haiku/i }).first().click()
  await page.keyboard.press('Escape')
}

async function sendTurn(page, message, timeout = 180_000) {
  const composer = page.locator('textarea').last()
  await composer.waitFor({ state: 'visible', timeout: 30_000 })
  await composer.fill(message)
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/chat',
    { timeout },
  )
  await page.getByRole('button', { name: 'Send message', exact: true }).last().click()
  const response = await responsePromise
  if (!response.ok()) throw new Error(`/api/chat returned HTTP ${response.status()}`)
  const reply = page.locator('div.prose').last()
  await reply.waitFor({ state: 'visible', timeout })
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const text = (await reply.innerText()).trim()
    if (text) return text
    await page.waitForTimeout(300)
  }
  return ''
}

function seedDatabase({ projectA, projectB, sessionA, sessionB, databasePath }) {
  const code = `
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)})
    const now = new Date().toISOString()
    const memory = [
      ['erp2-memory-a', ${JSON.stringify(projectA)}, 'erp2-alfa', 'project', 'Centinela memoria Alfa'],
      ['erp2-memory-b', ${JSON.stringify(projectB)}, 'erp2-beta', 'project', 'Centinela memoria Beta'],
      ['erp2-memory-global', ${JSON.stringify(projectA)}, 'erp2-global', 'global', 'Centinela memoria Global'],
    ]
    for (const [id, projectId, topic, scope, content] of memory) {
      db.run('INSERT INTO memory_entries (id, project_id, topic_key, scope, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, projectId, topic, scope, content, now, now])
    }
    const instincts = [
      ['erp2-instinct-a', ${JSON.stringify(projectA)}, 'Centinela instinto Alfa'],
      ['erp2-instinct-b', ${JSON.stringify(projectB)}, 'Centinela instinto Beta'],
      ['erp2-instinct-history', null, 'Centinela instinto Historico'],
    ]
    for (const [id, projectId, trigger] of instincts) {
      db.run('INSERT INTO instincts (id, trigger, action, confidence, source, verified, created_at, project_id) VALUES (?, ?, ?, 0.9, ?, 1, ?, ?)', [id, trigger, 'Gate fixture action', 'manual', now, projectId])
    }
    for (const [id, projectId, prompt] of [['erp2-run-a', ${JSON.stringify(projectA)}, 'Alfa run'], ['erp2-run-b', ${JSON.stringify(projectB)}, 'Beta run']]) {
      db.run('INSERT INTO runs (id, project_id, prompt, task_class, model, provider, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, projectId, prompt, 'gate', 'fixture', 'fixture', 'done', now])
    }
    db.run('INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)', [${JSON.stringify(sessionA)}, 'user', 'Centinela chat Alfa', now])
    db.run('INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)', [${JSON.stringify(sessionB)}, 'user', 'Centinela chat Beta', now])
    db.close()
  `
  execFileSync('bun', ['-e', code], { cwd: process.cwd(), stdio: 'ignore' })
}

export default async function projectIsolation({
  page,
  api,
  step,
  visible,
  hidden,
  shot,
  cleanup,
  databasePath,
  captureDir,
  expectHttpError,
}) {
  const repoRoot = process.cwd()
  const makeProject = (label) => {
    const root = mkdtempSync(join(tmpdir(), `orchestos-erp2-${label}-`))
    writeFileSync(join(root, 'README.md'), `# ERP.2 ${label}\n`)
    writeFileSync(join(root, '.gitignore'), '.orchestos/\n')
    run('git', ['init', '-q'], root)
    run('git', ['add', 'README.md', '.gitignore'], root)
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
      root,
    )
    run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'init', root], repoRoot)
    return root
  }

  let rootA
  let rootB
  let projectA
  let projectB
  cleanup(async () => {
    for (const project of [projectA, projectB]) {
      if (project)
        await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    }
    for (const root of [rootA, rootB]) {
      if (root && existsSync(root))
        rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
      if (root && existsSync(root)) throw new Error(`temporary project remains: ${root}`)
    }
  })
  rootA = makeProject('alfa')
  rootB = makeProject('beta')
  const projects = (await api('/api/projects')).data ?? []
  projectA = projects.find((project) => project.path === rootA)
  projectB = projects.find((project) => project.path === rootB)
  if (!projectA || !projectB) throw new Error('temporary Alfa/Beta projects were not registered')

  const createSession = async (project, title) => {
    const response = await api('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, agent: 'api', mode: 'chat', title }),
    })
    if (response.status !== 201) throw new Error(`chat seed failed: ${JSON.stringify(response)}`)
    return response.data
  }
  const sessionA = await createSession(projectA, 'ERP.2 Alfa session')
  const sessionB = await createSession(projectB, 'ERP.2 Beta session')
  seedDatabase({
    projectA: projectA.id,
    projectB: projectB.id,
    sessionA: sessionA.id,
    sessionB: sessionB.id,
    databasePath,
  })

  mkdirSync(join(rootA, 'skills'), { recursive: true })
  copyFileSync(join(repoRoot, 'skills/api-contract.yaml'), join(rootA, 'skills/api-contract.yaml'))

  const projectApi = (projectId, path, init = {}) =>
    api(path, {
      ...init,
      headers: { ...(init.headers ?? {}), 'x-orchestos-project-id': projectId },
    })

  await step('fixtures created for Alfa and Beta', true, `${projectA.id}; ${projectB.id}`)
  const aRuns = await projectApi(projectA.id, '/api/runs')
  const aMemory = await projectApi(projectA.id, '/api/memory?q=Beta')
  const aSessions = await projectApi(projectA.id, '/api/chat/sessions')
  await step(
    'API lists only Alfa runs, memory search hides Beta, and sessions are scoped to Alfa',
    aRuns.data?.some((run) => run.id === 'erp2-run-a') === true &&
      aRuns.data?.some((run) => run.id === 'erp2-run-b') === false &&
      aMemory.data?.some((entry) => entry.content === 'Centinela memoria Beta') === false &&
      aSessions.data?.some((session) => session.id === sessionA.id) === true &&
      aSessions.data?.some((session) => session.id === sessionB.id) === false,
    JSON.stringify({
      runs: aRuns.data?.map((run) => run.id),
      memory: aMemory.data,
      sessions: aSessions.data?.map((item) => item.id),
    }),
  )

  const foreignRequests = [
    ['GET run', `/api/runs/erp2-run-b`, { method: 'GET' }],
    [
      'GET messages',
      `/api/chat/sessions/${encodeURIComponent(sessionB.id)}/messages`,
      { method: 'GET' },
    ],
    [
      'PATCH session',
      `/api/chat/sessions/${encodeURIComponent(sessionB.id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'cross-project mutation' }),
      },
    ],
    ['approve instinct', '/api/instincts/erp2-instinct-b/approve', { method: 'POST' }],
    ['delete memory', '/api/memory/erp2-memory-b', { method: 'DELETE' }],
    ['delete instinct', '/api/instincts/erp2-instinct-b', { method: 'DELETE' }],
    ['delete run', '/api/runs/erp2-run-b', { method: 'DELETE' }],
    [
      'delete session',
      `/api/chat/sessions/${encodeURIComponent(sessionB.id)}`,
      { method: 'DELETE' },
    ],
    [
      'chat with foreign session',
      '/api/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionB.id, message: 'must not cross projects' }),
      },
    ],
  ]
  for (const [, path] of foreignRequests)
    expectHttpError(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  const foreignResults = []
  for (const [label, path, init] of foreignRequests) {
    const response = await projectApi(projectA.id, path, init)
    foreignResults.push({ label, status: response.status })
  }
  await step(
    'Alfa cannot read or mutate any Beta run, session, memory, or instinct',
    foreignResults.every((result) => result.status === 404),
    JSON.stringify(foreignResults),
  )

  const bRuns = await projectApi(projectB.id, '/api/runs')
  const bMemory = await projectApi(projectB.id, '/api/memory')
  const bMessages = await projectApi(
    projectB.id,
    `/api/chat/sessions/${encodeURIComponent(sessionB.id)}/messages`,
  )
  const bInstincts = await projectApi(projectB.id, '/api/instincts')
  const afterAttemptMessages = bMessages.data ?? []
  await step(
    'Beta data and message history remain intact after rejected Alfa requests',
    bRuns.data?.some((run) => run.id === 'erp2-run-b') === true &&
      bMemory.data?.some((entry) => entry.content === 'Centinela memoria Beta') === true &&
      afterAttemptMessages.some((message) => message.content === 'Centinela chat Beta') === true &&
      afterAttemptMessages.every((message) => message.content !== 'must not cross projects') &&
      bInstincts.data?.some((instinct) => instinct.id === 'erp2-instinct-b') === true,
    JSON.stringify({
      run: bRuns.data?.map((run) => run.id),
      memory: bMemory.data?.map((item) => item.content),
      messages: afterAttemptMessages.map((item) => item.content),
      instincts: bInstincts.data?.map((item) => item.id),
    }),
  )

  const openProjectSettings = async (root) => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    const projectButton = page.getByRole('button', { name: basename(root), exact: true })
    await projectButton.click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await visible(page.getByRole('heading', { name: basename(root), exact: true }))
  }

  for (const [label, root, ownLabel, otherLabel, skillOrigin] of [
    ['Alfa', rootA, 'Alfa', 'Beta', 'Proyecto'],
    ['Beta', rootB, 'Beta', 'Alfa', 'Biblioteca'],
  ]) {
    await openProjectSettings(root)
    const tab = (name) => page.getByRole('button', { name, exact: true })
    await tab('Memory').click()
    const ownMemory = page.getByText(`Centinela memoria ${ownLabel}`, { exact: true })
    const otherMemory = page.getByText(`Centinela memoria ${otherLabel}`, { exact: true })
    const globalMemory = page.getByText('Centinela memoria Global', { exact: true })
    await step(
      `${label} Memory shows own and global entries, hides the other project`,
      (await visible(ownMemory)) &&
        (await hidden(otherMemory)) &&
        (await visible(globalMemory)) &&
        (await visible(page.getByText('Global', { exact: true }))),
      'project memory isolation and Global label',
    )
    await shot(`memory-${label.toLowerCase()}`)

    await tab('Instincts').click()
    await page.getByRole('button', { name: /Active Instincts/ }).click()
    const ownInstinct = page.getByText(`Centinela instinto ${ownLabel}`, { exact: true })
    const otherInstinct = page.getByText(`Centinela instinto ${otherLabel}`, { exact: true })
    const historicalInstinct = page.getByText('Centinela instinto Historico', { exact: true })
    await step(
      `${label} Active Instincts shows own and historical entries, hides the other project`,
      (await visible(ownInstinct)) &&
        (await hidden(otherInstinct)) &&
        (await visible(historicalInstinct)) &&
        (await visible(page.getByText('Sin proyecto (histórico)', { exact: true }))),
      'project instinct isolation and historical label',
    )
    await shot(`instincts-${label.toLowerCase()}`)

    await tab('Skills').click()
    const skillRow = page.locator('div.rounded-2xl').filter({ hasText: 'API Contract Design' })
    await step(
      `${label} api-contract skill origin is ${skillOrigin}`,
      (await visible(skillRow)) &&
        (await visible(skillRow.getByText(skillOrigin, { exact: true }))),
      `api-contract origin: ${skillOrigin}`,
    )
    await shot(`skills-${label.toLowerCase()}`)
  }

  // R.8.5: lo que el CLI recibe de verdad, no solo lo que la API filtra.
  writeGateRoles(rootA)
  const beta = ['Centinela memoria Beta', 'Centinela instinto Beta', 'Centinela chat Beta']
  for (const agent of ['Codex', 'Claude']) {
    await page.reload({ waitUntil: 'domcontentloaded' })
    const session = await startChat(page, basename(rootA), agent)
    if (agent === 'Claude') await selectClaudeHaiku(page)
    const reply = await sendTurn(page, 'Reply only OK.', agent === 'Codex' ? 300_000 : 180_000)
    const prompt = readFileSync(join(captureDir, `chat-prompt-${session.id}.txt`), 'utf8')
    const cliInput = readFileSync(join(captureDir, `chat-cli-input-${session.id}.txt`), 'utf8')
    const captured = `${prompt}\n${cliInput}`
    await step(
      `${agent} CLI context includes the own project memory (positive control)`,
      Boolean(reply) && captured.includes('Centinela memoria Alfa'),
      `reply=${JSON.stringify(reply)} · prompt ${prompt.length} chars · cli input ${cliInput.length} chars`,
    )
    const leaked = beta.filter((sentinel) => captured.includes(sentinel))
    await step(
      `${agent} CLI context excludes every Beta sentinel`,
      leaked.length === 0,
      `fugas: ${JSON.stringify(leaked)} · Centinela memoria Global: ${captured.includes('Centinela memoria Global') ? 'aparece' : 'no aparece'}`,
    )
  }
}
