import type { TimelineTurn } from '../../api/chat'

export function parseDbTime(value: string): number {
  const plain = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/.exec(value)
  return Date.parse(plain ? `${plain[1]}T${plain[2]}Z` : value)
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000))
  if (total < 60) return `${total} s`
  return `${Math.floor(total / 60)} m ${String(total % 60).padStart(2, '0')} s`
}

export function formatDuration(ms: number): string {
  const value = Math.max(0, Number.isFinite(ms) ? ms : 0)
  if (value < 1) return '<1 ms'
  if (value < 1000) return `${Math.round(value)} ms`
  if (value < 60_000) return `${(value / 1000).toFixed(1)} s`
  const total = Math.floor(value / 1000)
  return `${Math.floor(total / 60)} m ${String(total % 60).padStart(2, '0')} s`
}

export function livePhase(turn: TimelineTurn | undefined, hasLiveText: boolean): string {
  const steps = turn ? [...turn.steps].sort((a, b) => a.seq - b.seq) : []
  const waiting = steps.find((step) => step.notice?.kind === 'no-response')
  const responded = steps.some((step) => step.type !== 'notice' && step.seq > (waiting?.seq ?? -1))
  const reportedError = steps.some((step) => step.notice && step.notice.kind !== 'no-response')
  if (waiting?.notice && !responded && !reportedError && !hasLiveText) {
    return `${waiting.notice.message} — ${waiting.notice.detail}`
  }
  const last = steps.filter((step) => step.type !== 'notice').pop()
  if (last?.type === 'tool_use' && last.ok === null) return `Running ${last.tool ?? 'tool'}`
  return hasLiveText ? 'Writing' : 'Thinking'
}

export function thoughtMs(turn: TimelineTurn): number | undefined {
  const steps = [...turn.steps].sort((a, b) => a.seq - b.seq)
  const lastReasoning = steps.filter((step) => step.type === 'reasoning').pop()
  if (!lastReasoning) return undefined
  const next = steps.find((step) => step.seq > lastReasoning.seq)
  const start = parseDbTime(turn.createdAt)
  const end = parseDbTime(next ? next.createdAt : turn.updatedAt)
  const ms = end - start
  if (Number.isNaN(ms) || ms < 0) return undefined
  return ms
}
