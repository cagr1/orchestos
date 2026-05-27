import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { ChatMessage, ChatResponse } from './openrouter.ts'

export type { ChatMessage, ChatResponse } from './openrouter.ts'

function loadApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  const envPath = join(homedir(), '.orchestos', '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^ANTHROPIC_API_KEY\s*=\s*(.+)$/)
      if (m?.[1]) return m[1].trim()
    }
  }
  throw new Error('Provider anthropic requires ANTHROPIC_API_KEY in ~/.orchestos/.env')
}

export async function chat(opts: {
  model: string
  system: string
  messages: ChatMessage[]
}): Promise<ChatResponse> {
  const apiKey = loadApiKey()
  const model = normalizeModel(opts.model)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: opts.system,
      messages: opts.messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content })),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic error ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    content: Array<{ type: string; text?: string }>
    usage?: { input_tokens?: number; output_tokens?: number }
    model?: string
  }

  return {
    text: data.content.map(part => part.text ?? '').join(''),
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    model: data.model ?? model,
  }
}

function normalizeModel(model: string): string {
  return model.startsWith('anthropic/') ? model.slice('anthropic/'.length) : model
}
