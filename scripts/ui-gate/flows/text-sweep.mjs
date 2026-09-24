import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

async function waitForAssistant(page, timeoutMs = 180_000) {
  try {
    await page.locator('div.prose').last().waitFor({ state: 'visible', timeout: timeoutMs })
    return true
  } catch {
    return false
  }
}

const staleCopy = [
  'Resume AST sandbox session',
  'Registers the repository within OrchestOS workspace contracts',
  'Middleware & Tool Executions',
  'Task Ready for Git Commit Proof',
  'Reinforcement Learning Engine (orchestos instinct)',
  'Manual instincts start with an authoritative confidence score of',
  'and are immediately compiled into the middleware context',
  'SQLite Vector Embeddings: text-embedding-3-small',
  'Borra permanentemente todos los chats, runs, archivos indexados, memoria y demás datos SQLite de',
  '. No borra la carpeta del proyecto.',
  'This permanently deletes all chats, runs, indexed files, memory, and other SQLite data',
  'Agent Chain-of-Thought',
  'Approve & Merge to Main',
  'Revert Sandbox Worktree',
]

export default async function textSweep({ page, api, step, visible, hidden, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-9-8-'))
  writeFileSync(join(projectRoot, 'README.md'), '# UI.9.8\n')
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

  const projects = await api('/api/projects')
  const project = (Array.isArray(projects.data) ? projects.data : []).find(
    (item) => item.path === projectRoot,
  )
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true })
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step(
    'temporary project visible',
    await visible(projectButton),
    'project visible in sidebar',
  )
  if (!(await projectButton.isVisible())) return
  await projectButton.click()

  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const codex = dialog.getByRole('button', { name: /Codex/ }).first()
  await step('Codex selector visible', await visible(codex), 'Codex option visible')
  if (!(await codex.isVisible())) return
  await codex.click()
  await page.getByRole('button', { name: 'Start Chat', exact: true }).click()

  const modelControl = page.locator('button[title="Select model and reasoning effort"]')
  await step('model selector visible', await visible(modelControl), 'composer model selector')
  if (!(await modelControl.isVisible())) return
  await modelControl.click()
  const luna = page.getByRole('button', { name: /gpt-6-luna/i }).first()
  await step('gpt-6-luna visible', await visible(luna), 'Codex cache model')
  if (!(await luna.isVisible())) return
  await luna.click()
  await modelControl.click()
  const medium = page.getByRole('button', { name: /^medium$/i }).first()
  await step('medium visible', await visible(medium), 'reasoning effort')
  if (!(await medium.isVisible())) return
  await medium.click()
  await page.locator('textarea').last().fill('Responde únicamente con OK.')
  await page.locator('textarea').last().press('Enter')
  await step('real Codex response visible', await waitForAssistant(page), 'assistant response')

  const text = await page.locator('body').innerText()
  await step(
    'removed text absent after real turn',
    !staleCopy.some((literal) => text.includes(literal)) &&
      !text.toLowerCase().includes('cli default model'),
    'chat surface sweep complete',
  )
  for (const literal of staleCopy) {
    await hidden(page.getByText(literal, { exact: false }))
  }
  await step(
    'all stale copy remains absent from the active screen',
    true,
    `${staleCopy.length} literals checked`,
  )
  const sessions = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
  const session = (Array.isArray(sessions.data) ? sessions.data : [])[0]
  const messages = session
    ? await api(`/api/chat/sessions/${encodeURIComponent(session.id)}/messages`)
    : { data: [] }
  const assistant = (Array.isArray(messages.data) ? messages.data : []).find(
    (message) => message.role === 'assistant',
  )
  await step(
    'turn records selected model and effort',
    Boolean(assistant?.model?.includes('gpt-6-luna') && session?.lastEffort === 'medium'),
    `model=${assistant?.model ?? 'missing'}, effort=${session?.lastEffort ?? 'missing'}`,
  )
  await step(
    'no CLI default fallback in recorded surface',
    !JSON.stringify({ session, assistant }).toLowerCase().includes('cli default model'),
    'record uses selected model',
  )
  await hidden(
    page.getByText('Registers the repository within OrchestOS workspace contracts', {
      exact: false,
    }),
  )
}
