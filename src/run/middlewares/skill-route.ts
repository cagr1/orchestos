import { buildSkillInstructions } from '../../skills/catalog.ts'
import type { MiddlewareFn, RunContext } from '../middleware.ts'

export const skillRoute: MiddlewareFn<RunContext> = async (ctx, next) => {
  const result = buildSkillInstructions(ctx.task, ctx.taskClass, ctx.opts.projectRoot)
  ctx.skillInstructions = result.text
  ctx.phaseSkills = result.phaseSkills
  await next()
}
