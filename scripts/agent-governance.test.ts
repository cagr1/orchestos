import { describe, expect, test } from 'bun:test'
import { findOpenPlanItem, hasLiveGateEvidence, requiresLiveGate } from './agent-governance.ts'

describe('agent governance', () => {
  test('solo acepta un item abierto exacto', () => {
    const plan = '- [ ] **GOV.1 — 🧠 Regla**\n- [x] **GOV.2 — cerrado**\n'
    expect(findOpenPlanItem(plan, 'GOV.1')).not.toBeNull()
    expect(findOpenPlanItem(plan, 'GOV.2')).toBeNull()
    expect(findOpenPlanItem(plan, 'GOV')).toBeNull()
  })

  test('detecta superficies de dashboard y configuracion', () => {
    expect(requiresLiveGate(['src/dashboard/public/app.js'])).toBe(true)
    expect(requiresLiveGate(['src/dashboard/handlers/config.ts'])).toBe(true)
    expect(requiresLiveGate(['src/run/harness.ts'])).toBe(false)
  })

  test('exige cierre y evidencia de navegador en el diff de PLAN', () => {
    expect(
      hasLiveGateEvidence('+ - [x] **A.1 — UI**\n+  Gate en vivo: Playwright confirmó el flujo.'),
    ).toBe(true)
    expect(hasLiveGateEvidence('+ - [x] **A.1 — UI**\n+  Tests unitarios verdes.')).toBe(false)
    expect(hasLiveGateEvidence('+ Gate en vivo: navegador real.')).toBe(false)
  })
})
