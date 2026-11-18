if (Bun.argv[2] === '--help') {
  console.log('  --restricted  restrict reads')
  process.exit(0)
}

const input = await new Response(Bun.stdin.stream()).text()
const cases = [
  ['unknown model', 'unknown ', 30, 10, 'unknown-cli-model', undefined],
  ['zero cost', 'zero ', 20, 5, 'claude-sonnet-5', 0],
  ['estimated cost', 'estimated ', 1000, 2000, 'openai/gpt-4o', undefined],
  ['', '', 120, 45, 'claude-sonnet-5', 0.0123],
] as const
const match = cases.find(([name]) => !name || input.includes(`R6 ${name} fixture`)) ?? cases[3]
const [, label, input_tokens, output_tokens, model, total_cost_usd] = match
const content = [{ type: 'text', text: `R6 ${label}fixture reply` }]
console.log(JSON.stringify({ type: 'assistant', message: { content } }))
console.log(
  JSON.stringify({
    type: 'result',
    total_cost_usd,
    usage: { input_tokens, output_tokens },
    modelUsage: { [model]: {} },
  }),
)

export {}
