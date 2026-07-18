#!/usr/bin/env bun
// Mes 22/F.2 — gate de pre-commit: si el commit toca un archivo listado en
// .claude/protected-rules.json (código que ya regresionó una regla marcada
// "no reabrir"), exige una entrada nueva en LEDGER.md en el mismo commit.
// Gobernanza de este repo, no código de OrchestOS-el-producto — nunca importado
// desde src/.

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

type ProtectedRule = { pattern: string; rule: string; note: string }

function sh(cmd: string): string {
  return Bun.spawnSync(['bash', '-c', cmd]).stdout.toString().trim()
}

const root = sh('git rev-parse --show-toplevel')
const registryPath = resolve(root, '.claude/protected-rules.json')

if (!existsSync(registryPath)) {
  // Sin registro, no hay nada que exigir — no bloquea commits.
  process.exit(0)
}

const registry: ProtectedRule[] = JSON.parse(readFileSync(registryPath, 'utf8'))
const stagedFiles = sh('git diff --cached --name-only').split('\n').filter(Boolean)

const touched = registry.filter((r) => stagedFiles.includes(r.pattern))
if (touched.length === 0) {
  process.exit(0)
}

const ledgerStaged = stagedFiles.includes('LEDGER.md')
const ledgerDiff = ledgerStaged ? sh('git diff --cached LEDGER.md') : ''
const hasNewEntry = /^\+## \d{4}-\d{2}-\d{2}/m.test(ledgerDiff)

if (ledgerStaged && hasNewEntry) {
  process.exit(0)
}

console.error('✗ pre-commit (Mes 22/F.2): este commit toca código protegido sin una entrada')
console.error('  nueva en LEDGER.md:\n')
for (const r of touched) {
  console.error(`  - ${r.pattern}  (${r.rule})`)
  console.error(`    ${r.note}\n`)
}
console.error('  Agrega una entrada en LEDGER.md (fecha/hora real, modelo, clasificación')
console.error('  RESPETÓ / DESVIÓ-CON-RAZÓN / OVERRIDE-PEDIDO-POR-CARLOS / REGRESIÓN, y el')
console.error('  porqué si no es RESPETÓ) y agrégala al commit antes de continuar.')
console.error('  Formato completo: PLAN.md § Mes 22 Bloque F, F.1.')
process.exit(1)
