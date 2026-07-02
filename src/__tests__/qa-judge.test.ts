import { describe, it, expect } from 'bun:test'
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { resolveQAJudge, QA_JUDGE_DEFAULTS } from '../run/harness.ts'
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
