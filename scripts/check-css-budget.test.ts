import { expect, it } from 'bun:test'
import { countCssLines } from './check-css-budget.ts'
import { compareMockBudget } from './check-mock-module.ts'

it('counts CSS lines with and without a final newline', () => {
  expect(countCssLines('a {\n  color: red;\n}')).toBe(3)
  expect(countCssLines('a {\n  color: red;\n}\n')).toBe(3)
})

it('classifies a new CSS file without a budget as unknown', () => {
  expect(compareMockBudget({ 'new.css': 1 }, {})).toEqual({
    over: [],
    unknown: ['new.css'],
    under: [],
  })
})

it('classifies a CSS file above its budget as over', () => {
  expect(compareMockBudget({ 'main.css': 2 }, { 'main.css': 1 }).over).toEqual(['main.css'])
})
