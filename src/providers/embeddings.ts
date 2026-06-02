/**
 * S24.2 — EmbeddingProvider interface + OpenAI + Ollama implementations.
 *
 * Design:
 *   - `EmbeddingProvider` mirrors the `ProviderClient` pattern: interface + registry.
 *   - `embed(texts)` accepts a batch so callers can amortise API round-trips.
 *   - OpenAI: `text-embedding-3-small` (1536 dims, ~$0.02/1M tokens).
 *   - Ollama: `nomic-embed-text` (768 dims, local, no API key required).
 *   - `cosine(a, b)` utility exported here — used by S24.4 re-ranking.
 *
 * API key loading follows the same chain as openai.ts / anthropic.ts:
 *   env var → ~/.orchestos/.env
 *
 * Ollama URL defaults to http://localhost:11434 but is overridable via
 *   OLLAMA_BASE_URL env var for non-standard installs.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EmbedResponse {
  /** One embedding vector per input text, in the same order as the input. */
  embeddings: number[][]
  /** Token count charged for this request (0 for local providers). */
  inputTokens: number
}

export interface EmbeddingProvider {
  /** Human-readable identifier, e.g. "openai" | "ollama". */
  name: string
  /**
   * Embed a batch of texts.
   * All texts in the batch are processed in a single API call where possible.
   */
  embed(texts: string[]): Promise<EmbedResponse>
}

// ---------------------------------------------------------------------------
// API-key loader (shared pattern with openai.ts / anthropic.ts)
// ---------------------------------------------------------------------------

function loadOpenAiKey(): string {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  const envPath = join(homedir(), '.orchestos', '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^OPENAI_API_KEY\s*=\s*(.+)$/)
      if (m?.[1]) return m[1].trim()
    }
  }
  throw new Error(
    'EmbeddingProvider "openai" requires OPENAI_API_KEY in env or ~/.orchestos/.env'
  )
}

// ---------------------------------------------------------------------------
// OpenAI implementation — text-embedding-3-small
// ---------------------------------------------------------------------------

const OPENAI_EMBED_MODEL = 'text-embedding-3-small'
const OPENAI_EMBED_URL   = 'https://api.openai.com/v1/embeddings'

export async function embedOpenAI(texts: string[]): Promise<EmbedResponse> {
  if (texts.length === 0) return { embeddings: [], inputTokens: 0 }
  const apiKey = loadOpenAiKey()

  const res = await fetch(OPENAI_EMBED_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: OPENAI_EMBED_MODEL, input: texts }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI embeddings error ${res.status}: ${body}`)
  }

  const data = await res.json() as {
    data:  Array<{ embedding: number[]; index: number }>
    usage: { prompt_tokens: number }
  }

  // API returns embeddings in the order of the input array
  const sorted = [...data.data].sort((a, b) => a.index - b.index)
  return {
    embeddings: sorted.map(d => d.embedding),
    inputTokens: data.usage.prompt_tokens,
  }
}

// ---------------------------------------------------------------------------
// Ollama implementation — nomic-embed-text (local, no API key)
// ---------------------------------------------------------------------------

const OLLAMA_DEFAULT_URL = 'http://localhost:11434'
const OLLAMA_EMBED_MODEL = 'nomic-embed-text'

function ollamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL ?? OLLAMA_DEFAULT_URL).replace(/\/$/, '')
}

export async function embedOllama(texts: string[]): Promise<EmbedResponse> {
  if (texts.length === 0) return { embeddings: [], inputTokens: 0 }
  const url = `${ollamaBaseUrl()}/api/embed`

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: OLLAMA_EMBED_MODEL, input: texts }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Ollama embeddings error ${res.status}: ${body}`)
  }

  const data = await res.json() as {
    embeddings: number[][]
    prompt_eval_count?: number
  }

  if (!Array.isArray(data.embeddings)) {
    throw new Error('Ollama response missing "embeddings" array — is the model pulled?')
  }

  return {
    embeddings:  data.embeddings,
    inputTokens: data.prompt_eval_count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Registry — same pattern as getProvider() in index.ts
// ---------------------------------------------------------------------------

/**
 * Returns an EmbeddingProvider by name.
 *
 * @param name  "openai" | "ollama"
 * @throws if name is unknown
 */
export function getEmbeddingProvider(name: string): EmbeddingProvider {
  switch (name) {
    case 'openai':
      return { name: 'openai', embed: embedOpenAI }
    case 'ollama':
      return { name: 'ollama', embed: embedOllama }
    default:
      throw new Error(
        `unknown embedding provider '${name}' — allowed: openai, ollama`
      )
  }
}

/**
 * Infers the appropriate embedding provider from the orchestos provider name.
 *
 * Convention:
 *   anthropic / openrouter → openai embeddings (best hosted option)
 *   openai                 → openai embeddings
 *   codex / unknown        → openai embeddings as default hosted
 *
 * If OLLAMA_BASE_URL is set, returns "ollama" regardless of provider.
 */
export function inferEmbeddingProvider(chatProvider: string): EmbeddingProvider {
  if (process.env.OLLAMA_BASE_URL) return getEmbeddingProvider('ollama')
  // All hosted chat providers map to OpenAI embeddings by default
  return getEmbeddingProvider('openai')
}

// ---------------------------------------------------------------------------
// cosine similarity helper — used by S24.4 re-ranking
// ---------------------------------------------------------------------------

/**
 * Computes cosine similarity between two equal-length vectors.
 * Returns a value in [-1, 1]; higher = more similar.
 * Returns 0 if either vector has zero magnitude.
 */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosine: vector length mismatch (${a.length} vs ${b.length})`)
  }
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot  += (a[i] ?? 0) * (b[i] ?? 0)
    magA += (a[i] ?? 0) * (a[i] ?? 0)
    magB += (b[i] ?? 0) * (b[i] ?? 0)
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}
