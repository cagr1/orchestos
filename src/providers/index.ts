import * as openrouter from './openrouter.ts'
import * as anthropic from './anthropic.ts'
import * as openai from './openai.ts'
import * as codex from './codex.ts'
import type { ChatMessage, ChatResponse } from './openrouter.ts'

export interface ChatOpts {
  model: string
  system: string
  messages: ChatMessage[]
}

export interface ProviderClient {
  name: string
  chat(opts: ChatOpts): Promise<ChatResponse>
}

export function getProvider(name: string): ProviderClient {
  switch (name) {
    case 'openrouter':
      return { name: 'openrouter', chat: openrouter.chat }
    case 'anthropic':
      return { name: 'anthropic', chat: anthropic.chat }
    case 'openai':
      return { name: 'openai', chat: openai.chat }
    case 'codex':
      return { name: 'codex', chat: codex.chat }
    default:
      throw new Error(`unknown provider '${name}' — allowed: openrouter, anthropic, openai, codex`)
  }
}

export type { ChatMessage, ChatResponse }
