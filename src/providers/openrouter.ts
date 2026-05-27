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

function loadApiKey(): string {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY
  const envPath = join(homedir(), '.orchestos', '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^OPENROUTER_API_KEY\s*=\s*(.+)$/)
      if (m?.[1]) return m[1].trim()
    }
  }
  throw new Error(
    'OPENROUTER_API_KEY not found.\n' +
    'Set it in ~/.orchestos/.env:\n' +
    '  OPENROUTER_API_KEY=sk-or-...'
  )
}

// OpenRouter uses the OpenAI chat completions format —
// same endpoint works for Claude, GPT, Gemini, Mistral, local models, etc.
export async function chat(opts: {
  model: string       // e.g. "anthropic/claude-haiku-4-5" or any OpenRouter model ID
  system: string
  messages: ChatMessage[]
}): Promise<ChatResponse> {
  const apiKey = loadApiKey()

  const body = {
    model: opts.model,
    max_tokens: 8192,
    messages: [
      { role: 'system', content: opts.system },
      ...opts.messages,
    ],
  }

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
