/**
 * scripts/agent-handoff.ts
 *
 * H.4.2 — CLI de clock-out. Se corre a mano (o por instrucción del
 * protocolo) al terminar una sesión de trabajo con ítems sin cerrar.
 * Escribe `.orchestos/handoff.md` (gitignored, se sobrescribe cada vez).
 * No es un gate: nada bloquea si no se corre, porque no existe un evento
 * "fin de sesión" universal entre Claude/Codex/DeepSeek/OpenCode para
 * engancharlo mecánicamente — ver PLAN.md § H.4.2 para la investigación
 * de precedente que llevó a esta decisión.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { runCommand } from './agent-governance.ts'
import { gitBranch, renderHandoff, uncommittedPaths } from './handoff.ts'
import type { FeatureStatusItem } from './plan-status.ts'
import type { ActiveItemState } from './scope-lock.ts'

const ACTIVE_ITEM_PATH = '.orchestos/active-item.json'
const FEATURE_STATUS_PATH = '.orchestos/feature-status.json'
const HANDOFF_PATH = '.orchestos/handoff.md'

export function main(root = process.cwd()): number {
  const activeItemPath = resolve(root, ACTIVE_ITEM_PATH)
  const activeItem: ActiveItemState | null = existsSync(activeItemPath)
    ? (JSON.parse(readFileSync(activeItemPath, 'utf8')) as ActiveItemState)
    : null

  const featureStatusPath = resolve(root, FEATURE_STATUS_PATH)
  const openItems: FeatureStatusItem[] = existsSync(featureStatusPath)
    ? (JSON.parse(readFileSync(featureStatusPath, 'utf8')).items as FeatureStatusItem[]).filter(
        (i) => i.status === 'open',
      )
    : []

  const doc = renderHandoff({
    branch: gitBranch(runCommand, root),
    uncommitted: uncommittedPaths(runCommand, root),
    activeItem,
    openItems,
    now: new Date(),
  })

  const outPath = resolve(root, HANDOFF_PATH)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, doc)
  return 0
}

if (import.meta.main) {
  const code = main()
  if (code === 0) console.log(`✓ ${HANDOFF_PATH} generado`)
  process.exit(code)
}
