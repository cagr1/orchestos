# ERP.4.7 — lanzar una tarea concreta desde su tarjeta en Settings → Tasks

Rol: `mecanico`. Eres la ejecutora: no delegues ni invoques `codex exec`. No commitees ni toques `PLAN.md`.
Preflight: `bun run agent:preflight -- --item ERP.4.7 --agent codex --scope "src/dashboard/app/src/**,scripts/ui-gate/flows/tasks.mjs,NEXT.md,.orchestos/feature-status.json"`.
Baseline ya corrido por el cerebro fuera del sandbox (2026-10-13): `bun run typecheck` limpio y
`bun run test:coverage` 1694 pass / 0 fail. En tu sandbox pueden fallar tests por `EADDRINUSE`: no es baseline rojo.
Hay cambios ajenos sin commitear (`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`,
`runs-summary.json`): no los toques.

## Problema
Settings → Tasks solo tiene "Run Next Task", que lanza la primera tarea `pending` con dependencias `done`
(`getRunnableTask`, `src/dashboard/app/src/api/tasks.ts:76`). Una tarea `failed` no se puede relanzar y no se puede
elegir cuál `pending` correr. El backend ya lanza por id: `POST /api/tasks/:id/run`
(`src/dashboard/handlers/tasks.ts:399`) pone la tarea en `pending` y la ejecuta. No hay que tocar el backend.

## Cambios

1. `src/dashboard/app/src/api/tasks.ts` — añadir junto a `getRunnableTask`:

   ```ts
   /** Una tarea se puede lanzar por id si está `pending` o `failed` y todas sus dependencias están `done`. */
   export function isTaskRunnable(task: TaskItem, tasks: TaskItem[]): boolean
   ```

   `failed_permanent`, `running`, `done` y `blocked` devuelven `false`. `getRunnableTask` no cambia de
   comportamiento (sigue eligiendo solo `pending`).

2. `src/dashboard/app/src/App.tsx:975` — extraer el cuerpo de `handleRunNextTask` a
   `handleRunTask(taskId: string)` (mismos pasos: guard `!currentProject || runningTaskId`, `setTaskRunError(null)`,
   `setRunningTaskId`, `runTask`, el `catch` y el `finally` actuales). `handleRunNextTask` queda como: obtener
   `getRunnableTask(tasks)` y llamar a `handleRunTask(nextTask.id)`. En el `<OrchestSettingsView>` que hoy recibe
   `onRunNextTask`/`canRunNextTask` (≈ línea 1274) pasar además:
   `onRunTask={(taskId) => void handleRunTask(taskId)}` y `taskRunBusy={Boolean(runningTaskId)}`.
   No tocar el otro `onRunNextTask` de ≈ línea 1303.

3. `src/dashboard/app/src/components/settings/OrchestSettingsView.tsx`:
   - Props nuevas (junto a `onRunNextTask`, líneas 141 y 187): `onRunTask?: (taskId: string) => void` y
     `taskRunBusy?: boolean` (por defecto `false`).
   - En la tarjeta de cada tarea (línea 2554), sustituir `<StatusBadge status={task.status} />` por un contenedor
     `<div className="flex items-center gap-2">` con, en este orden: el botón (solo si
     `onRunTask && isTaskRunnable(task, tasks)`) y el `StatusBadge`.
   - Botón: `type="button"`, texto `Run`, `aria-label={`Run ${task.id}`}`, `onClick={() => onRunTask(task.id)}`,
     `disabled={taskRunBusy}`, `aria-disabled={taskRunBusy}`, y el **mismo `className` literal** del botón "Run Next
     Task" (línea 2521). No añadir CSS ni clases nuevas; no tocar `styles.css`.

4. Test: en el archivo de tests donde ya se prueba `isTaskStillRunning` (búscalo con `grep -rn isTaskStillRunning
   src`), añadir casos de `isTaskRunnable`: `pending` sin dependencias → true; `failed` sin dependencias → true;
   `pending` con dependencia `pending` → false; `failed` con dependencia `done` → true; `done`, `running`,
   `failed_permanent` → false.

5. `scripts/ui-gate/flows/tasks.mjs`:
   - Fixture (línea 96): añadir una tercera tarea al final, con los mismos campos que las otras:
     `id: 'gate-failed-task'`, `description: 'Create NOTES.md containing the line: Retry ran.'`, `input: []`,
     `output: ['NOTES.md']`, `acceptance_criteria: ['NOTES.md contains the line: Retry ran.']`, `depends_on: []`,
     `status: 'failed'`, `retry_count: 0`.
   - Añadir `'gate-failed-task'` a `taskIds` (línea 167).
   - Antes de pulsar "Run Next Task" (línea 186), dos pasos:
     `'failed task offers its own Run button'` → `page.getByRole('button', { name: 'Run gate-failed-task', exact: true })`
     visible y habilitado; `'task with unfinished dependency has no Run button'` → el botón
     `Run gate-dependent-task` tiene `count() === 0`.
   - El paso existente `'real output visible'` busca `[README.md]` con `exact: true`: ahora hay dos tarjetas con ese
     texto; usar `.first()` para que no falle por modo estricto.
   - Después del paso `'UI and API agree on final task state'` y antes de `shot('tasks-real-data')`: leer el estado
     previo de `gate-failed-task` con `tasksFor`, pulsar su botón `Run gate-failed-task`, esperar primero (máx. 20 s,
     sondeando cada 500 ms) a que la tarea deje de estar `failed` — `waitForTaskFinished` (línea 20) da por terminada
     cualquier tarea que no esté `pending`/`running`, y la tarea parte en `failed` —, luego
     `waitForTaskFinished(api, project.id, 'gate-failed-task', before)` y añadir tres pasos:
     `'failed task relaunched by id ran'` → el `runId` final existe y es distinto del previo;
     `'relaunched task reaches done'` → `status === 'done'`;
     `'relaunch did not start the dependent task'` → `gate-dependent-task` sigue `pending` y sin `runId`.
     Cada paso con detalle real (`status=…`, `runId=…`), sin `true` literales.

## No tocar
Backend (`src/dashboard/handlers/**`, `src/run/**`), `styles.css`, el chat, otros flujos del ui-gate, `PLAN.md`.

## Verificación (corre y pega la salida)
- `bun run typecheck` (los dos tsconfig).
- `bun run lint`.
- `bun test <archivo del test del paso 4>`.
- `bunx biome lint --only=correctness/noUndeclaredVariables scripts/ui-gate/flows`.
- `bun run build:app`.
No corras `ui:gate`: lo corre el cerebro fuera del sandbox.
