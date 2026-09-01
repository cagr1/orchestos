### MES 15 — Dashboard usable en pruebas reales: reset, diagnóstico, grafo accionable, memoria buscable

Origen: dogfooding real (2026-07-01) tratando de correr `crear-web-local-comercial` desde cero. 2 bugs bloqueantes arreglados en el camino (fuera de plan): (1) `sandbox-policy.ts` — el check de "uncommitted changes" se disparaba antes de mirar `--sandbox=cwd`; (2) `harness.ts` — `maxTokens = contextWindow - promptTokens` sin margen causaba overflow real contra OpenRouter (fix: `SAFETY_MARGIN = 1024`). Además, 4 problemas de producto donde el motor ya soportaba lo necesario pero no estaba expuesto en dashboard/CLI.

**Tabla de estado de bloques**

| Bloque | Contenido | Estado |
|---|---|---|
| 0 | Pre-flight — investigación completa (3 Explore + 1 Plan) + 2 bugfixes bloqueantes | ✅ SÍ |
| A | Reset de datos de prueba — `resetTestData()`, CLI `reset --yes`, `POST /api/system/reset`, botón en Settings | ✅ SÍ |
| B | Diagnose expone motivo real del fallo — `lastErrorResult` end-to-end (tipo → handler → render `<pre>`) | ✅ SÍ |
| B2 | Retry con modelo alternativo — `--model` transitorio en CLI, `{model?}` en el body del endpoint, reset a `pending` para relanzar `failed_permanent`, selector en panel de diagnóstico | ✅ SÍ |
| C | Graph Runner accionable — inputs `maxCost`/`maxMinutes` en UI + botón Retry por fila (reusa el endpoint de B2, cero lógica nueva) | ✅ SÍ |
| D0 | Diagnóstico previo de memoria — expand/collapse NO estaba roto; el problema real era que las 20 entries eran fixtures triviales | ✅ SÍ |
| D | Memoria buscable — FTS5/BM25 en `GET /api/memory?q=`, buscador del dashboard conectado, `SEARCH_MEMORY_TOOL` + `createToolRouter` en el chat | ✅ SÍ |
| E | Cierre formal del mes | ✅ SÍ (este registro) |

**Detalle por bloque** (todas las fechas 2026-07-01)

- **A — Reset**: `resetTestData(root): ResetSummary` en `src/db/reset.ts` — borra `runs` e `instincts` no verificados, resetea tasks a `pending` (limpiando `retry_count`/`retry_reason`/`qa_verdict`/`run_id`); NO toca `memory_entries`/config/skills. Reusado por CLI (`reset --yes`, aborta sin flag) y `POST /api/system/reset` (`handlers/system.ts`) + botón en Settings con `window.confirm` inline + i18n en/es. Verificado en vivo por CLI y por el botón (Chrome DevTools).
- **B — Diagnose**: `lastErrorResult?: string` en `DiagnoseResult`/`DiagnoseRow`, calculado desde `listRunsByTaskId`; `handleApiTasksDiagnose` lo incluye en el JSON; `diagnoseDetail(d)` lo renderiza como bloque `<pre>` ("Last Error Output"). Verificado en vivo con run sintético `failed` con marcador único + llamada LLM real de diagnose.
- **B2 — Retry con modelo alternativo**: `--model <model>` en `task run` como override transitorio (no persiste en `tasks.yaml`; `HarnessOpts.modelOverride` ya existía). `handleApiTasksRun` convertida a async, lee `{model?}` del body y agrega `--model` al spawn. Bug real encontrado en la revisión: el endpoint nunca validaba status mientras `executeTask` en `cli.ts` bloqueaba `failed_permanent` en silencio — fix: reset a `pending` antes del spawn (intencional: este endpoint ES el mecanismo de retry). Frontend reusa `buildModelSelect()`. Verificado en vivo con tarea desechable (`exit 1` determinístico): el run quedó en SQLite con el modelo override, `tasks.yaml` intacto, bypass de `failed_permanent` confirmado. **Gotcha operativo confirmado 2 veces**: Bun no recarga módulos en caliente — el dashboard debe reiniciarse tras cambios de backend antes de verificar.
- **C — Graph Runner accionable**: inputs `maxCost`/`maxMinutes` en la UI (`screens-ops.js`; el backend ya los aceptaba) + botón Retry por fila (`outcome === 'failed_permanent'||'blocked'`) que llama a `POST /api/tasks/:id/run` — cero lógica nueva de retry en `graph-runner.ts`. Verificado en vivo: `maxMinutes: 0` corta el circuit breaker de inmediato; el Retry NO relanza el grafo (phase se mantuvo `done` antes y después), solo el subproceso individual. Fuera de alcance a propósito: pause/cancel de una corrida en curso (deuda conocida).
- **D0 — Diagnóstico de memoria**: el expand/collapse de las cards funcionaba correctamente (verificado en vivo con entry de 4 líneas). El "bug" percibido era que las 20 entries reales eran fixtures de test de una línea — nunca había nada que expandir. Cero fix de UI necesario; el problema real era la búsqueda (D).
- **D — Memoria buscable**: `GET /api/memory?q=` con `JOIN memory_fts ... MATCH ? ORDER BY bm25(memory_fts)`, query sanitizado (`"${q.replace(/"/g,'""')}"*` — FTS5 rompe con `-`/`"` sin escapar). Buscador del dashboard conectado al endpoint (`App.fetchMemory(q)` con debounce). Chat: `SEARCH_MEMORY_TOOL` + `createToolRouter()` (router multi-tool por nombre — `ToolExecutor` era un único callback) en `tool-call.ts`, `executeSearchMemory` en `chat.ts` (mismo patrón/sanitización). Verificado end-to-end en vivo: entry sintética con `updated_at: 2020` (fuera del preview de 20 recientes) y marcador único — el chat real con `openai/gpt-4o-mini` disparó `search_memory` (visible en `toolCallsExecuted`) y devolvió el contenido exacto. Nota: el modelo default (deepseek) NO dispara tools — `supportsToolCalling` solo admite prefijos `anthropic/`/`openai/`/`google/gemini`; cae a chat plano (esperado, no bug).

**Decisiones de diseño Mes 15**
- Regla de reuso cumplida: el Retry del Graph Runner (C) llama literalmente al endpoint de B2 — cero duplicación de lógica de retry.
- `harness.ts`/`sandbox-policy.ts` intocados durante todo el mes (arreglados pre-plan, regla explícita) — la regla queda levantada al abrir Mes 16 (F1–F4 y G viven exactamente ahí).
- Patrón de verificación con tarea desechable consolidado (B2.6/C.3): backup de `tasks.yaml`, check `exit 1` determinístico, diff vacío al final — reusable para F1.4 del Mes 16.
- Delegación con verificación reforzada: D.2 delegado a DeepSeek produjo un primer intento inválido (ruta con typo `Agentes/` + página HTML standalone en vez de conectar el buscador existente) — rechazado y re-especificado; D.4 llegó marcado `[x]` sin nota técnica y se verificó por grep antes de aceptar (el código sí existía). Ver [[feedback-verificar-progreso-delegado]].

**Métrica Mes 15 — SÍ (2026-07-01)**
Las 4 fricciones del dogfooding cerradas con superficie completa en dashboard + CLI: reset de datos en un click, motivo real del fallo visible en diagnose, retry con modelo alternativo desde el panel, graph runner con límites editables y retry por fila, memoria buscable por FTS en dashboard y chat. Todos los gates 🔍 verificados en vivo contra el dashboard real (no mocks). 521 tests · 0 fail · `tsc --noEmit` limpio.

---

