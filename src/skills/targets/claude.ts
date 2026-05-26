import type { SkillDef } from '../registry.ts'

// Output: SKILL.md — Claude Code reads these from ~/.claude/skills/
export function compileClaude(skill: SkillDef): string {
  return `---
name: ${skill.name}
description: ${skill.description}
version: ${skill.version}
---

${skill.instructions}
`
}
