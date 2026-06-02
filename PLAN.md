---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-7-activo
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.
**Delegación**: ⚡ = cualquier LLM ejecuta leyendo este plan | 🧠 = requiere criterio Claude/Opus.

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

**Tema**: hacer el pipeline auto-consciente (sabe cuándo está en problemas) y más preciso (criterios QA sin ambigüedad).

**Métrica de éxito**: context-monitor fires al menos una vez en un run largo real + QA tasa de falsos positivos baja al introducir WHEN/THEN.

### S27 — Context monitor wired en executor ⚡

La lógica `checkContextHealth` existe en `src/hooks/context-monitor.ts` pero nunca se llama.
Integrarla en el harness/executor para que inyecte warnings en el prompt del agente cuando detecte riesgo.

- [x] S27.1 Añadir `monitorCallCount` y `filesModified` tracking en `TaskExecutor` — 2026-06-02
- [x] S27.2 En cada round-trip LLM → llamar `shouldCheck` + `checkContextHealth` con estado real — 2026-06-02
- [x] S27.3 Warnings → inyectar como bloque advisory en el prompt del siguiente turn (no bloquean) — 2026-06-02
- [x] S27.4 Columna `context_warnings_json` en tabla `runs` — almacenar warnings disparados — 2026-06-02
- [x] S27.5 `orchestos runs --detail <id>` muestra context warnings si los hubo — 2026-06-02
- [x] S27.6 Tests: 4 escenarios (sin warnings, context_critical, loop_detected, scope_creep) — 2026-06-02
- [x] S27.7 Validación: typecheck limpio + 218 tests pasan — 2026-06-02

### S28 — WHEN/THEN en acceptance_criteria (OpenSpec pattern) ⚡

Hoy `acceptance_criteria[]` son strings libres. El QA LLM los evalúa sin estructura.
Añadir formato WHEN/THEN generado por `spec draft` y chequeado por `spec lint`.

- [ ] S28.1 Actualizar prompt de `spec draft` — LLM genera criterios en formato WHEN/THEN
- [ ] S28.2 `src/spec/lint.ts` — detecta criterios sin formato WHEN/THEN, devuelve lista
- [ ] S28.3 `orchestos spec lint <task-id>` — imprime criterios que no tienen formato estructurado
- [ ] S28.4 QA prompt actualizado: cuando el criterio tiene WHEN/THEN, evalúa escenario completo
- [ ] S28.5 Tests: spec lint identifica criterios libres vs WHEN/THEN
- [ ] S28.6 Validación: typecheck limpio + todos los tests pasan

### S29 — Spec archive ⚡

Cuando una tarea llega a `completed`, el spec queda visible en `spec list` mezclado con specs activos.
`orchestos spec archive <task-id>` mueve el spec a `.orchestos/specs/archive/YYYY-MM-DD-{id}.md`.

- [ ] S29.1 `src/spec/archive.ts` — mueve archivo + actualiza metadata `status: archived, archivedAt`
- [ ] S29.2 `orchestos spec archive <task-id>` comando
- [ ] S29.3 `orchestos spec list` — por defecto oculta archived; `--all` los muestra
- [ ] S29.4 Tests: archive mueve archivo, list --all muestra archived, list sin flag los oculta
- [ ] S29.5 Validación: typecheck limpio + todos los tests pasan

### S30 — `runs analyze` — aprendizaje continuo v1 🧠

Después de runs completados, analizar patrones en el historial para detectar recurrencias.
Output: `PatternSuggestion[]` mostradas al usuario — no ejecuta nada automáticamente.

- [ ] S30.1 `src/analyze/patterns.ts` — agrupa runs por QA outcome, extrae patrones frecuentes
- [ ] S30.2 LLM call (Haiku) analiza patrones → `PatternSuggestion[]` estructurado con `fix_hint`
- [ ] S30.3 `orchestos runs analyze [--project <id>] [--last <n>]` — imprime sugerencias
- [ ] S30.4 `orchestos task run` — al completar, corre analyze en background y muestra si hay patrones
- [ ] S30.5 Tests: parser PatternSuggestion, agrupación runs sin LLM call real
- [ ] S30.6 Validación: typecheck limpio + todos los tests pasan

---
