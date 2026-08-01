import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export interface CoverageSummary {
  functionsFound: number
  functionsHit: number
  linesFound: number
  linesHit: number
  functionsPercent: number
  linesPercent: number
}

function ratio(hit: number, found: number): number {
  return found === 0 ? 1 : hit / found
}

export function parseLcovSummary(lcov: string): CoverageSummary {
  let functionsFound = 0
  let functionsHit = 0
  let linesFound = 0
  let linesHit = 0

  for (const line of lcov.split('\n')) {
    if (line.startsWith('FNF:')) functionsFound += Number(line.slice(4))
    else if (line.startsWith('FNH:')) functionsHit += Number(line.slice(4))
    else if (line.startsWith('LF:')) linesFound += Number(line.slice(3))
    else if (line.startsWith('LH:')) linesHit += Number(line.slice(3))
  }

  return {
    functionsFound,
    functionsHit,
    linesFound,
    linesHit,
    functionsPercent: ratio(functionsHit, functionsFound) * 100,
    linesPercent: ratio(linesHit, linesFound) * 100,
  }
}

/**
 * Trinquete de cobertura: nunca retroceder por debajo de donde YA estamos.
 * Cada umbral se calibra contra la medición real, redondeada hacia abajo — un
 * trinquete puesto por encima del valor actual no es un trinquete, es un CI
 * permanentemente rojo. Ese fue el bug: cddbc14 (2026-07-29) aplicó 69% a ambas
 * métricas sin medir líneas, que estaban en 60% — el gate nunca pasó ni una vez
 * y bloqueó todos los pushes hasta el 2026-08-01.
 *
 * Estos números SOLO SUBEN. Al subirlos, medir primero con `bun run test:coverage`.
 */
export const THRESHOLDS = {
  /** medido: 74.08% (2026-08-01) */
  functions: 0.69,
  /** medido: 60.40% (2026-08-01) — deuda conocida, subir a medida que crezca */
  lines: 0.60,
} as const

function runCoverageGate(): void {
  const coverageDir = mkdtempSync(join(tmpdir(), 'orchestos-coverage-'))

  try {
    const result = Bun.spawnSync([
      'bun', 'test', '--coverage', '--coverage-reporter=lcov', '--coverage-dir', coverageDir,
    ])
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode
      return
    }

    const lcov = readFileSync(join(coverageDir, 'lcov.info'), 'utf8')
    const summary = parseLcovSummary(lcov)
    const functionsOk = summary.functionsPercent / 100 >= THRESHOLDS.functions
    const linesOk = summary.linesPercent / 100 >= THRESHOLDS.lines

    console.log(`coverage gate: functions ${summary.functionsPercent.toFixed(2)}% (required ${(THRESHOLDS.functions * 100).toFixed(2)}%)`)
    console.log(`coverage gate: lines ${summary.linesPercent.toFixed(2)}% (required ${(THRESHOLDS.lines * 100).toFixed(2)}%)`)

    if (!functionsOk || !linesOk) {
      console.error('coverage gate failed: aggregate coverage is below the ratchet')
      process.exitCode = 1
    }
  } finally {
    rmSync(coverageDir, { recursive: true, force: true })
  }
}

if (import.meta.main) runCoverageGate()
