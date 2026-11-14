import type { TimelineStep } from '../../api/chat'

export type ToolCategory = 'commands' | 'edits' | 'reads' | 'searches' | 'web' | 'other'
export interface ToolSummary {
  commands: number
  edits: number
  reads: number
  searches: number
  web: number
  other: number
  added: number
  removed: number
  failed: number
  running: number
}
export type ActivitySegment =
  | { kind: 'reasoning'; text: string; durationMs: number }
  | { kind: 'tools'; items: TimelineStep[]; summary: ToolSummary }
  | { kind: 'text'; text: string }

export function toolCategory(tool: string | null): ToolCategory {
  const name = (tool ?? '').toLowerCase()
  if (/^(bash|shell)$|^(exec|command)|(^|__)run(_|$)/.test(name)) return 'commands'
  if (['edit', 'write', 'apply_patch', 'multiedit'].includes(name)) return 'edits'
  if (name === 'read') return 'reads'
  if (name.includes('search') || name === 'grep' || name === 'glob') return 'searches'
  if (name.startsWith('web') || name === 'fetch') return 'web'
  return 'other'
}

export function toolLabel(step: TimelineStep): string {
  if (toolCategory(step.tool) === 'commands' && step.detail) {
    const shell = step.detail.match(/^\/bin\/(?:z|ba)?sh -lc (['"])([\s\S]*)\1$/)
    if (shell) return shell[2] ?? step.detail
    // Sin `boundary`: arrastraría zod y yaml al bundle del navegador (+430 KB).
    try {
      const argv = (JSON.parse(step.detail) as { argv?: unknown }).argv
      if (Array.isArray(argv) && argv.every((part) => typeof part === 'string'))
        return argv.join(' ')
    } catch {
      // `detail` no es JSON: se muestra tal cual.
    }
    return step.detail
  }
  return step.target || step.detail || step.tool || 'tool'
}

export function answerText(content: string, steps: TimelineStep[]): string {
  const ordered = [...steps].sort((a, b) => a.seq - b.seq)
  const lastTool = ordered.findLast((step) => step.type === 'tool_use')
  if (!lastTool) return content
  // El contenido concatena los textos en orden: solo se quita un intermedio si encabeza lo que queda.
  let answer = content.trimStart()
  for (const step of ordered) {
    if (step.type === 'text' && step.seq < lastTool.seq) {
      const text = step.detail?.trim()
      const next = answer.charAt(text?.length ?? 0)
      if (text && answer.startsWith(text) && (next === '' || /\s/.test(next)))
        answer = answer.slice(text.length).trimStart()
    }
  }
  return answer.trim()
}

export function buildTurnActivity(
  steps: TimelineStep[],
  opts: { pending: boolean },
): ActivitySegment[] {
  const ordered = [...steps].sort((a, b) => a.seq - b.seq)
  const lastTool = ordered.findLastIndex((step) => step.type === 'tool_use')
  const segments: ActivitySegment[] = []
  let previousType: TimelineStep['type'] | undefined
  for (const [index, step] of ordered.entries()) {
    const previous = segments.at(-1)
    if (step.type === 'reasoning') {
      const text = (step.detail ?? '').replace(/^\*\*(.*?)\*\*$/s, '$1')
      if (previousType === 'reasoning' && previous?.kind === 'reasoning') {
        previous.text = [previous.text, text].filter(Boolean).join('\n\n')
        previous.durationMs += step.durationMs ?? 0
      } else {
        segments.push({ kind: 'reasoning', text, durationMs: step.durationMs ?? 0 })
      }
    } else if (step.type === 'tool_use') {
      const segment =
        previousType === 'tool_use' && previous?.kind === 'tools'
          ? previous
          : {
              kind: 'tools' as const,
              items: [],
              summary: {
                commands: 0,
                edits: 0,
                reads: 0,
                searches: 0,
                web: 0,
                other: 0,
                added: 0,
                removed: 0,
                failed: 0,
                running: 0,
              },
            }
      if (segment !== previous) segments.push(segment)
      segment.items.push(step)
      segment.summary[toolCategory(step.tool)]++
      segment.summary.added += step.added ?? 0
      segment.summary.removed += step.removed ?? 0
      if (step.ok === false || (step.exitCode !== null && step.exitCode !== 0))
        segment.summary.failed++
      if (opts.pending && step.ok === null) segment.summary.running++
    } else if (step.type === 'text' && index < lastTool) {
      segments.push({ kind: 'text', text: step.detail ?? '' })
    }
    // Avisos y fin de paso no parten un grupo de herramientas.
    if (step.type !== 'notice' && step.type !== 'step_finish') previousType = step.type
  }
  return segments
}

export function summarizeTools(summary: ToolSummary): string {
  const categories: Array<[ToolCategory, string, string]> = [
    ['commands', 'ran', 'command'],
    ['edits', 'edited', 'file'],
    ['reads', 'read', 'file'],
    ['searches', 'searched', 'time'],
    ['web', 'fetched', 'page'],
    ['other', 'used', 'tool'],
  ]
  const text = categories
    .flatMap(([category, verb, noun]) => {
      const count = summary[category]
      return count ? [`${verb} ${count} ${noun}${count === 1 ? '' : 's'}`] : []
    })
    .join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
