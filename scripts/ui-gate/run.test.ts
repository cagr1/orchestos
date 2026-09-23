import { describe, expect, test } from 'bun:test'

const { formatResult, lintFlowSource } = await import('./lib.mjs')

describe('ui gate pure helpers', () => {
  test('rejects flows that navigate through window.state', () => {
    expect(lintFlowSource('await page.click("button"); window.state.mode = "dev"')).toBe(
      'navega por window',
    )
  })

  test('accepts a flow that only uses visible controls', () => {
    expect(lintFlowSource("await page.getByRole('button', { name: 'Dev' }).click()")).toBeNull()
  })

  test('formats a passing result exactly', () => {
    expect(
      formatResult({
        flujo: 'smoke',
        pass: true,
        steps: [
          { nombre: 'home', ok: true, detalle: 'loaded' },
          { nombre: 'dev', ok: true, detalle: 'visible' },
        ],
        errores: [],
        capturas: [],
      }),
    ).toBe('PASS smoke 2/2')
  })

  test('formats a failing result exactly', () => {
    expect(
      formatResult({
        flujo: 'smoke',
        pass: false,
        steps: [{ nombre: 'dev', ok: false, detalle: 'not visible' }],
        errores: [],
        capturas: [],
      }),
    ).toBe('FAIL smoke: dev: not visible')
  })
})
