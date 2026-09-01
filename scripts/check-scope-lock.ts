/**
 * scripts/check-scope-lock.ts
 *
 * H.4.1 — corre en pre-commit. Si `.orchestos/active-item.json` no existe,
 * no hay scope declarado para esta sesión: no-op (mecaniza la disciplina
 * solo para quien la usa, no fuerza retrofits). Si existe, compara los
 * paths staged contra el glob declarado; si algo queda fuera, exige que el
 * mismo commit lo justifique en PLAN.md con una línea "Fuera de scope
 * declarado:". Al cerrar el ítem declarado (`[x]` visible en el diff de
 * PLAN.md), limpia el archivo de estado — es session state, no fuente de
 * verdad, y no tiene sentido que sobreviva al ítem que lo declaró.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { runCommand } from './agent-governance.ts'
import type { ActiveItemState } from './scope-lock.ts'
import { hasOutOfScopeJustification, pathsOutsideScope, planClosesItem } from './scope-lock.ts'

const ACTIVE_ITEM_PATH = '.orchestos/active-item.json'

export function main(root = process.cwd()): number {
  const statePath = resolve(root, ACTIVE_ITEM_PATH)
  if (!existsSync(statePath)) {
    console.log('✓ Scope-lock: no hay scope declarado para esta sesión, no aplica')
    return 0
  }

  const state = JSON.parse(readFileSync(statePath, 'utf8')) as ActiveItemState

  const names = runCommand(['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'], root)
  if (names.exitCode !== 0) {
    console.error(names.stderr.trim())
    return 1
  }
  const stagedPaths = names.stdout
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)

  const outside = pathsOutsideScope(stagedPaths, state.scope)

  const planDiff = runCommand(['git', 'diff', '--cached', '--unified=0', '--', 'PLAN.md'], root)
  if (planDiff.exitCode !== 0) {
    console.error(planDiff.stderr.trim())
    return 1
  }

  if (outside.length > 0 && !hasOutOfScopeJustification(planDiff.stdout)) {
    console.error(
      `✗ Scope declarado para ${state.item} (${state.scope.join(', ')}) no cubre estos paths staged:`,
    )
    for (const p of outside) console.error(`  - ${p}`)
    console.error(
      '  Agrega en PLAN.md una línea "**Fuera de scope declarado:** <por qué>" en el mismo commit,',
    )
    console.error(
      '  o ajusta el scope con: bun run agent:preflight -- --item <ID> --scope "<globs>"',
    )
    return 1
  }

  if (planClosesItem(planDiff.stdout, state.item)) {
    rmSync(statePath)
    console.log(`✓ Scope-lock: ${state.item} cerrado — estado de sesión limpiado`)
    return 0
  }

  console.log(
    outside.length > 0
      ? `✓ Scope-lock: ${outside.length} path(s) fuera de scope, justificados en PLAN.md`
      : '✓ Scope-lock: diff dentro del scope declarado',
  )
  return 0
}

if (import.meta.main) process.exit(main())
