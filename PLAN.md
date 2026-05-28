---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-5-activo
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

---

### S23.0 — Pre-flight Mes 6 (ANTES de tocar IA nueva)

> Dos gaps de Mes 5 que se vuelven costosos si se ignoran al escalar.

- [x] S23.0.1 ⚡ Fix `mergeWorktreeBack` (`src/run/sandbox.ts:104`): si `--ff-only` falla por divergencia → intentar `git rebase <base-branch>` + retry merge. Si rebase también falla → mensaje claro con instrucción manual (no silenciar el error). Sin este fix, múltiples tareas en una sesión real dejan worktrees colgados cuando la base branch avanza entre ejecuciones.
- [x] S23.0.2 🧠 Context monitor hook (patrón ECC `ecc-context-monitor.js`): módulo `src/hooks/context-monitor.ts` con `checkContextHealth(runState)` que retorna warnings estructurados cuando: contexto < 35% → `context_warning`; < 25% → `context_critical`; cost > $5 → `cost_notice`; mismo tool ≥ 3 veces seguido → `loop_detected`; archivos modificados > 20 → `scope_creep`. Integrar en harness post-tool-call con debounce de 5 calls. **2026-05-28** → `src/hooks/context-monitor.ts`: `checkContextHealth()`, `getModelContextWindow()`, `shouldCheck()`. `harness.ts`: llamada post-enforce con `shouldCheck(monitorCallCount ?? 0)`. 21 tests nuevos · 131 total · 0 fail.

---

### SEMANA 23 — Function calling para el planner 🧠

> El planner de S22 devuelve YAML libre — LLMs generan YAML con errores de indentación
> que rompen el parser. Function calling elimina este modo de fallo estructuralmente.

- [ ] S23.1 🧠 Tool `create_subtask` con schema estricto: `{id, description, acceptance: string[], depends_on: string[], allowed_tools: string[], topic_key?: string}`. Planner llama N veces → cada call validada por el SDK antes de llegar al código. `src/agents/planner.ts` refactoreado.
- [x] S23.2 ⚡ Fallback a parser YAML actual para providers sin tool support. Detectar en runtime: si el provider/modelo reporta tool use → function calling; si no → YAML. Transparente para el caller.
- [x] S23.3 ⚡ Tests: plan de 3 sub-tareas via function calling → schema correcto sin parsing; modelo sin tool support → fallback YAML funcional; schema inválido → error claro con campo afectado.
- [x] S23.4 ⚡ Commit `feat(planner): function calling + YAML fallback`

---

### SEMANA 24 — Embeddings semánticos en `suggestContext` 🧠

> `context suggest` usa scoring por keywords. Si la tarea dice "implementar pago con Stripe"
> y el archivo clave es `src/billing/processor.ts` sin la palabra "stripe", no lo encuentra.

- [x] S24.1 ⚡ Migración: columna `embedding TEXT` (JSON array float[]) en tabla `files` via `safeAddColumn`.
- [ ] S24.2 🧠 `EmbeddingProvider` interface + implementaciones: OpenAI `text-embedding-3-small` + Ollama `nomic-embed` (local, sin API key). `src/providers/embeddings.ts`. Mismo patrón que `ProviderClient`.
- [x] S24.3 ⚡ `indexProject()`: si archivo no tiene embedding o SHA1 cambió → llamar provider y guardar. Flag `--no-embed` en `orchestos index` para proyectos sin API key — no rompe flujo existente.
- [x] S24.4 🧠 `suggestContext()`: embedding del texto de la tarea → cosine similarity → re-rank combinado con graph traversal actual (pesos: embed_score × 0.6 + keyword_score × 0.4). Interfaz CLI idéntica. **2026-05-28** → `cli.ts` + `harness.ts` pasan `taskEmbedding` (con fallback silencioso si no hay API key). Output CLI: `◆` para semantic match. 192 tests · 0 fail.
- [x] S24.5 ⚡ Métrica de éxito: loguear en cada run si algún archivo de `suggested_context` fue añadido por embedding (no por keyword). Columna `embed_hits INT` en tabla `runs`.
- [x] S24.6 ⚡ Tests + commit `feat(graph): embeddings semánticos en suggestContext`

---

### SEMANA 25 — Agente de diagnóstico de fallos ⚡

> Cuando un task llega a `failed_permanent` (3 retries), no hay forma automática
> de saber por qué. El usuario tiene que leer `runs --detail` manualmente.

- [ ] S25.1 ⚡ Leer últimos 3 runs del task. Prompt a haiku (barato): detectar patrón de fallo — check determinístico, criterio QA específico, parse error del LLM, rate limit, scope creep.
- [ ] S25.2 ⚡ Output estructurado: patrón detectado + sugerencia concreta para modificar la task definition. **No ejecuta nada** — solo sugiere. El usuario aplica.
- [ ] S25.3 ⚡ `orchestos task diagnose <id>` explícito + trigger automático en `task run --all` al llegar a `failed_permanent`.
- [ ] S25.4 ⚡ Tests + commit `feat(tasks): agente de diagnóstico de fallos`

---

### SEMANA 26 — Memory conflict detection (patrón Engram BM25) 🧠

> Cuando múltiples sub-agentes escriben memorias del mismo proyecto, se contradicen.
> Sin detección, la memoria se corrompe silenciosamente entre sesiones.

- [ ] S26.1 🧠 Habilitar SQLite FTS5 en `memory_entries`. Al `upsertMemory()`: BM25 query contra entradas existentes del proyecto. Si score > threshold → candidato a conflicto.
- [ ] S26.2 ⚡ LLM judge (haiku) decide relación: `conflict_with | supersedes | compatible | scoped | related | not_conflict`. Solo si hay candidato con score > threshold — no corre en cada upsert.
- [ ] S26.3 ⚡ Tabla `memory_conflicts(id, entry_a_id, entry_b_id, relation, confidence, resolved_at)`.
- [ ] S26.4 ⚡ `orchestos memory conflicts [--project]` — lista conflictos pendientes de resolución.
- [ ] S26.5 ⚡ Tests + commit `feat(memory): BM25 conflict detection`

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
