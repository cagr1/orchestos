# DONE.md — OrchestOS — Registro de trabajo completado

Este archivo es de solo lectura — no se edita a mano.
Se llena moviendo items `[x]` desde PLAN.md e ideas `✅` desde IDEAS.md.

---

## Sección 1 — Plan ejecutado (S1–S18)

### MES 1 — CLI base + detección de stack

**SEMANA 1 — `orchestos detect` → AGENTS.md**
- S1.1 Bootstrap (bun init, dependencias, IDEAS.md) — 2026-05-26
- S1.2 Stubs: cli.ts, detect/*, generators/* — 2026-05-26
- S1.3 `src/detect/manifest.ts` — 2026-05-26
- S1.4 `src/detect/languages.ts` — 2026-05-26
- S1.5 `src/detect/conventions.ts` — 2026-05-26
- S1.6 `src/generators/agents-md.ts` — 2026-05-26
- S1.7 `src/generators/context-json.ts` — 2026-05-26
- S1.8 `src/cli.ts` con commander — 2026-05-26
- S1.9 Validación: Next.js+Prisma detectado en 182ms, AGENTS.md correcto — 2026-05-26
- S1.10 Repo https://github.com/cagr1/orchestos push `9886d9f` — 2026-05-26

**SEMANA 2 — Persistencia SQLite**
- S2.1 `src/db/sqlite.ts` — 2026-05-26
- S2.2 `src/db/migrate.ts` — 2026-05-26
- S2.3 `src/db/projects.ts` — 2026-05-26
- S2.4 Comandos `init`, `context show/update/list` — 2026-05-26
- S2.5 `src/context/load.ts` + `src/index.ts` — 2026-05-26
- S2.6 Validación: `orchestos init` en 91ms, context show correcto desde DB — 2026-05-26
- S2.7 Commit `e536922` — 2026-05-26

**SEMANA 3 — Compilador de skills (YAML → 3 targets)**
- S3.1 `bun add yaml` + estructura skills — 2026-05-26
- S3.2 Validador YAML con mensajes claros — 2026-05-26
- S3.3 Compilador `claude` → SKILL.md — 2026-05-26
- S3.4 Compilador `cursor` → .mdc — 2026-05-26
- S3.5 Compilador `openai` → JSON tool — 2026-05-26
- S3.6 Comandos `skill add / list / build` — 2026-05-26
- S3.7 Validación: 3 skills × 3 targets = 9 archivos, 0 errores — 2026-05-26
- S3.8 Commit `b725c99` — 2026-05-26

**SEMANA 4 — Router + `orchestos run`**
- S4.1 `src/router/classify.ts` — 2026-05-26
- S4.2 `src/router/models.ts` — 2026-05-26
- S4.3 `src/providers/anthropic.ts` (stub + API key desde `~/.orchestos/.env`) — 2026-05-26
- S4.4 `src/providers/openai.ts` (stub) — 2026-05-26
- S4.5 `src/router/pricing.ts` — tabla USD/1M tokens — 2026-05-26
- S4.6 Tabla `runs` con files_attempted/authorized/blocked/status — 2026-05-26
- S4.7 `run/contract.ts` — enforceContract bloquea writes fuera de `--output` — 2026-05-26
- S4.8 Comando `orchestos run --task --output [--skill] [--file] [--project] [--dry-run]` — 2026-05-26
- S4.9 Validación parcial: dry-run correcto, contexto cargado, 2 providers declarados — 2026-05-26
- S4.10 Commit `593292e` — 2026-05-26

---

### MES 2 — Contract-first workflow con evidencia

**SEMANA 5 — `tasks.yaml` como fuente de verdad**
- S5.1 Schema tasks.yaml: id, description, skill, input[], output[], depends_on[], status, retry — 2026-05-26
- S5.2 `src/tasks/schema.ts` — Task + TasksFile + validateTasksFile — 2026-05-26
- S5.3 `src/tasks/loader.ts` — loadTasks/saveTasks con lock optimista — 2026-05-26
- S5.4 `orchestos task init` — scaffold según stack detectado — 2026-05-26
- S5.5 `orchestos task list` — tabla con icono de status — 2026-05-26
- S5.6 `orchestos task run` — scheduler, enforceContract, persiste run — 2026-05-26
- S5.7 Tabla `runs` extendida: task_id, snapshots, qa_verdict, qa_reason — 2026-05-26
- S5.8 Validación: task init válido, run escribe solo lo declarado, SQLite correcto — 2026-05-26
- S5.9 Commit `a59ed37` — 2026-05-26

**SEMANA 6 — QA stage**
- S6.1 `src/run/qa.ts` — runQA + snapshotContents + restoreContents — 2026-05-26
- S6.2 Prompt QA — JSON {verdict, reason} — 2026-05-26
- S6.3 Integrado en task run: pass → done, fail → revert + pending + retry_count++ — 2026-05-26
- S6.4 MAX_RETRIES=3, failed_permanent bloquea dependientes — 2026-05-26
- S6.5 `orchestos task status` — tabla id|status|retry|qa|cost — 2026-05-26
- S6.6 Validación: QA fail → retry, QA pass → done, 3 fallos → failed_permanent — 2026-05-26
- S6.7 Commit `31b0c6d` — 2026-05-26

**SEMANA 7 — Multi-tarea con dependencias**
- S7.1 Selector de próxima tarea: filtra pending cuyas depends_on estén done — 2026-05-26
- S7.2 `orchestos task run --all` — loop MAX=20, recarga tasks.yaml cada vuelta — 2026-05-26
- S7.3 Halt en fallo: 'failed' corta loop, 'retry' no — 2026-05-26
- S7.4 `orchestos task run --id <task-id>` — salta scheduler — 2026-05-26
- S7.5 `src/run/logger.ts` — RunLogger a disco: runs/YYYY-MM-DD-HH-mm.log — 2026-05-26
- S7.6 Validación: T1→T2 en orden, contract enforcement, log verificado — 2026-05-26

**SEMANA 8 — Observabilidad + README honesto**
- S8.1 `orchestos runs --detail <run-id>` — evidencia completa — 2026-05-26
- S8.2 `orchestos runs --export` — dump a runs-export.json — 2026-05-26
- S8.3 `summary-pdf.ts` — sección Recent Runs con tabla — 2026-05-26
- S8.4 README.md reescrito — honesto, sin claims falsos — 2026-05-26
- S8.5 LIMITATIONS.md — creado con limitaciones reales — 2026-05-26
- S8.6 Validación: runs --detail muestra evidencia real, export correcto — 2026-05-26
- S8.7 Commit `129d317` — 2026-05-26

---

### MES 3 — Reliability + Spec QA

**SEMANA 9 — Extracción de harness**
- S9.1-S9.2 `src/run/harness.ts`: HarnessOpts, TaskResult, runTask() — cli.ts solo orquesta — 2026-05-27
- S9.3 `src/run/prompt.ts`: buildPrompt() extraído del harness — 2026-05-27
- S9.4 Error handling: cualquier excepción → TaskResult{status:'failed'}, harness nunca lanza — 2026-05-27
- S9.6 Validación: harness.ts 191 líneas, typecheck verde — 2026-05-27
  - ⚠️ Desviación: cli.ts=666 líneas (legacy `orchestos run` no migrado, decisión anotada)
- S9.7 Commit `14b0ff8` — 2026-05-27

**SEMANA 10 — acceptance_criteria[] + checks[]**
- S10.1-S10.2 Extender Task: acceptance_criteria?, checks?, Check{cmd,cwd,timeout_ms,expect_exit} — 2026-05-27
- S10.3 `src/run/checks.ts`: runChecks() con Bun.spawn, split cmd respetando comillas, tail 2000 chars — 2026-05-27
- S10.4 Integrar checks en harness: corren ANTES del QA — si falla, revert sin gastar tokens QA — 2026-05-27
- S10.5 QA prompt: path criteria → eval por criterio con criteria[] en respuesta — 2026-05-27
- S10.6 `safeAddColumn checks_json TEXT` en runs — 2026-05-27
- S10.8 Commit `feat(tasks): acceptance_criteria + deterministic checks` — 2026-05-27

**SEMANA 11 — executor field + multi-provider**
- S11.1 Extender Task: executor enum (openrouter|anthropic|openai|codex), default openrouter — 2026-05-27
- S11.2 `src/providers/index.ts`: ProviderClient interface + getProvider() registry — 2026-05-27
- S11.3 `src/providers/anthropic.ts` real: POST api.anthropic.com/v1/messages — 2026-05-27
- S11.4 `src/providers/openai.ts` real: POST /v1/chat/completions — 2026-05-27
- S11.5 Harness usa getProvider(task.executor) — 2026-05-27
- S11.6 executor:codex detrás de OS_ENABLE_EXEC_CODEX=1, Bun.spawn(['codex','exec','--json']) — 2026-05-27
- S11.7 Persistir executor real (no hardcoded) en runs — 2026-05-27
- S11.9 Commits Codex `7dfcdab`–`53f7017` — 2026-05-27

**SEMANA 12 — Code Graph v0 + context suggest**
- S12.1 Tablas SQLite: files(id,project_id,path,language,sha1,size_bytes,indexed_at) + code_edges(from_file_id,to_path,to_file_id,kind,raw) — 2026-05-27
- S12.2 `src/graph/index.ts`: indexProject() — glob TS/JS/Python, regex import, SHA1 dedup, cascade delete — 2026-05-27
- S12.3 `orchestos index [--project]` — imprime `indexed N files, M edges in Xms` — 2026-05-27
- S12.4 indexProject integrado en `orchestos init` — 2026-05-27
- S12.5 `src/graph/suggest.ts`: suggestContext(projectId, taskText) — TOKEN_WEIGHT=3, HOP_WEIGHT=1, 1-hop expansion via code_edges — 2026-05-27
- S12.5 `orchestos context suggest "<texto>" [--top N] [--no-expand]` — 2026-05-27
- S12.6 LIMITATIONS.md — sección Code Graph — 2026-05-27
- S12.7 Validación: 38 files/132 edges en 171ms, suggest correcto, SHA1 dedup, cascade ✅ — 2026-05-27
- S12.8 Commit `58d7f94` — 2026-05-27

**SEMANA 13 — Integración + hardening**
- S13.1 harness.runTask: si input[] vacío → suggestContext(description) top 5 como input implícito — 2026-05-27
- S13.2 `orchestos task run --explain <id>` — dry run: executor/model/suggestions/checks/criteria, 0 tokens — 2026-05-27
- S13.3 `runs --detail` rediseñado: ## Provider / ## Checks / ## Acceptance criteria / ## Files / ## Cost — 2026-05-27
- S13.4 summary-pdf.ts: columna executor + contador checks — 2026-05-27
- S13.5 README: sección ## Reliability features, ejemplo add-payment-service, ## tasks.yaml full reference — 2026-05-27
- S13.6 Validación: --explain correcto (0 tokens), check-fail path verificado, auto-suggest confirmado — 2026-05-27
- S13.7 Commit final Mes 3 — 2026-05-27

**SEMANA 14 — Skills con estructura real**
- S14.1 Schema YAML extendido: SkillExample + campos opcionales (when_to_use, inputs_required, verifiers, anti_patterns, examples) — 2026-05-27
- S14.2 validateSkill retrocompatible — skills sin campos nuevos siguen válidas — 2026-05-27
- S14.3 Compiler targets (claude/cursor/openai) emiten secciones solo si el campo existe — 2026-05-27
- S14.4–S14.8 Skills reales: pre-task-alignment, diagnose, tdd-enforcer, context-compression, improve-architecture — 2026-05-27
- S14.9 Validación: skill list (8), skill build (24 archivos), retrocompatibilidad, typecheck — 2026-05-27
- S14.10 Commit `efb95d5` — 2026-05-27

**Decisiones de diseño Mes 3**
- Checks ANTES del QA — si TS no compila, no tiene sentido el LLM de QA.
- Checks usan exit code, no parseo de stdout — wrapper script si necesitas stdout.
- Graph v0 con regex, no tree-sitter — schema ya soporta más kinds para Mes 4.
- Harness nunca lanza — toda excepción → `TaskResult{status:'failed'}`.
- Codex executor detrás de flag `OS_ENABLE_EXEC_CODEX=1` hasta evidencia real.
- legacy `orchestos run` no migrado al harness — flujo distinto, se depreca si nadie lo usa.
- Two-tier LLM como convención (⚡/🧠), no en tasks.yaml — hasta Mes 4 con evidencia.

**Lista prohibida Mes 3** _(lo que NO se hizo — referencia histórica)_
- Symbols/calls en el graph — solo imports.
- Paralelismo entre tareas — scheduler sigue secuencial.
- `qa_executor` separado del `executor`.
- Worktrees reales (`git worktree add`).
- Reescribir el scheduler a archivo separado.
- `executor` como string libre — enum cerrado.
- ~~`planner_model` / `executor_model` en tasks.yaml~~ → **implementado en S15 (Mes 4)**.
- Más de 5 skills en S14 — calidad sobre cantidad.

---

### MES 4 — Routing inteligente + skills que se adaptan al proyecto

**SEMANA 15 — Model roles config**
- S15.1 `src/config/schema.ts` + `src/config/load.ts` con fallback chain — 2026-05-27
- S15.2 `src/router/auto-route.ts`: autoRoute(task, config) usando classifyTask existente — 2026-05-27
- S15.3 Extender Task schema: planner_model?, executor_model? opcionales — 2026-05-27
- S15.4 Harness integra autoRoute — executor explícito sigue ganando — 2026-05-27
- S15.5 Comandos `config init` + `config show` — 2026-05-27
- S15.6 Validación: plan-architecture → anthropic/claude-opus-4-7 [planner]; sin config.yaml → legacy path idéntico a Mes 3 — 2026-05-27
- S15.7 Commit `71a05ae` — 2026-05-27

**SEMANA 16 — Language-aware skills**
- S16.1 `LanguageTarget` type + `language_targets` en schema + validateSkill retrocompatible — 2026-05-27
- S16.2 `detectPrimaryLanguage()` exportado desde detect/languages.ts — 2026-05-27
- S16.3 Compilador claude/cursor/openai reciben detectedLanguage, emiten sección correcta — 2026-05-27
- S16.4 `skill build --project` detecta lenguaje del proyecto — 2026-05-27
- S16.5 Actualizar `tdd-enforcer` con language_targets (TS/C#/Python/default) — 2026-05-27
- S16.6 Validación: typecheck verde; build sin --project → idéntico a antes — 2026-05-27
- S16.7 Commit + push — 2026-05-27

**SEMANA 17 — CONSTITUTION.md + modo clarify**
- S17.1 `src/spec/constitution.ts`: loadConstitution + buildConstitutionBlock — 2026-05-27
- S17.2 Harness inyecta constitution block en system prompt si CONSTITUTION.md existe — 2026-05-27
- S17.3 `src/spec/clarify.ts`: needsClarify heurística v0 (verb ambiguo + sin input[]) — 2026-05-27
- S17.4 Harness/cli: --clarify → readline pregunta + appende clarificación a description — 2026-05-27
- S17.5 Comandos `constitution init` + `constitution show` + `task run --clarify` — 2026-05-27
- S17.6 Validación: explain con CONSTITUTION.md → loaded: 10 rules; sin CONSTITUTION.md → (none); typecheck verde — 2026-05-27
- S17.7 Commit `e11cb2a` + push — 2026-05-27

**SEMANA 18 — 3 skills de ciclo de vida + CONTEXT.md**
- S18.1 Skill `security-review` con schema completo — 2026-05-27
- S18.2 Skill `qa-structured` con schema completo — 2026-05-27
- S18.3 Skill `test-writer` con language_targets — 2026-05-27
- S18.4 `src/context/compress.ts`: buildContextMd() — 2026-05-27
- S18.5 `orchestos context compress` comando — 2026-05-27
- S18.6 Harness usa CONTEXT.md si existe, reporta ahorro de tokens en runs --detail — 2026-05-27
- S18.7 README: secciones Model routing, Constitution, Language-aware skills, Context compression — 2026-05-27
- S18.8 LIMITATIONS.md: clarify es heurística v0, no semántico — 2026-05-27
- S18.9 Validación final: typecheck verde; skill list → 11 skills; context compress genera CONTEXT.md; harness usa CONTEXT.md — 2026-05-27
- S18.10 Commit final Mes 4 `cca5f49` — 2026-05-27

**Decisiones de diseño Mes 4**
- `orchestos.config.yaml` vive en el proyecto — routing es por proyecto; config global como fallback.
- `autoRoute` usa `classifyTask` existente — sin clasificador nuevo, deuda cero.
- `executor` por tarea sigue ganando sobre config — compatibilidad total Mes 3.
- CONSTITUTION.md es Markdown parseado con regex — sin DSL nuevo; Mes 5 puede formalizarlo.
- `clarify` es heurística de palabras clave — semántica (LLM call extra) queda para Mes 5.
- CONTEXT.md sustituye AGENTS.md en el prompt — AGENTS.md sigue siendo fuente de verdad para init.

**Lista prohibida Mes 4** _(lo que NO se hizo — referencia histórica)_
- Dashboard / UI de ningún tipo → Mes 6+.
- Sub-agentes con contextos aislados → Mes 5+.
- Sandbox por tarea (`git worktree add`) → Mes 5.
- Spec-kit completo (`orchestos spec <id>`) → Mes 5.
- KuzuDB / upgrade del graph → solo si proyecto llega a 10K nodos.
- Paralelismo entre tareas — scheduler sigue secuencial.
- `qa_executor` separado.
- Clasificador semántico para clarify.

**Métrica Mes 4 — ✅ SÍ (2026-05-27)**
`orchestos.config.yaml` enruta al modelo correcto, skills compiladas incluyen solo instrucciones del lenguaje del proyecto, CONSTITUTION.md aparece en el prompt sin config adicional, `context compress` produce CONTEXT.md que el harness usa con ahorro de tokens visible en `runs --detail`.

---

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

### MES 9 — Dashboard usable: de observador a orquestador

**BLOQUE A — Navegación y estructura**
- A1 (🧠) Reordenar nav: Tasks primero, Runner eliminado, pantalla por defecto = Tasks. Nav final: Tasks → Runs → Memory → Instincts → Specs → Settings — 2026-06-03

**BLOQUE B — Runner / entrada principal**
- B1 (🧠) Barra de composición en Tasks: textarea lenguaje natural → "Crear y ejecutar" → crea task + lanza CLI en background. Botón "Avanzado" abre modal completo — 2026-06-03

**BLOQUE C — Tasks (UX)**
- C1 (⚡) Ordenar columnas al hacer click en el header (status, retries, qa) — 2026-06-03
- C2 (⚡) Filtrar por status con tabs: Todos · Pending · Running · Done · Failed — 2026-06-03
- C3 (🧠) New Task — eliminar campo "Task ID": slug kebab-case automático desde las primeras 4–5 palabras de la descripción — 2026-06-03
- C4 (🧠) New Task — "Output files" → "Archivos a crear o modificar (opcional)" — 2026-06-03
- C5 (⚡) Executor con nombres humanos en Compose modal: "Rápido (DeepSeek)" · "Preciso (Claude)" · "Económico (OpenAI)" — 2026-06-03

**BLOQUE D — Memory**
- D1 (⚡) Barra de búsqueda en Memory — filtra por topic_key o contenido, client-side — 2026-06-03

**BLOQUE E — Instincts (UX para no-devs)**
- E1 (🧠) Pantalla Instincts reescrita con lenguaje humano: "Hábitos del agente" · "Enseñar un hábito nuevo" · confianza Alta/Media/Baja · secciones propuestos/activos/inactivos — 2026-06-03

**BLOQUE F — Runs**
- F1 (⚡) Auto-refresh en Runs cada 5s + indicador "● actualizando" / "● en espera" — 2026-06-03
- F2 (⚡) Filtro por status en Runs: Todos · Running · Done · Failed — 2026-06-03

**BLOQUE G — Specs**
- G1 (🧠) Banner explicativo "¿Qué es una Spec?" siempre visible + empty state guiado — 2026-06-03
- G2 (⚡) Botón "Nueva Spec" → modal (selector de tarea + desc auto-rellena) → `POST /api/specs/draft` → CLI en background — 2026-06-03

**BLOQUE H — Input natural (visión)**
- H1 (🧠) `POST /api/natural` → claude-haiku con contexto del proyecto → `TaskDraft {id, description, output[], executor}`. Compose bar en dos fases: escribe → IA genera borrador editable → confirmar y ejecutar. Fallback gracioso si falla IA — 2026-06-03

**BLOQUE I — Setup automático (onboarding)**
- I1 (🧠) Comando `orchestos setup` — checklist pre-flight: Bun · bun install · API keys · tasks.yaml · DB · índice de código — 2026-06-03
- I2 (⚡) Pantalla "Setup" en dashboard — misma checklist visual, auto-mostrada si falta prerequisito crítico. Settings fusionado con Setup — 2026-06-03
- I3 (⚡) Auto-run `bun install` al iniciar `orchestos dashboard` si falta node_modules. Sin preguntar, con fallback de error — 2026-06-04
- I4 (🧠) Installer de un solo archivo: `install.bat` (doble-click Windows) + `install.ps1` + `install.sh` (Mac/Linux). Detecta/instala Bun, `bun install`, crea `~/.orchestos/.env` con comentarios, pausa interactiva si falta API key, abre dashboard — 2026-06-04

**BLOQUE J — i18n + bugs de UI**
- J1 (🧠) i18n completo: `i18n.js` con diccionarios `en`/`es` + `t(key, ...args)` global en `window`. Selector de idioma en Settings → `localStorage('orchestos-lang')`. Todas las pantallas usan `t()`. Fix bug memory search: `requestAnimationFrame` restaura foco — 2026-06-03

**No planificado — shipeado durante el mes**
- Chat panel con selector de modelo universal — envía mensajes al LLM con contexto del proyecto, respuesta en streaming. Selector de modelo aplica globalmente al panel — 2026-06-03 (af7c65c)
- Ops screen con assets de branding (logo, mark, favicon SVG) — 2026-06-03 (757a4f2)
- Fix: system prompt del chat refleja el modelo real seleccionado, no el hardcoded — 2026-06-03 (d77847f)

**Decisiones de diseño Mes 9**
- Compose bar de dos fases (escribe → borrador IA → confirma) no interrumpe el flujo si la IA falla — fallback a slug simple. El error de IA nunca bloquea la creación de tareas.
- Slug auto desde descripción: kebab-case de primeras 4–5 palabras. Elimina fricción sin perder trazabilidad (el ID sigue siendo legible).
- i18n como ciudadano de primera clase desde el inicio del dashboard — `t()` global en lugar de strings hardcodeados en cada pantalla. Coste de adopción: cero si se hace antes de escalar pantallas.
- Installer con pausa interactiva en la API key: la herramienta no arranca si el prerrequisito crítico no está. Evita confusión del no-dev ante un dashboard roto.
- Chat panel shipeado fuera de plan porque el modelo base ya existía (`/api/natural`) — reutilizar sin añadir dependencias nuevas.
- Instincts con lenguaje humano: los nombres internos (`confidence`, `verified`, `source`) nunca aparecen en la UI de no-devs. La abstracción es "hábito" con tres estados comprensibles.

**Lista prohibida Mes 9** _(lo que NO se hizo — referencia histórica)_
- Micrófono / dictado — análisis hecho, gap es `STTProvider` abstraction, pospuesto.
- Files como input en Chat — entrada conversacional bien definida, pospuesto.
- Arquitectura humano/operador (toggle "modo avanzado") — Mes 10+, necesita dashboard estable primero.
- VISION.md — brújula del producto, pospuesto.
- Control Center (salud continua) — delta sobre I2 Setup, pospuesto.
- Landing page — precisa VISION.md primero.
- KuzuDB — sin evidencia de escala.

**Métrica Mes 9 — SÍ (2026-06-04)**
Dashboard convertido en interfaz principal de trabajo: 10 bloques cerrados (A–J), 16 items `[x]`. Input de lenguaje natural operativo con preview de IA. i18n en/es completo. Instalador de un solo archivo para Windows y Mac/Linux. Chat panel + modelo selector shipeado fuera de plan. 369 tests · 0 fail mantenidos.

---

### MES 10 — El producto que alguien que nunca programó puede usar

**BLOQUE A — Diagnóstico de fallos en el dashboard**
- A1 (🧠) Diseño: endpoint `GET /api/tasks/:id/diagnose` → `DiagnoseResult`, on-demand con botón "Ver diagnóstico" — no auto-call en background — 2026-06-04
- A2 (⚡) `GET /api/tasks/:id/diagnose` en `server.ts` — llama `diagnoseTask(id, root)`, devuelve JSON — 2026-06-04
- A3 (⚡) Panel inline en Tasks: chip "Ver diagnóstico" en fila `failed` → expand con pattern · confidence (Alta/Media/Baja) · suggestion · details — 2026-06-04
- A4 (⚡) Botón "Reintentar" → `POST /api/tasks/:id/run`; botón "Convertir en hábito" → `POST /api/instincts` con trigger+action del diagnóstico — 2026-06-04
- A5 (🔍) Gate: 3 defectos corregidos — pattern crudo→humano (7 valores `FailurePattern`), `patternLabels` incompleto (faltaban `context_overflow` y `unknown`), `habitTrigger` genérico→incluye ID de tarea — 2026-06-04

**BLOQUE B — Vista editable de "lo que OrchestOS sabe del proyecto"**
- B1 (🧠) Diseño: textarea libre con helper text, auto-save debounce 1s, CONTEXT.md read-only + botón Regenerar — 2026-06-04
- B2 (⚡) `GET/PUT /api/project/constitution` · `GET /api/project/context` · `POST /api/project/context/regenerate` — 2026-06-04
- B3 (⚡) Pantalla "Proyecto": tabs "Guía del agente" / "Contexto comprimido", auto-save + indicador idle/saving/saved/error, Regenerar con re-fetch 1.5s — 2026-06-04
- B4 (⚡) Nav actualizado (entre Memory e Instincts), i18n 13 claves en/es, CSRF guard extendido a PUT, `ICON.project` — 2026-06-04
- B5 (🔍) Gate: PUT escribe a `join(resolve('.'), 'CONSTITUTION.md')` (mismo path que usa el harness), auto-save ✓, regenerate ✓, typecheck verde — 2026-06-04

**BLOQUE C — Control Center: Setup → salud continua**
- C1 (🧠) Diseño 5 secciones: sistema (prerequisitos), tareas bloqueadas, aprobación pendiente, costo 7d, últimos aprendizajes. Contratos de 5 endpoints — 2026-06-04
- C2 (⚡) `GET /api/health` — 5 bloques desde SQLite: checklist, `failed_permanent` no diagnosticados, unverified+draft, `sum(cost_usd 7d)`, últimos 5 instincts auto — 2026-06-04
- C3 (⚡) I2/Setup extendida: checklist superior + 5 bloques de salud con semáforo + auto-refresh 30s + links directos a pantalla relevante — 2026-06-04
- C4 (⚡) Pantalla de inicio adaptativa: `attentionCount > 0 || cost > threshold` → settings; sin atención + `advanced` → runs; normal → tasks — 2026-06-04
- C5 (🔍) Gate: 1 defecto corregido (auto-refresh 30s faltaba en C3). 5 bloques + semáforo + `data-nav+data-filter` + i18n en/es ✓ — 2026-06-04

**BLOQUE D0 — Detección de modelos locales (Ollama)**
- D0-1 (🧠) Diseño: `GET /api/providers/local`, `state.localModels`, prefijo `ollama/`, executor `'ollama'`, warning dismissible `sessionStorage`, system prompt diferenciado — 2026-06-04
- D0-2 (⚡) `GET /api/providers/local` — probe `localhost:11434/api/tags` con AbortSignal 1s, devuelve `{ available, models }` — 2026-06-04
- D0-3 (⚡) Selector: `loadLocalModels()`, optgroup "Local (Ollama)", warning dismissible. i18n 3 claves en/es — 2026-06-04
- D0-4 (⚡) `inferExecutorFromModel` rama `/^ollama\//`, `ollamaChat()` → `localhost:11434/v1/chat/completions`, `handleApiChat` ramifica por executor — 2026-06-04
- D0-5 (🔍) Gate: `/api/providers/local` devuelve modelos ✓, chat via `ollama/qwen2.5-coder:7b` funcional ✓, cloud sin cambios ✓ — 2026-06-04

**BLOQUE D0-ext — Mejoras UX al selector y Settings Ollama**
- D0-ext-1 (⚡) Locales primero en selector + buscador en tiempo real `buildModelOpts()` con `withSearch=true` solo en chat. XSS seguro — 2026-06-04
- D0-ext-2 (⚡) Settings Ollama: badge "Detected/Not detected" por probe real (no por env var), input "Override URL (opcional)" para Ollama remoto — 2026-06-04

**BLOQUE D — Archivos como input en Chat**
- D1 (🧠) Diseño: FormData multipart, pipeline por tipo (imagen→base64, PDF→texto regex, texto→directo), límite 10MB, fallback si provider sin visión — 2026-06-04
- D2 (⚡) `POST /api/chat/upload` — almacenamiento en memoria (expira al cerrar sesión), PDF→texto con regex sobre buffer, imagen→base64 — 2026-06-04
- D3 (⚡) Botón clip 📎 en chat, chip del archivo sobre input, `fileId` en POST, backend inyecta como `image_url` o bloque de texto precediendo la pregunta — 2026-06-04
- D4 (⚡) "Crear tarea desde esta conversación" tras 3+ mensajes, pre-fill con últimos 3 mensajes del usuario (no el volcado completo) — 2026-06-04
- D5 (🔍) Gate: PDF 2 páginas extraído ✓, imagen descrita por visión ✓, seed 152 chars accionables vs 236 del volcado ✓ — 2026-06-04

**BLOQUE E — Wizard API key: resolver el muro del cold-start**
- E1 (🧠) Diseño: trigger desde checklist ("Configurar ahora") + Settings ("Cambiar clave"), `Modal.openWizard()`, 3 pasos, rollback solo en 401, key nunca en logs ni response — 2026-06-04
- E2 (⚡) `POST /api/setup/api-key` — `writeEnv` existente (merge), test call `max_tokens:1`, errores→mensajes humanos, rollback 401, tipo `ApiKeyValidationResponse` — 2026-06-04
- E3 (⚡) `Modal.openWizard()` + `Modal._renderWizard()` — 3 pasos, dots indicator, toggle ver/ocultar, spinner. i18n 24 claves en/es — 2026-06-04
- E4 (⚡) Trigger desde I2 (action `open-wizard`) + Settings (botón "Cambiar clave"). Éxito: `App.fetchAll()` + toast — 2026-06-04
- E5 (🔍) Gate: wizard 3 proveedores ✓, 3 pasos ✓, wire `data-open-wizard` → `Modal.openWizard()` ✓, i18n en/es ✓ — 2026-06-04

**BLOQUE F — Superficie humano vs operador**
- F1 (🧠) Diseño: `operator:true` en runs/memory/specs, `localStorage('orchestos-mode')`, `buildNav()`, `ICON.sliders`, `.nav-mode-btn`, badge `adv`, transición opacity 250ms, redirect al desactivar desde pantalla operador — 2026-06-04
- F2 (⚡) `buildNav()` extraída de `boot()`: filtra por modo, badge `adv`, botón toggle, fade-in 250ms en ítems operator, redirect a Tasks al volver a normal desde pantalla operador — 2026-06-04
- F3 (⚡) i18n: `nav.mode.enable` / `nav.mode.disable` en/es. Banners `.spec-explainer` en Runs y Memory con texto humano. 8 claves i18n — 2026-06-04
- F4 (🧠) Banners explicativos "What are Runs?" y "What is Memory?" — aparecen en todos los estados (loading/error/empty/populated) — 2026-06-04
- F5 (⚡) Pantalla de inicio: `advanced` sin atención → runs; normal sin atención → tasks. Fusionado con C4 en `fetchAll()` — 2026-06-04
- F6 (🔍) Gate: modo normal ✓ · avanzado con Runs/Memory/Specs y badge `adv` ✓ · persistencia tras reload ✓ · redirect a Tasks al desactivar desde Runs ✓ — 2026-06-04

**Decisiones de diseño Mes 10**
- Diagnóstico on-demand — LLM call solo cuando el usuario lo pide; no en background al cargar Tasks.
- `PUT /api/project/constitution` escribe al mismo path que usa el harness — una sola fuente de verdad, sin sincronización.
- Control Center extiende I2, no es pantalla nueva — reutiliza checklist + infraestructura existente.
- Ollama como ciudadano de primera clase: prefijo `ollama/` + optgroup separado + probe automático. Sin API key.
- Archivos en Chat son input conversacional (no `context authorize`) — dos superficies con propósito diferente.
- Wizard: rollback solo en 401 (key claramente inválida). 402/timeout/5xx no hacen rollback.
- `buildNav()` re-renderiza el DOM en cada toggle — simplicidad sobre complejidad. Fade-in vía `requestAnimationFrame`.
- Stacking context del sidebar: `z-index:1` para que los tooltips escapen el CSS Grid.

**Lista prohibida Mes 10** _(lo que NO se hizo — referencia histórica)_
- Autoría de skills con curador (normalizador de intención) — prerequisitos listos, scope grande para Mes 11.
- Pack curado de skills de ingeniería "pro" — espera al curador.
- Micrófono / dictado en Chat — falta `STTProvider` abstraction.
- Resolver imports relativos en Graph (lenguajes no-JS).
- Clasificador semántico para `clarify`.
- Design.md condicional (OpenSpec).
- KuzuDB — sin evidencia de escala.
- autoskills registry — decisión de formato pendiente.

**Métrica Mes 10 — SÍ (2026-06-04)**
Wizard API key completo: 3 proveedores, validación real, rollback en 401, i18n 24 claves. Toggle humano/operador navegable con persistencia y redirect automático. Diagnóstico en Tasks con "Reintentar" + "Convertir en hábito". Archivos (imagen/PDF) en Chat + "Crear tarea desde conversación". Control Center con 5 bloques + semáforo + auto-refresh 30s. Ollama auto-detectado. 369 tests · 0 fail.

---

### MES 11 — OrchestOS como experto: autoría de skills con curador

**BLOQUE A — API backend de skills**
- A1 (⚡) `GET /api/skills` — lee `skills/*.yaml`, valida con `validateSkill()`, devuelve lista — 2026-06-09
- A2 (⚡) `GET /api/skills/:id` — devuelve un skill o 404 — 2026-06-09
- A3 (⚡) `POST /api/skills` — valida, escribe `skills/{id}.yaml`, rechaza duplicados — 2026-06-09
- A4 (⚡) `PUT /api/skills/:id` — sobreescribe YAML existente, revalida antes de persistir — 2026-06-09
- A5 (⚡) `DELETE /api/skills/:id` — requiere `{ confirm: true }` en el body — 2026-06-09
- A6 (⚡) `POST /api/skills/:id/build` — ejecuta `compileSkill()`, devuelve paths de artefactos — 2026-06-09

**BLOQUE B — Pantalla Skills en el dashboard**
- B1 (⚡) Ruta `/skills` en el nav con badge de conteo — 2026-06-09
- B2 (⚡) Vista lista: cards con nombre, descripción, targets como badges, botones Editar/Exportar/Borrar — 2026-06-09
- B3 (⚡) Modal de detalle con todos los campos del `SkillDef` (instrucciones, verifiers, examples…) — 2026-06-09
- B4 (⚡) Confirmación de borrado inline (no prompt del browser) — 2026-06-09
- B5 (⚡) Botones flotantes "Nueva skill" e "Importar" en la cabecera — 2026-06-09

**BLOQUE C — Curador LLM**
- C1 (🧠) System prompt del curador: extrae `id`, `name`, `description`, `instructions`, `targets`, `when_to_use`, `anti_patterns`, `verifiers` desde lenguaje natural — 2026-06-09
- C2 (⚡) `POST /api/skills/curate` — `{ text }` → LLM (Haiku) → `SkillDef` parcial sin guardar — 2026-06-09
- C3 (⚡) Gate de validación: hasta 2 reintentos si `validateSkill()` falla — 2026-06-09
- C4 (🔍) Review: 5 descripciones (técnica, vaga, es, en, multi-paso) — 5/5 útil sin editar, iter=1 en todos, encoding UTF-8 correcto — 2026-06-09

**BLOQUE D — Puerta Escribir**
- D1 (⚡) Textarea "Describe tu skill en lenguaje natural" + botón "Curar con IA" — 2026-06-09
- D2 (⚡) Pre-rellena formulario editable con los campos generados por el curador — 2026-06-09
- D3 (⚡) Preview del YAML resultante antes de guardar — 2026-06-09
- D4 (⚡) "Guardar" → `POST /api/skills`, cierra modal, refresca lista — 2026-06-09

**BLOQUE E — Puerta Importar**
- E1 (⚡) Sub-tab URL: fetch del YAML crudo → normaliza con curador si faltan campos → preview — 2026-06-09
- E2 (⚡) Sub-tab YAML pegado: `validateSkill()` → curador normaliza si falla → preview — 2026-06-09
- E3 (⚡) Preview compartido con warnings de normalización — 2026-06-09
- E4 (⚡) "Importar" → `POST /api/skills`, maneja conflicto de id (ofrece renombrar) — 2026-06-09

**BLOQUE F — Puerta Exportar**
- F1 (⚡) Botón "Exportar YAML" → `GET /api/skills/:id/export`, descarga `{id}.yaml` — 2026-06-09
- F2 (⚡) Botón "Copiar YAML" al portapapeles (mismo contenido que F1) — 2026-06-09
- F3 (⚡) `GET /api/skills/:id/export` — devuelve YAML con `Content-Disposition: attachment` — 2026-06-09

**BLOQUE G — Pack "pro" de ingeniería**
- G1 (🧠) Selección y escritura de 8 skills "pro": `code-review`, `refactor-guided`, `pr-description`, `bug-hypothesis`, `api-contract`, `db-migration-safe`, `perf-profile`, `doc-gen` — 2026-06-10
- G2 (🧠) Cada skill validado con `validateSkill()` y probado en una tarea real — 8/8 OK — 2026-06-10
- G3 (⚡) Sección "Skills recomendados" en la pantalla Skills con botón "Importar" — 2026-06-10
- G4 (⚡) YAMLs en `skills/pro/` (separado de `skills/`) — `listSkillFiles()` no recorre subdirectorios, sin colisión — 2026-06-10
- G5 (🔍) Review del pack: `/api/skills/pro` y `/api/skills/pro/:id/import` probados (list, import, conflicto 409); `code-review` importado y ejecutado en `run --dry-run`, guidelines inyectadas correctamente; 369 tests · 0 fail · tsc sin errores — 2026-06-10

**BLOQUE H — CLI: curate e import**
- H1 (⚡) `orchestos skill curate "<descripción>"` — llama al curador vía API, imprime YAML draft; `--save` guarda directamente — 2026-06-10
- H2 (⚡) `orchestos skill import <url>` — fetch + normalización + guarda en `skills/`, reusa el endpoint E1 — 2026-06-10
- H3 (⚡) Tests unitarios de los comandos CLI con mock de la API — 2026-06-10

**BLOQUE I — Tests y cierre**
- I1 (⚡) Unit tests del curador con LLM mockeado: happy path (iter=1), JSON inválido en los 3 intentos (422), recuperación en retry (iter=2), error/timeout (502), `text` faltante (400) — 2026-06-10
- I2 (⚡) Integration tests A1-A6, F3 y pack pro (`GET /api/skills/pro`, `POST /api/skills/pro/:id/import`) vía `route()` exportado de `server.ts`, fixtures temporales limpiadas en `afterEach` — 2026-06-10
- I3 (⚡) 402 tests · 0 fail — incluye fix de mock incompleto en `diagnose.test.ts` que rompía `saveTasks` al cargar `server.ts` — 2026-06-10
- I4 (🔍) Gate final: dashboard up (`/` 200), `GET /api/skills/pro` 200 (8 skills), export 200 con `Content-Disposition: attachment`, `skill curate` contra dashboard real produjo YAML válido sin `--save`, servidor detenido sin artefactos sueltos, tsc sin errores — 2026-06-10

**Decisiones de diseño Mes 11**
- `SkillDef` YAML propio sigue siendo la fuente de verdad — agentskills.io es puerto de entrada/salida en el borde, nunca formato central.
- Curador único con tres puertas (escribir/importar/exportar) — un solo pipeline de normalización a `SkillDef`, no tres distintos.
- Pack "pro" vive en `skills/pro/` (no `skills/`) para no colisionar con las skills del usuario; `listSkillFiles()` no recorre subdirectorios.
- `description`/`when_to_use` como condiciones de disparo ("Use when…"), nunca workflow — disciplina heredada de superpowers/mattpocock.
- Curador con hasta 2 reintentos antes de fallar — balance entre robustez y costo de LLM calls.

**Lista prohibida Mes 11** _(lo que NO se hizo — referencia histórica)_
- Endurecimiento "Iron Law / Common Rationalizations / Red Flags" en skills existentes — espera evidencia de uso del pack pro.
- `brainstorming`/planning socrático (superpowers `writing-plans` + mattpocock `grill-me`) — candidato fuerte para Mes 12.
- `verification-before-completion` y par `requesting/receiving-code-review` — quedan en backlog.
- Micrófono / dictado en Chat — falta `STTProvider` abstraction.
- Resolver imports relativos en Graph (lenguajes no-JS).
- Clasificador semántico para `clarify`.
- Design.md condicional (OpenSpec).
- KuzuDB — sin evidencia de escala.
- autoskills registry — decisión de formato pendiente.

**Métrica Mes 11 — SÍ (2026-06-10)**
Pantalla Skills completa en el dashboard (galería + crear + importar + exportar). Curador LLM (`/api/skills/curate`) normaliza lenguaje natural a `SkillDef` válido con retry — 5/5 descripciones de prueba útiles sin editar. Tres puertas operativas: escribir (curador + preview), importar (URL/YAML + normalización + warnings), exportar (download/copiar con `Content-Disposition`). Pack "pro" de 8 skills de ingeniería en `skills/pro/`, importables con un click, 8/8 validados y probados. CLI `skill curate`/`skill import` con paridad del dashboard. 402 tests · 0 fail · tsc sin errores.

---

### MES 12 — Endurecimiento: red de seguridad antes de la autonomía

Origen: auditoría de seguridad/testing/backend/frontend (2026-06-19) — calificación de entrada Seguridad B · Testing B+ · Backend A- · Frontend C+/B-. Eje: convertir la disciplina manual en garantías automáticas, hardening previo al runner de grafo autónomo (ver IDEAS.md § Largo plazo).

**BLOQUE A — Red de seguridad del motor crítico**
- A1 (⚡) Tests de `enforceContract`/`parseLLMResponse` (`src/run/contract.ts`) — write autorizado, write bloqueado fuera de `allowedPaths` con `CONTRACT VIOLATION` y cero escritura, parseo de bloques `<<<FILE:...>>>`, traversal `../` bloqueado — 2026-06-19
- A2 (⚡) Tests de `executePlan` (`src/run/scheduler.ts`) con `executeOne` mockeado — orden topológico, cascada de `skipped` por dependencia fallida, `timed_out`, agregación de cost/tokens/ms, `all_passed` — 2026-06-19
- A3 (🔍) Gate de mutación: comentado el `throw` del guard de `enforceContract` — 3 tests se pusieron rojos y el path traversal `../outside-project.txt` se materializó en disco, confirmando que el test detecta la regresión real. Revertido: 19/19 verde — 2026-06-19

**BLOQUE B — Guardarraíles automáticos: CI + pre-commit**
- B1 (⚡) `.github/workflows/ci.yml` — `bun install` + `bun test` + `bun run typecheck` en push/PR a `master` — 2026-06-19
- B2 (⚡) `scripts/pre-commit.sh` instalado en `.git/hooks/pre-commit` — `tsc --noEmit` antes de cada commit — 2026-06-19
- B3 (⚡) `noUnusedLocals`/`noUnusedParameters` activados en `tsconfig.json` + limpieza de código muerto en `planner.ts`, `harness.ts`, `server.ts`, `registry.ts`, `embeddings.ts`, `cli.ts`, `archive.ts` y otros — 2026-06-19
- B4 (🔍) Gate: PR #2 con test roto a propósito (`expect(1+1).toBe(999)`) — CI lo bloqueó en 10s. Rama eliminada, master limpio: 421 pass · 0 fail — 2026-06-19

**BLOQUE C — Cierre del XSS latente del dashboard**
- C1 (⚡) Auditoría de los ~30 `innerHTML` del front — los que renderizan datos dinámicos (skills, tareas, memoria, instincts, contenido importado) pasan por el helper `esc()` o se migraron a `textContent`; los que solo insertan constantes `ICON.*` se dejaron intactos — 2026-06-19
- C2 (🔍) Gate con payload real: skill creado vía `POST /api/skills` con `name`/`description` conteniendo `<img src=x onerror=alert(1)>` y `<script>alert()</script>` — verificado en vivo con Chrome DevTools MCP en la pantalla Skills: cero `alert()` disparado, cero nodos `<script>`/`<img>` inyectados en el DOM, texto visible escapado literalmente. Skill de prueba borrado tras verificar — 2026-06-19

**BLOQUE D — Split del god-file `server.ts`**
- D1 (🧠) Diseño documentado en `docs/dashboard-server-split.md` — mapa símbolo→archivo, grafo de dependencias sin ciclos, orden de extracción por riesgo. `route()` se mantiene como única export que consume `skills-api.test.ts` — 2026-06-19
- D2 (⚡) Extracción ejecutada siguiendo D1 — 13 módulos nuevos (`http.ts`, `settings-store.ts`, `llm/clients.ts`, `prompts/curator.ts`, 9 handlers de dominio en `handlers/`), comportamiento idéntico — 2026-06-19
- D3 (🔍) Gate re-verificado de forma independiente (sin confiar en el self-check de DeepSeek): `tsc --noEmit` limpio, 421 pass · 0 fail, lectura línea por línea de los 13 archivos contra el original — CSRF same-origin check, containment de `serveStatic`, `confirm:true` obligatorio en delete, rollback de API key en 401 y masking de keys, todos idénticos. `server.ts` quedó en 159 líneas (vs. 1727 original) — 2026-06-19

**Decisiones de diseño Mes 12**
- El hardening (Bloques A-C) precede a cualquier autonomía — no se construye un runner que se conduce solo encima de un motor sin red de tests.
- Los gates de seguridad (A3, C2) verifican que el test detecta la regresión real, no solo que "pasa" — mutación deliberada del guard, payload XSS real en vivo.
- D1 es la única pieza con criterio arquitectural del mes (Claude); D2/D3 son ejecución mecánica y verificación, delegables.
- `route()` se preserva como single entry point del routing tras el split — ningún test de integración necesitó reescritura.

**Lista prohibida Mes 12** _(lo que NO se hizo — referencia histórica)_
- Runner de grafo autónomo (el loop que se conduce solo) — deliberadamente fuera de alcance hasta que A-D cerraran. Candidato directo para Mes 13 (ver IDEAS.md § Largo plazo).
- `brainstorming`/planning socrático, `verification-before-completion`, par `requesting/receiving-code-review`, endurecimiento Iron Law/Common Rationalizations/Red Flags — siguen en backlog desde Mes 11.
- Micrófono / dictado en Chat — falta `STTProvider` abstraction.
- Resolver imports relativos en Graph (lenguajes no-JS).
- Clasificador semántico para `clarify`.
- Design.md condicional (OpenSpec).
- KuzuDB — sin evidencia de escala.
- autoskills registry — decisión de formato pendiente.

**Métrica Mes 12 — SÍ (2026-06-19)**
Motor crítico (`contract.ts` + `scheduler.ts`) con tests y gate de mutación confirmado contra regresión real. CI en GitHub Actions bloqueando PRs rotos (verificado en vivo, PR #2). Pre-commit hook con `tsc --noEmit`. XSS cerrado con payload real probado en el dashboard corriendo. `server.ts` partido de 1727 a 159 líneas en 13 módulos, re-verificado línea por línea sin cambios de comportamiento. 421 tests · 0 fail · tsc sin errores.

---

### MES 13 — OrchestOS conectado: del aislamiento al conocimiento externo

Origen: sesión de uso real 2026-06-23 + items pendientes de IDEAS.md (web fetch en chat, autoskills). Eje: romper el aislamiento — traer conocimiento externo por las vías donde el usuario interactúa (chat, skills, modelos), reusando infraestructura existente (tool-calling S23, curador/`normalizeImport` Mes 11) en vez de reconstruirla.

**BLOQUE S13.0 — Pre-flight: pulido de UI detectado en uso real**
- S13.0.1 (⚡) Edición de skills real — el botón "Editar" abría el modal read-only; ahora abre formulario editable con `PUT /api/skills/:id`, con `GET /api/skills/:id` previo (la lista trunca `instructions` a `instructionSummary`) y `id` bloqueado en modo edición — 2026-06-23
- S13.0.2 (⚡) Ícono "YAML Preview" gigante — `ICON.chev` sin regla CSS de tamaño; clase `.m-details` + `width:12px;height:12px` — 2026-06-23
- S13.0.3 (⚡) Caché de modelos OpenRouter sin invalidación — `loadOrModels()` se congelaba en la primera carga; TTL de 1h + botón Refresh manual — 2026-06-23
- S13.0.4 (🔍) Gate: `glm-5.2` apareció en el selector sin recargar la página; Refresh disparó fetch real (`orModelsLastFetch` avanzó); skills/ícono confirmados en vivo — 2026-06-23

**BLOQUE A — Web fetch real en el Chat**
- A1 (🧠) Diseño documentado en `docs/chat-web-fetch-design.md`. Hallazgo que cambió el alcance: `callWithTools()` (S23) es de un solo turno (así lo usa el planner) — no soporta conversación multi-turno ni texto+tool-call mixto. Se decidió implementar `runToolLoop()` como capa nueva, sin tocar `callWithTools`/el planner — 2026-06-23
- A2 (⚡) `runToolLoop()` en `tool-call.ts` (historial multi-turno Anthropic `tool_result` / OpenAI `role:'tool'`) + `FETCH_URL_TOOL` + wiring en `handleApiChat`, fallback intacto para Ollama/modelos sin tool-calling — 2026-06-23
- A3 (⚡) Guard SSRF (`src/dashboard/ssrf.ts`): localhost, 5 rangos privados, dominios `.local`/`.localhost`, resolución DNS de todas las IPs; cap 256 KB, timeout 10s, content-type allowlist — 2026-06-23
- A4 (🔍) Gate — **2 bugs reales encontrados solo al verificar en vivo, no por los 27 tests que ya pasaban**: (1) `checkSsrSafe` usaba `dns.resolve4()` — consulta DNS directa que falla `ECONNREFUSED` en redes que la restringen, aunque la resolución normal (la de `fetch()`) funcione ahí mismo; bloqueaba dominios públicos legítimos. Fix: `lookup(hostname, {all:true, family:4})`. (2) `executeFetchUrl` tenía un solo parámetro pero `ToolExecutor` la invoca con 2 (`toolName, input`) — JS ignoraba el extra, `input` real era el string `'fetch_url'`. Los mocks de los tests ya usaban la firma correcta, por eso ocultaban el bug. Verificado en vivo: URL real trae contenido exacto carácter por carácter, `localhost` bloqueado con mensaje verbatim, payload de prompt injection vía httpbin.org no fue obedecido por el modelo. 468 tests · 0 fail — 2026-06-23

**BLOQUE B — autoskills: skill fetch desde un registry**
- B1 (🧠) Decisión de arquitectura en `docs/autoskills-registry-design.md`: consumir el índice real de `cdn.jsdelivr.net/npm/autoskills/skills-registry/index.json` + `raw.githubusercontent.com` para contenido — `normalizeImport()` (Mes 11) ya es agnóstica al formato de entrada, se reusa sin tocar — 2026-06-23
- B2 (⚡) `orchestos skill fetch --list/--name <id>` — `fetchRegistryList()`/`fetchRegistrySkillContent()` aisladas en `src/skills/fetch.ts` — 2026-06-23
- B3 (⚡) `GET /api/skills/registry` + `POST /api/skills/registry/:id/import`, sección "Discover skills" en el dashboard con botón Import por card — 2026-06-23
- B4 (🔍) Gate — **1 bug real encontrado**: `Bun.serve()` usa `idleTimeout` de 10s por defecto; el import (fetch + normalización LLM, hasta 3 reintentos) tarda 6-14s — la conexión se cortaba antes de entregar la respuesta aunque el archivo ya se hubiera escrito (confirmado: segundo intento devolvió "Skill already exists"). Fix: `idleTimeout: 60`. Verificado en vivo: 217 skills reales listadas, `svelte5-best-practices` (description original 591 chars) importada con éxito normalizada a 97 chars, flujo completo desde la UI (Discover → Import → badge del nav 12→13) — 2026-06-23
- B5 (🧠) Fix del prompt del curador — `CURATOR_SYSTEM`/`IMPORT_SYSTEM` decían "truncate description if >200" (sugería corte mecánico). Verificado que el contenido se redistribuía bien pero `description` quedaba como resumen ("Guide for X, Y, Z") en vez de condición de disparo, rompiendo la disciplina superpowers/mattpocock. Fix: `description` ahora especifica explícitamente "Use when..." como condición de disparo, y la regla cambió a "relocate, never discard". Re-verificado: la misma skill ahora produce `description: "Use when writing, reviewing, or refactoring Svelte 5 components..."` sin perder contenido — 2026-06-23

**Decisiones de diseño Mes 13**
- Tres canales de conexión externa (chat, skills, modelos), cada uno reusando infraestructura existente — ningún motor nuevo, solo conductores nuevos sobre piezas probadas.
- `runToolLoop()` es una capa nueva sobre `callWithTools()`, no una modificación — el planner (S23) queda intacto y sin riesgo de regresión.
- Contenido externo (web fetch, registry) es siempre dato, nunca instrucción — mismo principio de boundary en todo el proyecto.
- Los gates 🔍 deben correr contra el sistema real, no solo `bun test` — los 3 bugs de Mes 13 (SSRF false-positive, arity de `executeFetchUrl`, `idleTimeout`) solo aparecieron verificando en vivo; los mocks de los tests ya tenían la forma correcta y los escondían.
- "Truncar" es la palabra equivocada para un LLM — la instrucción correcta es "redistribuir sin descartar", aprovechando que el schema de `SkillDef` ya separa el disparador (`description`/`when_to_use`) de la explicación (`instructions`).

**Lista prohibida Mes 13** _(lo que NO se hizo — referencia histórica)_
- Cliente MCP (Vercel, GitHub, etc.) — eje propio posterior al web fetch, hereda su patrón de tool externa segura pero añade acciones con efectos reales (deploy, borrado). Ver IDEAS.md § Largo plazo.
- Runner de grafo autónomo — eje de autonomía interna, distinto del eje de conexión externa de este mes. Candidato Mes 14.
- `description` vacía en `GET /api/skills/registry` — `fetchRegistryList()` no la extrae del índice ni del frontmatter (requeriría N+1 fetches). Candidato Mes 14 si genera fricción real.
- `brainstorming`/planning socrático, `verification-before-completion`, par `requesting/receiving-code-review`, endurecimiento Iron Law/Common Rationalizations/Red Flags — siguen en backlog desde Mes 11.
- Micrófono / dictado en Chat, imports relativos en Graph (no-JS), clasificador semántico para `clarify`, Design.md condicional, KuzuDB.

**Métrica Mes 13 — SÍ (2026-06-23)**
Pre-flight de UI cerrado (edición de skills real, ícono corregido, modelos con TTL+refresh). Web fetch real en el chat con loop multi-turno (`runToolLoop`), guard SSRF correcto, transparencia de tool calls — 2 bugs reales encontrados y corregidos por verificación en vivo. Registro de skills de la comunidad (217 reales) con import vía curador, idleTimeout corregido, prompt del curador ajustado para que `description` sea condición de disparo y no resumen. 468 tests · 0 fail · tsc sin errores.

---

### MES 14 — Autonomía interna: el runner que conduce el grafo solo

Origen: candidato directo anotado en DONE.md § MES 12 y § MES 13 (IDEAS.md #9). Eje: del aislamiento (Mes 13) a la autonomía — el conductor recorre el DAG completo de `tasks.yaml` de principio a fin, decide solo retry-vs-bloqueo ante un fallo vía `diagnoseTask()`, y no se detiene globalmente porque una rama caiga. Norte: intervención humana = 0 en el happy path.

**Tabla de estado de bloques**

| Bloque | Contenido | Estado |
|---|---|---|
| 0 | Pre-flight — lectura de `scheduler.ts`/`cli.ts`/`diagnose.ts`/`tasks/schema.ts`, decisión de comando aditivo | ✅ SÍ |
| A | El conductor (motor) — `graph-runner.ts`, integración de `diagnoseTask`, circuit breaker | ✅ SÍ |
| A.R | Hallazgos de review local max-effort (AR.1–AR.7) | ✅ SÍ |
| B | CLI — `run --graph` + reporte de cierre con métrica de autonomía | ✅ SÍ |
| C | Superficie en el dashboard — endpoints + pantalla "Runner de grafo" + i18n | ✅ SÍ |
| D | Tests + verificación en vivo (D1 unit, D2 dashboard real, D3 e2e real) | ✅ SÍ |
| E | Cierre formal del mes | ✅ SÍ (este registro) |
| EXTRA — BACK | Catálogo + wiring de reasoning effort por modelo | ✅ SÍ |
| EXTRA — FRONT | Selector de esfuerzo en el chat + 5 bugs de UI encontrados en vivo | ✅ SÍ |
| EXTRA — visual | Auditoría `impeccable` + 10 fixes aplicados (a11y, contraste, motion, command palette) | ✅ SÍ |

**BLOQUE 0 — Pre-flight**
- 0.1 (🔍) Lectura de `scheduler.ts`/`cli.ts`/`diagnose.ts`/`tasks/schema.ts`. Hallazgos clave: `TaskStatus` ya incluía `'blocked'` (cero cambios de schema); el patrón "aislar rama, no detener el grafo" ya existía y estaba probado en `executePlan()` (`scheduler.ts`); el gap real estaba aislado en el bloque `--all` de `cli.ts` (`MAX=20` hardcoded + `break` global al primer `failed`); `diagnoseTask()` (S25) ya era 100% reusable sin cambios — solo faltaba pasar de "sugiere" a "decide" — 2026-06-23
- 0.2 (🔍) Decisión: comando nuevo `run --graph`, sin tocar `--all` (consumidores existentes — hook post-completion S30, dogfooding en E2E.md — asumen halt-on-fail) — 2026-06-23

**BLOQUE A — El conductor (motor)**
- A1 (🧠) Diseño en `docs/graph-runner-design.md`: `'blocked'` reusado sin cambios de schema, mapa `FailurePattern`→estrategia (solo `rate_limit` autoriza requeue único en memoria), el algoritmo nunca hace `break` global (único punto de parada total es el circuit breaker A4), `blockedAncestors` porta el patrón `failedIds` de `scheduler.ts` a `Task[]` — 2026-06-23
- A2 (⚡) `src/run/graph-runner.ts`: traversal topológico completo del DAG; una rama agotada bloquea sus dependientes con razón explícita y las ramas independientes continúan — 2026-06-23
- A3 (🧠/⚡) `diagnoseTask()` integrado en `executeSingleTask()`: al llegar a `failed_permanent` aplica la estrategia de A1 automáticamente, sin pedir permiso por decisión individual — 2026-06-23
- A4 (⚡) Circuit breaker en `runGraph()`: tope de costo acumulado, tope de wall-clock, tope de iteraciones (200 hard cap), `cost_notice` a $5 — 2026-06-23

**BLOQUE A.R — Hallazgos del review local max-effort (2026-06-25)**
- AR.1 quitado `sleep(200)+continue` en atascos de grafo (dep inexistente/ciclo) — corte inmediato con `circuit_break_reason` nombrando cada tarea atascada
- AR.2 `model-catalog.ts`: fallback a disco vencido marcaba `memoryFetchedAt` con el timestamp vencido en vez de `Date.now()`, causando reintentos de fetch (10s timeout) en cada tarea del grafo — fix: un solo intento real por proceso
- AR.3 `DiagnoseResult.usdCost` expuesto (antes invisible) — `graph-runner.ts` ahora lo acumula en `accCost`
- AR.4 `--max-cost 0`/`--max-minutes 0` se trataban como "sin límite" por truthiness — fix: `!= null` en los 3 checks
- AR.5 `skipped_circuit_breaker` declarado pero nunca emitido, y tareas bloqueadas transitivamente sin entry en el reporte — fix: barrido final que cubre toda tarea sin reportar
- AR.6 dos aserciones `find(...)!` que revientan con TypeError si la tarea desaparece de `tasks.yaml` en vivo — cambiadas a check explícito con `failed_permanent` y razón clara
- AR.7 `Number(pricing.prompt)` daba NaN si el string no era numérico, serializado como `null` en cache — fix: `Number.isFinite()` guard → 0
  Todos con test de regresión donde aplicaba. 468→476 tests, 0 fail.

**BLOQUE B — CLI**
- B1 (⚡) `orchestos run --graph [path] [--max-cost N] [--max-minutes N] [--dry-run]` — `--task`/`--output` pasan a opcionales (solo obligatorios en modo one-shot), `--dry-run` imprime orden topológico en capas + config del breaker sin gastar tokens — 2026-06-25
- B2 (⚡) Reporte de cierre: tabla outcome por tarea en 4 buckets (Completed alone / Retried and resolved / Branch blocked / Unfinished) + métrica de autonomía prominente (`★ autonomy: N/M`). Exit code 0 solo si 100% autónomo — 2026-06-25

**BLOQUE C — Superficie en el dashboard**
- C1 (🧠) `POST /api/run/graph` + `GET /api/run/graph/status` — runner corre in-process (no subproceso, el resultado solo existe como objeto en memoria); estado en singleton de módulo; progreso en vivo leído de `tasks.yaml`; 409 si ya hay corrida en curso. Verificado en vivo contra dashboard real (no solo mocks) — 2026-06-25
- C2 (🧠) Pantalla "Runner de grafo": botón con `confirm()` (gasta dinero real), tabla de progreso en vivo, panel de resultado en los mismos 4 buckets del CLI, auto-refresh cada 3s mientras corre — 2026-06-25
- C3 (🧠) i18n en/es real (17 claves) — reabierto y corregido el mismo día tras detectar que una corrida delegada previa había marcado `[x]` sin código real detrás (ver [[feedback-verificar-progreso-delegado]]) — 2026-06-25

**BLOQUE D — Tests + verificación en vivo**
- D1 (⚡/🧠) 11 tests unitarios de `graph-runner.ts` (happy path, branch isolation, circuit breaker, retry guiado por diagnose, edge cases). Hardening post-C1/C2: la versión original mockeaba módulos compartidos con `mock.module()`, rompiendo otros archivos de test por falta de scope por archivo — fix real: extendido el seam de inyección de `GraphRunOpts` a `loadTasksFn`/`updateTaskStatusFn` en vez de depender de orden de archivos — 2026-06-25 (ver [[reference-bun-mock-module-gotcha]])
- D2 (🔍) Gate en vivo contra dashboard real corriendo (proyecto aislado en temp dir): grafo de 4 tareas con 2 ramas falladas a propósito — confirmó que la tercera rama independiente completó sin interferencia, costo real $0.000815, `autonomy_metric: 0.25` verificado contra archivos en disco — 2026-06-25 (ver [[feedback-verificar-gates-en-vivo]])
- D3 (🔍) Smoke real end-to-end contra el `tasks.yaml` real de OrchestOS, sin supervisión. Destapó un falso positivo de QA (el harness no corría `tsc`/tests reales sin `checks:` declarados) — fix: `defaultChecksFor()` agrega checks deterministas automáticamente. Destapó un segundo bug: fallo de check no respetaba `MAX_RETRIES` — fix en `harness.ts`. Re-verificado en vivo una tercera vez: `failed_permanent` exacto en `retry=3/3`. 510 tests · 0 fail. Costo total de verificación: ~$0.04 USD. Hallazgo fuera de alcance (follow-up): `--keep-worktree` no aisló correctamente (`sandbox: worktree mode selected but no branch/task id`) — sin daño, no se tocó.

**EXTRA — Control de reasoning effort por modelo (BLOQUE BACK + FRONT, en paralelo, no bloqueó el cierre)**
- BACK.1–BACK.5: catálogo captura `supportsReasoning` desde `supported_parameters` de OpenRouter; `openrouter.ts`/`tool-call.ts` propagan `effort` opcional al body; `handleApiChat` valida y descarta en silencio si el modelo no soporta el parámetro; verificado con dinero real (3 llamadas reales a distintos modelos) — 2026-06-29
- FRONT.1–FRONT.10: selector de esfuerzo condicional al modelo, persistido en `localStorage`; combobox de modelo rediseñado con búsqueda integrada; botones de chat circulares sin triángulos; auto-grow de textarea (chat + tasks); menú de tipo de adjunto (Imagen/Documento/URL). 5 bugs reales encontrados y corregidos solo al verificar en vivo con Playwright: overlap visual selector↔refresh, placeholder multilínea inflando el auto-grow, y el más serio — `App.fetchAll()` hacía `rerender()` incondicional cada 30s, borrando silenciosamente cualquier input activo (textarea del chat, buscador de modelo) mientras el usuario escribía — 2026-06-29

**EXTRA — Pulido visual del dashboard (en paralelo, no bloqueó el cierre)**
- Auditoría real con `/impeccable audit` + `/impeccable critique` sobre `src/dashboard/public/`: Audit Health Score 12/20, Design Health Score 24/40. 2 hallazgos P1 nuevos no anticipados por el usuario: navegación por teclado rota en toda la app, contraste real que falla WCAG (`--text-faint`, `.ln.dim` de terminal) — 2026-06-25
- 10 fixes aplicados y verificados en vivo con Playwright: profundidad del compose-bar, jerarquía tipográfica (2 archivos HTML estáticos de uso avanzado, antes 5 tamaños dispersos → 2 niveles limpios), estados vacíos con tinte de accent, command palette (Cmd/Ctrl+K), navegación por teclado (`tabindex`+`role`+handler), contraste WCAG corregido (`--text-faint` 4.12:1→6.01:1, `.ln.dim` 3.31:1→4.90:1), `prefers-reduced-motion` global, CSS muerto del Kanban eliminado (~46 líneas), layout-property transitions reemplazadas por `grid-template-rows`/`opacity` — 2026-06-26
- 1 bug fuera de los 6 ítems originales, encontrado durante la verificación: loop infinito de fetch+rerender en Chat cuando falta `OPENROUTER_API_KEY` (cada fallo de `/api/chat/models` re-disparaba el fetch) — fix: flag `orModelsAttempted` que limita el auto-load a un intento por sesión — 2026-06-26
- **Nota de portabilidad de plugins**: los plugins de diseño usados acá (`impeccable`, `taste-skill`, `frontend-design`) están instalados a nivel de **usuario** en la PC donde se hizo esta auditoría (`scope: "user"`, bajo `~/.claude/plugins`) — **no viajan con `git pull`**, solo el código y `PLAN.md`/`PRODUCT.md` (commiteados) viajan. Para tenerlos disponibles en otra máquina (ej. Mac), correr en una sesión de Claude Code ahí:
  ```
  /plugin marketplace add https://github.com/pbakaus/impeccable.git
  /plugin marketplace add https://github.com/Leonxlnx/taste-skill.git
  /plugin marketplace add anthropics/claude-plugins-official

  /plugin install impeccable@impeccable
  /plugin install taste-skill@taste-skill
  /plugin install frontend-design@claude-plugins-official
  ```
  Como `PRODUCT.md` ya queda commiteado en el repo, una vez instalados los plugins ahí `/impeccable audit/critique/polish` arrancan directo, sin pedir el init de nuevo.

**Decisiones de diseño Mes 14**
- A2 (graph-runner) no fue un motor nuevo — es `executePlan()` adaptado de `SubTask[]` a `Task[]` de `tasks.yaml`, reduciendo el riesgo porque el patrón cascada-y-continúa ya estaba en producción desde Mes 5.
- `run --graph` es aditivo, no reemplaza `--all` — evita un cambio de comportamiento silencioso sobre consumidores existentes.
- Los gates 🔍 deben correr contra el dashboard/CLI real con dinero real cuando aplica — D2/D3/BACK.5/FRONT.4 encontraron bugs reales (falso positivo de QA, check sin tope de retry, loop de rerender) que ningún mock había mostrado.
- `mock.module()` sin scope por archivo es un riesgo estructural de la suite — D1 lo resolvió con inyección de dependencias real en vez de depender de orden de archivos; ver [[reference-bun-mock-module-gotcha]] (riesgo similar detectado y corregido post-cierre en `diagnose.test.ts`/`memory-judge.test.ts` mockeando `fetch` en vez del módulo).
- El trabajo EXTRA (reasoning effort, pulido visual) corrió en paralelo sin bloquear el cierre del eje central del mes — mismo patrón que permitió cerrar Mes 14 sin deuda acumulada.

**Lista prohibida Mes 14** _(lo que NO se hizo — referencia histórica)_
- Cliente MCP (Vercel, GitHub, etc.) — eje propio posterior, con acciones de efectos reales (deploy, borrado). Ver IDEAS.md § Largo plazo.
- `description` vacía en `GET /api/skills/registry` — sigue sin resolver desde Mes 13, no generó fricción real todavía.
- OCR para imágenes adjuntas + adjuntar varios archivos a la vez ("Folder") — el estado del chat solo soporta un archivo a la vez; soportar varios es un cambio de modelo de datos, no un ajuste de menú (anotado en IDEAS.md #13).
- `brainstorming`/planning socrático, `verification-before-completion`, par `requesting/receiving-code-review`, endurecimiento Iron Law/Common Rationalizations/Red Flags — siguen en backlog desde Mes 11.
- Micrófono/dictado en Chat, imports relativos en Graph (no-JS), clasificador semántico para `clarify`, Design.md condicional, KuzuDB.

**Métrica Mes 14 — SÍ (2026-06-29)**
`orchestos run --graph` recorre un `tasks.yaml` real completo sin intervención humana en el happy path; ante un fallo, bloquea solo la rama afectada (las independientes completan) y la decisión retry/bloqueo la toma diagnose, no el humano. Verificado en vivo en el dashboard (D2) y en el CLI real contra el `tasks.yaml` de producción del propio proyecto (D3), no solo en tests. 518 tests · 0 fail · `tsc --noEmit` limpio.

---

### Fixes post-cierre Mes 14, pre-Mes 15 (2026-06-29) — dogfooding real del flujo chat→tarea

Origen: Carlos probó en vivo el flujo "pedir algo por el chat → se crea una tarea → correrla" usando como caso real un pedido de prototipos de rediseño visual del dashboard (ver IDEAS.md, pendiente de tema oficial para Mes 15). Cada bug de abajo se encontró usando el sistema real, no leyendo código en frío — mismo principio que [[feedback-verificar-gates-en-vivo]].

**Bug 1 — prompt/parser desincronizados en el one-shot `run --task --output` (cli.ts)**
El system prompt de este path le decía al modelo que respondiera en JSON (`{"files":[...]}`), pero `parseLLMResponse` (`contract.ts`) solo entiende el formato de delimitadores `<<<FILE:path>>>...<<<ENDFILE>>>` — el mismo que ya usaba correctamente el path de `tasks.yaml`/`--graph` (`run/prompt.ts`). Rompía **cualquier** tarea one-shot, no solo el caso de prueba. Fix: alineado el prompt de `cli.ts` al formato de delimitadores real.

**Bug 2 — `max_tokens: 8192` hardcodeado en los 3 providers, sin relación con el tope real del modelo**
Generar un mockup HTML+CSS+JS completo se cortaba a mitad de archivo porque 8192 tokens de salida no alcanzan para ningún modelo "premium" de verdad — y el código no tenía forma de saberlo, porque nunca leía el dato real. Mismo principio ya aplicado a `contextLength` en `model-catalog.ts` ("el motor no debe adivinar la ventana de un modelo"): se extendió a tokens de salida. `ModelInfo.maxOutputTokens` ahora captura `top_provider.max_completion_tokens` (publicado por OpenRouter), con `maxOutputTokensFor(modelId)` síncrono (fallback `DEFAULT_MAX_OUTPUT_TOKENS=8192` si el modelo no está en catálogo). `openrouter.ts:chat()` acepta `maxTokens?` opcional; `cli.ts` lo resuelve vía `ensureCatalogLoaded()` antes de cada llamada. Decisión explícita de Carlos: no es aceptable "simplemente subir el número" sin atarlo al dato real por modelo — la alerta debe ser siempre por modelo, nunca un valor fijo adivinado.
Provider/harness genérico (`run/harness.ts`, usado por `tasks.yaml`/`--graph` vía `ProviderClient`) queda **fuera de este fix** — mezclar el catálogo de OpenRouter (no aplica igual a Anthropic/OpenAI directos) ahí es un cambio más grande, anotado como deuda conocida, no resuelto todavía.

**Bug 3 — el más serio: una excepción en la resolución de sandbox tumbaba el proceso de `task run` sin dejar rastro**
`resolveSandboxMode()` (`sandbox-policy.ts`) lanza si el working tree tiene cambios sin commitear y el modo resuelto es `worktree` — pero esa llamada, junto con `createWorktree()` y el spec-gate, vivían **fuera** del `try/catch` de `runTask()` (`harness.ts`). Cualquier excepción ahí crasheaba el subproceso entero, sin pasar por el catch-all ya documentado ("S9.4 — nunca lanza"). Síntoma real observado: una tarea creada desde el chat (`crear-web-local-comercial`) quedó en `status: running` para siempre — sin fila en `runs`, sin diagnóstico, solo un `START` suelto en el log de la corrida. Causa concreta de esa instancia: el repo tenía cambios sin commitear (los fixes 1 y 2, todavía no commiteados) cuando se disparó la tarea desde el dashboard. Fix: el `try` ahora envuelve el spec-gate + resolución de sandbox + creación de worktree, así cualquier error ahí mapea a `status:'failed'` (con razón legible) en vez de tumbar el proceso. 2 tests existentes (`spec.test.ts`, "harness spec gate") actualizados — antes esperaban `rejects.toThrow()`, ahora correctamente esperan `result.status === 'failed'`, consistente con el invariante ya documentado de que `runTask()` nunca debe lanzar. Tarea huérfana liberada manualmente de vuelta a `pending` en `tasks.yaml`.

**Bug 4 — el toggle de "Diagnose" en Tasks no volvía a colapsar**
`screens-core.js`: la flecha ▲/▼ que reemplaza al link "Diagnose" una vez cacheado el resultado se renderizaba **sin** el atributo `data-diag` (solo el link inicial lo tenía) — el handler de toggle ya existía y funcionaba bien, pero nunca se conectaba a la flecha. El click caía al handler de la fila (abría el side-panel) en vez de colapsar el detalle inline. Fix: la flecha ahora también lleva `data-diag`. Verificado en vivo con Playwright contra el dashboard real: 1er click abre (`detail-row` visible), 2do click colapsa (`detail-row` desaparece) — confirmado vía `classList`, no solo visualmente.

**Bug 5 — el refresh del dashboard siempre caía en Settings, nunca en Chat**
`app.js` redirigía a Settings ("Control Center") cada vez que `attentionCount > 0` — pero ese contador (`setup.ts`) suma `unverifiedInstincts + draftSpecs`, backlogs pasivos de revisión que casi siempre son > 0 en uso normal (99 instincts sin revisar en este caso). Esto pisaba silenciosamente la decisión ya tomada en Mes 14 EXTRA ("Chat convertido en pantalla principal") en cada recarga. Fix: el redirect urgente ahora solo dispara con `blockedTasks.length > 0` (trabajo real atascado) o el umbral de costo semanal — instincts/specs pendientes ya tienen su propio badge en el nav, no necesitan secuestrar la pantalla de inicio. Verificado en vivo con Playwright: con `blockedTasks: []` real, el refresh ahora aterriza en Chat (`heading "Chat"` + composer visibles).

**Decisión de diseño**: ningún fix de este bloque consumió generación de contenido por LLM para probarse — los 5 son debugging real sobre estado ya producido (logs, DB, tasks.yaml, dashboard en vivo), siguiendo la regla explícita de Carlos de esta sesión: tareas de generación-y-prueba-iterativa las corre él mismo por CLI para no quemar cuota de Claude; debugging de bugs reales sí lo hace Claude.

**Hallazgo abierto, anotado en IDEAS.md (no resuelto)**: la auditoría de paridad CLI↔Dashboard — varias capacidades del CLI (`spec approve/lint/archive`, `instinct set-confidence/propose`, `task run --explain/--clarify`, `skill build`, `detect/init/index`, `runs --analyze` manual) no tienen ningún botón/endpoint equivalente en el dashboard. Ver IDEAS.md #9b.

518 tests · 0 fail · `tsc --noEmit` limpio en cada fix.

---

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

## Sección 2 — Ideas implementadas (provenientes de IDEAS.md)

### planner_model / executor_model por tarea — S15 (2026-05-27)
Graduado de "lista prohibida Mes 3" a implementado.
`Task.planner_model?` y `Task.executor_model?` como override por tarea en tasks.yaml.
Gana sobre `orchestos.config.yaml`. Harness los respeta vía `autoRoute`.

### Model roles config — S15 (2026-05-27)
`orchestos.config.yaml`: models{planner, executor_heavy, executor_light, default}.
`loadOrcheConfig` con fallback chain: proyecto → global → defaults.
`autoRoute(task, config)` usa `classifyTask` existente.
Comandos `config init` + `config show`.

### Language-aware skills — S16 (2026-05-27)
`LanguageTarget` type en schema. Compilador emite solo la sección del lenguaje detectado.
`skill build --project <path>` detecta lenguaje del proyecto.
`tdd-enforcer` actualizado con targets TS/C#/Python/default.

### CONSTITUTION.md + clarify — S17 (2026-05-27)
`loadConstitution(projectPath)` + inyección en system prompt.
`needsClarify(task)`: heurística v0 con verbos ambiguos + sin input[].
`--clarify` en task run: readline pregunta antes de gastar tokens.

### Context compression — S18 (2026-05-27)
`buildContextMd(projectId)`: AGENTS.md + archivos frecuentes del graph + últimos 5 runs.
`orchestos context compress` genera CONTEXT.md (~500 tokens vs ~2000 AGENTS.md).
Harness usa CONTEXT.md si existe; `runs --detail` reporta ahorro.

### Code Graph v0 — S12 (2026-05-27)
`files` + `code_edges` en SQLite. Regex import extraction para TS/JS/Python.
`orchestos index` + `orchestos context suggest`. SHA1 dedup. 1-hop neighbor ranking.
`src/graph/index.ts` y `src/graph/suggest.ts`.

### Extracción de harness — S9 (2026-05-27)
`src/run/harness.ts`: `runTask(HarnessOpts): Promise<TaskResult>`.
cli.ts solo orquesta. Harness nunca lanza — toda excepción → `status: 'failed'`.

### acceptance_criteria[] + checks[] — S10 (2026-05-27)
`checks[]` = comandos deterministas (exit code) que corren ANTES del QA LLM.
`acceptance_criteria[]` = criterios evaluados per-item por el LLM de QA.
Si check falla → revert + retry sin gastar tokens de QA.

### Multi-provider executor — S11 (2026-05-27)
Campo `executor: openrouter | anthropic | openai | codex` por tarea.
`ProviderClient` interface. `getProvider(name)` en `src/providers/index.ts`.

### Skills de ciclo de vida — S18 (2026-05-27)
Provenientes de IDEAS.md "Skills de ciclo de vida".
`security-review`: OWASP Top 10 basics, antes de mergear código que toca auth/inputs/SQL.
`qa-structured`: cómo evaluar después de implementar (≠ acceptance_criteria que define qué).
`test-writer`: agregar tests a código existente con language_targets multi-lang.

### Expansión de lenguajes (36 langs) + skill scaffold — 2026-05-27
Proveniente de IDEAS.md y petición de cobertura real de lenguajes.
`languages.ts`: EXT_MAP expandido a 36 lenguajes (VB, F#, R, Dart, Svelte, Elixir, Haskell,
Lua, Perl, OCaml, Scala, Julia, Shell, PowerShell, SQL, Go, Rust, Swift, Kotlin, etc.)
`SUPPORTED_LANGUAGES` exportado para uso en CLI.
`src/skills/scaffold.ts`: `scaffoldSkillYaml(lang)` con 25+ perfiles reales (verifiers,
anti_patterns específicos). `yamlItem()` helper para quoting correcto.
Comandos: `orchestos skill scaffold --language <lang>` + `orchestos skill languages`.

### Graph multi-lenguaje — 2026-05-27
Expansión de Code Graph v0. Proveniente de IDEAS.md "Multi-lenguaje en Code Graph".
`INDEX_GLOB` expandido: C#, Rust, Go, Java, Kotlin, Ruby, PHP, Swift, Elixir, Haskell, Lua, Perl.
Extractores de imports por lenguaje: `extractCSharpImports`, `extractRustImports`,
`extractGoImports` (single + block), `extractJvmImports` (Java/Kotlin/Scala + wildcards),
`extractRubyImports`, `extractPhpImports`, `extractSwiftImports`, `extractElixirImports`.
Pendiente: resolución de paths relativos para lenguajes no-JS.

### Test suite (78 tests) — 2026-05-27
Primera suite de tests automatizados del proyecto.
`languages.test.ts`: detectLanguages, detectPrimaryLanguage, SUPPORTED_LANGUAGES.
`graph-imports.test.ts`: extractores JS/TS, C#, Rust, Go, JVM (wildcards), Ruby.
`skill-scaffold.test.ts`: YAML validity para 10+ lenguajes, verifiers específicos.
`router.test.ts`: classifyTask (15 casos EN/ES), autoRoute con prioridades.
`clarify.test.ts`: needsClarify, clarifyReason heurística v0.
Bug encontrado + corregido: JVM wildcard regex (`java.util.*`), YAML quoting para `[Ignore]`.

### Two-tier LLM convention — Mes 3 (2026-05-27)
Convención `⚡` / `🧠` activa en PLAN.md para delegar entre modelos.
`executor` field en tasks.yaml es el primer eslabón concreto.
`planner_model` / `executor_model` en tasks.yaml → implementado en S15.

### Sub-agentes con contextos aislados — S22 (2026-05-28)
Proveniente de IDEAS.md "Sub-agentes con contextos aislados".
Tarea "plan" genera sub-tareas via `src/agents/planner.ts`. Cada sub-tarea recibe
contexto aislado (slice de CONTEXT.md + memories filtradas por topic_key + spec propio).
Sub-agentes ejecutan en worktrees hijos. QA en cascada: un fallo cancela dependientes.
Smoke real: write-greeting→write-response (depends_on), ambas pasaron, memory_entries escritas.

### allowed_tools en SkillDef — S22.0.1 (2026-05-28)
Proveniente de inspiración DeerFlow (skills con tool policy) en IDEAS.md.
Campo `allowed_tools?: string[]` en `SkillDef` (`src/skills/registry.ts`).
Validador rechaza tools no en la lista — política dura en el harness, no sugerencia al modelo.
Las 11 skills existentes actualizadas con sus listas.

### Tabla memory_entries + topic_key upsert — S22.0.3 (2026-05-28)
Proveniente de patrón Engram (topic_key upsert) en IDEAS.md sección "Inspiración externa".
`src/db/memory.ts`: `upsertMemory()` / `getMemory()` / `listByScope()`.
`UNIQUE(project_id, topic_key)` — re-ejecución actualiza en lugar de duplicar.
Scope: `session | project | global`. Índice por `(project_id, scope)`.

### selectMemories: resolución ID→topic_key — S22 (2026-05-28)
Bug corregido antes de Mes 6: `depends_on` contiene IDs de sub-tasks (e.g. "write-greeting"),
no topic_keys (e.g. "smoke-greeting"). Fix: mapear via `allSubTasks.find(t => t.id === depId)?.topic_key`.
Sin el fix, los sub-tasks que dependen de un predecessor nunca recibían su memory en contexto.

### Function calling para el planner — S23 (2026-05-28)
Proveniente de IDEAS.md "Function calling para planner".
`planWithFunctionCalling()`: LLM llama `create_subtask` N veces, cada call validada por el SDK
antes de llegar al código — elimina errores de indentación YAML estructuralmente.
`generatePlan()`: auto-detect en runtime; providers sin tool support → YAML fallback transparente.
`src/providers/tool-call.ts`: `callWithTools()` + `supportsToolCalling()` registry.

### Context monitor — S23.0.2 (2026-05-28)
Proveniente de IDEAS.md "Context monitor" (patrón ECC ecc-context-monitor.js).
`src/hooks/context-monitor.ts`: 5 señales de salud (context%, cost, loop, scope_creep).
No bloquea — emite warnings estructurados. Debounce de 5 calls para no saturar logs.
21 tests. Integrado en harness post-`enforceContract`.

### Agente de diagnóstico de fallos — S25 (2026-05-28)
Proveniente de IDEAS.md "Agente de diagnóstico de fallos".
`diagnoseTask()` lee los últimos 3 runs de un task `failed_permanent` y consulta a Haiku
para clasificar el patrón de fallo y generar una sugerencia accionable.
Auto-trigger en `task run --all`. Nunca ejecuta — solo sugiere. El usuario aplica.

### Embeddings semánticos en suggestContext — S24 (2026-05-28)
Proveniente de IDEAS.md "Embeddings semánticos en suggestContext".
`EmbeddingProvider`: OpenAI text-embedding-3-small + Ollama nomic-embed-text (local, sin API key).
`suggestContext()` con re-rank `embed×0.6 + keyword×0.4`. Files encontrados solo por coseno → reason=`embedding`.
`--no-embed` en `orchestos index` — proyectos sin API key no se rompen.
Columna `embed_hits` en `runs` para medir ROI real en producción.

### BM25 conflict detection en memoria — S26 (2026-05-28)
Proveniente de patrón Engram (IDEAS.md sección "Inspiración externa").
`memory_fts` FTS5 virtual table + 3 triggers. `upsertMemory()` retorna `{id, candidates: ConflictCandidate[]}`.
`judgeConflict()` Haiku clasifica relación en 6 categorías: `conflict_with | supersedes | compatible | scoped | related | not_conflict`.
Tabla `memory_conflicts` con CRUD completo. CLI: `orchestos memory conflicts [--project]`.
212 tests · 0 fail.

### Middleware chain (enrichment phase) — S31 (2026-06-02)
Proveniente de patrón DeerFlow `_build_middlewares()` en IDEAS.md.
`MiddlewareFn<TCtx>` + `RunContext` + `createChain()` en `src/run/middleware.ts`.
10 middlewares en orden canónico: spec-gate → sandbox-setup → classify-route → memory-fetch → skill-route → tool-policy → constitution-load → context-source → instinct-apply → prompt-build.
`harness.ts` refactorizado: construye la chain y ejecuta `chain.run(ctx)` para la fase de enrichment. La fase de ejecución permanece inline.

### Capabilities contract + Delta headers — S32 (2026-06-02)
Proveniente de patrones OpenSpec (capabilities contract + delta headers) en IDEAS.md.
`spec draft` genera bloque `capabilities: { added, modified, removed }` en frontmatter.
`spec lint` detecta: specs con `modified`/`removed` sin headers delta, y secciones `## MODIFIED` con contenido parcial.
Headers delta: `## ADDED`, `## MODIFIED`, `## REMOVED` — para specs brownfield con cambios incrementales.

### Instincts con confidence scoring — S33 (2026-06-02)
Proveniente de patrón ECC (instincts atómicos con confidence) en IDEAS.md.
`src/instincts/schema.ts` + `src/instincts/store.ts` (SQLite tabla `instincts`).
Umbrales: `< 0.6` no aplica · `>= 0.8` aplica automáticamente. `source: manual | auto`. `verified: boolean`.
CLI: `instinct list | add | set-confidence`. Middleware `instinct-apply` en harness.
Convive con skills — no las reemplaza.

### Continuous learning v2: runs → instincts — S34 (2026-06-02)
Proveniente de patrón ECC (continuous learning v2) en IDEAS.md.
`analyze/propose.ts`: si patrón ≥ 3 runs → `instinct propose` crea instinct `source:auto`, `confidence:0.6`, `verified:false`.
CLI: `instinct review | approve | reject`. Hook post-`task run` muestra proposals nuevos.
Cierra el loop S30→S33→S34: runs → analizar → proponer → revisar → aplicar.

### Cost tracker via transcript parsing — S35 (2026-06-02)
Proveniente de patrón ECC (cost tracker via transcript parsing) en IDEAS.md.
`src/run/transcript-parser.ts`: extrae tokens por sub-agente del transcript JSON.
`runs.cost_usd` recalculado como suma total. Columna `cost_breakdown_json` con desglose por sub-agente.
`runs --detail` muestra tabla sub-agente | modelo | input_tokens | output_tokens | cost_usd.
`src/router/pricing.ts` actualizado con nuevos modelos.

### Dashboard local — S36 (2026-06-02)
`orchestos dashboard [--port 4242]`: Bun.serve + HTML/JS vanilla en `src/dashboard/public/`.
4 vistas: `/runs` (cost breakdown + context warnings), `/tasks` (status + retries + QA verdict),
`/instincts` (approve/reject desde UI), `/specs` (lint badge activo/archivado).
Cero dependencias externas. Lee SQLite directamente. Sin auth (tool local).

### Diagnóstico de fallos en el dashboard — A1-A5 (2026-06-04)
Motor S25 (`diagnoseTask`) expuesto en la UI de Tasks. Chip "Ver diagnóstico" en filas `failed` → panel inline con pattern (lenguaje humano), confidence (Alta/Media/Baja), suggestion, details. Botones "Reintentar" y "Convertir en hábito" directamente desde el diagnóstico. 3 defectos de UX corregidos en el gate A5.

### Vista editable "lo que OrchestOS sabe del proyecto" — B1-B5 (2026-06-04)
`CONSTITUTION.md` y `CONTEXT.md` accesibles desde el dashboard. Pantalla "Proyecto" con tabs "Guía del agente" (editable, auto-save debounce 1s) y "Contexto comprimido" (read-only + Regenerar). Escribe al mismo path que usa el harness — una sola fuente de verdad sin sincronización.

### Control Center — salud continua del proyecto — C1-C5 (2026-06-04)
I2/Setup extendida de checklist estático a dashboard de salud vivo. 5 bloques con semáforo: sistema, tareas bloqueadas, revisiones pendientes (instincts+specs), costo 7 días, últimos aprendizajes. Auto-refresh 30s. Links directos a la pantalla relevante. Pantalla de inicio adaptativa según atención + modo.

### Detección de modelos locales (Ollama) — D0+D0-ext (2026-06-04)
Probe automático a `localhost:11434` al arrancar. Modelos Ollama en el selector marcados "Local (Ollama)" con precio "local". Buscador en tiempo real. Chat vía `localhost:11434/v1/chat/completions` sin API key. Warning dismissible por sesión. Settings Ollama con badge "Detected/Not detected" por probe real.

### Archivos como input en Chat — D1-D5 (2026-06-04)
Input conversacional externo (distinto de `context authorize` que es del proyecto). Botón clip → imagen (vision), PDF (texto extraído), .txt/.md. Límite 10MB. Chip del archivo sobre el input. Botón "Crear tarea desde esta conversación" tras 3+ mensajes — pre-fill con últimos 3 mensajes del usuario.

### Wizard API key: muro del cold-start — E1-E5 (2026-06-04)
Wizard 3 pasos dentro del producto: qué es una API key → instrucciones por provider → pegar + verificar con llamada real. 3 proveedores (OpenRouter, Anthropic, OpenAI). Trigger desde checklist de salud y desde Settings. Rollback solo en 401. Key nunca en logs ni en respuesta. i18n 24 claves en/es.

### Superficie humano vs operador (toggle modo avanzado) — F1-F6 (2026-06-04)
Nav con dos niveles: modo normal (Tasks · Proyecto · Hábitos · Chat + toggle + Settings) y modo avanzado (+ Runs · Memory · Specs con badge `adv`). Toggle con `ICON.sliders` persistido en `localStorage`. Fade-in 250ms al activar. Redirect a Tasks al desactivar si se está en pantalla operador. Banners explicativos en Runs y Memory para el no-dev.

### Autoría de skills con curador — Bloques C-F (2026-06-10)
Curador LLM (Haiku) normaliza texto libre a `SkillDef` validado, con hasta 2 reintentos. Tres puertas en la pantalla Skills: escribir (textarea + preview editable), importar (URL o YAML pegado + normalización + warnings), exportar (download/copiar YAML con `Content-Disposition: attachment`). Paridad CLI: `orchestos skill curate "<descripción>" [--save]` y `orchestos skill import <url>`.

### Pack curado de skills de ingeniería "pro" — Bloque G (2026-06-10)
8 skills curados desde mattpocock/skills y obra/superpowers, normalizados al `SkillDef` propio: `code-review`, `refactor-guided`, `pr-description`, `bug-hypothesis`, `api-contract`, `db-migration-safe`, `perf-profile`, `doc-gen`. Viven en `skills/pro/` (separado de `skills/` del usuario). Sección "Skills recomendados" en el dashboard con botón "Importar" vía la puerta importar del curador. 8/8 validados y probados en tareas reales.

### Web fetch real en el Chat — Bloque A (2026-06-23)
El chat puede ahora traer contenido real y actual de una URL en vez de responder de memoria. `runToolLoop()` añade conversación multi-turno (LLM → `fetch_url` → resultado → respuesta final) sobre la capa de tool-calling existente (S23), sin tocar el planner. Guard SSRF resuelve DNS antes de fetch (mismo resolver que usa `fetch()`, no consulta DNS directa) y bloquea localhost/rangos privados. Contenido externo siempre se envuelve como dato, nunca instrucción — verificado en vivo con un payload de prompt injection real que el modelo no obedeció. Transparente: la respuesta del chat incluye qué URLs se fetchearon.

### autoskills — registry de skills de la comunidad (2026-06-23)
`orchestos skill fetch --list/--name <id>` y sección "Discover skills" en el dashboard — 217 skills reales del índice `cdn.jsdelivr.net/npm/autoskills`, importables con un click. Cada skill pasa por el mismo `normalizeImport()` del curador (Mes 11), sin parser de frontmatter propio. Resuelve la decisión pendiente de "¿registry propio o wrappear autoskills?" — se consume directo el índice + contenido raw de GitHub, sin intermediario propio que mantener.
