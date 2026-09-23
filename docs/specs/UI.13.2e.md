# UI.13.2e — Runs y Graph con datos reales (Lote L2, ítem 1)

Settings → proyecto → pestañas **Runs** y **Graph**. Runs ya lista `/api/runs`, pero global (todos los
proyectos) y el detalle tiene campos vacíos o texto fijo. Graph (`ContextView`) recibe el objeto de ejemplo de
`OrchestSettingsView.tsx:2035` porque `App.tsx` nunca le pasa `projectContext`.
Regla UI.13: el JSX de la plantilla se conserva (className literal); solo se cambia la capa de datos, se
cablean handlers y el texto fijo que afirma algo se reemplaza por el dato real. No tocar `/legacy` ni
`src/dashboard/public/`.

## Cambios — Runs

1. **Backend `src/dashboard/handlers/runs.ts` + `server.ts:158`:** `GET /api/runs` con header
   `x-orchestos-project-id` devuelve solo los runs de ese proyecto (`listRunsByProjectId`, `db/runs.ts:166`);
   sin header, igual que hoy. Resolver el id de proyecto de la DB a partir del proyecto del dashboard (leer
   `withDashboardProject` y `ensureProject`; no asumir que los dos ids coinciden: verificarlo). `GET /api/runs/:id`
   no cambia de forma.
2. **`runRecordToRow` (y el tipo `RunRow` de `src/dashboard/types.ts`)** añade: `prompt`, `allowedOutputs`,
   `filesAttempted`, `filesAuthorized`, `filesBlocked` (`string[]`, JSON de la fila), `checks`
   (`checks_json`: `{cmd, exitCode, elapsedMs, timedOut?}[]`, ver `cli.ts:2787`), `qaReason`, `qaModel`,
   `adversarialVerdict/Reason`, `refuterVerdict/Reason`. JSON inválido → `[]`/`null`, nunca excepción. Test.
3. **Front `api/runs.ts` `mapRunRow`:** `taskDescription` = primera línea de `prompt` (o `taskId`),
   `outputSlice` = `allowedOutputs`, `filesAttempted/Authorized/Blocked` reales, `deterministicChecks` =
   `checks` mapeados (`name`/`command` = `cmd`, `passed` = `exitCode === 0 && !timedOut`, `durationMs`,
   `exitCode`), `qaEvaluation` desde `qaVerdict` + `qaReason` (+ adversarial/refuter si existen, un ítem cada uno).
   Añadir los campos que falten a `RunItem` en `types/orchestos.ts`. Test del mapeo.
4. **Detalle (`RunsEvidenceView.tsx`), sin cambiar className:**
   - Contract: la lista es `outputSlice`; debajo, archivos bloqueados (icono de alerta) si hay. La frase fija
     "All file modifications were strictly validated…" se reemplaza por el conteo real
     (`N authorized · M blocked`).
   - QA Assertions: las 3 líneas fijas (`✓ Spec WHEN/THEN…`, `Vitest…`, `AST…`) se reemplazan por una línea
     por check determinista (✓/✗ + `cmd` + exit code) y una por ítem de `qaEvaluation` (veredicto + razón).
     Sin checks ni QA → una sola línea "No QA recorded for this run".
   - Cost: el recuadro `Worktree · Clean` fijo pasa a `Status` con `run.status` real.
   - Diffs: sin `fileDiffs` → una línea "No diffs recorded", no un panel vacío.
5. **`App.tsx`:** la carga de runs ya existe (`App.tsx:271-289`); verificar que pasa el header del proyecto y
   que se recarga al abrir Settings → Runs.

## Cambios — Graph

6. **Backend:** endpoint nuevo `GET /api/project/graph` (proyecto por `withDashboardProject`) que devuelve
   `{ files, edges, languages: {language, files}[], staleFiles, gitBranch, isCleanWorktree, indexedAt }`:
   conteos de `files`/`code_edges` del proyecto en la DB, `staleFiles` = filas de `files` cuyo `path` ya no existe
   en disco, rama y limpieza por `git` (sin git → `gitBranch: null`, `isCleanWorktree: null`). Test con proyecto
   temporal.
7. **Front `api/project.ts` (nuevo) `getProjectContext(projectId)`:** junta `GET /api/project/constitution`,
   `GET /api/project/context` y `GET /api/project/graph` en un `ProjectContext` (tipo ampliado con `languages`,
   `staleFiles`, `edges`). Archivo inexistente → texto vacío con el aviso de que no existe, no el de ejemplo.
8. **`App.tsx`:** estado `projectContext` cargado por `currentProject.id` y pasado a `OrchestSettingsView`
   (hoy no se pasa). Quitar el objeto de ejemplo de `OrchestSettingsView.tsx:2035-2043`; mientras carga, estado
   de carga. `onRefreshGraph` = `POST /api/project/index` (header del proyecto); botón deshabilitado mientras
   corre; al terminar recarga `projectContext` para que el conteo cambie.
9. **`ContextView.tsx`**, sin cambiar className: `0 stale references detected` = `staleFiles` real;
   `Language Distribution` fijo (`TypeScript (82%)…`) = distribución real en %; `Git Cleanliness` y `Branch` reales
   (null → "Not a git repository"). El texto "Analyzed by ast-grep & tree-sitter…" se deja solo si es cierto:
   leer el indexador (`indexProject`) y poner lo que realmente usa.

## Fuera de esta pasada
Memory/Specs/Skills/Instincts/Plan (ítem 2 del lote); `runs/analyze`; borrar runs desde esta vista.

## Gate (lo que el cerebro va a medir)
Flujo nuevo `scripts/ui-gate/flows/runs-graph.mjs`, patrón de `tasks.mjs` (proyecto temporal con git,
`orchestos init` + `task init`, registrado por la API, `cleanup` que lo des-registra y borra la carpeta):
- Correr una tarea del proyecto temporal (agente de gates: **Codex · gpt-5.6-luna · medium**, campos como en
  `tasks.mjs`) para que exista un run suyo.
- Settings → proyecto temporal → Runs: aparece ese run y **ningún** run de otro proyecto (comparar con
  `/api/runs` sin header); clic en la fila → Contract muestra el `output` de la tarea; QA Assertions no contiene
  `Vitest automated test suite`; Cost muestra el status real.
- Graph: `N source units` = `files` de `/api/project/graph` (0 antes de indexar); clic `Rebuild Code Graph` →
  el número sube sin recargar la página; no aparece `TypeScript (82%)` ni `48`; 0 errores de consola.
- Verde: `bun run gate:all` + `bun run ui:gate runs-graph` + `bun run ui:gate smoke`.

## Reglas para el ejecutor
No invoques `codex exec` ni delegues a otro agente. No toques `tasks.yaml` de este repo (reproducciones por API
siempre con `x-orchestos-project-id` del proyecto temporal). `bun run typecheck` completo (los dos tsconfig), no
solo el tsc raíz. No reportes "preexistente" ni "aislado" sin la salida que lo demuestre. Al terminar: lista de
archivos tocados y salida real de los comandos del gate.
