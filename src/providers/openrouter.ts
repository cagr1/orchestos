import { join } from 'path'
import { homedir } from 'os'
import { existsSync, readFileSync } from 'fs'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatResponse {
  text: string
  inputTokens: number
  outputTokens: number
  model: string
}

/**
 * Reads the OpenRouter API key without throwing.
 * Source order: process.env → ~/.orchestos/.env. Returns null when absent
 * so optional consumers (e.g. the model catalog) can degrade gracefully.
 */
export function tryLoadApiKey(): string | null {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY
  const envPath = join(homedir(), '.orchestos', '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^OPENROUTER_API_KEY\s*=\s*(.+)$/)
      if (m?.[1]) return m[1].trim()
    }
  }
  return null
}

function loadApiKey(): string {
  const key = tryLoadApiKey()
  if (key) return key
  throw new Error(
    'OPENROUTER_API_KEY not found.\n' +
    'Set it in ~/.orchestos/.env:\n' +
    '  OPENROUTER_API_KEY=sk-or-...'
  )
}

/**
 * Bug real encontrado en vivo (2026-07-09): `maxTokens` siempre se calculaba
 * como `min(contextWindow − prompt, providerMaxOutput)` — con un modelo de
 * ventana grande (ej. 1M tokens de claude-sonnet-5) y un prompt chico, esto
 * clampeaba directo al TECHO ABSOLUTO del modelo (128,000), sin relación
 * ninguna con cuánto la tarea realmente necesitaba ni con el saldo real de
 * la cuenta. OpenRouter pre-autoriza contra el PEOR CASO (128,000 tokens ×
 * precio de salida), no contra el gasto real esperado — un usuario con
 * saldo modesto ($0.78) no podía correr NINGUNA tarea con un modelo caro
 * aunque la tarea real fuera a costar centavos. Carlos: "OrchestOS debe
 * adaptarse al modelo que el usuario use", no asumir saldo ilimitado.
 * `parseAffordableTokens()` extrae el número real que el 402 de OpenRouter
 * ya reporta ("...can only afford 118057...") para reintentar UNA vez con
 * un presupuesto que sí calza, en vez de fallar en seco.
 */
export function parseAffordableTokens(errorBody: string): number | null {
  const m = errorBody.match(/can only afford (\d+)/i)
  return m?.[1] ? parseInt(m[1], 10) : null
}

// OpenRouter uses the OpenAI chat completions format —
// same endpoint works for Claude, GPT, Gemini, Mistral, local models, etc.
export async function chat(opts: {
  model: string       // e.g. "anthropic/claude-haiku-4-5" or any OpenRouter model ID
  system: string
  messages: ChatMessage[]
  /** Reasoning effort, solo aplicado si el caller ya confirmó que el modelo lo soporta (ver BACK.1/BACK.3). */
  effort?: 'low' | 'medium' | 'high'
  /** Tope de tokens de salida — el caller debe resolverlo vía `maxOutputTokensFor()` (model-catalog.ts) en vez de adivinar; default 8192 si no se pasa (mismo valor histórico, para no romper callers que todavía no migraron). */
  maxTokens?: number
  /** Interno — evita un segundo reintento si el 402 persiste con el presupuesto ya reducido. */
  _retriedForBalance?: boolean
}): Promise<ChatResponse> {
  const apiKey = loadApiKey()

  const requestedMaxTokens = opts.maxTokens ?? 8192
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: requestedMaxTokens,
    messages: [
      { role: 'system', content: opts.system },
      ...opts.messages,
    ],
  }
  if (opts.effort) body.reasoning = { effort: opts.effort }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/cagr1/orchestos',
      'X-Title': 'orchestos',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    // Bug real (2026-07-09) — ver parseAffordableTokens() arriba: reintentar
    // UNA vez con el presupuesto real que la cuenta puede pagar, en vez de
    // fallar en seco cuando `max_tokens` pedía el techo del modelo completo.
    if (res.status === 402 && !opts._retriedForBalance) {
      const affordable = parseAffordableTokens(err)
      if (affordable && affordable < requestedMaxTokens) {
        const retryBudget = Math.max(256, affordable - 256)
        return chat({ ...opts, maxTokens: retryBudget, _retriedForBalance: true })
      }
    }
    throw new Error(`OpenRouter error ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
    usage: { prompt_tokens: number; completion_tokens: number }
    model: string
  }

  const text = data.choices[0]?.message?.content ?? ''
  return {
    text,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    model: data.model ?? opts.model,
  }
}
