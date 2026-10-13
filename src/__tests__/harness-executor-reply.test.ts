/**
 * ERP.4.8 — el run fallido guarda lo que respondió el ejecutor (`runs.executor_reply`).
 *
 * El "CLI" se mockea con Bun.spawn/Bun.which (mismo patrón que external-engine.test.ts);
 * el worktree y la DB son reales.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { DEFAULT_CONFIG } from '../config/schema.ts'
import { getRun, insertRun } from '../db/runs.ts'
import { db } from '../db/sqlite.ts'
import { _resetCatalog } from '../router/model-catalog.ts'
import { git } from '../run/sandbox.ts'
import type { Task } from '../tasks/schema.ts'

const TASK_ID = 'erp48-executor-reply'
const _testOrchHome = mkdtempSync(join(tmpdir(), 'orchestos-erp48-home-'))
mkdirSync(join(_testOrchHome, '.orchestos', 'cache'), { recursive: true })
writeFileSync(
  join(_testOrchHome, '.orchestos', 'cache', 'models.json'),
  JSON.stringify({
    schemaVersion: 2,
    fetchedAt: Date.now(),
    models: {
      'anthropic/claude-haiku-4-5': {
        contextLength: 200000,
        priceIn: 0.8,
        priceOut: 4,
        supportsReasoning: false,
        maxOutputTokens: 8192,
      },
    },
  }),
)
const _prevOrchHome = process.env.ORCHESTOS_HOME
const _prevApiKey = process.env.OPENROUTER_API_KEY
const originalSpawn = Bun.spawn
const originalWhich = Bun.which
const repos: string[] = []

beforeAll(async () => {
  process.env.ORCHESTOS_HOME = _testOrchHome
  // El QA (reviewer api/openrouter) exige la clave; sin esto lee ~/.orchestos/.env del host.
  process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
  _resetCatalog()
  const { runMigrations } = await import('../db/migrate.ts')
  runMigrations()
})

afterEach(() => {
  Bun.spawn = originalSpawn
  Bun.which = originalWhich
})

afterAll(() => {
  db.run('DELETE FROM runs WHERE task_id = ?', [TASK_ID])
  if (_prevOrchHome === undefined) delete process.env.ORCHESTOS_HOME
  else process.env.ORCHESTOS_HOME = _prevOrchHome
  if (_prevApiKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = _prevApiKey
  for (const r of repos.splice(0)) rmSync(r, { recursive: true, force: true })
})

function makeGitRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-erp48-'))
  repos.push(dir)
  git(['init', '-b', 'main'], dir)
  git(['config', 'user.email', 'test@test.com'], dir)
  git(['config', 'user.name', 'Test'], dir)
  writeFileSync(join(dir, 'README.md'), 'init')
  git(['add', '-A'], dir)
  git(['-c', 'user.name=Test', '-c', 'user.email=test@test.com', 'commit', '-m', 'init'], dir)
  return dir
}

/** Simula `claude -p`: emite la línea `result` con `reply` y no escribe nada. */
function mockClaude(reply: string, writeFile?: string) {
  const encoder = new TextEncoder()
  const line = `${JSON.stringify({
    type: 'result',
    result: reply,
    usage: { input_tokens: 10, output_tokens: 5 },
    total_cost_usd: 0.001,
    session_id: 'erp48-session',
    num_turns: 1,
  })}\n`
  ;(Bun as any).which = (_bin: string) => '/usr/local/bin/claude'
  Bun.spawn = ((_cmd: string[], o?: { cwd?: string }) => {
    if (writeFile && o?.cwd) writeFileSync(join(o.cwd, writeFile), 'hola\n')
    return {
      stdin: { write() {}, end() {} },
      stdout: new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(encoder.encode(line))
          c.close()
        },
      }),
      stderr: new ReadableStream<Uint8Array>({
        start(c) {
          c.close()
        },
      }),
      exited: Promise.resolve(0),
      kill() {},
    }
  }) as unknown as typeof Bun.spawn
}

async function runExternal(dir: string, task: Task) {
  const { runTask } = await import('../run/harness.ts')
  const { RunLogger } = await import('../run/logger.ts')
  return runTask({
    projectRoot: dir,
    contextText: '',
    task: { ...task, engine: 'external' },
    logger: new RunLogger(dir, task.id),
    sandboxMode: 'worktree',
    sandboxBranch: 'main',
    modelOverride: 'anthropic/claude-haiku-4-5',
    orcheConfig: {
      ...DEFAULT_CONFIG,
      roles: {
        executor: { agent: 'claude', model: 'anthropic/claude-haiku-4-5' },
        reviewer: { agent: 'api', provider: 'openrouter', model: 'mock/reviewer' },
      },
    },
  } as any)
}

function baseTask(): Task {
  return {
    id: TASK_ID,
    description: 'ERP.4.8 executor reply',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
  }
}

function minimalRun(overrides: Record<string, unknown> = {}) {
  return {
    project_id: null,
    prompt: 'p',
    task_class: 'test',
    model: 'm',
    provider: 'test',
    skill_id: null,
    task_id: TASK_ID,
    allowed_outputs: null,
    files_attempted: null,
    files_authorized: null,
    files_blocked: null,
    snapshot_before: null,
    snapshot_after: null,
    qa_verdict: null,
    qa_reason: null,
    status: 'failed' as const,
    input_tokens: 0,
    output_tokens: 0,
    usd_cost: 0,
    elapsed_ms: 0,
    result: null,
    ...overrides,
  }
}

describe('ERP.4.8 — runs.executor_reply', () => {
  it('salida declarada ausente: guarda el texto final del ejecutor junto al motivo', async () => {
    const dir = makeGitRepo()
    mockClaude('No escribí nada: esto es un veredicto de revisión.')
    const result = await runExternal(dir, baseTask())
    expect(result.status).not.toBe('done')
    const row = db
      .query('SELECT id FROM runs WHERE task_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(TASK_ID) as { id: string }
    const saved = getRun(row.id)!
    expect(saved.result).toMatch(/missing declared output/)
    expect(saved.executor_reply).toBe('No escribí nada: esto es un veredicto de revisión.')
  })

  it('un run done no guarda executor_reply', async () => {
    const dir = makeGitRepo()
    mockClaude('Listo, escribí out.txt.', 'out.txt')
    const origFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ verdict: 'pass', reason: 'ok' }) } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
          model: 'mock/reviewer',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as unknown as typeof fetch
    try {
      const result = await runExternal(dir, baseTask())
      expect(result.status).toBe('done')
      const row = db
        .query('SELECT id FROM runs WHERE task_id = ? ORDER BY created_at DESC LIMIT 1')
        .get(TASK_ID) as { id: string }
      const saved = getRun(row.id)!
      expect(saved.status).toBe('done')
      expect(saved.executor_reply).toBeNull()
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('recorta a 4000 caracteres y termina en …', () => {
    const id = insertRun(minimalRun({ executor_reply: 'x'.repeat(5000) }))
    const reply = getRun(id)!.executor_reply!
    expect(reply.length).toBe(4000)
    expect(reply.endsWith('…')).toBe(true)
  })

  it('redacta un secreto dentro de executor_reply', () => {
    const secret = ['sk-or-v1-', '12345678901234567890123456789012'].join('')
    const id = insertRun(minimalRun({ executor_reply: `la clave es ${secret} ok` }))
    const reply = getRun(id)!.executor_reply!
    expect(reply).not.toContain(secret)
    expect(reply).toContain('[REDACTED:provider-key]')
  })
})
