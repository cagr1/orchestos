# R.8.3 — QA negativo real: el rechazo se prueba y el criterio que falló se ve (spec)

## Defecto (hallazgo 2 de `docs/done/evidence/R.8-revision-sol-2026-10-05.md`)
1. Ningún gate prueba que QA rechace una salida incorrecta: `runs-graph` solo exige `done`.
2. El juez ya devuelve el resultado por criterio (`QAVerdict.criteria`, `src/run/qa.ts:15-38`: `text`, `pass`,
   `evidence{file,excerpt}`), pero el harness lo descarta: `runs` solo guarda `qa_verdict`/`qa_reason`
   (`src/run/harness.ts:1047-1049` y `:1144-1146`). Runs → "QA Assertions" muestra el veredicto general y los checks,
   nunca qué criterio falló (`src/dashboard/app/src/api/runs.ts:40-66`).

## Cambios

### A. Persistir y mostrar el resultado por criterio
1. `src/db/migrate.ts`, junto a `:938`: `safeAddColumn('runs', 'qa_criteria_json', 'TEXT')`.
2. `src/db/runs.ts`: campo **opcional** `qa_criteria_json?: string | null` en el tipo de fila y en el de inserción (mismo
   trato que `qa_model`, `:26`, `:62`, `:78`), añadido al `INSERT` (`:107`, `:130`) con `scrub(...) ?? null`. Opcional
   para no tocar los demás `insertRun` del repo.
3. `src/run/harness.ts`, solo en los dos `insertRun` posteriores al juez (rama `qa.verdict === 'fail'` `:1032` y rama de
   éxito `:1144`): `qa_criteria_json: qa.criteria?.length ? JSON.stringify(qa.criteria) : null`.
4. `src/dashboard/handlers/runs.ts:~101` y `src/dashboard/types.ts:~185`: exponer
   `qaCriteria: { text: string; pass: boolean; evidence?: { file: string; excerpt: string } }[]` con
   `parseJsonArray(r.qa_criteria_json)` (array vacío si es null). Debe salir en la lista `/api/runs` y en el detalle
   `/api/runs/:id`, igual que `checks`.
5. `src/dashboard/app/src/api/runs.ts`: `qaCriteria?` en `RunRow`; en `mapRunRow`, después de la entrada
   `QA verdict: …` y antes de la adversarial, una entrada de `qaEvaluation` por criterio:
   `{ criterion: c.text, passed: c.pass, rationale: c.evidence ? `${c.evidence.file}: ${c.evidence.excerpt}` : 'no evidence in written files' }`.
   `RunsEvidenceView.tsx` no se toca (ya pinta `qaEvaluation` con ✓/✗). Sin clases CSS nuevas.
6. Tests unitarios: uno en la suite existente de `src/db` o del harness que compruebe que `qa_criteria_json` se guarda y
   vuelve por el handler; uno de `mapRunRow` (criterio fallido sin evidencia y criterio aprobado con evidencia).
7. Si `src/dashboard/app/dist` está versionado y el repo tiene script de build del front, regenerarlo con ese script.

### B. Gate nuevo `scripts/ui-gate/flows/qa-negative.mjs`
Copiar el andamiaje de `scripts/ui-gate/flows/runs-graph.mjs:1-128` (proyecto temporal `orchestos-ui-r83-`, `git` con
identidad propia, `init`, `writeGateRoles`, `task init`, cleanup con purge + `rmSync` con `maxRetries: 10,
retryDelay: 300`) y sus helpers `waitForTaskChange`/`waitForEnabled`. Sin el bloque de Graph.

`tasks.yaml` con dos tareas, en este orden (ambas `executor_model: 'openai/gpt-6-luna'`, `engine: 'codex'`,
`cli_effort: 'medium'`, `input: []`, `depends_on: []`, `status: 'pending'`, `retry_count: 0`):
- `gate-qa-ok` — description `Create the file ok.txt containing exactly one line: VERDE`; `output: ['ok.txt']`;
  `checks: [{ cmd: 'grep -qx VERDE ok.txt' }]`; `acceptance_criteria: ['ok.txt contains the line: VERDE']`.
- `gate-qa-bad` — description `Create the file nota.txt containing exactly one line: ROJO`; `output: ['nota.txt']`;
  `checks: [{ cmd: 'test -f nota.txt' }]`; `acceptance_criteria: ['nota.txt contains the line: AZUL']`.
  La salida correcta según la descripción (ROJO) incumple el criterio: eso es la "salida deliberadamente incorrecta".

Recorrido (UI real: Dev → proyecto → Settings → `Run Next Task`, como `runs-graph.mjs:133-162`):
1. Clic 1 → esperar `gate-qa-ok`. Pasos (cada uno con condición real, **ningún `true` literal**):
   - `control task passes QA`: `status === 'done'` y run con `qaVerdict === 'pass'`.
   - `control check executed`: `checks` del run contiene `cmd === 'grep -qx VERDE ok.txt'` con `exitCode === 0`.
   - `control criterion passed with literal evidence`: `qaCriteria` tiene 1 entrada, `pass === true`,
     `evidence.file === 'ok.txt'` y `evidence.excerpt` incluye `VERDE`.
   - `control output on disk`: `ok.txt` existe en `projectRoot` y su contenido recortado es `VERDE`.
   Si el control no llega a `done`, registrar los pasos como fallidos y terminar (`return`): sin control, el rechazo no
   prueba nada.
2. Clic 2 → esperar el cambio de `gate-qa-bad` (un solo intento; no agotar los 3 reintentos). Pasos:
   - `executor wrote the incorrect output`: el `fileDiffs` del run de `gate-qa-bad` contiene `+ROJO` y no contiene
     `AZUL`. Si falla, detalle `premisa no cumplida: el ejecutor no escribió ROJO` y `return`.
   - `QA rejects the incorrect output`: run con `qaVerdict === 'fail'`, `qaReason` no vacío, `qaModel` no vacío.
   - `check executed before QA`: `checks` contiene `cmd === 'test -f nota.txt'` con `exitCode === 0`.
   - `failed criterion recorded`: `qaCriteria` tiene 1 entrada con `text === 'nota.txt contains the line: AZUL'` y
     `pass === false`.
   - `task returns to pending with retry`: tarea `status === 'pending'`, `retryCount === 1`, `qaVerdict === 'fail'`.
   - `rejected output reverted`: `nota.txt` NO existe en `projectRoot`.
   El detalle de cada paso es el JSON de lo observado (veredicto, razón, modelo, checks, criterios), no una frase fija.
3. Visible en la UI: `Runs` → fila de `gate-qa-bad` → `QA Assertions`. Pasos:
   - `check visible in QA tab`: texto `✓ test -f nota.txt (exit 0)`.
   - `failed criterion visible in QA tab`: un elemento cuyo texto empieza por `✗ nota.txt contains the line: AZUL`.
   - `shot('qa-negative-rejected')`.
   Luego `Back to Runs` → fila de `gate-qa-ok` → `QA Assertions`:
   - `passed criterion visible with evidence`: texto que empieza por `✓ ok.txt contains the line: VERDE` e incluye
     `ok.txt: `.

### C. Pre-push
`scripts/pre-push.sh:61`: añadir `qa-negative` a `ui_flows` después de `runs-graph`.

## No tocar
`src/run/qa.ts` (el juez no cambia), `runs-graph.mjs`, `task-report.ts`, `PlanBoardView.tsx`, `styles.css`, PLAN.md,
NEXT.md, `read-boundary.mjs`, `IDEAS.md`, `orchestos.config.yaml`. No commitear.

## Entorno del ejecutor
El sandbox de Codex no abre puertos: `ui:gate` y los tests que levantan servidor (`EADDRINUSE`) los corre el cerebro
fuera; el baseline (`tsc`, `test:coverage`) estaba verde antes de empezar. Correr: `bunx tsc --noEmit`, el `tsc` del
front, `bunx biome check` sobre los archivos tocados, `node --check scripts/ui-gate/flows/qa-negative.mjs` y los tests
unitarios nuevos. Si se tocó `scripts/pre-push.sh`, decirlo en el reporte (el cerebro corre `bun run hooks:install`).

## Verificación (cerebro)
- `bunx tsc --noEmit` (raíz y front), `bunx biome check`, `bun run test:coverage`.
- `bun run gate:evidence -- --label R.8.3-qa-negative -- bun run ui:gate qa-negative runs-graph` → todos los pasos.
- Contraprueba: con el cambio A.3 revertido en local, `failed criterion recorded` debe fallar.
- 3 corridas de `qa-negative` para medir que la premisa (el ejecutor escribe ROJO) es estable.
