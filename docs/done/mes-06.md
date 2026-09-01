### MES 6 — IA con ROI demostrable

**SEMANA 23 — Pre-flight Mes 6 + Function calling para el planner**
- S23.0.1 `mergeWorktreeBack`: `--ff-only` falla → intenta `git rebase <base>` + retry; si rebase falla → mensaje claro con instrucción manual. Sin el fix, worktrees quedaban colgados entre sesiones — 2026-05-28
- S23.0.2 `src/hooks/context-monitor.ts`: `checkContextHealth()` retorna warnings estructurados (context_warning <35%, context_critical <25%, cost_notice >$5, loop_detected ≥3 herramienta seguida, scope_creep >20 archivos). `shouldCheck()` con debounce de 5 calls. Integrado en harness post-enforce — 2026-05-28
- S23.1 `CREATE_SUBTASK_TOOL` en `src/agents/planner.ts`: schema estricto con `id`, `description`, `acceptance[]`, `depends_on[]`, `allowed_tools[]`, `topic_key?`, `output?`, `input?`. Validación por SDK antes de llegar al código — 2026-05-28
- S23.2 `generatePlan()`: detecta en runtime si el provider soporta tool calling → function calling; si no → YAML fallback. Transparente para el caller — 2026-05-28
- S23.3 `src/__tests__/planner-fc.test.ts`: plan de 3 sub-tareas via function calling → schema correcto; modelo sin tool support → fallback YAML funcional; schema inválido → error con campo afectado — 2026-05-28
- S23.4 Commit `feat(planner): function calling + YAML fallback` — 2026-05-28

**SEMANA 24 — Embeddings semánticos en `suggestContext`**
- S24.1 Migración SQLite: columna `embedding TEXT` (JSON array float[]) en tabla `files` via `safeAddColumn` — 2026-05-28
- S24.2 `src/providers/embeddings.ts`: `EmbeddingProvider` interface + `embedOpenAI` (text-embedding-3-small, $0.02/1M) + `embedOllama` (nomic-embed-text, local, sin API key) + `getEmbeddingProvider()` registry + `inferEmbeddingProvider()` + `cosine()` utility — 2026-05-28
- S24.3 `indexProject()`: si archivo no tiene embedding o SHA1 cambió → llama provider y guarda. Flag `--no-embed` en `orchestos index` — flujo existente sin API key intacto — 2026-05-28
- S24.4 `suggestContext()`: embedding de la tarea → cosine similarity → re-rank `embed_score×0.6 + keyword_score×0.4`. Razón `embedding` para archivos encontrados solo por coseno. CLI: `◆` para semantic match. `cli.ts` + `harness.ts` pasan `taskEmbedding` con fallback silencioso — 2026-05-28
- S24.5 Columna `embed_hits INT` en tabla `runs`. Harness devuelve `embedHits` en `withSuggestedInput` — 2026-05-28
- S24.6 `src/__tests__/suggest.test.ts` (15 tests): legacy keyword path, cosine path, threshold exclusion, combined score formula, NULL embeddings, topN — 2026-05-28
- Validación final: 194 tests · 0 fail — 2026-05-28
- Commit `feat(graph): embeddings semánticos en suggestContext + embed_hits tracking` — 2026-05-28

**SEMANA 25 — Agente de diagnóstico de fallos**
- S25.1 `src/agents/diagnose.ts`: `diagnoseTask(taskId, root)` — lee últimos 3 runs, construye prompt con runs block (status, model, qa_reason, checks, cost, elapsed), llama a Haiku (barato) para detectar patrón de fallo — 2026-05-28
- S25.2 `DiagnoseResult`: `{taskId, pattern, confidence, suggestion, details}`. 6 patrones: `deterministic_check`, `qa_specific_criterion`, `parse_error`, `rate_limit`, `scope_creep`, `unknown`. Fallback a `unknown` si el LLM devuelve JSON inválido. No ejecuta nada — solo sugiere — 2026-05-28
- S25.3 `orchestos task diagnose <id>` en `cli.ts`. Auto-trigger en `task run --all` cuando `status → failed_permanent`: llama a `diagnoseTask` e imprime diagnóstico en stderr — 2026-05-28
- S25.4 `src/__tests__/diagnose.test.ts` (5 tests): happy path con mock Haiku, task no encontrada, task sin runs, fallback JSON inválido, FailurePattern type. Fix: `mock.module('../db/runs.ts')` incluye `insertRun`/`listRuns`/`getRun` reales para no contaminar otros test files — 2026-05-28
- Validación: 199 tests · 0 fail — 2026-05-28

**SEMANA 26 — Memory conflict detection (patrón Engram BM25)**
- S26.1 `memory_fts` virtual table FTS5 (content='memory_entries') + 3 triggers (INSERT/UPDATE/DELETE) + rebuild en migración. `upsertMemory()` retorna `{id, candidates: ConflictCandidate[]}`. `CONFLICT_THRESHOLD=0.5` (|bm25|). `findCandidates()` LIMIT 5. 199 tests · 0 fail — 2026-05-28
- S26.2 `src/memory/judge.ts`: `judgeConflict()` llama Haiku vía OpenRouter. 6 relaciones: `conflict_with | supersedes | compatible | scoped | related | not_conflict`. Parseo JSON con fallback a `not_conflict`/`low`. 6 tests — 2026-05-28
- S26.3 Tabla `memory_conflicts(id, entry_a_id, entry_b_id, relation, confidence, resolved_at, created_at)` + FK + índices. `insertConflict` / `listConflicts(projectId?)` / `resolveConflict` CRUD. 7 tests — 2026-05-28
- S26.4 CLI: `orchestos memory conflicts [--project]` — tabla formateada ID/relation/confidence/created_at — 2026-05-28
- S26.5 13 tests nuevos (S26.2 judge + S26.3 CRUD). 212 tests · 0 fail. Commits `2caf365` + `b9d968d` + `88e0ab4` — 2026-05-28

**Decisiones de diseño Mes 6**
- BM25 en SQLite FTS5 — sin dependencia nueva, nativo en SQLite.
- LLM judge solo si hay candidato > threshold — no corre en cada upsert.
- Context monitor no bloquea — warnings estructurados con debounce de 5 calls.
- Embeddings opt-in (`--no-embed`) — proyectos sin API key no se rompen.
- Function calling con fallback YAML — providers sin tool support siguen funcionando.
- Diagnóstico nunca ejecuta — solo sugiere. El usuario aplica.

**Lista prohibida Mes 6** _(lo que NO se hizo — referencia histórica)_
- Dashboard web, UI gráfica, TUI interactiva.
- Nuevos providers de LLM — se mantuvieron los 4.
- Reescritura del scheduler.
- Plugin system, extensiones de terceros.
- Paralelismo entre tareas — sigue secuencial.
- KuzuDB — sin evidencia de escala real (10K+ nodos).

**Métrica Mes 6 — SÍ (2026-05-28)**
`embed_hits > 0` en 12 runs reales (todos `status: done`, `embed_hits: 3`). Planner sin errores YAML en 100% de los planes del mes (function calling elimina el problema estructuralmente). 212 tests · 0 fail.

---

