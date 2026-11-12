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
        diff:
          changes.length > 0
            ? changes
                .map(
                  (c) =>
                    `${c.path}\n${typeof c.diff === 'string' && c.diff.trim() ? c.diff : 'Codex did not provide the content of this change.'}`,
                )
                .join('\n')
            : 'Codex did not provide the content of this change.',
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
  const cwd = params.cwd ?? projectRoot
  const withinProject = typeof cwd === 'string' && approvalPathWithin(projectRoot, cwd)
  // Palabra de shell completa: `--file="x"` es UNA palabra; se quitan todas sus comillas.
  const tokens = unwrappedCommand?.match(/(?:"[^"]*"|'[^']*'|[^\s"'])+/g) ?? []
  const pathsWithin = tokens.every((token) => {
    const value = token.replace(/["']/g, '')
    if (value.startsWith('-')) {
      if (value.includes('/') || value.includes('~')) return false
      const eq = value.indexOf('=')
      return eq < 0 || approvalPathWithin(projectRoot, value.slice(eq + 1), cwd)
    }
    // Todo argumento se resuelve con realpath: `cat leak.txt` con leak.txt → symlink hacia fuera pregunta.
    return approvalPathWithin(projectRoot, value, cwd)
  })
  return {
    kind: 'command',
    withinProject,
    detail: { command: params.command ?? undefined, cwd: params.cwd ?? undefined },
    commandKey: codexCommandKey(params.command),
    readOnly:
      Array.isArray(actions) &&
      actions.length > 0 &&
      withinProject &&
      actions.every(
        (action: any) =>
          action &&
          ['read', 'search', 'listFiles'].includes(action.type) &&
          (action.type !== 'read' || (typeof action.path === 'string' && action.path.length > 0)) &&
          (action.path === undefined ||
            (typeof action.path === 'string' && approvalPathWithin(projectRoot, action.path, cwd))),
      ) &&
      pathsWithin &&
      unwrappedCommand !== undefined &&
      // Lista permitida, no de bloqueo: `$`, `\`, `{}`, `[]`, `*?`, `~`, `;|&<>` y no-ASCII expanden o
      // escapan rutas en el shell (\/etc, $HOME, {/etc,x}, leak.tx?); con cualquiera de ellos se pregunta.
      /^[\w\-./ =:,@+"']*$/.test(unwrappedCommand),
  }
}
