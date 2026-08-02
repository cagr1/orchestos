import { describe, it, expect } from 'bun:test'
import { parseRegistry, computeDrift, renderReport, type SourceEntry } from './check-sources-drift.ts'

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
})
