import { type ApprovalRequest, approvalPathWithin } from '../approvals.ts'

export interface OpencodePermission {
  id: string
  sessionID: string
  action: string
  resources: string[]
  metadata?: Record<string, unknown>
}

/** OpenCode's pattern grants are broader than our exact command grants. */
export function opencodeApprovalRequest(
  input: OpencodePermission,
  projectRoot: string,
): ApprovalRequest {
  const metadata = input.metadata ?? {}
  if (['edit', 'write', 'patch'].includes(input.action)) {
    const entries = Array.isArray(metadata.files) ? metadata.files : []
    const paths = entries
      .map((entry) => entry?.file)
      .filter((file): file is string => typeof file === 'string' && file.trim().length > 0)
    const files = paths.length > 0 ? paths : input.resources
    const patches = entries
      .map((entry) => entry?.patch)
      .filter((patch): patch is string => typeof patch === 'string' && patch.trim().length > 0)
    return {
      kind: 'edit',
      detail: {
        files,
        diff:
          patches.length > 0
            ? patches.join('\n')
            : 'OpenCode did not provide the content of this change.',
      },
      withinProject:
        files.length > 0 && files.every((file) => approvalPathWithin(projectRoot, file)),
    }
  }
  if (['shell', 'bash'].includes(input.action) && input.resources.length === 1) {
    return {
      kind: 'command',
      detail: { command: input.resources[0]!, cwd: projectRoot },
      commandKey: input.resources[0]!,
      readOnly: false,
    }
  }
  return {
    kind: 'command',
    detail: { command: `${input.action} ${input.resources.join(' ')}`, cwd: projectRoot },
    readOnly: false,
  }
}
