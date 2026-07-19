#!/usr/bin/env bun
// Mes 22/F.3 — reporte agregado bajo demanda del ledger de responsabilidad de LLMs.
// Gobernanza de este repo, no feature de OrchestOS-el-producto — corre cuando Carlos
// quiere ver la tabla, nunca en vivo dentro del dashboard (mismo criterio que F.1/F.2).

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

export interface LedgerEntry {
  when: string
  model: string
  classification: string
}

const CLASSIFICATIONS = ['RESPETÓ', 'DESVIÓ-CON-RAZÓN', 'OVERRIDE-PEDIDO-POR-CARLOS', 'REGRESIÓN'] as const

/** Cada entrada real: `## <fecha/hora> — <modelo>` seguido de `**Clasificación**: X`.
 * Ignora silenciosamente bloques sin encabezado o sin clasificación (ej. el header
 * introductorio del archivo, que no es una entrada). */
export function parseLedgerEntries(content: string): LedgerEntry[] {
  const entries: LedgerEntry[] = []
  const blocks = content.split(/\n(?=## )/)
  for (const block of blocks) {
    const heading = block.match(/^## (.+?) — (.+)$/m)
    const classification = block.match(/\*\*Clasificaci[oó]n\*\*:\s*(\S+)/)
    if (!heading?.[1] || !heading[2] || !classification?.[1]) continue
    entries.push({ when: heading[1].trim(), model: heading[2].trim(), classification: classification[1].trim() })
  }
  return entries
}

export function aggregateByModel(entries: LedgerEntry[]): Record<string, Record<string, number>> {
  const table: Record<string, Record<string, number>> = {}
  for (const e of entries) {
    table[e.model] ??= {}
    const modelCounts = table[e.model]!
    modelCounts[e.classification] = (modelCounts[e.classification] ?? 0) + 1
  }
  return table
}

function printReport(entries: LedgerEntry[]): void {
  if (entries.length === 0) {
    console.log('LEDGER.md no tiene entradas todavía — nada que agregar.')
    console.log('(esperado hasta que el gate de pre-commit dispare la primera vez, Mes 22/F.2)')
    return
  }
  const table = aggregateByModel(entries)
  console.log(`${entries.length} entrada(s) en LEDGER.md, por modelo:\n`)
  const modelWidth = Math.max(...Object.keys(table).map(m => m.length), 5)
  const header = ['MODEL'.padEnd(modelWidth), ...CLASSIFICATIONS.map(c => c.padEnd(12))].join('  ')
  console.log(header)
  for (const [model, counts] of Object.entries(table)) {
    const row = [
      model.padEnd(modelWidth),
      ...CLASSIFICATIONS.map(c => String(counts[c] ?? 0).padEnd(12)),
    ].join('  ')
    console.log(row)
  }
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..')
  const ledgerPath = resolve(root, 'LEDGER.md')
  if (!existsSync(ledgerPath)) {
    console.log('LEDGER.md no existe todavía.')
  } else {
    printReport(parseLedgerEntries(readFileSync(ledgerPath, 'utf8')))
  }
}
