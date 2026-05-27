import type { ChatMessage, ChatResponse } from './openrouter.ts'

export async function chat(opts: {
  model: string
  system: string
  messages: ChatMessage[]
}): Promise<ChatResponse> {
  const prompt = [
    opts.system,
    ...opts.messages.map(m => `## ${m.role}\n${m.content}`),
  ].join('\n\n')

  const proc = Bun.spawn(['codex', 'exec', '--json', prompt], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])

  if (exitCode !== 0) {
    throw new Error(`Codex executor failed (${exitCode}): ${stderr || stdout}`)
  }

  return {
    text: extractText(stdout),
    inputTokens: 0,
    outputTokens: 0,
    model: opts.model,
  }
}

function extractText(stdout: string): string {
  const trimmed = stdout.trim()
  if (!trimmed) return ''

  const lines = trimmed.split(/\r?\n/).filter(Boolean)
  for (const line of lines.toReversed()) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>
      const text =
        obj.text ??
        obj.output ??
        obj.result ??
        obj.content ??
        (typeof obj.message === 'object' && obj.message !== null
          ? (obj.message as Record<string, unknown>).content
          : undefined)
      if (typeof text === 'string') return text
    } catch {
      // Keep scanning older lines, then fall back to raw stdout.
    }
  }

  return trimmed
}
