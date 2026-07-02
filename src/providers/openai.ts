import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { ChatMessage, ChatResponse } from './openrouter.ts'

function loadApiKey(): string {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  const envPath = join(homedir(), '.orchestos', '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^OPENAI_API_KEY\s*=\s*(.+)$/)
      if (m?.[1]) return m[1].trim()
    }
  }
  throw new Error('Provider openai requires OPENAI_API_KEY in ~/.orchestos/.env')
}

export async function chat(opts: {
  model: string
  system: string
  messages: ChatMessage[]
  maxTokens?: number
}): Promise<ChatResponse> {
  const apiKey = loadApiKey()
  const model = normalizeModel(opts.model)

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 8192,
      messages: [
        { role: 'system', content: opts.system },
        ...opts.messages,
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
    model?: string
  }

  return {
    text: data.choices[0]?.message?.content ?? '',
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    model: data.model ?? model,
  }
}

function normalizeModel(model: string): string {
  return model.startsWith('openai/') ? model.slice('openai/'.length) : model
}
