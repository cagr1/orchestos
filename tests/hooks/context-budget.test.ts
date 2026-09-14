import { describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')

function runBudget(used: number) {
  const tempDir = mkdtempSync(join(tmpdir(), 'context-budget-'))
  const transcriptPath = join(tempDir, 'transcript.jsonl')
  try {
    const cacheDir = join(tempDir, '.orchestos', 'cache')
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(
      join(cacheDir, 'models.json'),
      JSON.stringify({
        fetchedAt: Date.now(),
        models: {
          'anthropic/claude-opus-5': {
            contextLength: 1_000_000,
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
    writeFileSync(
      transcriptPath,
      `${JSON.stringify({
        type: 'assistant',
        message: {
          model: 'claude-opus-5',
          usage: { input_tokens: used },
        },
      })}\n`,
    )
    return spawnSync(
      'bun',
      ['run', 'scripts/context-budget.ts', '--', '--transcript', transcriptPath],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, ORCHESTOS_HOME: tempDir },
      },
    )
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

describe('context budget absolute threshold integration', () => {
  it('reports block for a real transcript at 90,000 tokens', () => {
    const result = runBudget(90_000)
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).absoluteLevel).toBe('block')
  })

  it('reports warn for a real transcript at 65,000 tokens', () => {
    const result = runBudget(65_000)
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).absoluteLevel).toBe('warn')
  })
})
