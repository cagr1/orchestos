import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'

const { formatResult, lintFlowSource, writeGateRoles } = await import('./lib.mjs')

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
