import { expect, it } from 'bun:test'
import { compareMockBudget, countMockModule, formatUnderBudget } from './check-mock-module.ts'

it('counts calls and ignores literals and comments', () => {
  const content =
    "mock.module('real', () => ({}))\n`mock.module('template')`\n// mock.module('line')\n/* mock.module('block') */"
  expect(countMockModule(content)).toBe(1)
})

it('counts mock.module calls inside template interpolations', () => {
  expect(countMockModule(['`value: $', '{mock.module("real", () => ({}))}', '`'].join(''))).toBe(1)
})

it('ignores regex literals that resemble calls', () => {
  expect(countMockModule('const pattern = /mock\\.module\\(foo\\)/')).toBe(0)
})

it('classifies routes against the mock.module budget', () => {
  expect(
    compareMockBudget(
      { 'over.test.ts': 2, 'under.test.ts': 1, 'unknown.test.ts': 1 },
      { 'over.test.ts': 1, 'under.test.ts': 2 },
    ),
  ).toEqual({
    over: ['over.test.ts'],
    unknown: ['unknown.test.ts'],
    under: ['under.test.ts'],
  })
})

it('formats a zero under-budget count explicitly', () => {
  expect(formatUnderBudget('empty.test.ts', 0)).toBe('⚠ bajar el presupuesto de empty.test.ts a 0')
})
