import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { MiddlewareFn, RunContext } from '../middleware.ts'

export const contextInject: MiddlewareFn<RunContext> = async (ctx, next) => {
  const contextMdPath = join(ctx.opts.projectRoot, 'CONTEXT.md')
  const hasContextMd = existsSync(contextMdPath)

  if (hasContextMd) {
    ctx.effectiveContext = readFileSync(contextMdPath, 'utf-8')
    ctx.contextSource = 'CONTEXT.md'
    ctx.contextTokens = Math.round(ctx.effectiveContext.length / 4)
    ctx.opts.logger.info(`context: CONTEXT.md (~${ctx.contextTokens} tokens) — overriding AGENTS.md`)
  }

  await next()
}
