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

### Higiene de tests — fugas a la `runs` real (2026-07-05)
8 archivos de test (`harness-evidence.test.ts`, `engine-selection.test.ts`, `cli-runs-detail-engine.test.ts`, `harness-engine-persistence.test.ts`, `harness-retry.test.ts`, `spec.test.ts`, `context-monitor-db.test.ts`, `suggest.test.ts`) escribían en `~/.orchestos/db.sqlite` — la misma DB que lee el dashboard real — sin limpiar en `afterAll`/`afterEach`. Detectado por Carlos viendo filas raras ("Recent Runs" repitiendo el mismo timestamp). Corregido con cleanup por `task_id`/`prompt`+`provider`/`project_id` según cada caso; purgadas 1800 filas sucias acumuladas de meses de `bun test` local. Recurrió parcialmente en Mes 18 (I.6, memory_entries) — ver [[reference-test-fixtures-leak-into-real-db]].

### CI en rojo desde Mes 17 C.2 — 4 causas encontradas y corregidas (2026-07-06)
Todo commit desde el fix de detección honesta de Claude Code (Mes 17 C.2) fallaba en CI. Causa 1: ~17 tests de `external-engine.test.ts`/`engine-selection.test.ts` dependían sin querer de que la máquina real tuviera el binario `claude` en PATH — solo 3 mockeaban `Bun.which`; mock global agregado. Causa 2: 2 tests nuevos de `skill-auto-selection.test.ts` (Mes 18 Bloque D) pasaban en local solo porque la máquina de Carlos tiene `OPENROUTER_API_KEY` real — CI no la tiene (correctamente); fix con `sk-test-or-key` explícito por test, mismo patrón que `harness-evidence.test.ts`. Causa 3: `chat-read-project-tools.test.ts` comparaba por substring `"not found"` contra un sentinel, y la prosa real de IDEAS.md documentando la Causa 2 contenía esa misma frase — coincidencia, no bug; fix con comparación exacta contra el sentinel real. Verificado en verde en GitHub Actions (run 28808032085).
