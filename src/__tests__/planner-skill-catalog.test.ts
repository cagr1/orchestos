import { describe, expect, test } from 'bun:test'
import { createPlan } from '../agents/planner.ts'
import { pickAutoSkill } from '../dashboard/handlers/chat.ts'
import { isKnownSkillId, listAllSkillCandidates, renderSkillCatalog } from '../skills/catalog.ts'

// O.2 (Bloque O, 2026-08-03) — el planner ve el catálogo y asigna skill por
// sub-tarea, y la ambigüedad del camino automático se resuelve por
// `activation.mode` en vez de descartando.

describe('catálogo compartido (skills/catalog.ts)', () => {
  test('lista las skills reales con su metadata de disparo', () => {
    const all = listAllSkillCandidates()
    expect(all.length).toBeGreaterThan(0)
    const sec = all.find((s) => s.id === 'security-review')
    expect(sec?.whenToUse.length).toBeGreaterThan(0)
    expect(sec?.mode).toBe('automatic')
  })

  test('renderSkillCatalog es SOLO metadata — nunca el cuerpo de la skill', () => {
    const out = renderSkillCatalog()
    expect(out).toContain('security-review')
    expect(out).toContain('Use when')
    // El cuerpo (instructions) no debe filtrarse al prompt del planner.
    expect(out).not.toContain('OWASP Top 10 vulnerabilities')
    expect(out).not.toContain('Iron law')
  })

  test('isKnownSkillId distingue reales de inventados', () => {
    expect(isKnownSkillId('security-review')).toBe(true)
    expect(isKnownSkillId('no-existe-esta-skill')).toBe(false)
  })
})

describe('planner — skill por sub-tarea', () => {
  const planYaml = (skill: string) => `
version: 1
parent_task_id: parent
sub_tasks:
  - id: build-ui
    description: Build the screen
    acceptance: [renders]
    depends_on: []
    allowed_tools: [read, write]
    output: [ui.tsx]
    skill: ${skill}
`

  test('acepta un skill id real en una sub-tarea', () => {
    const [st] = createPlan(planYaml('frontend-design'))
    expect(st!.skill).toBe('frontend-design')
  })

  test('descarta un skill inventado en vez de romper el plan', () => {
    const [st] = createPlan(planYaml('skill-que-no-existe'))
    expect(st!.skill).toBeUndefined()
    expect(st!.id).toBe('build-ui') // el resto del plan sobrevive intacto
  })

  test('sub-tareas distintas pueden llevar skills distintas', () => {
    const plan = createPlan(`
version: 1
parent_task_id: parent
sub_tasks:
  - id: build-ui
    description: Build the screen
    acceptance: [renders]
    depends_on: []
    allowed_tools: [read, write]
    output: [ui.tsx]
    skill: frontend-design
  - id: add-tests
    description: Cover it with tests
    acceptance: [tests pass]
    depends_on: [build-ui]
    allowed_tools: [read, write]
    output: [ui.test.tsx]
    skill: test-writer
`)
    expect(plan.map((s) => s.skill)).toEqual(['frontend-design', 'test-writer'])
  })
})

describe('pickAutoSkill — la ambigüedad ya no descarta todo', () => {
  test('REGRESIÓN O.2: con 2+ candidatas y ninguna frontend-design ya NO devuelve undefined', () => {
    // Antes: security-review + test-writer → undefined → tarea sin skill.
    // Ahora: security-review declara activation.mode=automatic y gana.
    const picked = pickAutoSkill([{ id: 'test-writer' }, { id: 'security-review' }])
    expect(picked).toBe('security-review')
  })

  test('una automatic gana incluso sobre frontend-design', () => {
    expect(pickAutoSkill([{ id: 'frontend-design' }, { id: 'qa-structured' }])).toBe(
      'qa-structured',
    )
  })

  test('sin ninguna automatic, se conserva el desempate histórico de frontend-design', () => {
    expect(pickAutoSkill([{ id: 'frontend-design' }, { id: 'test-writer' }])).toBe(
      'frontend-design',
    )
  })

  test('candidata única se sigue usando', () => {
    expect(pickAutoSkill([{ id: 'test-writer' }])).toBe('test-writer')
  })

  test('sin candidatas no inventa nada', () => {
    expect(pickAutoSkill([])).toBeUndefined()
  })

  test('varias sin activation ni frontend-design sigue sin asignar (no adivina)', () => {
    expect(pickAutoSkill([{ id: 'test-writer' }, { id: 'improve-architecture' }])).toBeUndefined()
  })
})
