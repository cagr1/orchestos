import { describe, expect, test } from 'bun:test'
import { loadSkill, resolveSkillPath, listSkillFiles } from '../skills/registry.ts'
import type { SkillDef } from '../skills/registry.ts'
import { compileClaude } from '../skills/targets/claude.ts'
import { compileCursor } from '../skills/targets/cursor.ts'
import { compileOpenAI } from '../skills/targets/openai.ts'

// N.6 (Mes 25, 2026-08-02) — gate contra el PROMPT REAL COMPILADO, no contra
// el YAML. Usa skills reales del repo (no fixtures), a través de los 3
// compiladores de target reales (claude.ts/cursor.ts/openai.ts), el mismo
// camino que expone /api/skills/:id/build en el dashboard de N.4.

describe('N.6 — iron_law antes de instructions en los 3 targets (skill real endurecida)', () => {
  const skill = loadSkill(resolveSkillPath('security-review'))

  test('claude target', () => {
    const out = compileClaude(skill)
    const ironIdx = out.indexOf('## Iron law')
    const instrIdx = out.indexOf(skill.instructions.slice(0, 40))
    expect(ironIdx).toBeGreaterThanOrEqual(0)
    expect(instrIdx).toBeGreaterThan(ironIdx)
  })

  test('cursor target', () => {
    const out = compileCursor(skill)
    const ironIdx = out.indexOf('## Iron law')
    const instrIdx = out.indexOf(skill.instructions.slice(0, 40))
    expect(ironIdx).toBeGreaterThanOrEqual(0)
    expect(instrIdx).toBeGreaterThan(ironIdx)
  })

  test('openai target', () => {
    const out = compileOpenAI(skill)
    const parsed = JSON.parse(out)
    const description: string = parsed.function.description
    const ironIdx = description.indexOf('## Iron law')
    const instrIdx = description.indexOf(skill.instructions.slice(0, 40))
    expect(ironIdx).toBeGreaterThanOrEqual(0)
    expect(instrIdx).toBeGreaterThan(ironIdx)
  })
})

// La skill sin endurecer se elige DINÁMICAMENTE, no por id fijo. Antes estaba
// hardcodeada a `diagnose` y N.7b la endureció (2026-08-03) → 4 tests en rojo
// por un fixture obsoleto, no por una regresión real. Cada avance de N.7b
// habría vuelto a romperlo. Si algún día TODAS están endurecidas, cae a una
// SkillDef sintética: la propiedad que se verifica es del renderer, no de una
// skill concreta.
function pickUnhardenedSkill(): SkillDef {
  for (const f of listSkillFiles()) {
    try {
      const s = loadSkill(f)
      if (!s.iron_law && !s.common_rationalizations && !s.red_flags) return s
    } catch {}
  }
  return {
    id: 'synthetic-unhardened', version: '1.0.0', name: 'Synthetic Unhardened',
    description: 'Fallback fixture when every real skill has been hardened',
    instructions: 'Do the thing without any hardening fields present.',
    targets: ['claude', 'cursor', 'openai'],
  }
}

describe('N.6 — cero regresión en skill real sin los campos nuevos', () => {
  const skill = pickUnhardenedSkill()

  test('la skill elegida efectivamente no tiene campos de endurecimiento', () => {
    expect(skill.iron_law).toBeUndefined()
    expect(skill.common_rationalizations).toBeUndefined()
    expect(skill.red_flags).toBeUndefined()
  })

  test('claude target has no hardening sections, instructions still lead', () => {
    const out = compileClaude(skill)
    expect(out).not.toContain('## Iron law')
    expect(out).not.toContain('## Common rationalizations')
    expect(out).not.toContain('## Red flags')
    expect(out.indexOf(skill.instructions.slice(0, 40))).toBeGreaterThanOrEqual(0)
  })

  test('cursor target has no hardening sections', () => {
    const out = compileCursor(skill)
    expect(out).not.toContain('## Iron law')
    expect(out).not.toContain('## Common rationalizations')
    expect(out).not.toContain('## Red flags')
  })

  test('openai target has no hardening sections', () => {
    const out = compileOpenAI(skill)
    const parsed = JSON.parse(out)
    const description: string = parsed.function.description
    expect(description).not.toContain('## Iron law')
    expect(description).not.toContain('## Common rationalizations')
    expect(description).not.toContain('## Red flags')
  })
})
