import type { SkillDef } from '../registry.ts'

export function buildSections(skill: SkillDef, detectedLanguage?: string): string[] {
  const sections: string[] = []

  if (skill.iron_law) {
    sections.push('## Iron law')
    sections.push(skill.iron_law)
  }

  sections.push(skill.instructions)

  if (skill.when_to_use?.length) {
    sections.push('## When to use')
    sections.push(...skill.when_to_use.map(w => `- ${w}`))
  }

  if (skill.inputs_required?.length) {
    sections.push('## Inputs required')
    sections.push(...skill.inputs_required.map(i => `- ${i}`))
  }

  if (skill.anti_patterns?.length) {
    sections.push('## Anti-patterns')
    sections.push(...skill.anti_patterns.map(a => `- ${a}`))
  }

  if (skill.common_rationalizations?.length) {
    sections.push('## Common rationalizations')
    sections.push(...skill.common_rationalizations.map(r => `- Excuse: ${r.excuse} → Refutation: ${r.refutation}`))
  }

  if (skill.red_flags?.length) {
    sections.push('## Red flags')
    sections.push(...skill.red_flags.map(f => `- ${f}`))
  }

  if (skill.verifiers?.length) {
    sections.push('## Verifiers')
    sections.push(...skill.verifiers.map(v => `Run after applying: \`${v}\``))
  }

  if (skill.examples?.length) {
    sections.push('## Examples')
    for (const ex of skill.examples) {
      sections.push(`### ${ex.title}`)
      sections.push(`**Input:** ${ex.input}`)
      sections.push(`**Output:** ${ex.output}`)
    }
  }

  if (skill.language_targets && detectedLanguage) {
    const langTarget = skill.language_targets[detectedLanguage] ?? skill.language_targets.default
    if (langTarget) {
      sections.push('## Language-specific guidance')
      if (langTarget.verifiers?.length) {
        sections.push('### Verifiers')
        sections.push(...langTarget.verifiers.map(v => `Run after applying: \`${v}\``))
      }
      if (langTarget.anti_patterns?.length) {
        sections.push('### Anti-patterns')
        sections.push(...langTarget.anti_patterns.map(a => `- ${a}`))
      }
    }
  }

  return sections
}
