/**
 * v0.12 D.1.b — tests unitarios puros de `scaffoldConstitutionMd()` + `parseConstitution()`
 * (sin fs, sin red). Cubre: el scaffold contiene las 3 secciones esperadas con al menos
 * un ejemplo por sección, y se puede re-parsear con `parseConstitution` para producir
 * un Constitution con `ruleCount > 0`. Sin esto, un cambio accidental al scaffold
 * (ej. typo en un heading) rompería el `constitution init` del CLI Y la pre-carga
 * del dashboard — D.1.b agrega la pre-carga exactamente al mismo string, así que
 * ambos caminos deben seguir cuadrados por test determinista, no por inspección
 * visual.
 */
import { describe, it, expect } from 'bun:test'
import { scaffoldConstitutionMd, parseConstitution } from '../constitution.ts'

describe('scaffoldConstitutionMd (v0.12 D.1.b)', () => {
  const md = scaffoldConstitutionMd()

  it('returns a non-empty string', () => {
    expect(typeof md).toBe('string')
    expect(md.length).toBeGreaterThan(0)
  })

  it('contains the ALLOWED section heading', () => {
    expect(md).toMatch(/^##\s+ALLOWED$/m)
  })

  it('contains the FORBIDDEN section heading', () => {
    expect(md).toMatch(/^##\s+FORBIDDEN$/m)
  })

  it('contains the REQUIRE_CONFIRMATION section heading', () => {
    expect(md).toMatch(/^##\s+REQUIRE_CONFIRMATION$/m)
  })

  it('has at least one bullet per section (ruleCount > 0)', () => {
    const c = parseConstitution(md)
    expect(c.allowed.length).toBeGreaterThan(0)
    expect(c.forbidden.length).toBeGreaterThan(0)
    expect(c.require_confirmation.length).toBeGreaterThan(0)
    expect(c.ruleCount).toBe(c.allowed.length + c.forbidden.length + c.require_confirmation.length)
    expect(c.ruleCount).toBeGreaterThanOrEqual(3)
  })
})
