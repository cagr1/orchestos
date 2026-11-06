import type { ExecutorEngine } from './types.ts'

export function buildCliTaskPrompt(ctx: Parameters<ExecutorEngine['run']>[0]): string {
  return [
    ctx.effectiveContext,
    ctx.skillInstructions,
    ctx.instinctBlock,
    `## OUTPUT CONTRACT`,
    `You may ONLY create or edit these files: ${ctx.task.output.join(', ')}.`,
    `Do not touch any other file in this repository. When you are done, stop — do not run git commands yourself.`,
    ctx.prompt.userContent,
  ]
    .filter(Boolean)
    .join('\n\n')
}
