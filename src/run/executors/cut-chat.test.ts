import { expect, test } from 'bun:test'
import { buildCodexChatArgs } from './codex'
import { buildClaudeChatArgs, CLAUDE_CHAT_BOUNDARY_FLAGS } from './external'

test('Claude cut permits only the specified git commands and NEXT.md edits', () => {
  const args = (cut?: boolean) =>
    buildClaudeChatArgs(
      'system',
      'sonnet',
      'medium',
      '/settings',
      '/project',
      undefined,
      'session',
      undefined,
      false,
      cut,
    )
  expect(args()).toEqual(args(false))
  expect(args()).not.toContain('--allowedTools')
  expect(args()[args().indexOf('--tools') + 1]).toBe('Read,Glob,Grep')
  const cut = args(true)
  expect(cut[cut.indexOf('--tools') + 1]).toBe('Read,Glob,Grep,Edit,Write,Bash')
  expect(cut[cut.indexOf('--allowedTools') + 1]!.split(',')).toEqual([
    'Bash(git status:*)',
    'Bash(git diff:*)',
    'Bash(git log:*)',
    'Bash(git rev-parse:*)',
    'Bash(git add:*)',
    'Bash(git commit:*)',
    'Bash(git push:*)',
    'Edit(NEXT.md)',
    'Write(NEXT.md)',
  ])
  for (const flag of CLAUDE_CHAT_BOUNDARY_FLAGS) expect(cut).toContain(flag)
  expect(cut).not.toContain('--dangerously-skip-permissions')
  expect(cut).not.toContain('--permission-mode')
  expect(cut).toContain('--resume')
})

test('Codex cut exec uses workspace-write and network while ordinary chat stays read-only', () => {
  const args = (cut?: boolean) =>
    buildCodexChatArgs('prompt', 'gpt', 'medium', ['/image.png'], undefined, cut)
  expect(args()).toEqual(args(false))
  const normal = args()
  expect(normal[normal.indexOf('--sandbox') + 1]).toBe('read-only')
  expect(normal).not.toContain('sandbox_workspace_write.network_access=true')
  const cut = args(true)
  expect(cut[cut.indexOf('--sandbox') + 1]).toBe('workspace-write')
  expect(cut).toContain('sandbox_workspace_write.network_access=true')
  expect(cut).toContain('/image.png')
  expect(cut).not.toContain('danger-full-access')
})
