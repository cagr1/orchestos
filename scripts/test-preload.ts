/**
 * Preload de `bun test` — garantiza el esquema de la DB antes del primer test.
 *
 * POR QUÉ EXISTE (incidente Mutation Shards, rojo desde el 2026-08-27 hasta el 2026-08-31):
 * `src/db/sqlite.ts` congela `ORCHESTOS_HOME` en el momento de su primer import (es un `const`
 * a nivel de módulo), pero NADIE corría `runMigrations()` en el camino de test: solo lo hace
 * `cli.ts` en top-level, y un puñado de archivos de test que lo llaman por su cuenta.
 *
 * O sea que un test que usa la DB pasaba únicamente si:
 *   a) la DB del host ya tenía las tablas —el caso del Mac de Carlos, que usa el dashboard a
 *      diario y por eso NUNCA vio el fallo—, o
 *   b) otro archivo que sí llama `runMigrations()` corría antes en el mismo proceso.
 *
 * (b) depende del ORDEN de los archivos, y el orden depende del conjunto que se ejecuta:
 *   · `bun run test:coverage` → `bun test` (repo entero, incluye `src/dashboard/__tests__`) ✅
 *   · Stryker               → `bun test src/__tests__` (subconjunto)                        ❌
 * Con el subconjunto, `engine-selection.test.ts` llegaba a la DB antes que cualquier archivo
 * que migra, y reventaba con `SQLiteError: no such table: runs`. Stryker interpreta eso como
 * "failed tests in the initial test run" y aborta los 4 shards — de ahí que el tablero dijera
 * "All jobs have failed" en ~35s sin haber mutado una sola línea.
 *
 * Es el mismo patrón de fondo que `reference-ci-host-environment-drift`: el test no afirmaba
 * sobre su propio estado sino sobre el del host. Se arregla en la infraestructura, una vez, en
 * vez de repartir `runMigrations()` por cada archivo que toque la DB — eso volvería a depender
 * de que alguien se acuerde de agregarlo.
 *
 * `runMigrations()` es idempotente (`CREATE TABLE IF NOT EXISTS` + ledger de versión), así que
 * los archivos que ya lo llaman siguen funcionando sin cambios.
 */
import { runMigrations } from '../src/db/migrate.ts'

runMigrations()
