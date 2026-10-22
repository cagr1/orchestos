# TRUST — evidencia de cada paso del flujo de una tarea

TRUST.0, 2026-10-22. Mapeo de `leer` (Codex Luna) y verificación del cerebro leyendo el código citado. Lectura de código,
no gate en vivo: cada hueco que pase a ítem se prueba en vivo al cerrarlo.

## Tabla

| Paso | Evidencia y dónde | Medida u opinión | La ve el usuario |
|---|---|---|---|
| Chat → tarea | llamada `create_task` y sus argumentos (`src/dashboard/handlers/chat.ts:993`) | la llamada es medida; descripción, salidas y criterios los escribe el LLM | el chat dice si se creó/arrancó |
| Ejecución | `runs.executor_reply`, archivos intentados/autorizados/bloqueados, snapshots (`src/run/harness.ts:700`) | `executor_reply` = afirmación del ejecutor; archivos y diffs medidos | `executor_reply` solo si el run falló, sin marcar como afirmación (`RunsEvidenceView.tsx:155`) |
| Checks | `CheckResult` con cmd, exit, stdout, stderr, timeout (`src/run/checks.ts:132`) → `runs.checks_json` | medida | **no**: la API de UI tira stdout/stderr, deja cmd+exit+duración (`src/dashboard/app/src/api/runs.ts:76`) |
| QA / juez | verdict, reason, criterios con fragmento literal (`src/run/qa.ts:250`) | opinión del juez; el fragmento literal se valida mecánicamente | badge `QA pass/fail` (`PlanBoardView.tsx:249`); razón mezclada con criterios sin marcar (`api/runs.ts:44`) |
| Reintento | `tasks.yaml` `retry_reason`, `retry_count` (`src/run/graph-runner.ts:530`) → prompt (`src/run/prompt.ts:51`) | check: síntesis `check failed: <cmd> exit <n>` sin salida (`harness.ts:696`); QA: opinión del juez (`harness.ts:921`) | "Attempt n/m failed: <motivo>" (`TaskDetailPanel.tsx:151`) |
| Relanzar manual | `POST /api/tasks/:id/run` pone `pending` y lanza (`src/dashboard/handlers/tasks.ts:450`) | no exige ni mira evidencia | nada avisa si no hay registro del fallo |
| Commit | `runs.commit_sha` en éxito con worktree (`harness.ts:935`); `commit-tasks-yaml.ts:26` | SHA medido | control de undo con SHA (`TaskCard.tsx:294`); el `chore(tasks)` no se enlaza (CI.23) |
| Estado | badge de `tasks.yaml` `status`/`qa_verdict` (`tasks.ts:113`) | `done` lo fija el harness tras checks y QA (`harness.ts:982`), no el ejecutor | badge |

## Huecos verificados, por riesgo

1. **Alto — "QA pass" sin QA.** Sin criterios de aceptación el juez no corre y el veredicto se escribe `pass`
   (`src/run/harness.ts:783-795`); se persiste igual que un pase real (`harness.ts:968`, `graph-runner.ts:515`) y el badge
   dice "QA pass" (`PlanBoardView.tsx:249`). Si además no hay checks (`defaultChecksFor` solo cubre salidas de código,
   `harness.ts:666`; cobertura exacta no verificada), una tarea queda `done` + "QA pass" sin ninguna verificación.
   → **TRUST.2**.
2. **Alto — el reintento no recibe la causa.** Ver tabla, fila Reintento. → **TRUST.1**.
3. **Alto — la salida de los checks no llega a la UI.** Se guarda y se tira al mapear (`api/runs.ts:76`); el motivo
   visible es `runs.result` genérico, p. ej. `check fail — reverted N file(s)` (`harness.ts:733`, `api/runs.ts:65`).
   → dentro de **TRUST.1** (misma evidencia, mismo arreglo).
4. **Medio — relanzar sin evidencia no avisa.** → dentro de **TRUST.1**.
5. **Medio — opinión y medida sin distinguir en la UI.** Razón del juez y `executor_reply` aparecen como hechos, junto a
   exit codes. → **TRUST.3**.
6. **Medio — commit tras relanzar.** CI.23 (la tarea relanzada no deja `chore(tasks)`); el commit previo de archivos
   sucios (`tasks.ts:506`) no se enlaza al run (no verificado que falte). → **CI.23**, con la evidencia de TRUST.1.
7. **Bajo, por diseño — la tarea la redacta el LLM.** Anotado; sin ítem.
