import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { run, writeGateRoles } from '../lib.mjs'

function runJson(source) {
  return JSON.parse(execFileSync('bun', ['-e', source], { encoding: 'utf8' }))
}

async function sendTurn(page, composer, message) {
  await composer.waitFor({ state: 'visible', timeout: 30_000 })
  await composer.fill(message)
  const responsePromise = page.waitForResponse(
    (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/chat',
    { timeout: 180_000 },
  )
  await composer.press('Enter')
  const response = await responsePromise
  if (!response.ok())
    throw new Error(
      `/api/chat returned HTTP ${response.status()}: ${(await response.text()).slice(0, 500)}`,
    )
  const apiText = (await response.json()).text
  if (typeof apiText !== 'string') throw new Error('/api/chat response text was not a string')
  const reply = page.locator('div.prose').last()
  const deadline = Date.now() + 30_000
  let domText = ''
  while (Date.now() < deadline) {
    if (await reply.isVisible().catch(() => false)) {
      domText = await reply.innerText()
      if (domText.trim().includes(apiText.trim())) break
    }
    await page.waitForTimeout(300)
  }
  return { api: apiText, dom: domText }
}

async function startChat(page, agent, projectName) {
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const projectOption = dialog.getByRole('button', { name: projectName, exact: true })
  if (await projectOption.isVisible()) await projectOption.click()
  await dialog
    .getByRole('button', { name: new RegExp(agent, 'i') })
    .first()
    .click()
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat/sessions',
  )
  await dialog.getByRole('button', { name: 'Start Chat', exact: true }).click()
  const session = await (await responsePromise).json()
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

async function askLatestCommit(
  page,
  api,
  project,
  session,
  expectedSha,
  label,
  step,
  shot,
  allowNative = false,
) {
  const reply = await sendTurn(
    page,
    page.locator('textarea').last(),
    'What is the latest commit in this project? Verify it with your tools and answer with its short SHA.',
  )
  const timeline = await api(`/api/chat/sessions/${encodeURIComponent(session.id)}/timeline`, {
    headers: { 'x-orchestos-project-id': project.id },
  })
  const steps = (timeline.data?.turns ?? []).flatMap((turn) => turn.steps ?? [])
  const call = steps.find((item) => {
    if (item.type !== 'tool_use') return false
    if (/run_readonly/.test(item.tool ?? '')) return true
    return (
      allowNative &&
      item.tool === 'command' &&
      /git log\b/.test(`${item.target ?? ''} ${item.detail ?? ''}`)
    )
  })
  await step(
    `${label}: the thread shows ${allowNative ? 'run_readonly or native command' : 'run_readonly'} with the git log command`,
    Boolean(call) && /git log\b/.test(call.target ?? ''),
    call
      ? `${call.tool} target=${call.target} detail=${call.detail ?? ''}`
      : JSON.stringify(steps.map((item) => `${item.type}:${item.tool}`)),
  )
  await step(
    `${label}: the answer cites the real SHA`,
    reply.api.includes(expectedSha) && reply.dom.includes(expectedSha),
    `expected ${expectedSha}; API: ${reply.api}`,
  )
  await shot(`chat-readonly-shell-${label.toLowerCase()}`)
}

export default async function chatReadonlyShell({ page, api, step, shot, visible, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-chat-readonly-'))
  writeFileSync(join(projectRoot, 'README.md'), '# Readonly shell\n')
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
      'fixture readonly shell',
    ],
    projectRoot,
  )
  const expectedSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: projectRoot,
    encoding: 'utf8',
  }).trim()
  const repoRoot = process.cwd()
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'init', projectRoot], repoRoot)
  writeGateRoles(projectRoot)
  const configPath = join(projectRoot, 'orchestos.config.yaml')
  const config = parseYaml(readFileSync(configPath, 'utf8'))
  config.roles.orchestrator = { agent: 'codex', model: 'gpt-6-luna', effort: 'medium' }
  writeFileSync(configPath, stringifyYaml(config))

  const projects = await api('/api/projects')
  const project = (projects.data ?? []).find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step('temporary project visible', await visible(projectButton), basename(projectRoot))
  await projectButton.click()
  const claudeSession = await startChat(page, 'Claude', basename(projectRoot))
  await selectClaudeHaiku(page)
  await askLatestCommit(page, api, project, claudeSession, expectedSha, 'Claude', step, shot)

  const codexSession = await startChat(page, 'Codex', basename(projectRoot))
  await askLatestCommit(page, api, project, codexSession, expectedSha, 'Codex', step, shot, true)
}
