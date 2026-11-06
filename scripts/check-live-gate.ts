import {
  citedEvidenceFiles,
  hasLiveGateEvidence,
  requiresLiveGate,
  runCommand,
} from './agent-governance.ts'
import { closedPlanItemIds, evidenceSectionFromIndex } from './plan-gate.ts'
import { parsePlanItemSources } from './plan-status.ts'

const LIVE_GATE_PHRASE = /Gate en vivo:.*(?:navegador|browser|Playwright)/i

/**
 * S.6a — a closing item whose evidence moved to `docs/done/` (only a link line lands in
 * PLAN.md) has nothing for `hasLiveGateEvidence()` to read in the PLAN.md diff itself: the
 * "Gate en vivo:" phrase and its cited file live in the archived section instead. This mirrors
 * `checkProvenance()`'s own evidenceHref path (`plan-gate.ts`) so both gates agree on where
 * evidence for the same cierre actually lives.
 */
function hasArchivedLiveGateEvidence(
  root: string,
  planDiffText: string,
  stagedPaths: string[],
  stagedBlobPaths: string[],
): boolean {
  const staged = new Set(stagedPaths)
  const blobs = new Set(stagedBlobPaths)
  const closed = closedPlanItemIds(planDiffText)
  if (closed.length === 0) return false
  const stagedPlan = runCommand(['git', 'show', ':PLAN.md'], root)
  if (stagedPlan.exitCode !== 0) return false
  const sources = new Map(parsePlanItemSources(stagedPlan.stdout).map((item) => [item.id, item]))
  return closed.some((id) => {
    const href = sources.get(id)?.evidenceHref
    if (!href) return false
    let section: string
    try {
      section = evidenceSectionFromIndex(href, root).section
    } catch {
      return false
    }
    if (!LIVE_GATE_PHRASE.test(section)) return false
    return citedEvidenceFiles(
      section
        .split('\n')
        .map((line) => `+${line}`)
        .join('\n'),
    ).some((path) => staged.has(path) && blobs.has(path))
  })
}

export function main(root = process.cwd()): number {
  const names = runCommand(['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'], root)
  if (names.exitCode !== 0) {
    console.error(names.stderr.trim())
    return 1
  }
  const paths = names.stdout
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
  if (!requiresLiveGate(paths)) {
    console.log('✓ Gate en vivo: no aplica al diff staged')
    return 0
  }

  const planDiff = runCommand(['git', 'diff', '--cached', '--unified=0', '--', 'PLAN.md'], root)
  if (planDiff.exitCode !== 0) {
    console.error(planDiff.stderr.trim())
    return 1
  }
  const stagedBlobPaths = paths.filter(
    (path) =>
      runCommand(['git', 'cat-file', '-e', `:${path}`], root).exitCode === 0 &&
      runCommand(['git', 'cat-file', '-t', `:${path}`], root).stdout.trim() === 'blob',
  )
  const inline = hasLiveGateEvidence(planDiff.stdout, paths, stagedBlobPaths)
  const archived =
    !inline && hasArchivedLiveGateEvidence(root, planDiff.stdout, paths, stagedBlobPaths)
  if (!inline && !archived) {
    console.error('✗ Cambio de dashboard/config sin cierre y evidencia en PLAN.md.')
    console.error(
      '  El mismo commit debe añadir [x] y una línea "Gate en vivo:" que cite navegador, browser o',
    )
    console.error(
      '  Playwright, Y citar entre backticks un archivo de evidencia (`ruta.ts`/`.json`/`.log`)',
    )
    console.error(
      '  que exista como blob staged dentro del MISMO ítem cerrado — no basta con la frase (H.10.1).',
    )
    console.error(
      '  Si la evidencia vive en docs/done/ (enlace → [evidencia](...)), esa sección debe traer',
    )
    console.error('  la misma frase y cita, resuelta desde el índice, no desde el disco.')
    return 1
  }
  console.log('✓ Gate en vivo documentado para dashboard/config')
  return 0
}

if (import.meta.main) process.exit(main())
