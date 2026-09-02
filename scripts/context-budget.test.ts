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
        console.log(JSON.stringify({ known: await contextWindowFor('known/model'), unknown: await contextWindowFor('unknown/model') }))
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
      expect(JSON.parse(stdout)).toEqual({ known: 32_000, unknown: null })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  test('classifies configurable warning and critical thresholds', () => {
    expect(budgetStatus({ used: 59, window: 100 })).toEqual({ pct: 59, level: 'ok' })
    expect(budgetStatus({ used: 60, window: 100 })).toEqual({ pct: 60, level: 'warn' })
    expect(budgetStatus({ used: 75, window: 100 })).toEqual({ pct: 75, level: 'critical' })
    expect(budgetStatus({ used: 50, window: 100, thresholds: { warn: 50, critical: 80 } })).toEqual(
      { pct: 50, level: 'warn' },
    )
  })
})
