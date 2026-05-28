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

### MES 6 — IA con ROI demostrable (parcial: S23–S24)

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
