# CI.14 — GitHub Actions deja de fallar por la misma clase de bug

Ítem: `PLAN.md` § CI.14. Tres partes independientes; hacerlas en orden A → B → C.

## A. Mutation: cada shard corre solo sus tests

Hoy los cuatro `stryker.run-*.config.mjs` usan `command: 'bun test src/__tests__ --timeout 30000'`: cada mutante corre
la suite entera (1,108 tests, ~21 s en CI). Con 2,227 mutantes en `executors`, el shard no cabe en 180 min.

1. Nuevo `scripts/mutation-test-shard.ts <stryker-config>`:
   - Importa el config y lee su `mutate` (globs, p. ej. `src/run/executors/**/*.ts`). Expande con `Bun.Glob` desde cwd.
   - Recorre `src/__tests__/**/*.test.ts` y, por cada test, su clausura transitiva de imports **relativos**
     (`import … from '…'`, `export … from '…'`, `import('…')` con literal; resolver `.ts`, `.tsx`, `/index.ts`; ignorar
     paquetes). Selecciona el test si la clausura incluye algún archivo mutado.
   - Si la selección queda vacía: mensaje a stderr y `exit 1` (nunca pasar en vacío).
   - Imprime a stderr `mutation-test-shard: N/M test files` y ejecuta `bun test <archivos> --timeout 30000` heredando
     stdio; sale con el código de `bun test`.
   - Exportar la función de selección (pura, recibe raíz + lista de mutados) para testearla.
2. Los cuatro `stryker.run-*.config.mjs`: `command: 'bun run scripts/mutation-test-shard.ts stryker.run-<shard>.config.mjs'`.
   No tocar los otros `stryker.*.config.mjs`.
3. Test `scripts/mutation-test-shard.test.ts` con un fixture temporal (3-4 archivos): test que importa directo, test que
   importa transitivo, test que no alcanza → solo los dos primeros; selección vacía detectable.
4. Verificar y reportar: por cada shard, N/M y tiempo de `bun run scripts/mutation-test-shard.ts stryker.run-<shard>.config.mjs`
   (todos deben pasar).

## B. Pre-push con entorno parecido a CI

`scripts/pre-push.sh:22` corre `bun run test:coverage` con el entorno del Mac (identidad global de git, HOME real, PATH con
claude/codex). Cambiar SOLO esa invocación (los ui-gates de más abajo siguen igual):
- `ci_home="$log_dir/home"` y `ci_bin="$log_dir/bin"` (crear ambos); en `ci_bin` symlinks a `bun`, `node` y `git`
  (resueltos con `command -v`; si `node` no existe, omitirlo).
- Ejecutar `env HOME="$ci_home" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 PATH="$ci_bin:/usr/bin:/bin:/usr/sbin:/sbin" bun run test:coverage`.
- Comentario breve con el motivo (3 rachas de CI rojo, ver PLAN.md CI.14).
- Correr `bash scripts/pre-push.sh </dev/null` a mano (sin refs en stdin solo corre la suite). Si algún test falla SOLO por
  este entorno, NO lo arregles: reporta cuál y por qué (el cerebro decide si es divergencia real con CI).

## C. startup-guard avisa de Actions en rojo

`.claude/hooks/startup-guard.js`: nueva `checkActions(findings)`.
- Fuente: si existe env `STARTUP_GUARD_GH_JSON` (ruta a archivo), leerla; si no, `execFileSync('gh', ['run','list','--limit','30',
  '--json','workflowName,conclusion,status,databaseId,headSha,createdAt'], { timeout: 3000 })`. Cualquier error → no hallazgo.
- Para cada workflow en `['CI','Mutation Shards','Secret Check','UI gate']`: tomar la corrida más reciente con
  `status === 'completed'`; si `conclusion !== 'success'` → hallazgo
  `Actions: <workflow> <conclusion> (<sha7>, <fecha>) — revisar antes de trabajar: gh run view <id>`.
- `main()`: cabecera genérica `[startup-guard] hallazgos al arrancar:`; la línea de "Arreglo:" solo si hay hallazgos de
  config (los existentes). Mantener el tope de líneas y el `try/catch` que falla abierto.
- `tests/hooks/startup-guard.test.ts`: con `STARTUP_GUARD_GH_JSON` → (1) todo success → sin salida de Actions; (2) CI failure
  más reciente que un success anterior → hallazgo; (3) Mutation cancelled → hallazgo; (4) solo `in_progress` → ignora;
  (5) JSON inválido → sin hallazgo ni error. Ajustar tests existentes que dependan de la cabecera vieja. Los tests no deben
  llamar a `gh` real: fijar `STARTUP_GUARD_GH_JSON` en todos (también los de config) a un fixture "todo success".
- Actualizar `docs/specs/CTX-GUARD.md` con la nueva comprobación (2-3 líneas).

## Fuera de alcance
`mutation-nightly.yml` (timeout, paralelismo), CI.12 (`tasks-concurrency` en sí), `ci.yml`.

## Verificación (la hace el cerebro fuera del sandbox)
`bunx tsc --noEmit`, `bun run lint`, `bun run test:coverage`; tiempos por shard; contraprueba de B (quitar `-c user.*` del
fixture de `tasks.test.ts` → el pre-push falla; restaurar); `node .claude/hooks/startup-guard.js` real; disparo manual de
Mutation Shards.
