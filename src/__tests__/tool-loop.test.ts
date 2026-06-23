import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { runToolLoop, FETCH_URL_TOOL } from '../providers/tool-call.ts'

const originalFetch = globalThis.fetch

beforeAll(() => {
  process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
  process.env.ANTHROPIC_API_KEY = 'sk-test-anthropic-key'
})

afterAll(() => {
  delete process.env.OPENROUTER_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  globalThis.fetch = originalFetch
})

function mockFetch(responses: Array<{ status?: number; body: any }>) {
  let callIndex = 0
  globalThis.fetch = ((url: string | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof url === 'string' ? url : url.toString()
    if (!urlStr.includes('chat/completions') && !urlStr.includes('v1/messages')) {
      return originalFetch(url, init!)
    }
    const resp = responses[callIndex]
    if (!resp) throw new Error(`Unexpected fetch #${callIndex} to ${urlStr}`)
    callIndex++
    return Promise.resolve(new Response(JSON.stringify(resp.body), {
      status: resp.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    }))
  }) as unknown as typeof globalThis.fetch
  return () => callIndex
}

describe('runToolLoop — OpenAI-compatible (openrouter)', () => {
  it('returns text directly when no tool calls', async () => {
    mockFetch([{
      body: {
        choices: [{ message: { content: 'Hello there!' } }],
        usage: { prompt_tokens: 5, completion_tokens: 3 },
      },
    }])

    const result = await runToolLoop('openrouter', 'openai/gpt-4o-mini', {
      system: 'Be concise',
      messages: [{ role: 'user', content: 'Hi' }],
      tools: [FETCH_URL_TOOL],
      executeTool: async () => '',
    })

    expect(result.text).toBe('Hello there!')
    expect(result.toolCallsExecuted).toEqual([])
    expect(result.inputTokens).toBe(5)
    expect(result.outputTokens).toBe(3)
  })

  it('one tool call → execute → final text', async () => {
    mockFetch([
      {
        body: {
          choices: [{
            message: {
              content: null,
              tool_calls: [
                { id: 'call_1', type: 'function', function: { name: 'fetch_url', arguments: '{"url":"https://example.com"}' } },
              ],
            },
          }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        },
      },
      {
        body: {
          choices: [{ message: { content: 'Page content loaded.' } }],
          usage: { prompt_tokens: 30, completion_tokens: 10 },
        },
      },
    ])

    const result = await runToolLoop('openrouter', 'openai/gpt-4o-mini', {
      system: 'Be concise',
      messages: [{ role: 'user', content: 'Fetch https://example.com' }],
      tools: [FETCH_URL_TOOL],
      executeTool: async (name, input) => {
        expect(name).toBe('fetch_url')
        expect(input).toEqual({ url: 'https://example.com' })
        return 'Hello World'
      },
    })

    expect(result.text).toBe('Page content loaded.')
    expect(result.toolCallsExecuted).toHaveLength(1)
    expect(result.toolCallsExecuted[0]).toEqual({ name: 'fetch_url', input: { url: 'https://example.com' } })
    expect(result.inputTokens).toBe(40)
    expect(result.outputTokens).toBe(15)
  })

  it('multiple tool calls in one turn', async () => {
    mockFetch([
      {
        body: {
          choices: [{
            message: {
              content: null,
              tool_calls: [
                { id: 'call_1', type: 'function', function: { name: 'fetch_url', arguments: '{"url":"https://a.com"}' } },
                { id: 'call_2', type: 'function', function: { name: 'fetch_url', arguments: '{"url":"https://b.com"}' } },
              ],
            },
          }],
          usage: { prompt_tokens: 20, completion_tokens: 10 },
        },
      },
      {
        body: {
          choices: [{ message: { content: 'Both fetched successfully.' } }],
          usage: { prompt_tokens: 50, completion_tokens: 15 },
        },
      },
    ])

    const result = await runToolLoop('openrouter', 'openai/gpt-4o-mini', {
      system: 'Be concise',
      messages: [{ role: 'user', content: 'Fetch both' }],
      tools: [FETCH_URL_TOOL],
      executeTool: async (_name, input) => `Content of ${(input as { url: string }).url}`,
    })

    expect(result.text).toBe('Both fetched successfully.')
    expect(result.toolCallsExecuted).toHaveLength(2)
    expect(result.toolCallsExecuted[0]?.input).toEqual({ url: 'https://a.com' })
    expect(result.toolCallsExecuted[1]?.input).toEqual({ url: 'https://b.com' })
  })

  it('respects maxTurns limit', async () => {
    mockFetch([
      {
        body: {
          choices: [{
            message: {
              content: null,
              tool_calls: [{ id: 'c1', type: 'function', function: { name: 'fetch_url', arguments: '{"url":"https://a.com"}' } }],
            },
          }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        },
      },
      {
        body: {
          choices: [{
            message: {
              content: null,
              tool_calls: [{ id: 'c2', type: 'function', function: { name: 'fetch_url', arguments: '{"url":"https://b.com"}' } }],
            },
          }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        },
      },
    ])

    const result = await runToolLoop('openrouter', 'openai/gpt-4o-mini', {
      system: 'Be concise',
      messages: [{ role: 'user', content: 'Fetch' }],
      tools: [FETCH_URL_TOOL],
      executeTool: async () => 'result',
      maxTurns: 2,
    })

    expect(result.text).toBe('')
    expect(result.toolCallsExecuted).toHaveLength(2)
  })

  it('executor error string is passed to LLM (not thrown)', async () => {
    mockFetch([
      {
        body: {
          choices: [{
            message: {
              content: 'Let me check...',
              tool_calls: [{ id: 'c1', type: 'function', function: { name: 'fetch_url', arguments: '{"url":"https://bad.com"}' } }],
            },
          }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        },
      },
      {
        body: {
          choices: [{ message: { content: 'There was an error fetching.' } }],
          usage: { prompt_tokens: 20, completion_tokens: 8 },
        },
      },
    ])

    const result = await runToolLoop('openrouter', 'openai/gpt-4o-mini', {
      system: 'Be concise',
      messages: [{ role: 'user', content: 'Fetch it' }],
      tools: [FETCH_URL_TOOL],
      executeTool: async () => '[Error: timeout]',
    })

    expect(result.text).toBe('There was an error fetching.')
    expect(result.toolCallsExecuted).toHaveLength(1)
  })
})

describe('runToolLoop — Anthropic', () => {
  it('returns text directly when no tool calls', async () => {
    mockFetch([{
      body: {
        content: [{ type: 'text', text: 'Hello from Claude!' }],
        usage: { input_tokens: 8, output_tokens: 4 },
      },
    }])

    const result = await runToolLoop('anthropic', 'anthropic/claude-haiku-4-5', {
      system: 'Be concise',
      messages: [{ role: 'user', content: 'Hi' }],
      tools: [FETCH_URL_TOOL],
      executeTool: async () => '',
    })

    expect(result.text).toBe('Hello from Claude!')
    expect(result.toolCallsExecuted).toEqual([])
    expect(result.inputTokens).toBe(8)
    expect(result.outputTokens).toBe(4)
  })

  it('one tool call → execute → final text', async () => {
    mockFetch([
      {
        body: {
          content: [
            { type: 'text', text: 'Let me fetch that...' },
            { type: 'tool_use', id: 'toolu_abc', name: 'fetch_url', input: { url: 'https://example.com' } },
          ],
          usage: { input_tokens: 15, output_tokens: 8 },
        },
      },
      {
        body: {
          content: [{ type: 'text', text: 'Here is the content.' }],
          usage: { input_tokens: 40, output_tokens: 12 },
        },
      },
    ])

    const result = await runToolLoop('anthropic', 'anthropic/claude-haiku-4-5', {
      system: 'Be concise',
      messages: [{ role: 'user', content: 'Fetch https://example.com' }],
      tools: [FETCH_URL_TOOL],
      executeTool: async (name, input) => {
        expect(name).toBe('fetch_url')
        expect(input).toEqual({ url: 'https://example.com' })
        return 'Page content'
      },
    })

    expect(result.text).toBe('Here is the content.')
    expect(result.toolCallsExecuted).toHaveLength(1)
    expect(result.toolCallsExecuted[0]).toEqual({ name: 'fetch_url', input: { url: 'https://example.com' } })
    expect(result.inputTokens).toBe(55)
    expect(result.outputTokens).toBe(20)
  })
})
