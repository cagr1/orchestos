// USD per 1M tokens (input / output) — update as pricing changes
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-7':    { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':  { input:  3.00, output: 15.00 },
  'claude-haiku-4-5':   { input:  0.80, output:  4.00 },
  'gpt-4o':             { input:  2.50, output: 10.00 },
  'gpt-4o-mini':        { input:  0.15, output:  0.60 },
}

export function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? { input: 0, output: 0 }
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}
