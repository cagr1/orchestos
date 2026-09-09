/**
 * scripts/plan-status.ts
 *
 * H.3.1 (PLAN.md § Bloque H) — PLAN.md sigue siendo la ÚNICA fuente de verdad
 * (prosa + evidencia). Este módulo la parsea a una forma machine-readable
 * DERIVADA — nunca al revés. `.orchestos/feature-status.json` se regenera
 * siempre desde PLAN.md (scripts/generate-feature-status.ts) y jamás se
 * edita a mano, el mismo contrato que `runs-summary.json`.
 *
 * Discriminador de "esto es un ítem de trabajo": la línea debe tener la forma
 * `**<ID> — <emoji-de-delegación> <título>**`. Las líneas de cierre de mes
 * (`**SÍ — Sprint 27 cerrado...**`, `**PARCIAL — ...**`) no llevan emoji de
 * delegación justo tras el guión largo, así que el regex las excluye solas
 * — no hace falta una lista negra de patrones a mano.
 */

const DELEGATION_EMOJI = ['🧠', '⚡', '🔍'] as const
export type Delegation = (typeof DELEGATION_EMOJI)[number]

export interface FeatureStatusItem {
  id: string
  sprint: string | null
  block: string | null
  delegation: Delegation
  title: string
  status: 'open' | 'done'
  closedDate: string | null
}

export interface PlanItemSource extends FeatureStatusItem {
  body: string
  position: number
  evidenceHref: string | null
}

const ITEM_LINE_RE =
  /^- \[( |x)\] \*\*([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*) — (🧠|⚡|🔍) (.+?)\.?\*\*(?:\s*\(cerrado (\d{4}-\d{2}-\d{2})[^)]*\))?/

export function parsePlanFeatureStatus(plan: string): FeatureStatusItem[] {
  const items: FeatureStatusItem[] = []
  let sprint: string | null = null
  let block: string | null = null

  for (const line of plan.split('\n')) {
    const sprintMatch = line.match(/^## (.+)$/)
    if (sprintMatch?.[1]) {
      sprint = sprintMatch[1].trim()
      block = null
      continue
    }
    const blockMatch = line.match(/^### (.+)$/)
    if (blockMatch?.[1]) {
      block = blockMatch[1].trim()
      continue
    }
    const itemMatch = line.match(ITEM_LINE_RE)
    if (!itemMatch) continue
    const [, checked, id, emoji, title, closedDate] = itemMatch
    if (!checked || !id || !emoji || !title) continue
    items.push({
      id,
      sprint,
      block,
      delegation: emoji as Delegation,
      title: title.trim(),
      status: checked === 'x' ? 'done' : 'open',
      closedDate: closedDate ?? null,
    })
  }
  return items
}

/**
 * Reuses the canonical status parser above, adding only the source text that
 * is not represented in feature-status.json: indented item body and order.
 */
export function parsePlanItemSources(plan: string): PlanItemSource[] {
  const items = parsePlanFeatureStatus(plan)
  const lines = plan.split('\n')
  const sources: PlanItemSource[] = []
  let searchFrom = 0

  for (const item of items) {
    const itemPrefix = `- [${item.status === 'done' ? 'x' : ' '}] **${item.id} — `
    const lineIndex = lines.findIndex(
      (line, index) => index >= searchFrom && line.startsWith(itemPrefix),
    )
    if (lineIndex === -1) throw new Error(`Could not locate source line for plan item ${item.id}`)
    searchFrom = lineIndex + 1

    let end = lines.length
    for (let index = lineIndex + 1; index < lines.length; index += 1) {
      if (lines[index]?.startsWith('## ') || /^- \[[ x]\] \*\*/.test(lines[index] ?? '')) {
        end = index
        break
      }
    }
    const body = lines
      .slice(lineIndex + 1, end)
      .filter((line) => /^\s+/.test(line))
      .join('\n')
      .trim()
    const evidenceHref = lines[lineIndex]?.match(/→ \[evidencia\]\(([^)]+)\)/)?.[1] ?? null
    sources.push({ ...item, body, position: sources.length, evidenceHref })
  }
  return sources
}

export function serializeFeatureStatus(items: FeatureStatusItem[]): string {
  return `${JSON.stringify(
    {
      generatedFrom: 'PLAN.md',
      generatedBy: 'scripts/generate-feature-status.ts',
      note: 'Derivado, no editar a mano — bun run plan:status regenera.',
      items,
    },
    null,
    2,
  )}\n`
}
