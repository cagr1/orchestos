// STUB — implement when OpenAI key is available
import type { ChatMessage, ChatResponse } from './anthropic.ts'

export async function chat(_opts: {
  model: string
  system: string
  messages: ChatMessage[]
}): Promise<ChatResponse> {
  throw new Error('OpenAI provider not yet implemented. Use Anthropic for now.')
}
