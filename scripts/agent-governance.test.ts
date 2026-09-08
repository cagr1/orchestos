import { describe, expect, test } from 'bun:test'
import {
  citedEvidenceFiles,
  findOpenPlanItem,
  hasLiveGateEvidence,
  requiresLiveGate,
  requiresUiCopyBudget,
} from './agent-governance.ts'

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

  test('detecta cambios que requieren el presupuesto de copy compacto', () => {
    expect(requiresUiCopyBudget(['src/dashboard/public/i18n.js'])).toBe(true)
    expect(requiresUiCopyBudget(['src/dashboard/public/app.js'])).toBe(false)
  })

  test('extrae rutas citadas entre backticks en líneas agregadas', () => {
    expect(
      citedEvidenceFiles('+ Gate en vivo: ver `scripts/live-a1-review.ts` y `scripts/evidence.json`.'),
    ).toEqual(['scripts/live-a1-review.ts', 'scripts/evidence.json'])
    expect(citedEvidenceFiles('- Gate en vivo: ver `scripts/removed.ts`.')).toEqual([])
    expect(citedEvidenceFiles('+ Sin backticks acá, `nota.txt` no cuenta (ext no permitida).')).toEqual(
      [],
    )
  })

  // H.10.1 (2026-09-08) — incidente R.5: la frase sola pasaba este gate aunque el
  // hecho declarado (dos procesos concurrentes) nunca hubiera corrido. Desde acá,
  // la frase exige además un archivo citado que esté REALMENTE en el commit.
  test('exige cierre + frase + archivo de evidencia citado Y presente en el commit', () => {
    const diffConArchivo =
      '+ - [x] **A.1 — UI**\n' +
      '+  Gate en vivo: `scripts/live-a1-review.ts` + `scripts/a1-evidence.json` confirman Playwright.'
    expect(hasLiveGateEvidence(diffConArchivo, ['scripts/live-a1-review.ts', 'scripts/a1-evidence.json']))
      .toBe(true)

    // Regresión exacta del incidente: cierre + frase con "navegador", SIN ningún
    // archivo citado — lo que de hecho commiteó R.5 y el gate viejo aceptaba.
    const diffSoloFrase = '+ - [x] **A.1 — UI**\n+  Gate en vivo: navegador real confirmó el flujo.'
    expect(hasLiveGateEvidence(diffSoloFrase, ['scripts/otro-archivo.ts'])).toBe(false)

    // Cita un archivo, pero ese archivo no forma parte de este commit (stagedPaths
    // no lo incluye) — citar no es lo mismo que aportar.
    const diffCitaSinStagear = diffConArchivo
    expect(hasLiveGateEvidence(diffCitaSinStagear, [])).toBe(false)

    expect(hasLiveGateEvidence('+ - [x] **A.1 — UI**\n+  Tests unitarios verdes.', [])).toBe(false)
    expect(hasLiveGateEvidence('+ Gate en vivo: navegador real.', [])).toBe(false)
  })
})
