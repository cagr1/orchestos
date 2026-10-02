# ERP.2 — Alcance de proyecto real en lectura, búsqueda y mutaciones

Problema: el front ya manda `x-orchestos-project-id` (`app/src/api/projectTabs.ts:6`, `runs.ts:35`, `chat.ts:263`),
pero el back no valida dueño en rutas por id, devuelve todo cuando no hay proyecto, y skills/instincts no distinguen
biblioteca global de lo local. Un id de B enviado con el header de A hoy funciona. Decisiones de Carlos
(2026-10-02): instincts pasan a ser por proyecto; los existentes quedan sin dueño, rotulados, nunca reasignados.

## Regla de dueño (única, para todo el back)

Nuevo `src/dashboard/ownership.ts`:

```ts
export type ProjectScope = { kind: 'project'; id: string; root: string } | { kind: 'none' }
export function requestScope(req: Request): ProjectScope
export function ownsRow(scope: ProjectScope, rowProjectId: string | null): boolean
```

- Header/`?project=<id>` → `dashboardProjectFromId` (`project-context.ts:35`; 404/410 como hoy) → `kind:'project'`.
- `?project=none` → `kind:'none'`.
- Sin selector → resolver como `resolveDashboardProject` (cwd legacy): si el cwd es un proyecto registrado →
  `kind:'project'` con ese id; si no → `kind:'none'`.
- `ownsRow`: `project` → `rowProjectId === scope.id`; `none` → `rowProjectId === null`.
- Fila ajena = **404 con el mismo mensaje que la inexistente** (no revelar que existe). Bulk: ids ajenos se ignoran
  y no cuentan en `deleted`.

## Cambios en el back

1. **Runs** (`server.ts:161-172,202-207`, `handlers/runs.ts`):
   - `GET /api/runs`: `project` → `listRunsByProjectId`; `none` → solo `project_id IS NULL`. Nunca todo.
   - `GET /api/runs/:id`, `DELETE /api/runs/:id`, `POST /api/runs/bulk-delete`: validar con `ownsRow`.
   - `POST /api/runs/analyze` (`runs.ts:148`): analizar solo runs del scope; las propuestas se insertan con ese
     `project_id` (ver 4).
   - Cada `RunRow` expone `projectId: string | null` (si no existe ya).
2. **Tareas** `GET /api/tasks/:id/steps` (`server.ts:242`): pasar por scope; la tarea debe existir en
   `loadTasks(scope.root)`; si no → 404. `kind:'none'` → 404.
3. **Memoria** (`handlers/memory.ts`, `server.ts:446-460`):
   - `GET /api/memory`: con `q` y sin proyecto ya no busca en todo: `none` → solo `scope='global'`.
   - `DELETE /api/memory/:id`, `POST /api/memory/bulk-delete`: permitido si la entrada es del proyecto del scope
     o `scope='global'`; si no → 404 / ignorado.
   - `GET /api/memory/conflicts`: usar scope (hoy lee `?project`); `none` → `[]`.
   - `POST /api/memory/conflicts/:id/resolve`: el conflicto debe tocar una entrada del proyecto del scope; si no → 404.
     `resolveConflict` (`db/memory.ts:189`) recibe `projectId` y lo verifica dentro de la query.
   - `executeSearchMemory` (`handlers/chat.ts:385`): sin `projectId` → solo `scope='global'`, nunca todo.
   - `MemoryRow` ya trae `scope`; el front lo muestra (ver Front).
4. **Instincts** (nuevo `project_id`):
   - Migración 18 (`db/migrate.ts`, después de la 17 en `:645`): `ALTER TABLE instincts ADD COLUMN project_id TEXT
     REFERENCES projects(id) ON DELETE SET NULL`; `DROP INDEX idx_instincts_trigger_unique`; `CREATE UNIQUE INDEX
     idx_instincts_project_trigger ON instincts(COALESCE(project_id, ''), trigger)`; `CREATE INDEX
     idx_instincts_project ON instincts(project_id)`. Filas existentes quedan `NULL`. Idempotente como las demás.
   - `src/instincts/store.ts`: `insertInstinct` acepta `projectId: string | null`; `listInstincts(filter)` acepta
     `projectId` (`string` → `project_id = ? OR project_id IS NULL`; `null` → `IS NULL`); `listApplicable(projectId:
     string | null)` → **solo** `project_id = ?` (los históricos sin dueño no se aplican solos); `getInstinct`,
     `approveInstinct`, `rejectInstinct`/`updateConfidence`/`deleteInstinct` usados por el dashboard validan dueño
     (fila del proyecto o `NULL`).
   - `InstinctDef`/fila del API expone `projectId: string | null`.
   - Handlers `handlers/instincts.ts` y rutas `server.ts:116-139`: todos pasan por `requestScope`; crear/proponer
     guarda `scope.id` (`none` → `NULL`). Ajenos → 404.
   - `run/middlewares/instinct-apply.ts`: proyecto = `getProject(realpathSync(ctx.effectiveRoot ?? projectRoot))?.id`
     (ver `run/middleware.ts:100,169`); sin proyecto registrado → no aplica ninguno.
   - `analyze/propose.ts:10`: `proposeInstinctsFromPatterns(patterns, projectId)`; dedupe por trigger dentro del
     mismo proyecto. Actualizar llamadas (`cli.ts:938,1345`, `runs.ts:148`); en CLI, el proyecto del cwd.
   - `handlers/setup.ts:287,307` y `cli.ts:2213-2216`: filtrar por el proyecto correspondiente.
5. **Skills** (`handlers/skills.ts:57-88`, `skills/registry.ts:114,225`):
   - `listSkillFilesWithOrigin(root): Array<{ path; origin: 'project' | 'library' }>` (misma precedencia que
     `mergeSkillDirs`: el del proyecto pisa al central → `project`). `listSkillFiles` sigue igual.
   - `SkillRow.origin: 'project' | 'library'`. `usageRuns` cuenta `WHERE skill_id = ? AND project_id = ?`
     (`kind:'none'` → `project_id IS NULL`).
   - Mutaciones de skills ya escriben solo en el proyecto (`skills.ts:192-205`): sin cambios.
6. **Chat sesiones por id** (`server.ts:235-279`, `handlers/chat-sessions.ts`, `handlers/chat.ts`):
   `messages`, `timeline`, `console`, `exec`, `turn-status`, `PATCH`, `DELETE`, `archive|restore`, y `POST /api/chat`
   / `POST /api/chat/upload` cuando reciben un `sessionId`: cargar la sesión y validar `ownsRow(scope,
   session.project_id)`; ajena → 404 sin efectos (ni mensaje guardado, ni CLI lanzado).

## Front (`src/dashboard/app/src`)

- Toda llamada por id a las rutas de arriba manda el header del proyecto actual (o `?project=none` para chats
  generales). Revisar `api/chat.ts`, `api/runs.ts`, `api/tasks.ts`, `api/projectTabs.ts`; ninguna llamada nueva sin él.
- `SkillsView.tsx`: badge por skill con `origin` — "Proyecto" / "Biblioteca" — junto al de `status` (`:118-125`),
  mismas clases del badge existente (no sumar CSS nuevo; ver regla de `styles.css`).
- `InstinctsView.tsx`: filas con `projectId === null` llevan el rótulo "Sin proyecto (histórico)" con el mismo
  estilo de badge.
- Vista de memoria: entradas `scope === 'global'` llevan rótulo "Global" si hoy no lo tienen.

## Tests

Nuevo `src/__tests__/project-isolation.test.ts`, contra `route()` (`server.ts:150`) con DB temporal (patrón de los
tests de handlers existentes; env explícito, regla CI.5). Dos proyectos A/B registrados en tmpdirs, cada uno con
centinelas propios: run, sesión de chat con mensaje, entrada de memoria `project`, conflicto, instinct, skill local,
tarea con steps. Además una memoria `global`, un run y un instinct sin dueño.
1. Listas con header A (`runs`, `memory`, `memory?q=<centinela B>`, `memory/conflicts`, `instincts`, `skills`,
   `chat/sessions`) no contienen ningún centinela de B; instinct sin dueño aparece con `projectId: null`; memoria
   global aparece en ambos.
2. Con header A y **id de B**: cada GET/DELETE/PATCH/POST por id de la sección 1–6 → 404, y la fila de B sigue
   intacta (releerla con header B). Bulk-delete mixto A+B borra solo A.
3. `POST /api/chat` con `sessionId` de B y header A → 404 y 0 mensajes nuevos en esa sesión.
4. Sin selector desde un cwd no registrado: `GET /api/runs` devuelve solo el run sin dueño.
5. `listApplicable(A)` no incluye instincts de B ni el sin dueño; migración 18 sobre una DB con instincts previos
   conserva las filas con `project_id NULL` y permite el mismo trigger en A y en B.
6. Skills: misma skill en biblioteca y proyecto → una fila `origin:'project'`; solo en biblioteca → `library`;
   `usageRuns` de A no cuenta runs de B.
Ajustar tests existentes que asuman lo global (no borrarlos: adaptarlos a la regla nueva).

## Fuera de alcance
Plan por proyecto (`/api/plan`, UI.10.A), rediseño de pantallas, reasignar o borrar datos históricos, nuevas
pantallas, `PLAN.md`, commits.

## Verificación (ejecutor)
`bunx tsc --noEmit`; `bun test` **completo** (no solo la suite dirigida); `bunx biome check` sobre archivos tocados;
`bun run build:app`. Reportar la salida real de cada uno. No commitear. No invoques codex exec ni delegues.
