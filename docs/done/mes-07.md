### MES 7 — Observabilidad activa + calidad del pipeline

**SEMANA 27 — Context monitor wired en executor**
- S27.1–S27.3 `context_warnings_json TEXT` en tabla `runs` vía `safeAddColumn`. `InsertRunRecord` y `RunRecord` actualizados. Harness colecciona `contextWarnings[]` localmente y los persiste en todos los paths de `insertRun` — 2026-06-02
- S27.4 `TaskResult.contextWarnings` — harness retorna los warnings al caller — 2026-06-02
- S27.5 `runs --detail <id>` muestra sección `## Context monitor warnings` cuando el run disparó alguno — 2026-06-02
- S27.6 `src/__tests__/context-monitor-db.test.ts`: 5 tests (column exists, null default, single warning, multiple warnings, loop_detected) — 2026-06-02
- Validación: typecheck limpio · 218 tests · 0 fail — 2026-06-02

**SEMANA 28 — WHEN/THEN en acceptance_criteria (OpenSpec pattern)**
- S28.1 `spec draft` system prompt: criterios DEBEN estar en formato WHEN/THEN; template actualizado con ejemplo `WHEN <trigger> THEN <result>` — 2026-06-02
- S28.2 `src/spec/lint.ts`: `lintSpec(spec)` → `LintResult` con `findings[]` (criterio + suggestion), `structuredCount`, `freeFormCount`. Detecta WHEN/THEN case-insensitive — 2026-06-02
- S28.3 `orchestos spec lint <task-id>` — imprime criterios sin formato + sugerencia de conversión; exit 1 si hay findings — 2026-06-02
- S28.4 QA system prompt: añadida instrucción explícita para evaluar escenarios WHEN/THEN completamente — 2026-06-02
- S28.5 `src/__tests__/spec-lint.test.ts`: 12 tests (structured, lowercase, mixed-case, free-form, solo WHEN, solo THEN, texto en finding, suggestion con WHEN/THEN, 4 edge cases) — 2026-06-02
- Validación: typecheck limpio · 230 tests · 0 fail — 2026-06-02

**SEMANA 29 — Spec archive**
- S29.1 `SpecFrontmatter.status` amplía a `'draft' | 'approved' | 'archived'` + `archivedAt?: string`. `parseSpec` + `serializeSpec` actualizados — 2026-06-02
- S29.2 `src/spec/archive.ts`: `archiveSpec(root, taskId)` mueve spec a `.orchestos/specs/archive/YYYY-MM-DD-{id}.md`, actualiza `status: archived` + `archivedAt` — 2026-06-02
- S29.3 `listSpecs(root, includeArchived=false)`: por defecto filtra archived; `--all` carga también el directorio `archive/` — 2026-06-02
- S29.4 `orchestos spec archive <task-id>` + `orchestos spec list --all` — 2026-06-02
- `src/__tests__/spec-archive.test.ts`: 10 tests (archive moves file, date prefix, status archived, idempotence, list defaults, list --all includes archived) — 2026-06-02
- Validación: typecheck limpio · 240 tests · 0 fail — 2026-06-02

**SEMANA 30 — `runs analyze` — aprendizaje continuo v1**
- S30.1 `src/analyze/patterns.ts`: `groupRunsByOutcome(runs)` → `RunOutcomeGroups` (qaPass, qaFail, blocked, parseError, failReasons, topModels, avgCost, avgElapsed). Pure function, 0 dependencias externas — 2026-06-02
- S30.2 `analyzeRunPatterns(groups, model?)` → `PatternSuggestion[]` via Haiku. `parsePatternSuggestions(raw)` como parser puro testable — 2026-06-02
- S30.3 `orchestos runs --analyze [--last <n>]` — imprime patrones con frecuencia, confidence, fix_hint — 2026-06-02
- S30.4 Hook post-completion en `task run`: si `qaFail > 1` en últimos 20 runs → corre `analyzeRunPatterns` en background, imprime sugerencias si las hay. Best-effort (catch silencioso) — 2026-06-02
- S30.5 `src/__tests__/patterns.test.ts`: 16 tests (groupRunsByOutcome: empty, pass/fail/blocked/parse_error, model tracking, cost/elapsed averages, mixed; parsePatternSuggestions: valid JSON, markdown fences, empty, skip invalid items, default confidence, non-array) — 2026-06-02
- Validación: typecheck limpio · 256 tests · 0 fail — 2026-06-02

**Decisiones de diseño Mes 7**
- Context monitor: advisorio puro — nunca bloquea, solo persiste. Valor en observabilidad post-hoc.
- WHEN/THEN: lint no bloquea `spec approve` — opcional, informativo. Pressure sin enforcement duro.
- Archive: mueve archivo (no marca en DB) — specs activos/archivados son carpetas distintas.
- `runs analyze`: hook es best-effort con catch silencioso — nunca puede romper `task run`.
- Pattern analysis solo si `qaFail > 1` — no molesta en proyectos sin historial de fallos.

**Lista prohibida Mes 7** _(lo que NO se hizo — referencia histórica)_
- Dashboard web, UI gráfica de ningún tipo.
- Middleware chain ordenado (DeerFlow) — complejidad no justificada aún.
- Instincts / confidence scoring (ECC) — Mes 8+.
- Continuous learning v2 (hooks → instincts) — necesita más historial real primero.
- KuzuDB — sin evidencia de escala.

**Métrica Mes 7 — SÍ (2026-06-02)**
256 tests · 0 fail. `orchestos spec lint` detecta criterios sin WHEN/THEN en proyectos reales. `runs --analyze` pide Haiku y devuelve sugerencias estructuradas. Context monitor visible en `runs --detail`.

---

