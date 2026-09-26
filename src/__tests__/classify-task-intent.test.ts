import { afterEach, describe, expect, it } from 'bun:test'
import { classifyTaskIntent, parseTaskIntentResponse } from '../chat/classify-task-intent.ts'
import type { OrcheConfig } from '../config/schema.ts'

// J.1 (Mes 18) — B.1.b, clasificador semántico de intención de tarea en el
// Chat. parseTaskIntentResponse es puro (mismo patrón que
// parsePatternSuggestions en analyze/patterns.ts) — testeable sin LLM.

describe('parseTaskIntentResponse', () => {
  it('parses a plain JSON object', () => {
    const r = parseTaskIntentResponse('{"isTask": true, "reason": "Pide crear una página web"}')
    expect(r).toEqual({ isTask: true, reason: 'Pide crear una página web' })
  })

  it('parses JSON wrapped in a markdown fence', () => {
    const r = parseTaskIntentResponse(
      '```json\n{"isTask": false, "reason": "Es una pregunta"}\n```',
    )
    expect(r).toEqual({ isTask: false, reason: 'Es una pregunta' })
  })

  it('fails safe (isTask:false) on malformed JSON', () => {
    const r = parseTaskIntentResponse('not json at all')
    expect(r.isTask).toBe(false)
  })

  it('fails safe on valid JSON that is not an object', () => {
    const r = parseTaskIntentResponse('[1, 2, 3]')
    expect(r.isTask).toBe(false)
  })

  it('coerces a non-boolean isTask to false', () => {
    const r = parseTaskIntentResponse('{"isTask": "yes", "reason": "x"}')
    expect(r.isTask).toBe(false)
  })

  it('defaults reason to empty string when missing or non-string', () => {
    expect(parseTaskIntentResponse('{"isTask": true}').reason).toBe('')
    expect(parseTaskIntentResponse('{"isTask": true, "reason": 42}').reason).toBe('')
  })

  it('truncates an excessively long reason to 200 chars', () => {
    const longReason = 'x'.repeat(500)
    const r = parseTaskIntentResponse(JSON.stringify({ isTask: true, reason: longReason }))
    expect(r.reason.length).toBe(200)
  })
})

describe('classifyTaskIntent', () => {
  const originalFetch = globalThis.fetch
  const prevKey = process.env.OPENROUTER_API_KEY
  const cfg = {
    config_version: 1,
    roles: { auxiliary: { agent: 'api', model: 'deepseek/test', provider: 'openrouter' } },
    models: {},
  } as OrcheConfig

  afterEach(() => {
    globalThis.fetch = originalFetch
    if (prevKey === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = prevKey
  })

  it('returns the classifier result on a successful call', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    let requestBody: Record<string, unknown> | undefined
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"isTask": true, "reason": "Pide construir un sitio completo"}',
              },
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 10 },
        }),
        { status: 200 },
      )
    }) as unknown as typeof fetch

    const r = await classifyTaskIntent(
      'hazme una página web de criptomonedas con gráficos 3D',
      cfg,
      '/tmp',
    )
    expect(r.isTask).toBe(true)
    expect(r.reason).toBe('Pide construir un sitio completo')
    expect(requestBody?.model).toBe('deepseek/test')
    expect(requestBody?.max_tokens).toBeGreaterThanOrEqual(1000)
  })

  it('fails safe (isTask:false) when the provider call throws', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    globalThis.fetch = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch

    const r = await classifyTaskIntent('cualquier mensaje', cfg, '/tmp')
    expect(r).toEqual({ isTask: false, reason: '' })
  })

  it('fails safe (isTask:false) when the provider returns a non-OK response', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    globalThis.fetch = (async () =>
      new Response('server error', { status: 500 })) as unknown as typeof fetch

    const r = await classifyTaskIntent('cualquier mensaje', cfg, '/tmp')
    expect(r.isTask).toBe(false)
  })

  it('does not call a provider when Auxiliary is unassigned', async () => {
    let called = false
    globalThis.fetch = (async () => {
      called = true
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    const r = await classifyTaskIntent('build this', { ...cfg, roles: {} }, '/tmp')
    expect(r).toEqual({ isTask: false, reason: 'auxiliary-unassigned' })
    expect(called).toBe(false)
  })
})
