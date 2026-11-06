import { upsertMemory } from './memory.ts'

export interface RecordTaskMemoryInput {
  projectId?: string | null
  taskId: string
  description: string
  outcome: 'done' | 'failed_permanent'
  files: string[]
  qaVerdict: 'pass' | 'fail' | 'skipped' | null
  qaReason?: string
  provider?: string
  model?: string
  attempts: number
}

function firstLine(value: string, maxLength: number): string {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)
      ?.slice(0, maxLength) ?? ''
  )
}

export function recordTaskMemory(input: RecordTaskMemoryInput): void {
  if (!input.projectId) return

  try {
    const lines = [`Task ${input.taskId} — ${input.outcome === 'done' ? 'done' : 'failed'}`]
    const description = firstLine(input.description, 200)
    if (description) lines.push(description)
    lines.push(`Files: ${input.files.length > 0 ? input.files.join(', ') : 'none'}`)
    if (input.qaVerdict === 'pass') {
      const reason = firstLine(input.qaReason ?? '', 200)
      lines.push(`QA: pass${reason ? ` — ${reason}` : ''}`)
    } else if (input.qaVerdict === 'fail') {
      const reason = firstLine(input.qaReason ?? '', 200)
      lines.push(`QA: fail${reason ? ` — ${reason}` : ''}`)
    } else {
      lines.push('QA: not run')
    }
    if (input.provider && input.model) {
      lines.push(`Model: ${input.provider}/${input.model} · attempts ${input.attempts}`)
    } else {
      lines.push(`Attempts ${input.attempts}`)
    }

    upsertMemory(input.projectId, `task/${input.taskId}`, lines.join('\n'), 'project')
  } catch (error) {
    console.error(`[task-memory] Could not record task ${input.taskId}:`, error)
  }
}
