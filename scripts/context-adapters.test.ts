import { Database } from 'bun:sqlite'
import { describe, expect, spyOn, test } from 'bun:test'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  type ContextAdapter,
  claudeAdapter,
  codexAdapter,
  createOpencodeAdapter,
  DEFAULT_ADAPTERS,
  readCodexRateLimitsLive,
  readContextBudget,
  readSessionMetrics,
} from './context-adapters.ts'

const fixtures = join(import.meta.dir, 'fixtures', 'context-adapters')
const fixture = (name: string) => join(fixtures, name)

describe('context adapters', () => {
  test('opencodeAdapter reads the latest assistant usage and catalog window from SQLite', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'orchestos-opencode-context-'))
    const dbPath = join(directory, 'opencode.db')
    const catalogPath = join(directory, 'models.json')
    const db = new Database(dbPath)
    db.exec(
      'CREATE TABLE session (id TEXT PRIMARY KEY, directory TEXT); CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, data TEXT)',
    )
    db.query('INSERT INTO session (id, directory) VALUES (?, ?)').run('ses_test', directory)
    const insert = db.query('INSERT INTO message (id, session_id, data) VALUES (?, ?, ?)')
    const message = (created: number, input: number) =>
      JSON.stringify({
        role: 'assistant',
        providerID: 'opencode',
        modelID: 'deepseek-v4-flash-free',
        time: { created },
        tokens: { input, output: 500, reasoning: 50, cache: { read: 2_000, write: 3_000 } },
      })
    insert.run('m_old', 'ses_test', message(1, 90_000))
    insert.run('m_latest', 'ses_test', message(2, 79_000))
    db.close()
    writeFileSync(
      catalogPath,
      JSON.stringify({
        opencode: { models: { 'deepseek-v4-flash-free': { limit: { context: 100_000 } } } },
      }),
    )
    const adapter = createOpencodeAdapter({ dbPath, catalogPath })
    try {
      expect(DEFAULT_ADAPTERS.map(({ id }) => id)).toEqual(['claude', 'codex', 'opencode'])
      await expect(adapter.read('not-an-opencode-session')).resolves.toBeNull()
      await expect(adapter.read('opencode-session:missing')).resolves.toBeNull()
      await expect(adapter.read('opencode-session:ses_test')).resolves.toEqual({
        used: 84_000,
        window: 100_000,
        model: 'opencode/deepseek-v4-flash-free',
      })
      await expect(
        readContextBudget('opencode-session:ses_test', [adapter]),
      ).resolves.toMatchObject({
        source: 'opencode',
        level: 'critical',
        pct: 84,
      })
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test('opencodeAdapter returns null without assistant tokens or a catalog model', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'orchestos-opencode-empty-'))
    const dbPath = join(directory, 'opencode.db')
    const catalogPath = join(directory, 'models.json')
    const db = new Database(dbPath)
    db.exec(
      'CREATE TABLE session (id TEXT PRIMARY KEY, directory TEXT); CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, data TEXT)',
    )
    db.query('INSERT INTO session (id, directory) VALUES (?, ?)').run('ses_empty', directory)
    db.query('INSERT INTO session (id, directory) VALUES (?, ?)').run(
      'ses_unknown_model',
      directory,
    )
    db.query('INSERT INTO message (id, session_id, data) VALUES (?, ?, ?)').run(
      'm_user',
      'ses_empty',
      JSON.stringify({ role: 'user', tokens: { input: 100 } }),
    )
    db.query('INSERT INTO message (id, session_id, data) VALUES (?, ?, ?)').run(
      'm_unknown',
      'ses_unknown_model',
      JSON.stringify({
        role: 'assistant',
        providerID: 'opencode',
        modelID: 'missing',
        tokens: { input: 100, cache: { read: 0, write: 0 } },
      }),
    )
    db.close()
    writeFileSync(catalogPath, JSON.stringify({ opencode: { models: {} } }))
    const adapter = createOpencodeAdapter({ dbPath, catalogPath })
    try {
      await expect(adapter.read('opencode-session:ses_empty')).resolves.toBeNull()
      await expect(adapter.read('opencode-session:ses_unknown_model')).resolves.toBeNull()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
  test('codexAdapter lee el uso y la ventana publicados por Codex CLI', async () => {
    expect(await codexAdapter.read(fixture('codex.jsonl'))).toEqual({
      used: 158_198,
      window: 258_400,
      model: 'gpt-5.6-codex',
    })
  })

  test('codexAdapter usa last_token_usage y no el acumulado total_token_usage', async () => {
    expect(await codexAdapter.read(fixture('codex-total-vs-last.jsonl'))).toMatchObject({
      used: 600,
      window: 1_000,
    })
  })

  test('los adaptadores rechazan el transcript del otro CLI por contenido', async () => {
    expect(
      await codexAdapter.read(join(import.meta.dir, 'fixtures', 'context-budget', 'usage.jsonl')),
    ).toBeNull()
    expect(await claudeAdapter.read(fixture('codex.jsonl'))).toBeNull()
  })

  test('codexAdapter toma el último evento token_count válido', async () => {
    expect(await codexAdapter.read(fixture('codex-last-event.jsonl'))).toMatchObject({
      used: 620,
      window: 1_000,
    })
  })

  test('codexAdapter ignora una última línea truncada', async () => {
    expect(await codexAdapter.read(fixture('codex-truncated.jsonl'))).toMatchObject({
      used: 610,
      window: 1_000,
    })
  })

  test('readContextBudget identifica Codex y aplica su umbral warn', async () => {
    expect(await readContextBudget(fixture('codex.jsonl'))).toMatchObject({
      source: 'codex',
      used: 158_198,
      window: 258_400,
      level: 'warn',
    })
  })

  test('separa las ventanas de cupo del contexto en un contrato normalizado', async () => {
    expect(await readSessionMetrics(fixture('codex.jsonl'))).toEqual({
      context: {
        source: 'codex',
        used: 158_198,
        window: 258_400,
        model: 'gpt-5.6-codex',
        pct: (158_198 / 258_400) * 100,
        level: 'warn',
      },
      rateLimits: {
        source: 'codex',
        windows: [
          {
            id: 'primary',
            usedPct: 45,
            remainingPct: 55,
            windowMinutes: 300,
            resetsAt: 1_788_460_888,
          },
          {
            id: 'secondary',
            usedPct: 34,
            remainingPct: 66,
            windowMinutes: 10_080,
            resetsAt: 1_788_749_893,
          },
        ],
      },
    })
  })

  test('un adaptador sin cupo devuelve null y no finge 0%', async () => {
    const fake: ContextAdapter = {
      id: 'future-cli',
      thresholds: { warn: 40, critical: 65 },
      read: async () => ({ used: 10, window: 100, model: null }),
    }

    expect(await readSessionMetrics(fixture('codex.jsonl'), [fake])).toMatchObject({
      context: { source: 'future-cli', pct: 10 },
      rateLimits: null,
    })
  })

  test('clasifica los bordes exactos del umbral warn al 40%', async () => {
    await expect(readContextBudget(fixture('codex-39-9.jsonl'))).resolves.toMatchObject({
      level: 'ok',
    })
    expect((await readContextBudget(fixture('codex-39-9.jsonl')))?.pct).toBeCloseTo(39.9)
    await expect(readContextBudget(fixture('codex-40.jsonl'))).resolves.toMatchObject({
      level: 'warn',
    })
    expect((await readContextBudget(fixture('codex-40.jsonl')))?.pct).toBe(40)
    await expect(readContextBudget(fixture('codex-65.jsonl'))).resolves.toMatchObject({
      pct: 65,
      level: 'critical',
    })
  })

  test('acepta un tercer adaptador inyectado: el registro es extensible', async () => {
    const fake: ContextAdapter = {
      id: 'fake',
      thresholds: { warn: 10, critical: 20 },
      read: async () => ({ used: 50, window: 100, model: 'x' }),
    }

    expect(await readContextBudget(fixture('codex.jsonl'), [fake])).toEqual({
      used: 50,
      window: 100,
      model: 'x',
      pct: 50,
      level: 'critical',
      source: 'fake',
    })
  })

  test('salta un adaptador que lanza y usa el siguiente', async () => {
    const broken: ContextAdapter = {
      id: 'broken',
      thresholds: { warn: 10, critical: 20 },
      read: async () => {
        throw new Error('broken adapter')
      },
    }
    const fake: ContextAdapter = {
      id: 'fake',
      thresholds: { warn: 10, critical: 20 },
      read: async () => ({ used: 10, window: 100, model: 'x' }),
    }

    expect(await readContextBudget(fixture('codex.jsonl'), [broken, fake])).toMatchObject({
      source: 'fake',
      level: 'warn',
    })
  })

  test('devuelve null cuando ningún adaptador reconoce el transcript', async () => {
    const unknown: ContextAdapter = {
      id: 'unknown',
      thresholds: { warn: 10, critical: 20 },
      read: async () => null,
    }

    expect(await readContextBudget(fixture('codex.jsonl'), [unknown])).toBeNull()
  })

  test('lee cuotas del app-server manteniendo stdin abierto tras initialized', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'orchestos-codex-rate-limits-'))
    const binary = join(directory, 'fake-codex')
    writeFileSync(
      binary,
      `#!/usr/bin/env bun
let input = ''
process.stdin.on('data', (chunk) => {
  input += chunk
  if (input.includes('"method":"initialized"')) {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { rateLimits: { primary: { usedPercent: 3, windowDurationMins: 300, resetsAt: 1788460888 } } } }) + '\\n')
  }
})
`,
    )
    chmodSync(binary, 0o755)
    try {
      await expect(readCodexRateLimitsLive({ binary, timeoutMs: 5_000 })).resolves.toEqual([
        {
          id: 'primary',
          usedPct: 3,
          remainingPct: 97,
          windowMinutes: 300,
          resetsAt: 1788460888,
        },
      ])
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }, 10_000)

  test('lee cuotas del app-server cuando responde después de una demora', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'orchestos-codex-rate-limits-late-'))
    const binary = join(directory, 'fake-codex')
    writeFileSync(
      binary,
      `#!/usr/bin/env bun
process.stdin.on('data', (chunk) => {
  if (chunk.toString().includes('"method":"initialized"')) {
    setTimeout(() => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { rateLimits: { primary: { usedPercent: 12 } } } }) + '\\n'), 100)
  }
})
`,
    )
    chmodSync(binary, 0o755)
    try {
      await expect(readCodexRateLimitsLive({ binary, timeoutMs: 1_000 })).resolves.toMatchObject([
        { id: 'primary', usedPct: 12, remainingPct: 88 },
      ])
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }, 5_000)

  test('devuelve [] si el app-server nunca responde dentro del tope', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'orchestos-codex-rate-limits-never-'))
    const binary = join(directory, 'fake-codex')
    writeFileSync(binary, '#!/usr/bin/env bun\nprocess.stdin.resume()\n')
    chmodSync(binary, 0o755)
    const startedAt = Date.now()
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(readCodexRateLimitsLive({ binary, timeoutMs: 300 })).resolves.toEqual([])
      expect(Date.now() - startedAt).toBeLessThan(2_000)
      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/tras \d+ ms \(tope 300 ms\)$/))
    } finally {
      errorSpy.mockRestore()
      rmSync(directory, { recursive: true, force: true })
    }
  }, 5_000)
})
