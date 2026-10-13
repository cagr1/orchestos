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
    // La raíz real del proyecto, no effectiveRoot: con sandbox este es un worktree
    // (<proyecto>/.orchestos/worktrees/<id>) que no es un proyecto registrado.
    projectId = getProject(realpathSync(ctx.opts.projectRoot))?.id ?? null
  } catch {}
  const applicable = listApplicable(projectId)
  if (applicable.length > 0) {
    ctx.instinctBlock = '\n## INSTINCTS\n' + applicable.map((i) => `- ${i.action}`).join('\n')
  }
  await next()
}
