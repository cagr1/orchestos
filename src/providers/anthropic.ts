import { join } from 'path'
import { homedir } from 'os'
import { existsSync, readFileSync } from 'fs'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  text: string
  inputTokens: number
  outputTokens: number
  model: string
}

function loadApiKey(): string {
  // 1. env var
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  // 2. ~/.orchestos/.env
  const envPath = join(homedir(), '.orchestos', '.env')
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf-8').split('\n')
    for (const line of lines) {
      const m = line.match(/^ANTHROPIC_API_KEY\s*=\s*(.+)$/)
      if (m) return m[1].trim()
    }
  }
  throw new Error('ANTHROPIC_API_KEY not found. Set it in ~/.orchestos/.env or as env var.')
}

export async function chat(opts: {
  model: string
  system: string
  messages: ChatMessage[]
}): Promise<ChatResponse> {
  const apiKey = loadApiKey()

  const body = {
    model: opts.model,
    max_tokens: 8192,
    system: opts.system,
    messages: opts.messages,
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>
    usage: { input_tokens: number; output_tokens: number }
    model: string
  }

  const text = data.content.find(b => b.type === 'text')?.text ?? ''
  return {
    text,
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
    model: data.model,
  }
}
