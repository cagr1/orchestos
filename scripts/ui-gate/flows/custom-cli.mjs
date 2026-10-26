import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { parse, stringify } from 'yaml'
import { run, writeGateRoles } from '../lib.mjs'

export default async function customCli({ page, api, step, shot, cleanup, databasePath, visible }) {
  const globalPath = join(dirname(databasePath), 'config.yaml')
  const original = existsSync(globalPath) ? readFileSync(globalPath, 'utf8') : null
  const globalConfig = parse(original ?? '') ?? {}
  globalConfig.clis = [
    ...(globalConfig.clis ?? []),
    {
      id: 'claude-plain',
      label: 'Claude (genérico)',
      command: 'claude',
      args: ['-p', '{prompt}', '--permission-mode', 'acceptEdits'],
    },
  ]
  cleanup(() => {
    if (original === null) rmSync(globalPath, { force: true })
    else writeFileSync(globalPath, original)
  })
  writeFileSync(globalPath, stringify(globalConfig))

  const root = realpathSync(mkdtempSync(join(tmpdir(), 'orchestos-ui-custom-cli-')))
  writeFileSync(join(root, 'README.md'), '# Generic CLI fixture\n')
  writeFileSync(join(root, '.gitignore'), '.orchestos/\n')
  run('git', ['init', '-q'], root)
  run('git', ['config', 'user.name', 'ui-gate'], root)
  run('git', ['config', 'user.email', 'ui-gate@example.invalid'], root)
  run('git', ['add', 'README.md', '.gitignore'], root)
  run('git', ['commit', '-qm', 'fixture'], root)
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', root], process.cwd())
  writeGateRoles(root)
  mkdirSync(join(root, '.orchestos'), { recursive: true })
  writeFileSync(
    join(root, 'tasks.yaml'),
    stringify({
      version: 1,
      project: 'custom-cli-gate',
      tasks: [
        {
          id: 'gate-custom-cli',
          description:
            'Append exactly the line GENERIC-CLI-RAN to README.md. Use your file editing tool, then stop.',
          engine: 'cli:claude-plain',
          executor_model: 'default',
          input: ['README.md'],
          output: ['README.md'],
          depends_on: [],
          status: 'pending',
          retry_count: 0,
        },
      ],
    }),
  )
  run('git', ['add', '-A'], root)
  run('git', ['commit', '-qm', 'task fixture'], root)
  const project = ((await api('/api/projects')).data ?? []).find((p) => p.path === root)
  if (!project) throw new Error(`project not registered: ${root}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(root, { recursive: true, force: true })
  })
  const headers = { 'x-orchestos-project-id': project.id }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.getByRole('button', { name: basename(root), exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Model routing', exact: true }).click()
  const executor = page.locator('[data-settings-anchor="routing-executor"]')
  await executor.getByLabel('Executor agent').click()
  const option = executor.getByRole('button', { name: 'Claude (genérico)', exact: true })
  await step(
    'generic executor installed and selectable',
    (await visible(option)) && (await option.isEnabled()),
  )
  await option.click()
  await step(
    'generic executor preselects default model',
    await executor.getByRole('button', { name: 'Default del CLI', exact: true }).isVisible(),
  )
  await shot('custom-cli-settings')
  const [saved] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith('/api/config') && res.request().method() === 'PUT',
    ),
    page.locator('[data-unsaved-bar]').getByRole('button', { name: 'Save', exact: true }).click(),
  ])
  if (!saved.ok()) throw new Error(`save failed ${saved.status()}: ${await saved.text()}`)
  await step(
    'generic executor persisted',
    (await api('/api/config', { headers })).data?.roleAssignments?.executor?.agent ===
      'claude-plain',
  )
  run('git', ['add', 'orchestos.config.yaml'], root)
  run('git', ['commit', '-qm', 'configured generic executor'], root)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.getByRole('button', { name: basename(root), exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Tasks', exact: true }).click()
  const [launched] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/api/tasks/') && res.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Run gate-custom-cli', exact: true }).click(),
  ])
  if (!launched.ok())
    throw new Error(`launch failed ${launched.status()}: ${await launched.text()}`)
  let task
  const deadline = Date.now() + 10 * 60_000
  while (Date.now() < deadline) {
    task = ((await api('/api/tasks', { headers })).data?.tasks ?? []).find(
      (t) => t.id === 'gate-custom-cli',
    )
    if (
      task?.status === 'done' ||
      task?.status === 'failed' ||
      task?.status === 'failed_permanent' ||
      task?.retryCount > 0
    )
      break
    await delay(1000)
  }
  const listed = (await api('/api/runs', { headers })).data ?? []
  const result = listed.find((r) => r.taskId === 'gate-custom-cli')
  await step(
    'generic task completed',
    task?.status === 'done' && result?.status === 'done',
    JSON.stringify({ task, result }),
  )
  await step(
    'generic engine and unknown cost persisted',
    result?.engine === 'cli:claude-plain' &&
      result?.costUsd === null &&
      result?.costSource === 'unknown',
    JSON.stringify(result),
  )
  await step(
    'declared output changed in the run diff',
    result?.fileDiffs?.some(
      (f) => f.path === 'README.md' && JSON.stringify(f).includes('GENERIC-CLI-RAN'),
    ),
    JSON.stringify(result?.fileDiffs),
  )
  await page.getByRole('button', { name: 'Runs', exact: true }).click()
  const row = page.locator('tr').filter({ hasText: 'gate-custom-cli' }).first()
  await step(
    'unknown cost visible in run row',
    await row.getByText('no medido', { exact: true }).isVisible(),
  )
  await row.click()
  await step(
    'unknown cost visible in run detail',
    await page.getByText('no medido', { exact: true }).first().isVisible(),
  )
  await step(
    'generic CLI provider and default model visible in run detail',
    await page.getByText('claude-plain · default', { exact: true }).isVisible(),
  )
  await shot('custom-cli-run')
}
