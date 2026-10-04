# CI.13 — "Run" en Tasks deja escapar el error de la tarea (spec para Luna)

Ítem: PLAN.md § CI.13.

`src/dashboard/app/src/App.tsx:1234-1243`: `onRunTask` hace `try { await runTask(...); await reloadTabs() } finally {...}`
sin `catch`. Si `runTask` lanza (por ejemplo `Retry scheduled: …` desde `api/tasks.ts:114`), la promesa rechazada
sale al navegador como `pageerror` y el usuario no ve nada.

Cambio, solo ahí y copiando el patrón de `handleRunNextTask` (`App.tsx:~966-990`):
- Antes de correr: `setTaskRunError(null)`.
- `catch (error)`: `setTaskRunError(error instanceof Error ? error.message : String(error))` y recargar las tareas con
  `listTasks(currentProject.id)`, como hace `handleRunNextTask`. `taskRunError` ya se muestra en `taskError`
  (`App.tsx:1217`).
- El `finally` queda igual.

Gate: `bunx tsc --noEmit` · `bun run lint` · `bun run build:app` · `bun test` completo. El cerebro corre
`ui:gate project-tabs` en vivo. No commitear ni tocar `PLAN.md`; nada fuera de ese handler.
