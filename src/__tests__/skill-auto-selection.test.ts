import { describe, it, expect, afterEach } from 'bun:test'
import { handleApiNatural, listAllSkillCandidates } from '../dashboard/handlers/project.ts'
import { isKnownSkillId } from '../dashboard/handlers/tasks.ts'

// Bloque D (Mes 18, ex-IDEAS #21) — el motor de auto-selección de skill nunca
// confía en un id que el LLM invente; solo ids que existen de verdad en
// skills/ o skills/pro/ sobreviven al filtro. Ver docs/semantic-skill-selection-design.md.

const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
})

function openRouterResponse(content: string) {
  return new Response(JSON.stringify({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 5, completion_tokens: 3 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

describe('listAllSkillCandidates', () => {
  it('lists real installed skills, including frontend-design', () => {
    const skills = listAllSkillCandidates()
    const ids = skills.map(s => s.id)
    expect(ids).toContain('frontend-design')
    expect(ids).toContain('tdd-enforcer')
  })
})

describe('isKnownSkillId', () => {
  it('returns true for a real installed skill', () => {
    expect(isKnownSkillId('frontend-design')).toBe(true)
  })

  it('returns false for an invented id', () => {
    expect(isKnownSkillId('totally-invented-skill-xyz')).toBe(false)
  })
})

describe('handleApiNatural — skill_candidates fail-safe', () => {
  it('discards an invented skill id the LLM hallucinates, keeps real ones', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    globalThis.fetch = (async () => openRouterResponse(JSON.stringify({
      id: 'landing-page',
      description: 'Build a commercial landing page',
      output: ['index.html'],
      executor: 'openrouter',
      skill_candidates: ['frontend-design', 'this-skill-does-not-exist'],
    }))) as unknown as typeof fetch

    const req = new Request('http://localhost/api/natural', {
      method: 'POST',
      body: JSON.stringify({ input: 'build a landing page' }),
    })
    const res = await handleApiNatural(req)
    const data = await res.json() as { skillCandidates: string[]; skillOptions: { id: string }[] }
    expect(data.skillCandidates).toEqual(['frontend-design'])
    expect(data.skillOptions.map(o => o.id)).toEqual(['frontend-design'])
  })

  it('returns an empty skill list when the LLM finds nothing that fits', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    globalThis.fetch = (async () => openRouterResponse(JSON.stringify({
      id: 'fix-backend-bug',
      description: 'Fix a null pointer in the auth middleware',
      output: ['src/auth.ts'],
      executor: 'openrouter',
      skill_candidates: [],
    }))) as unknown as typeof fetch

    const req = new Request('http://localhost/api/natural', {
      method: 'POST',
      body: JSON.stringify({ input: 'fix a bug in auth middleware' }),
    })
    const res = await handleApiNatural(req)
    const data = await res.json() as { skillCandidates: string[]; skillOptions: unknown[] }
    expect(data.skillCandidates).toEqual([])
    expect(data.skillOptions).toEqual([])
  })
})
