/**
 * G.4 / B.2 — POST /api/tasks acepta `engine: 'single-shot' | 'agentic' | 'external'`,
 * lo persiste en tasks.yaml, lo expone en GET /api/tasks (TaskRow.engine). Validación
 * temprana: cualquier otro string devuelve 400 con el mismo mensaje que
 * validateEngine() en src/tasks/schema.ts.
 *
 * Patrón (heredado de run-graph-api.test.ts — F0.1): tmp dir real con
 * tasks.yaml real, chdir al tmp, sin mock.module(). __resetRunGraphForTests no
 * se necesita acá — no tocamos el graph runner.
 */
import { describe, it, expect, afterAll, beforeEach } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { stringify as yamlStringify } from 'yaml'

const { route } = await import('../server.ts')

const PORT = 4242
const originalCwd = process.cwd()
const tmpDir = mkdtempSync(join(tmpdir(), 'tasks-api-engine-'))
process.chdir(tmpDir)

function writeTasksYaml(tasks: Record<string, unknown>[]): void {
  writeFileSync(
    join(tmpDir, 'tasks.yaml'),
    yamlStringify({ version: 1, project: 'g4', tasks }, { lineWidth: 120 }),
    'utf-8',
  )
}

afterAll(() => {
  process.chdir(originalCwd)
  rmSync(tmpDir, { recursive: true, force: true })
})

beforeEach(() => {
  writeTasksYaml([])
})

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost:${PORT}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

interface TaskRow {
  id: string
  engine: 'single-shot' | 'agentic' | 'external' | null
}

describe('G.4 — POST /api/tasks acepta engine', () => {
  it('engine="agentic" persiste el campo en tasks.yaml y aparece en GET /api/tasks', async () => {
    const res = await route(req('POST', '/api/tasks', {
      id: 'agentic-task',
      description: 'agentic task for G.4',
      output: ['out.txt'],
      executor: 'openrouter',
      executor_model: 'anthropic/claude-haiku-4-5',
      engine: 'agentic',
    }), PORT)
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; id: string }
    expect(body.ok).toBe(true)

    // Persistido en disco
    const yaml = readFileSync(join(tmpDir, 'tasks.yaml'), 'utf-8')
    expect(yaml).toContain('engine: agentic')

    // Visible en GET /api/tasks
    const listRes = await route(req('GET', '/api/tasks'), PORT)
    const rows = await listRes.json() as TaskRow[]
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe('agentic-task')
    expect(rows[0]!.engine).toBe('agentic')
  })

  it('engine="single-shot" persiste el campo', async () => {
    const res = await route(req('POST', '/api/tasks', {
      id: 'single-task',
      description: 'single task',
      output: ['out.txt'],
      engine: 'single-shot',
    }), PORT)
    expect(res.status).toBe(200)

    const yaml = readFileSync(join(tmpDir, 'tasks.yaml'), 'utf-8')
    expect(yaml).toContain('engine: single-shot')

    const listRes = await route(req('GET', '/api/tasks'), PORT)
    const rows = await listRes.json() as TaskRow[]
    expect(rows[0]!.engine).toBe('single-shot')
  })

  it('engine ausente: no se persiste y TaskRow.engine es null', async () => {
    const res = await route(req('POST', '/api/tasks', {
      id: 'no-engine',
      description: 'inherits config',
      output: ['out.txt'],
    }), PORT)
    expect(res.status).toBe(200)

    const yaml = readFileSync(join(tmpDir, 'tasks.yaml'), 'utf-8')
    expect(yaml).not.toContain('engine:')

    const listRes = await route(req('GET', '/api/tasks'), PORT)
    const rows = await listRes.json() as TaskRow[]
    expect(rows[0]!.engine).toBeNull()
  })

  it('engine="bogus" devuelve 400 con mensaje claro', async () => {
    const res = await route(req('POST', '/api/tasks', {
      id: 'bad-engine',
      description: 'invalid engine value',
      output: ['out.txt'],
      engine: 'bogus',
    }), PORT)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toContain("unknown engine 'bogus'")
    expect(body.error).toContain('single-shot')
    expect(body.error).toContain('agentic')
  })

  it('engine="" (string vacío): se trata como ausente, no persiste', async () => {
    const res = await route(req('POST', '/api/tasks', {
      id: 'empty-engine',
      description: 'empty string engine',
      output: ['out.txt'],
      engine: '',
    }), PORT)
    expect(res.status).toBe(200)

    const yaml = readFileSync(join(tmpDir, 'tasks.yaml'), 'utf-8')
    expect(yaml).not.toContain('engine:')

    const listRes = await route(req('GET', '/api/tasks'), PORT)
    const rows = await listRes.json() as TaskRow[]
    expect(rows[0]!.engine).toBeNull()
  })

  it('múltiples tasks con engines distintos: GET devuelve cada uno con su engine', async () => {
    await route(req('POST', '/api/tasks', { id: 'a', description: 'A', output: ['o.txt'], engine: 'agentic' }), PORT)
    await route(req('POST', '/api/tasks', { id: 'b', description: 'B', output: ['o.txt'], engine: 'single-shot' }), PORT)
    await route(req('POST', '/api/tasks', { id: 'c', description: 'C', output: ['o.txt'] }), PORT)

    const listRes = await route(req('GET', '/api/tasks'), PORT)
    const rows = (await listRes.json() as TaskRow[]).sort((x, y) => x.id.localeCompare(y.id))
    expect(rows).toHaveLength(3)
    expect(rows[0]!.engine).toBe('agentic')
    expect(rows[1]!.engine).toBe('single-shot')
    expect(rows[2]!.engine).toBeNull()
  })

  // B.2 — engine='external' es la tercera opción; mismo flujo de validación y persistencia.
  it('engine="external" persiste el campo y aparece como "external" en GET /api/tasks', async () => {
    const res = await route(req('POST', '/api/tasks', {
      id: 'external-task',
      description: 'external engine task',
      output: ['out.txt'],
      engine: 'external',
    }), PORT)
    expect(res.status).toBe(200)

    const yaml = readFileSync(join(tmpDir, 'tasks.yaml'), 'utf-8')
    expect(yaml).toContain('engine: external')

    const listRes = await route(req('GET', '/api/tasks'), PORT)
    const rows = await listRes.json() as TaskRow[]
    expect(rows).toHaveLength(1)
    expect(rows[0]!.engine).toBe('external')
  })

  it('engine="bogus2" devuelve 400 con mensaje que incluye "external"', async () => {
    const res = await route(req('POST', '/api/tasks', {
      id: 'bad-engine-2',
      description: 'invalid engine value',
      output: ['o.txt'],
      engine: 'bogus2',
    }), PORT)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toContain("unknown engine 'bogus2'")
    expect(body.error).toContain('single-shot')
    expect(body.error).toContain('agentic')
    expect(body.error).toContain('external')
  })

  it('múltiples tasks: agentic + single-shot + external + inherit', async () => {
    await route(req('POST', '/api/tasks', { id: 'a', description: 'A', output: ['o.txt'], engine: 'agentic' }), PORT)
    await route(req('POST', '/api/tasks', { id: 'b', description: 'B', output: ['o.txt'], engine: 'single-shot' }), PORT)
    await route(req('POST', '/api/tasks', { id: 'e', description: 'E', output: ['o.txt'], engine: 'external' }), PORT)
    await route(req('POST', '/api/tasks', { id: 'n', description: 'N', output: ['o.txt'] }), PORT)

    const listRes = await route(req('GET', '/api/tasks'), PORT)
    const rows = (await listRes.json() as TaskRow[]).sort((x, y) => x.id.localeCompare(y.id))
    expect(rows).toHaveLength(4)
    expect(rows[0]!.engine).toBe('agentic')
    expect(rows[1]!.engine).toBe('single-shot')
    expect(rows[2]!.engine).toBe('external')
    expect(rows[3]!.engine).toBeNull()
  })
})
