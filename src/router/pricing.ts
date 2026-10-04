import { getCatalog } from './model-catalog.ts'

// USD per 1M tokens — fallback estático cuando el modelo no está en el catálogo
const PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-opus-4-7': { input: 15.0, output: 75.0 },
  'anthropic/claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'anthropic/claude-haiku-4-5': { input: 0.8, output: 4.0 },
  'anthropic/claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  'openai/gpt-4o': { input: 2.5, output: 10.0 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'google/gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'mistralai/mistral-small': { input: 0.2, output: 0.6 },
  'deepseek/deepseek-v3': { input: 0.27, output: 1.1 },
  'deepseek/deepseek-v4-flash': { input: 0.15, output: 0.6 },
  'deepseek/deepseek-r1': { input: 0.55, output: 2.19 },
}

/** Returns null when there is no price for the canonical model; zero is a real free price. */
export function knownCost(model: string, inputTokens: number, outputTokens: number): number | null {
  // Try the live catalog first (provides real pricing from OpenRouter API)
  const cat = getCatalog()
  if (cat) {
    const entry = cat.get(model)
    if (entry) {
      const priceIn = typeof entry.priceIn === 'number' ? entry.priceIn : 0
      const priceOut = typeof entry.priceOut === 'number' ? entry.priceOut : 0
      return (inputTokens / 1_000_000) * priceIn + (outputTokens / 1_000_000) * priceOut
    }
  }
  // Fallback to static table
  const p = PRICING[model]
  if (!p) return null
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

export function knownCostWithCache(
  model: string,
  usage: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    cacheWrite1h?: number
  },
): number | null {
  const cat = getCatalog()?.get(model)
  if (cat) {
    const readPrice = cat.priceCacheRead ?? cat.priceIn
    const writePrice = cat.priceCacheWrite ?? cat.priceIn
    const cacheWrite1h = Math.min(usage.cacheWrite, usage.cacheWrite1h ?? 0)
    const write1hPrice = cat.priceCacheWrite1h ?? cat.priceCacheWrite ?? cat.priceIn
    return (
      (usage.input / 1_000_000) * cat.priceIn +
      (usage.output / 1_000_000) * cat.priceOut +
      (usage.cacheRead / 1_000_000) * readPrice +
      ((usage.cacheWrite - cacheWrite1h) / 1_000_000) * writePrice +
      (cacheWrite1h / 1_000_000) * write1hPrice
    )
  }
  const p = PRICING[model]
  if (!p) return null
  return (
    ((usage.input + usage.cacheRead + usage.cacheWrite) / 1_000_000) * p.input +
    (usage.output / 1_000_000) * p.output
  )
}

// Compatibility for task paths predating explicit cost provenance. New chat
// writes must use knownCost() so an unknown model is never presented as free.
export function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  return knownCost(model, inputTokens, outputTokens) ?? 0
}
