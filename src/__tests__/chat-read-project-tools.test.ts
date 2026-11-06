import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import {
  executeReadFile,
  executeReadIdeas,
  executeReadPlan,
  executeReadTasks,
} from '../dashboard/handlers/chat.ts'

// B.2 (Mes 18): tools de solo lectura sobre PLAN.md/tasks.yaml/IDEAS.md, mismo shape
// de ToolExecutor que executeFetchUrl/executeSearchMemory — (toolName, input).
describe('read-project tools', () => {
  it('read_plan returns the real content of PLAN.md', async () => {
    const result = await executeReadPlan('read_plan', {})
    // El título es estable independiente de qué Mes esté activo — a diferencia
    // de un número de mes fijo (rota con cada cierre), esto SIEMPRE está al
    // inicio del archivo, dentro del cap de capToolOutput (25k chars).
    expect(result).toContain('OrchestOS — Plan activo')
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

  // R.2-ter — read_plan/tasks/ideas usaban join()+readFileSync crudos, sin pasar
  // por resolveProjectPath(): un nombre fijo (PLAN.md) no impedía que el propio
  // archivo, si fuera un symlink, escapara del root. Ahora comparten el mismo
  // boundary que read_file. Tres fixtures: symlink externo, interno, faltante.
  describe('R.2-ter — frontera unificada de symlinks para lectores fijos', () => {
    it('PLAN.md como symlink externo es rechazado, no seguido', async () => {
      const outside = mkdtempSync(join(tmpdir(), 'orchestos-outside-'))
      const secret = join(outside, 'secret.md')
      writeFileSync(secret, 'contenido fuera del proyecto')
      const root = mkdtempSync(join(tmpdir(), 'orchestos-root-'))
      symlinkSync(secret, join(root, 'PLAN.md'))
      try {
        const outcomes: string[] = []
        const result = await executeReadPlan('read_plan', {}, root, (o) => outcomes.push(o))
        expect(result).toBe('[PLAN.md not found in this project]')
        expect(result).not.toContain('fuera del proyecto')
        expect(outcomes).toEqual(['rejected'])
      } finally {
        rmSync(root, { recursive: true, force: true })
        rmSync(outside, { recursive: true, force: true })
      }
    })

    it('tasks.yaml como symlink interno (dentro del mismo root) se lee normal', async () => {
      const root = mkdtempSync(join(tmpdir(), 'orchestos-root-'))
      const real = join(root, 'real-tasks.yaml')
      writeFileSync(real, 'tasks: []')
      symlinkSync(real, join(root, 'tasks.yaml'))
      try {
        const outcomes: string[] = []
        const result = await executeReadTasks('read_tasks', {}, root, (o) => outcomes.push(o))
        expect(result).toContain('tasks: []')
        expect(outcomes).toEqual(['succeeded'])
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    })

    it('IDEAS.md ausente devuelve el sentinel, no un error', async () => {
      const root = mkdtempSync(join(tmpdir(), 'orchestos-root-'))
      try {
        const outcomes: string[] = []
        const result = await executeReadIdeas('read_ideas', {}, root, (o) => outcomes.push(o))
        expect(result).toBe('[IDEAS.md not found in this project]')
        expect(outcomes).toEqual(['failed'])
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    })
  })
})
