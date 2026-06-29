---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-14-en-curso
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.
**Delegación**:
- 🧠 = Claude implementa — requiere criterio arquitectural o decisión de diseño
- ⚡ = DeepSeek implementa — tarea bien especificada, ejecuta leyendo el plan
- 🔍 = revisión obligatoria por Claude — gate antes de cerrar el sprint, independiente de quién implementó

---

## MES 14 — Autonomía interna: el runner que conduce el grafo solo

**Eje**: del aislamiento (Mes 13) a la autonomía. Hoy el humano ejecuta una tarea a la vez; el conductor recorre el DAG completo de principio a fin, decide solo qué hacer ante un fallo (reintentar con estrategia vs. bloquear la rama) y **no se detiene globalmente** porque una rama caiga. Eje declarado en DONE.md § MES 12 y § MES 13 como candidato directo de este mes.

**Norte (VISION.md / tendencia 2026)**: el humano diseña el grafo, el sistema lo ejecuta solo. Objetivo medible: **intervención humana = 0 en el happy path**.

**Qué ya existe (NO reconstruir)**: `tasks.yaml` con `depends_on` ✅ · status machine (`pending → running → done / failed / failed_permanent`) ✅ · QA verdict por tarea ✅ · `retry_count` + `MAX_RETRIES` ✅ · `diagnoseTask()` con 6 patrones (S25) ✅ · `executePlan()` scheduler de sub-tareas con cascada (S22.4/22.5) ✅ · context-monitor con `cost_notice` (S23.0.2) ✅.

**El gap real**: el `task run --all` actual ([src/cli.ts:1058](src/cli.ts:1058)) es un loop ingenuo — `MAX=20`, busca el siguiente ejecutable, y **`break` global al primer `failed`**. No integra diagnose, no bloquea ramas selectivamente, no continúa ramas independientes, no tiene tope de costo, y no tiene superficie en el dashboard. El conductor es esa lógica encima del motor que ya existe.

---

### BLOQUE 0 — Pre-flight (🔍 Claude, gate de entrada)

- [x] **0.1** (2026-06-23) Leídos `scheduler.ts`, bloque `--all` de `cli.ts`, `diagnose.ts`, `tasks/schema.ts`. Hallazgos:
  - **`TaskStatus` ya incluye `'blocked'`** ([src/tasks/schema.ts:1](src/tasks/schema.ts:1)) — el enum top-level ya anticipó este estado. **Cero cambios de schema necesarios.**
  - **El patrón "aislar rama, no detener el grafo" ya existe y está probado** — `executePlan()` ([src/run/scheduler.ts:73](src/run/scheduler.ts:73)) recorre sub-tareas en un `for` que NUNCA hace `break` global: si una sub-tarea falla, marca sus dependientes `skipped` (vía `failedIds`) y **continúa el loop** procesando el resto. Esto es exactamente el comportamiento que el conductor necesita a nivel `tasks.yaml` — solo hay que portar el patrón, no inventarlo.
  - **El gap real está aislado en un solo lugar**: el bloque `--all` de `cli.ts` ([cli.ts:1058-1079](src/cli.ts:1058)) es el único punto que rompe el patrón — usa `MAX=20` hardcoded y `if (result === 'failed') { break }` (línea 1076), deteniendo TODO el grafo por una sola tarea. No hay registro de qué quedó bloqueado ni por qué.
  - **`diagnoseTask()`** ([src/agents/diagnose.ts:101](src/agents/diagnose.ts:101)) ya es 100% reusable sin cambios: toma `(taskId, root)`, lee últimos 3 runs vía `listRunsByTaskId`, devuelve `DiagnoseResult{pattern, confidence, suggestion, details}` con 6 `FailurePattern`. Hoy solo se imprime a stderr (S25.3) — nunca se usa para decidir una acción. Ese es el otro gap: pasar de "sugiere" a "la estrategia A1 actúa sobre el resultado".
  - **Conclusión**: A2 (graph-runner) no es un motor nuevo — es `executePlan()` adaptado de `SubTask[]` a `Task[]` de `tasks.yaml`, reemplazando el `break` de `cli.ts:1076` por el ciclo cascada-y-continúa que `scheduler.ts` ya demuestra. Reduce el riesgo de A2: el patrón ya está en producción (sub-agentes, Mes 5).
- [x] **0.2** (2026-06-23) Decisión: comando nuevo **`run --graph`**, no se toca `--all`. Razón: `--all` ya tiene consumidores (hook post-completion S30, dogfooding documentado en E2E.md) que asumen halt-on-fail; cambiar su semántica sin flag sería un cambio de comportamiento silencioso. `--graph` es aditivo.

### BLOQUE A — El conductor (motor) 🧠

- [x] **A1** (🧠, 2026-06-23) Diseño completo en [docs/graph-runner-design.md](../docs/graph-runner-design.md). Decisiones: (1) `'blocked'` reusado sin cambios de schema — ya tenía la semántica correcta. (2) Mapa `FailurePattern`→estrategia: solo `rate_limit` autoriza un requeue único (en memoria, no persistido); los otros 5 patrones bloquean la rama sin reintentar. (3) Algoritmo nunca hace `break` global — único punto de parada total es el circuit breaker (A4). (4) `blockedAncestors` es el mismo patrón que `failedIds` de `scheduler.ts`, portado a `Task[]`.
- [x] **A2** (⚡, implementado — checkbox corregido 2026-06-25) `src/run/graph-runner.ts`: traversal topológico que recorre el DAG completo. Una rama que agota retries marca sus dependientes como bloqueados con razón explícita y **continúa las ramas independientes** (no `break` global). Devuelve un `GraphRunResult` con outcome por tarea. Ya endurecido por AR.1-AR.7.
- [x] **A3** (🧠/⚡, implementado — checkbox corregido 2026-06-25) `diagnoseTask()` (S25) integrado en `executeSingleTask()`: al llegar a `failed_permanent`, llama diagnose y aplica la estrategia de A1 automáticamente (rate_limit → requeue único; resto → bloquea rama), sin pedir permiso por decisión individual.
- [x] **A4** (⚡, implementado — checkbox corregido 2026-06-25) Circuit breaker en `runGraph()`: tope de costo acumulado (`--max-cost`), tope de wall-clock (`--max-minutes`) y de iteraciones totales (200, hard cap). `cost_notice` informativo a $5. Bug de truthiness con `--max-cost 0` corregido en AR.4.

### BLOQUE A.R — Hallazgos del review local max-effort (🔧 Sonnet, pendiente)

Detectados en review local del 2026-06-25 sobre `graph-runner.ts` + `model-catalog.ts`. El 🔴 crítico (costo de intentos intermedios descartado → breaker ciego) **ya está corregido**; lo de abajo queda para Sonnet. Volver a correr `claude ultrareview` real desde terminal antes de cerrar el bloque.

- [x] **AR.1** (2026-06-25) `graph-runner.ts:139-153` — quitado el `sleep(200)+continue`: el runner es secuencial, nada cambia `tasks.yaml` entre iteraciones, así que el atasco (dep inexistente/ciclo) es permanente desde la primera detección. Ahora corta de inmediato con `circuit_break_reason` nombrando cada tarea atascada y sus deps no resueltas (mismo estilo que `--all`, cli.ts:1070-1073). 474 tests · 0 fail.
- [x] **AR.2** (2026-06-25) `model-catalog.ts` — en el fallback a disco vencido, `memoryFetchedAt` se marcaba con el timestamp vencido (`disk.fetchedAt`) en vez de `Date.now()`, así que `isFresh()` seguía dando `false` y cada `ensureCatalogLoaded()` del proceso reintentaba el fetch (10s timeout) — con API key + red caída, 50 tareas = ~500s muertos. Fix: marcar `Date.now()` al fallback (un solo intento real por proceso). Test nuevo confirma `fetchCalls === 1` tras dos llamadas. 475 tests · 0 fail.
- [x] **AR.3** (2026-06-25) `diagnose.ts`/`graph-runner.ts` — `diagnoseTask` (llamada Haiku real) no exponía su costo; el caller no podía acumularlo. Fix: `DiagnoseResult.usdCost` calculado con `calcCost(resp.model, ...)` en los 3 `return` (éxito, JSON no parseable, parse fail) — campo aditivo, no rompe los otros 3 consumidores (cli.ts×2, dashboard/tasks.ts). `graph-runner.ts` ahora suma `full.usdCost` a `accCost`. 475 tests · 0 fail.
- [x] **AR.4** (2026-06-25) `graph-runner.ts` (pre-iteración, post-task, wall-clock) — `maxCost && ...`/`maxMinutes && ...` trataba `0` como "sin límite" por truthiness: `--max-cost 0` invertía la intención del usuario y dejaba gastar sin tope. Fix: `!= null` en los 3 checks (distingue "flag no pasado" de "se pasó 0"). 475 tests · 0 fail.
- [x] **AR.5** (2026-06-25) `graph-runner.ts` — `skipped_circuit_breaker` declarado pero nunca emitido; además las tareas bloqueadas transitivamente (descendientes de una rama fallida) tampoco tenían entry, porque su status se setea directo sin pasar por `executeSingleTask`. Fix: al final de `runGraph`, recorre `tasks.yaml` y agrega entry para todo id sin reportar y no `done` — `'blocked'` si quedó `blocked`, `'skipped_circuit_breaker'` si quedó `pending` sin alcanzar (corte o atasco AR.1). El reporte ahora da cuenta de toda tarea. 475 tests · 0 fail.
- [x] **AR.6** (2026-06-25) `graph-runner.ts` — las dos aserciones `find(...)!` revientan con TypeError si la tarea desaparece de `tasks.yaml` por edición externa mientras corre el grafo; cambiadas a un check explícito que devuelve `failed_permanent` con razón clara en vez de lanzar. Además, corregido el comentario "Edge case" sobre la rama `!isPermanent` — sí es alcanzable (camino normal de `parse_error`/`contract_violation`, que el harness devuelve como `'failed'` sin mirar `retry_count`). El re-chequeo de deps se deja (defensivo, sin riesgo) — no se tocó, solo lo señalado como crash real. 475 tests · 0 fail.
- [x] **AR.7** (2026-06-25) `model-catalog.ts` — `Number(pricing.prompt)` daba NaN si el string no era numérico, serializado como `null` en el cache de disco. Fix: `Number.isFinite()` guard → 0 ante NaN. Test nuevo mockea fetch con `pricing.prompt: 'not-a-number'` y verifica `priceIn === 0` en el cache, sin afectar `contextLength`. 476 tests · 0 fail.

**BLOQUE A.R cerrado (2026-06-25)** — AR.1–AR.7 resueltos, todos con test de regresión donde aplicaba. 468→476 tests, 0 fail en todo el bloque. Pendiente: correr `claude ultrareview` real desde terminal para corroborar contra el código ya corregido antes de avanzar a A4/B1.

### BLOQUE B — CLI 

- [x] **B1** (⚡, 2026-06-25) `orchestos run --graph [path] [--max-cost N] [--max-minutes N] [--dry-run]`: recorre el DAG completo, imprime progreso por tarea, y un resumen final. Implementado en `cli.ts` (dispatch al `runGraph` de A2). `--task`/`--output` pasan de required a opcionales (solo obligatorios en modo one-shot); `--graph` activa el modo DAG con `tasksExist` guard, validación numérica de `--max-cost`/`--max-minutes`, `--dry-run` imprime el orden topológico en capas + circuit breaker config sin gastar tokens, summary final con tabla outcome por tarea + métrica de autonomía + circuit break reason, exit code 0 solo si 100% autónomo. 476 tests · 0 fail.
- [x] **B2** (⚡, 2026-06-25) Reporte de cierre: tabla outcome por tarea agrupada en 3 buckets (`✓ Completed alone` · `↻ Retried and resolved` · `⊘ Branch blocked`) más un 4º `— Unfinished` para skips del circuit breaker. Helper `printGraphSummary(result, root)` en `cli.ts:1811` lee `retry_count` post-run desde `tasks.yaml` para distinguir "completada sola" (retry=0) de "reintentada-y-resuelta" (retry>0 o `rate_limited_then_completed`). **Métrica de autonomía** prominent (`★ autonomy: N/M (X.X%)`) en headline + recap final. Columnas: TASK · OUTCOME · $COST · RETRIES · in/out · ms, con `error` como sub-línea `└─` para outcomes con causa. Exit code sigue siendo 0 solo si 100% autónomo. `--dry-run` (B1) ya muestra orden topológico en capas + circuit breaker config. 476 tests · 0 fail.

### BLOQUE C — Superficie en el dashboard ([[feedback-dashboard-no-solo-cli]])

- [x] **C1** (🧠, 2026-06-25) `POST /api/run/graph` + `GET /api/run/graph/status` en `src/dashboard/handlers/run-graph.ts`, wireado en `server.ts` siguiendo el patrón de los handlers existentes (`tasks.ts`). Decisión de diseño: el runner corre **in-process** (no `Bun.spawn` como `/api/tasks/:id/run`) porque su resultado (`GraphRunResult` con costo/autonomía/outcome por tarea) solo existe como objeto en memoria — un subproceso forzaría parsear stdout o serializar a disco. Estado en un singleton de módulo (`idle`/`running`/`done`/`error`); el progreso intermedio se lee en vivo de `tasks.yaml` vía `loadTaskRows()` (extraído de `handleApiTasks`, reusado por ambos endpoints) porque `graph-runner.ts` ya llama `updateTaskStatus()` por tarea durante la corrida. 409 si ya hay una corrida en curso. Verificado en vivo contra el dashboard real (no solo mocks): servidor real sin `tasks.yaml` → 404; `GET status` sin corridas → `{phase:'idle', tasks:[]}`. 7 tests nuevos (`run-graph-api.test.ts`) con `runGraph`/`loadTasks`/`loadContext`/`getProject`/`loadOrcheConfig` mockeados. 493 tests · 0 fail. Nota de bookkeeping: al leer el código para esto se confirmó que A2/A3/A4 (Bloque A) ya estaban implementados y testeados pero sin marcar `[x]` — corregido arriba.
- [x] **C2** (🧠, 2026-06-25) Pantalla "Runner de grafo" (`SCREENS.graph` en `screens-ops.js`): botón "Ejecutar todo el plan" con `confirm()` (gasta dinero real, requiere confirmación explícita), tabla de progreso en vivo (reusa columnas de Tasks vía `STATUS_BADGE`/`tasks.col.*`), panel de resultado final agrupado en los mismos 4 buckets que `printGraphSummary` (alone/retried/blocked/unfinished) con métrica de autonomía y circuit-break reason. Auto-refresh cada 3s mientras `phase==='running'` (mismo patrón `_timer` que Runs, limpiado en `App.go()` al salir de pantalla). Nav entry `{id:'graph', operator:true}` + ícono nuevo (`ICON.graph`) en `data.js`. Verificado en vivo contra el dashboard real: `index.html` referencia `screens-ops.js`, los 4 archivos estáticos tocados sirven 200, `screens-ops.js` contiene `SCREENS.graph`, `i18n.js` contiene las claves nuevas — todo sin gastar tokens (solo se verificó el wiring, no se disparó una corrida real).
- [x] **C3** (🧠, 2026-06-25) i18n en/es real esta vez: 17 claves nuevas (`nav.graph`, `graph.title/subtitle/explainer.*/runBtn/running/idle/confirm/alreadyRunning/err.*/empty.*/result.title/autonomy/circuitBreak/totals/bucket.*`) en ambos bloques `en`/`es` de `i18n.js`, consumidas por la pantalla C2. **Historial**: se había marcado `[x]` previamente tras una corrida delegada a DeepSeek vía opencode sin código real detrás (0 coincidencias de `"graph"` en el archivo) — reabierto el mismo día y cerrado ahora con las claves reusadas de verdad en `screens-ops.js`.

### BLOQUE D — Tests + verificación en vivo

- [x] **D1** (⚡, 2026-06-25; hardening 🧠 2026-06-25) Tests unitarios de `graph-runner.ts` en `src/__tests__/graph-runner.test.ts` (11 tests, 0 fail, 40 expect). Cobertura: happy path (linear, paralelo, single), branch isolation (A fail → B blocked, C→D completan independientes), circuit breaker (cost limit, maxCost=0), retry guiado por diagnose (rate_limit → requeue, unknown → no requeue), edge cases (empty, all-done). **Hardening post-C1/C2**: la versión original mockeaba `run/harness.ts` y `agents/diagnose.ts` con `mock.module()` — eso rompía `spec.test.ts` (y luego, al sumar `run-graph-api.test.ts`/`graph-summary.test.ts`/`diagnose.test.ts`, también se rompía a sí mismo) porque Bun's `mock.module()` no tiene scope por archivo: una vez mockeado un módulo compartido, queda mockeado para el resto del proceso `bun test`, sin restauración automática — confirmado con `afterAll` (no resuelve; el archivo que corre después ya heredó el mock). Fix real: extendido el seam de inyección de `GraphRunOpts` (ya usado para `runTaskFn`/`diagnoseFn`) a `loadTasksFn`/`updateTaskStatusFn`, y los 4 archivos que tocan `tasks/loader.ts` (`diagnose.test.ts`, `graph-summary.test.ts`, `graph-runner.test.ts`, `run-graph-api.test.ts`) ahora o inyectan un fake propio (sin importar el módulo real) o reafirman su propia implementación fiel vía `mock.module` — ninguno depende de "ganar la carrera" de orden de archivos. 504 tests · 0 fail, confirmado estable en 3 corridas completas seguidas.
- [x] **D2** (🔍 Claude, 2026-06-25, [[feedback-verificar-gates-en-vivo]]) Gate en vivo contra el **dashboard real corriendo** (no mocks, no `tasks.yaml` del propio repo — proyecto aislado en temp dir, puerto distinto). Grafo de prueba: `a-ok` (debía completar) · `b-fails` (modelo OpenRouter inválido a propósito) · `c-ok` (independiente, sin deps) · `d-blocked` (depende de `b-fails`). Lanzado vía `POST /api/run/graph` (la misma llamada que dispara el botón de C2) con `maxCost:0.20, maxMinutes:3`, costo real total **$0.000815** (dentro del tope). Resultado real: `b-fails` → `failed_permanent` (como se diseñó) · `d-blocked` → `blocked` con razón explícita (`blocked by failed_permanent ancestor: b-fails`) · **`c-ok` → `completed` de forma independiente mientras las otras dos ramas fallaban** — confirma que el grafo no se detiene globalmente. Bonus no planeado: `a-ok` también terminó en `failed_permanent` (el LLM no siguió la instrucción al pie de la letra, dejó líneas en blanco) — esto en realidad fortalece la prueba: con **dos** ramas independientes falladas, la tercera (`c-ok`) corrió y completó igual, sin que ninguna interfiriera con la otra. `circuit_break_reason` quedó `undefined` (el breaker no se disparó). `autonomy_metric: 0.25` (1/4). Confirmado vía `cat out/*.txt`: solo existe `c-ok.txt` en disco — coincide exactamente con el outcome reportado.
- [x] **D3** (🔍 Claude, 2026-06-25) Smoke real end-to-end contra el `tasks.yaml` real de OrchestOS (ni este repo ni CitasBot tenían tareas `pending` hoy — se agregó 1 tarea real y chica: tests unitarios para `src/tasks/loader.ts`, sin coverage previa). Ejecutado con `orchestos run --graph --max-cost 0.20 --max-minutes 3 --keep-worktree` desde la CLI real, sin supervisión. Registrado en [docs/E2E.md](../docs/E2E.md) § Bitácora.
  **Resultado mixto inicial, honesto**: el runner reportó `completed` sin retries ($0.002, 25s) — autonomía=1 desde la perspectiva del grafo. Pero al correr `tsc`/`bun test` manualmente sobre el archivo generado, **no compilaba** (`vitest` en vez de `bun:test`, `tmpdir` importado mal, tipos `Task` incompletos) — el QA verdict del harness ("pass") fue un falso positivo. Causa raíz: la tarea no declaró `checks:` deterministas, así que la única validación fue el juicio del LLM QA, que no ejecuta `tsc`/tests reales.
  **Decisión del usuario: arreglar antes de cerrar el mes (no diferir).** Implementado `defaultChecksFor()` en `src/run/checks.ts` — agrega `tsc --noEmit`/`bun test <archivo>` automáticamente cuando la tarea no declara `checks:` propios (skip si no hay `node_modules` en `effectiveRoot`, para no dar falsos negativos en worktrees frescos). 6 tests nuevos. **Esto destapó un segundo bug real**: el fallo de un *check* no respetaba `MAX_RETRIES` (devolvía `'retry'` sin tope) — confirmado en vivo con `retry 7/3` → `retry 14/3`, solo detenido por el circuit breaker de wall-clock ($0.037, 6+ min). Arreglado en `harness.ts`: el branch de check-fail ahora aplica el mismo chequeo de agotamiento que el branch de QA-fail. **Re-verificado en vivo una tercera vez**: la misma tarea ahora llega a `failed_permanent` tras exactamente `retry=3/3`, real, sin mocks. 510 tests · 0 fail. Detalle completo en [docs/E2E.md](../docs/E2E.md) § Bitácora. Costo total de las 3 corridas de verificación de D3: ~$0.04 USD.
  **Tercer hallazgo, fuera de alcance — sigue como follow-up**: pese a `--keep-worktree`, el log mostró `sandbox: worktree mode selected but no branch/task id — falling back to cwd` — el aislamiento esperado no se cumplió (sin daño esta vez, solo agregaba un archivo nuevo). No se tocó en este cierre.

### BLOQUE E — Cierre del Mes 14 ([[feedback-orden-desarrollo]] — 4 acciones obligatorias)

- [ ] **E1** Mover IDEAS.md #9 (runner de grafo autónomo) → DONE.md con resumen y commits.
- [ ] **E2** Cerrar esta sección con `[x]` + fecha + tabla de estado de bloques A–E.
- [ ] **E3** Limpiar PLAN.md: dejar solo el resumen del Mes 14 cerrado, `status: mes-15-pendiente`.
- [ ] **E4** Pre-flight del Mes 15 + actualizar la memoria del proyecto.

**Métrica de éxito Mes 14**: `orchestos run --graph` recorre un `tasks.yaml` real completo sin intervención humana en el happy path; ante un fallo, bloquea solo la rama afectada (las independientes completan) y la decisión retry/bloqueo la toma diagnose, no el humano. Verificado **en vivo en el dashboard**, no solo en tests. Tests verdes · 0 fail.

**Reglas de seguridad innegociables**: el runner autónomo **solo recorre tareas internas** (LLM → contract → QA → worktree) — no ejecuta acciones outward-facing ni destructivas (eso es territorio del cliente MCP, eje propio posterior). El circuit breaker de costo/tiempo es obligatorio, no opcional.

---

## EXTRA — Control de reasoning effort por modelo (fuera de alcance de Mes 14, en paralelo)

**No bloquea el cierre del Mes 14.** Origen: el usuario notó que algunos modelos del chat tienen "esfuerzo de razonamiento" configurable y otros no, y OrchestOS hoy no expone ni lee ese parámetro en ningún lado.

**Qué ya existe (NO reconstruir)**: catálogo de modelos con `contextLength`/`priceIn` cacheado en disco con TTL 24h ([src/router/model-catalog.ts](src/router/model-catalog.ts)) · fetch real a `/api/v1/models` de OpenRouter ya implementado dos veces (`model-catalog.ts` y `handleApiChatModels` en [chat.ts:102](src/dashboard/handlers/chat.ts:102)) · `runToolLoop`/`openrouterChat` como los dos paths que ya mandan `model` al chat completions endpoint.

**El gap real**: OpenRouter expone por modelo un array `supported_parameters` en `/api/v1/models` — si incluye `"reasoning"`, el modelo acepta `reasoning: { effort: "high"|"medium"|"low" }` en el body del request. Ni el catálogo lo captura, ni el body de chat lo manda, ni la UI lo muestra. Por eso "algunos sí, otros no" es invisible para el usuario hoy — es un atributo real del modelo que OrchestOS no lee.

### BLOQUE BACK — Catálogo + wiring del parámetro 🧠

- [x] **BACK.1** (🧠, 2026-06-29) `model-catalog.ts`: `ModelInfo.supportsReasoning: boolean`, capturado de `supported_parameters?.includes('reasoning')` en `fetchFromOpenRouter()`. Aditivo — `contextWindowFor()`/`priceIn` intactos. `supportsReasoningEffort(modelId)` síncrono (mismo patrón que `hasRealContextWindow()`, `false` por defecto si el id no está en catálogo). 1 test nuevo (`model-catalog.test.ts` 8→9 tests, 0 fail). `tsc --noEmit` limpio. Las 3 fallas en `chat-fetch-url.test.ts` al correr la suite completa son preexistentes en `master` (mismo conteo antes y después de este cambio — leak de orden entre archivos, no introducido acá; queda fuera de alcance de este bloque).
- [x] **BACK.2** (🧠, 2026-06-29) `openrouter.ts` (`chat()`): `opts.effort?: 'low'|'medium'|'high'` opcional → si viene, agrega `reasoning: { effort }` al body; si no, body intacto (igual que antes). `tool-call.ts` (`runToolLoop`): mismo `effort` opcional propagado a `openaiRound()` (restringido a `baseUrl.includes('openrouter')` — la rama directa de OpenAI no toca `reasoning`, eso es otro parámetro en su API). La decisión de si el modelo *soporta* reasoning queda en BACK.3 (el caller en `chat.ts` es quien consulta `supportsReasoningEffort()` antes de pasar `effort` — estas dos funciones solo transportan el valor, no validan soporte). 4 tests nuevos (`openrouter-chat.test.ts` nuevo, 2 tests; `tool-loop.test.ts` 7→9 tests) verificando que `reasoning` aparece solo cuando se pasa `effort`. `tsc --noEmit` limpio.
- [x] **BACK.3** (⚡→🧠, 2026-06-29) `chat.ts` (`handleApiChat`): `body.effort` validado contra `'low'|'medium'|'high'` (400 inmediato si inválido, antes de tocar catálogo/db/fetch). `ensureCatalogLoaded()` + `supportsReasoningEffort(model)` deciden si `effort` se reenvía a `runToolLoop`/`openrouterChat` o se descarta en silencio (modelo no lo soporta → no error, simplemente se ignora). 2 tests nuevos (`chat-effort.test.ts`) cubren solo la validación — **decisión de diseño**: no se testea el wiring fetch→catálogo→provider con mocks de `globalThis.fetch` en este archivo, porque `handleApiChat` tiene un preámbulo async largo (tasks/runs/db/specs/context/catálogo) que deja ventana abierta para que otro archivo de test, corriendo concurrentemente en el mismo proceso `bun test`, pise `globalThis.fetch` a mitad de camino — confirmado empíricamente (5 fails con output de `graph-runner.test.ts` intercalado en el stack trace de mis propios tests, mismo género que [[reference-bun-mock-module-gotcha]] pero con `fetch` en vez de `mock.module()`). Ese comportamiento ya queda 100% cubierto deterministamente en BACK.2 (`openrouter-chat.test.ts`/`tool-loop.test.ts`: el valor SÍ llega al body) + `model-catalog.test.ts` (BACK.1: `supportsReasoningEffort` decide bien). Suite completa corrida 3 veces seguidas: 514 pass · 3 fail estables (las 3 de `chat-fetch-url.test.ts`, preexistentes en `master`, sin relación con este cambio) · 969 expect. `tsc --noEmit` limpio. Nota de higiene: el primer intento de estos tests sí escribió por accidente en el `~/.orchestos/cache/models.json` REAL del usuario (faltaba aislar `ORCHESTOS_HOME`) — detectado y limpiado antes de cerrar este ítem.
- [x] **BACK.4** (⚡, 2026-06-29) `handleApiChatModels`: cada entrada de `/api/chat/models` ahora incluye `supportsReasoning: boolean`, derivado de `supported_parameters?.includes('reasoning')` (mismo cálculo que BACK.1, pero esta función no pasa por el catálogo cacheado — hace su propio fetch directo a `/v1/models`, así que se replica el cálculo en vez de importar `model-catalog.ts`). 1 test nuevo (`chat-effort.test.ts`, seguro de mockear porque esta función no tiene preámbulo async largo — sin la ventana de carrera de BACK.3). Suite completa: 515 pass · 3 fail estables (preexistentes). `tsc --noEmit` limpio.
- [x] **BACK.5** (🔍 Claude, 2026-06-29, [[feedback-verificar-gates-en-vivo]]) Gate en vivo contra el dashboard real corriendo (`bun run src/cli.ts dashboard`, puerto 4242, con la `OPENROUTER_API_KEY` real del usuario en `~/.orchestos/.env`). 3 llamadas reales a `POST /api/chat`, costo real (centavos): (1) `deepseek/deepseek-r1` + `effort:'low'` → 200, respuesta coherente, 30.6s; (2) mismo modelo + `effort:'high'` → 200, respuesta coherente, 17.1s (latencia distinta entre corridas, consistente con presupuesto de razonamiento diferente — no es una comparación de tiempo controlada, pero confirma que el parámetro se procesó, no fue ignorado por el servidor de OpenRouter); (3) `deepseek/deepseek-v4-flash` (sin `supportsReasoning`) + `effort:'high'` → 200 sin error, respuesta normal — confirma que el descarte silencioso de BACK.3 funciona end-to-end, no solo en el mock. Caso negativo adicional: `effort:'turbo'` (inválido) → 400 `"effort must be one of: low, medium, high"`, antes de gastar ningún token. Confirmado vía `/api/chat/models` real que `deepseek/deepseek-r1` trae `supportsReasoning: true` de OpenRouter (no asumido). Servidor de prueba bajado al cerrar.

**BLOQUE BACK cerrado (2026-06-29)** — BACK.1–BACK.5 resueltos. Catálogo, providers (`openrouter.ts`/`tool-call.ts`) y handler (`chat.ts`) wireados de punta a punta; verificado con dinero real. 9 tests nuevos en 4 archivos (`model-catalog.test.ts`, `openrouter-chat.test.ts` nuevo, `tool-loop.test.ts`, `chat-effort.test.ts` nuevo). Suite completa: 515 pass · 3 fail estables y preexistentes (no introducidos por este bloque) · `tsc --noEmit` limpio en las 3 corridas de verificación.

### BLOQUE FRONT — Selector de esfuerzo en el chat 🧠

- [ ] **FRONT.1** (🧠) `data.js`/`screens-core.js` (selector de modelo del chat): agregar control de esfuerzo (low/medium/high) junto al `<select>` de modelo, oculto/disabled por defecto. Mostrarlo solo cuando `state.orModels` tiene datos reales y el modelo seleccionado actual tiene `supportsReasoning: true` (campo agregado en BACK.4).
- [ ] **FRONT.2** (⚡) Persistir la selección de esfuerzo en `localStorage` (mismo patrón que el estado del sidebar), default `'medium'` cuando el modelo lo soporta. Enviar `effort` en el body de `POST /api/chat` solo si el control está visible.
- [ ] **FRONT.3** (⚡) i18n en/es: claves nuevas para el label del control y sus 3 opciones, en `i18n.js`.
- [ ] **FRONT.4** (🔍 Claude) Verificado en vivo con Playwright contra el dashboard real: cambiar de un modelo sin reasoning a uno con reasoning muestra/oculta el control correctamente; cambiar el esfuerzo y enviar un mensaje confirma (via Network) que el body real incluye `effort` solo cuando corresponde.

---

## EXTRA — Pulido visual del dashboard (fuera de alcance de Mes 14, en paralelo)

**No bloquea el cierre del Mes 14** — es trabajo de UI/UX sobre `src/dashboard/public/`, ortogonal al runner de grafo. Se registra acá para no perderlo de vista, no como bloque formal con 🧠/⚡/🔍.

- [x] (2026-06-25) Sidebar colapsable/expandible (56px ↔ 200px, persistido en `localStorage`), toggle movido arriba (antes estaba al fondo, contra la convención de Hermes/Claude Desktop/VSCode).
- [x] (2026-06-25) Chat convertido en pantalla principal (un solo input, como Open WebUI/Hermes/Claude Desktop). `Tasks`, `Runs`, `Graph Runner`, `Memory` y `Specs` pasaron a modo avanzado (`operator: true`); el flujo "crear tarea desde el chat" (ya existente) sigue funcionando igual.
- [x] (2026-06-25) Terminal/log de runs colapsado por defecto — antes siempre visible.
- [x] (2026-06-25) Settings reorganizado en sub-nav vertical tipo VSCode/Claude Desktop: **General · API & Models · Health · Project · Language** (antes todo apilado en una sola columna).
- [x] (2026-06-25) Fixes puntuales encontrados solo al verificar en vivo con Playwright (no en código estático): `<select>` de modelos sin estilizar (flecha nativa del OS), línea decorativa innecesaria sobre el input del chat, tooltips del sidebar rotos (regresión propia del mismo turno — `overflow:hidden` recortaba el `::after`), `.kv` de Settings→Project sin padding (CSS scope real era `.detail .kv`, no genérico), emojis de banderas/idioma rotos en este entorno (renderizaban como texto literal "us"/"es") reemplazados por SVG/texto plano.
- [x] (2026-06-25) Plugins de diseño instalados a nivel global (`scope: user`, no solo este proyecto): **frontend-design** (oficial Anthropic, ya estaba descargado pero deshabilitado en otro proyecto), **impeccable** (`/impeccable audit/critique/polish`), **taste-skill** (estilos brutalist/minimalist/soft + auditoría de "taste"). Pendiente: usarlos en una sesión nueva (no cargan en la sesión donde se instalaron) y comparar lo que detectan automáticamente contra lo encontrado a mano arriba.
- [x] (2026-06-25) **Usados `/impeccable audit` + `/impeccable critique` reales sobre `src/dashboard/public/`** (no existía `PRODUCT.md` → init rápido de 2 rondas de preguntas, register=`product`, personalidad "Hermes/Claude Desktop con detalles cuidados", criterio de validación = en vivo, no solo código — todo guardado en [PRODUCT.md](PRODUCT.md)). Reporte completo en la sección **AUDITORÍA VISUAL — resultados (2026-06-25)** más abajo. No se aplicó ningún fix todavía — esto es solo el reporte + decisión de alcance.

**Nota honesta**: ninguno de estos cambios tiene test automatizado — es CSS/HTML/JS de dashboard verificado a ojo (Playwright + capturas + hover real), no cobertura de `bun test`. Si se vuelve recurrente, considerar un smoke script de Playwright que navegue cada pantalla y haga hover sobre cada ícono antes de cerrar un cambio visual como éste.

---

### AUDITORÍA VISUAL — resultados (2026-06-25)

**Método**: `detect.mjs` (scan determinístico) corrido sobre todo `src/dashboard/public/` + lectura completa de `styles.css`/`screens.css`/`index.html`/`app.js`/`screens-core.js`/`screens-ops.js` + cálculo real de contraste WCAG (script Node, fórmula de luminancia relativa). El dashboard se levantó real (`bun run cli.ts dashboard`, puerto 4242, `200 OK`) para inspección con Playwright MCP, pero el navegador devolvió "browser already in use" (perfil bloqueado) — **no hubo captura/hover en vivo en esta pasada**, queda pendiente para cuando se apliquen los fixes (Paso 2).

**Audit Health Score: 12/20 (Aceptable)** — A11y 1, Performance 3, Theming 4, Responsive 2, Anti-patrones 2.
**Design Health Score (heurísticas Nielsen): 24/40 (Aceptable)** — más débil en Flexibilidad/eficiencia (1/4, cero shortcuts) y Reconocimiento (2/4, tooltips no accesibles).

**Veredicto anti-patrones**: no hay slop flagrante (sin gradient text, sin hero-metric, sin glassmorphism decorativo). Pero sí 2 tells reales activos por *default* (no en una skin opcional):
- **Side-tab accent border** en 4 lugares activos siempre: `.proposal-card` (screens.css:369), `.proj-helper` (391), `.spec-explainer` (413), `.detail` (421).
- **Jerarquía tipográfica plana** confirmada por el detector en `tasks.html`, `runs.html`, `instincts.html`, `specs.html`: 5 tamaños entre 12-20.8px, ratio máx 1.7:1 entre pasos.

**Hallazgos por severidad** (ninguno arreglado todavía):
- **[P1] Navegación por teclado rota en toda la app** — `.nav-icon` (sidebar completo, app.js:1270), `.mem-card` (screens-core.js:734), `tr.row` de Runs/Specs (screens-ops.js:336,896) son `<div>`/`<tr>` con `onclick`, sin `tabindex`/`role`/handler de teclado. Los `<button>` reales (modal, settings-nav, proj-tab) sí están bien. WCAG 2.1.1.
- **[P1] Contraste real que falla WCAG** — medido: `--text-faint` (#6e7681) sobre `--bg` = 4.12:1 (falla, mínimo 4.5:1), sobre `--surface-2` = 3.48:1 (falla). `.terminal .body .ln.dim` (#2b6e36) sobre `--term-bg` = 3.31:1 (falla, casi ilegible). Dato clave: el verde *principal* de terminal (`--term-green` #3fb950) en realidad mide 8.08:1 — sobra contraste. El problema real no es "el verde es muy fuerte" (hipótesis original), es que la variante **dim** del mismo verde quedó *demasiado débil*.
- **[P2] Sin `prefers-reduced-motion` en ningún archivo** — 0 coincidencias en todo `public/`. Relevante porque el init de hoy fijó WCAG AA + reduced-motion como piso de accesibilidad del producto.
- **[P2] Layout-property transitions** — styles.css:195 (`max-width, margin-left` en `.nav-label` del sidebar) y styles.css:370 (`height, padding` en colapso de terminal) — reflow en cada frame, no crítico pero medible.
- **[P3] CSS muerto** — todo el sistema `.kanban`/`.kcol`/`.kcard` (screens.css:125-170, ~46 líneas, incluida la variante `body[data-cards="barred"]`) no se renderiza en ningún `.js`/`.html` del proyecto. Nadie usa ese tablero.

**Comparación contra los 6 puntos pendientes originales**:
| Punto original | ¿Coincide con el plugin? |
|---|---|
| 1. Profundidad (modal/panel/compose) | Parcial e invertido: modal y side-panel **ya tienen** sombra+blur+curva propia (`box-shadow: 0 24px 70px`, `cubic-bezier(.3,.7,.4,1)`). El único 100% plano es **el compose-bar del chat** (`.chat-input-bar`, solo gradiente de máscara, sin sombra). |
| 2. Jerarquía tipográfica | Sí, exacto — confirmado por el detector. |
| 3. Microinteracciones sin overshoot | Sí, indirecto — `.kcard:hover`/`.mem-card:hover` solo cambian `border-color`/`background`, sin `transform`. |
| 4. Estados vacíos genéricos | No detectado automáticamente — el plugin no tiene regla para "falta personalidad", se confirmó leyendo `.placeholder` a mano. |
| 5. Contraste del terminal | Detectado pero al revés de la hipótesis — ver hallazgo P1 arriba. |
| 6. Command palette (Cmd/Ctrl+K) | Sí, vía heurística #7 (Flexibilidad) — cero shortcuts en todo el código. |

**Lo que el plugin encontró y no estaba en la lista original**: navegación por teclado rota (P1), contraste real que falla WCAG (P1), falta `prefers-reduced-motion` (P2), CSS muerto del Kanban (P3), responsive = 0 (`grep` de `@media` en todo `public/` no devuelve nada).

**Decisión de alcance (2026-06-25)**: los 2 hallazgos P1 nuevos (teclado roto, contraste real) **se suman** al alcance de esta pasada de fixes, junto con los 6 puntos originales. **Orden de aplicación todavía no decidido** — pendiente confirmar antes de tocar el primer archivo.

**Reglas para aplicar los fixes (ya acordadas)**: uno por uno, vanilla CSS sobre los tokens de `:root` (sin Tailwind/librerías), dark-only, verificar cada uno en vivo con Playwright (captura + hover/focus real) antes de marcarlo como hecho — varias regresiones reales de la sesión anterior solo se vieron así, no en CSS estático.

**Pendiente técnico para la próxima sesión**: el navegador Playwright MCP devolvió "already in use" (perfil bloqueado en `ms-playwright-mcp\mcp-chrome-d4c25a7`) — revisar si hay un proceso chrome huérfano de una sesión anterior antes de retomar la verificación en vivo.

### Aplicación de fixes (en progreso)

- [x] (2026-06-26) **[Ítem 6, sub-pieza 1/4] Profundidad del compose-bar del chat** — `.chat-input-bar textarea` (screens.css) era el único elemento 100% plano (solo gradiente de máscara, sin sombra). Agregado `box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 10px 28px rgba(0,0,0,.45)` (highlight sutil arriba + sombra ambiente abajo — un shadow negro plano sobre `--bg` casi negro es invisible, por eso se combinó con el highlight para dar sensación de "elevado"). En `:focus` se suma el ring de accent existente. **Verificado en vivo con Playwright**: capturas antes/después muestran la sombra visible; el foco muestra borde accent + sombra + ring; confirmé que escribir sigue funcionando (sin reintroducir el bug del loop).
- [x] (2026-06-26) **[Ítem 6, sub-pieza 2/4] Jerarquía tipográfica plana (ratio 1.7:1)** — el hallazgo del audit apuntaba a `tasks.html`/`runs.html`/`instincts.html`/`specs.html`, **no** a las pantallas vivas del SPA (que ya tienen buen rango: h1=19px, body=12-13px). Investigué y confirmé que esos 4 archivos son HTML estáticos servidos por `serveStatic()` pero sin ningún link desde la SPA (grep no encontró referencias fuera de PLAN.md) — parecían dead code, pero el usuario confirmó que son vistas de tabla intencionales para uso avanzado (complemento al chat: ver progreso de tasks/runs en tabla), deben quedar ocultas (sin link en nav) pero no borrarse. Decisión: mantenerlos y arreglar la tipografía. Cambié de 5 tamaños dispersos (12/12.48/13.12/13.6/20.8px, ratio 1.73:1) a 2 niveles limpios: h1 `1.125rem` (18px) + todo el resto (tabla, links, badges, mono, botones, toast) en `.75rem` (12px) — ratio 1.5:1, sin cluster intermedio. El hook de impeccable confirmó el fix: primero flagueó `flat-type-hierarchy` por un cluster 12-13px que quedó tras el primer ajuste, lo corregí colapsando a 2 tamaños, y en la segunda pasada el hook reportó "No deterministic design-quality issues found" en las 4 archivos. **Verificado en vivo con Playwright**: las 4 páginas cargan datos reales (tasks.html mostró 5 tareas reales del proyecto) y renderizan bien con la nueva escala; runs/specs/instincts mostraron sus empty states correctamente.

- [x] (2026-06-26) **[Ítem 6, sub-pieza 3/4] Estados vacíos sin personalidad** — `.placeholder .pic` (styles.css) usaba siempre el mismo ícono gris plano (`var(--surface-2)` + `var(--text-faint)`), idéntico en Memory/Tasks/Runs/Specs/Skills/Instincts/Graph Runner, sin distinción ni calidez. Cambiado a `background: var(--accent-soft)` + `color: var(--accent)` (mismo tinte de accent ya usado en badges "running" — no es un color nuevo, es reutilizar el lenguaje de color existente), ícono agrandado 42→48px con radio 10→12px. Agregada animación de entrada sutil (`placeholder-in`: fade + scale .97→1, .3s ease-out) para que no se sienta estático. **Verificado en vivo con Playwright**: capturé el empty state de Specs — el ícono ahora tiene tinte azul reconocible en vez de gris genérico; confirmé que la animación respeta `prefers-reduced-motion` (colapsa a 0.01ms vía el override global del punto anterior, sin tener que repetir la regla).

- [x] (2026-06-26) **[Ítem 6, sub-pieza 4/4] Command palette (Cmd/Ctrl+K)** — implementada versión mínima (alcance acordado con el usuario: solo navegación, sin acciones complejas en esta pasada). `Modal.openCommandPalette()` (app.js) reutiliza el patrón existente de `Modal` (scrim + `.modal`), lista las 10 pantallas de `NAV` (filtrando ítems `operator` si no está en modo avanzado, mismo criterio que `buildNav()`), con input de búsqueda por substring sobre el label traducido, flechas ↑↓ para mover selección, Enter para navegar (`App.go(id)`), Escape para cerrar, click/hover también funcionan. Listener global en `boot()` para `Cmd/Ctrl+K`. Nuevos estilos `.cmdk-*` en screens.css reutilizando tokens existentes (`--accent-soft` para el ítem activo, mismo radius/shadow que `.modal`). Nuevas keys i18n `cmdk.placeholder`/`cmdk.empty`/`cmdk.hint` en inglés y español. **Verificado en vivo con Playwright**: Ctrl+K y Meta+K (Cmd) abren el palette; escribir "spe" filtró correctamente a solo "Specs"; Enter navegó a la pantalla Specs y cerró el modal; flechas ↓↓ movieron la selección de Chat a Instincts; Escape cerró sin navegar. Sin reintroducir el bug del loop de chat (probado por separado, sigue resuelto).

- [ ] (2026-06-26) **[No es un bug — config pendiente del entorno] Buscador de modelos desapareció del Chat** — `buildModelSelect()` (app.js:1180) tiene 3 ramas según `state.orModels`: `null` → lista estática `KNOWN_MODELS` + botón "Select model ↓" **sin input de búsqueda**; `[]` → "loading…"; array real con datos → select + **input de búsqueda** (`.model-search`) + botón refresh. Como `OPENROUTER_API_KEY` falta (visible en Setup → "Required"), `/api/chat/models` devuelve 400 y `state.orModels` queda en `null` permanentemente esta sesión → el Chat cae en la rama sin buscador por diseño (es el fallback intencional, no una regresión introducida en esta sesión). **No requiere cambio de código** — se resuelve agregando la key real vía Setup → "Configure now". Queda anotado sin marcar como hecho porque la acción pendiente es del usuario, no de Claude.

- [x] (2026-06-26) **[Bug fuera de los 6 ítems, encontrado durante verificación en vivo] Chat no permitía escribir** — causa raíz: `loadOrModels()` falla (falta `OPENROUTER_API_KEY`) y deja `state.orModels = null`; el `wire()` del chat (screens-core.js:218) y de tasks (screens-core.js:546) y `Modal.openTask` (app.js:498) chequeaban `=== null` para auto-cargar, y como el fetch fallido siempre vuelve a poner `null`, cada fallo disparaba `App.rerender()` que volvía a montar el `wire()` y a re-disparar el fetch — loop infinito de fetch+rerender que destruía el `<textarea>` del chat en cada vuelta, borrando lo que el usuario escribía. Fix: agregado flag `state.orModelsAttempted` (app.js) que se marca `true` tras el primer intento (éxito o fallo) y se chequea junto con `=== null` en los 3 sitios, así el auto-load solo se dispara una vez por sesión (el botón "refresh" sigue forzando reintento manual con `force=true`). **Verificado en vivo con Playwright**: antes del fix, navegar a Chat generaba >180 requests fallidos a `/api/chat/models` en segundos; después del fix, solo 1. Escribí texto en `#chat-input` vía JS y confirmé que persiste sin borrarse tras 3s (antes el DOM se destruía en cada rerender del loop).

- [x] (2026-06-26) **[P1] Navegación por teclado** — agregado `tabindex="0"` + `role="button"` + handler `keydown` (Enter/Espacio → `.click()`) a `.nav-icon` (app.js), `.mem-card` (screens-core.js), `tr.row` de Runs y Specs (screens-ops.js). Agregado `:focus-visible` con outline `--accent` en styles.css/screens.css (no existía ningún estilo de foco antes). **Verificado en vivo con Playwright** contra `localhost:4242`: Tab+Enter en `.nav-icon` navegó correctamente a la pantalla "Project" igual que un click, con anillo de foco visible. `.mem-card` y `tr.row` **no se pudieron verificar visualmente** — el entorno dev no tiene memory/runs/specs con datos (todo vacío) — pero usan el mismo patrón ya confirmado. Hallazgos preexistentes del hook de impeccable (side-tab borders en screens.css, layout-transitions en styles.css:196/371) quedaron fuera de alcance — no forman parte de esta lista de 6 ítems.
- [x] (2026-06-26) **[P1] Contraste WCAG** — `--text-faint` cambiado de `#6e7681` a `#8a929c` (ahora 6.01:1 sobre `--bg`, 5.08:1 sobre `--surface-2`, ambos superan el mínimo 4.5:1; antes fallaba: 4.12:1 y 3.48:1). `.terminal .body .ln.dim` cambiado de `#2b6e36` a `#3a8c44` (ahora 4.90:1 sobre `--term-bg`, antes 3.31:1, casi ilegible). Cálculo vía fórmula de luminancia relativa WCAG. **Verificado en vivo con Playwright**: inyecté líneas de prueba reales en `#termBody` (`.ln` y `.ln.dim`) y confirmé visualmente que el texto dim ahora es legible sobre el fondo del terminal (antes se perdía); confirmé el valor computado de `--text-faint` vía `getComputedStyle`. DOM de prueba revertido al estado original (colapsado) al terminar, sin tocar datos reales.
- [x] (2026-06-26) **[P2] `prefers-reduced-motion`** — agregado override global al final de styles.css (`*, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }` dentro de `@media (prefers-reduced-motion: reduce)`), patrón estándar que cubre todas las transitions/animations existentes (pulse, spin, sidebar, terminal, toasts, etc.) sin tener que tocar cada regla una por una. **Verificado en vivo con Playwright** (`page.emulateMedia({ reducedMotion: 'reduce' })`): confirmé que `transition-duration` de `.nav-label` y `animation-duration` del `.dot` de pulse colapsan a 0.01ms con la preferencia activa, y vuelven a sus valores normales (0.16s/0.1s/0.16s) sin la preferencia — sin regresión del motion normal.
- [x] (2026-06-26) **[P3] CSS muerto del Kanban** — eliminadas ~46 líneas de `.kanban`/`.kcol`/`.kcard` (screens.css:125-171), incluida la variante `body[data-cards="barred"]`. Confirmado con grep que ningún `.js`/`.html` del proyecto referencia esas clases (solo `data-cards="flat"` queda en index.html, sin efecto). **Verificado en vivo con Playwright**: la app cargó sin errores nuevos en consola tras el borrado (mismos 3 errores 400 preexistentes de `/api/chat/models`).
- [x] (2026-06-26) **[P2] Layout-property transitions** — `.sidebar .nav-label` (styles.css:193) ya no anima `max-width`/`margin-left`; ahora usa `width: 0 → auto` instantáneo (no transicionado) + `transition: opacity` únicamente (fade-in al expandir el sidebar). `.terminal` (styles.css:340) se reestructuró como grid de 2 filas (`auto 130px` ↔ `auto 0px`) con `transition: grid-template-rows` en el contenedor — el idioma explícitamente permitido por la guía para animaciones de altura — y `.terminal .body` ya no anima `height`/`padding` (el padding quedó fijo, clippeado por `overflow:hidden` + `min-height:0` cuando colapsa). **Verificado en vivo con Playwright**: expandí/colapsé el sidebar y el terminal varias veces — visualmente idénticos al comportamiento anterior, sin franjas de padding sobrantes ni saltos de layout. Confirmé vía `getComputedStyle` que `.terminal` solo transiciona `grid-template-rows` y `.nav-label` solo `opacity` — ninguna transition restante sobre propiedades de layout (`height`/`width`/`padding`/`margin`).

**Si continúas desde otra máquina (ej. Mac en casa)**: los plugins de diseño usados acá (`impeccable`, `taste-skill`, `frontend-design`) están instalados a nivel de **usuario** en esta PC (`scope: "user"`, bajo `~/.claude/plugins`), **no viajan con `git pull`** — solo el código y este `PLAN.md`/`PRODUCT.md` (que sí están commiteados) viajan. Para tenerlos disponibles en la otra máquina, correr en una sesión de Claude Code ahí:

```
/plugin marketplace add https://github.com/pbakaus/impeccable.git
/plugin marketplace add https://github.com/Leonxlnx/taste-skill.git
/plugin marketplace add anthropics/claude-plugins-official

/plugin install impeccable@impeccable
/plugin install taste-skill@taste-skill
/plugin install frontend-design@claude-plugins-official
```

Como `PRODUCT.md` ya queda commiteado en el repo, una vez instalados los plugins ahí `/impeccable audit/critique/polish` arrancan directo, sin pedir el init de nuevo.

---

## MES 13 — OrchestOS conectado: del aislamiento al conocimiento externo

- [x] **SÍ — Mes 13 cerrado (2026-06-23)**
  Pre-flight de UI (edición de skills real, ícono YAML, TTL+refresh de modelos). Web fetch real en el chat (`runToolLoop()` multi-turno + guard SSRF) — 2 bugs reales corregidos solo al verificar en vivo (falso positivo SSRF por `dns.resolve4()`, arity de `executeFetchUrl`). Registro de skills de la comunidad (217 reales, `idleTimeout` corregido) + prompt del curador ajustado para que `description` sea condición de disparo, no resumen. 468 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 12 — Endurecimiento: red de seguridad antes de la autonomía

- [x] **SÍ — Mes 12 cerrado (2026-06-19)**
  Tests del motor crítico (`contract.ts`, `scheduler.ts`) con gate de mutación confirmado contra regresión real. CI en GitHub Actions bloqueando PRs rotos (verificado en vivo, PR #2) + pre-commit hook + `noUnusedLocals`. XSS cerrado con payload real probado en el dashboard corriendo. `server.ts` partido de 1727 a 159 líneas en 13 módulos, re-verificado línea por línea sin cambios de comportamiento. 421 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 11 — OrchestOS como experto: autoría de skills con curador

- [x] **SÍ — Mes 11 cerrado (2026-06-10)**
  Curador LLM (`/api/skills/curate`, retry hasta 2 veces) + pantalla Skills con tres puertas (escribir · importar · exportar) + pack "pro" de 8 skills de ingeniería en `skills/pro/` importables con un click + paridad CLI (`skill curate`/`skill import`). 402 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 4 — Routing inteligente + skills que se adaptan al proyecto

- [x] **SÍ — Mes 4 cerrado (2026-05-27)**
  Routing activo (`config show`), 11 skills, language_targets, CONSTITUTION.md en system prompt, `context compress` genera CONTEXT.md, `runs --detail` reporta tokens.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 5 — Confiabilidad para uso diario: e2e real + sandbox + spec-driven

- [x] **SÍ — Mes 5 cerrado (2026-05-28)**
  Sandbox por git worktree (S19), Spec-Driven con gate en harness (S20), resolvers multi-lenguaje + autoskills fetch (S21), sub-agentes con context isolation + memoria persistente + tool policy (S22). 110 tests · 0 fail. Smoke real sub-agentes: write-greeting→write-response (44s, memory_entries escritas). selectMemories bug corregido (depIds ID→topic_key resolution).
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 6 — IA con ROI demostrable + observabilidad de sub-agentes

- [x] **SÍ — Mes 6 cerrado (2026-05-28)**
  S23 function calling planner (elimina errores YAML estructuralmente), S24 embeddings semánticos (`embed_hits` en runs), S25 diagnóstico de fallos auto-trigger en `failed_permanent`, S26 BM25 conflict detection en memoria.
  `embed_hits > 0` en 12 runs reales · 212 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 7 — Observabilidad activa + calidad del pipeline

- [x] **SÍ — Mes 7 cerrado (2026-06-02)**
  S27 context-monitor wired (warnings persistidos en DB + visibles en `runs --detail`), S28 WHEN/THEN acceptance criteria (`spec lint` + draft prompt + QA prompt), S29 spec archive (`spec archive` + `spec list --all`), S30 aprendizaje continuo v1 (`runs --analyze` + hook post-completion en `task run`). 256 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 8 — Pipeline robusto + aprendizaje activo

- [x] **SÍ — Mes 8 cerrado (2026-06-02)**
  S31 middleware chain (10 middlewares de enrichment, harness refactorizado), S32 capabilities contract + delta headers en specs, S33 instincts con confidence scoring, S34 continuous learning v2 (runs→instincts loop cerrado), S35 cost tracker por sub-agente, S36 dashboard local Bun + vanilla JS (4 vistas desde SQLite).
  369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 9 — Dashboard usable: de observador a orquestador

- [x] **SÍ — Mes 9 cerrado (2026-06-04)**
  Dashboard convertido en interfaz principal: 10 bloques (A–J), input natural con preview IA, i18n en/es, instalador de un solo archivo, chat panel + model selector shipeados fuera de plan. 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 10 — El producto que alguien que nunca programó puede usar

- [x] **SÍ — Mes 10 cerrado (2026-06-04)**
  Wizard API key (3 proveedores, validación real, rollback en 401) · toggle humano/operador navegable con persistencia · diagnóstico de fallos en Tasks · archivos en Chat · Control Center con 5 bloques de salud · Ollama auto-detectado · 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---
