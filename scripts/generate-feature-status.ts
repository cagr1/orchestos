/**
 * scripts/generate-feature-status.ts
 *
 * H.3.1 — regenera `.orchestos/feature-status.json` desde PLAN.md. Se corre
 * en cada pre-commit (scripts/pre-commit.sh) y queda commiteado junto con
 * PLAN.md, igual que `runs-summary.json` — nunca se edita a mano.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parsePlanFeatureStatus, serializeFeatureStatus } from './plan-status.ts'

export function generateFeatureStatus(root: string): string {
  const plan = readFileSync(join(root, 'PLAN.md'), 'utf-8')
  const items = parsePlanFeatureStatus(plan)
  const outPath = join(root, '.orchestos', 'feature-status.json')
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, serializeFeatureStatus(items))
  return outPath
}

if (import.meta.main) {
  const root = process.cwd()
  if (!existsSync(join(root, 'PLAN.md'))) {
    console.error('No se encontró PLAN.md en', root)
    process.exit(1)
  }
  const outPath = generateFeatureStatus(root)
  console.log(`✓ ${outPath} regenerado desde PLAN.md`)
}
