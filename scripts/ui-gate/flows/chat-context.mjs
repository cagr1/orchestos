import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { writeGateRoles } from '../lib.mjs'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

function runJson(source) {
  return JSON.parse(execFileSync('bun', ['-e', source], { encoding: 'utf8' }))
}

async function sendTurn(page, composer, message) {
  await composer.waitFor({ state: 'visible', timeout: 30_000 })
  const previousReplyCount = await page.locator('div.prose').count()
  await composer.fill(message)
  await page
    .getByRole('button', { name: 'Send message', exact: true })
    .last()
    .waitFor({ state: 'visible' })
  const deadline = Date.now() + 180_000
  const response = page
    .waitForResponse(
      (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/chat',
      { timeout: 180_000 },
    )
    .catch(() => null)
  while (Date.now() < deadline) {
    const request = page
      .waitForRequest(
        (req) => req.method() === 'POST' && new URL(req.url()).pathname === '/api/chat',
        { timeout: 5_000 },
      )
      .then(() => true)
      .catch(() => false)
    await composer.press('Enter')
    if (!(await request)) continue
    const result = await response
    if (!result) return ''
    if (!result.ok()) {
      const body = (await result.text()).slice(0, 500)
      throw new Error(`/api/chat returned HTTP ${result.status()}: ${body}`)
    }
    return waitForReply(page, previousReplyCount)
  }
  return ''
}

async function waitForReply(page, replyIndex) {
  const deadline = Date.now() + 180_000
  const reply = page.locator('div.prose').nth(replyIndex)
  while (Date.now() < deadline) {
    if (await reply.isVisible().catch(() => false)) {
      const response = (await reply.innerText()).trim()
      if (response) return response
    }
    await page.waitForTimeout(300)
  }
  return ''
}

async function startChat(page, agent, projectName) {
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const projectOption = dialog.getByRole('button', { name: projectName, exact: true })
  if (await projectOption.isVisible()) await projectOption.click()
  const agentOption = dialog.getByRole('button', { name: new RegExp(agent, 'i') }).first()
  await agentOption.waitFor({ state: 'visible', timeout: 15_000 })
  await agentOption.click()
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat/sessions',
  )
  await dialog.getByRole('button', { name: 'Start Chat', exact: true }).click()
  const response = await responsePromise
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

const prompt = 'Which tasks failed QA and why? One sentence.'

export default async function chatContext({
  page,
  api,
  step,
  shot,
  visible,
  cleanup,
  databasePath,
  captureDir,
}) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-mr-1-d2-'))
  const description =
    'This deliberately long first line checks that chat context truncates descriptions to a single line of at most eighty characters before passing project task details to the agent.'
  writeFileSync(join(projectRoot, 'README.md'), '# Chat context\n')
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
  const repoRoot = process.cwd()
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'init', projectRoot], repoRoot)
  writeFileSync(
    join(projectRoot, 'tasks.yaml'),
    yamlStringify({
      version: 1,
      project: basename(projectRoot),
      tasks: [
        {
          id: 'ctx-qa-task',
          description: `${description}\nSecond line that must not reach the chat context`,
          output: ['README.md'],
          status: 'pending',
          qa_verdict: 'fail',
          retry_count: 1,
        },
      ],
    }),
  )
  writeGateRoles(projectRoot)
  const configPath = join(projectRoot, 'orchestos.config.yaml')
  const config = yamlParse(readFileSync(configPath, 'utf8'))
  config.roles.orchestrator = { agent: 'codex', model: 'gpt-6-luna', effort: 'medium' }
  writeFileSync(configPath, yamlStringify(config))

  const projects = await api('/api/projects')
  const project = (projects.data ?? []).find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })
  runJson(`
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)})
    db.query("INSERT INTO runs (id, project_id, prompt, task_class, task_id, model, provider, qa_verdict, qa_reason, status, usd_cost, cost_breakdown_json, created_at) VALUES (?, ?, 'fixture', 'implement', 'ctx-qa-task', 'codex (cli default model) via Codex CLI', 'codex', 'fail', ?, 'done', 0, ?, ?)").run(
      'ui-chat-context-seed-' + Date.now(), ${JSON.stringify(project.id)}, 'criterion 2 missing: README line absent',
      JSON.stringify([{ source: 'unknown' }]), new Date().toISOString()
    )
    db.close()
    console.log(JSON.stringify({ inserted: true }))
  `)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step(
    'temporary context project visible',
    await visible(projectButton),
    basename(projectRoot),
  )
  await projectButton.click()

  const codexSession = await startChat(page, 'Codex', basename(projectRoot))
  await page.getByRole('button', { name: /GPT-6-Luna · medium/i }).waitFor({ state: 'visible' })
  const composer = page.locator('textarea').last()
  const codexReply = await sendTurn(page, composer, prompt)
  const codexPrompt = readFileSync(join(captureDir, `chat-prompt-${codexSession.id}.txt`), 'utf8')
  await step(
    'Codex chat context includes tools, partial cost, QA, model, and zoned time',
    !!codexReply &&
      /read-only shell commands/i.test(codexPrompt) &&
      /n\/a/i.test(codexPrompt) &&
      /partial/i.test(codexPrompt) &&
      /criterion 2 missing: README line absent/i.test(codexPrompt) &&
      /codex · codex default/i.test(codexPrompt) &&
      /Now:.*UTC[+-]\d{2}:\d{2}/i.test(codexPrompt) &&
      !codexPrompt.includes('Second line that must not reach the chat context'),
    codexPrompt,
  )
  await shot('chat-context-codex')
  const codexRun = runJson(`
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)}, { readonly: true })
    const row = db.query("SELECT provider, context_tokens, input_tokens FROM runs WHERE project_id = ? AND task_class = 'chat' AND provider = 'codex' ORDER BY created_at DESC LIMIT 1").get(${JSON.stringify(project.id)})
    console.log(JSON.stringify(row ?? null))
    db.close()
  `)
  await step(
    'Codex run records context and input token counts',
    codexRun?.provider === 'codex' && codexRun.context_tokens > 0,
    JSON.stringify(codexRun),
  )

  const claudeSession = await startChat(page, 'Claude', basename(projectRoot))
  await selectClaudeHaiku(page)
  const claudeComposer = page.locator('textarea').last()
  const claudeReply = await sendTurn(page, claudeComposer, prompt)
  const claudePrompt = readFileSync(join(captureDir, `chat-prompt-${claudeSession.id}.txt`), 'utf8')
  await step(
    'Claude chat context includes its tools and the previous Codex run',
    !!claudeReply &&
      /Read\s*,?\s*Glob\s*,?\s*Grep/i.test(claudePrompt) &&
      /cannot edit/i.test(claudePrompt) &&
      /codex · gpt-6-luna/i.test(claudePrompt) &&
      /criterion 2 missing: README line absent/i.test(claudePrompt) &&
      !claudePrompt.includes('Second line that must not reach the chat context'),
    claudePrompt,
  )
  await shot('chat-context-claude')
  const claudeRun = runJson(`
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)}, { readonly: true })
    const row = db.query("SELECT provider, context_tokens, input_tokens FROM runs WHERE project_id = ? AND task_class = 'chat' AND provider = 'claude' ORDER BY created_at DESC LIMIT 1").get(${JSON.stringify(project.id)})
    console.log(JSON.stringify(row ?? null))
    db.close()
  `)
  await step(
    'Claude run records context and input token counts',
    claudeRun?.provider === 'claude' && claudeRun.context_tokens > 0,
    JSON.stringify(claudeRun),
  )
}
