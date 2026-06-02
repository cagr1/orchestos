/**
 * src/spec/lint.ts — S28 + S32.3 + S32.4
 *
 * lintSpec(spec) — checks acceptance criteria for WHEN/THEN format
 * and validates capabilities contract delta headers.
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
 * Delta header validation (S32.3):
 *   If capabilities.modified/removed/added are non-empty, the body MUST
 *   contain the corresponding ## MODIFIED / ## REMOVED / ## ADDED sections.
 *
 * MODIFIED completeness (S32.4):
 *   ## MODIFIED sections must contain the complete previous requirement
 *   (not fragments). Checks for substantial content (>80 chars).
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
  deltaIssuesCount: number
}

export function lintSpec(spec: Spec): LintResult {
  const body = spec.body
  const caps = spec.frontmatter.capabilities

  const findings: LintFinding[] = []

  // ── WHEN/THEN criteria check ──────────────────────────────────────────────
  const sectionMatch = body.match(/##\s+Criterios de aceptaci[oó]n([\s\S]*?)(?=\n##\s|$)/i)
  let structuredCount = 0

  if (!sectionMatch) {
    // no criteria section found – still check delta headers below
  } else {
    const sectionBody = sectionMatch[1] ?? ''
    const bullets = extractBullets(sectionBody)

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
  }

  // ── S32.3: Delta header check ────────────────────────────────────────────
  let deltaIssuesCount = 0

  if (caps) {
    const bodyUpper = body.toUpperCase()

    if (caps.added.length > 0 && !bodyUpper.includes('## ADDED')) {
      findings.push({
        criterion: `Missing ## ADDED section (capabilities.added: ${caps.added.join(', ')})`,
        suggestion: 'Add an ## ADDED section describing the new capabilities',
      })
      deltaIssuesCount++
    }

    if (caps.modified.length > 0 && !bodyUpper.includes('## MODIFIED')) {
      findings.push({
        criterion: `Missing ## MODIFIED section (capabilities.modified: ${caps.modified.join(', ')})`,
        suggestion: 'Add a ## MODIFIED section with the complete previous requirement for each modified capability',
      })
      deltaIssuesCount++
    }

    if (caps.removed.length > 0 && !bodyUpper.includes('## REMOVED')) {
      findings.push({
        criterion: `Missing ## REMOVED section (capabilities.removed: ${caps.removed.join(', ')})`,
        suggestion: 'Add a ## REMOVED section documenting the removed capabilities',
      })
      deltaIssuesCount++
    }
  }

  // ── S32.4: MODIFIED completeness check ──────────────────────────────────
  const modifiedSection = body.match(/##\s+MODIFIED([\s\S]*?)(?=\n##\s|$)/i)
  if (modifiedSection) {
    const content = modifiedSection[1]?.trim() ?? ''
    if (content.length < 80) {
      findings.push({
        criterion: `## MODIFIED section content is too short (${content.length} chars) — likely a fragment`,
        suggestion: 'Replace the fragment with the complete previous requirement (full spec body for each modified capability)',
      })
      deltaIssuesCount++
    } else if (!content.includes('\n')) {
      findings.push({
        criterion: '## MODIFIED section is a single line — expected a complete requirement block',
        suggestion: 'Expand the ## MODIFIED section with the full previous spec body for each modified capability',
      })
      deltaIssuesCount++
    }
  }

  // freeFormCount only counts criteria-format findings (non delta)
  const criteriaFindings = findings.slice(0, findings.length - deltaIssuesCount)

  return {
    findings,
    structuredCount,
    freeFormCount: criteriaFindings.length,
    deltaIssuesCount,
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
