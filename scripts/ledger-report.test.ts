import { describe, it, expect } from 'bun:test'
import { parseLedgerEntries, aggregateByModel } from './ledger-report.ts'

const HEADER = `# LEDGER.md — Responsabilidad de LLMs sobre este repo

Registro append-only. Texto introductorio sin entradas reales.

---
`

describe('parseLedgerEntries', () => {
  it('ledger vacío (solo header) → sin entradas', () => {
    expect(parseLedgerEntries(HEADER)).toEqual([])
  })

  it('parsea una entrada real completa', () => {
    const content = HEADER + `
## 2026-07-18 14:32 America/Guayaquil — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Mes 22 Bloque E)
**Clasificación**: REGRESIÓN
**Por qué**: harness.ts volvió a clampear max_tokens al catálogo.
**Reversibilidad/evidencia**: commit d6e1791 revierte el clamp.

---
`
    const entries = parseLedgerEntries(content)
    expect(entries).toEqual([
      { when: '2026-07-18 14:32 America/Guayaquil', model: 'claude-sonnet-5', classification: 'REGRESIÓN' },
    ])
  })

  it('parsea varias entradas de distintos modelos', () => {
    const content = HEADER + `
## 2026-07-18 10:00 America/Guayaquil — claude-sonnet-5

**Regla tocada**: [[feedback-modelo-decision-final-carlos]]
**Clasificación**: RESPETÓ

---
## 2026-07-18 11:00 America/Guayaquil — deepseek/deepseek-v4-flash

**Regla tocada**: [[feedback-context-no-max-tokens]]
**Clasificación**: DESVIÓ-CON-RAZÓN
**Por qué**: argumento sólido de ejemplo.

---
## 2026-07-18 12:00 America/Guayaquil — claude-sonnet-5

**Regla tocada**: [[feedback-modelo-decision-final-carlos]]
**Clasificación**: RESPETÓ

---
`
    const entries = parseLedgerEntries(content)
    expect(entries).toHaveLength(3)
    expect(entries.map(e => e.model)).toEqual([
      'claude-sonnet-5', 'deepseek/deepseek-v4-flash', 'claude-sonnet-5',
    ])
  })

  it('ignora bloques sin clasificación (encabezado suelto, sin entrada real)', () => {
    const content = HEADER + `
## Esto no es una entrada real — es un título de otra sección

Texto sin campo Clasificación.

---
`
    expect(parseLedgerEntries(content)).toEqual([])
  })
})

describe('aggregateByModel', () => {
  it('cuenta por modelo y clasificación', () => {
    const entries = [
      { when: 'a', model: 'claude-sonnet-5', classification: 'RESPETÓ' },
      { when: 'b', model: 'claude-sonnet-5', classification: 'RESPETÓ' },
      { when: 'c', model: 'claude-sonnet-5', classification: 'REGRESIÓN' },
      { when: 'd', model: 'deepseek/deepseek-v4-flash', classification: 'DESVIÓ-CON-RAZÓN' },
    ]
    expect(aggregateByModel(entries)).toEqual({
      'claude-sonnet-5': { 'RESPETÓ': 2, 'REGRESIÓN': 1 },
      'deepseek/deepseek-v4-flash': { 'DESVIÓ-CON-RAZÓN': 1 },
    })
  })

  it('ledger vacío → objeto vacío', () => {
    expect(aggregateByModel([])).toEqual({})
  })
})
