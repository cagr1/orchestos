import type { SkillDef } from '../registry.ts'
import { buildSections } from './_shared.ts'

// Output: SKILL.md — Claude Code reads these from ~/.claude/skills/
export function compileClaude(skill: SkillDef, detectedLanguage?: string): string {
  return `---
name: ${skill.name}
description: ${skill.description}
version: ${skill.version}
---

${buildSections(skill, detectedLanguage).join('\n\n')}
`
}
