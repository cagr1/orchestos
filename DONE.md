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

### Two-tier LLM convention — Mes 3 (2026-05-27)
Convención `⚡` / `🧠` activa en PLAN.md para delegar entre modelos.
`executor` field en tasks.yaml es el primer eslabón concreto.
`planner_model` / `executor_model` en tasks.yaml → implementado en S15.
