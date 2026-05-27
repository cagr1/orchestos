/**
 * src/spec/validate.ts
 *
 * Validates a Spec before it can be approved.
 * Rules:
 *   - The ## Criterios de aceptación section must exist and have at least one
 *     real criterion (not the placeholder "<criterio 1>").
 */

import type { Spec } from './store.ts'

export function validateSpec(spec: Spec): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const body = spec.body

  // Find the acceptance-criteria section
  const sectionMatch = body.match(/##\s+Criterios de aceptaci[oó]n([\s\S]*?)(?=\n##\s|$)/i)
  if (!sectionMatch) {
    errors.push('Missing "## Criterios de aceptación" section')
    return { valid: false, errors }
  }

  const sectionBody = sectionMatch[1] ?? ''

  // Collect all bullet items in the section
  const bullets = sectionBody
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('- ') || l.startsWith('* '))
    .map(l => l.slice(2).trim())
    // strip GFM task list prefix: "[ ] " or "[x] "
    .map(b => b.replace(/^\[[ xX]\]\s*/, '').trim())
    .filter(Boolean)

  if (bullets.length === 0) {
    errors.push('Acceptance criteria section is empty — add at least one criterion')
    return { valid: false, errors }
  }

  // Check that there is at least one non-placeholder criterion
  const realCriteria = bullets.filter(b => b !== '<criterio 1>' && b !== '<criterio 2>')
  if (realCriteria.length === 0) {
    errors.push('Acceptance criteria only contain placeholders — replace them with real criteria')
    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}
