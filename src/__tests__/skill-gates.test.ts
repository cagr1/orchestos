import { describe, expect, test } from 'bun:test'
import { resolveGates } from '../skills/catalog.ts'
import { runQA } from '../run/qa.ts'
import type { ProviderClient } from '../providers/index.ts'

// O.3 (Bloque O, 2026-08-05) — gates transversales (security-review,
// qa-structured) resueltos por activation.mode/phases/triggers, nunca por el
// mismo LLM que hizo el trabajo. Ver PLAN.md § Bloque O.

describe('resolveGates', () => {
  test('qa-structured aplica siempre en fase review — sin triggers', () => {
    const gates = resolveGates('cualquier descripción sin nada especial', 'review')
    const qaStructured = gates.find(g => g.skill.id === 'qa-structured')
    expect(qaStructured).toBeDefined()
    expect(qaStructured?.candidate).toBe(true)
    expect(qaStructured?.applied).toBe(true)
  })

  test('security-review requiere que un trigger coincida con el texto de la tarea', () => {
    const noMatch = resolveGates('agrega un botón que cambia de color', 'review')
    const secNoMatch = noMatch.find(g => g.skill.id === 'security-review')
    expect(secNoMatch?.candidate).toBe(true)
    expect(secNoMatch?.applied).toBe(false)

    const match = resolveGates('add a new authentication endpoint', 'review')
    const secMatch = match.find(g => g.skill.id === 'security-review')
    expect(secMatch?.applied).toBe(true)
    expect(secMatch?.reason).toContain('authentication')
  })

  test('trigger con guión bajo matchea también con espacio en el texto', () => {
    const gates = resolveGates('el formulario recibe user input sin validar', 'review')
    const sec = gates.find(g => g.skill.id === 'security-review')
    expect(sec?.applied).toBe(true)
  })

  test('ninguna gate aplica fuera de la fase review', () => {
    const gates = resolveGates('agrega un endpoint de autenticación nuevo', 'implement')
    expect(gates.find(g => g.skill.id === 'security-review')).toBeUndefined()
    expect(gates.find(g => g.skill.id === 'qa-structured')).toBeUndefined()
  })

  test('skills sin activation.mode: automatic nunca son candidatas', () => {
    const gates = resolveGates('cualquier tarea', 'review')
    // frontend-design no declara activation: automatic (es sugerible, no gate).
    expect(gates.find(g => g.skill.id === 'frontend-design')).toBeUndefined()
  })
})

function capturingProvider(text: string): { provider: ProviderClient; systems: string[] } {
  const systems: string[] = []
  return {
    systems,
    provider: {
      name: 'test',
      chat: async opts => {
        systems.push(opts.system)
        return { text, inputTokens: 1, outputTokens: 1, model: 'test-model' }
      },
    },
  }
}

describe('runQA — inyección de gates en el prompt', () => {
  test('security-review aplicada inyecta su checklist OWASP en el system prompt', async () => {
    const gates = resolveGates('add a new authentication endpoint', 'review')
    const applied = gates.filter(g => g.applied).map(g => g.skill)
    const { provider, systems } = capturingProvider('{"verdict":"pass","reason":"ok"}')

    await runQA({
      description: 'add a new authentication endpoint',
      output: ['src/api/login.ts'],
      written: [{ path: 'src/api/login.ts', content: 'export const login = () => {}' }],
      model: 'test-model',
      checksResults: [],
      provider,
      gateSkills: applied,
    })

    expect(systems[0]).toContain('GATE: Security Review')
    expect(systems[0]).toContain('OWASP')
    expect(systems[0]).toContain('was NOT chosen by you')
  })

  test('qa-structured NO se duplica en el prompt aunque esté en gateSkills — su contenido ya es el branch hasCriteria', async () => {
    const gates = resolveGates('tarea cualquiera', 'review')
    const applied = gates.filter(g => g.applied).map(g => g.skill)
    const { provider, systems } = capturingProvider('{"verdict":"pass","reason":"ok"}')

    await runQA({
      description: 'tarea cualquiera',
      output: ['out.txt'],
      written: [{ path: 'out.txt', content: 'contenido' }],
      model: 'test-model',
      checksResults: [],
      provider,
      gateSkills: applied,
    })

    expect(systems[0]).not.toContain('GATE: Structured QA Review')
  })

  test('sin gates aplicados, el prompt no lleva sección GATE', async () => {
    const { provider, systems } = capturingProvider('{"verdict":"pass","reason":"ok"}')

    await runQA({
      description: 'tarea sin triggers de seguridad',
      output: ['out.txt'],
      written: [{ path: 'out.txt', content: 'contenido' }],
      model: 'test-model',
      checksResults: [],
      provider,
      gateSkills: [],
    })

    expect(systems[0]).not.toContain('## GATE:')
  })
})
