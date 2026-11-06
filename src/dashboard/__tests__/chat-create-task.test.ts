import { describe, expect, it } from 'bun:test'
import { KNOWN_CLIS } from '../../run/executors/cli-registry.ts'
import { buildClaudeChatArgs } from '../../run/executors/external.ts'
import { buildAutoTaskInstruction } from '../handlers/chat.ts'

describe('create_task en el chat', () => {
  it('la regla es una línea que nombra la herramienta', () => {
    const instruction = buildAutoTaskInstruction({ hasProjectContext: true, mode: 'code' })
    expect(instruction).toStartWith('If files must be created or modified, call `create_task`;')
    expect(instruction).not.toContain('\n')
    expect(instruction).toContain('Automatic checks verify declared outputs')
    expect(instruction).toContain('run applicable task/project checks')
    expect(instruction).toContain(
      'Pass `acceptance_criteria` only for results those checks do not cover',
    )
    expect(instruction).toContain('an LLM reviewer runs when criteria or review gates apply')
    expect(instruction).toContain(
      'To retry, cancel or delete a task, direct the user to its task card',
    )
    expect(instruction).toContain('you have no tool for those actions')
    expect(instruction).toContain('must not claim to have performed them')
  })

  it('manual espera Run y auto espera aprobación solo si el output ya existe', () => {
    const manual = buildAutoTaskInstruction({
      hasProjectContext: true,
      mode: 'code',
      permissionMode: 'manual',
    })
    expect(manual).toContain('wait until the user clicks Run on the task card (Manual permissions)')
    expect(manual).not.toContain('start automatically')
    expect(manual).toContain('Never claim a waiting task is running')
    for (const permissionMode of ['yolo', undefined] as const) {
      const auto = buildAutoTaskInstruction({
        hasProjectContext: true,
        mode: 'code',
        permissionMode,
      })
      expect(auto).toContain('start automatically unless an output file already exists')
      expect(auto).toContain('then they wait for approval on the task card')
      expect(auto).toContain('Never claim a waiting task is running')
      expect(auto).not.toContain('Manual permissions')
    }
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
    const first = buildClaudeChatArgs(...base, undefined, { tools: ['create_task'], root: '/p' })
    const resumed = buildClaudeChatArgs(...base, 'sess-1', { tools: ['create_task'], root: '/p' })
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
