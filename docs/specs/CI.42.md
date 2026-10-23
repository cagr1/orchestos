# CI.42 — Mutation Shards vuelve a caber en su tiempo

## Problema (medido)
- Run `39921431428` (sha d734166, schedule 2026-10-23): `executors` y `executors-codex` superaron
  `timeout-minutes: 180` (`.github/workflows/mutation-nightly.yml:15`); los otros dos shards tardaron ~3x lo del día anterior
  (run `39744478762`, sha d9d71e5).
- Stryker "Initial test run": context-routing 7 s → 27 s; runtime-boundaries 10 s → 28 s.
- `scripts/mutation-test-shard.ts` elige los tests de `src/__tests__` cuyo grafo de imports relativos alcanza un archivo
  mutado. Desde el registro `src/run/executors/task-engines.ts` (importa todos los motores), la selección creció:
  context-routing 52→62, executors 54→67, executors-codex 63, runtime-boundaries 65 (HEAD). Entraron, entre otros,
  `tasks-concurrency.test.ts` (10,8 s local) y `commit-tasks-yaml.test.ts` (1,6 s). `run-revert.test.ts` tarda 8,7 s
  (TRUST.7, posterior a la corrida: HEAD probablemente es peor).
- Con `coverageAnalysis: 'off'` cada mutante sobreviviente corre la selección completa → tiempo ≈ mutantes × suite.

## Objetivo
Los 4 shards terminan holgados dentro de su límite en CI, sin bajar el poder de detección real (un test que de verdad
ejecuta código mutado debe seguir corriendo contra ese mutante).

## Qué decidir y hacer (criterio del ejecutor, con evidencia)
1. Medir en HEAD la selección y la duración de la prueba inicial de cada shard (comando del shard, no `bun test` suelto).
2. Corregir la sobre-aproximación de la selección donde sea incorrecta. Candidatos a verificar, no a asumir:
   imports `import type` / `export type … from` (no son aristas en runtime; el regex actual los cuenta), y otros
   bordes que no ejecutan código mutado. Si un test entra legítimamente, se queda.
3. Si tras (2) algún shard sigue sin margen (estimar con mutantes × prueba inicial y con los tiempos del run
   `39744478762`), elegir entre: ordenar la selección para que `--bail` mate antes (tests más directos primero),
   partir el shard en dos configs, o acelerar el test lento sin cambiar lo que verifica. Justificar la elección con números.
4. Tests de `scripts/mutation-test-shard.ts` que cubran lo cambiado (hay tests existentes: `rg mutation-test-shard src`).

## Qué no tocar
- `timeout-minutes` no sube como solución (solo si además hay otro arreglo y se justifica).
- No quitar archivos de `mutate` ni bajar umbrales de mutación.
- `PLAN.md`, `NEXT.md`: no.

## Cómo se verifica
- `bun run typecheck`, `bun run lint`, `bun run test:coverage` verdes.
- Tabla en el reporte: por shard, archivos seleccionados y segundos de la prueba inicial, antes (HEAD) y después.
- El cerebro lanza `gh workflow run "Mutation Shards"` tras el push y mira los tiempos reales.
