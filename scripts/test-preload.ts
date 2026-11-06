/**
 * Preload de `bun test`. Hace dos cosas, en este orden estricto:
 *   1. Aísla la DB de la suite en un home temporal propio.
 *   2. Garantiza el esquema antes del primer test.
 *
 * ── 1. AISLAMIENTO (2026-09-11) ────────────────────────────────────────────
 * Sin esto, `bun test` escribe en la MISMA `~/.orchestos/db.sqlite` que lee el
 * dashboard real: cualquier test que inserta filas sin limpiarlas en `afterAll`
 * las deja ahí para siempre, visibles en la UI de Carlos. Medido el 2026-09-11:
 * una corrida completa genera 262KB de DB.
 *
 * Es un patrón RECURRENTE, no un bug cerrado. Se "resolvió" en IDEAS.md #20
 * (2026-07-05, 8 archivos, 1800 filas purgadas) mirando solo la tabla `runs`, y
 * volvió en Mes 18/I.6 sobre `memory_entries` — el síntoma fue que las memory
 * cards del dashboard mostraban "Alpha"/"topic-a"/"Entry A content" y CERO
 * entradas reales. Auditar test por test no es garantía: cada tabla nueva es un
 * candidato nuevo a la misma fuga, y depende de que alguien se acuerde.
 *
 * El aislamiento se arregla UNA VEZ en la infraestructura, como el problema de
 * migraciones de abajo. El mecanismo ya existía (`ORCHESTOS_HOME`, honrado por
 * `src/db/sqlite.ts`, `settings-store.ts`, `router/model-catalog.ts`); lo único
 * que faltaba era que la suite lo usara.
 *
 * Un `ORCHESTOS_HOME` ya presente NO se pisa: `gate:evidence` y
 * `run-evidence-gate.ts` declaran el suyo a propósito y deben mandar ellos.
 *
 * El home lleva el PID porque Stryker corre 4 shards en procesos paralelos
 * sobre la misma máquina; compartir un único directorio los haría pelear por el
 * lock de SQLite.
 *
 * ── 2. MIGRACIONES ─────────────────────────────────────────────────────────
 * (incidente Mutation Shards, rojo del 2026-08-27 al 2026-08-31)
 * `src/db/sqlite.ts` congela `ORCHESTOS_HOME` en su primer import (es un `const`
 * de módulo), pero NADIE corría `runMigrations()` en el camino de test: solo lo
 * hace `cli.ts` en top-level y un puñado de archivos sueltos.
 *
 * O sea que un test que usa la DB pasaba únicamente si:
 *   a) la DB del host ya tenía las tablas —el caso del Mac de Carlos, que usa el
 *      dashboard a diario y por eso NUNCA vio el fallo—, o
 *   b) otro archivo que sí llama `runMigrations()` corría antes en el proceso.
 * (b) depende del ORDEN de archivos, y el orden depende del conjunto ejecutado:
 *   · `bun run test:coverage` → repo entero ✅
 *   · Stryker → `bun test src/__tests__` (subconjunto) ❌ `no such table: runs`
 * Stryker lee eso como "failed tests in the initial test run" y aborta los 4
 * shards en ~35s sin mutar una línea.
 *
 * Mismo patrón de fondo que `reference-ci-host-environment-drift`: el test no
 * afirmaba sobre su propio estado sino sobre el del host.
 *
 * El import de `runMigrations` es DINÁMICO a propósito: un `import` estático se
 * hoistea por encima de la asignación de env, `sqlite.ts` congelaría el home
 * real y el aislamiento no serviría de nada.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

if (!process.env.ORCHESTOS_HOME) {
  const home = mkdtempSync(join(tmpdir(), `orchestos-test-home-${process.pid}-`))
  process.env.ORCHESTOS_HOME = home
  process.on('exit', () => {
    try {
      rmSync(home, { recursive: true, force: true })
    } catch {
      /* el SO limpia tmp igual; no romper la corrida por esto */
    }
  })
}

const { runMigrations } = await import('../src/db/migrate.ts')
runMigrations()
