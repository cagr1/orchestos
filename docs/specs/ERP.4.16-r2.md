# ERP.4.16 ronda 2: el gate `tasks` vuelve a la pestaña Tasks

Rol: `mecanico`. Escribe bajo el candado del cerebro (`AGENT_WRITER_TOKEN`); si dice `ocupado: claude`, seguir.
Los cambios sin commitear de la ronda 1 (`src/cli.ts`, `src/db/task-memory.ts`, `src/__tests__/task-memory.test.ts`,
`scripts/ui-gate/flows/tasks.mjs`) son tuyos. `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json` y
`.orchestos/feature-status.json` son ajenos.

Problema: el cerebro corrió el gate en vivo. Pasaron los dos pasos nuevos de Memory y después el flujo falló con
`locator.isEnabled: Timeout 30000ms exceeded` (`tasks.mjs:381`). El clic en la pestaña Memory (`:362`) deja la vista
en Memory, y los pasos siguientes buscan el botón `Run gate-failed-task`, que está en la pestaña Tasks.

Cambio: en `scripts/ui-gate/flows/tasks.mjs`, después del paso
`completed task memory is visible in project Settings Memory`, volver a la pestaña con
`page.getByRole('button', { name: 'Tasks', exact: true }).click()` (la etiqueta sale de `OrchestSettingsView.tsx:2156`).
Después, esperar a que `[data-task-row][data-task-id="gate-failed-task"]` esté visible. Ningún otro cambio.

Verifica: `bunx biome check scripts/ui-gate/flows/tasks.mjs`. El gate en vivo lo corre el cerebro: tu sandbox no
abre puertos. Nada de `prettier` ni `git stash`, y no commitear.
