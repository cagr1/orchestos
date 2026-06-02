/**
 * S24.2 — Tests for EmbeddingProvider interface + implementations.
 *
 * API calls (OpenAI, Ollama) are mocked via globalThis.fetch override so
 * no real network requests are made. Tests cover:
 *   - cosine similarity (pure math, no mock)
 *   - getEmbeddingProvider registry
 *   - inferEmbeddingProvider heuristic
 *   - embedOpenAI: happy path, empty input, error response
 *   - embedOllama: happy path, empty input, missing embeddings, error response
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import {
  cosine,
  getEmbeddingProvider,
  inferEmbeddingProvider,
  embedOpenAI,
  embedOllama,
} from '../providers/embeddings.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FetchMock = (url: string, opts?: RequestInit) => Promise<Response>

function mockFetch(impl: FetchMock) {
  const original = globalThis.fetch
  globalThis.fetch = impl as typeof fetch
  return () => { globalThis.fetch = original }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Fake OpenAI /v1/embeddings response for N texts. */
function fakeOpenAIResponse(n: number, dims = 4): object {
  return {
    data: Array.from({ length: n }, (_, i) => ({
      index:     i,
      embedding: Array.from({ length: dims }, (_, d) => (i + 1) * (d + 1) * 0.1),
    })),
    usage: { prompt_tokens: n * 10 },
  }
}

/** Fake Ollama /api/embed response for N texts. */
function fakeOllamaResponse(n: number, dims = 4): object {
  return {
    embeddings: Array.from({ length: n }, (_, i) =>
      Array.from({ length: dims }, (_, d) => (i + 1) * (d + 1) * 0.1)
    ),
    prompt_eval_count: n * 8,
  }
}

// ---------------------------------------------------------------------------
// cosine similarity
// ---------------------------------------------------------------------------

describe('cosine', () => {
  it('identical vectors → 1', () => {
    expect(cosine([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
  })

  it('orthogonal vectors → 0', () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('opposite vectors → -1', () => {
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1)
  })

  it('zero vector → 0 (no divide-by-zero)', () => {
    expect(cosine([0, 0, 0], [1, 2, 3])).toBe(0)
  })

  it('typical similarity is in (-1, 1)', () => {
    const a = [0.2, 0.5, 0.1]
    const b = [0.3, 0.4, 0.6]
    const sim = cosine(a, b)
    expect(sim).toBeGreaterThan(-1)
    expect(sim).toBeLessThan(1)
  })

  it('throws on length mismatch', () => {
    expect(() => cosine([1, 2], [1, 2, 3])).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe('getEmbeddingProvider', () => {
  it('returns openai provider', () => {
    const p = getEmbeddingProvider('openai')
    expect(p.name).toBe('openai')
    expect(typeof p.embed).toBe('function')
  })

  it('returns ollama provider', () => {
    const p = getEmbeddingProvider('ollama')
    expect(p.name).toBe('ollama')
    expect(typeof p.embed).toBe('function')
  })

  it('throws for unknown provider', () => {
    expect(() => getEmbeddingProvider('unknown')).toThrow(/unknown embedding provider/)
  })
})

describe('inferEmbeddingProvider', () => {
  const original = process.env.OLLAMA_BASE_URL

  afterEach(() => {
    if (original === undefined) delete process.env.OLLAMA_BASE_URL
    else process.env.OLLAMA_BASE_URL = original
  })

  it('returns openai for anthropic chat provider (no OLLAMA_BASE_URL)', () => {
    delete process.env.OLLAMA_BASE_URL
    expect(inferEmbeddingProvider('anthropic').name).toBe('openai')
  })

  it('returns openai for openrouter (no OLLAMA_BASE_URL)', () => {
    delete process.env.OLLAMA_BASE_URL
    expect(inferEmbeddingProvider('openrouter').name).toBe('openai')
  })

  it('returns ollama when OLLAMA_BASE_URL is set', () => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434'
    expect(inferEmbeddingProvider('anthropic').name).toBe('ollama')
  })
})

// ---------------------------------------------------------------------------
// embedOpenAI
// ---------------------------------------------------------------------------

describe('embedOpenAI', () => {
  const originalKey = process.env.OPENAI_API_KEY

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key-openai'
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalKey
  })

  it('returns embeddings for 2 texts', async () => {
    const restore = mockFetch(async () => jsonResponse(fakeOpenAIResponse(2)))
    try {
      const resp = await embedOpenAI(['hello', 'world'])
      expect(resp.embeddings).toHaveLength(2)
      expect(resp.embeddings[0]).toHaveLength(4)
      expect(resp.inputTokens).toBe(20)
    } finally { restore() }
  })

  it('returns empty for empty input (no fetch)', async () => {
    let called = false
    const restore = mockFetch(async () => { called = true; return jsonResponse({}) })
    try {
      const resp = await embedOpenAI([])
      expect(resp.embeddings).toHaveLength(0)
      expect(called).toBe(false)
    } finally { restore() }
  })

  it('throws on non-200 response', async () => {
    const restore = mockFetch(async () =>
      new Response('{"error":"invalid_api_key"}', { status: 401 })
    )
    try {
      await expect(embedOpenAI(['test'])).rejects.toThrow(/401/)
    } finally { restore() }
  })

  it('sends Authorization header with api key', async () => {
    let capturedHeader = ''
    const restore = mockFetch(async (_url, opts) => {
      capturedHeader = (opts?.headers as Record<string, string>)?.['Authorization'] ?? ''
      return jsonResponse(fakeOpenAIResponse(1))
    })
    try {
      await embedOpenAI(['hello'])
      expect(capturedHeader).toBe('Bearer test-key-openai')
    } finally { restore() }
  })

  it('sorts embeddings by index (API may return out of order)', async () => {
    const restore = mockFetch(async () => jsonResponse({
      data: [
        { index: 1, embedding: [0.2, 0.2] },
        { index: 0, embedding: [0.1, 0.1] },
      ],
      usage: { prompt_tokens: 5 },
    }))
    try {
      const resp = await embedOpenAI(['first', 'second'])
      expect(resp.embeddings[0]).toEqual([0.1, 0.1])
      expect(resp.embeddings[1]).toEqual([0.2, 0.2])
    } finally { restore() }
  })
})

// ---------------------------------------------------------------------------
// embedOllama
// ---------------------------------------------------------------------------

describe('embedOllama', () => {
  const originalUrl = process.env.OLLAMA_BASE_URL

  beforeEach(() => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434'
  })

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.OLLAMA_BASE_URL
    else process.env.OLLAMA_BASE_URL = originalUrl
  })

  it('returns embeddings for 3 texts', async () => {
    const restore = mockFetch(async () => jsonResponse(fakeOllamaResponse(3)))
    try {
      const resp = await embedOllama(['a', 'b', 'c'])
      expect(resp.embeddings).toHaveLength(3)
      expect(resp.embeddings[0]).toHaveLength(4)
      expect(resp.inputTokens).toBe(24)
    } finally { restore() }
  })

  it('returns empty for empty input (no fetch)', async () => {
    let called = false
    const restore = mockFetch(async () => { called = true; return jsonResponse({}) })
    try {
      const resp = await embedOllama([])
      expect(resp.embeddings).toHaveLength(0)
      expect(called).toBe(false)
    } finally { restore() }
  })

  it('throws on non-200 response', async () => {
    const restore = mockFetch(async () =>
      new Response('model not found', { status: 404 })
    )
    try {
      await expect(embedOllama(['test'])).rejects.toThrow(/404/)
    } finally { restore() }
  })

  it('throws with helpful message when embeddings field missing', async () => {
    const restore = mockFetch(async () => jsonResponse({ error: 'model not pulled' }))
    try {
      await expect(embedOllama(['test'])).rejects.toThrow(/embeddings/)
    } finally { restore() }
  })

  it('uses OLLAMA_BASE_URL env var for request URL', async () => {
    process.env.OLLAMA_BASE_URL = 'http://custom-host:9999'
    let capturedUrl = ''
    const restore = mockFetch(async (url) => {
      capturedUrl = url as string
      return jsonResponse(fakeOllamaResponse(1))
    })
    try {
      await embedOllama(['test'])
      expect(capturedUrl).toContain('custom-host:9999')
    } finally { restore() }
  })
})
