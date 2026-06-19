async function ollamaChat(opts: {
  model: string
  system: string
  messages: { role: 'user' | 'assistant'; content: any }[]
}): Promise<{ text: string; model: string }> {
  const body = {
    model: opts.model,
    messages: [
      { role: 'system', content: opts.system },
      ...opts.messages,
    ],
    stream: false,
  }
  const res = await fetch('http://localhost:11434/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ollama',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Ollama error ${res.status}: ${err}`)
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[]; model?: string }
  const text = data.choices?.[0]?.message?.content ?? ''
  return { text, model: `ollama/${opts.model}` }
}

export { ollamaChat }
