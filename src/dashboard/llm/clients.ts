import { parseJson, z } from '../../boundary/index.ts'

async function ollamaChat(opts: {
  model: string
  signal?: AbortSignal
  system: string
  messages: { role: 'user' | 'assistant'; content: any }[]
}): Promise<{ text: string; model: string }> {
  const body = {
    model: opts.model,
    messages: [{ role: 'system', content: opts.system }, ...opts.messages],
    stream: false,
  }
  const res = await fetch('http://localhost:11434/v1/chat/completions', {
    signal: opts.signal,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ollama',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Ollama error ${res.status}: ${err}`)
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    model?: string
  }
  const text = data.choices?.[0]?.message?.content ?? ''
  return { text, model: `ollama/${opts.model}` }
}

const OLLAMA_TAGS = z.object({
  models: z.array(z.object({ name: z.string() }).passthrough()).optional(),
})

/** First installed Ollama model as `ollama/<name>`, or undefined when Ollama is down or has none. */
async function firstOllamaModel(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 1000,
): Promise<string | undefined> {
  try {
    const res = await fetchImpl('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return undefined
    const parsed = parseJson(OLLAMA_TAGS, await res.text())
    const name = parsed.ok ? parsed.data.models?.find((m) => m.name)?.name : undefined
    return name ? `ollama/${name}` : undefined
  } catch {
    return undefined
  }
}

export { firstOllamaModel, ollamaChat }
