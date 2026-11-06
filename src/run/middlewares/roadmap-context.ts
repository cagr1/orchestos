import { loadRoadmapContext } from '../../roadmaps/context.ts'
import type { MiddlewareFn, RunContext } from '../middleware.ts'

export const roadmapContext: MiddlewareFn<RunContext> = async (ctx, next) => {
  const roadmap = await loadRoadmapContext(ctx.effectiveRoot, ctx.task.output)
  ctx.roadmapInstructions = roadmap.markdown
  ctx.roadmapBlockReason = roadmap.blockReason ?? null
  ctx.opts.logger.info(
    `roadmaps: selected=${roadmap.selected.length} missing=${roadmap.missing.length}`,
  )
  await next()
}
