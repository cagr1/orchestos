import type { SkillDef } from '../registry.ts'
import { buildSections } from './_shared.ts'

// Output: .mdc — Cursor reads these from .cursor/rules/
export function compileCursor(skill: SkillDef, detectedLanguage?: string): string {
  return `---
description: ${skill.description}
globs: ["**/*"]
alwaysApply: false
---

${buildSections(skill, detectedLanguage).join('\n\n')}
`
}
