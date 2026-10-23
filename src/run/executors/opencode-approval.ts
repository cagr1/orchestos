import { type ApprovalRequest, approvalPathWithin } from '../approvals.ts'

export interface OpencodePermission {
  id: string
  sessionID: string
  permission: string
  patterns: string[]
  metadata: Record<string, unknown>
}

/** OpenCode's pattern grants are broader than our exact command grants. */
export function opencodeApprovalRequest(
  input: OpencodePermission,
  projectRoot: string,
): ApprovalRequest {
  const metadata = input.metadata ?? {}
  if (['edit', 'write', 'patch'].includes(input.permission)) {
    const files =
      typeof metadata.filepath === 'string' && metadata.filepath ? [metadata.filepath] : []
    return {
      kind: 'edit',
      detail: {
        files,
        diff:
          typeof metadata.diff === 'string' && metadata.diff.trim()
            ? metadata.diff
            : 'OpenCode did not provide the content of this change.',
      },
      withinProject:
        files.length > 0 && files.every((file) => approvalPathWithin(projectRoot, file)),
    }
  }
  if (input.permission === 'bash' && typeof metadata.command === 'string') {
    return {
      kind: 'command',
      detail: { command: metadata.command, cwd: projectRoot },
      commandKey: metadata.command,
      readOnly: false,
    }
  }
  return {
    kind: 'command',
    detail: { command: `${input.permission} ${input.patterns.join(' ')}`, cwd: projectRoot },
    readOnly: false,
  }
}
