import type { SkillDef } from '../registry.ts'

// Output: .mdc — Cursor reads these from .cursor/rules/
export function compileCursor(skill: SkillDef): string {
  return `---
description: ${skill.description}
globs: ["**/*"]
alwaysApply: false
---

${skill.instructions}
`
}
