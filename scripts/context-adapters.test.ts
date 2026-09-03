import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  type ContextAdapter,
  claudeAdapter,
  codexAdapter,
  readContextBudget,
  readSessionMetrics,
} from './context-adapters.ts'

const fixtures = join(import.meta.dir, 'fixtures', 'context-adapters')
const fixture = (name: string) => join(fixtures, name)

describe('context adapters', () => {
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
          { id: 'primary', usedPct: 45, windowMinutes: 300, resetsAt: 1_788_460_888 },
          { id: 'secondary', usedPct: 34, windowMinutes: 10_080, resetsAt: 1_788_749_893 },
        ],
      },
    })
  })

  test('un adaptador sin cupo devuelve null y no finge 0%', async () => {
    const fake: ContextAdapter = {
      id: 'future-cli',
      thresholds: { warn: 60, critical: 65 },
      read: async () => ({ used: 10, window: 100, model: null }),
    }

    expect(await readSessionMetrics(fixture('codex.jsonl'), [fake])).toMatchObject({
      context: { source: 'future-cli', pct: 10 },
      rateLimits: null,
    })
  })

  test('clasifica los bordes exactos de los umbrales por defecto', async () => {
    await expect(readContextBudget(fixture('codex-59-9.jsonl'))).resolves.toMatchObject({
      pct: 59.9,
      level: 'ok',
    })
    await expect(readContextBudget(fixture('codex-60.jsonl'))).resolves.toMatchObject({
      pct: 60,
      level: 'warn',
    })
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
})
