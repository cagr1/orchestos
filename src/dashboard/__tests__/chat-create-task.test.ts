import { describe, expect, it } from 'bun:test'
import { KNOWN_CLIS } from '../../run/executors/cli-registry.ts'
import { buildClaudeChatArgs } from '../../run/executors/external.ts'
import { buildAutoTaskInstruction } from '../handlers/chat.ts'

describe('create_task en el chat', () => {
  it('la regla es una línea que nombra la herramienta', () => {
    const instruction = buildAutoTaskInstruction({ hasProjectContext: true, mode: 'code' })
    expect(instruction).toBe(
      'If files must be created or modified, call `create_task`; answer everything else yourself.',
    )
  })

  it('sin proyecto, en modo chat o sin herramienta no se pide llamarla', () => {
    for (const instruction of [
      buildAutoTaskInstruction({ hasProjectContext: false, mode: 'code' }),
      buildAutoTaskInstruction({ hasProjectContext: true, mode: 'chat' }),
      buildAutoTaskInstruction({ hasProjectContext: true, mode: 'code', taskToolOffered: false }),
    ])
      expect(instruction).not.toContain('create_task')
  })

  it('claude recibe --mcp-config en cada invocación, también con --resume, y solo si se ofrece', () => {
    const base = ['prompt', undefined, undefined, '<settings>', '/p', undefined] as const
    const first = buildClaudeChatArgs(...base, undefined, true)
    const resumed = buildClaudeChatArgs(...base, 'sess-1', true)
    expect(first).toContain('--mcp-config')
    expect(resumed).toContain('--mcp-config')
    expect(resumed).toContain('--resume')
    expect(resumed).toContain('--strict-mcp-config')
    expect(resumed).toContain('--restricted')
    expect(buildClaudeChatArgs(...base, 'sess-1')).not.toContain('--mcp-config')
  })

  it('el registro declara el adaptador MCP de cada CLI', () => {
    const kinds = Object.fromEntries(KNOWN_CLIS.map((cli) => [cli.id, cli.mcp.kind]))
    expect(kinds.claude).toBe('claude-mcp-config')
    expect(kinds.codex).toBe('codex-thread-config')
    expect(kinds.opencode).toBe('none')
  })
})
