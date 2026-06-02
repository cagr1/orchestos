import { suggestContext } from '../../graph/suggest.ts'
import { inferEmbeddingProvider } from '../../providers/embeddings.ts'
import type { MiddlewareFn, RunContext } from '../middleware.ts'

export const memoryFetch: MiddlewareFn<RunContext> = async (ctx, next) => {
  const task = ctx.task
  const projectId = ctx.opts.projectId
  const providerName = ctx.providerName

  if (task.input.length > 0 || !projectId) {
    await next()
    return
  }

  let taskEmbedding: number[] | undefined
  try {
    const ep = inferEmbeddingProvider(providerName)
    const { embeddings } = await ep.embed([task.description])
    taskEmbedding = embeddings[0]
  } catch {
    // no embedding provider configured — keyword-only path
  }

  const results = suggestContext(projectId, task.description, { topN: 5, taskEmbedding })
  const suggested = results.map(r => r.path)

  if (suggested.length > 0) {
    ctx.task = { ...task, input: suggested }
    ctx.embedHits = results.filter(r => r.reason === 'embedding').length
    ctx.opts.logger.inputAutoSuggested(suggested)
  }

  await next()
}
