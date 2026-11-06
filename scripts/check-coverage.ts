import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

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
 * El umbral lleva MARGEN deliberado (~2-3 puntos) porque la cobertura no es
 * idéntica entre entornos: partes del código hacen spawn de binarios del host
 * (cargo, tsc, CLIs externas), y en una máquina donde ese binario existe se
 * ejecutan ramas que en otra no. Medido el 2026-08-01: Mac 74.08%/60.42%,
 * ubuntu-latest 72.98%/59.71%. Un trinquete calibrado al filo del valor local
 * vuelve a poner el CI rojo al primer punto decimal de diferencia — pasó
 * exactamente eso al primer intento de este fix.
 *
 * Calibrar SIEMPRE contra el número de CI (el más bajo), nunca contra el local.
 * Estos números SOLO SUBEN. Antes de subirlos, mirar el log de un run real.
 */
export const THRESHOLDS = {
  /** CI 2026-08-01: 72.98% */
  functions: 0.69,
  /** CI 2026-08-01: 59.71% — deuda conocida, subir a medida que crezca */
  lines: 0.57,
} as const

function runCoverageGate(): void {
  const coverageDir = mkdtempSync(join(tmpdir(), 'orchestos-coverage-'))

  try {
    const result = Bun.spawnSync([
      'bun',
      'test',
      '--coverage',
      '--coverage-reporter=lcov',
      '--coverage-dir',
      coverageDir,
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

    console.log(
      `coverage gate: functions ${summary.functionsPercent.toFixed(2)}% (required ${(THRESHOLDS.functions * 100).toFixed(2)}%)`,
    )
    console.log(
      `coverage gate: lines ${summary.linesPercent.toFixed(2)}% (required ${(THRESHOLDS.lines * 100).toFixed(2)}%)`,
    )

    if (!functionsOk || !linesOk) {
      console.error('coverage gate failed: aggregate coverage is below the ratchet')
      process.exitCode = 1
    }
  } finally {
    rmSync(coverageDir, { recursive: true, force: true })
  }
}

if (import.meta.main) runCoverageGate()
