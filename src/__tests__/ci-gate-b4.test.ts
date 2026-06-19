// B4 gate — test roto a propósito para verificar que CI lo bloquea
import { describe, it, expect } from 'bun:test'

describe('CI gate B4 — deliberate failure', () => {
  it('FALLA A PROPÓSITO — este test no debe llegar a master', () => {
    expect(1 + 1).toBe(999) // roto intencionalmente
  })
})
