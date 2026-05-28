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

## MES 5 — Confiabilidad para uso diario: end-to-end real + sandbox aislado + spec-driven

**Objetivo**: Convertir OrchestOS en una herramienta confiable para uso personal diario, ejecutando tareas reales contra APIs vivas, aisladas en worktrees, con el flujo Spec-Driven completo cerrado.

---

### SEMANA 22 — Sub-agentes con contextos aislados + hardening final 🧠

Solo si S19 (sandbox) está sólido. Tareas "plan" generan sub-tareas, cada una con contexto propio, worktree y QA.

**Módulos nuevos:**
- `src/agents/sub-agent.ts` — `SubTask` + orquestador + `SubagentResult` con status
- `src/agents/context-isolation.ts` — cada sub-agente recibe slice de CONTEXT.md + memoria scope='session' + spec propio
- `src/agents/planner.ts` — convierte tarea "plan" en array de sub-tareas con `depends_on`
- `src/db/memory.ts` — tabla `memory_entries` + `upsertMemory()` por `topic_key`
- `tests/agents/sub-agent.test.ts`
- `tests/db/memory.test.ts`
- `docs/AGENTS.md`

**Módulos modificados:**
- `src/run/scheduler.ts` — sub-tareas con prefijo de id padre, respeta `depends_on` (orden topológico)
- `src/run/harness.ts` — cada sub-tarea = nuevo worktree hijo del padre
- `src/skills/registry.ts` — añadir campo `allowed_tools?: string[]` a `SkillDef`
- `src/db/migrate.ts` — añadir migración de `memory_entries`

---

#### S22.0 — Pre-flight: 3 cambios estructurales ANTES de tocar agentes

> Cada uno cuesta una mañana ahora; retrofitearlos después de S22.13 cuesta días.
> Referencia: [IDEAS.md](IDEAS.md) sección "Inspiración externa".

- [x] S22.0.1 ⚡ `allowed_tools?: string[]` en `SkillDef` (`src/skills/registry.ts:18`) + validador + actualizar las 11 skills existentes con su lista (mayoría: `["read","write","edit"]`). Patrón: DeerFlow + ECC.
- [x] S22.0.2 🧠 Diseñar schema YAML completo del sub-task contract (lo que S22.1 va a parsear). Debe incluir desde el día uno: `id`, `description`, `acceptance`, `depends_on: string[]`, `allowed_tools: string[]` (heredado o override), `topic_key?: string` (artefacto que escribe). Patrón: gentle-ai (DAG de fases) + DeerFlow (tool policy). **2026-05-28** → `src/agents/sub-task-schema.ts`: `SubTaskDef`, `SubTaskPlan`, `validateSubTaskPlan()`, `topoSort()`, cycle detection (Kahn).
- [x] S22.0.3 ⚡ Migración `memory_entries` en `src/db/migrate.ts`:
  ```sql
  CREATE TABLE memory_entries (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL,
    topic_key   TEXT NOT NULL,
    scope       TEXT NOT NULL DEFAULT 'session',  -- session | project | global
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE(project_id, topic_key)
  );
  CREATE INDEX idx_memory_project_scope ON memory_entries(project_id, scope);
  ```
  + `src/db/memory.ts` con `upsertMemory()` / `getMemory()` / `listByScope()`. Patrón: Engram (topic_key upsert) + DeerFlow (memoria en capas).

---

#### S22.1–S22.13 — Sub-agentes

- [x] S22.1 🧠 `sub-agent.ts` — definir interface `SubTask` (consume schema de S22.0.2) e interface `SubagentResult` con estados `pending → running → completed | failed | timed_out | cancelled` y campos `result`, `error`, `topic_key_written`, `usd_cost`, `tokens`. Patrón: DeerFlow `SubagentResult` + ECC cost tracker. **2026-05-28** → `src/agents/sub-agent.ts`: `SubTaskStatus`, `SubTask`, `SubagentResult`, `createSubTask()`, `applyResult()`, `shouldSkip()`, `isRetriable()`.
- [x] S22.2 ⚡ `planner.ts` — parser robusto de la salida YAML + validación contra el schema de S22.0.2 (incluye verificar que `depends_on` referencie sub-tasks que existen, sin ciclos).
- [x] S22.3 🧠 `context-isolation.ts` — cada sub-agente recibe: (a) slice de CONTEXT.md por keywords del spec, (b) snapshot de `memory_entries` scope='session' filtrado por topic_keys relevantes (heurística inicial: prefijo coincide con su skill_id), (c) spec propio. NUNCA recibe CONTEXT.md completo. Patrón: DeerFlow (memoria en capas) + gentle-ai (orquestador pasa paths, no contenido completo). **2026-05-28** → `src/agents/context-isolation.ts`: `buildIsolatedContext()`, `sliceContext()`, `selectMemories()`, `extractKeywords()`, límite `MAX_CONTEXT_CHARS=8000`.
- [x] S22.4 ⚡ scheduler: orden topológico por `depends_on`; sub-tareas heredan provider/model del padre salvo override; cada una en su worktree hijo. Si dos sub-tareas son independientes (sin `depends_on` mutuo), aun así se ejecutan secuencial — paralelismo está en la lista prohibida de Mes 5.
- [x] S22.5 ⚡ QA en cascada: si un sub-task falla → padre a failed, no merge nada. Sub-tasks que dependían del fallido quedan en `skipped` con razón explícita en el log.
- [x] S22.5a 🧠 apply-progress merge — si un sub-task con `topic_key` ya tiene una entrada previa en `memory_entries`, el harness pasa la entrada anterior al prompt con instrucción explícita de MERGE no OVERWRITE, y `upsertMemory()` guarda el resultado combinado. Patrón: gentle-ai apply-progress continuity. **2026-05-28** → `context-isolation.ts`: `selectMemories` separa `prior` + instrucción MERGE en `renderContext`; `commitTopicKey()` exportada. `scheduler.ts`: llama `commitTopicKey` post-éxito si `projectId` + `topic_key_written`.
- [x] S22.6 ⚡ `orchestos task run --expand <plan-task-id>` — ejecuta plan + sub-tareas en una pasada, respetando DAG.
- [x] S22.7 ⚡ tests: (a) plan de 3 sub-tareas linear, una falla → rollback completo y dependientes en skipped; (b) plan con DAG no linear (A → B, A → C) → orden topológico correcto; (c) re-ejecución de sub-task con topic_key existente → merge funcional; (d) sub-task con `allowed_tools=[]` → harness rechaza si el modelo intenta usar tool no autorizada.
- [x] S22.8 🧠 hardening: rate limit, timeout por sub-task (default 5 min), worktree colisión → retries con backoff donde aplique. Regla de delegación: si una sub-task pasa 20 tool calls sin completar → cancelar con `timed_out`. Patrón: gentle-ai delegation rules. **2026-05-28** → `src/agents/hardening.ts`: `withSubTaskTimeout()`, `ToolCallCounter`, `ToolCallLimitError`, `createWorktreeWithRetry()` (exp. backoff), `withRateLimitRetry()`, `isRateLimitError()`. `scheduler.ts`: worktree usa retry, `executeOne` envuelto con timeout, `ToolCallLimitError` → `timed_out`.
- [x] S22.9 ⚡ `docs/AGENTS.md` con flujo completo y ejemplo real (incluye diagrama del DAG de una tarea plan).
- [x] S22.10 🧠 smoke real: tarea "plan" → 2 sub-tareas con `depends_on` real → ambas pasan → memoria de la primera leída por la segunda vía topic_key → resultado en branch base. **2026-05-28** → `src/agents/executor.ts`: `executeSubTask()` (SubTask→Task→harness→SubagentResult, tool-violation, rate-limit retry). `src/run/e2e-smoke-agents.ts`: repo git temporal, plan YAML `write-greeting→write-response`, verifica archivos + `memory_entries` en base branch. Script: `bun run e2e:smoke-agents`. **RESULTADO REAL**: ✓ write-greeting (428in/269out, 16s) ✓ write-response (430in/152out, 28s) · greeting.txt="Hello from sub-agent A" · response.txt="Response: OK" · memory_entries smoke-greeting+smoke-response escritos · 44s total.
- [ ] S22.11 ⚡ README + CHANGELOG con resumen Mes 5 (mencionar explícitamente: sub-agentes con context isolation + memoria persistente + tool policy).
- [ ] S22.12 ⚡ Validación: `bun test` verde + smoke S22 verde + 5 tareas reales ejecutadas durante el mes (bitácora en `docs/E2E.md`).
- [ ] S22.13 ⚡ Commit `feat(agents): sub-agentes con contextos aislados + cierre Mes 5`

---

### Decisiones de diseño Mes 5

1. **Worktrees reemplazan snapshot/restore** — `restoreContents()` se elimina. Si el repo no es git → fallback a cwd con warning, no se inventa un VFS.
2. **Spec es opcional por defecto, obligatorio por config** — `requireSpec: true` en `orchestos.config.yaml`. Permite adopción gradual sin romper tareas existentes.
3. **autoskills es solo HTTP fetch al raw de GitHub** — sin `npx`, sin runtime externo, sin autenticación. Si el registry cambia de formato → falla con mensaje claro.
4. **Resolvers de imports son best-effort** — si un import no se resuelve, `to_file_id = null` sigue siendo válido. El graph no es ground truth, es ayuda para contexto.
5. **Sub-agentes solo si S19 cierra limpio** — si sandbox arrastra problemas, S22 se reduce a hardening puro. Worktrees sólidos son prerequisito no negociable.
6. **Dogfooding obligatorio** — Mes 5 se valida con al menos 5 tareas reales propias ejecutadas durante el mes, no solo con tests sintéticos.
7. **S22.0 es bloqueante para S22.1+** — los 3 prerrequisitos (`allowed_tools` en skills, schema YAML de sub-task, tabla `memory_entries`) deben estar mergeados antes de empezar `sub-agent.ts`. Retrofitear estos campos después rompe contratos ya escritos en planner/scheduler/QA.
8. **Memoria de sub-agentes vive en `memory_entries`, no en archivos** — un sub-agente nunca lee/escribe archivos `.md` de memoria. Acceso solo vía `upsertMemory()` / `getMemory()` con `topic_key`. Esto evita race conditions entre worktrees paralelos y permite scope='session' que se descarta al cerrar la tarea padre.
9. **Tool policy es del lado del harness, no del prompt** — el `allowed_tools` no es una sugerencia al modelo, es una verificación dura en el harness. Si la salida del LLM intenta usar una tool fuera de su lista → fail con `qa_verdict: tool-violation`. Esto bloquea el patrón de "el modelo se inventa lo que necesita".

### Lista prohibida Mes 5

- Dashboard web, UI gráfica, TUI interactiva
- Servidor HTTP, modo daemon, SaaS
- Autenticación, multi-usuario, RBAC
- Integración con plataformas externas (Linear, Jira, GitHub Issues)
- Nuevos providers de LLM — mantener anthropic/openai/openrouter/codex
- Reescritura del code graph — solo añadir resolvers
- Telemetría, analytics, observability stack
- Plugin system, extensiones de terceros
- Paralelismo entre tareas — scheduler sigue secuencial

### Dependencias

```
S19 (sandbox + e2e real) ────────────────────────────────────────────────┐
S20 (spec-driven) ───────────────────────────────── (requiere S19 para smoke)
S21 (graph resolvers + autoskills) ──────── independiente, puede ir en paralelo
S22.0 (allowed_tools + sub-task schema + memory_entries) ← prerrequisito puro
S22.1–S22.13 (sub-agentes) ← requiere S19 + S20 + S22.0 cerrado ──────────┘
```

**Roles de delegación dentro de S22:**

- 🧠 **Opus / Claude Sonnet alto razonamiento** — diseña contratos (S22.0.2, S22.1), implementa context isolation (S22.3), apply-progress merge (S22.5a), hardening (S22.8), valida smoke real (S22.10).
- ⚡ **Sonnet estándar / cualquier LLM con acceso al PLAN.md** — implementa migraciones (S22.0.3), parser (S22.2), scheduler ya con contrato claro (S22.4), QA cascada (S22.5), CLI flag (S22.6), tests (S22.7), docs (S22.9, S22.11), commits (S22.13).
- Regla práctica: si la tarea ya tiene el contrato/schema diseñado por una tarea 🧠 anterior, la implementación es ⚡. Las tareas 🧠 son las que toman decisiones de diseño irreversibles.

### Métrica única de éxito Mes 5

**¿Pude ejecutar al menos 5 tareas reales propias durante el mes, cada una con spec aprobado, en su worktree aislado, con QA pasando, y mergeadas a mi branch base sin intervención manual?**

- [ ] **SÍ** → Mes 5 cerrado. Abrir plan Mes 6.
- [ ] **NO** → S19 o S20 quedaron débiles y bloquean adopción. Identificar cuál eje falló.
