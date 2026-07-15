/**
 * IDEAS.md #32 / PLAN.md Mes 22 Bloque A.1+A.2 — capToolOutput()/capCheckOutput().
 */
import { describe, it, expect } from 'bun:test'
import { capToolOutput, capCheckOutput } from '../run/tool-output-cap.ts'

describe('capToolOutput', () => {
  it('returns text unchanged when under the cap', () => {
    expect(capToolOutput('short text')).toBe('short text')
  })

  it('returns text unchanged when exactly at the cap', () => {
    const text = 'x'.repeat(100)
    expect(capToolOutput(text, 100)).toBe(text)
  })

  it('truncates and appends a marker with the real omitted/total counts', () => {
    const text = 'a'.repeat(150)
    const result = capToolOutput(text, 100)
    expect(result.startsWith('a'.repeat(100))).toBe(true)
    expect(result).toContain('[...truncado: 50 chars omitidos de 150]')
  })

  it('uses the default cap when none is passed', () => {
    const text = 'a'.repeat(30_000)
    const result = capToolOutput(text)
    expect(result.length).toBeLessThan(text.length)
    expect(result).toContain('[...truncado: 5000 chars omitidos de 30000]')
  })
})

describe('capCheckOutput', () => {
  it('returns text unchanged when under the cap', () => {
    expect(capCheckOutput('short output')).toBe('short output')
  })

  it('keeps head and tail, marker in the middle, when over the cap', () => {
    const head = 'H'.repeat(40)
    const middle = 'M'.repeat(100)
    const tail = 'T'.repeat(40)
    const text = head + middle + tail
    const result = capCheckOutput(text, 80)
    expect(result.startsWith(head)).toBe(true)
    expect(result.endsWith(tail)).toBe(true)
    expect(result).toContain('[...truncado:')
  })

  it('preserves the tail where errors typically live, unlike a head-only cap', () => {
    const text = 'noise'.repeat(1000) + 'FATAL ERROR AT THE END'
    const result = capCheckOutput(text, 200)
    expect(result).toContain('FATAL ERROR AT THE END')
  })
})
