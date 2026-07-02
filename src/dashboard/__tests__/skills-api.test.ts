/**
 * Mes 11 / I1-I2 — Curator unit tests + integration tests for skills endpoints
 * (A1-A6, F3, /api/skills/curate, G pro pack).
 */
import { describe, it, expect, afterEach, afterAll, mock } from 'bun:test'
import { existsSync, unlinkSync, rmSync } from 'fs'
import { getSkillPath, getProSkillPath } from '../../skills/registry.ts'
import { __setChatForTests, __resetChatForTests } from '../handlers/skills.ts'
import type { ChatResponse } from '../../providers/openrouter.ts'

const mockChat = mock(async (): Promise<ChatResponse> => ({
  text: '',
  inputTokens: 0,
  outputTokens: 0,
  model: 'mock',
}))

__setChatForTests(mockChat as any)
afterAll(() => { __resetChatForTests() })

const { route } = await import('../server.ts')

const PORT = 4242

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost:${PORT}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const VALID_SKILL = {
  id: 'curated-test-skill',
  version: '1.0.0',
  name: 'Curated Test Skill',
  description: 'A skill produced by the curator for testing.',
  instructions: 'Do the test thing.',
  targets: ['claude'],
}

// ── I1: Curator (/api/skills/curate) with mocked LLM ────────────────────────

describe('POST /api/skills/curate', () => {
  it('400 when text is missing', async () => {
    const res = await route(req('POST', '/api/skills/curate', {}), PORT)
    expect(res.status).toBe(400)
  })

  it('happy path: valid SkillDef on first attempt', async () => {
    mockChat.mockImplementationOnce(async () => ({
      text: JSON.stringify(VALID_SKILL),
      inputTokens: 10,
      outputTokens: 20,
      model: 'mock',
    }))

    const res = await route(req('POST', '/api/skills/curate', { text: 'a skill that does the test thing' }), PORT)
    const body = await res.json() as { ok: boolean; skill: any; iterations: number }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.skill.id).toBe('curated-test-skill')
    expect(body.iterations).toBe(1)
  })

  it('malformed JSON output on every attempt fails after retries', async () => {
    mockChat.mockImplementation(async () => ({
      text: 'this is not json at all',
      inputTokens: 5,
      outputTokens: 5,
      model: 'mock',
    }))

    const res = await route(req('POST', '/api/skills/curate', { text: 'broken skill' }), PORT)
    const body = await res.json() as { ok: boolean; error: string; iterations: number }

    expect(res.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.iterations).toBe(3)
    expect(body.error).toContain('not valid JSON')

    mockChat.mockReset()
    mockChat.mockImplementation(async () => ({ text: '', inputTokens: 0, outputTokens: 0, model: 'mock' }))
  })

  it('recovers on retry: invalid skill first, valid skill second', async () => {
    let call = 0
    mockChat.mockImplementation(async () => {
      call++
      if (call === 1) {
        return {
          text: JSON.stringify({ id: 'Not Kebab Case!!', name: 'x' }),
          inputTokens: 5, outputTokens: 5, model: 'mock',
        }
      }
      return { text: JSON.stringify(VALID_SKILL), inputTokens: 5, outputTokens: 5, model: 'mock' }
    })

    const res = await route(req('POST', '/api/skills/curate', { text: 'retry skill' }), PORT)
    const body = await res.json() as { ok: boolean; skill: any; iterations: number }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.iterations).toBe(2)
    expect(body.skill.id).toBe('curated-test-skill')

    mockChat.mockReset()
    mockChat.mockImplementation(async () => ({ text: '', inputTokens: 0, outputTokens: 0, model: 'mock' }))
  })

  it('502 when the LLM call fails (timeout/network error)', async () => {
    mockChat.mockImplementationOnce(async () => {
      throw new Error('fetch timed out')
    })

    const res = await route(req('POST', '/api/skills/curate', { text: 'times out' }), PORT)
    const body = await res.json() as { error: string }

    expect(res.status).toBe(502)
    expect(body.error).toContain('fetch timed out')
  })
})

// ── I2: Integration tests — A1, A2, F3 (read-only, real skills/) ────────────

describe('GET /api/skills (A1)', () => {
  it('returns the list of installed skills', async () => {
    const res = await route(req('GET', '/api/skills'), PORT)
    const body = await res.json() as Array<{ id: string }>

    expect(res.status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body.find(s => s.id === 'tdd-enforcer')).toBeTruthy()
  })
})

describe('GET /api/skills/:id (A2)', () => {
  it('returns a single skill by id', async () => {
    const res = await route(req('GET', '/api/skills/tdd-enforcer'), PORT)
    const body = await res.json() as { id: string; instructions: string }

    expect(res.status).toBe(200)
    expect(body.id).toBe('tdd-enforcer')
    expect(typeof body.instructions).toBe('string')
  })

  it('404 for an unknown skill id', async () => {
    const res = await route(req('GET', '/api/skills/does-not-exist'), PORT)
    expect(res.status).toBe(404)
  })
})

describe('GET /api/skills/:id/export (F3)', () => {
  it('returns the YAML with an attachment Content-Disposition header', async () => {
    const res = await route(req('GET', '/api/skills/tdd-enforcer/export'), PORT)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('yaml')
    expect(res.headers.get('content-disposition')).toContain('attachment')
    expect(res.headers.get('content-disposition')).toContain('tdd-enforcer.yaml')
    expect(text).toContain('id: tdd-enforcer')
  })

  it('404 for an unknown skill id', async () => {
    const res = await route(req('GET', '/api/skills/does-not-exist/export'), PORT)
    expect(res.status).toBe(404)
  })
})

// ── I2: A3-A6 — write/build endpoints (temp skill, cleaned up after) ───────

const TEMP_ID = 'i2-test-skill-temp'
const TEMP_SKILL = {
  id: TEMP_ID,
  version: '1.0.0',
  name: 'I2 Temp Skill',
  description: 'Temporary skill created by integration tests, removed afterwards.',
  instructions: 'Do nothing. This is a test fixture.',
  targets: ['claude'],
}

function cleanupTempSkill(): void {
  const path = getSkillPath(TEMP_ID)
  if (existsSync(path)) unlinkSync(path)
  const distPath = `dist/skills/claude/${TEMP_ID}.md`
  if (existsSync(distPath)) rmSync(distPath)
}

describe('POST /api/skills (A3)', () => {
  afterEach(cleanupTempSkill)

  it('400 for invalid (non-kebab-case) id', async () => {
    const res = await route(req('POST', '/api/skills', { ...TEMP_SKILL, id: 'Not Valid' }), PORT)
    expect(res.status).toBe(400)
  })

  it('creates a new skill file', async () => {
    const res = await route(req('POST', '/api/skills', TEMP_SKILL), PORT)
    const body = await res.json() as { ok: boolean; id: string }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.id).toBe(TEMP_ID)
    expect(existsSync(getSkillPath(TEMP_ID))).toBe(true)
  })

  it('409 when the skill already exists', async () => {
    await route(req('POST', '/api/skills', TEMP_SKILL), PORT)
    const res = await route(req('POST', '/api/skills', TEMP_SKILL), PORT)
    expect(res.status).toBe(409)
  })
})

describe('PUT /api/skills/:id (A4)', () => {
  afterEach(cleanupTempSkill)

  it('404 when the skill does not exist', async () => {
    const res = await route(req('PUT', `/api/skills/${TEMP_ID}`, TEMP_SKILL), PORT)
    expect(res.status).toBe(404)
  })

  it('overwrites an existing skill', async () => {
    await route(req('POST', '/api/skills', TEMP_SKILL), PORT)

    const updated = { ...TEMP_SKILL, description: 'Updated description for I2 test.' }
    const res = await route(req('PUT', `/api/skills/${TEMP_ID}`, updated), PORT)
    const body = await res.json() as { ok: boolean }
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    const getRes = await route(req('GET', `/api/skills/${TEMP_ID}`), PORT)
    const getBody = await getRes.json() as { description: string }
    expect(getBody.description).toBe('Updated description for I2 test.')
  })
})

describe('POST /api/skills/:id/build (A6)', () => {
  afterEach(cleanupTempSkill)

  it('compiles artifacts for an existing skill', async () => {
    await route(req('POST', '/api/skills', TEMP_SKILL), PORT)

    const res = await route(req('POST', `/api/skills/${TEMP_ID}/build`), PORT)
    const body = await res.json() as { ok: boolean; paths: string[]; skillId: string }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.skillId).toBe(TEMP_ID)
    expect(body.paths.length).toBeGreaterThan(0)
    for (const p of body.paths) expect(existsSync(p)).toBe(true)
  })

  it('404 for an unknown skill id', async () => {
    const res = await route(req('POST', `/api/skills/${TEMP_ID}/build`), PORT)
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/skills/:id (A5)', () => {
  afterEach(cleanupTempSkill)

  it('400 without confirm:true', async () => {
    await route(req('POST', '/api/skills', TEMP_SKILL), PORT)
    const res = await route(req('DELETE', `/api/skills/${TEMP_ID}`, {}), PORT)
    expect(res.status).toBe(400)
  })

  it('deletes the skill with confirm:true', async () => {
    await route(req('POST', '/api/skills', TEMP_SKILL), PORT)
    const res = await route(req('DELETE', `/api/skills/${TEMP_ID}`, { confirm: true }), PORT)
    const body = await res.json() as { ok: boolean }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(existsSync(getSkillPath(TEMP_ID))).toBe(false)
  })

  it('404 for an unknown skill id', async () => {
    const res = await route(req('DELETE', `/api/skills/${TEMP_ID}`, { confirm: true }), PORT)
    expect(res.status).toBe(404)
  })
})

// ── G — Pro pack endpoints (GET /api/skills/pro, POST .../import) ──────────

describe('GET /api/skills/pro', () => {
  it('lists the pro pack with imported flags', async () => {
    const res = await route(req('GET', '/api/skills/pro'), PORT)
    const body = await res.json() as Array<{ id: string; imported: boolean }>

    expect(res.status).toBe(200)
    expect(body.length).toBeGreaterThanOrEqual(8)
    expect(body.find(s => s.id === 'code-review')).toBeTruthy()
    for (const s of body) expect(typeof s.imported).toBe('boolean')
  })
})

describe('POST /api/skills/pro/:id/import', () => {
  const PRO_ID = 'perf-profile'

  afterEach(() => {
    const path = getSkillPath(PRO_ID)
    if (existsSync(path)) unlinkSync(path)
  })

  it('imports a pro skill into skills/', async () => {
    const res = await route(req('POST', `/api/skills/pro/${PRO_ID}/import`), PORT)
    const body = await res.json() as { ok: boolean; id: string }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.id).toBe(PRO_ID)
    expect(existsSync(getSkillPath(PRO_ID))).toBe(true)
  })

  it('409 when already imported', async () => {
    await route(req('POST', `/api/skills/pro/${PRO_ID}/import`), PORT)
    const res = await route(req('POST', `/api/skills/pro/${PRO_ID}/import`), PORT)
    expect(res.status).toBe(409)
  })

  it('404 for an unknown pro skill id', async () => {
    const res = await route(req('POST', `/api/skills/pro/does-not-exist/import`), PORT)
    expect(res.status).toBe(404)
    expect(existsSync(getProSkillPath('does-not-exist'))).toBe(false)
  })
})
