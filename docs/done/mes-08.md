### MES 8 — Pipeline robusto + aprendizaje activo

**SEMANA 31 — Middleware chain (DeerFlow)**
- S31.1 (🧠 Claude) `src/run/middleware.ts`: `MiddlewareFn<TCtx>`, `RunContext`, `MiddlewareChain`, `createChain()`, `createRunContext()`, `ENRICHMENT_MIDDLEWARE_ORDER` (10 slots). Scope: enrichment-only — la fase de ejecución (LLM → contract → QA → revert) permanece orquestada por harness — 2026-06-02
- S31.2–S31.5 (⚡ DeepSeek) `src/run/middlewares/`: context-inject, memory-fetch, skill-route, tool-policy, instinct-apply (slot noop hasta S33). Cada middleware es una función pura que mutar `ctx` y llama `next()` — 2026-06-02
- S31.6 (⚡ DeepSeek) `harness.ts` refactorizado: reemplaza pipeline inline por `chain.run(ctx)`; el harness construye la chain y delega la fase de enrichment — 2026-06-02
- S31.7 (⚡ DeepSeek) 15 tests unitarios por middleware: context-inject, memory-fetch, skill-route, tool-policy con ctx mock — 2026-06-02
- Validación: 329 tests · 0 fail — 2026-06-02

**SEMANA 32 — Capabilities contract + Delta headers (OpenSpec)**
- S32.1 (🧠 Claude) Diseño de extensión del schema de spec: campo `capabilities: { added, modified, removed }` en frontmatter — contrato explícito entre draft y specs — 2026-06-02
- S32.2 (⚡ DeepSeek) `spec draft` actualizado: prompt genera bloque `capabilities` investigando specs existentes antes de rellenar `modified`/`removed` — 2026-06-02
- S32.3–S32.4 (⚡ DeepSeek) `spec lint` extendido: detecta specs con `modified`/`removed` sin delta headers (`## ADDED`, `## MODIFIED`, `## REMOVED`); valida que `## MODIFIED` tiene el bloque completo del requisito anterior — 2026-06-02
- S32.5 (⚡ DeepSeek) Tests: spec válido con deltas, spec inválido sin headers, spec inválido con MODIFIED parcial — 2026-06-02
- Validación: `spec lint` detecta los 3 casos · 0 regresiones — 2026-06-02

**SEMANA 33 — Instincts con confidence scoring (ECC)**
- S33.1 (🧠 Claude) Schema `instinct`: `id`, `trigger`, `action`, `confidence: 0–1`, `source: manual|auto`, `verified`, `created_at`. Umbrales: `< 0.6` = no aplicar sin revisión · `>= 0.8` = aplicar automáticamente — 2026-06-02
- S33.2–S33.3 (⚡ DeepSeek) `src/instincts/schema.ts` validador Zod + `src/instincts/store.ts` CRUD sobre tabla `instincts` en SQLite — 2026-06-02
- S33.4–S33.6 (⚡ DeepSeek) CLI: `instinct list`, `instinct add` (manual, confidence=1.0, verified=true), `instinct set-confidence <id> <value>` — 2026-06-02
- S33.7 (⚡ DeepSeek) Middleware `instinct-apply` activo en harness: aplica solo instincts `confidence >= 0.8` y `verified: true` — 2026-06-02
- S33.8 (⚡ DeepSeek) Tests: schema válido/inválido, CRUD store, middleware filtra por threshold — 2026-06-02
- Validación: instinct manual aplicado en run real · 0 regresiones — 2026-06-02

**SEMANA 34 — Continuous learning v2: runs → instincts (ECC)**
- S34.1 (🧠 Claude) Diseño del flujo: `runs --analyze` → threshold ≥ 3 runs con mismo patrón → `instinct propose` → instinct `unverified` esperando aprobación humana — 2026-06-02
- S34.2–S34.3 (⚡ DeepSeek) `analyze/propose.ts`: extiende `runs --analyze` con detección de threshold; `instinct propose` crea instinct `source: auto`, `confidence: 0.6`, `verified: false` — 2026-06-02
- S34.4–S34.5 (⚡ DeepSeek) CLI: `instinct review` (lista unverified), `instinct approve <id>` (verified=true, confidence+=0.1), `instinct reject <id>` (elimina) — 2026-06-02
- S34.6 (⚡ DeepSeek) Hook post-`task run`: si `runs --analyze` devuelve proposals nuevos, los muestra al finalizar. Best-effort — catch silencioso — 2026-06-02
- S34.7 (⚡ DeepSeek) Tests: threshold dispara proposal, approve/reject, hook no bloquea sin proposals — 2026-06-02
- Validación: flujo end-to-end · patrón detectado → proposal visible en `instinct review` — 2026-06-02

**SEMANA 35 — Cost tracker via transcript parsing (ECC)**
- S35.1 (⚡ DeepSeek) `src/run/transcript-parser.ts`: extrae `usage.input_tokens`, `usage.output_tokens` y modelo de cada mensaje del transcript JSON — 2026-06-02
- S35.2 (⚡ DeepSeek) Costo por sub-agente usando `src/router/pricing.ts` actualizado con modelos faltantes — 2026-06-02
- S35.3–S35.4 (⚡ DeepSeek) `runs.cost_usd` recalculado como suma total + columna `cost_breakdown_json`. `runs --detail` muestra tabla sub-agente | modelo | tokens | cost — 2026-06-02
- S35.5 (⚡ DeepSeek) Tests: parser extrae tokens de transcript mock, suma total correcta — 2026-06-02
- Validación: cost_usd total y breakdown verificados · 0 regresiones — 2026-06-02

**SEMANA 36 — Dashboard local**
- S36.0 (🔍 Claude) Precondición: lectura de `src/db/migrate.ts` + tipos de cada comando + formato `cost_breakdown_json` antes de escribir código — 2026-06-02
- S36.1 (🧠 Claude) Diseño de la UI: rutas `/runs`, `/tasks`, `/instincts`, `/specs`; contrato API interna — 2026-06-02
- S36.2 (⚡ DeepSeek) `src/dashboard/server.ts`: Bun.serve con rutas REST que leen SQLite y devuelven JSON — 2026-06-02
- S36.3–S36.6 (⚡ DeepSeek) Vistas: `/runs` (cost breakdown + warnings), `/tasks` (status + QA verdict), `/instincts` (approve/reject desde UI), `/specs` (lint badge) — 2026-06-02
- S36.7–S36.8 (⚡ DeepSeek) CLI `orchestos dashboard [--port 4242]`; HTML/JS estático en `src/dashboard/public/` — vanilla JS, sin bundler, sin dependencias externas — 2026-06-02
- Validación: 4 vistas navegadas con datos reales · approve/reject instinct desde UI funciona · 369 tests · 0 fail — 2026-06-02

**Decisiones de diseño Mes 8**
- Middleware chain scope: enrichment-only. La fase de ejecución (LLM → contract → checks → QA → revert → insertRun) es una máquina de estados con flujo de error complejo — moverla a middlewares oscurece sin beneficio. Los middlewares son los pasos de preparación que son independientes entre sí.
- Instincts conviven con skills, no las reemplazan. Skills = comportamiento declarativo por dominio. Instincts = comportamientos atómicos granulares aprendidos. Ambos alimentan el system prompt.
- Continuous learning: proposals nunca se auto-aplican. Confidence 0.6 + verified:false es el estado inicial. El humano decide siempre antes de que un instinct auto llegue al harness.
- Dashboard: vanilla JS + Bun.serve, cero dependencias externas. Lee SQLite directamente — no hay capa de API adicional. `--port` configurable, sin auth (tool local).
- Delegación Claude/DeepSeek documentada en PLAN.md: 🧠 para diseño de contratos y arquitectura, ⚡ para implementación especificada, 🔍 para gates de validación obligatorios.

**Lista prohibida Mes 8** _(lo que NO se hizo — referencia histórica)_
- Onboarding adaptativo (wizard primera vez).
- KuzuDB — sin evidencia de escala todavía.
- Clasificador semántico para `needsClarify`.
- Resolución de imports relativos para lenguajes no-JS.
- autoskills registry.
- Memoria en capas (DeerFlow) — SQLite + topic_key actual es suficiente.

**Métrica Mes 8 — SÍ (2026-06-02)**
369 tests · 0 fail. Harness refactorizado con middleware chain. Instincts con confidence activos en runs. Continuous learning cierra loop runs→instincts. Cost breakdown por sub-agente en `runs --detail`. Dashboard local sirve 4 vistas desde SQLite real.

---

