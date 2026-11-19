import { describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
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
        schemaVersion: 2,
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

describe('context budget percentage integration', () => {
  it('omits absoluteLevel and classifies a real transcript by window percentage', () => {
    const result = runBudget(90_000)
    expect(result.status, result.stderr).toBe(0)
    const budget = JSON.parse(result.stdout)
    expect(budget).not.toHaveProperty('absoluteLevel')
    expect(budget.level).toBe('ok')
  })
})

const TURN_WARNING =
  '80 turnos del cerebro en esta sesión: sugiero /cut (GOV.4). Cada turno relee todo el contexto.'

function turnFixture() {
  const root = mkdtempSync(join(tmpdir(), 'context-turns-'))
  const hook = join(root, '.claude/hooks/context-budget.js')
  const transcript = join(root, 'transcript.jsonl')
  mkdirSync(join(root, '.claude/hooks'), { recursive: true })
  copyFileSync(join(ROOT, '.claude/hooks/context-budget.js'), hook)
  mkdirSync(join(root, 'bin'))
  // Stub only the budget/handoff commands; execute the actual hook with Node.
  writeFileSync(
    join(root, 'bin/bun'),
    `#!/usr/bin/env node
const fs = require('node:fs')
if (process.argv.includes('context:budget')) {
  console.log(JSON.stringify({used: 1, window: 100, pct: 1, model: null, source: 'claude', level: process.env.TEST_BUDGET_LEVEL || 'ok'}))
} else {
  fs.appendFileSync(${JSON.stringify(join(root, 'handoffs'))}, 'handoff\\n')
}
`,
  )
  chmodSync(join(root, 'bin/bun'), 0o755)
  return {
    root,
    transcript,
    write(turns: number, repeats = 1) {
      const lines = ['invalid JSON', JSON.stringify({ type: 'user' })]
      for (let i = 0; i < turns; i += 1) {
        const message = JSON.stringify({
          type: 'assistant',
          message: { id: `turn-${i}`, content: [{ type: 'tool_use', name: 'Read' }] },
        })
        for (let repeat = 0; repeat < repeats; repeat += 1) lines.push(message)
      }
      lines.push(
        JSON.stringify({ type: 'assistant', message: { id: 'text', content: [{ type: 'text' }] } }),
      )
      writeFileSync(transcript, lines.join('\n'))
    },
    run(session_id = 'session', level = 'ok', transcript_path = transcript) {
      const result = spawnSync('node', [hook], {
        input: JSON.stringify({ transcript_path, session_id }),
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${join(root, 'bin')}:${process.env.PATH}`,
          TEST_BUDGET_LEVEL: level,
        },
      })
      expect(result.status, result.stderr).toBe(0)
      return result.stdout
    },
  }
}

describe('GOV.4 turn warning', () => {
  it('counts distinct assistant tool turns, warns at 80 once per session', () => {
    const fixture = turnFixture()
    try {
      fixture.write(79, 2)
      expect(fixture.run()).toBe('')
      fixture.write(80, 2)
      expect(fixture.run()).toContain(TURN_WARNING)
      expect(fixture.run()).toBe('')
      expect(fixture.run('other')).toContain(TURN_WARNING)
      expect(fixture.run()).toBe('')
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('preserves token warnings and never writes an extra handoff for turns', () => {
    const fixture = turnFixture()
    try {
      fixture.write(79)
      expect(fixture.run('session', 'warn')).toContain('Contexto alto')
      fixture.write(80)
      expect(fixture.run('session', 'warn')).toBe(`${TURN_WARNING}\n`)
      expect(fixture.run('session', 'warn')).toBe('')
      expect(readFileSync(join(fixture.root, 'handoffs'), 'utf8')).toBe('handoff\n')
      expect(fixture.run('session', 'critical')).toContain('Contexto crítico')
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('keeps the turn warning state when token warning fires on the same call', () => {
    const fixture = turnFixture()
    try {
      fixture.write(80)
      const first = fixture.run('session', 'warn')
      expect(first).toContain(TURN_WARNING)
      expect(first).toContain('Contexto alto')
      expect(fixture.run('session', 'warn')).toBe('')
      expect(readFileSync(join(fixture.root, 'handoffs'), 'utf8')).toBe('handoff\n')
      expect(fixture.run('opencode', 'ok', 'opencode-session:example')).toBe('')
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })
})
