import { loadSkill, getSkillPath } from '../../skills/registry.ts'
import type { MiddlewareFn, RunContext } from '../middleware.ts'

export const toolPolicy: MiddlewareFn<RunContext> = async (ctx, next) => {
  const skillId = ctx.task.skill
  if (skillId) {
    try {
      const skill = loadSkill(getSkillPath(skillId))
      ctx.allowedTools = skill.allowed_tools ?? []
    } catch {
      // skill not found — leave allowedTools as empty array (no restriction)
    }
  }
  await next()
}
