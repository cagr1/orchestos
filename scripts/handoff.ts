/**
 * scripts/handoff.ts
 *
 * H.4.2 (PLAN.md § Bloque H) — clock-out mecánico. Precedente investigado
 * antes de diseñar: `mattpocock/skills` (`productivity/handoff`,
 * `in-progress/claude-handoff`) — el principio robado, citado textual:
 * "Do not duplicate content already captured in other artifacts (specs,
 * plans, ADRs, issues, commits, diffs). Reference them by path or URL
 * instead." PLAN.md/LEDGER.md/commits ya son la fuente durable; este
 * documento es SOLO el estado en vuelo que todavía no llegó ahí.
 *
 * Diferencia deliberada con mattpocock (adaptación, no copia ciega): su
 * skill guarda en el temp del SO porque asume un solo usuario en Claude
 * Code. OrchestOS admite Claude/Codex/DeepSeek/OpenCode trabajando el
 * mismo repo (a veces en paralelo, ver feedback-codex-sesiones-paralelas-
 * no-preguntar) — el handoff tiene que vivir DENTRO del working directory
 * (`.orchestos/handoff.md`, gitignored) para que cualquier próxima sesión,
 * de cualquier CLI, lo encuentre sin configuración extra.
 */

import { readFileSync } from 'node:fs'
import type { CommandResult, RunCommand } from './agent-governance.ts'
import type { FeatureStatusItem } from './plan-status.ts'
import type { ActiveItemState } from './scope-lock.ts'

export interface HandoffInput {
  branch: string
  uncommitted: string[]
  activeItem: ActiveItemState | null
  openItems: FeatureStatusItem[]
  recentUserMessages?: string[]
  now: Date
}

const RECENT_USER_MESSAGES = 5
const MAX_USER_MESSAGE_CHARS = 400

/**
 * Recupera intención que no vive en ningún artefacto durable. Solo conserva
 * prompts del usuario: respuestas del asistente volverían a cargar justo el
 * contexto que el handoff busca evitar.
 */
export function readRecentUserMessages(transcriptPath: string): string[] {
  try {
    const messages: string[] = []
    for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
      if (line.trim() === '') continue
      try {
        const message = transcriptUserMessage(JSON.parse(line) as unknown)
        if (message) messages.push(message)
      } catch {
        // Claude puede dejar el último JSON truncado mientras escribe el transcript.
      }
    }
    return messages.slice(-RECENT_USER_MESSAGES)
  } catch {
    return []
  }
}

function transcriptUserMessage(value: unknown): string | null {
  if (!isRecord(value) || value.type !== 'user' || !isRecord(value.message)) return null
  if (value.message.role !== 'user') return null

  const content = value.message.content
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .filter(isRecord)
            .filter((block) => block.type === 'text' && typeof block.text === 'string')
            .map((block) => block.text as string)
            .join(' ')
        : ''

  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized === '') return null
  return normalized.length <= MAX_USER_MESSAGE_CHARS
    ? normalized
    : `${normalized.slice(0, MAX_USER_MESSAGE_CHARS - 1)}…`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function gitBranch(runCommand: RunCommand, root: string): string {
  const result = runCommand(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], root)
  return result.exitCode === 0 ? result.stdout.trim() : '(desconocida)'
}

export function uncommittedPaths(runCommand: RunCommand, root: string): string[] {
  const result: CommandResult = runCommand(['git', 'status', '--porcelain'], root)
  if (result.exitCode !== 0) return []
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function renderHandoff(input: HandoffInput): string {
  const lines: string[] = []
  lines.push('# Handoff de sesión')
  lines.push('')
  lines.push('Generado por `bun run agent:handoff` — NO es fuente de verdad, es estado en vuelo.')
  lines.push('La fuente durable sigue siendo PLAN.md/LEDGER.md/commits; este archivo solo')
  lines.push('apunta a lo que todavía no llegó ahí. Se sobrescribe en cada corrida.')
  lines.push('')
  lines.push(`Generado: ${input.now.toISOString()}`)
  lines.push(`Branch: ${input.branch}`)
  lines.push('')

  lines.push('## Ítem activo declarado (scope-lock, H.4.1)')
  if (input.activeItem) {
    lines.push(
      `- **${input.activeItem.item}** — scope: \`${input.activeItem.scope.join(', ')}\` (declarado ${input.activeItem.declaredAt})`,
    )
    lines.push('  Sesión cortada con este ítem sin cerrar — retomar desde acá.')
  } else {
    lines.push('_(ninguno — no hay scope declarado activo)_')
  }
  lines.push('')

  lines.push('## Cambios sin commitear')
  if (input.uncommitted.length > 0) {
    for (const line of input.uncommitted) lines.push(`- \`${line}\``)
  } else {
    lines.push('_(working tree limpio)_')
  }
  lines.push('')

  lines.push('## De qué veníamos hablando')
  if (input.recentUserMessages && input.recentUserMessages.length > 0) {
    for (const message of input.recentUserMessages) lines.push(`- ${message}`)
  } else {
    lines.push('_(sin transcript de usuario disponible)_')
  }
  lines.push('')

  lines.push('## Próximos ítems abiertos (de .orchestos/feature-status.json, H.3.1)')
  if (input.openItems.length > 0) {
    for (const item of input.openItems.slice(0, 5)) {
      lines.push(`- **${item.id}** ${item.delegation} — ${item.title}`)
    }
    if (input.openItems.length > 5) {
      lines.push(`- (+${input.openItems.length - 5} más — ver PLAN.md)`)
    }
  } else {
    lines.push('_(no hay ítems abiertos)_')
  }
  lines.push('')

  return `${lines.join('\n')}\n`
}
