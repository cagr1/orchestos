/**
 * AT.19.1 — decide si el turno de Claude retoma la sesión del CLI (`--resume`) o
 * reenvía la transcripción. Con `--resume` el `--append-system-prompt` nuevo no se
 * aplica, así que si el contexto cambió se manda como `<orchestos-context-update>`.
 */
export interface ClaudeResumeDecision {
  resume: string | null
  includeTranscript: boolean
  contextUpdate: boolean
}

export function decideClaudeResume(input: {
  hasSession: boolean
  hasProjectContext: boolean
  stored: { sessionId: string | null; contextHash: string | null; messageCount: number | null }
  historyLength: number
  contextHash: string
}): ClaudeResumeDecision {
  const { stored } = input
  if (
    !input.hasSession ||
    !input.hasProjectContext ||
    !stored.sessionId ||
    stored.messageCount !== input.historyLength
  ) {
    return { resume: null, includeTranscript: true, contextUpdate: false }
  }
  return {
    resume: stored.sessionId,
    includeTranscript: false,
    contextUpdate: stored.contextHash !== input.contextHash,
  }
}
