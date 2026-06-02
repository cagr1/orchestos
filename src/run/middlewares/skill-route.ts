import { loadSkill, getSkillPath } from '../../skills/registry.ts'
import type { MiddlewareFn, RunContext } from '../middleware.ts'

export const skillRoute: MiddlewareFn<RunContext> = async (ctx, next) => {
  const skillId = ctx.task.skill
  if (skillId) {
    try {
      const skill = loadSkill(getSkillPath(skillId))
      ctx.skillInstructions = `\n## SKILL GUIDELINES: ${skill.name}\n${skill.instructions}\n`
    } catch {
      // skill file not found or invalid — leave skillInstructions as empty string
    }
  }
  await next()
}
