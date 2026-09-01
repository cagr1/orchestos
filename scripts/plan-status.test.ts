import { describe, expect, test } from 'bun:test'
import { parsePlanFeatureStatus, serializeFeatureStatus } from './plan-status.ts'

const SAMPLE = `
## BLOQUE H — Huecos de harness (ABIERTO 2026-09-01, PRIORIDAD SOBRE MES 30)

### H.1 — Presentación

- [x] **H.1.1 — ⚡ README miente sobre el estado del proyecto.** (cerrado 2026-09-01) Dice cosas
  viejas.

### H.3 — Estado

- [ ] **H.3.1 — 🧠 El estado del producto no es machine-readable.** \`PLAN.md\` (1003 líneas)
  es la fuente real.

## MES 27 — Backlog canónico

- [x] **SÍ — Mes 27 cerrado (2026-08-13), parcial por diseño**
`

describe('parsePlanFeatureStatus', () => {
  test('extrae ítems de trabajo reales, ignorando veredictos de cierre de mes', () => {
    const items = parsePlanFeatureStatus(SAMPLE)
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.id)).toEqual(['H.1.1', 'H.3.1'])
  })

  test('asigna block y month de los headers más cercanos', () => {
    const [first, second] = parsePlanFeatureStatus(SAMPLE)
    expect(first!.month).toBe(
      'BLOQUE H — Huecos de harness (ABIERTO 2026-09-01, PRIORIDAD SOBRE MES 30)',
    )
    expect(first!.block).toBe('H.1 — Presentación')
    expect(second!.block).toBe('H.3 — Estado')
  })

  test('status y closedDate reflejan el checkbox y la fecha de cierre', () => {
    const [first, second] = parsePlanFeatureStatus(SAMPLE)
    expect(first!.status).toBe('done')
    expect(first!.closedDate).toBe('2026-09-01')
    expect(second!.status).toBe('open')
    expect(second!.closedDate).toBeNull()
  })

  test('delegation captura el emoji de la taxonomía', () => {
    const [first, second] = parsePlanFeatureStatus(SAMPLE)
    expect(first!.delegation).toBe('⚡')
    expect(second!.delegation).toBe('🧠')
  })

  test('un veredicto de cierre de mes (sin emoji de delegación) no cuenta como ítem', () => {
    const items = parsePlanFeatureStatus(SAMPLE)
    expect(items.find((i) => i.id === 'SÍ')).toBeUndefined()
  })

  test('el título no arrastra el punto final ni el markdown de negrita', () => {
    const [first] = parsePlanFeatureStatus(SAMPLE)
    expect(first!.title).toBe('README miente sobre el estado del proyecto')
  })
})

describe('serializeFeatureStatus', () => {
  test('produce JSON estable con nota de "no editar a mano"', () => {
    const items = parsePlanFeatureStatus(SAMPLE)
    const json = serializeFeatureStatus(items)
    const parsed = JSON.parse(json)
    expect(parsed.generatedFrom).toBe('PLAN.md')
    expect(parsed.note).toMatch(/no editar a mano/i)
    expect(parsed.items).toHaveLength(2)
  })
})
