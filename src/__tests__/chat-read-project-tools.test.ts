import { describe, it, expect } from 'bun:test'
import { rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { resolve } from 'path'
import { executeReadPlan, executeReadTasks, executeReadIdeas, executeReadFile } from '../dashboard/handlers/chat.ts'

// B.2 (Mes 18): tools de solo lectura sobre PLAN.md/tasks.yaml/IDEAS.md, mismo shape
// de ToolExecutor que executeFetchUrl/executeSearchMemory — (toolName, input).
describe('read-project tools', () => {
  it('read_plan returns the real content of PLAN.md', async () => {
    const result = await executeReadPlan('read_plan', {})
    // MES 22 es la sección activa vigente — no un número fijo de mes viejo:
    // PLAN.md crece y secciones más antiguas caen fuera del cap de
    // capToolOutput (25k chars), así que el test debe verificar lo que SÍ
    // está garantizado al inicio del archivo, no una sección de meses atrás.
    expect(result).toContain('MES 22')
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

  // A.3 (PLAN.md Mes 22): el cap de contexto se inyecta en readProjectTextFile,
  // que cubre los 4 readers (read_plan/read_tasks/read_ideas/read_file).
  // IDEAS.md pesa ~70KB en este repo (>25K default) → marker debe aparecer.
  it('read_ideas caps the output when the underlying file exceeds 25K chars', async () => {
    const result = await executeReadIdeas('read_ideas', {})
    expect(result).toContain('[...truncado:')
  })

  // A.3 (PLAN.md Mes 22): executeReadFile debe pasar por el mismo cap que el resto.
  // Escribimos un archivo >25K dentro del cwd real (única forma de pasar el
  // path-safety check de executeReadFile) y limpiamos al final.
  it('read_file caps the output when the file exceeds 25K chars', async () => {
    const big = 'Z'.repeat(30_000)
    const inProject = join(resolve('.'), '__cap_test_tmp__.txt')
    writeFileSync(inProject, big)
    try {
      const result = await executeReadFile('read_file', { path: '__cap_test_tmp__.txt' })
      expect(result).toContain('[...truncado:')
      expect(result.length).toBeLessThan(big.length + 200)
    } finally {
      rmSync(inProject, { force: true })
    }
  })
})
