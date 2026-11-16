import { expect, test } from 'bun:test'
import { firstOllamaModel } from './clients.ts'

const respond = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

test('WIN.13 — firstOllamaModel returns the first installed model as ollama/<name>', async () => {
  expect(
    await firstOllamaModel(respond(200, { models: [{ name: 'qwen2.5-coder:7b' }, { name: 'x' }] })),
  ).toBe('ollama/qwen2.5-coder:7b')
})

test('WIN.13 — firstOllamaModel is undefined when Ollama has no models, errors or is down', async () => {
  expect(await firstOllamaModel(respond(200, { models: [] }))).toBeUndefined()
  expect(await firstOllamaModel(respond(500, {}))).toBeUndefined()
  const down = (async () => {
    throw new Error('ECONNREFUSED')
  }) as unknown as typeof fetch
  expect(await firstOllamaModel(down)).toBeUndefined()
})
