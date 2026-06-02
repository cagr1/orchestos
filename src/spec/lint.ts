/**
 * src/spec/lint.ts — S28
 *
 * lintSpec(spec) — checks acceptance criteria for WHEN/THEN format.
 *
 * WHEN/THEN criterion format (OpenSpec-inspired):
 *   WHEN <observable condition> THEN <expected result>
 *   or multi-line:
 *   WHEN [condition]
 *   THEN [result]
 *
 * A criterion is considered structured if it contains both WHEN and THEN
 * as uppercase keywords. Free-form strings like "La función debe retornar X"
 * are flagged as unstructured.
 *
 * lintSpec never throws — it returns a list of findings; empty = all good.
 */

import type { Spec } from './store.ts'

export interface LintFinding {
  criterion: string
  suggestion: string
}

export interface LintResult {
  findings: LintFinding[]
  structuredCount: number
  freeFormCount: number
}

export function lintSpec(spec: Spec): LintResult {
  const body = spec.body

  const sectionMatch = body.match(/##\s+Criterios de aceptaci[oó]n([\s\S]*?)(?=\n##\s|$)/i)
  if (!sectionMatch) {
    return { findings: [], structuredCount: 0, freeFormCount: 0 }
  }

  const sectionBody = sectionMatch[1] ?? ''
  const bullets = extractBullets(sectionBody)

  const findings: LintFinding[] = []
  let structuredCount = 0

  for (const bullet of bullets) {
    if (isWhenThen(bullet)) {
      structuredCount++
    } else {
      findings.push({
        criterion: bullet,
        suggestion: toWhenThenHint(bullet),
      })
    }
  }

  return {
    findings,
    structuredCount,
    freeFormCount: findings.length,
  }
}

function extractBullets(sectionBody: string): string[] {
  return sectionBody
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('- ') || l.startsWith('* '))
    .map(l => l.slice(2).trim())
    .map(b => b.replace(/^\[[ xX]\]\s*/, '').trim())
    .filter(Boolean)
}

function isWhenThen(criterion: string): boolean {
  const upper = criterion.toUpperCase()
  return upper.includes('WHEN') && upper.includes('THEN')
}

function toWhenThenHint(criterion: string): string {
  return `Convert to: WHEN <trigger/condition> THEN <expected observable result> — e.g. "WHEN ${criterion.slice(0, 40)} THEN <result>"`
}
