import { describe, expect, test } from 'bun:test'
import { checkCssRatchet, countLines } from './check-css-ratchet.ts'

const baseline = (total: number, autorizacion = '') => ({ total, autorizacion })

describe('countLines', () => {
  test('cuenta como wc -l sin contar una línea vacía final', () => {
    expect(countLines('uno\ndos\n')).toBe(2)
    expect(countLines('uno\n\n')).toBe(2)
    expect(countLines('uno')).toBe(1)
    expect(countLines('')).toBe(0)
  })
})

describe('checkCssRatchet', () => {
  test('bloquea superar el tope', () => {
    const result = checkCssRatchet(11, baseline(10), baseline(10))
    expect(result.errors.join('\n')).toContain('supera el tope')
    expect(result.lowered).toBeNull()
  })

  test('baja el tope cuando el CSS baja', () => {
    const result = checkCssRatchet(9, baseline(10), baseline(10))
    expect(result.errors).toEqual([])
    expect(result.lowered).toEqual(baseline(9))
  })

  test('un total igual pasa sin tocar el baseline', () => {
    const result = checkCssRatchet(10, baseline(10), baseline(10))
    expect(result).toEqual({ errors: [], lowered: null })
  })

  test('subir el tope sin autorización nueva falla', () => {
    const result = checkCssRatchet(10, baseline(11), baseline(10))
    expect(result.errors.join('\n')).toContain('tope CSS no puede subir')
  })

  test('subir el tope con autorización nueva pasa', () => {
    const result = checkCssRatchet(
      11,
      baseline(11, 'CSS+ autorizado por Carlos: UI.12.2a'),
      baseline(10),
    )
    expect(result).toEqual({ errors: [], lowered: null })
  })

  test('reusar la autorización previa para subir otra vez falla', () => {
    const authorization = 'CSS+ autorizado por Carlos: UI.12.2a'
    const result = checkCssRatchet(12, baseline(12, authorization), baseline(11, authorization))
    expect(result.errors.join('\n')).toContain('tope CSS no puede subir')
  })
})
