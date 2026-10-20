import type { ApprovalRequest } from '../approvals.ts'
import { approvalPathWithin } from '../approvals.ts'

/** Codex 0.163.0: generated ServerRequest/CommandAction + real stdio probe, 2026-10-20.
 * requestApproval uses accept/decline; file changes arrive in item/started before the request.
 * Only read/search/listFiles are schema-declared read classifications (unknown fails closed).
 */
function unwrapCodexShellCommand(command: unknown): string | undefined {
  if (typeof command !== 'string' || !command.trim()) return undefined
  const wrapper = /^(?:\/(?:[^\s/]+\/)*|)(?:zsh|bash|sh) -(?:lc|c) '((?:[^']|'\\'')*)'$/.exec(
    command,
  )
  if (wrapper) return wrapper[1]!.replaceAll("'\\''", "'").trim() || undefined
  return undefined
}

export function codexCommandKey(command: unknown): string | undefined {
  if (typeof command !== 'string' || !command.trim()) return undefined
  return unwrapCodexShellCommand(command) ?? command.trim()
}

export function codexApprovalRequest(
  method: string,
  params: any,
  item: any,
  projectRoot: string,
): ApprovalRequest {
  if (method === 'item/fileChange/requestApproval') {
    const changes: any[] = Array.isArray(item?.changes) ? item.changes : []
    const files = changes.flatMap((change) =>
      [change.path, change.kind?.move_path].filter((p) => typeof p === 'string'),
    )
    return {
      kind: 'edit',
      detail: {
        cwd: projectRoot,
        files,
        diff: changes.map((c) => `${c.path}\n${c.diff ?? ''}`).join('\n'),
      },
      withinProject:
        changes.length > 0 &&
        changes.every((change) => typeof change.path === 'string' && change.path.length > 0) &&
        files.length > 0 &&
        files.every((path) => approvalPathWithin(projectRoot, path)),
    }
  }
  const actions = params.commandActions
  const unwrappedCommand = unwrapCodexShellCommand(params.command)
  return {
    kind: 'command',
    detail: { command: params.command ?? undefined, cwd: params.cwd ?? undefined },
    commandKey: codexCommandKey(params.command),
    readOnly:
      Array.isArray(actions) &&
      actions.length > 0 &&
      actions.every((action: any) => ['read', 'search', 'listFiles'].includes(action.type)) &&
      unwrappedCommand !== undefined &&
      !/[;&|><`]|\$\(|\n/.test(unwrappedCommand),
  }
}
