import { describe, expect, test } from 'bun:test'
import { compareBudget } from './lint-budget'

describe('compareBudget', () => {
  test('igual: no hay over ni under', () => {
    expect(compareBudget({ a: 2 }, { a: 2 })).toEqual({ over: [], under: [] })
  })

  test('una regla sube', () => {
    expect(compareBudget({ a: 3 }, { a: 2 })).toEqual({ over: ['a'], under: [] })
  })

  test('regla nueva sin tope', () => {
    expect(compareBudget({ nueva: 1 }, {})).toEqual({ over: ['nueva'], under: [] })
  })

  test('una regla baja', () => {
    expect(compareBudget({ a: 1 }, { a: 2 })).toEqual({ over: [], under: ['a'] })
  })

  test('regla del presupuesto ausente del conteo cuenta como cero', () => {
    expect(compareBudget({}, { a: 2 })).toEqual({ over: [], under: ['a'] })
  })
})
