# Changelog

## Mes 5 — Sub-agentes con contextos aislados + spec-driven + sandbox

### Añadido
- Sub-agentes: `planner.ts`, `scheduler.ts`, `sub-agent.ts`, `sub-task-schema.ts`, `context-isolation.ts`
- Memoria persistente: `memory_entries` en SQLite + `memory.ts` (upsert/get/listByScope)
- Tool policy: `allowed_tools` en cada skill YAML + validación en planner/harness
- `orchestos task run --expand <plan-task-id>`: ejecuta plan + sub-tareas en una pasada
- Context isolation: cada sub-agente recibe solo su slice de CONTEXT.md + memoria relevante
- Cascade QA: fallo de un sub-task propaga `skipped` a dependientes
- Apply-progress merge: re-ejecución con `topic_key` existente hace MERGE no OVERWRITE
- Sandbox via worktrees: cada sub-task en worktree propio, merge en éxito, discard en fallo
- Spec-driven workflow: spec obligatorio por config (`requireSpec: true`)
- Graph resolvers + autoskills desde GitHub raw
- `docs/AGENTS.md` con flujo completo y ejemplo real

### Cambiado
- 11 skills actualizadas con `allowed_tools` (read/write/edit según su función)
- README actualizado con sección de sub-agentes

### Técnico
- `bun test` — 134 tests en total (sandbox, spec, scheduler, planner, memory)
- `tsc --noEmit` — 0 errores
