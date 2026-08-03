import { loadSkill, resolveSkillPath } from '../../skills/registry.ts'
import { buildSections } from '../../skills/targets/_shared.ts'
import type { MiddlewareFn, RunContext } from '../middleware.ts'

// N.4.5 (Mes 25, 2026-07-31) — usa buildSections(), el mismo renderer que
// compila las skills para Claude Code/Cursor/OpenAI. Antes este middleware
// duplicaba `skill.instructions` a mano (mismo snippet que prompt.ts) y
// nunca incluía iron_law / common_rationalizations / red_flags (N.1-N.3) —
// el endurecimiento llegaba a herramientas externas pero nunca al ejecutor
// propio de OrchestOS.
export const skillRoute: MiddlewareFn<RunContext> = async (ctx, next) => {
  const skillId = ctx.task.skill
  if (skillId) {
    try {
      const skill = loadSkill(resolveSkillPath(skillId))
      ctx.skillInstructions = `\n## SKILL GUIDELINES: ${skill.name}\n${buildSections(skill).join('\n\n')}\n`
    } catch {
      // skill file not found or invalid — leave skillInstructions as empty string
    }
  }
  await next()
}
