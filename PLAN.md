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
- [ ] **A2** (⚡) `src/run/graph-runner.ts`: traversal topológico que recorre el DAG completo. Una rama que agota retries marca sus dependientes como bloqueados con razón explícita y **continúa las ramas independientes** (no `break` global). Devuelve un `GraphRunResult` con outcome por tarea.
- [ ] **A3** (🧠/⚡) Integrar `diagnoseTask()` (S25) en el loop: al llegar a `failed_permanent`, llamar diagnose y aplicar la estrategia de A1 automáticamente, sin pedir permiso por decisión individual.
- [ ] **A4** (⚡) Circuit breaker: tope de costo acumulado (`--max-cost`, reusa `cost_notice` del context-monitor), tope de wall-clock y de iteraciones totales. Un loop autónomo no se desboca — al cruzar el umbral, se detiene y notifica.

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

- [ ] **B1** (⚡) `orchestos run --graph [path] [--max-cost N] [--max-minutes N] [--dry-run]`: recorre el DAG completo, imprime progreso por tarea, y un resumen final.
- [ ] **B2** (⚡) Reporte de cierre: tabla outcome por tarea (completada sola · reintentada-y-resuelta · rama bloqueada) + **métrica de autonomía** (tareas completadas sin intervención / total). `--dry-run` muestra el orden topológico y los gates sin gastar tokens.

### BLOQUE C — Superficie en el dashboard ([[feedback-dashboard-no-solo-cli]])

- [ ] **C1** (🧠) Endpoint `POST /api/run/graph` (lanza el runner en background) + `GET /api/run/graph/status` (progreso + outcome parcial). Wiring en `server.ts` siguiendo el patrón de los handlers existentes.
- [ ] **C2** (⚡) Pantalla "Runner de grafo": botón "Ejecutar todo el plan", progreso en vivo por tarea, ramas bloqueadas resaltadas, métrica de intervención visible. Reusa el auto-refresh de la vista Runs.
- [ ] **C3** (⚡) i18n en/es de las cadenas nuevas.

### BLOQUE D — Tests + verificación en vivo

- [ ] **D1** (⚡) Tests unitarios de `graph-runner.ts`: happy path completo · una rama falla → dependientes bloqueados **y ramas independientes completan** · circuit breaker de costo dispara · retry guiado por diagnose. Mock del executor, no del grafo.
- [ ] **D2** (🔍 Claude, [[feedback-verificar-gates-en-vivo]]) Gate en vivo contra el **dashboard real corriendo** (no mocks): lanzar el runner desde la pantalla C2 sobre un `tasks.yaml` con una rama que falla a propósito; verificar que el grafo no se detiene, la rama se bloquea, y las independientes terminan. Los mocks pueden esconder bugs del wiring real.
- [ ] **D3** (🔍 Claude) Smoke real end-to-end: `tasks.yaml` real de OrchestOS o CitasBot, medir **intervención = 0 en el happy path**. Registrar en `docs/E2E.md`.

### BLOQUE E — Cierre del Mes 14 ([[feedback-orden-desarrollo]] — 4 acciones obligatorias)

- [ ] **E1** Mover IDEAS.md #9 (runner de grafo autónomo) → DONE.md con resumen y commits.
- [ ] **E2** Cerrar esta sección con `[x]` + fecha + tabla de estado de bloques A–E.
- [ ] **E3** Limpiar PLAN.md: dejar solo el resumen del Mes 14 cerrado, `status: mes-15-pendiente`.
- [ ] **E4** Pre-flight del Mes 15 + actualizar la memoria del proyecto.

**Métrica de éxito Mes 14**: `orchestos run --graph` recorre un `tasks.yaml` real completo sin intervención humana en el happy path; ante un fallo, bloquea solo la rama afectada (las independientes completan) y la decisión retry/bloqueo la toma diagnose, no el humano. Verificado **en vivo en el dashboard**, no solo en tests. Tests verdes · 0 fail.

**Reglas de seguridad innegociables**: el runner autónomo **solo recorre tareas internas** (LLM → contract → QA → worktree) — no ejecuta acciones outward-facing ni destructivas (eso es territorio del cliente MCP, eje propio posterior). El circuit breaker de costo/tiempo es obligatorio, no opcional.

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
