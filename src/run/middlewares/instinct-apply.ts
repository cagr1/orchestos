/**
 * src/run/middlewares/instinct-apply.ts — S33.7
 *
 * Injects applicable instincts into the run context.
 * Queries instincts with confidence >= APPLY_THRESHOLD and verified: true,
 * then sets ctx.instinctBlock with their action text.
 */

import { realpathSync } from 'node:fs'
import { getProject } from '../../db/projects.ts'
import { listApplicable } from '../../instincts/store.ts'
import type { MiddlewareFn, RunContext } from '../middleware.ts'

export const instinctApply: MiddlewareFn<RunContext> = async (ctx, next) => {
  let projectId: string | null = null
  try {
    projectId = getProject(realpathSync(ctx.effectiveRoot))?.id ?? null
  } catch {}
  const applicable = listApplicable(projectId)
  if (applicable.length > 0) {
    ctx.instinctBlock = '\n## INSTINCTS\n' + applicable.map((i) => `- ${i.action}`).join('\n')
  }
  await next()
}
