import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadOrcheConfig, RoleUnassignedError, resolveRole } from '../config/load.ts'
import type { OrcheConfig } from '../config/schema.ts'
import { autoRoute } from '../router/auto-route.ts'
import { clientFromAssignment, roleClient } from '../router/role-runner.ts'
import { runTask } from '../run/harness.ts'
import { RunLogger } from '../run/logger.ts'
import type { Task } from '../tasks/schema.ts'

const cfg = (roles: OrcheConfig['roles'] = {}): OrcheConfig => ({
  config_version: 1,
  roles,
  models: {},
})
const task: Task = {
  id: 'a',
  description: 'Implement x',
  status: 'pending',
  executor: 'openrouter',
  input: [],
  output: [],
  depends_on: [],
  retry_count: 0,
}

describe('role runner', () => {
  it('forwards API chat input unchanged', async () => {
    let received: unknown
    const provider = {
      name: 'mock-api',
      chat: async (input: unknown) => {
        received = input
        return { text: 'ok', inputTokens: 1, outputTokens: 2, model: 'real-model' }
      },
    }
    const client = clientFromAssignment(
      'reviewer',
      { agent: 'api', model: 'm', provider: 'openrouter' },
      { cwd: '/tmp', deps: { getProvider: (() => provider) as never } },
    )
    const input = {
      model: 'requested',
      system: 'system',
      messages: [{ role: 'user' as const, content: 'hello' }],
      maxTokens: 8,
    }
    expect(await client.provider.chat(input)).toEqual({
      text: 'ok',
      inputTokens: 1,
      outputTokens: 2,
      model: 'real-model',
    })
    expect(received).toBe(input)
  })

  it.each(['claude', 'codex', 'opencode'] as const)(
    '%s runner formats messages and reports its actual model',
    async (agent) => {
      let args: unknown[] = []
      const runner = (async (...values: unknown[]) => {
        args = values
        return { text: 'done', inputTokens: 2, outputTokens: 3, model: 'actual-model' }
      }) as never
      const deps =
        agent === 'claude'
          ? { claude: runner }
          : agent === 'codex'
            ? { codex: runner }
            : { opencode: runner }
      const client = clientFromAssignment(
        'auxiliary',
        { agent, model: 'requested', effort: 'high' },
        { cwd: '/project', timeoutMs: 123, deps },
      )
      const response = await client.provider.chat({
        model: 'ignored',
        system: 'sys',
        messages: [
          { role: 'user', content: 'one' },
          { role: 'assistant', content: 'two' },
        ],
      })
      expect(args.slice(0, 4)).toEqual([
        '/project',
        'sys',
        '## user\none\n\n## assistant\ntwo',
        123,
      ])
      expect(args[4]).toBe('requested')
      if (agent !== 'opencode') expect(args[5]).toBe('high')
      else expect(args).toHaveLength(5)
      expect(response.model).toBe('actual-model')
    },
  )

  it('throws the exact unassigned role error', () => {
    expect(() => roleClient(cfg(), 'reviewer', { cwd: '/tmp' })).toThrow(
      "Rol 'reviewer' sin asignar: elígelo en Settings → Model routing",
    )
    expect(() => resolveRole(cfg(), 'reviewer')).toThrow(RoleUnassignedError)
  })

  it('does not migrate an API legacy model into a CLI executor', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-role-migration-'))
    try {
      writeFileSync(
        join(dir, 'orchestos.config.yaml'),
        'agent: codex\nmodels:\n  executor_heavy: { provider: openrouter, model: old-model }\n',
      )
      expect(loadOrcheConfig(dir).roles.executor).toBeUndefined()
      writeFileSync(
        join(dir, 'orchestos.config.yaml'),
        'agent: api\nmodels:\n  executor_heavy: { provider: openrouter, model: old-model }\n',
      )
      expect(loadOrcheConfig(dir).roles.executor).toEqual({
        agent: 'api',
        model: 'old-model',
        provider: 'openrouter',
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('routes explicit task model, executor assignment, or null', () => {
    expect(autoRoute({ ...task, executor_model: 'explicit' }, cfg())).toMatchObject({
      agent: 'api',
      model: 'explicit',
      source: 'task',
    })
    expect(
      autoRoute(task, cfg({ executor: { agent: 'codex', model: 'gpt-6-luna', effort: 'medium' } })),
    ).toMatchObject({ agent: 'codex', model: 'gpt-6-luna', effort: 'medium', source: 'executor' })
    expect(autoRoute(task, cfg())).toBeNull()
  })

  it('fails before the executor provider is called when reviewer is unassigned', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-no-reviewer-'))
    const oldFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = (async () => {
      calls++
      return new Response('{}')
    }) as unknown as typeof fetch
    try {
      const result = await runTask({
        projectRoot: dir,
        contextText: '',
        task: { ...task, output: ['out.txt'] },
        logger: new RunLogger(dir, 'no-reviewer'),
        sandboxMode: 'cwd',
        orcheConfig: cfg({
          executor: { agent: 'api', provider: 'openrouter', model: 'executor-model' },
        }),
      })
      expect(result.status).toBe('failed')
      expect(result.retryReason).toContain("Rol 'reviewer' sin asignar")
      expect(calls).toBe(0)
    } finally {
      globalThis.fetch = oldFetch
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
