# Sub-agentes — flujo completo

OrchestOS puede descomponer una tarea "plan" en sub-tareas que se ejecutan secuencialmente, cada una con su propio worktree, contexto aislado, y verificación QA en cascada.

---

## Arquitectura

```
                     ┌─────────────┐
                     │  Planner    │  (src/agents/planner.ts)
                     │  parsea YAML│
                     └──────┬──────┘
                            │ SubTaskDef[]
                            ▼
                     ┌─────────────┐
                     │  Scheduler  │  (src/run/scheduler.ts)
                     │  topo-sort  │
                     │  secuencial │
                     └──────┬──────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Sub-task │  │ Sub-task │  │ Sub-task │
        │ worktree │  │ worktree │  │ worktree │
        │ A        │  │ B        │  │ C        │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │             │             │
             ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ QA pass  │  │ QA fail  │  │ skipped  │
        │ merge ✔  │  │ discard ✗│  │ (cascade)│
        └──────────┘  └──────────┘  └──────────┘
```

## Flujo paso a paso

1. **Plan task** — una tarea en `tasks.yaml` cuyo LLM genera un YAML con `sub_tasks[]`
2. **Planner** (`src/agents/planner.ts`) — lee el `.plan.yaml` output, parsea, valida (IDs únicos, `depends_on` sin ciclos, `allowed_tools` válidos)
3. **Scheduler** (`src/run/scheduler.ts`) — orden topológico (`topoSort`), ejecuta cada sub-task secuencial en su worktree vía el harness
4. **Worktree** — cada sub-task opera en un git worktree aislado; si pasa QA → merge, si falla → discard
5. **Cascade QA** — si un sub-task falla, todos los que dependen de él se marcan `skipped`
6. **Resultados** — el scheduler reporta status por sub-task, costos agregados, tokens, y si todo pasó

---

## Ejemplo real

### tasks.yaml

```yaml
version: 1
project: mi-app
tasks:
  - id: implement-auth
    description: |
      Generate a plan to implement authentication:
      1. Create DB schema for users and sessions
      2. Implement AuthService
      3. Document the API
    executor: openrouter
    output:
      - implement-auth.plan.yaml
```

### Ejecución

```bash
orchestos task run . --expand implement-auth
```

La tarea padre llama al LLM, que escribe `implement-auth.plan.yaml`:

```yaml
version: 1
parent_task_id: implement-auth
sub_tasks:
  - id: write-auth-schema
    description: Crear schema de users y sessions
    acceptance:
      - schema.sql contiene tabla users con id, email, hashed_password, created_at
      - schema.sql contiene tabla sessions con id, user_id, token, expires_at
    depends_on: []
    allowed_tools: [read, write]
    topic_key: auth-schema
    output:
      - src/db/schema.sql

  - id: implement-auth-service
    description: Implementar AuthService con login/register
    acceptance:
      - AuthService.login retorna JWT
      - AuthService.register hashea password
    depends_on: [write-auth-schema]
    allowed_tools: [read, write, edit]
    topic_key: auth-service
    output:
      - src/services/auth.ts

  - id: write-auth-docs
    description: Documentar API de auth
    acceptance:
      - docs/AUTH.md documenta todos los métodos públicos
    depends_on: [implement-auth-service]
    allowed_tools: [read, write]
    output:
      - docs/AUTH.md
```

El scheduler ejecuta:
1. `write-auth-schema` → worktree 1 → QA pass → merge → escribe `auth-schema` en memoria
2. `implement-auth-service` → lee `auth-schema` de memoria → worktree 2 → QA pass → merge
3. `write-auth-docs` → worktree 3 → QA pass → merge

Si `implement-auth-service` falla, `write-auth-docs` se salta (`skipped`) con razón "dependency failed: implement-auth-service".

### Salida

```
[task] ✓ implement-auth done · QA pass
  → implement-auth.plan.yaml
  tokens: 150/320 · $0.00045 · 5432ms

[task] Expanding into 3 sub-tasks:
  write-auth-schema
  implement-auth-service (depends: write-auth-schema)
  write-auth-docs (depends: implement-auth-service)

  [sub] ✓ write-auth-schema done — schema correct
  [sub] ✓ implement-auth-service done — login/register implementados
  [sub] ✓ write-auth-docs done — API documentada

  ── Expand results ──
  ✓ write-auth-schema        completed    $0.00030
  ✓ implement-auth-service   completed    $0.00045
  ✓ write-auth-docs          completed    $0.00020

  total: 3 sub-tasks · 400/600 tokens · $0.00095 · 15432ms
  status: all passed ✓
```

---

## Contratos clave

| Archivo | Rol |
|---------|-----|
| `src/agents/sub-task-schema.ts` | `SubTaskDef`, `SubTaskPlan`, `validateSubTaskPlan()`, `topoSort()` |
| `src/agents/sub-agent.ts` | `SubTaskStatus`, `SubTask`, `SubagentResult`, `createSubTask()`, `shouldSkip()`, `applyResult()` |
| `src/agents/planner.ts` | `createPlan()`, `parsePlan()`, `parsePlanFromFile()` |
| `src/agents/context-isolation.ts` | `buildIsolatedContext()`, `selectMemories()`, `commitTopicKey()` |
| `src/run/scheduler.ts` | `executePlan()`, `SchedulerResult`, `SchedulerOpts` |
| `src/db/memory.ts` | `upsertMemory()`, `getMemory()`, `listByScope()` |

---

## Reglas de negocio

- **Tool policy**: `allowed_tools` se valida en el scheduler, no es sugerencia
- **Memoria**: sub-tasks con `topic_key` persisten en `memory_entries` y se recuperan en ejecuciones posteriores con instrucción MERGE
- **Paralelismo**: prohibido en Mes 5 — scheduler estrictamente secuencial
- **Cascada**: si `A → B → C` y B falla, C queda `skipped` sin ejecutarse
