import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { budgetStatus, readTranscriptUsage } from './context-budget.ts'

const fixtures = join(import.meta.dir, 'fixtures', 'context-budget')

describe('context budget', () => {
  test('takes only the last valid transcript usage and includes cache tokens', () => {
    expect(readTranscriptUsage(join(fixtures, 'usage.jsonl'))).toEqual({
      used: 84_360,
      model: 'claude-opus-5',
    })
  })

  test('ignores corrupt JSONL lines instead of losing later usage', () => {
    expect(readTranscriptUsage(join(fixtures, 'corrupt.jsonl'))).toEqual({
      used: 12,
      model: 'final-model',
    })
  })

  test('returns null when the transcript has no assistant usage', () => {
    expect(readTranscriptUsage(join(fixtures, 'no-usage.jsonl'))).toBeNull()
  })

  test('returns a real catalog window and fails open for an unknown model', async () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-context-budget-'))
    try {
      const cacheDir = join(home, '.orchestos', 'cache')
      mkdirSync(cacheDir, { recursive: true })
      writeFileSync(
        join(cacheDir, 'models.json'),
        JSON.stringify({
          schemaVersion: 2,
          fetchedAt: Date.now(),
          models: {
            'known/model': {
              contextLength: 32_000,
              priceIn: 0,
              priceOut: 0,
              supportsReasoning: false,
              supportsTools: false,
              maxOutputTokens: 0,
              supportsVision: false,
            },
            'anthropic/claude-opus-5': {
              contextLength: 1_000_000,
              priceIn: 0,
              priceOut: 0,
              supportsReasoning: false,
              supportsTools: false,
              maxOutputTokens: 0,
              supportsVision: false,
            },
            'anthropic/claude-haiku-4.5': {
              contextLength: 200_000,
              priceIn: 0,
              priceOut: 0,
              supportsReasoning: false,
              supportsTools: false,
              maxOutputTokens: 0,
              supportsVision: false,
            },
            'provider-a/same-model': {
              contextLength: 32_000,
              priceIn: 0,
              priceOut: 0,
              supportsReasoning: false,
              supportsTools: false,
              maxOutputTokens: 0,
              supportsVision: false,
            },
            'provider-b/same-model': {
              contextLength: 64_000,
              priceIn: 0,
              priceOut: 0,
              supportsReasoning: false,
              supportsTools: false,
              maxOutputTokens: 0,
              supportsVision: false,
            },
          },
        }),
      )
      const proc = Bun.spawn(
        [
          'bun',
          '-e',
          `
        process.env.ORCHESTOS_HOME = ${JSON.stringify(home)}
        const { contextWindowFor } = await import('./scripts/context-budget.ts')
        console.log(JSON.stringify({
          known: await contextWindowFor('known/model'),
          providerless: await contextWindowFor('claude-opus-5'),
          dated: await contextWindowFor('claude-haiku-4-5-20251001'),
          ambiguous: await contextWindowFor('same-model'),
          unknown: await contextWindowFor('unknown/model'),
        }))
      `,
        ],
        { cwd: process.cwd(), stdout: 'pipe', stderr: 'pipe' },
      )
      const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      expect(exitCode, stderr).toBe(0)
      expect(JSON.parse(stdout)).toEqual({
        known: 32_000,
        providerless: 1_000_000,
        dated: 200_000,
        ambiguous: null,
        unknown: null,
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  test('classifies configurable warning and critical thresholds', () => {
    expect(budgetStatus({ used: 39, window: 100 })).toEqual({ pct: 39, level: 'ok' })
    expect(budgetStatus({ used: 40, window: 100 })).toEqual({ pct: 40, level: 'warn' })
    expect(budgetStatus({ used: 75, window: 100 })).toEqual({ pct: 75, level: 'critical' })
    expect(budgetStatus({ used: 50, window: 100, thresholds: { warn: 50, critical: 80 } })).toEqual(
      { pct: 50, level: 'warn' },
    )
  })

  test('249_999 / 1_000_000 queda ok; 250_000 / 1_000_000 avisa por tokens', () => {
    expect(budgetStatus({ used: 249_999, window: 1_000_000 })).toEqual({
      pct: 24.9999,
      level: 'ok',
    })
    expect(budgetStatus({ used: 250_000, window: 1_000_000 })).toEqual({ pct: 25, level: 'warn' })
  })

  test('400_000 / 1_000_000 es crítico por tokens', () => {
    expect(budgetStatus({ used: 400_000, window: 1_000_000 })).toEqual({
      pct: 40,
      level: 'critical',
    })
  })

  test('80_000 / 200_000 avisa por porcentaje y 79_999 / 200_000 queda ok', () => {
    expect(budgetStatus({ used: 80_000, window: 200_000 })).toEqual({ pct: 40, level: 'warn' })
    expect(budgetStatus({ used: 79_999, window: 200_000 })).toEqual({ pct: 39.9995, level: 'ok' })
  })

  test('rechaza criticalTokens menor que warnTokens', () => {
    expect(() =>
      budgetStatus({
        used: 0,
        window: 1,
        thresholds: { warn: 40, critical: 65, warnTokens: 400_000, criticalTokens: 250_000 },
      }),
    ).toThrow('invalid budget thresholds')
  })
})
