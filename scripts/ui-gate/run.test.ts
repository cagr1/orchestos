import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'

const { describeFlowError, formatResult, lintFlowSource, writeGateRoles } = await import(
  './lib.mjs'
)

describe('ui gate pure helpers', () => {
  test('describes Playwright locator timeouts in one line', () => {
    const error = new Error(
      "locator.click: Timeout 1000ms exceeded.\nCall log:\n\u001b[2m  - waiting for getByRole('button', { name: 'Nope' })\u001b[22m\n",
    )
    expect(describeFlowError(error)).toBe(
      "locator.click: Timeout 1000ms exceeded. [waiting for getByRole('button', { name: 'Nope' })]",
    )
  })

  test('uses the first nonempty line without a call log and accepts non-Error values', () => {
    expect(describeFlowError(new Error('boom\nsecond'))).toBe('boom')
    expect(describeFlowError('plain')).toBe('plain')
  })

  test('rejects flows that navigate through window.state', () => {
    expect(lintFlowSource('await page.click("button"); window.state.mode = "dev"')).toBe(
      'navega por window',
    )
  })

  test('accepts a flow that only uses visible controls', () => {
    expect(lintFlowSource("await page.getByRole('button', { name: 'Dev' }).click()")).toBeNull()
  })

  test('rejects a step whose condition is the literal true, single and multiline', () => {
    const message = 'step con condición literal true (usar note o una aserción real)'
    expect(lintFlowSource("await step('x', true, 'ok')")).toBe(message)
    expect(lintFlowSource(['await step(`x`, ', 'true, detail)'].join(''))).toBe(message)
    expect(lintFlowSource("await step(\n    'x',\n    true,\n    'ok',\n  )")).toBe(message)
  })

  test('accepts steps with a computed condition', () => {
    expect(lintFlowSource("await step('x', ok === true, 'ok')")).toBeNull()
    expect(lintFlowSource("await step('x', await visible(card), 'ok')")).toBeNull()
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

  test('formats a flow error with its waiting locator', () => {
    expect(
      formatResult({
        flujo: 'smoke',
        pass: false,
        steps: [],
        errores: [
          "locator.click: Timeout 1000ms exceeded. [waiting for getByRole('button', { name: 'Nope' })]",
        ],
        capturas: [],
      }),
    ).toContain('[waiting for getByRole(')
  })

  test('writes four gate roles when the project has no config', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ui-gate-roles-'))
    try {
      writeGateRoles(projectRoot)
      const config = yamlParse(readFileSync(join(projectRoot, 'orchestos.config.yaml'), 'utf8'))
      expect(Object.keys(config.roles)).toEqual([
        'orchestrator',
        'executor',
        'reviewer',
        'auxiliary',
      ])
      for (const role of Object.values(config.roles)) {
        expect(role).toEqual({ agent: 'codex', model: 'gpt-6-luna', effort: 'medium' })
      }
    } finally {
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  test('preserves other keys in an existing project config', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ui-gate-roles-'))
    try {
      const configPath = join(projectRoot, 'orchestos.config.yaml')
      writeFileSync(configPath, yamlStringify({ name: 'existing', apiMode: 'multi-agent' }))
      writeGateRoles(projectRoot)
      const config = yamlParse(readFileSync(configPath, 'utf8'))
      expect(config.name).toBe('existing')
      expect(config.apiMode).toBe('multi-agent')
      expect(Object.keys(config.roles)).toEqual([
        'orchestrator',
        'executor',
        'reviewer',
        'auxiliary',
      ])
    } finally {
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })
})
