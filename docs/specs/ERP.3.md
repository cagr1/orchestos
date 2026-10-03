# ERP.3 — Orquestación opcional con freno efectivo de consumo

Ítem: PLAN.md § ERP.3. Plan aprobado por Carlos 2026-10-03 (tope total **por ejecución del padre**; con OFF el
auto-split se **omite** y la tarea corre con un solo ejecutor). Reconstruida tras el cierre para el gate de
procedencia (el original no se commiteó antes de borrarse); contenido equivalente al que ejecutó Luna.

Eres el EJECUTOR. No invoques `codex exec` ni delegues. No commitees. No toques `IDEAS.md` ni `orchestos.config.yaml`.

## Contexto verificado

- Hijos nacen por 3 caminos que terminan en `executePlan` (`src/run/scheduler.ts`, serial): auto-split del harness
  (`src/run/harness.ts:392`), `task run --expand` (`src/cli.ts:1483`, `src/cli.ts:1641`) y approve-split del
  dashboard (`src/dashboard/handlers/tasks.ts`). Además `src/run/e2e-smoke-agents.ts`.
- Delegación interna de los CLI (medido en vivo 2026-10-03): claude `--disallowedTools Agent` quita `Task`;
  codex 0.160 `multi_agent` OFF no cambia nada observable → no garantizado; opencode `task` → no garantizado.

## Cambios

1. `orchestration?: { enabled; maxConcurrent?; maxTotal? }` en schema/loader; ausente = OFF; ON exige ambos ≥1.
2. `src/run/orchestration-budget.ts` + migración 19: `openBudget`/`reserveChild`/`releaseChild`/`readBudget`,
   reserva en `BEGIN IMMEDIATE` antes de cada spawn; rechazo ⇒ hijo `skipped` sin worktree.
3. OFF: harness omite auto-split; `--expand` y approve-split (409) rechazan antes del spawn.
4. `CliDefinition.subagentBlock` en `cli-registry.ts`; con OFF los builders de tareas (y `*Display`) añaden los args.
5. `GET/PUT /api/orchestration` con scope de proyecto: política, `current`, consumo (`null` = desconocida),
   `extraCalls` (planner, QA, adversarialQA, refuterQA, retries) y garantía por adaptador.
6. Settings del proyecto: switch, dos límites, activos/total, consumo, llamadas adicionales, adaptadores.

## Ronda 2

Run por ejecución (`sha256(root, padre, sha256(plan))` + `finished_at`, `finishBudget` en `finally`); leases por PID
(`orchestration_leases`, los de PID muerto se borran al reservar); `SchedulerOpts.orchestrationBudget` obligatorio.

## Ronda 3

Switch ON no guarda defaults; guardar solo con ambos límites; error del PUT visible. Flujo
`scripts/ui-gate/flows/orchestration.mjs` por la UI (patrón `project-isolation.mjs:214-221`).

## Ronda 4

Switch OFF optimista (estado antes del PUT, revertir si falla). El cerebro quitó con `sed` la espera de
`Activos/total:` en el flujo (solo aparece con ejecución en curso).

## Gate

`orchestration-budget.test.ts` con procesos reales, tests de handler/args, `bun run test:coverage`, tsc, biome,
`ui:gate orchestration` en dashboard real.
