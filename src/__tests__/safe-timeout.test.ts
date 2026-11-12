import { expect, it } from 'bun:test'
import { safeTimeoutMs } from '../boundary/config-limits.ts'

for (const value of [
  0,
  1,
  30,
  40,
  2 ** 31 - 1,
  2 ** 31,
  -5,
  1.5,
  Number.NaN,
  Infinity,
  undefined,
  '60000',
  59999,
  60000,
  86400000,
  86400001,
]) {
  it(`safeTimeoutMs validates ${value}`, () => {
    const valid =
      typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 2 ** 31 - 1
    expect(safeTimeoutMs(value, 1200000)).toBe(valid ? value : 1200000)
  })
}
