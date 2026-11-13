import { afterEach, describe, expect, it, mock } from 'bun:test'
import { parsePatternSuggestions } from '../analyze/patterns.ts'
import { chat } from '../providers/openrouter.ts'
import { createToolRouter, runToolLoop } from '../providers/tool-call.ts'
import { parseCodexStream } from '../run/executors/codex.ts'

const originalFetch = globalThis.fetch
const keys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY'] as const
const originalKeys = keys.map((key) => process.env[key])
afterEach(() => {
  globalThis.fetch = originalFetch
  keys.forEach((key, i) => {
    if (originalKeys[i] === undefined) delete process.env[key]
    else process.env[key] = originalKeys[i]
  })
})

function loop(provider = 'openai', executeTool = mock(async () => 'ok')) {
  for (const key of keys) process.env[key] = ['test', 'key'].join('-')
  return runToolLoop(provider, 'test-model', {
    system: '',
    messages: [{ role: 'user', content: 'test' }],
    tools: [],
    executeTool,
  })
}

function toolResponse(args: string) {
  return {
    choices: [
      {
        message: {
          tool_calls: [
            { id: 'call_bad', type: 'function', function: { name: 'x', arguments: args } },
          ],
        },
      },
    ],
  }
}

describe('AUD.14 — tool arguments', () => {
  it.each(['{"path":', '[1]', 'null', '42', '"text"'])(
    'returns invalid %s to the model with the call id',
    async (args) => {
      const executeTool = mock(async () => 'ok')
      const histories: Array<{ messages: unknown[] }> = []
      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        histories.push(JSON.parse(String(init?.body)))
        return Response.json(
          histories.length === 1
            ? toolResponse(args)
            : { choices: [{ message: { content: 'finished' } }] },
        )
      }) as unknown as typeof fetch
      const result = await loop('openai', executeTool)
      expect(result.text).toBe('finished')
      expect(result.toolCallsExecuted).toEqual([])
      expect(executeTool).not.toHaveBeenCalled()
      const history = histories[1]!.messages as Array<{
        role: string
        tool_call_id?: string
        content: string
      }>
      const error = history.find((entry) => entry.role === 'tool')!
      expect(error.tool_call_id).toBe('call_bad')
      expect(error.content).toContain('[Error: invalid arguments for tool "x":')
      expect(error.content).toContain('Send the arguments as a valid JSON object.]')
      if (args !== '{"path":') expect(error.content).toContain('arguments must be a JSON object')
    },
  )
  it.each(['', '   '])('executes empty arguments %s as an object', async (args) => {
    let round = 0
    const executeTool = mock(async () => 'ok')
    globalThis.fetch = (async () =>
      Response.json(
        ++round === 1 ? toolResponse(args) : { choices: [{ message: { content: 'done' } }] },
      )) as unknown as typeof fetch
    await loop('openai', executeTool)
    expect(executeTool).toHaveBeenCalledWith('x', {}, 'call_bad')
  })
})

describe('AUD.14 — provider responses', () => {
  it.each(['openai', 'anthropic', 'openrouter'])(
    '%s preserves the provider error',
    async (provider) => {
      globalThis.fetch = (async () =>
        Response.json({ error: { message: 'overloaded' } })) as unknown as typeof fetch
      process.env.OPENROUTER_API_KEY = ['test', 'key'].join('-')
      const result =
        provider === 'openrouter'
          ? chat({ model: 'test', system: '', messages: [] })
          : loop(provider)
      try {
        await result
        throw new Error('expected provider rejection')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error).not.toBeInstanceOf(TypeError)
        expect((error as Error).message).toContain('unexpected response')
        expect((error as Error).message).toContain('overloaded')
      }
    },
  )
})

describe('AUD.14 — tool exceptions', () => {
  it('returns handler failures to the model', async () => {
    const router = createToolRouter({
      x: async () => {
        throw new Error('boom')
      },
    })
    expect(await router('x', {})).toBe('[Error: tool "x" failed: boom]')
  })
  it.each([
    new DOMException('cancelled', 'AbortError'),
    Object.assign(new Error('cancelled'), { name: 'AbortError' }),
  ])('rethrows cancellation %s', async (error) => {
    const router = createToolRouter({
      x: async () => {
        throw error
      },
    })
    await expect(router('x', {})).rejects.toBe(error)
  })
})

describe('AUD.14 — numeric metrics', () => {
  it.each(['-3', '1.5', '1e999'])('normalizes invalid pattern frequency %s', (frequency) => {
    const result = parsePatternSuggestions(
      `[{"pattern":"x","fix_hint":"y","frequency":${frequency}}]`,
    )
    expect(result[0]!.frequency).toBe(0)
  })
  it('ignores nonfinite and nonnumeric Codex tokens', () => {
    const result = parseCodexStream(
      '{"type":"turn.completed","usage":{"input_tokens":"20","output_tokens":1e999,"cached_input_tokens":"2","cache_write_input_tokens":null}}',
    )
    expect(result.inputTokens).toBe(0)
    expect(result.outputTokens).toBe(0)
    expect(result.cacheReadTokens).toBe(0)
    expect(result.cacheWriteTokens).toBe(0)
  })
})
