# R.8.3 ronda 4 — Runs se recarga también cuando la tarea es rechazada (spec autónomo)

Ítem de PLAN.md: R.8.3 (preflight: `bun run agent:preflight -- --item R.8.3 --agent codex`). El árbol ya contiene
cambios sin commitear de R.8.3 (rondas 1-3, del mismo ítem, verificados por el cerebro): **son tuyos para este ítem,
no los toques ni los reviertas, y no te detengas por ellos.** No leas `docs/specs/R.8.3.md`: este archivo es todo el
trabajo.

## Defecto
Gate en vivo: el run rechazado por QA no aparece en Runs hasta reseleccionar el proyecto. El front solo recarga `runs`
en el camino feliz: cuando la tarea es rechazada, `runTask` lanza y el `catch` recarga tareas pero no runs.

## Cambios — únicamente `src/dashboard/app/src/App.tsx`
1. `handleRunNextTask` (~`:968-992`): quitar `setRuns(await listRuns(currentProject.id))` del `try` y poner en el
   `finally`, antes de `await refreshUsage()`:
   `await listRuns(currentProject.id).then(setRuns).catch(() => undefined)`.
2. `onRunTask` inline (~`:1234-1255`, el que llama `runTask(id, currentProject.id, setTasks)`): la misma línea en su
   `finally` (crearlo si no existe, sin cambiar lo que ya hace con `setRunningTaskId`).
3. `handleApproveHeldTask` (~`:932-963`): envolver la llamada `await runProjectTask(...)` en `try { … } finally { … }`
   y en el `finally`, si `thread.projectId === currentProject?.id`, ejecutar
   `await listRuns(thread.projectId).then(setRuns).catch(() => undefined)`. No capturar el error: debe seguir
   propagándose como hoy. El resto de la función queda igual.

## No tocar
Cualquier otro archivo. Sin tests nuevos. No commitear. No correr `bun run test:coverage` ni `ui:gate` (el sandbox no
abre puertos; el cerebro ya verificó fuera: 1654 pass / 0 fail).

## Verificación del ejecutor
- `bunx tsc -p src/dashboard/app/tsconfig.json --noEmit`
- `bunx biome check src/dashboard/app/src/App.tsx`
- `git diff -- src/dashboard/app/src/App.tsx` debe mostrar exactamente esos tres cambios.
