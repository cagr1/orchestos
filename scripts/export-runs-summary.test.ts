import { describe, it, expect } from 'bun:test'
import { countFailedChecks } from './export-runs-summary.ts'

// Forma real de un CheckResult almacenado (src/run/checks.ts): NO tiene campo `pass`.
const passed = { cmd: 'node --check x.js', exitCode: 0, stdout: '', stderr: '', elapsedMs: 25, timedOut: false }
const failedExit = { cmd: 'tsc', exitCode: 2, stdout: '', stderr: 'error', elapsedMs: 40, timedOut: false }
const timedOut = { cmd: 'sleep 999', exitCode: -1, stdout: '', stderr: '', elapsedMs: 5000, timedOut: true }

describe('countFailedChecks', () => {
  it('null/undefined/empty → 0', () => {
    expect(countFailedChecks(null)).toBe(0)
    expect(countFailedChecks(undefined)).toBe(0)
    expect(countFailedChecks('')).toBe(0)
  })

  it('REGRESIÓN corregida: un check pasado (exitCode 0) NO cuenta como fallado', () => {
    // Antes del fix esto devolvía 1 (filtraba por !c.pass, y pass no existe).
    expect(countFailedChecks(JSON.stringify([passed]))).toBe(0)
  })

  it('cuenta un check con exitCode != 0', () => {
    expect(countFailedChecks(JSON.stringify([failedExit]))).toBe(1)
  })

  it('cuenta un check que expiró (timedOut) aunque exitCode sea raro', () => {
    expect(countFailedChecks(JSON.stringify([timedOut]))).toBe(1)
  })

  it('mezcla: 1 pasado + 1 fallado + 1 timeout → 2', () => {
    expect(countFailedChecks(JSON.stringify([passed, failedExit, timedOut]))).toBe(2)
  })

  it('array vacío → 0', () => {
    expect(countFailedChecks('[]')).toBe(0)
  })

  it('JSON inválido → 0 (no rompe el resumen)', () => {
    expect(countFailedChecks('not json')).toBe(0)
  })
})
