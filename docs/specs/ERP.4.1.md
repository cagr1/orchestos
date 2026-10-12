# ERP.4.1 — El chat crea la primera tarea de un proyecto sin `tasks.yaml`

## Problema
En un proyecto recién registrado (sin `tasks.yaml`), pedir trabajo por el chat responde
`⚠ Could not auto-create the task: tasks.yaml not found — run: orchestos task init`.
Origen: `createTaskRecord` en `src/dashboard/handlers/tasks.ts:257-258` devuelve 404 si el archivo no existe.

## Cambio
1. `src/tasks/init.ts`: agregar y exportar `ensureTasksYaml(root: string): boolean`, **síncrona**.
   - Bajo `withTasksLock(root, …)`: si `tasksExist(root)` → devuelve `false` sin tocar nada.
   - Si no existe: escribe con `writeTasksAtomic(tasksPath(root), …)` el YAML de
     `{ version: 1, project: <basename de root>, tasks: [] }` (mismo `yamlStringify` y `lineWidth: 120`
     que `scaffoldTasksYaml`) y devuelve `true`.
   - No llama a `buildProfile` ni siembra tareas de ejemplo.
2. `src/dashboard/handlers/tasks.ts:257-258`: reemplazar el `return { error: 'tasks.yaml not found…', status: 404 }`
   por una llamada a `ensureTasksYaml(root)` y seguir con el `mutateTasks` de abajo, sin otro cambio.
   Verificar antes que `loadTasks`/`validateTasksFile` (`src/tasks/loader.ts`) aceptan `tasks: []`; si no lo
   aceptan, detenerse y reportarlo (no relajar la validación).
3. Tests en `src/dashboard/__tests__/tasks-api-init.test.ts` (mismo patrón del archivo: tmp dir real, sin mocks):
   - `POST /api/tasks` sin `tasks.yaml` → 200, el archivo existe y contiene **solo** la tarea creada
     (ninguna tarea de ejemplo `t1-*`/`t2-*`), `project` = basename del tmp dir.
   - `POST /api/tasks` con `tasks.yaml` existente → conserva las tareas previas (no se sobrescribe).
   - Si algún test existente de ese archivo o de `src/dashboard/__tests__/` afirmaba el 404 de este camino,
     actualizarlo al comportamiento nuevo y decirlo en el reporte.
   Si el fixture hace `git commit`, usar identidad propia (`git -c user.name=… -c user.email=… commit`).

## No tocar
- Los otros `tasks.yaml not found` de `tasks.ts` (líneas 417, 452, 481, 501, 546, 608) ni `run-graph.ts:70`:
  leen o modifican tareas que ya deben existir.
- `scaffoldTasksYaml`, `POST /api/tasks/init`, el CLI `orchestos task init`, el frontend, `PLAN.md`, `NEXT.md`.
- `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`, `.orchestos/feature-status.json` tienen cambios sin
  commitear ajenos: no tocarlos.

## Verificación (la corre el ejecutor)
- `bunx tsc --noEmit`
- `bun test src/dashboard/__tests__/tasks-api-init.test.ts src/dashboard/__tests__/tasks-api-engine.test.ts`
- `bunx biome check src/tasks/init.ts src/dashboard/handlers/tasks.ts src/dashboard/__tests__/tasks-api-init.test.ts`

NO correr `test:coverage` ni detenerse por el baseline (en el sandbox da fallos falsos por puertos y sandbox
anidado; el baseline se verificó fuera). El candado de escritor `ocupado: claude …` es el cerebro que delega:
se puede editar. No commitear.
