import { getCatalog } from './model-catalog.ts'

// USD per 1M tokens — fallback estático cuando el modelo no está en el catálogo
const PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-opus-4-7':      { input: 15.00, output: 75.00 },
  'anthropic/claude-sonnet-4-6':    { input:  3.00, output: 15.00 },
  'anthropic/claude-haiku-4-5':              { input:  0.80, output:  4.00 },
  'anthropic/claude-haiku-4-5-20251001':    { input:  0.80, output:  4.00 },
  'anthropic/claude-3-haiku':       { input:  0.25, output:  1.25 },
  'openai/gpt-4o':                  { input:  2.50, output: 10.00 },
  'openai/gpt-4o-mini':             { input:  0.15, output:  0.60 },
  'google/gemini-2.5-flash':        { input:  0.15, output:  0.60 },
  'mistralai/mistral-small':        { input:  0.20, output:  0.60 },
  'deepseek/deepseek-v3':           { input:  0.27, output:  1.10 },
  'deepseek/deepseek-v4-flash':     { input:  0.15, output:  0.60 },
  'deepseek/deepseek-r1':           { input:  0.55, output:  2.19 },
}

export function calcCost(model: string, inputTokens: number, outputTokens: number): number {
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
  const p = PRICING[model] ?? { input: 0, output: 0 }
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}
