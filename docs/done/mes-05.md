### MES 5 — Confiabilidad para uso diario

**SEMANA 19 — Sandbox por worktree + e2e real**
- S19.1 `createWorktree()` en sandbox.ts con cleanup garantizado — 2026-05-27
- S19.2 `mergeWorktreeBack()` — estrategias commit/squash/discard — 2026-05-27
- S19.3 sandbox-policy.ts — fallback a cwd si no es git repo — 2026-05-27
- S19.4 harness integra sandbox, elimina restoreContents() — 2026-05-27
- S19.5 QA→worktree: fail → discard, pass → commit + merge ff-only — 2026-05-27
- S19.6 flag `--keep-worktree` + `--sandbox` en `orchestos task run` — 2026-05-27
- S19.7 examples/e2e/ con tarea mínima hello.txt — 2026-05-27
- S19.8 e2e-smoke.ts + `bun run e2e:smoke` — 2026-05-27
- S19.9 docs/E2E.md — guía API key, smoke, logs, worktree debugging — 2026-05-27
- S19.10 Smoke real con OpenRouter — PASS · 8762ms · QA pass — 2026-05-27
- S19.11 8 tests unitarios sandbox.ts con repo git temporal — 2026-05-27
- S19.12 Validación: 86/86 tests verdes + smoke verde — 2026-05-27
- S19.13 Commit `feat(run): sandbox por git worktree + e2e real verificado` — 2026-05-27

**SEMANA 20 — Spec-Driven flow**
- S20.1 `orchestos spec create <task-id>` — genera plantilla .orchestos/specs/ — 2026-05-27
- S20.2 `orchestos spec show/list` — 2026-05-27
- S20.3 `orchestos spec approve` — status: approved + approvedAt — 2026-05-27
- S20.4 `orchestos spec draft` — LLM genera borrador con CONSTITUTION.md — 2026-05-27
- S20.5 clarify: pending bloquea approve — 2026-05-27
- S20.6 harness gate: requireSpec: true → error si no aprobado — 2026-05-27
- S20.7 validate.ts — criterios vacíos o placeholder → fallo — 2026-05-27
- S20.8 docs/SPEC.md — flujo completo con ejemplo — 2026-05-27
- S20.9 16 tests create/approve/validate/gate — 102/102 verdes — 2026-05-27
- S20.10 Validación: typecheck limpio + 102 tests — 2026-05-27
- S20.11 Commit `feat(spec): flujo Spec-Driven con gate en harness` — 2026-05-27

**SEMANA 21 — Graph multi-lenguaje + autoskills fetch**
- S21.1 resolver-registry.ts con interfaz Resolver pluggable — 2026-05-27
- S21.2 resolver C#: nsCache + using X.Y → archivo con ese namespace — 2026-05-27
- S21.3 resolver Rust: use crate::foo → src/foo.rs|mod.rs — 2026-05-27
- S21.4 resolver Go: go.mod module path → subdirectorio del índice — 2026-05-27
- S21.5 resolver Java: import com.X.Foo → archivo; wildcards → paquete — 2026-05-27
- S21.6 graph/index.ts: to_file_id integra registry C#/Rust/Go/Java — 2026-05-27
- S21.7 12 fixtures en tests/fixtures/graph/ — C#/Rust/Go/Java — 2026-05-27
- S21.8 skills/fetch.ts — fetchSkill + listRemoteSkills + cache local — 2026-05-27
- S21.9 `orchestos skill fetch --language <lang> [--name <name>]` — 2026-05-27
- S21.10 `orchestos skill fetch --list` — lista del registry GitHub — 2026-05-27
- S21.11 Validación: typecheck limpio + 102/102 tests verdes — 2026-05-27
- S21.12 Commit `feat(graph,skills): resolvers multi-lenguaje + autoskills fetch` — 2026-05-27

**SEMANA 22 — Sub-agentes con contextos aislados + hardening final**
- S22.0.1 `allowed_tools?: string[]` en `SkillDef` + validador + 11 skills actualizadas — 2026-05-28
- S22.0.2 `src/agents/sub-task-schema.ts` — `SubTaskDef`, `SubTaskPlan`, `validateSubTaskPlan()`, `topoSort()`, cycle detection (Kahn) — 2026-05-28
- S22.0.3 Migración `memory_entries` + `src/db/memory.ts`: `upsertMemory` / `getMemory` / `listByScope` — 2026-05-28
- S22.1 `src/agents/sub-agent.ts` — `SubTaskStatus`, `SubTask`, `SubagentResult`, `createSubTask`, `applyResult`, `shouldSkip`, `isRetriable` — 2026-05-28
- S22.2 `src/agents/planner.ts` — parser YAML robusto + validación contra schema S22.0.2 — 2026-05-28
- S22.3 `src/agents/context-isolation.ts` — `buildIsolatedContext`, `sliceContext`, `selectMemories`, `extractKeywords`, `MAX_CONTEXT_CHARS=8000` — 2026-05-28
- S22.4 Scheduler: orden topológico por `depends_on`, herencia provider/model del padre, secuencial — 2026-05-28
- S22.5 QA en cascada: sub-task falla → padre `failed`, dependientes → `skipped` con razón explícita — 2026-05-28
- S22.5a apply-progress merge: topic_key existente → instrucción MERGE en prompt + `upsertMemory` post-éxito — 2026-05-28
- S22.6 `orchestos task run --expand <plan-task-id>` — 2026-05-28
- S22.7 4 escenarios de test: linear fail→rollback, DAG no-linear, re-ejecución merge, tool-violation — 2026-05-28
- S22.8 `src/agents/hardening.ts` — `withSubTaskTimeout` (5 min), `ToolCallCounter` (20 calls → `timed_out`), `createWorktreeWithRetry` (exp. backoff), `withRateLimitRetry` — 2026-05-28
- S22.9 `docs/AGENTS.md` — flujo completo + diagrama DAG de una tarea plan — 2026-05-28
- S22.10 Smoke real: write-greeting (428in/269out, 16s) → write-response (430in/152out, 28s) · `memory_entries` escritas · 44s total — 2026-05-28
- S22.11 README + CHANGELOG — resumen Mes 5 con sub-agentes, context isolation, memoria persistente, tool policy — 2026-05-28
- S22.12 Validación: 110 tests · 0 fail · 8 archivos + smoke S22 verde — 2026-05-28
- S22.13 Commit `cd8526e feat(smoke): S22.10 smoke real sub-agentes + cierre S22` — 2026-05-28
- Bug fix: `selectMemories` resuelve `depends_on` IDs → `topic_keys` via `allSubTasks` — 2026-05-28

**Decisiones de diseño Mes 5 (S19–S22)**
- Worktrees reemplazan snapshot/restore — `restoreContents()` eliminado.
- Spec es opcional por defecto, obligatorio si `requireSpec: true` en config — adopción gradual.
- autoskills = HTTP fetch al raw de GitHub — sin npx, sin runtime externo.
- Resolvers de imports son best-effort — `to_file_id = null` sigue siendo válido.
- Sub-agentes solo si S19 cierra limpio — worktrees son prerequisito no negociable.
- Memoria de sub-agentes solo en `memory_entries` — nunca archivos .md — evita race conditions.
- Tool policy es verificación dura en harness, no sugerencia al modelo.
- Dogfooding: 5 tareas reales ejecutadas durante el mes (bitácora en `docs/E2E.md`).

**Métrica Mes 5 — SÍ (2026-05-28)**
Sub-agentes con context isolation + memoria persistente + tool policy funcionando.
5 ejecuciones reales registradas en `docs/E2E.md` (hello-world × 2, bun test suite, smoke-greeting, smoke-response).

---

