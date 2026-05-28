---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-6-activo
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

**Objetivo**: Que las herramientas de IA de OrchestOS tengan ROI medible en uso real diario.
Tres ejes: (1) `suggestContext` más preciso con embeddings semánticos, (2) planes más robustos con function calling, (3) diagnóstico automático de fallos. Pre-flight obligatorio: solidificar Mes 5 antes de construir encima.

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.
**Delegación**: ⚡ = cualquier LLM ejecuta leyendo este plan | 🧠 = requiere criterio Claude/Opus.

- [x] **S23.0 — Pre-flight Mes 6** (2026-05-28) → mergeWorktreeBack rebase fix + context monitor hook. Ver DONE.md.
- [x] **S23 — Function calling planner** (2026-05-28) → `CREATE_SUBTASK_TOOL`, `planWithFunctionCalling`, fallback YAML. Ver DONE.md.
- [x] **S24 — Embeddings semánticos** (2026-05-28) → `EmbeddingProvider`, `indexProject --embed`, `suggestContext` re-rank, `embed_hits` en runs. Ver DONE.md.
- [x] **S25 — Diagnóstico de fallos** (2026-05-28) → `diagnoseTask`, `orchestos task diagnose`, auto-trigger en `failed_permanent`. Ver DONE.md.

---

### SEMANA 26 — Memory conflict detection (patrón Engram BM25) 🧠

> Cuando múltiples sub-agentes escriben memorias del mismo proyecto, se contradicen.
> Sin detección, la memoria se corrompe silenciosamente entre sesiones.

- [x] S26.1 🧠 Habilitar SQLite FTS5 en `memory_entries`. Al `upsertMemory()`: BM25 query contra entradas existentes del proyecto. Si score > threshold → candidato a conflicto. **2026-05-28** → `memory_fts` virtual table (content='memory_entries') + 3 triggers (INSERT/UPDATE/DELETE) + `rebuild` en migración. `upsertMemory()` retorna `{id, candidates: ConflictCandidate[]}`. Threshold=0.5 (|bm25|). 199 tests · 0 fail.
- [x] S26.2 ⚡ LLM judge (haiku) decide relación: `conflict_with | supersedes | compatible | scoped | related | not_conflict`. Solo si hay candidato con score > threshold — no corre en cada upsert. **2026-05-28**
- [x] S26.3 ⚡ Tabla `memory_conflicts(id, entry_a_id, entry_b_id, relation, confidence, resolved_at)`. **2026-05-28** → tabla + índices en migrate.ts, `ConflictRecord` type, `insertConflict`/`listConflicts`/`resolveConflict` CRUD en memory.ts. 212 tests · 0 fail.
- [x] S26.4 ⚡ `orchestos memory conflicts [--project]` — lista conflictos pendientes de resolución. **2026-05-28** → comando group en cli.ts con tabla formateada (ID, relation, confidence, created_at). 212 tests · 0 fail.
- [x] S26.5 ⚡ Tests + commit `feat(memory): BM25 conflict detection` **2026-05-28** → 13 tests nuevos (S26.2 judge + S26.3 CRUD), 212 total · 0 fail.

---

### Decisiones de diseño Mes 6

1. **Pre-flight S23.0 es bloqueante** — igual que S22.0. No tocar embeddings ni function calling hasta que el merge fix y el context monitor estén mergeados.
2. **Embeddings son opt-in** — `--no-embed` en `orchestos index`. No rompe proyectos sin API key.
3. **Function calling con fallback YAML** — providers sin tool support siguen funcionando.
4. **Diagnóstico no ejecuta** — solo sugiere. El usuario aplica. Evita auto-modificación de tasks.yaml sin supervisión.
5. **BM25 en SQLite FTS5** — sin dependencia nueva. SQLite ya lo soporta nativo con `CREATE VIRTUAL TABLE`.
6. **Context monitor no bloquea** — emite warnings estructurados, no lanza errores. El agente puede ignorarlos; el log los registra siempre.

### Lista prohibida Mes 6

- Dashboard web, UI gráfica, TUI interactiva
- Nuevos providers de LLM — mantener los 4 actuales
- Reescritura del scheduler
- Plugin system, extensiones de terceros
- Paralelismo entre tareas — sigue secuencial
- KuzuDB — solo si >10K nodos con evidencia real

### Métrica única de éxito Mes 6

**¿`context suggest` encontró al menos 1 archivo relevante que las keywords no habrían encontrado, en al menos 3 tareas reales ejecutadas durante el mes?**

- [ ] **SÍ — Mes 6 cerrado (fecha)**
  `embed_hits > 0` en al menos 3 runs reales. Planner sin errores YAML en 100% de los planes del mes.
  Ver historial completo → [DONE.md](DONE.md).
- [ ] **NO** → Embeddings no mejoran recall. Identificar: ¿calidad del embedding, pesos de re-rank, o falta de índice?
