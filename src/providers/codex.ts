import { homedir } from 'node:os'
import { join } from 'node:path'
import { provisionCliConfigHome } from '../run/executors/cli-registry.ts'
import { buildCodexChatEnv } from '../run/executors/codex.ts'
import type { ChatMessage, ChatResponse } from './openrouter.ts'

export async function chat(
  opts: {
    model: string
    system: string
    messages: ChatMessage[]
  },
  ctx: { projectRoot?: string } = {},
): Promise<ChatResponse> {
  const prompt = [opts.system, ...opts.messages.map((m) => `## ${m.role}\n${m.content}`)].join(
    '\n\n',
  )

  // R.8.5.1 — sin CODEX_HOME aislado el CLI hereda el ~/.codex/AGENTS.md del usuario.
  // Sin proyecto, el mismo home general que usa el chat general.
  const configHome = provisionCliConfigHome(
    ctx.projectRoot ?? homedir(),
    'codex',
    homedir(),
    ctx.projectRoot ? undefined : join(homedir(), '.orchestos', 'general-chat'),
  )
  const proc = Bun.spawn(['codex', 'exec', '--json', prompt], {
    env: buildCodexChatEnv(configHome.path),
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
