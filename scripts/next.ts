import { runMigrations } from '../src/db/migrate.ts'
import { type PlanItem, readyItems } from '../src/db/plan-items.ts'

export const MAX_NEXT_ITEMS = 12

/** Render compacto para SessionStart: una consulta a la DB, nunca PLAN.md. */
export function renderNext(items: PlanItem[]): string {
  if (items.length === 0) return 'No hay ítems abiertos con todas sus dependencias cerradas.'

  const visible = items.slice(0, MAX_NEXT_ITEMS)
  const lines = [`Ítems listos para tomar: ${items.length}`]
  for (const item of visible) lines.push(`${item.id} ${item.delegation} — ${item.title}`)
  if (items.length > visible.length) lines.push(`… ${items.length - visible.length} más.`)
  return lines.join('\n')
}

if (import.meta.main) {
  runMigrations()
  process.stdout.write(`${renderNext(readyItems())}\n`)
}
