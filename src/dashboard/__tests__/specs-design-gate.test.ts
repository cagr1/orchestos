/**
 * AA (IDEAS #6) — design.md condicional. Gate real end-to-end vía POST /api/specs/*,
 * mismo patrón que constitution-api.test.ts (tmp dir + chdir + route(), sin
 * mock.module() — el request sin selector usa el fallback legacy, así que el cwd del test ES
 * el root seleccionado).
 */
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const { route } = await import('../server.ts')
const { loadSpec, saveSpec } = await import('../../spec/store.ts')

const PORT = 4242
const originalCwd = process.cwd()
const tmpDir = mkdtempSync(join(tmpdir(), 'specs-design-gate-'))
process.chdir(tmpDir)

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost:${PORT}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

afterAll(() => {
  process.chdir(originalCwd)
  rmSync(tmpDir, { recursive: true, force: true })
})

beforeEach(() => {
  rmSync(join(tmpDir, '.orchestos', 'specs'), { recursive: true, force: true })
})

describe('POST /api/specs/<id> (AA.4 — --design vía body)', () => {
  it('sin design en el body: comportamiento idéntico al de siempre, cero campo design', async () => {
    const res = await route(req('POST', '/api/specs/simple-task'), PORT)
    expect(res.status).toBe(200)
    const s = loadSpec(tmpDir, 'simple-task')!
    expect(s.frontmatter.design).toBeUndefined()
    expect(s.body).not.toContain('## Design')
  })

  it('con design:true en el body: frontmatter.design queda pending y el body incluye la sección Design', async () => {
    const res = await route(req('POST', '/api/specs/complex-task', { design: true }), PORT)
    expect(res.status).toBe(200)
    const s = loadSpec(tmpDir, 'complex-task')!
    expect(s.frontmatter.design).toBe('pending')
    expect(s.body).toContain('## Design')
  })
})

describe('POST /api/specs/<id>/approve — gate de design (AA.2/AA.4)', () => {
  it('bloquea con 422 cuando design está pending, incluso con clarify:none y criterios reales', async () => {
    mkdirSync(join(tmpDir, '.orchestos', 'specs'), { recursive: true })
    saveSpec(tmpDir, {
      frontmatter: {
        id: 'blocked-task',
        status: 'draft',
        createdAt: new Date().toISOString(),
        clarify: 'none',
        design: 'pending',
      },
      body: '## Contexto\nFoo\n\n## Criterios de aceptación\n- [ ] WHEN X THEN Y\n\n## Notas\nNone\n',
    })
    const res = await route(req('POST', '/api/specs/blocked-task/approve'), PORT)
    expect(res.status).toBe(422)
    const data = (await res.json()) as { error: string }
    expect(data.error).toContain('design')
    const s = loadSpec(tmpDir, 'blocked-task')!
    expect(s.frontmatter.status).toBe('draft')
  })

  it('no bloquea cuando design está ausente (spec simple, cero regresión)', async () => {
    mkdirSync(join(tmpDir, '.orchestos', 'specs'), { recursive: true })
    saveSpec(tmpDir, {
      frontmatter: {
        id: 'simple-approvable',
        status: 'draft',
        createdAt: new Date().toISOString(),
        clarify: 'none',
      },
      body: '## Contexto\nFoo\n\n## Criterios de aceptación\n- [ ] WHEN X THEN Y\n\n## Notas\nNone\n',
    })
    const res = await route(req('POST', '/api/specs/simple-approvable/approve'), PORT)
    expect(res.status).toBe(200)
    const s = loadSpec(tmpDir, 'simple-approvable')!
    expect(s.frontmatter.status).toBe('approved')
  })

  it('no bloquea cuando design ya está approved', async () => {
    mkdirSync(join(tmpDir, '.orchestos', 'specs'), { recursive: true })
    saveSpec(tmpDir, {
      frontmatter: {
        id: 'design-done',
        status: 'draft',
        createdAt: new Date().toISOString(),
        clarify: 'none',
        design: 'approved',
        designApprovedAt: new Date().toISOString(),
      },
      body: '## Contexto\nFoo\n\n## Criterios de aceptación\n- [ ] WHEN X THEN Y\n\n## Notas\nNone\n',
    })
    const res = await route(req('POST', '/api/specs/design-done/approve'), PORT)
    expect(res.status).toBe(200)
    const s = loadSpec(tmpDir, 'design-done')!
    expect(s.frontmatter.status).toBe('approved')
  })
})

describe('POST /api/specs/<id>/approve-design (AA.2/AA.4)', () => {
  it('aprueba un design pending y setea designApprovedAt', async () => {
    mkdirSync(join(tmpDir, '.orchestos', 'specs'), { recursive: true })
    saveSpec(tmpDir, {
      frontmatter: {
        id: 'to-approve',
        status: 'draft',
        createdAt: new Date().toISOString(),
        clarify: 'none',
        design: 'pending',
      },
      body: '## Contexto\nFoo\n\n## Design\n<placeholder>\n\n## Criterios de aceptación\n- [ ] <criterio 1>\n\n## Notas\nNone\n',
    })
    const res = await route(req('POST', '/api/specs/to-approve/approve-design'), PORT)
    expect(res.status).toBe(200)
    const s = loadSpec(tmpDir, 'to-approve')!
    expect(s.frontmatter.design).toBe('approved')
    expect(s.frontmatter.designApprovedAt).toBeDefined()
  })

  it('422 cuando la tarea nunca fue marcada compleja (design ausente)', async () => {
    mkdirSync(join(tmpDir, '.orchestos', 'specs'), { recursive: true })
    saveSpec(tmpDir, {
      frontmatter: {
        id: 'never-complex',
        status: 'draft',
        createdAt: new Date().toISOString(),
        clarify: 'none',
      },
      body: '## Contexto\nFoo\n\n## Criterios de aceptación\n- [ ] WHEN X THEN Y\n\n## Notas\nNone\n',
    })
    const res = await route(req('POST', '/api/specs/never-complex/approve-design'), PORT)
    expect(res.status).toBe(422)
  })

  it('422 cuando el design ya fue aprobado (no re-aprueba en silencio)', async () => {
    mkdirSync(join(tmpDir, '.orchestos', 'specs'), { recursive: true })
    saveSpec(tmpDir, {
      frontmatter: {
        id: 'already-approved',
        status: 'draft',
        createdAt: new Date().toISOString(),
        clarify: 'none',
        design: 'approved',
        designApprovedAt: '2026-01-01T00:00:00.000Z',
      },
      body: '## Contexto\nFoo\n\n## Criterios de aceptación\n- [ ] WHEN X THEN Y\n\n## Notas\nNone\n',
    })
    const res = await route(req('POST', '/api/specs/already-approved/approve-design'), PORT)
    expect(res.status).toBe(422)
  })

  it('404 cuando la spec no existe', async () => {
    const res = await route(req('POST', '/api/specs/does-not-exist/approve-design'), PORT)
    expect(res.status).toBe(404)
  })
})
