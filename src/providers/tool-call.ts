/**
 * S23.1/S23.2 — Provider tool-calling layer
 *
 * Provides a uniform interface for function calling across providers that
 * support it.  Providers that don't support tool use (codex) return an error;
 * callers should check `supportsToolCalling()` first and fall back to YAML.
 *
 * Supported natively:
 *   anthropic  — Anthropic messages API with `tools`
 *   openai     — OpenAI chat completions API with `tools`
 *   openrouter — OpenAI-compatible API; supported for Claude and GPT models
 *
 * Unsupported:
 *   codex      — no tool-call API surface
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** JSON Schema object describing one tool parameter. */
export interface ToolInputSchema {
  type: 'object'
  required?: string[]
  properties: Record<string, unknown>
}

export interface ToolDef {
  name: string
  description: string
  input_schema: ToolInputSchema
}

export interface ToolCallResult {
  /** Tool name as provided in ToolDef.name */
  toolName: string
  /** Raw parsed arguments from the LLM (already validated by the provider SDK) */
  input: unknown
}

export interface ToolCallResponse {
  calls: ToolCallResult[]
  inputTokens: number
  outputTokens: number
}

// ---------------------------------------------------------------------------
// API key loading (reuses same pattern as existing providers)
// ---------------------------------------------------------------------------

function loadEnvKey(envVar: string): string | undefined {
  if (process.env[envVar]) return process.env[envVar]
  const envPath = join(homedir(), '.orchestos', '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(new RegExp(`^${envVar}\\s*=\\s*(.+)$`))
      if (m?.[1]) return m[1].trim()
    }
  }
  return undefined
}

function requireKey(envVar: string, provider: string): string {
  const val = loadEnvKey(envVar)
  if (val) return val
  throw new Error(`Provider ${provider} requires ${envVar} in ~/.orchestos/.env`)
}

// ---------------------------------------------------------------------------
// Anthropic tool-calling
// ---------------------------------------------------------------------------

export async function anthropicCallWithTools(opts: {
  model: string
  system: string
  userMessage: string
  tools: ToolDef[]
}): Promise<ToolCallResponse> {
  const apiKey = requireKey('ANTHROPIC_API_KEY', 'anthropic')
  const model  = opts.model.startsWith('anthropic/') ? opts.model.slice('anthropic/'.length) : opts.model

  const anthropicTools = opts.tools.map(t => ({
    name:        t.name,
    description: t.description,
    input_schema: t.input_schema,
  }))

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system:     opts.system,
      tools:      anthropicTools,
      messages:   [{ role: 'user', content: opts.userMessage }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic tool-call error ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    content: Array<{ type: string; name?: string; input?: unknown }>
    usage?: { input_tokens?: number; output_tokens?: number }
  }

  const calls: ToolCallResult[] = data.content
    .filter(c => c.type === 'tool_use' && typeof c.name === 'string')
    .map(c => ({ toolName: c.name as string, input: c.input }))

  return {
    calls,
    inputTokens:  data.usage?.input_tokens  ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  }
}

// ---------------------------------------------------------------------------
// OpenAI / OpenRouter tool-calling (OpenAI-compatible API)
// ---------------------------------------------------------------------------

export async function openaiCallWithTools(opts: {
  model: string
  system: string
  userMessage: string
  tools: ToolDef[]
  baseUrl?: string
  apiKey?: string
}): Promise<ToolCallResponse> {
  const key     = opts.apiKey ?? requireKey('OPENAI_API_KEY', 'openai')
  const baseUrl = opts.baseUrl ?? 'https://api.openai.com/v1'
  const model   = opts.model.startsWith('openai/') ? opts.model.slice('openai/'.length) : opts.model

  const openaiTools = opts.tools.map(t => ({
    type: 'function' as const,
    function: {
      name:        t.name,
      description: t.description,
      parameters:  t.input_schema,
    },
  }))

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens:  4096,
      tool_choice: 'auto',
      tools:       openaiTools,
      messages: [
        { role: 'system',  content: opts.system },
        { role: 'user',    content: opts.userMessage },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI tool-call error ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    choices: Array<{
      message: {
        tool_calls?: Array<{ function: { name: string; arguments: string } }>
      }
    }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  const rawCalls = data.choices[0]?.message?.tool_calls ?? []
  const calls: ToolCallResult[] = rawCalls.map(tc => ({
    toolName: tc.function.name,
    input:    JSON.parse(tc.function.arguments),
  }))

  return {
    calls,
    inputTokens:  data.usage?.prompt_tokens       ?? 0,
    outputTokens: data.usage?.completion_tokens   ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Provider capability detection (S23.2)
// ---------------------------------------------------------------------------

/**
 * Returns true if the given provider + model pair supports tool calling.
 *
 * For openrouter, we check the model prefix — Claude and GPT models expose
 * an OpenAI-compatible tool-calling API through the OpenRouter gateway.
 */
export function supportsToolCalling(provider: string, model: string): boolean {
  switch (provider) {
    case 'anthropic': return true
    case 'openai':    return true
    case 'openrouter': {
      const m = model.toLowerCase()
      return (
        m.startsWith('anthropic/')  ||
        m.startsWith('openai/')     ||
        m.startsWith('google/gemini')
      )
    }
    default: return false   // codex and unknown providers
  }
}

// ---------------------------------------------------------------------------
// Unified dispatcher
// ---------------------------------------------------------------------------

/**
 * Calls the appropriate provider's tool-calling API.
 * Throws if the provider doesn't support tool use — check `supportsToolCalling` first.
 */
export async function callWithTools(
  provider: string,
  model: string,
  opts: { system: string; userMessage: string; tools: ToolDef[] },
): Promise<ToolCallResponse> {
  if (provider === 'anthropic') {
    return anthropicCallWithTools({ model, ...opts })
  }

  if (provider === 'openai') {
    return openaiCallWithTools({ model, ...opts })
  }

  if (provider === 'openrouter') {
    const key = loadEnvKey('OPENROUTER_API_KEY')
    if (!key) throw new Error('openrouter requires OPENROUTER_API_KEY in ~/.orchestos/.env')
    return openaiCallWithTools({
      model,
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey:  key,
      ...opts,
    })
  }

  throw new Error(
    `Provider '${provider}' does not support tool calling. ` +
    `Use YAML fallback or switch to anthropic / openai / openrouter.`
  )
}
