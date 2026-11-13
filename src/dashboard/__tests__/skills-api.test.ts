/**
 * Mes 11 / I1-I2 — Curator unit tests + integration tests for skills endpoints
 * (A1-A6, F3, /api/skills/curate, G pro pack).
 */
import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { db } from '../../db/sqlite.ts'
import type { ChatResponse } from '../../providers/openrouter.ts'
import { getProSkillPath, getSkillPath } from '../../skills/registry.ts'
import { __resetChatForTests, __setChatForTests } from '../handlers/skills.ts'

const mockChat = mock(
  async (): Promise<ChatResponse> => ({
    text: '',
    inputTokens: 0,
    outputTokens: 0,
    model: 'mock',
  }),
)

__setChatForTests(mockChat as any)
afterAll(() => {
  __resetChatForTests()
  db.run("DELETE FROM projects WHERE id = 'skills-api-test'")
  rmSync(projectRoot, { recursive: true, force: true })
})

const { route } = await import('../server.ts')

const PORT = 4242
const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-skills-api-'))
mkdirSync(join(projectRoot, '.orchestos'), { recursive: true })
writeFileSync(
  join(projectRoot, 'orchestos.config.yaml'),
  'roles:\n  auxiliary: { agent: api, provider: openrouter, model: mock/auxiliary }\n',
)
db.run('INSERT INTO projects (id,path,stack_profile,agents_md,last_updated) VALUES (?,?,?,?,?)', [
  'skills-api-test',
  projectRoot,
  '{}',
  '',
  new Date().toISOString(),
])

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost:${PORT}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-orchestos-project-id': 'skills-api-test',
    },
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

    const res = await route(
      req('POST', '/api/skills/curate', { text: 'a skill that does the test thing' }),
      PORT,
    )
    const body = (await res.json()) as { ok: boolean; skill: any; iterations: number }

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
    const body = (await res.json()) as { ok: boolean; error: string; iterations: number }

    expect(res.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.iterations).toBe(3)
    expect(body.error).toContain('not valid JSON')

    mockChat.mockReset()
    mockChat.mockImplementation(async () => ({
      text: '',
      inputTokens: 0,
      outputTokens: 0,
      model: 'mock',
    }))
  })

  it('recovers on retry: invalid skill first, valid skill second', async () => {
    let call = 0
    mockChat.mockImplementation(async () => {
      call++
      if (call === 1) {
        return {
          text: JSON.stringify({ id: 'Not Kebab Case!!', name: 'x' }),
          inputTokens: 5,
          outputTokens: 5,
          model: 'mock',
        }
      }
      return { text: JSON.stringify(VALID_SKILL), inputTokens: 5, outputTokens: 5, model: 'mock' }
    })

    const res = await route(req('POST', '/api/skills/curate', { text: 'retry skill' }), PORT)
    const body = (await res.json()) as { ok: boolean; skill: any; iterations: number }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.iterations).toBe(2)
    expect(body.skill.id).toBe('curated-test-skill')

    mockChat.mockReset()
    mockChat.mockImplementation(async () => ({
      text: '',
      inputTokens: 0,
      outputTokens: 0,
      model: 'mock',
    }))
  })

  it('502 when the LLM call fails (timeout/network error)', async () => {
    mockChat.mockImplementationOnce(async () => {
      throw new Error('fetch timed out')
    })

    const res = await route(req('POST', '/api/skills/curate', { text: 'times out' }), PORT)
    const body = (await res.json()) as { error: string }

    expect(res.status).toBe(502)
    expect(body.error).toContain('fetch timed out')
  })
})

// ── I2: Integration tests — A1, A2, F3 (read-only, real skills/) ────────────

describe('GET /api/skills (A1)', () => {
  it('returns the list of installed skills', async () => {
    const res = await route(req('GET', '/api/skills'), PORT)
    const body = (await res.json()) as Array<{ id: string }>

    expect(res.status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body.find((s) => s.id === 'tdd-enforcer')).toBeTruthy()
  })
})

describe('GET /api/skills/:id (A2)', () => {
  it('returns a single skill by id', async () => {
    const res = await route(req('GET', '/api/skills/tdd-enforcer'), PORT)
    const body = (await res.json()) as { id: string; instructions: string }

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
  const path = getSkillPath(TEMP_ID, projectRoot)
  if (existsSync(path)) unlinkSync(path)
  const distPath = join(projectRoot, 'dist/skills/claude', `${TEMP_ID}.md`)
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
    const body = (await res.json()) as { ok: boolean; id: string }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.id).toBe(TEMP_ID)
    expect(existsSync(getSkillPath(TEMP_ID, projectRoot))).toBe(true)
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
    const body = (await res.json()) as { ok: boolean }
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    const getRes = await route(req('GET', `/api/skills/${TEMP_ID}`), PORT)
    const getBody = (await getRes.json()) as { description: string }
    expect(getBody.description).toBe('Updated description for I2 test.')
  })
})

describe('POST /api/skills/:id/build (A6)', () => {
  afterEach(cleanupTempSkill)

  it('compiles artifacts for an existing skill', async () => {
    await route(req('POST', '/api/skills', TEMP_SKILL), PORT)

    const res = await route(req('POST', `/api/skills/${TEMP_ID}/build`), PORT)
    const body = (await res.json()) as { ok: boolean; paths: string[]; skillId: string }

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
    const body = (await res.json()) as { ok: boolean }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(existsSync(getSkillPath(TEMP_ID, projectRoot))).toBe(false)
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
    const body = (await res.json()) as Array<{ id: string; imported: boolean }>

    expect(res.status).toBe(200)
    expect(body.length).toBeGreaterThanOrEqual(8)
    expect(body.find((s) => s.id === 'code-review')).toBeTruthy()
    for (const s of body) expect(typeof s.imported).toBe('boolean')
  })
})

describe('POST /api/skills/pro/:id/import', () => {
  const PRO_ID = 'perf-profile'

  afterEach(() => {
    const path = getSkillPath(PRO_ID, projectRoot)
    if (existsSync(path)) unlinkSync(path)
  })

  it('imports a pro skill into skills/', async () => {
    const res = await route(req('POST', `/api/skills/pro/${PRO_ID}/import`), PORT)
    const body = (await res.json()) as { ok: boolean; id: string }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.id).toBe(PRO_ID)
    expect(existsSync(getSkillPath(PRO_ID, projectRoot))).toBe(true)
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

describe('AUD.16 — skill identity and registry boundary', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function registryFetch(entries: Record<string, unknown>, content = stringify(VALID_SKILL)) {
    const calls: string[] = []
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input)
      calls.push(url)
      return new Response(
        url.endsWith('index.json') ? JSON.stringify({ skills: entries }) : content,
      )
    }) as unknown as typeof fetch
    return calls
  }
  const entry = { source: 'test/repo', files: ['SKILL.md'], bundleHash: 'hash' }

  it('PUT rejects a mismatched id without writing and defaults a missing id to the URL', async () => {
    const path = getSkillPath('aud-update', projectRoot)
    mkdirSync(join(projectRoot, 'skills'), { recursive: true })
    const original = stringify({ ...VALID_SKILL, id: 'aud-update' })
    writeFileSync(path, original)
    const res = await route(
      req('PUT', '/api/skills/aud-update', { ...VALID_SKILL, id: 'other' }),
      PORT,
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'skill id "other" does not match URL id "aud-update"',
    })
    expect(readFileSync(path, 'utf8')).toBe(original)
    const { id: _id, ...body } = VALID_SKILL
    const updated = await route(req('PUT', '/api/skills/aud-update', body), PORT)
    expect(updated.status).toBe(200)
    expect(parse(readFileSync(path, 'utf8')).id).toBe('aud-update')
  })

  it('imports direct content under the URL id and removes unknown fields', async () => {
    registryFetch({ 'aud-direct': entry }, stringify({ ...VALID_SKILL, extra: 1 }))
    const res = await route(req('POST', '/api/skills/registry/aud-direct/import'), PORT)
    expect(res.status).toBe(200)
    expect(parse(readFileSync(getSkillPath('aud-direct', projectRoot), 'utf8'))).toEqual({
      ...VALID_SKILL,
      id: 'aud-direct',
    })
  })

  it('imports normalized content under the URL id before validation', async () => {
    registryFetch({ 'aud-normalized': entry }, '# Markdown requiring normalization')
    mockChat.mockImplementationOnce(async () => ({
      text: JSON.stringify({ ...VALID_SKILL, id: 'INVALID ID!', extra: 1 }),
      inputTokens: 0,
      outputTokens: 0,
      model: 'mock',
    }))
    const res = await route(req('POST', '/api/skills/registry/aud-normalized/import'), PORT)
    expect(res.status).toBe(200)
    expect(parse(readFileSync(getSkillPath('aud-normalized', projectRoot), 'utf8'))).toEqual({
      ...VALID_SKILL,
      id: 'aud-normalized',
    })
  })

  for (const [id, entries, status, error] of [
    [
      'aud-rejected',
      { 'aud-rejected': { ...entry, review: { status: 'rejected' } } },
      409,
      'Skill was rejected by registry review',
    ],
    ['aud-missing', {}, 404, 'Skill not found in registry'],
  ] as const) {
    it(`blocks ${id} before fetching content or writing`, async () => {
      const calls = registryFetch(entries)
      const res = await route(req('POST', `/api/skills/registry/${id}/import`), PORT)
      expect(res.status).toBe(status)
      expect(await res.json()).toEqual({ error })
      expect(calls).toHaveLength(1)
      expect(existsSync(getSkillPath(id, projectRoot))).toBe(false)
    })
  }

  it('rejects invalid URL ids before fetching', async () => {
    const calls = registryFetch({})
    const res = await route(req('POST', '/api/skills/registry/Bad_ID/import'), PORT)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid skill id' })
    expect(calls).toHaveLength(0)
  })

  it('skips invalid index entries and hides rejected skills', async () => {
    registryFetch({
      valid: entry,
      broken: { source: 'x', bundleHash: 'h' },
      rejected: { ...entry, review: { status: 'rejected' } },
    })
    const res = await route(req('GET', '/api/skills/registry'), PORT)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.skills.map((skill: { id: string }) => skill.id)).toEqual(['valid'])
  })

  it('reports an invalid index shape as a registry error', async () => {
    globalThis.fetch = (async () => new Response('{}')) as unknown as typeof fetch
    const res = await route(req('POST', '/api/skills/registry/aud-bad-index/import'), PORT)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({
      error: 'Failed to fetch skill from registry: registry index has an unexpected shape',
    })
  })

  it('reports index network failure without writing', async () => {
    globalThis.fetch = (async () => {
      throw new Error('network unavailable')
    }) as unknown as typeof fetch
    const res = await route(req('POST', '/api/skills/registry/aud-network/import'), PORT)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({
      error: 'Failed to fetch skill from registry: network unavailable',
    })
    expect(existsSync(getSkillPath('aud-network', projectRoot))).toBe(false)
  })

  it('returns projected skills from direct and normalized imports and the curator', async () => {
    const draft = { ...VALID_SKILL, extra: 1 }
    const direct = await route(
      req('POST', '/api/skills/import', { type: 'yaml', yaml: stringify(draft) }),
      PORT,
    )
    expect(direct.status).toBe(200)
    expect((await direct.json()).skill).toEqual(VALID_SKILL)
    for (const path of ['/api/skills/import', '/api/skills/curate']) {
      mockChat.mockImplementationOnce(async () => ({
        text: JSON.stringify(draft),
        inputTokens: 0,
        outputTokens: 0,
        model: 'mock',
      }))
      const res = await route(
        req(
          'POST',
          path,
          path.endsWith('import')
            ? { type: 'yaml', yaml: 'id: incomplete' }
            : { text: 'test skill' },
        ),
        PORT,
      )
      expect(res.status).toBe(200)
      expect((await res.json()).skill).toEqual(VALID_SKILL)
    }
  })
})
