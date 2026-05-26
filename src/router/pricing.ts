// USD per 1M tokens — OpenRouter model IDs
const PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-opus-4-7':    { input: 15.00, output: 75.00 },
  'anthropic/claude-sonnet-4-6':  { input:  3.00, output: 15.00 },
  'anthropic/claude-haiku-4-5':   { input:  0.80, output:  4.00 },
  'openai/gpt-4o':                { input:  2.50, output: 10.00 },
  'openai/gpt-4o-mini':           { input:  0.15, output:  0.60 },
  'google/gemini-2.5-flash':      { input:  0.15, output:  0.60 },
  'mistralai/mistral-small':      { input:  0.20, output:  0.60 },
}

export function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? { input: 0, output: 0 }
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}
