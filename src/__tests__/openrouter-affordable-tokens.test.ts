import { describe, it, expect } from 'bun:test'
import { parseAffordableTokens } from '../providers/openrouter.ts'

// Bug real (2026-07-09): un 402 de OpenRouter por saldo insuficiente frente
// al techo del modelo (no al gasto real de la tarea) hacía fallar la tarea
// en seco. parseAffordableTokens() extrae el número real que el proveedor
// ya reporta para poder reintentar con un presupuesto que sí calza.
describe('parseAffordableTokens', () => {
  it('extracts the affordable token count from a real OpenRouter 402 body', () => {
    const body = '{"error":{"message":"This request requires more credits, or fewer max_tokens. You requested up to 128000 tokens, but can only afford 118057. To increase, visit https://openrouter.ai/settings/credits and add more credits","code":402}}'
    expect(parseAffordableTokens(body)).toBe(118057)
  })

  it('returns null for an unrelated error body', () => {
    expect(parseAffordableTokens('{"error":{"message":"Rate limit exceeded","code":429}}')).toBeNull()
  })

  it('returns null for malformed/empty input', () => {
    expect(parseAffordableTokens('')).toBeNull()
    expect(parseAffordableTokens('not json at all')).toBeNull()
  })
})
