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

## Ronda 2 (2026-10-06, tras verificar A y B)
Medido por el cerebro: shard executors 42/104 archivos, 20.3 s vs 39.1 s la suite entera. La mitad no alcanza: el 10-02
el shard tardó 168 min con un dry run de 8 s; hoy el dry run de CI es 21 s.
1. `scripts/mutation-test-shard.ts`: añadir `--bail` a `bun test` (un mutante muerto termina en el primer fallo; el veredicto
   de Stryker solo usa el código de salida). Test: los argumentos incluyen `--bail`.
2. Bug destapado por B: `sandboxProfile` (`scripts/adversarial-review.ts:346-365`) escribe `HOME` y `sandboxRoot` sin
   resolver symlinks; Seatbelt compara rutas reales, así que con `HOME=/var/folders/...` (`/var` → `/private/var`) la
   regla de credenciales no aplica y la credencial se lee (reproducido: el test "c" no lanza). Resolver con `realpathSync`
   (con fallback a la ruta original si falla) `home` y `sandboxRoot` antes de construir el perfil. Test unitario en
   `scripts/adversarial-review.test.ts`: con un home que es symlink, el perfil contiene la ruta real.
3. Re-medir `bun run scripts/mutation-test-shard.ts stryker.run-executors.config.mjs` y reportar.

## Ronda 3 (2026-10-06) — la contraprueba de B falló
Con `GIT_CONFIG_GLOBAL=/dev/null` un `git commit` sin identidad PASA en el Mac: git deduce el nombre del usuario del
sistema (en el runner de Linux no puede → "empty ident name"). Verificado por el cerebro: con un gitconfig global que
solo tiene `[user] useConfigOnly = true`, el commit sin identidad falla ("Author identity unknown") y con `-c user.*` pasa.
1. `scripts/pre-push.sh`: escribir `"$ci_home/.gitconfig"` con `[user]\n\tuseConfigOnly = true` y usar
   `GIT_CONFIG_GLOBAL="$ci_home/.gitconfig"` en vez de `/dev/null`. Actualizar el comentario.
2. Contraprueba de punta a punta (no se commitea): quitar temporalmente el `-c user.name… -c user.email…` del fixture en
   `src/dashboard/handlers/tasks.test.ts` (ver `git show b77bd07`), correr `bash scripts/pre-push.sh </dev/null` → debe
   FALLAR por identidad; restaurar el archivo (`git checkout -- src/dashboard/handlers/tasks.test.ts`) y correrlo otra
   vez → verde. Reportar las líneas relevantes de ambas corridas.

## Ronda 4 (2026-10-06) — C: `gh run list --limit 100` tarda 2.6–3.0 s y supera el timeout de 3 s (el guard calla)
Medido por el cerebro: 4 llamadas en paralelo `gh api repos/<owner>/<repo>/actions/workflows/<archivo>/runs?per_page=1&status=completed`
(ci.yml, mutation-nightly.yml, security-secrets.yml, ui-gate.yml) = 0.81 s en total y dan exactamente la última corrida
completada de cada workflow (sin problema de ventana).
1. `checkActions`: si `STARTUP_GUARD_GH_JSON` existe, igual que hoy (fixture = lista de runs, misma selección). Si no:
   owner/repo desde `git remote get-url origin` (execFileSync, timeout 1000; soportar `https://github.com/o/r(.git)` y
   `git@github.com:o/r(.git)`); luego las 4 llamadas en paralelo con `execFile` promisificado (`timeout: 3000` cada una,
   `Promise.allSettled`), `--jq '.workflow_runs[0]'`; mapear `name→workflowName`, `id→databaseId`, `head_sha→headSha`,
   `created_at→createdAt`, `conclusion`, `status`. Una llamada fallida solo omite ese workflow.
2. `main` pasa a async; mantener el try/catch que falla abierto (también para la promesa rechazada).
3. Test: el parseo de la URL del remoto (https y ssh) como función exportada o probada vía fixture. Tests existentes verdes.
