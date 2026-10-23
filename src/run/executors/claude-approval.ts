import { type ApprovalRequest, approvalPathWithin } from '../approvals.ts'

export interface ClaudeApprovalInput {
  tool_name: string
  input: Record<string, unknown>
  tool_use_id?: string
}

/** Claude's permission-prompt-tool payload; command identity is the entire original command. */
export function claudeApprovalRequest(
  { tool_name, input }: ClaudeApprovalInput,
  projectRoot: string,
): ApprovalRequest {
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool_name)) {
    const path = input.file_path ?? input.notebook_path
    const files = typeof path === 'string' && path ? [path] : []
    const edits = Array.isArray(input.edits) ? input.edits : [input]
    const diff = edits
      .flatMap((edit) => {
        if (!edit || typeof edit !== 'object') return []
        const lines: string[] = []
        for (const [key, prefix] of [
          ['old_string', '-'],
          ['new_string', '+'],
          ['content', '+'],
        ] as const) {
          if (typeof edit[key] === 'string')
            lines.push(...edit[key].split('\n').map((line: string) => `${prefix}${line}`))
        }
        return lines
      })
      .join('\n')
    return {
      kind: 'edit',
      detail: { files, diff: diff || 'Claude Code did not provide the content of this change.' },
      withinProject:
        files.length > 0 && files.every((file) => approvalPathWithin(projectRoot, file)),
    }
  }
  if (tool_name === 'Bash' && typeof input.command === 'string') {
    return {
      kind: 'command',
      detail: { command: input.command, cwd: projectRoot },
      commandKey: input.command,
      readOnly: false,
    }
  }
  return {
    kind: 'command',
    detail: { command: `${tool_name} ${JSON.stringify(input)}`, cwd: projectRoot },
    readOnly: false,
  }
}
