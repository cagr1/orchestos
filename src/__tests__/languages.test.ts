import { describe, it, expect } from 'bun:test'
import { detectLanguages, detectPrimaryLanguage, SUPPORTED_LANGUAGES } from '../detect/languages.ts'
import { join } from 'path'

const FIXTURES = join(import.meta.dir, 'fixtures', 'languages')

describe('detectLanguages', () => {
  it('detects TypeScript as primary in a TS project', async () => {
    const stats = await detectLanguages(join(FIXTURES, 'ts-project'))
    expect(stats[0]?.lang).toBe('TypeScript')
    expect(stats[0]?.pct).toBeGreaterThan(50)
  })

  it('detects C# in a .NET project', async () => {
    const stats = await detectLanguages(join(FIXTURES, 'csharp-project'))
    expect(stats[0]?.lang).toBe('C#')
  })

  it('detects Python in a Python project', async () => {
    const stats = await detectLanguages(join(FIXTURES, 'python-project'))
    expect(stats[0]?.lang).toBe('Python')
  })

  it('detects Rust in a Rust project', async () => {
    const stats = await detectLanguages(join(FIXTURES, 'rust-project'))
    expect(stats[0]?.lang).toBe('Rust')
  })

  it('returns empty array when no known files', async () => {
    const stats = await detectLanguages(join(FIXTURES, 'empty-project'))
    expect(stats).toEqual([])
  })

  it('returns at most 5 languages', async () => {
    const stats = await detectLanguages(join(FIXTURES, 'mixed-project'))
    expect(stats.length).toBeLessThanOrEqual(5)
  })

  it('percentages are non-zero', async () => {
    const stats = await detectLanguages(join(FIXTURES, 'ts-project'))
    for (const s of stats) {
      expect(s.pct).toBeGreaterThan(0)
    }
  })
})

describe('detectPrimaryLanguage', () => {
  it('returns the dominant language name', async () => {
    const lang = await detectPrimaryLanguage(join(FIXTURES, 'csharp-project'))
    expect(lang).toBe('C#')
  })

  it('returns null for empty project', async () => {
    const lang = await detectPrimaryLanguage(join(FIXTURES, 'empty-project'))
    expect(lang).toBeNull()
  })
})

describe('SUPPORTED_LANGUAGES', () => {
  it('is sorted alphabetically', () => {
    const sorted = [...SUPPORTED_LANGUAGES].sort()
    expect(SUPPORTED_LANGUAGES).toEqual(sorted)
  })

  it('contains key languages', () => {
    const must = ['TypeScript', 'Python', 'C#', 'Rust', 'Go', 'Java', 'R', 'Visual Basic', 'SQL', 'Shell']
    for (const lang of must) {
      expect(SUPPORTED_LANGUAGES).toContain(lang)
    }
  })

  it('has no duplicates', () => {
    const unique = new Set(SUPPORTED_LANGUAGES)
    expect(unique.size).toBe(SUPPORTED_LANGUAGES.length)
  })
})
