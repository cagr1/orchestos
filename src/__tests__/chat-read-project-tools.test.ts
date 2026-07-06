import { describe, it, expect } from 'bun:test'
import { executeReadPlan, executeReadTasks, executeReadIdeas } from '../dashboard/handlers/chat.ts'

// B.2 (Mes 18): tools de solo lectura sobre PLAN.md/tasks.yaml/IDEAS.md, mismo shape
// de ToolExecutor que executeFetchUrl/executeSearchMemory — (toolName, input).
describe('read-project tools', () => {
  it('read_plan returns the real content of PLAN.md', async () => {
    const result = await executeReadPlan('read_plan', {})
    expect(result).toContain('MES 18')
  })

  it('read_tasks returns the real content of tasks.yaml', async () => {
    const result = await executeReadTasks('read_tasks', {})
    // Sentinel exacto de readProjectTextFile() cuando el archivo no existe —
    // un `not.toContain('not found')` genérico choca con contenido real que
    // legítimamente mencione esa frase (ej. un error citado en prosa).
    expect(result).not.toBe('[tasks.yaml not found in this project]')
    expect(result.length).toBeGreaterThan(0)
  })

  it('read_ideas returns the real content of IDEAS.md', async () => {
    const result = await executeReadIdeas('read_ideas', {})
    expect(result).not.toBe('[IDEAS.md not found in this project]')
    expect(result.length).toBeGreaterThan(0)
  })
})
