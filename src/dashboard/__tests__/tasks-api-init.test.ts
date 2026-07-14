/**
 * v0.12 / Bloque D.1.a — `task init` desde el dashboard.
 *
 * Cubre el gap-no-dev crítico: sin este endpoint, un usuario sin terminal
 * queda bloqueado antes de poder crear su primera tarea (POST /api/tasks
 * devolvía 404 si tasks.yaml no existía).
 *
 * Cubre:
 *   - GET /api/tasks distingue 3 estados que antes colapsaban a "lista vacía":
 *     `exists:false` (sin archivo), `exists:true, tasks:[]` (vacío),
 *     `exists:true, error:'...'` (malformado).
 *   - POST /api/tasks/init crea el archivo con 2 tareas starter y
 *     devuelve 200 + info del scaffold (project, framework, taskIds).
 *   - POST /api/tasks/init devuelve 409 si el archivo ya existe.
 *   - POST /api/tasks ya no devuelve 404 cuando no hay archivo, porque
 *     init lo crea primero — esto es el cierre real del gap.
 *   - Mismo scaffold que el CLI (mismas starter tasks para Next.js / Python /
 *     generic) — garantizado porque ambos llaman al mismo `scaffoldTasksYaml()`.
 *
 * Patrón (heredado de tasks-api-engine.test.ts — F0.1): tmp dir real con
 * tasks.yaml real, chdir al tmp, sin mock.module(). buildProfile se ejecuta
 * contra el tmp (que en este test no tiene package.json → cae al scaffold
 * genérico con 't1-util' / 't2-doc').
 */
import { describe, it, expect, afterAll, beforeEach } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { stringify as yamlStringify } from 'yaml'

const { route } = await import('../server.ts')

const PORT = 4242
const originalCwd = process.cwd()
const tmpDir = mkdtempSync(join(tmpdir(), 'tasks-api-init-'))
process.chdir(tmpDir)

afterAll(() => {
  process.chdir(originalCwd)
  rmSync(tmpDir, { recursive: true, force: true })
})

beforeEach(() => {
  // Empezar CADA test sin tasks.yaml (estado inicial del no-dev).
  try { rmSync(join(tmpDir, 'tasks.yaml')) } catch {}
})

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost:${PORT}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

interface TasksListResponse {
  exists: boolean
  tasks: { id: string; engine: 'single-shot' | 'agentic' | 'external' | null }[]
  error?: string
}

interface InitResponse {
  ok: boolean
  path: string
  project: string
  framework: string | null
  runtime: string | null
  taskIds: string[]
}

describe('D.1.a — GET /api/tasks distingue 3 estados', () => {
  it('sin tasks.yaml: { exists: false, tasks: [] } (gap-no-dev visible)', async () => {
    const res = await route(req('GET', '/api/tasks'), PORT)
    expect(res.status).toBe(200)
    const body = await res.json() as TasksListResponse
    expect(body.exists).toBe(false)
    expect(body.tasks).toEqual([])
    expect(body.error).toBeUndefined()
  })

  it('tasks.yaml existe con tareas: { exists: true, tasks: [...] }', async () => {
    writeFileSync(
      join(tmpDir, 'tasks.yaml'),
      yamlStringify({ version: 1, project: 'g', tasks: [
        { id: 'a', description: 'A', executor: 'openrouter', input: [], output: ['x'], depends_on: [], status: 'pending', retry_count: 0 },
      ] }, { lineWidth: 120 }),
      'utf-8',
    )

    const res = await route(req('GET', '/api/tasks'), PORT)
    expect(res.status).toBe(200)
    const body = await res.json() as TasksListResponse
    expect(body.exists).toBe(true)
    expect(body.tasks).toHaveLength(1)
    expect(body.tasks[0]!.id).toBe('a')
    expect(body.error).toBeUndefined()
  })

  it('tasks.yaml existe pero está malformado: { exists: true, tasks: [], error }', async () => {
    writeFileSync(join(tmpDir, 'tasks.yaml'), 'esto no es YAML válido: [', 'utf-8')

    const res = await route(req('GET', '/api/tasks'), PORT)
    expect(res.status).toBe(200) // 200, no 5xx — el frontend debe poder mostrar el error
    const body = await res.json() as TasksListResponse
    expect(body.exists).toBe(true)
    expect(body.tasks).toEqual([])
    expect(body.error).toBeDefined()
    expect(typeof body.error).toBe('string')
  })
})

describe('D.1.a — POST /api/tasks/init crea el primer tasks.yaml', () => {
  it('crea el archivo con 2 starter tasks y devuelve metadata del scaffold', async () => {
    expect(existsSync(join(tmpDir, 'tasks.yaml'))).toBe(false)

    const res = await route(req('POST', '/api/tasks/init'), PORT)
    expect(res.status).toBe(200)
    const body = await res.json() as InitResponse
    expect(body.ok).toBe(true)
    expect(body.taskIds).toHaveLength(2)
    // macOS resuelve /tmp como /private/tmp (symlink); comparamos por endsWith
    expect(body.path.endsWith('tasks.yaml')).toBe(true)
    expect(body.path).toContain(tmpDir.split('/').pop()!)
    expect(typeof body.project).toBe('string')

    // Archivo realmente escrito en disco
    expect(existsSync(join(tmpDir, 'tasks.yaml'))).toBe(true)
    const yaml = readFileSync(join(tmpDir, 'tasks.yaml'), 'utf-8')
    expect(yaml).toContain('version: 1')
    expect(yaml).toContain(`project: ${body.project}`)

    // Las 2 tareas starter están en el archivo
    for (const id of body.taskIds) {
      expect(yaml).toContain(`id: ${id}`)
    }
  })

  it('tasks.yaml con stack genérico (sin package.json): starter tasks t1-util + t2-doc', async () => {
    // tmpDir no tiene package.json ni manifest → cae al scaffold genérico
    const res = await route(req('POST', '/api/tasks/init'), PORT)
    expect(res.status).toBe(200)
    const body = await res.json() as InitResponse
    expect(body.taskIds).toEqual(['t1-util', 't2-doc'])
  })

  it('después de init, GET /api/tasks devuelve exists:true con las 2 starter tasks', async () => {
    await route(req('POST', '/api/tasks/init'), PORT)

    const listRes = await route(req('GET', '/api/tasks'), PORT)
    const body = await listRes.json() as TasksListResponse
    expect(body.exists).toBe(true)
    expect(body.tasks).toHaveLength(2)
    expect(body.tasks.map(t => t.id).sort()).toEqual(['t1-util', 't2-doc'])
  })

  it('init con tasks.yaml existente: 409 con mensaje claro (NO sobrescribe)', async () => {
    // Crea un archivo "preciado" primero
    const original = yamlStringify({ version: 1, project: 'precious', tasks: [
      { id: 'keep-me', description: 'do not overwrite', executor: 'openrouter', input: [], output: ['x'], depends_on: [], status: 'pending', retry_count: 0 },
    ] }, { lineWidth: 120 })
    writeFileSync(join(tmpDir, 'tasks.yaml'), original, 'utf-8')

    const res = await route(req('POST', '/api/tasks/init'), PORT)
    expect(res.status).toBe(409)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/already exists/i)

    // Contenido intacto
    const after = readFileSync(join(tmpDir, 'tasks.yaml'), 'utf-8')
    expect(after).toBe(original)
    expect(after).toContain('keep-me')
  })
})

describe('D.1.a — el gap original está cerrado', () => {
  it('POST /api/tasks ahora funciona después de init (antes devolvía 404)', async () => {
    // Estado inicial: sin tasks.yaml
    expect(existsSync(join(tmpDir, 'tasks.yaml'))).toBe(false)

    // El gap: POST /api/tasks SIN init previo fallaba con 404
    const pre = await route(req('POST', '/api/tasks', {
      id: 'first', description: 'first task', output: ['x.txt'],
    }), PORT)
    expect(pre.status).toBe(404) // confirma que el gap existía

    // Init lo cierra
    const init = await route(req('POST', '/api/tasks/init'), PORT)
    expect(init.status).toBe(200)

    // Ahora POST /api/tasks funciona
    const post = await route(req('POST', '/api/tasks', {
      id: 'second', description: 'second task', output: ['y.txt'],
    }), PORT)
    expect(post.status).toBe(200)
    const postBody = await post.json() as { ok: boolean; id: string }
    expect(postBody.ok).toBe(true)
    expect(postBody.id).toBe('second')

    // tasks.yaml ahora tiene 3 tasks (2 starter + 1 nueva)
    const list = await route(req('GET', '/api/tasks'), PORT)
    const body = await list.json() as TasksListResponse
    expect(body.tasks).toHaveLength(3)
  })
})
