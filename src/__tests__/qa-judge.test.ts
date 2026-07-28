import { describe, it, expect } from 'bun:test'
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { resolveQAJudge, QA_JUDGE_DEFAULTS } from '../run/harness.ts'
import { runQA } from '../run/qa.ts'
import { RunLogger } from '../run/logger.ts'
import type { OrcheConfig } from '../config/schema.ts'

function freshLogger() {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-qa-judge-'))
  return { dir, log: new RunLogger(dir, 'qa-test') }
}

function makeConfig(qa?: { provider: string; model: string }): OrcheConfig {
  return {
    config_version: 1,
    models: {
      planner:        { provider: 'openrouter', model: 'm' },
      executor_heavy: { provider: 'openrouter', model: 'm' },
      executor_light: { provider: 'openrouter', model: 'm' },
      default:        { provider: 'openrouter', model: 'm' },
      qa,
    },
  }
}

describe('resolveQAJudge — F2.4', () => {
  it('explicit orcheConfig.models.qa wins over the default (case 1)', () => {
    const { dir, log } = freshLogger()
    try {
      const cfg = makeConfig({ provider: 'openai', model: 'gpt-4' })
      const judge = resolveQAJudge('openrouter', 'deepseek/deepseek-v4-flash', cfg, log)
      expect(judge.model).toBe('gpt-4')
      expect(judge.provider.name).toBe('openai')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('default differs from the executor (case 2: openrouter/deepseek → openrouter/openai-gpt-4o-mini)', () => {
    const { dir, log } = freshLogger()
    try {
      const judge = resolveQAJudge('openrouter', 'deepseek/deepseek-v4-flash', undefined, log)
      const expected = QA_JUDGE_DEFAULTS.openrouter!
      expect(judge.model).toBe(expected.model)
      expect(judge.provider.name).toBe(expected.provider)
      expect(judge.model).not.toBe('deepseek/deepseek-v4-flash')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('default for anthropic executor is anthropic/claude-haiku-4-5 (case 2 sub-case)', () => {
    const { dir, log } = freshLogger()
    try {
      const judge = resolveQAJudge('anthropic', 'claude-opus-4-7', undefined, log)
      expect(judge.model).toBe('claude-haiku-4-5')
      expect(judge.provider.name).toBe('anthropic')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('default for openai executor is openai/gpt-4o-mini (case 2 sub-case)', () => {
    const { dir, log } = freshLogger()
    try {
      const judge = resolveQAJudge('openai', 'gpt-4o', undefined, log)
      expect(judge.model).toBe('gpt-4o-mini')
      expect(judge.provider.name).toBe('openai')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('colliding default (openrouter executor already IS the openrouter default model) falls back to anthropic/claude-haiku-4-5 via openrouter (case 3)', () => {
    const { dir, log } = freshLogger()
    try {
      const defaultOrModel = QA_JUDGE_DEFAULTS.openrouter!.model
      const judge = resolveQAJudge('openrouter', defaultOrModel, undefined, log)
      expect(judge.model).toBe('anthropic/claude-haiku-4-5')
      expect(judge.provider.name).toBe('openrouter')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('judge == executor is only reachable via explicit config, and the log records the correlation-risk warning (case 4)', () => {
    const { dir, log } = freshLogger()
    try {
      const cfg = makeConfig({ provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' })
      const judge = resolveQAJudge('openrouter', 'deepseek/deepseek-v4-flash', cfg, log)
      expect(judge.model).toBe('deepseek/deepseek-v4-flash')
      expect(judge.provider.name).toBe('openrouter')

      // el log debe contener el warning de correlación
      const logFiles = readdirSync(join(dir, 'runs')).sort()
      const last = logFiles[logFiles.length - 1]!
      const contents = readFileSync(join(dir, 'runs', last), 'utf-8')
      expect(contents).toContain('qa judge equals executor model — correlated errors risk')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('falls back to QA_JUDGE_DEFAULTS.openrouter for unknown executor providers', () => {
    const { dir, log } = freshLogger()
    try {
      const judge = resolveQAJudge('unknown-provider', 'some-model', undefined, log)
      expect(judge.model).toBe(QA_JUDGE_DEFAULTS.openrouter!.model)
      expect(judge.provider.name).toBe('openrouter')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('runQA — K.1 criterion evidence', () => {
  it('forces a criterion without evidence to fail', async () => {
    const result = await runQA({
      description: 'Add a greeting',
      output: ['src/greeting.ts'],
      written: [{ path: 'src/greeting.ts', content: 'export const greeting = "hello"' }],
      model: 'test-model',
      acceptance_criteria: ['The module exports greeting'],
      checksResults: [],
      provider: {
        name: 'test',
        chat: async () => ({
          text: JSON.stringify({
            verdict: 'pass',
            reason: 'Looks good',
            criteria: [{ text: 'The module exports greeting', pass: true }],
          }),
          inputTokens: 1,
          outputTokens: 1,
          model: 'test-model',
        }),
      },
    })

    expect(result.verdict).toBe('fail')
    expect(result.criteria).toEqual([
      { text: 'The module exports greeting', pass: false },
    ])
  })

  it('preserves literal evidence for a passing criterion', async () => {
    const result = await runQA({
      description: 'Add a greeting',
      output: ['src/greeting.ts'],
      written: [{ path: 'src/greeting.ts', content: 'export const greeting = "hello"' }],
      model: 'test-model',
      acceptance_criteria: ['The module exports greeting'],
      checksResults: [],
      provider: {
        name: 'test',
        chat: async () => ({
          text: JSON.stringify({
            verdict: 'pass',
            reason: 'Evidence found',
            criteria: [{
              text: 'The module exports greeting',
              pass: true,
              evidence: { file: 'src/greeting.ts', excerpt: 'export const greeting = "hello"' },
            }],
          }),
          inputTokens: 1,
          outputTokens: 1,
          model: 'test-model',
        }),
      },
    })

    expect(result.verdict).toBe('pass')
    expect(result.criteria?.[0]?.evidence).toEqual({
      file: 'src/greeting.ts',
      excerpt: 'export const greeting = "hello"',
    })
  })

  it('K.4a — forces a criterion to fail when the cited excerpt is fabricated (not a literal substring)', async () => {
    const result = await runQA({
      description: 'Add a greeting',
      output: ['src/greeting.ts'],
      written: [{ path: 'src/greeting.ts', content: 'export const greeting = "hello"' }],
      model: 'test-model',
      acceptance_criteria: ['The module exports greeting'],
      checksResults: [],
      provider: {
        name: 'test',
        chat: async () => ({
          text: JSON.stringify({
            verdict: 'pass',
            reason: 'Evidence found',
            criteria: [{
              text: 'The module exports greeting',
              pass: true,
              evidence: { file: 'src/greeting.ts', excerpt: 'export function greeting() { return "hello" }' },
            }],
          }),
          inputTokens: 1,
          outputTokens: 1,
          model: 'test-model',
        }),
      },
    })

    expect(result.verdict).toBe('fail')
    expect(result.criteria?.[0]?.pass).toBe(false)
  })

  it('K.4a limitation — accepts literal evidence from the wrong context', async () => {
    const written = [{
      path: 'src/math.ts',
      content: '// TODO: implement sum(a, b)\nexport const label = "unrelated module"',
    }]
    const result = await runQA({
      description: 'Implement a function sum that adds two numbers',
      output: ['src/math.ts'],
      written,
      model: 'test-model',
      acceptance_criteria: ['The module exports a function sum that adds two numbers'],
      checksResults: [],
      provider: {
        name: 'test',
        chat: async () => ({
          text: JSON.stringify({
            verdict: 'pass',
            reason: 'The excerpt mentions sum',
            criteria: [{
              text: 'The module exports a function sum that adds two numbers',
              pass: true,
              evidence: { file: 'src/math.ts', excerpt: '// TODO: implement sum(a, b)' },
            }],
          }),
          inputTokens: 1,
          outputTokens: 1,
          model: 'test-model',
        }),
      },
    })

    // Hallazgo: evidencia literal, pero solo comentario; K.4a deja pasar.
    expect(result.verdict).toBe('pass')
    expect(result.criteria?.[0]?.pass).toBe(true)
  })

  it('K.4a limitation — accepts literal evidence for unreachable code', async () => {
    const written = [{
      path: 'src/math.ts',
      content: 'if (false) {\n  export function sum(a, b) { return a + b }\n}\n',
    }]
    const result = await runQA({
      description: 'Implement a function sum that adds two numbers',
      output: ['src/math.ts'],
      written,
      model: 'test-model',
      acceptance_criteria: ['The module provides a callable sum function that adds two numbers'],
      checksResults: [],
      provider: {
        name: 'test',
        chat: async () => ({
          text: JSON.stringify({
            verdict: 'pass',
            reason: 'The sum implementation is present',
            criteria: [{
              text: 'The module provides a callable sum function that adds two numbers',
              pass: true,
              evidence: { file: 'src/math.ts', excerpt: 'export function sum(a, b) { return a + b }' },
            }],
          }),
          inputTokens: 1,
          outputTokens: 1,
          model: 'test-model',
        }),
      },
    })

    // Hallazgo: la cita es código real, pero está en un branch muerto; K.4a deja pasar.
    expect(result.verdict).toBe('pass')
    expect(result.criteria?.[0]?.pass).toBe(true)
  })

  it('K.4a limitation — accepts literal evidence that contradicts the criterion', async () => {
    const written = [{
      path: 'src/validate.ts',
      content: 'export function validate(input) {\n  if (isInvalid(input)) return null\n  return input\n}\n',
    }]
    const result = await runQA({
      description: 'Reject invalid input by throwing an error',
      output: ['src/validate.ts'],
      written,
      model: 'test-model',
      acceptance_criteria: ['The function throws an error when the input is invalid'],
      checksResults: [],
      provider: {
        name: 'test',
        chat: async () => ({
          text: JSON.stringify({
            verdict: 'pass',
            reason: 'The invalid-input branch is handled',
            criteria: [{
              text: 'The function throws an error when the input is invalid',
              pass: true,
              evidence: { file: 'src/validate.ts', excerpt: 'if (isInvalid(input)) return null' },
            }],
          }),
          inputTokens: 1,
          outputTokens: 1,
          model: 'test-model',
        }),
      },
    })

    // Hallazgo: la cita hace lo contrario de lo pedido, pero es literal; K.4a deja pasar.
    expect(result.verdict).toBe('pass')
    expect(result.criteria?.[0]?.pass).toBe(true)
  })
})

describe('runQA — K.2 checks context', () => {
  it('includes command and exit code for executed checks', async () => {
    let userContent = ''
    await runQA({
      description: 'Run checks',
      output: ['src/greeting.ts'],
      written: [{ path: 'src/greeting.ts', content: 'export const greeting = "hello"' }],
      model: 'test-model',
      checksResults: [{ cmd: 'bunx tsc --noEmit', exitCode: 0, stdout: '', stderr: '', elapsedMs: 12, timedOut: false }],
      provider: {
        name: 'test',
        chat: async opts => {
          userContent = opts.messages[0]?.content ?? ''
          return { text: '{"verdict":"pass","reason":"ok"}', inputTokens: 1, outputTokens: 1, model: 'test-model' }
        },
      },
    })

    expect(userContent).toContain('## Checks executed')
    expect(userContent).toContain('bunx tsc --noEmit')
    expect(userContent).toContain('exitCode: 0')
  })

  it('explicitly reports when no mechanical checks ran', async () => {
    let userContent = ''
    await runQA({
      description: 'Review output',
      output: ['notes.md'],
      written: [{ path: 'notes.md', content: 'A useful note.' }],
      model: 'test-model',
      checksResults: [],
      provider: {
        name: 'test',
        chat: async opts => {
          userContent = opts.messages[0]?.content ?? ''
          return { text: '{"verdict":"pass","reason":"ok"}', inputTokens: 1, outputTokens: 1, model: 'test-model' }
        },
      },
    })

    expect(userContent).toContain('## Checks executed')
    expect(userContent).toContain('NINGUNA verificación mecánica corrió.')
  })
})
