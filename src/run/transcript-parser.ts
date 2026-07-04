import { calcCost } from '../router/pricing.ts'

export interface CostBreakdownEntry {
  label: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  /**
   * C.1 — process info del ejecutor externo (`external` engine). Opcionales
   * porque single-shot/agentic no spawnean subproceso: el JSON.parse los
   * conserva en lectura (test del shape: parseCostBreakdownJson los devuelve
   * como `undefined` para entradas que no los tengan — son additive fields).
   */
  binary?: string
  args?: string[]
}

export function calcEntryCost(
  label: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): CostBreakdownEntry {
  return {
    label,
    model,
    inputTokens,
    outputTokens,
    costUsd: calcCost(model, inputTokens, outputTokens),
  }
}

export function sumCosts(entries: CostBreakdownEntry[]): number {
  return entries.reduce((s, e) => s + e.costUsd, 0)
}

export function sumTokens(entries: CostBreakdownEntry[]): { inputTokens: number; outputTokens: number } {
  return {
    inputTokens: entries.reduce((s, e) => s + e.inputTokens, 0),
    outputTokens: entries.reduce((s, e) => s + e.outputTokens, 0),
  }
}

export function costBreakdownToJson(entries: CostBreakdownEntry[]): string {
  return JSON.stringify(entries)
}

export function parseCostBreakdownJson(json: string | null | undefined): CostBreakdownEntry[] {
  if (!json) return []
  try {
    return JSON.parse(json) as CostBreakdownEntry[]
  } catch {
    return []
  }
}
