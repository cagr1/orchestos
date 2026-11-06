import type { ApprovalDecision } from '../../api/runs'

/** A successful POST stays locked until the next poll removes its request. */
export function createApprovalAnswers(
  post: (id: string, decision: ApprovalDecision) => Promise<void>,
  changed: () => void,
) {
  let pending = new Set<string>()
  const sending = new Set<string>()
  const answered = new Set<string>()
  let error = ''
  return {
    get error() {
      return error
    },
    disabled(id: string) {
      return !pending.has(id) || sending.has(id) || answered.has(id)
    },
    sync(ids: string[]) {
      const next = new Set(ids)
      if (next.size === pending.size && [...next].every((id) => pending.has(id))) return
      pending = next
      for (const id of answered) if (!next.has(id)) answered.delete(id)
      error = ''
      changed()
    },
    async submit(id: string, decision: ApprovalDecision) {
      if (this.disabled(id)) return
      sending.add(id)
      error = ''
      changed()
      try {
        await post(id, decision)
        if (pending.has(id)) answered.add(id)
      } catch (cause) {
        if (pending.has(id)) error = cause instanceof Error ? cause.message : String(cause)
      } finally {
        sending.delete(id)
        changed()
      }
    },
  }
}
