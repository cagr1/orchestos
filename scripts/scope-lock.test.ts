import { describe, expect, test } from 'bun:test'
import {
  hasOutOfScopeJustification,
  parseScopeArg,
  pathsOutsideScope,
  planClosesItem,
  planHasItem,
} from './scope-lock.ts'

describe('parseScopeArg', () => {
  test('separa por coma y recorta espacios', () => {
    expect(parseScopeArg('src/dashboard/**, docs/ , PLAN.md')).toEqual([
      'src/dashboard/**',
      'docs/',
      'PLAN.md',
    ])
  })

  test('descarta segmentos vacíos', () => {
    expect(parseScopeArg('src/**,,')).toEqual(['src/**'])
  })
})

describe('pathsOutsideScope', () => {
  test('un path que matchea alguno de los globs queda dentro de scope', () => {
    const scope = ['src/dashboard/**', 'PLAN.md']
    expect(pathsOutsideScope(['src/dashboard/public/theme.js', 'PLAN.md'], scope)).toEqual([])
  })

  test('un path que no matchea ningún glob queda fuera de scope', () => {
    const scope = ['src/dashboard/**']
    expect(pathsOutsideScope(['src/run/harness.ts'], scope)).toEqual(['src/run/harness.ts'])
  })

  test('scope vacío deja todo fuera', () => {
    expect(pathsOutsideScope(['a.ts'], [])).toEqual(['a.ts'])
  })
})

describe('hasOutOfScopeJustification', () => {
  test('detecta la línea de justificación agregada en el diff', () => {
    const diff = '+ **Fuera de scope declarado:** también toqué X porque Y.\n'
    expect(hasOutOfScopeJustification(diff)).toBe(true)
  })

  test('sin la línea, no hay justificación', () => {
    expect(hasOutOfScopeJustification('+ algo random\n')).toBe(false)
  })
})

describe('planClosesItem', () => {
  test('detecta el cierre del ítem en el diff agregado', () => {
    const diff = '+- [x] **H.4.1 — 🧠 Título.** (cerrado 2026-09-01)\n'
    expect(planClosesItem(diff, 'H.4.1')).toBe(true)
  })

  test('no confunde con otro ítem parecido', () => {
    const diff = '+- [x] **H.4.2 — 🧠 Título.** (cerrado 2026-09-01)\n'
    expect(planClosesItem(diff, 'H.4.1')).toBe(false)
  })
})

describe('planHasItem', () => {
  const plan = [
    '- [x] **S.1 — ⚡ Renombrar la etiqueta histórica.** (cerrado 2026-09-09)',
    '- [ ] **H.7.3** — ⚡ El hook: avisar al 60%',
  ].join('\n')

  test('encuentra un ítem abierto', () => {
    expect(planHasItem(plan, 'H.7.3')).toBe(true)
  })

  test('encuentra un ítem cerrado', () => {
    expect(planHasItem(plan, 'S.1')).toBe(true)
  })

  test('un ítem borrado de PLAN.md no existe (caso zombi AG.1b, 2026-09-11)', () => {
    expect(planHasItem(plan, 'AG.1b')).toBe(false)
  })

  test('no confunde un ítem con otro que lo tiene como prefijo', () => {
    expect(planHasItem(plan, 'S')).toBe(false)
  })

  test('PLAN.md vacío no tiene ningún ítem', () => {
    expect(planHasItem('', 'H.7.3')).toBe(false)
  })
})
