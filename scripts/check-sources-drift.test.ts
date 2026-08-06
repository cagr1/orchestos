import { describe, it, expect } from 'bun:test'
import { parseRegistry, computeDrift, renderReport, buildSummaryPrompt, summarizeDrift, type SourceEntry } from './check-sources-drift.ts'

const entry = (overrides: Partial<SourceEntry> = {}): SourceEntry => ({
  id: 'test-source',
  repo: 'owner/repo',
  path: 'skills/x/SKILL.md',
  license: 'MIT',
  local_artifact: 'skills/x.yaml',
  last_synced_sha: 'aaa111',
  last_synced_date: '2026-08-02',
  ...overrides,
})

describe('parseRegistry', () => {
  it('reads sources[] from YAML', () => {
    const yaml = `
sources:
  - id: a
    repo: owner/repo
    path: skills/a/SKILL.md
    license: MIT
    local_artifact: skills/a.yaml
    last_synced_sha: sha1
    last_synced_date: "2026-08-02"
`
    const entries = parseRegistry(yaml)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.id).toBe('a')
  })

  it('empty registry returns []', () => {
    expect(parseRegistry('sources: []')).toEqual([])
  })
})

describe('computeDrift', () => {
  it('same SHA → clean, no compare_url', () => {
    const f = computeDrift([entry()], { 'test-source': 'aaa111' })[0]!
    expect(f.status).toBe('clean')
    expect(f.compare_url).toBeUndefined()
  })

  it('different SHA → drift, with compare_url', () => {
    const f = computeDrift([entry()], { 'test-source': 'bbb222' })[0]!
    expect(f.status).toBe('drift')
    expect(f.latest_sha).toBe('bbb222')
    expect(f.compare_url).toBe('https://github.com/owner/repo/compare/aaa111...bbb222')
  })

  it('missing/null latest SHA → error, not drift', () => {
    const f = computeDrift([entry()], { 'test-source': null })[0]!
    expect(f.status).toBe('error')
    expect(f.compare_url).toBeUndefined()
  })

  it('an entry not present in latestShas is treated as error, not silently clean', () => {
    const f = computeDrift([entry()], {})[0]!
    expect(f.status).toBe('error')
  })

  it('processes multiple entries independently', () => {
    const findings = computeDrift(
      [entry({ id: 'a', last_synced_sha: 'x' }), entry({ id: 'b', last_synced_sha: 'y' })],
      { a: 'x', b: 'z' },
    )
    expect(findings.map(f => f.status)).toEqual(['clean', 'drift'])
  })
})

describe('renderReport', () => {
  it('summarizes counts and lists drifted sources first', () => {
    const findings = computeDrift(
      [entry({ id: 'drifted' }), entry({ id: 'clean-one' })],
      { drifted: 'new-sha', 'clean-one': 'aaa111' },
    )
    const report = renderReport(findings, '2026-08-02')
    expect(report).toContain('1 con deriva')
    expect(report).toContain('1 sin cambios')
    expect(report).toContain('0 con error')
    expect(report).toContain('### `drifted`')
    expect(report).toContain('## Sin cambios')
  })

  it('never claims something was applied — always "pendiente"', () => {
    const findings = computeDrift([entry()], { 'test-source': 'new-sha' })
    const report = renderReport(findings, '2026-08-02')
    expect(report).toContain('pendiente')
    expect(report).not.toContain('aplicado automáticamente')
  })

  it('P.4 — con summaries[], usa la propuesta del LLM en vez de "pendiente" para ese id', () => {
    const findings = computeDrift([entry({ id: 'drifted' })], { drifted: 'new-sha' })
    const report = renderReport(findings, '2026-08-02', { drifted: 'El diff agrega una sección nueva sobre X.' })
    expect(report).toContain('Propuesta (LLM, revisar')
    expect(report).toContain('El diff agrega una sección nueva sobre X.')
    expect(report).not.toContain('pendiente')
  })

  it('P.4 — sin resumen para un id drifted, cae al "pendiente" mecánico de siempre', () => {
    const findings = computeDrift([entry({ id: 'drifted' })], { drifted: 'new-sha' })
    const report = renderReport(findings, '2026-08-02', {})
    expect(report).toContain('pendiente')
    expect(report).not.toContain('Propuesta (LLM')
  })
})

describe('buildSummaryPrompt (P.4)', () => {
  it('incluye el artefacto local, la nota del registro y el diff literal', () => {
    const e = entry({ note: 'Fuente literal del patrón Iron Law.' })
    const { system, user } = buildSummaryPrompt(e, '+added line\n-removed line')
    expect(system).toContain('Never claim certainty')
    expect(system).toContain('never say something was already applied')
    expect(user).toContain('skills/x.yaml')
    expect(user).toContain('Fuente literal del patrón Iron Law.')
    expect(user).toContain('+added line')
  })

  it('sin nota registrada, lo declara en vez de omitirlo', () => {
    const e = entry({ note: undefined })
    const { user } = buildSummaryPrompt(e, 'diff')
    expect(user).toContain('sin nota registrada')
  })
})

describe('summarizeDrift (P.4)', () => {
  it('llama al chatFn inyectado con el prompt construido y devuelve el texto sin recortar', async () => {
    const e = entry()
    let capturedSystem = ''
    const fakeChat = async (opts: { model: string; system: string; messages: { role: 'user'; content: string }[] }) => {
      capturedSystem = opts.system
      return { text: '  Propuesta de prueba.  ', inputTokens: 10, outputTokens: 5, model: opts.model }
    }
    const summary = await summarizeDrift(e, 'diff de prueba', fakeChat)
    expect(summary).toBe('Propuesta de prueba.')
    expect(capturedSystem).toContain('Never claim certainty')
  })

  it('usa el modelo barato por defecto (haiku), no el executor', async () => {
    const e = entry()
    let capturedModel = ''
    const fakeChat = async (opts: { model: string; system: string; messages: { role: 'user'; content: string }[] }) => {
      capturedModel = opts.model
      return { text: 'ok', inputTokens: 1, outputTokens: 1, model: opts.model }
    }
    await summarizeDrift(e, 'diff', fakeChat)
    expect(capturedModel).toContain('haiku')
  })
})
