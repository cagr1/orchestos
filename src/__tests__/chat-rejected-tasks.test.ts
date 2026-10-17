import { describe, expect, it } from 'bun:test'
import { buildChatSystemPrompt, rejectedSessionTasks } from '../chat/chat-context.ts'

const msg = (id: number, task_id: string | null, content = 'x', taskReport?: unknown) => ({
  id,
  task_id,
  content,
  taskReport,
})

describe('rejectedSessionTasks', () => {
  it('marca la tarea borrada sin reporte', () => {
    expect(rejectedSessionTasks([msg(1, 't1', 'Crear a.txt')], [])).toEqual([
      { id: 't1', description: 'Crear a.txt' },
    ])
  })
  it('ignora la tarea que sigue en tasks.yaml', () => {
    expect(rejectedSessionTasks([msg(1, 't1')], ['t1'])).toEqual([])
  })
  it('ignora la tarea con reporte posterior', () => {
    expect(
      rejectedSessionTasks([msg(1, 't1'), msg(2, 't1', 'r', { outcome: 'done' })], []),
    ).toEqual([])
  })
})

describe('buildChatSystemPrompt rejectedTasks', () => {
  const base = { autoTaskInstruction: 'AUTO' }
  it('con rechazadas incluye la sección', () => {
    const p = buildChatSystemPrompt({
      ...base,
      rejectedTasks: [{ id: 't1', description: 'Crear a.txt' }],
    })
    expect(p).toContain('Rejected by the user (deleted, nothing was run):')
    expect(p).toContain('- t1: Crear a.txt')
    expect(p).toContain('If the user asks for it again, call create_task again.')
  })
  it('sin rechazadas no la incluye', () => {
    expect(buildChatSystemPrompt({ ...base, rejectedTasks: [] })).not.toContain('Rejected by')
    expect(buildChatSystemPrompt(base)).not.toContain('Rejected by')
  })
})
