import { afterEach, beforeEach, expect, it, spyOn } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stringify } from 'yaml'
import { loadOrcheConfig } from '../config/load.ts'
import type { CustomCliConfig } from '../config/schema.ts'
import { handleApiConfigSet } from '../dashboard/handlers/config.ts'
import { handleApiModelCatalog } from '../dashboard/handlers/model-catalog.ts'
import { roleAgentIds } from '../run/executors/chat-adapters.ts'
import { allClis, configuredClis, detectInstalledClis } from '../run/executors/cli-registry.ts'
import { genericCliEngine } from '../run/executors/generic-cli.ts'
import { taskEngineForCli, validTaskEngineIds } from '../run/executors/task-engines.ts'
import { buildCliTaskPrompt } from '../run/executors/task-prompt.ts'
import type { RunContext } from '../run/middleware.ts'
import { validateTask } from '../tasks/schema.ts'

let root: string
let previousHome: string | undefined
let cli: CustomCliConfig
const opts = { maxTokens: 100, maxIterations: 1, timeoutMs: 3000 }
const setConfig = (clis: unknown) =>
  writeFileSync(join(root, '.orchestos/config.yaml'), stringify({ clis }))
function context(model = 'default'): RunContext {
  return {
    effectiveRoot: root,
    worktree: {},
    effectiveContext: 'context',
    skillInstructions: 'skill',
    instinctBlock: 'instinct',
    prompt: { userContent: 'user $(do-not-run); `literal`' },
    task: { output: ['out.txt'] },
    model,
  } as RunContext
}
function script(source: string): string {
  const path = join(root, '.orchestos/fake-cli')
  writeFileSync(path, `#!${process.execPath}\n${source}`, { mode: 0o755 })
  return path
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'generic-cli-'))
  previousHome = process.env.ORCHESTOS_HOME
  process.env.ORCHESTOS_HOME = root
  mkdirSync(join(root, '.orchestos'))
  writeFileSync(join(root, '.gitignore'), '.orchestos/\n')
  execFileSync('git', ['init', '-q', root])
  execFileSync('git', ['add', '.gitignore'], { cwd: root })
  execFileSync(
    'git',
    [
      '-c',
      'user.name=fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-qm',
      'fixture',
    ],
    { cwd: root },
  )
  cli = { id: 'fixture-cli', label: 'Fixture CLI', command: script('process.exit(0)'), args: [] }
})
afterEach(() => {
  if (previousHome === undefined) delete process.env.ORCHESTOS_HOME
  else process.env.ORCHESTOS_HOME = previousHome
  rmSync(root, { recursive: true, force: true })
})
it('loads trusted declarations afresh, exposes honest capabilities and validates the dynamic engine', () => {
  setConfig([cli])
  expect(allClis().find((c) => c.id === cli.id)).toMatchObject({
    generic: true,
    supportsActionApproval: false,
    readBoundary: { kind: 'none' },
    subagentBlock: 'not-guaranteed',
    mcp: { kind: 'none' },
  })
  expect(detectInstalledClis(() => null).find((c) => c.id === cli.id)?.installed).toBe(true)
  expect(taskEngineForCli(cli.id)?.engineId).toBe('cli:fixture-cli')
  expect(validTaskEngineIds()).toContain('cli:fixture-cli')
  expect(
    validateTask(
      { id: 'test', description: 'test', output: ['out.txt'], engine: 'cli:fixture-cli' },
      0,
    ).engine,
  ).toBe('cli:fixture-cli')
  setConfig([])
  expect(taskEngineForCli(cli.id)).toBeUndefined()
})
it('discards malformed and colliding declarations without losing valid entries', () => {
  const warn = spyOn(console, 'error').mockImplementation(() => {})
  try {
    setConfig([
      cli,
      cli,
      { ...cli, id: 'claude' },
      { ...cli, id: 'bad-args', args: 'bad' },
      { ...cli, id: 'Bad' },
      { ...cli, id: 'empty', command: '' },
      { ...cli, id: 'bad-models', models: [5] },
    ])
    expect(configuredClis()).toEqual([cli])
    expect(warn.mock.calls).toHaveLength(6)
    writeFileSync(
      join(root, 'orchestos.config.yaml'),
      stringify({ clis: [{ ...cli, id: 'hostile' }] }),
    )
    expect(loadOrcheConfig(root).clis).toEqual([cli])
    expect(allClis().some((c) => c.id === 'hostile')).toBe(false)
    expect(warn).toHaveBeenCalledWith(
      '[config] ignorando clis del proyecto: solo se permite config global',
    )
  } finally {
    warn.mockRestore()
  }
})
it('offers only default without modelArgs and the configured model catalog otherwise, never in chat', async () => {
  setConfig([
    cli,
    {
      ...cli,
      id: 'missing-cli',
      command: join(root, 'absent'),
      modelArgs: ['--model', '{model}'],
      models: ['custom'],
    },
  ])
  const response = await handleApiModelCatalog({
    readCli: async () => [],
    fetchFn: async () => {
      throw new Error('offline')
    },
  })
  const { agents } = await response.json()
  expect(agents.find((a: { id: string }) => a.id === cli.id)).toMatchObject({
    generic: true,
    installed: true,
    models: [{ id: 'default', name: 'Default del CLI' }],
  })
  expect(agents.find((a: { id: string }) => a.id === 'missing-cli')).toMatchObject({
    installed: false,
    models: [
      { id: 'default', name: 'Default del CLI' },
      { id: 'custom', name: 'custom' },
    ],
  })
  expect(roleAgentIds()).not.toContain(cli.id)
})
it('accepts a generic executor and rejects other roles with the streaming reason', async () => {
  setConfig([cli])
  for (const role of ['executor', 'orchestrator', 'reviewer', 'auxiliary']) {
    const res = await handleApiConfigSet(
      new Request('http://localhost/api/config', {
        method: 'PUT',
        body: JSON.stringify({ roleAssignments: { [role]: { agent: cli.id, model: 'default' } } }),
      }),
      root,
    )
    expect(res.status).toBe(role === 'executor' ? 200 : 400)
    if (role === 'executor')
      expect(readFileSync(join(root, 'orchestos.config.yaml'), 'utf8')).not.toContain('clis:')
    if (role !== 'executor')
      expect(await res.text()).toContain(
        'un CLI genérico solo puede ser Ejecutor: chat y revisión necesitan streaming',
      )
  }
})
it('substitutes prompt and model literally, reads the actual diff and marks measurement unknown', async () => {
  cli.command = script(
    `await Bun.write('out.txt', JSON.stringify(process.argv.slice(2))); console.log(' finished ');`,
  )
  cli.args = ['{prompt}']
  cli.modelArgs = ['--model', '{model}']
  const ctx = context('custom-model')
  const result = await genericCliEngine(cli).run(ctx, opts)
  expect(JSON.parse(result.files.find((f) => f.path === 'out.txt')!.content)).toEqual([
    buildCliTaskPrompt(ctx),
    '--model',
    'custom-model',
  ])
  expect(result.finalText).toBe('finished')
  expect(result.iterations).toBe(1)
  expect(result.costByIteration[0]?.source).toBe('unknown')
  expect(result.log.join('\n')).not.toContain(ctx.prompt.userContent)
  expect(result.log.join('\n')).toContain('<contract>')
})
it('sends the prompt to stdin and omits modelArgs for default', async () => {
  cli.command = script(
    `await Bun.write('out.txt', JSON.stringify({ args: process.argv.slice(2), stdin: await Bun.stdin.text() }));`,
  )
  cli.modelArgs = ['--model', '{model}']
  const ctx = context()
  const result = await genericCliEngine(cli).run(ctx, opts)
  expect(JSON.parse(result.files[0]!.content)).toEqual({ args: [], stdin: buildCliTaskPrompt(ctx) })
})
it('rejects an uncontrolled cwd, spawn failures, nonzero exits and timeouts', async () => {
  const ctx = context()
  await expect(genericCliEngine(cli).run({ ...ctx, worktree: null }, opts)).rejects.toThrow(
    'requires worktree',
  )
  await expect(
    genericCliEngine({ ...cli, command: join(root, 'absent') }).run(ctx, opts),
  ).rejects.toThrow('failed to spawn')
  cli.command = script(`console.log('before'); console.error('failure-marker'); process.exit(3)`)
  await expect(genericCliEngine(cli).run(ctx, opts)).rejects.toThrow(
    'failed (exit 3): before\nfailure-marker',
  )
  cli.command = script('setInterval(() => {}, 1000)')
  await expect(genericCliEngine({ ...cli, timeoutMs: 30 }).run(ctx, opts)).rejects.toThrow(
    'timed out after 30ms',
  )
  await expect(genericCliEngine(cli).run(ctx, { ...opts, timeoutMs: 40 })).rejects.toThrow(
    'timed out after 40ms',
  )
})
