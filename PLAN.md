---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-8-pendiente
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

**Objetivo**: middleware chain ordenado, specs con contrato de capacidades, instincts con confianza, aprendizaje que cierra el loop runs→instincts, y dashboard local.

> S36 (Dashboard) requiere que S31–S35 estén cerrados. Si no da tiempo en Mes 8, pasa a Mes 9.

---

### S31 — Middleware chain (DeerFlow)

**Goal**: reemplazar el pipeline ad-hoc del harness con un middleware chain ordenado. Cada paso (context-inject, skill-route, memory-fetch, tool-policy, cost-track) es un `MiddlewareFn` independiente que puede insertarse/removerse sin tocar el núcleo.

- [x] 🧠 S31.1 Definir `MiddlewareFn<TCtx>` e interfaz `MiddlewareChain` — diseño del contrato de tipos y orden canónico de los middlewares (2026-06-02)
- [x] ⚡ S31.2 Implementar `context-inject` middleware — inyecta project context desde AGENTS.md/CONTEXT.md en `ctx.effectiveContext` (2026-06-02)
- [x] ⚡ S31.3 Implementar `skill-route` middleware — resuelve skill desde `ctx.task.skill`, adjunta instrucciones compiladas en `ctx.skillInstructions` (2026-06-02)
- [x] ⚡ S31.4 Implementar `memory-fetch` middleware — sugiere archivos vía `suggestContext` + embeddings, enriquece `ctx.task.input` y `ctx.embedHits` (2026-06-02)
- [x] ⚡ S31.5 Implementar `tool-policy` middleware — extrae `allowed_tools` de la skill YAML y los asigna a `ctx.allowedTools` (2026-06-02)
- [x] ⚡ S31.6 Refactorizar `harness.ts`: reemplazar pipeline inline por `chain.run(ctx)` — el harness construye la chain con memoryFetch, skillRoute, toolPolicy, contextInject y ejecuta `chain.run(ctx)` para la fase de enrichment (2026-06-02)
- [x] ⚡ S31.7 Tests unitarios por middleware: input→output determinista con ctx mock — 15 tests cubriendo contextInject, memoryFetch, skillRoute, toolPolicy (2026-06-02)
- [x] 🔍 S31.V Validación: run real end-to-end pasa por todos los middlewares · orden verificado · 256+ tests · 0 fail (2026-06-02)

---

### S32 — Capabilities contract + Delta headers (OpenSpec)

**Goal**: extender el sistema de specs con (1) un contrato de capacidades en el draft — qué se agrega, modifica o elimina — y (2) headers delta formales en los spec files para cambios brownfield.

- [x] 🧠 S32.1 Diseñar extensión del schema de spec: campo `capabilities: { added: string[], modified: string[], removed: string[] }` en frontmatter (2026-06-02)
- [x] ⚡ S32.2 Actualizar `spec draft` — el prompt genera el bloque `capabilities` como parte del borrador; investiga specs existentes antes de rellenar `modified`/`removed`
- [x] ⚡ S32.3 Extender `spec lint` — detecta specs con `modified` o `removed` que no tienen los delta headers correspondientes (`## ADDED`, `## MODIFIED`, `## REMOVED`) en el cuerpo
- [x] ⚡ S32.4 Extender `spec lint` — validar que secciones `## MODIFIED` contienen el bloque completo del requisito anterior (no fragmentos)
- [x] ⚡ S32.5 Tests: spec válido con deltas, spec inválido sin headers, spec inválido con MODIFIED parcial
- [x] 🔍 S32.V Validación: `spec lint` detecta los 3 casos · `spec draft` genera capabilities en un spec de prueba · 0 regresiones

---

### S33 — Instincts con confidence scoring (ECC)

**Goal**: evolucionar el sistema de skills hacia instincts atómicos con score de confianza. Un instinct es un comportamiento granular (`trigger` + `action`) con `confidence: 0–1` y `source: manual | auto`. Convive con skills — no las reemplaza.

- [x] 🧠 S33.1 Diseñar schema `instinct.yaml`: campos `id`, `trigger`, `action`, `confidence`, `source`, `verified`, `created_at` — definir umbrales: `< 0.6` = no aplicar sin revisión · `>= 0.8` = aplicar automáticamente
- [x] ⚡ S33.2 `src/instincts/schema.ts` — validador Zod del schema
- [x] ⚡ S33.3 `src/instincts/store.ts` — CRUD sobre tabla `instincts` en SQLite
- [x] ⚡ S33.4 CLI `instinct list` — tabla id|trigger|confidence|source|verified
- [x] ⚡ S33.5 CLI `instinct add` — agrega instinct manual con `confidence: 1.0`, `source: manual`, `verified: true`
- [x] ⚡ S33.6 CLI `instinct set-confidence <id> <value>` — actualiza confidence y recalcula `verified`
- [x] ⚡ S33.7 Integrar instincts en `harness.ts` via nuevo middleware `instinct-apply` — solo aplica instincts con `confidence >= 0.8` y `verified: true`
- [x] ⚡ S33.8 Tests: schema válido/inválido, CRUD store, middleware filtra por threshold
- [x] 🔍 S33.V Validación: schema y thresholds revisados por Claude · instinct manual aplicado en run real · 256+ tests · 0 fail

---

### S34 — Continuous learning v2: runs → instincts (ECC)

**Goal**: cerrar el loop iniciado en S30. `runs --analyze` detecta patrones. Si un patrón se repite ≥ 3 veces, proponer automáticamente un instinct `confidence: 0.6`, `source: auto`, `verified: false`, pendiente de aprobación humana.

- [x] 🧠 S34.1 Diseñar flujo completo: `runs --analyze` detecta patrón → evalúa frecuencia → si threshold → `instinct propose` → instinct queda en estado `unverified` (2026-06-02)
- [x] ⚡ S34.2 Extender `runs --analyze` — si patrón aparece ≥ 3 runs, emite evento `pattern_threshold_reached` con trigger y action sugeridos
- [x] ⚡ S34.3 Implementar `instinct propose` — crea instinct `source: auto`, `confidence: 0.6`, `verified: false`; no actúa hasta aprobación
- [x] ⚡ S34.4 CLI `instinct review` — lista instincts `verified: false` con trigger, action y confidence
- [x] ⚡ S34.5 CLI `instinct approve <id>` → `verified: true`, confidence += 0.1 (tope 1.0) · `instinct reject <id>` → elimina el instinct propuesto
- [x] ⚡ S34.6 Hook post-`task run`: si hay proposals nuevos de `runs --analyze`, mostrarlos al finalizar
- [x] ⚡ S34.7 Tests: threshold dispara proposal, approve/reject funcionan, hook no bloquea sin proposals
- [x] 🔍 S34.V Validación: flujo end-to-end con runs reales · patrón detectado → proposal visible en `instinct review` · Claude verifica semántica de los proposals

---

### S35 — Cost tracker via transcript parsing (ECC)

**Goal**: `runs.cost_usd` solo captura el costo del agente principal. Parsear transcripts para extraer el costo real de cada sub-agente y mostrar breakdown en `runs --detail`.

- [x] ⚡ S35.1 `src/run/transcript-parser.ts` — extrae `usage.input_tokens`, `usage.output_tokens` y modelo de cada mensaje del transcript JSON (2026-06-02)
- [x] ⚡ S35.2 Calcular costo por sub-agente usando `src/router/pricing.ts` — agregar modelos faltantes si los hay (2026-06-02)
- [x] ⚡ S35.3 Al finalizar run: recalcular `runs.cost_usd` como suma total; guardar breakdown en columna `cost_breakdown_json` (2026-06-02)
- [x] ⚡ S35.4 `runs --detail` muestra tabla: sub-agente | modelo | input_tokens | output_tokens | cost_usd (2026-06-02)
- [x] ⚡ S35.5 Tests: parser extrae tokens de transcript mock, suma total correcta (2026-06-02)
- [x] 🔍 S35.V Validación: run con sub-agentes · cost_usd total y breakdown verificados contra lo que reporta la API · 256+ tests · 0 fail (2026-06-02)

---

### S36 — Dashboard local (requiere S31–S35 cerrados)

**Goal**: `orchestos dashboard` levanta un servidor HTTP local (Bun) que sirve una UI web con observabilidad completa del sistema: runs, tareas, instincts, specs, memoria y costos. Lee directamente de SQLite — sin backend adicional.

- [ ] 🔍 S36.0 Precondición — Claude lee `src/db/migrate.ts` + tipos de cada comando + formato de `cost_breakdown_json` (S35) para tener el schema real en contexto antes de escribir una sola línea del dashboard
- [ ] 🧠 S36.1 Diseñar estructura de la UI: rutas `/runs`, `/tasks`, `/instincts`, `/specs`, `/memory` — definir qué datos expone cada vista y el contrato de la API interna
- [ ] ⚡ S36.2 `src/dashboard/server.ts` — servidor HTTP con Bun.serve, rutas REST que leen SQLite y devuelven JSON
- [ ] ⚡ S36.3 Vista `/runs` — tabla de runs con status, costo total, cost breakdown por sub-agente, warnings del context-monitor
- [ ] ⚡ S36.4 Vista `/tasks` — tabla de tareas con status, retries, skill asignada y último QA verdict
- [ ] ⚡ S36.5 Vista `/instincts` — tabla de instincts con confidence, source, verified; botones approve/reject para los `unverified`
- [ ] ⚡ S36.6 Vista `/specs` — lista de specs activos y archivados; badge de lint status (passed/failed)
- [ ] ⚡ S36.7 CLI `orchestos dashboard [--port 4242]` — levanta el servidor, imprime URL, abre el navegador si está disponible
- [ ] ⚡ S36.8 HTML/JS estático servido desde `src/dashboard/public/` — vanilla JS, sin bundler, sin dependencias externas
- [ ] 🔍 S36.V Validación: Claude navega las 4 vistas con datos reales de SQLite · aprobación/rechazo de instinct desde la UI funciona · 0 regresiones en tests existentes

---
