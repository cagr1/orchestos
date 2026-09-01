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

import type { CommandResult, RunCommand } from './agent-governance.ts'
import type { FeatureStatusItem } from './plan-status.ts'
import type { ActiveItemState } from './scope-lock.ts'

export interface HandoffInput {
  branch: string
  uncommitted: string[]
  activeItem: ActiveItemState | null
  openItems: FeatureStatusItem[]
  now: Date
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
