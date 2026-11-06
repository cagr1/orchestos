import { expect, test } from 'bun:test'

test('registered CLI adapters are available in role config and model catalog', async () => {
  const proc = Bun.spawn(
    [
      'bun',
      '-e',
      `
        const { mkdtempSync, rmSync } = await import('node:fs')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')
        const { KNOWN_CLIS } = await import('./src/run/executors/cli-registry.ts')
        const { cliChatAdapterFor, registerCliChatAdapter, roleAgentIds } = await import('./src/run/executors/chat-adapters.ts')
        const { handleApiConfigSet } = await import('./src/dashboard/handlers/config.ts')
        const { handleApiModelCatalog } = await import('./src/dashboard/handlers/model-catalog.ts')
        const root = mkdtempSync(join(tmpdir(), 'registered-role-adapter-'))
        const cwd = process.cwd()
        try {
          const base = KNOWN_CLIS.find(cli => cli.id === 'codex')
          const adapter = cliChatAdapterFor('codex')
          KNOWN_CLIS.push({ ...base, id: 'fixture-role', binary: 'fixture-role', label: 'Fixture Role' })
          registerCliChatAdapter('fixture-role', { ...adapter, label: 'Fixture Role' })
          process.chdir(root)
          const body = (agent) => new Request('http://localhost/api/config', { method: 'PUT', body: JSON.stringify({ roleAssignments: { auxiliary: { agent, model: 'fixture-model' } } }) })
          const accepted = await handleApiConfigSet(body('fixture-role'))
          const rejected = await handleApiConfigSet(body('nope'))
          const catalog = await handleApiModelCatalog({ readCli: async () => [{ id: 'fixture-role', models: [], efforts: [] }], fetchFn: async () => { throw new Error('offline') } })
          process.stdout.write(JSON.stringify({ ids: roleAgentIds(), accepted: accepted.status, rejected: rejected.status, catalog: (await catalog.json()).agents.map(agent => agent.id) }))
        } finally {
          process.chdir(cwd)
          rmSync(root, { recursive: true, force: true })
        }
      `,
    ],
    { cwd: process.cwd(), stdout: 'pipe', stderr: 'pipe' },
  )
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  expect(code, stderr).toBe(0)
  const result = JSON.parse(stdout)
  expect(result.ids).toEqual(['claude', 'codex', 'opencode', 'fixture-role', 'api'])
  expect(result.accepted).toBe(200)
  expect(result.rejected).toBe(400)
  expect(result.catalog).toEqual(['claude', 'codex', 'opencode', 'fixture-role', 'api'])
})
