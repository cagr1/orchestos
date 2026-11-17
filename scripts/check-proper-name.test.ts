import { expect, it } from 'bun:test'
import { findProperName } from './check-proper-name.ts'

it('finds Carlos as a whole word without regard to case', () => {
  expect(findProperName('// decisión de Carlos\nCARLOS\ncarlosgallardo\nCarlota')).toEqual([1, 2])
})
