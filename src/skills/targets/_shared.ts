import type { SkillDef } from '../registry.ts'

export function buildSections(skill: SkillDef): string[] {
  const sections: string[] = [skill.instructions]

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

  return sections
}
