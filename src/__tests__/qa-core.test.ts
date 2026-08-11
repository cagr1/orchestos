import { describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { computeFileDiffs, restoreContents, runAdversarialQA, runQA, runRefuter, snapshotContents } from '../run/qa.ts'
import type { ProviderClient } from '../providers/index.ts'

function freshRoot() {
  return mkdtempSync(join(tmpdir(), 'orchestos-qa-core-'))
}

function providerReply(text: string, onMessage?: (content: string) => void): ProviderClient {
  return {
    name: 'test',
    chat: async opts => {
      onMessage?.(opts.messages[0]?.content ?? '')
      return { text, inputTokens: 1, outputTokens: 1, model: 'test-model' }
    },
  }
}

describe('snapshotContents', () => {
  it('captures existing contents and records absent files distinctly', () => {
    const root = freshRoot()
    try {
      writeFileSync(join(root, 'existing.txt'), 'before', 'utf-8')

      expect(snapshotContents(root, ['existing.txt', 'new.txt'])).toEqual({
        'existing.txt': { existed: true, content: 'before' },
        'new.txt': { existed: false, content: '' },
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('restoreContents', () => {
  it('restores existing files and removes files recorded as absent', () => {
    const root = freshRoot()
    try {
      const existing = join(root, 'existing.txt')
      const created = join(root, 'created.txt')
      writeFileSync(existing, 'mutated', 'utf-8')
      writeFileSync(created, 'should be removed', 'utf-8')

      restoreContents(root, {
        'existing.txt': { existed: true, content: 'before' },
        'created.txt': { existed: false, content: '' },
      })

      expect(readFileSync(existing, 'utf-8')).toBe('before')
      expect(existsSync(created)).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not try to remove an absent file recorded as absent', () => {
    const root = freshRoot()
    try {
      restoreContents(root, {
        'never-created.txt': { existed: false, content: '' },
      })

      expect(existsSync(join(root, 'never-created.txt'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('computeFileDiffs', () => {
  it('marks a file without a prior snapshot as added', () => {
    const result = computeFileDiffs({}, [{ path: 'new.txt', content: 'new content' }])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ path: 'new.txt', status: 'added' })
    expect(result[0]!.diff).not.toContain('-Stryker was here!')
    expect(result[0]!.diff).toContain('+new content')
  })

  it('marks a file with a prior snapshot as modified', () => {
    const result = computeFileDiffs(
      { 'changed.txt': { existed: true, content: 'before' } },
      [{ path: 'changed.txt', content: 'after' }],
    )

    expect(result[0]).toMatchObject({ path: 'changed.txt', status: 'modified' })
    expect(result[0]!.diff).toContain('-before')
    expect(result[0]!.diff).toContain('+after')
  })

  it('produces a stable diff for unchanged content', () => {
    const result = computeFileDiffs(
      { 'same.txt': { existed: true, content: 'unchanged' } },
      [{ path: 'same.txt', content: 'unchanged' }],
    )

    expect(result[0]).toMatchObject({ path: 'same.txt', status: 'modified' })
    expect(result[0]!.diff).toContain('same.txt')
    expect(result[0]!.diff).not.toContain('-unchanged')
    expect(result[0]!.diff).not.toContain('+unchanged')
  })

  it('includes the file path and unified changed lines in the diff', () => {
    const result = computeFileDiffs(
      { 'src/example.ts': { existed: true, content: 'const oldValue = 1\n' } },
      [{ path: 'src/example.ts', content: 'const newValue = 2\n' }],
    )

    expect(result[0]!.path).toBe('src/example.ts')
    expect(result[0]!.diff).toContain('src/example.ts')
    expect(result[0]!.diff).toContain('-const oldValue = 1')
    expect(result[0]!.diff).toContain('+const newValue = 2')
  })
})

describe('runQA and parseVerdict', () => {
  it('handles a pass without criteria and includes every written file', async () => {
    let userContent = ''
    const result = await runQA({
      description: 'Review two files',
      output: ['src/one.ts', 'src/two.ts'],
      written: [
        { path: 'src/one.ts', content: 'export const one = 1' },
        { path: 'src/two.ts', content: 'export const two = 2' },
      ],
      model: 'test-model',
      checksResults: [],
      provider: providerReply('{"verdict":"pass","reason":"looks good"}', content => { userContent = content }),
    })

    expect(result).toMatchObject({ verdict: 'pass', reason: 'looks good' })
    expect(result.criteria).toBeUndefined()
    expect(userContent).toContain('### src/one.ts')
    expect(userContent).toContain('export const two = 2')
    expect(userContent).not.toContain('## Acceptance criteria')
  })

  it('fails closed when the provider returns invalid JSON', async () => {
    const result = await runQA({
      description: 'Review output',
      output: ['notes.md'],
      written: [{ path: 'notes.md', content: 'A useful note.' }],
      model: 'test-model',
      checksResults: [],
      provider: providerReply('not-json'),
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toContain('QA response not parseable: not-json')
  })

  it('fails when the provider returns an unknown verdict', async () => {
    const result = await runQA({
      description: 'Review output',
      output: ['notes.md'],
      written: [{ path: 'notes.md', content: 'A useful note.' }],
      model: 'test-model',
      checksResults: [],
      provider: providerReply('{"verdict":"maybe","reason":"unclear"}'),
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('unclear')
  })

  it('fails closed when the provider returns valid JSON that is not an object', async () => {
    const options = {
      description: 'Review output',
      output: ['notes.md'],
      written: [{ path: 'notes.md', content: 'A useful note.' }],
      model: 'test-model',
      checksResults: [],
    }

    const nullResult = await runQA({ ...options, provider: providerReply('null') })
    const arrayResult = await runQA({ ...options, provider: providerReply('[]') })

    expect(nullResult.verdict).toBe('fail')
    expect(arrayResult.verdict).toBe('fail')
    expect(nullResult.reason).toContain('JSON object')
  })

  it('parses fenced JSON and preserves a passing criterion with literal evidence', async () => {
    const result = await runQA({
      description: 'Add a greeting',
      output: ['src/greeting.ts'],
      written: [{ path: 'src/greeting.ts', content: 'export const greeting = "hello"' }],
      model: 'test-model',
      acceptance_criteria: ['The module exports greeting'],
      checksResults: [],
      provider: providerReply('```json\n{"verdict":"pass","reason":"verified","criteria":[{"text":"The module exports greeting","pass":true,"evidence":{"file":"src/greeting.ts","excerpt":"export const greeting = \\\"hello\\\""}}]}\n```'),
    })

    expect(result.verdict).toBe('pass')
    expect(result.criteria?.[0]?.pass).toBe(true)
  })

  it('fails the verdict when one of multiple criteria cites the wrong file', async () => {
    let userContent = ''
    const result = await runQA({
      description: 'Add two exports',
      output: ['src/one.ts', 'src/two.ts'],
      written: [
        { path: 'src/one.ts', content: 'export const one = 1' },
        { path: 'src/two.ts', content: 'export const two = 2' },
      ],
      model: 'test-model',
      acceptance_criteria: ['one exists', 'two exists'],
      checksResults: [],
      provider: providerReply(JSON.stringify({
        verdict: 'pass',
        reason: 'both appear present',
        criteria: [
          { text: 'one exists', pass: true, evidence: { file: 'src/one.ts', excerpt: 'export const one = 1' } },
          { text: 'two exists', pass: true, evidence: { file: 'src/missing.ts', excerpt: 'export const two = 2' } },
        ],
      }), content => { userContent = content }),
    })

    expect(result.verdict).toBe('fail')
    expect(result.criteria?.map(c => c.pass)).toEqual([true, false])
    expect(userContent).toContain('1. one exists')
    expect(userContent).toContain('2. two exists')
  })

  it('fails closed when the provider omits or truncates criterion results', async () => {
    const options = {
      description: 'Add two exports',
      output: ['src/one.ts', 'src/two.ts'],
      written: [
        { path: 'src/one.ts', content: 'export const one = 1' },
        { path: 'src/two.ts', content: 'export const two = 2' },
      ],
      model: 'test-model',
      acceptance_criteria: ['one exists', 'two exists'],
      checksResults: [],
    }

    const omitted = await runQA({
      ...options,
      provider: providerReply('{"verdict":"pass","reason":"criteria omitted"}'),
    })
    const truncated = await runQA({
      ...options,
      provider: providerReply(JSON.stringify({
        verdict: 'pass',
        reason: 'only one result',
        criteria: [{ text: 'one exists', pass: true, evidence: { file: 'src/one.ts', excerpt: 'export const one = 1' } }],
      })),
    })

    expect(omitted.verdict).toBe('fail')
    expect(truncated.verdict).toBe('fail')
  })

  it('treats an empty criteria array like no criteria', async () => {
    let userContent = ''
    const result = await runQA({
      ...{
        description: 'Review output',
        output: ['notes.md'],
        written: [{ path: 'notes.md', content: 'A useful note.' }],
        model: 'test-model',
        acceptance_criteria: [],
        checksResults: [],
      },
      provider: providerReply('{"verdict":"pass","reason":"no criteria"}', content => { userContent = content }),
    })

    expect(result.verdict).toBe('pass')
    expect(result.criteria).toBeUndefined()
    expect(userContent).not.toContain('## Acceptance criteria')
  })

  it('does not allow pass:false even when the evidence is literal', async () => {
    const result = await runQA({
      description: 'Add a greeting',
      output: ['src/greeting.ts'],
      written: [{ path: 'src/greeting.ts', content: 'export const greeting = "hello"' }],
      model: 'test-model',
      acceptance_criteria: ['The module exports greeting'],
      checksResults: [],
      provider: providerReply(JSON.stringify({
        verdict: 'pass',
        reason: 'the model rejected it',
        criteria: [{
          text: 'The module exports greeting',
          pass: false,
          evidence: { file: 'src/greeting.ts', excerpt: 'export const greeting = "hello"' },
        }],
      })),
    })

    expect(result.verdict).toBe('fail')
    expect(result.criteria?.[0]?.pass).toBe(false)
  })
})

describe('runAdversarialQA and parseAdversarialVerdict', () => {
  const baseOptions = {
    description: 'Review the implementation',
    output: ['src/example.ts'],
    written: [{ path: 'src/example.ts', content: 'export const answer = 42' }],
    model: 'test-model',
    acceptance_criteria: ['The module exports answer'],
    checksResults: [],
  }

  it('returns VERIFIED when the adversarial review confirms the work', async () => {
    const result = await runAdversarialQA({
      ...baseOptions,
      provider: providerReply('{"verdict":"VERIFIED","reason":"The behavior is reachable and correct."}'),
    })

    expect(result.verdict).toBe('VERIFIED')
    expect(result.reason).toBe('The behavior is reachable and correct.')
  })

  it('returns CAVEATS from fenced JSON without collapsing it to REFUTED', async () => {
    const result = await runAdversarialQA({
      ...baseOptions,
      provider: providerReply('```json\n{"verdict":"CAVEATS","reason":"One edge case needs review."}\n```'),
    })

    expect(result.verdict).toBe('CAVEATS')
    expect(result.reason).toBe('One edge case needs review.')
  })

  it('returns REFUTED when the review finds concrete contradictory behavior', async () => {
    const result = await runAdversarialQA({
      ...baseOptions,
      provider: providerReply('{"verdict":"REFUTED","reason":"The implementation is unreachable."}'),
    })

    expect(result.verdict).toBe('REFUTED')
    expect(result.reason).toBe('The implementation is unreachable.')
  })

  it('fails closed with REFUTED when the adversarial response is not parseable', async () => {
    const result = await runAdversarialQA({
      ...baseOptions,
      provider: providerReply('not-json'),
    })

    expect(result.verdict).toBe('REFUTED')
    expect(result.reason).toContain('adversarial QA response not parseable: not-json')
  })

  it('treats an empty adversarial criteria array like no criteria', async () => {
    let userContent = ''
    await runAdversarialQA({
      ...baseOptions,
      acceptance_criteria: [],
      provider: providerReply('{"verdict":"VERIFIED","reason":"no criteria"}', content => { userContent = content }),
    })

    expect(userContent).not.toContain('## Acceptance criteria')
  })

  it('falls back to REFUTED for an unknown adversarial verdict', async () => {
    const result = await runAdversarialQA({
      ...baseOptions,
      provider: providerReply('{"verdict":"maybe","reason":"unclear"}'),
    })

    expect(result.verdict).toBe('REFUTED')
    expect(result.reason).toBe('unclear')
  })

  it('fails closed when the adversarial response is valid JSON but not an object', async () => {
    const nullResult = await runAdversarialQA({
      ...baseOptions,
      provider: providerReply('null'),
    })
    const arrayResult = await runAdversarialQA({
      ...baseOptions,
      provider: providerReply('[]'),
    })

    expect(nullResult.verdict).toBe('REFUTED')
    expect(arrayResult.verdict).toBe('REFUTED')
    expect(nullResult.reason).toContain('JSON object')
  })

  it('includes multiple files and executed checks in the adversarial prompt', async () => {
    let userContent = ''
    await runAdversarialQA({
      ...baseOptions,
      output: ['src/example.ts', 'src/other.ts'],
      written: [
        { path: 'src/example.ts', content: 'export const answer = 42' },
        { path: 'src/other.ts', content: 'export const other = true' },
      ],
      checksResults: [{ cmd: 'bun test --timeout 30000', exitCode: 0, stdout: '', stderr: '', elapsedMs: 10, timedOut: false }],
      provider: providerReply('{"verdict":"VERIFIED","reason":"context received"}', content => { userContent = content }),
    })

    expect(userContent).toContain('### src/example.ts')
    expect(userContent).toContain('export const other = true')
    expect(userContent).toContain('1. The module exports answer')
    expect(userContent).toContain('bun test --timeout 30000')
    expect(userContent).toContain('exitCode: 0')
  })

  it('tells the adversarial reviewer explicitly when no checks ran', async () => {
    let userContent = ''
    await runAdversarialQA({
      ...baseOptions,
      checksResults: [],
      provider: providerReply('{"verdict":"VERIFIED","reason":"no checks needed"}', content => { userContent = content }),
    })

    expect(userContent).toContain('NINGUNA verificación mecánica corrió.')
  })
})

describe('runRefuter and parseRefuterVerdict (X.1, IDEAS #33)', () => {
  const baseOptions = {
    description: 'Review the implementation',
    output: ['src/example.ts'],
    written: [{ path: 'src/example.ts', content: 'export const answer = 42' }],
    model: 'test-model',
    acceptance_criteria: ['The module exports answer'],
    checksResults: [],
    qaVerdictReason: 'the file does not export answer',
  }

  it('returns CONFIRMED when the refuter agrees the fail is correct', async () => {
    const result = await runRefuter({
      ...baseOptions,
      provider: providerReply('{"verdict":"CONFIRMED","reason":"The judge was right, answer is not exported."}'),
    })

    expect(result.verdict).toBe('CONFIRMED')
    expect(result.reason).toBe('The judge was right, answer is not exported.')
  })

  it('returns REFUTED from fenced JSON when the refuter finds the fail was wrong', async () => {
    const result = await runRefuter({
      ...baseOptions,
      provider: providerReply('```json\n{"verdict":"REFUTED","reason":"answer is clearly exported, the judge misread the file."}\n```'),
    })

    expect(result.verdict).toBe('REFUTED')
    expect(result.reason).toBe('answer is clearly exported, the judge misread the file.')
  })

  it('fails safe to CONFIRMED (opposite of adversarial QA) when the response is not parseable', async () => {
    const result = await runRefuter({
      ...baseOptions,
      provider: providerReply('not-json'),
    })

    expect(result.verdict).toBe('CONFIRMED')
    expect(result.reason).toContain('refuter response not parseable: not-json')
  })

  it('fails safe to CONFIRMED when the response is valid JSON but not an object', async () => {
    const nullResult = await runRefuter({ ...baseOptions, provider: providerReply('null') })
    const arrayResult = await runRefuter({ ...baseOptions, provider: providerReply('[]') })

    expect(nullResult.verdict).toBe('CONFIRMED')
    expect(arrayResult.verdict).toBe('CONFIRMED')
    expect(nullResult.reason).toContain('JSON object')
  })

  it('falls back to CONFIRMED for an unknown refuter verdict', async () => {
    const result = await runRefuter({
      ...baseOptions,
      provider: providerReply('{"verdict":"maybe","reason":"unclear"}'),
    })

    expect(result.verdict).toBe('CONFIRMED')
    expect(result.reason).toBe('unclear')
  })

  it('includes the original fail reason and executed checks in the refuter prompt', async () => {
    let userContent = ''
    await runRefuter({
      ...baseOptions,
      checksResults: [{ cmd: 'bun test --timeout 30000', exitCode: 0, stdout: '', stderr: '', elapsedMs: 10, timedOut: false }],
      provider: providerReply('{"verdict":"CONFIRMED","reason":"context received"}', content => { userContent = content }),
    })

    expect(userContent).toContain('### src/example.ts')
    expect(userContent).toContain('the file does not export answer')
    expect(userContent).toContain('bun test --timeout 30000')
    expect(userContent).toContain('exitCode: 0')
  })

  it('tells the refuter explicitly when no checks ran', async () => {
    let userContent = ''
    await runRefuter({
      ...baseOptions,
      checksResults: [],
      provider: providerReply('{"verdict":"CONFIRMED","reason":"no checks needed"}', content => { userContent = content }),
    })

    expect(userContent).toContain('NINGUNA verificación mecánica corrió.')
  })
})
