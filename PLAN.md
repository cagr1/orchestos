---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-15-en-curso
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

## MES 15 — Dashboard usable en pruebas reales: reset, diagnóstico, grafo accionable, memoria buscable

**Status: en curso.** Origen: dogfooding real en MacBook (2026-07-01) tratando de correr `crear-web-local-comercial` desde cero. Se encontraron 2 bugs bloqueantes ya arreglados en el camino (fuera de este plan, no repetir):
1. `src/run/sandbox-policy.ts` — el check de "uncommitted changes" se disparaba ANTES de mirar si el usuario pidió `--sandbox=cwd`, así que ese flag nunca lograba saltarse el check aunque no fuera a crear worktree. Fix: mover el `if (preferred === 'cwd')` al inicio, antes del check de git status.
2. `src/run/harness.ts` — `maxTokens = contextWindow - promptTokens` sin margen de seguridad causaba overflow real contra OpenRouter (`estimateTokens` es aproximado, no la tokenización real del proveedor). Fix: `SAFETY_MARGIN = 1024` restado del presupuesto disponible.

Además, verificando en vivo (no solo con tests) aparecieron 4 problemas de producto — el motor de abajo en varios casos ya soporta lo necesario, pero no está expuesto en dashboard/CLI. Investigación completa ya hecha (3 agentes Explore + 1 agente Plan, sesión 2026-07-01) — detalle técnico completo abajo para que cualquier LLM (Claude o delegado) pueda retomar un bloque sin tener que re-investigar.

**Regla de reuso — no duplicar lógica de retry**: Bloque C reutiliza literalmente el endpoint que crea/extiende el Bloque B (`POST /api/tasks/:id/run`). B debe cerrarse antes de abrir C.

**No tocar** `src/run/sandbox-policy.ts` ni `src/run/harness.ts` en ningún bloque de este mes — ya arreglados arriba, fuera de alcance.

**Cómo trabajar este checklist**: bajar hasta la primera tarea con `[ ]`, hacer SOLO esa (no seguir con la siguiente aunque sea trivial), marcarla `[x]` con fecha, parar. Así cualquier LLM que retome sabe exactamente dónde va sin re-leer todo el bloque. Un bloque (A, B, B2...) NO es una unidad de trabajo — es solo agrupación temática; la unidad real es cada línea `[ ]`.

### Bloque 0 — Pre-flight
- [x] 0.1 🧠 Investigación completa (diagnose/retry, graph-runner, memoria/chat) + 2 bugfixes bloqueantes de sandbox/contexto (2026-07-01)

### Bloque A — Reset de datos de prueba
- [x] A.1 🧠 Diseño de scope: qué se borra/resetea (`runs`, `instincts` no verificados, tasks→pending) y qué NO se toca (`memory_entries`/`memory_fts`/config/skills/`CONSTITUTION.md`/`CONTEXT.md`) — ver detalle técnico abajo
- [x] A.2 ⚡ `resetTestData(root): ResetSummary` en `src/db/reset.ts`
- [x] A.3 ⚡ CLI `orchestos reset --yes`
- [x] A.4 ⚡ Endpoint `POST /api/system/reset` (`src/dashboard/handlers/system.ts`) + wiring en `server.ts`
- [x] A.5 ⚡ Botón en Settings (`screens-ops.js`) con `window.confirm(...)` inline + strings i18n en/es
- [x] A.6 🔍 Verificar en vivo (2026-07-01): `reset` sin `--yes` aborta (exit 1); con `--yes` deja `runs`=0, `instincts`=0 (los 23 originales eran todos sin verificar), `tasks.yaml` 9/9 pending, `memory_entries` intacto (20). Repetido desde el botón de Settings vía Chrome DevTools (confirm nativo → `POST /api/system/reset` → 200 → `App.fetchAll()`), sin tocar memoria. Pendiente: commitear (aún sin `git add`)

### Bloque B — Diagnose: exponer motivo real del fallo
- [x] B.1 ⚡ `lastErrorResult?: string` en `DiagnoseResult` (`diagnose.ts`) y `DiagnoseRow` (`types.ts`), calculado desde `listRunsByTaskId`
- [x] B.2 ⚡ Pasar `lastErrorResult` en la respuesta real de `handleApiTasksDiagnose` (`src/dashboard/handlers/tasks.ts:118-137`) — HOY el campo existe en el tipo pero el handler todavía no lo incluye en el JSON de respuesta
- [x] B.3 ⚡ Render en `diagnoseDetail(d)` (`screens-core.js:358-387`): bloque `<pre>` con el texto crudo si `d.lastErrorResult` existe
- [x] B.4 🔍 Verificar en vivo (2026-07-01): insertado un run sintético `failed` con marcador único para `s21-6-integrate-resolvers`; `GET /api/tasks/:id/diagnose` real (llamada LLM real, no mock) devolvió `lastErrorResult` con el texto íntegro; en el dashboard (Tasks, modo avanzado) el panel "View diagnosis" renderiza el bloque "Last Error Output" con el marcador visible. Run sintético borrado y `tasks.yaml` revertido a pending tras la prueba (sin residuos)

### Bloque B2 — Retry con modelo alternativo (destraba C)
- [ ] B2.1 🧠 CLI: `--model <model>` override transitorio en `task run` (no persiste en `tasks.yaml`)
- [ ] B2.2 🧠 `handleApiTasksRun` (`tasks.ts:84`, hoy `(url: URL): Response` síncrona) → convertir a `async (req: Request, url: URL)`, leer `{model?}` del body, pasar `--model` al spawn
- [ ] B2.3 🧠 Bug fix sutil: resetear `task.status='pending'` (vía `saveTasks`) antes del spawn si no está en pending — hoy `handleApiTasksRun` no valida status mientras `runSingleTask` (`cli.ts:939`) sí bloquea `failed_permanent`. Revisar con cuidado, este fix es el prerequisito real de C
- [ ] B2.4 ⚡ `server.ts`: pasar `req` (no solo `url`) a `handleApiTasksRun`
- [ ] B2.5 ⚡ Frontend: selector de modelo en el panel de diagnóstico reusando `buildModelSelect()` (`screens-core.js:416` — NO `buildModelCombo()`, que es del chat)
- [ ] B2.6 🔍 Verificar en vivo (checklist "B/B2" abajo)

### Bloque C — Graph Runner accionable (depende de B2 cerrado)
- [ ] C.1 ⚡ Inputs `maxCost`/`maxMinutes` en la UI antes de lanzar (`screens-ops.js:397-545`) — el backend ya los acepta (`run-graph.ts:47-114`), falta solo el input
- [ ] C.2 ⚡ Botón Retry por fila con `outcome==='failed_permanent'||'blocked'` que llama al mismo endpoint de B2 — cero lógica nueva de retry en `graph-runner.ts`
- [ ] C.3 🔍 Verificar en vivo (checklist "C" abajo)
- Fuera de alcance a propósito: pause/cancel de una corrida en curso (dejar comentado como deuda conocida, no implementar)

### Bloque D0 — Diagnóstico previo de memoria (bloquea D)
- [ ] D0.1 🧠 Verificar en vivo si "no veo detalle en memoria" es bug real o falta de affordance visual — el expand/collapse ya existe en código (`screens-core.js:840-848`). Si el fix real es CSS, no construir UI nueva; documentar el resultado aquí antes de abrir D

### Bloque D — Memoria buscable
- [ ] D.1 🧠 `GET /api/memory?q=` con `JOIN memory_fts ... MATCH ? ORDER BY bm25(memory_fts)`, sanitizando el query (`"${q.replace(/"/g,'""')}"*`)
- [ ] D.2 ⚡ Conectar el buscador del dashboard (`screens-core.js:754-851`, hoy filtra por substring en cliente) al nuevo `?q=`
- [ ] D.3 🧠 `SEARCH_MEMORY_TOOL` en `src/providers/tool-call.ts` (mismo patrón que `FETCH_URL_TOOL`) + router multi-tool en `ToolExecutor` (`tool-call.ts:267`, hoy un único callback `(toolName,input)=>Promise<string>`)
- [ ] D.4 ⚡ `executeSearchMemory` en `chat.ts` (mismo patrón que `executeFetchUrl`)
- [ ] D.5 🔍 Verificar en vivo (checklist "D" abajo)

### Cierre del mes
- [ ] E.1 🧠 Cierre formal del mes (4 acciones obligatorias — ver [[feedback-orden-desarrollo]]): IDEAS→DONE, tabla de estado, PLAN.md limpio, pre-flight del mes siguiente

### Detalle técnico por bloque

**A — Reset.** Borra `runs` (tabla completa) e `instincts` con `verified=0`; resetea cada task en `tasks.yaml` a `status:'pending'` limpiando `retry_count`/`retry_reason`/`qa_verdict`/`run_id` (NO borra las tasks definidas). **No tocar** `memory_entries`/`memory_fts`/config/skills/`CONSTITUTION.md`/`CONTEXT.md`. `resetTestData(root): ResetSummary` en `src/db/reset.ts`, reusado por CLI y por `POST /api/system/reset` (nuevo `src/dashboard/handlers/system.ts`). Frontend: card en `SCREENS.settings` (`screens-ops.js`) con `confirm()` nativo — este código NO tiene modal reusable, el patrón real es `window.confirm(...)` inline (ver `app.js:418`, `screens-ops.js:517`).

**B — Diagnose sin motivo visible.** `diagnoseTask()` en `src/agents/diagnose.ts` ya lee `listRunsByTaskId(taskId)` para armar el prompt, pero `handleApiTasksDiagnose()` en `src/dashboard/handlers/tasks.ts:118-137` solo devuelve `{taskId,pattern,confidence,suggestion,details}` — nunca el `result` crudo del run fallido, que sí existe en la tabla `runs`. Fix: agregar `lastErrorResult?: string` a `DiagnoseResult` y a `DiagnoseRow` (`src/dashboard/types.ts:80-86`, campo opcional, no rompe contrato). Render en `screens-core.js` `diagnoseDetail(d)` (líneas 358-387): bloque `<pre>` con el texto crudo si `d.lastErrorResult` existe.

**B2 — Retry existe pero sin modelo alternativo.** El botón Retry YA funciona (`screens-core.js:709-726` → `POST /api/tasks/:id/run` → `handleApiTasksRun` en `tasks.ts:84`, hoy `function handleApiTasksRun(url: URL): Response` síncrona sin leer body). Falta: (1) `--model <model>` en `cli.ts task run` como override transitorio, aplicado como `opts?.model ?? t.executor_model` al construir las opts para `runTask()`; (2) cambiar `handleApiTasksRun` a `async (req: Request, url: URL)`, leer `{model?}` del body, pasar `--model` al spawn; (3) **bug real encontrado en la revisión**: `handleApiTasksRun` ya carga `task` (línea 91) pero nunca valida su status, mientras que `runSingleTask` en `cli.ts:939` bloquea silenciosamente `status==='failed_permanent'`. Fix: resetear `task.status='pending'` (vía `saveTasks`) antes del spawn si no está en pending — esto es lo que permite que Retry funcione sobre tareas bloqueadas/`failed_permanent` y es el prerequisito real de C. Actualizar `server.ts` para pasar `req`. Frontend: reusar `buildModelSelect()` (`screens-core.js:416`, NO `buildModelCombo()` que es del chat) en el panel de diagnóstico.

**C — Graph Runner solo visor.** Backend ya reutiliza `runTask()` del harness por debajo (`graph-runner.ts` línea ~384) — mismo motor que el runner normal. `POST /api/run/graph` ya acepta `{maxCost?, maxMinutes?}` (`run-graph.ts:47-114`) pero la UI (`screens-ops.js:397-545`) no tiene inputs para editarlos, solo un botón "RUN GRAPH" fijo. Agregar los inputs + botón Retry por fila con `outcome==='failed_permanent'||'blocked'` que llama al mismo endpoint de B2 — cero lógica nueva de retry en `graph-runner.ts`.

**D0/D — Memoria.** Tabla `memory_entries` (`src/db/migrate.ts:69-78`) ya guarda `content` completo sin truncar, y ya existe `memory_fts` (FTS5 con BM25) indexando `content`+`topic_key` — construida pero sin usar en ningún endpoint. `GET /api/memory` (`handlers/memory.ts:6-25`) no soporta `?q=`; el frontend (`screens-core.js:754-851`) filtra por substring en cliente sobre los 200 rows ya cargados. El expand/collapse de las cards (líneas 840-848) ya funciona en el código — confirmar en vivo antes de asumir que hace falta una vista de detalle nueva; puede ser solo falta de affordance visual. Fix real: `?q=` con `JOIN memory_fts ... MATCH ? ORDER BY bm25(memory_fts)`, sanitizando el query (`"${q.replace(/"/g,'""')}"*`) porque FTS5 MATCH rompe con `-`/`"` sin escapar. Chat: `src/providers/tool-call.ts` tiene `FETCH_URL_TOOL` como precedente de tool-loop (Mes 13/A) — agregar `SEARCH_MEMORY_TOOL` igual, y `executeSearchMemory` en `chat.ts` (mismo patrón que `executeFetchUrl`). Ojo: `ToolExecutor` (`tool-call.ts:267`) es un único callback `(toolName,input)=>Promise<string>`, no un mapa — con 2 tools hace falta un router pequeño por nombre dentro de un solo `executeTool` pasado a `runToolLoop`.

### Checklist de verificación en vivo (no solo tests)

- **A**: `reset` sin `--yes` aborta; con `--yes` deja `runs` vacío, `instincts` solo `verified=1`, `tasks.yaml` todo `pending`; `memory_entries`/config/skills intactos. Repetir desde el botón de Settings.
- **B/B2**: forzar un fallo real, confirmar `lastErrorResult` en el JSON de diagnose y visible en el panel; retry con modelo distinto corre con `--model <otro>` sin persistir el cambio en `tasks.yaml`; retry sin tocar el selector se comporta igual que hoy.
- **C**: graph run con `maxCost`/`maxMinutes` bajos corta el circuit breaker con esos valores (no defaults); una tarea bloqueada/`failed_permanent` muestra botón Retry y al usarlo termina sin relanzar todo el grafo.
- **D**: `GET /api/memory?q=algo` devuelve resultados rankeados, no toda la tabla; un término presente solo en una entry vieja (fuera del limit 200 por `updated_at`) aparece igual (prueba real de que usa FTS); en el chat, preguntar por una decisión vieja no incluida en el preview estático de 20 entries dispara `search_memory` (visible en `toolCallsExecuted`) y trae el dato correcto.

---

## MES 14 — Autonomía interna: el runner que conduce el grafo solo

- [x] **SÍ — Mes 14 cerrado (2026-06-29)**
  `orchestos run --graph` recorre el DAG completo de `tasks.yaml` sin intervención humana en el happy path (Bloques 0/A/B); ante un fallo, bloquea solo la rama afectada y la decisión retry/bloqueo la toma `diagnoseTask()`, no el humano (A.R hardening). Superficie completa en CLI + dashboard (Bloque C). Verificado en vivo en el dashboard real y en un smoke e2e contra el `tasks.yaml` real de producción del propio proyecto — 2 bugs reales destapados y corregidos en el camino (falso positivo de QA sin checks deterministas, retry sin tope en fallos de check) (Bloque D). En paralelo: control de reasoning effort por modelo end-to-end (BLOQUE BACK/FRONT) y pulido visual del dashboard vía auditoría `impeccable` (10 fixes, incluido un loop de rerender que borraba inputs activos). 518 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

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
