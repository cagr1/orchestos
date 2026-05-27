import type { SkillDef } from '../registry.ts'
import { buildSections } from './_shared.ts'

// Output: .mdc — Cursor reads these from .cursor/rules/
export function compileCursor(skill: SkillDef): string {
  return `---
description: ${skill.description}
globs: ["**/*"]
alwaysApply: false
---

${buildSections(skill).join('\n\n')}
`
}
