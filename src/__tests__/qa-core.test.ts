import { describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ProviderClient } from '../providers/index.ts'
import {
  computeFileDiffs,
  normalizeCriterionText,
  restoreContents,
  runQA,
  snapshotContents,
} from '../run/qa.ts'

function freshRoot() {
  return mkdtempSync(join(tmpdir(), 'orchestos-qa-core-'))
}

function providerReply(text: string, onMessage?: (content: string) => void): ProviderClient {
  return {
    name: 'test',
    chat: async (opts) => {
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
    const result = computeFileDiffs({ 'changed.txt': { existed: true, content: 'before' } }, [
      { path: 'changed.txt', content: 'after' },
    ])

    expect(result[0]).toMatchObject({ path: 'changed.txt', status: 'modified' })
    expect(result[0]!.diff).toContain('-before')
    expect(result[0]!.diff).toContain('+after')
  })

  it('produces a stable diff for unchanged content', () => {
    const result = computeFileDiffs({ 'same.txt': { existed: true, content: 'unchanged' } }, [
      { path: 'same.txt', content: 'unchanged' },
    ])

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
  const criterion = (text: string) => ({
    text,
    pass: true,
    evidence: { file: 'fixture.ts', excerpt: 'export const answer = 42' },
  })
  const checkCriteria = (criteria: unknown, originals = ['A', 'B']) =>
    runQA({
      description: 'Verify identities',
      output: ['fixture.ts'],
      written: [{ path: 'fixture.ts', content: 'export const answer = 42' }],
      model: 'test-model',
      checksResults: [],
      acceptance_criteria: originals,
      provider: providerReply(
        JSON.stringify({ verdict: 'pass', reason: 'model claims success', criteria }),
      ),
    })

  it('R.3 accepts exactly A+B with literal evidence and preserves their identities', async () => {
    const result = await checkCriteria([criterion('A'), criterion('B')])
    expect(result.verdict).toBe('pass')
    expect(result.criteria).toEqual([criterion('A'), criterion('B')])
    expect(result.reason).toBe('model claims success')
  })

  it('R.3 explains identity mismatch instead of repeating the provider success claim', async () => {
    const result = await checkCriteria([criterion('A'), criterion('A')])
    expect(result.reason).toBe(
      'QA criterion results must match the original text and order exactly (criterion 2: got "A")',
    )
    expect(result.criteria?.[1]?.pass).toBe(false)
  })

  it('R.3 normalizes permitted typography and whitespace while returning the original text', async () => {
    expect(normalizeCriterionText(' “hi”  \\"there” ok ')).toBe('"hi" "there" ok')
    const original = 'Use “quoted”  text'
    const result = await checkCriteria(
      [criterion(original), criterion("it's  fine")],
      [original, "it's fine"],
    )
    expect(result.verdict).toBe('pass')
    expect(result.criteria?.map((row) => row.text)).toEqual([original, "it's fine"])
  })

  it('R.3 rejects a real rewrite and reports the raw judge text', async () => {
    const result = await checkCriteria([criterion('A'), criterion('rewritten')])
    expect(result.verdict).toBe('fail')
    expect(result.reason).toContain('(criterion 2: got "rewritten")')
    expect(result.criteria?.[1]?.text).toBe('B')
  })

  it('R.3 detects reordered results and returns expected text in each position', async () => {
    const result = await checkCriteria([criterion('B'), criterion('A')])
    expect(result.verdict).toBe('fail')
    expect(result.reason).toContain('(criterion 1: got "B")')
    expect(result.criteria?.map((row) => row.text)).toEqual(['A', 'B'])
  })

  for (const [label, rows] of [
    ['duplicate A+A', [criterion('A'), criterion('A')]],
    ['missing B', [criterion('A')]],
    ['extra C', [criterion('A'), criterion('B'), criterion('C')]],
    ['unknown C', [criterion('A'), criterion('C')]],
    ['reordered B+A', [criterion('B'), criterion('A')]],
    ['paraphrased text', [criterion('A'), criterion('rewritten B')]],
    ['missing text', [criterion('A'), { pass: true, evidence: criterion('B').evidence }]],
    ['null entry', [criterion('A'), null]],
    ['array entry', [criterion('A'), []]],
    ['primitive entry', [criterion('A'), true]],
    ['non-boolean pass', [criterion('A'), { ...criterion('B'), pass: 'true' }]],
    ['malformed evidence', [criterion('A'), { ...criterion('B'), evidence: [] }]],
    ['non-array criteria', { A: criterion('A'), B: criterion('B') }],
  ] as const) {
    it(`R.3 fails closed for ${label}`, async () => {
      expect((await checkCriteria(rows)).verdict).toBe('fail')
    })
  }

  it('R.3 rejects ambiguous duplicate or blank original identities', async () => {
    expect((await checkCriteria([criterion('A'), criterion('A')], ['A', 'A'])).verdict).toBe('fail')
    expect((await checkCriteria([criterion('')], [''])).verdict).toBe('fail')
    expect((await checkCriteria([criterion('A'), criterion(' ')], ['A', ' '])).verdict).toBe('fail')
  })

  it('R.3 whitespace-only evidence cannot satisfy a criterion even if literally present', async () => {
    const result = await checkCriteria([
      criterion('A'),
      { ...criterion('B'), evidence: { file: 'fixture.ts', excerpt: ' ' } },
    ])
    expect(result.verdict).toBe('fail')
    expect(result.criteria?.[1]?.evidence).toBeUndefined()
  })

  it('R.3 never unwraps a valid JSON array or JSON string into a passing object', async () => {
    const object = { verdict: 'pass', criteria: [criterion('A')] }
    for (const raw of [
      JSON.stringify([object]),
      JSON.stringify(JSON.stringify(object)),
      '```json\n' + JSON.stringify([object]) + '\n```',
    ]) {
      const result = await runQA({
        description: 'Validate response shape',
        output: [],
        written: [],
        model: 'test-model',
        checksResults: [],
        provider: providerReply(raw),
      })
      expect(result.verdict).toBe('fail')
      expect(result.reason).toContain('JSON object')
    }
  })

  it('R.3 rejects truncated wrappers and extra payloads instead of extracting inner JSON', async () => {
    const valid = JSON.stringify({ verdict: 'pass', reason: 'looks good' })
    for (const raw of [
      '[' + valid,
      valid + ',',
      'explanation ' + valid,
      '```json\n' + valid + '\n``` trailing',
      valid + '\n' + valid,
    ]) {
      const result = await runQA({
        description: 'Validate whole response',
        output: [],
        written: [],
        model: 'test-model',
        checksResults: [],
        provider: providerReply(raw),
      })
      expect(result.verdict).toBe('fail')
      expect(result.reason).toContain('not parseable')
    }
  })

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
      provider: providerReply('{"verdict":"pass","reason":"looks good"}', (content) => {
        userContent = content
      }),
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
      provider: providerReply(
        '```json\n{"verdict":"pass","reason":"verified","criteria":[{"text":"The module exports greeting","pass":true,"evidence":{"file":"src/greeting.ts","excerpt":"export const greeting = \\"hello\\""}}]}\n```',
      ),
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
      provider: providerReply(
        JSON.stringify({
          verdict: 'pass',
          reason: 'both appear present',
          criteria: [
            {
              text: 'one exists',
              pass: true,
              evidence: { file: 'src/one.ts', excerpt: 'export const one = 1' },
            },
            {
              text: 'two exists',
              pass: true,
              evidence: { file: 'src/missing.ts', excerpt: 'export const two = 2' },
            },
          ],
        }),
        (content) => {
          userContent = content
        },
      ),
    })

    expect(result.verdict).toBe('fail')
    expect(result.criteria?.map((c) => c.pass)).toEqual([true, false])
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
      provider: providerReply(
        JSON.stringify({
          verdict: 'pass',
          reason: 'only one result',
          criteria: [
            {
              text: 'one exists',
              pass: true,
              evidence: { file: 'src/one.ts', excerpt: 'export const one = 1' },
            },
          ],
        }),
      ),
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
      provider: providerReply('{"verdict":"pass","reason":"no criteria"}', (content) => {
        userContent = content
      }),
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
      provider: providerReply(
        JSON.stringify({
          verdict: 'pass',
          reason: 'the model rejected it',
          criteria: [
            {
              text: 'The module exports greeting',
              pass: false,
              evidence: { file: 'src/greeting.ts', excerpt: 'export const greeting = "hello"' },
            },
          ],
        }),
      ),
    })

    expect(result.verdict).toBe('fail')
    expect(result.criteria?.[0]?.pass).toBe(false)
  })
})
