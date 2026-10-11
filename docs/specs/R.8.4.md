# R.8.4 — Reinicio del dashboard a mitad de run

Ítem de `PLAN.md` (R.8.4). Decisión de Carlos 2026-10-11: un run huérfano se **marca interrumpido y se reporta**;
nunca se relanza solo.

Recreado el 2026-10-11 al cierre: los specs de las 5 rondas se escribieron sin commitear y se borraron antes del
commit de cierre. Este archivo reúne lo que mandaron.

## Problema (verificado en código)

- El reporte de fin de tarea en el chat dependía de un callback en memoria: `proc.exited.then(onExit)` en
  `src/dashboard/handlers/tasks.ts:348`. Si el dashboard se reinicia a mitad del run, nadie llama a
  `reportTaskOutcome` (`src/dashboard/handlers/task-report.ts:5`) y el chat se queda en `▶ Started task`.
- No existía reconciliación al arrancar: si el runner muere junto con el dashboard, la tarea queda en `running` en
  `tasks.yaml` para siempre.
- El runner es hijo del dashboard (`Bun.spawn`). Un `SIGTERM` solo al PID del dashboard lo deja vivo y huérfano; un
  Ctrl-C en la terminal mata a los dos.

## Ronda 1 (criterio) — persistir, cerrar, reconciliar, gate

1. Migración 23 `task_run_watch` (`task_id`, `root`, `project_id`, `session_id`, `pid`, `created_at`; clave
   `root`+`task_id`) y módulo `src/db/task-run-watch.ts`.
2. `spawnTaskRun` recibe `sessionId` en lugar de `onExit`, registra la fila (también sin sesión) y al salir el hijo
   llama al cierre único. Call sites: `handlers/chat.ts` y `handlers/tasks.ts`.
3. `settleTaskRun(row)` en `handlers/task-report.ts`: escribe el reporte si hay sesión y borra la fila; idempotente.
4. `reconcileTaskRuns`, una vez desde `startServer`, sin bloquear el arranque:

| Estado en `tasks.yaml` | Runner | Acción |
| --- | --- | --- |
| terminal o `pending` con reintento | cualquiera | `settleTaskRun` |
| `running` | vivo | vigilar el PID (timer `unref`, ~2 s) y re-evaluar al morir |
| `running` | muerto | `failed` + motivo de interrupción, luego `settleTaskRun` |
| tarea o proyecto inexistentes | — | borrar la fila |

   "Runner vivo" = el PID existe y su línea de comando es `task run … --id <taskId>`, detrás de una sonda inyectable.
5. `scripts/ui-gate/run.mjs` expone `ctx.restartDashboard()` (mismo `ORCHESTOS_HOME`, puerto y log). Flow nuevo
   `restart-mid-run` con tarea real: A el runner sobrevive, B el runner muere con el dashboard.
6. Tests unitarios de la tabla con sonda inyectada.

## Ronda 2 (criterio) — el runner muere con el dashboard vivo

Hermano del bug: `proc.exited` llamaba a `settleTaskRun` sin mirar el estado; la tarea quedaba en `running` y el chat
decía `✗ Task … running`. `settleExitedTaskRun(row)` reutiliza `reconcileRow` con sonda "muerto". Motivo único:
`Interrupted: the task runner stopped before the task finished.` Caso C en el gate.

## Ronda 3 (mecanico) — hallazgos de `qa`

- `deleteTaskRunWatch(row)` borra solo ese lanzamiento (`pid` + `created_at`) y devuelve si borró.
- `settleTaskRun` = reclamo atómico en una transacción `immediate`: borrar fila + escribir reporte; si falla, la fila
  queda para el próximo arranque. Se quita la consulta por encabezado del reporte.
- `reconcileRow` relee la fila vigente y no toca nada si ya no es ese lanzamiento.
- `commandIsRunnerOf(command, taskId)`: el id casa como argumento completo (`task-1` ≠ `--id task-10`).

## Ronda 4 (mecanico) — pre-push

`restart-mid-run` entra a `ui_flows` en `scripts/pre-push.sh`, después de `qa-negative`; `bun run hooks:install`.

## Ronda 5 (mecanico) — el caso A no depende de que el ejecutor acierte

Una corrida falló porque Codex se negó a escribir el archivo (ver R.8.5 en `PLAN.md`); el reporte sí se recuperó. El
caso A comprueba un único reporte coherente con el estado final (`done`, `pending` con reintento o fallo) y que el
run quedó registrado, sin exigir `done`.

## Qué NO tocar

`scripts/ui-gate/flows/read-boundary.mjs`, `IDEAS.md`, `orchestos.config.yaml` (cambios ajenos). Frontend. No
reanudar ni relanzar runs. No cambiar el formato del reporte de I.7.2.

## Verificación

`bunx tsc --noEmit` · `bun run test:coverage` · `bun run ui:gate restart-mid-run auto-flow`.
